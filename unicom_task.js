/*
unicom_task（QX / Surge / Loon / Node）

[rewrite_local]
^https:\/\/loginxhm\.10010\.com\/mobileService\/onLine\.htm url script-request-body unicom_task.js

[mitm]
hostname = loginxhm.10010.com

说明：
1) 先打开联通签到相关页面触发抓包，脚本会自动保存 Cookie + UA。
2) 定时任务执行时，严格先查状态（todayIsSignIn）再决定是否签到。
3) 可通过参数 mode=query_only 仅查询，不执行签到。
4) 多账号：重复抓包会自动累计；也支持传入多 Cookie（换行 / @@ / && 分隔）。
5) Cookie 失效：当识别为登录态失效时，自动从本地持久化账号中剔除该账号。
6) 抓包步骤：
   - 先在联通 App 保持登录。
   - 回到 App 首页/我的页触发一次在线登录校验（onLine.htm）。
   - 只需要抓到这一次 onLine 请求（含 cookie + token_online 链路）。
   - 回到 QX 运行定时脚本即可。
*/

var SCRIPT_NAME = "联通营业厅签到";
var SCRIPT_VERSION = "v1.4.0";
var STORAGE_SESSION_KEY = "unicom_hall_session_v1";
var STORAGE_UA_KEY = "unicom_hall_ua_v1";
var UNICOM_APP_SCHEME = "chinaunicom://";
var INTERNAL_HEADER_KEY = "x-unicom-script-internal";

var DEFAULT_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)  unicom{version:iphone_c@12.1000}";
var BASE_URL = "https://activity.10010.com/sixPalaceGridTurntableLottery";
var API = {
  state: BASE_URL + "/signin/getContinuous?taskId=&channel=shouye&imei=",
  sign: BASE_URL + "/signin/daySign",
  integral: BASE_URL + "/signin/getIntegral",
  onlineRefresh: "https://loginxhm.10010.com/mobileService/onLine.htm",
};
var CAPTURE_GUIDE_TEXT =
  "联通App保持登录 -> 回首页/我的触发onLine -> 抓到1次onLine即可 -> 再跑脚本";
var CAPTURE_CONFIG_TEXT = String.raw`[rewrite_local]
^https:\/\/loginxhm\.10010\.com\/mobileService\/onLine\.htm url script-request-body unicom_task.js
[mitm]
hostname = loginxhm.10010.com`;

var $ = new Env(SCRIPT_NAME);
var args = parseArg(getRuntimeArgument());
var mode = normalizeMode(args.mode || args.run_mode || "");
var debug = String(args.debug || "0") === "1";
var resultRows = [];

async function captureSession() {
  var url = ($request && $request.url) || "";
  var isOnline = /loginxhm\.10010\.com\/mobileService\/onLine\.htm/.test(url);
  if (!isOnline) return;

  var headers = ($request && $request.headers) || {};
  if (String(getHeader(headers, INTERNAL_HEADER_KEY) || "") === "1") return;
  var cookie = getHeader(headers, "cookie");
  if (!cookie) return;
  var reqBody = typeof $request.body === "string" ? $request.body : "";

  var ua = getHeader(headers, "user-agent") || $.getdata(STORAGE_UA_KEY) || DEFAULT_UA;
  var mobile = detectAccountId(cookie);
  var sessions = readSessionList();
  var idx = findSessionIndex(sessions, mobile, cookie);
  var existing = idx >= 0 ? sessions[idx] : null;
  var changed = !existing || existing.cookie !== cookie || existing.ua !== ua;

  if (!changed) {
    $.log(ts() + " [CAPTURE] 无变化，跳过写入");
    return;
  }

  // 新 Cookie 与旧值不同后，先验证可用性，再决定是否覆盖。
  var probeState = await queryState({ cookie: cookie, ua: ua }, true);
  if (!probeState.ok) {
    $.log(ts() + " [CAPTURE] 检测到新Cookie但验证失败，保持原会话不变");
    return;
  }

  var row = {
    mobile: mobile,
    cookie: cookie,
    ua: ua,
    updatedAt: Date.now(),
  };
  if (existing && existing.onLineBody) row.onLineBody = existing.onLineBody;
  if (existing && existing.tokenOnline) row.tokenOnline = existing.tokenOnline;
  if (isOnline && /token_online=/.test(reqBody)) {
    row.onLineBody = reqBody;
    var onlineParsed = parseFormBody(reqBody);
    if (onlineParsed.token_online) row.tokenOnline = onlineParsed.token_online;
  }
  if (idx >= 0) {
    sessions[idx] = row;
  } else {
    sessions.push(row);
  }

  saveSessionList(sessions);
  $.setdata(ua, STORAGE_UA_KEY);

  var accountText = mobile ? maskMobile(mobile) : "未知账号";
  $.log(
    ts() +
      " [CAPTURE] 保存成功: " +
      accountText +
      " | 总账号=" +
      sessions.length +
      " | todayIsSignIn=" +
      (probeState.todaySigned ? "y" : "n")
  );
  $.msg(SCRIPT_NAME, "抓包成功", "账号: " + accountText + " | 已保存会话");
}

async function runTask() {
  var sessions = loadSessionsForRun();
  if (!sessions.length) {
    $.log(ts() + " [INIT] 未检测到会话，输出抓包配置");
    $.log(CAPTURE_CONFIG_TEXT);
    $.msg(SCRIPT_NAME, "未获取到 Cookie", CAPTURE_GUIDE_TEXT, buildUnicomOpenOption());
    return;
  }

  $.log(ts() + " [INIT] version=" + SCRIPT_VERSION + " mode=" + mode + " accounts=" + sessions.length);
  var invalidStoreCookies = {};

  for (var i = 0; i < sessions.length; i++) {
    var row = await runOneAccount(sessions[i], i + 1, sessions.length);
    resultRows.push(row);
    if (row.result_category === "auth_expired" && sessions[i].source === "store") {
      invalidStoreCookies[sessions[i].cookie] = 1;
    }
    if (i < sessions.length - 1) await $.wait(500);
  }

  var successCount = 0;
  var skipCount = 0;
  var failCount = 0;
  var lines = [];

  for (var j = 0; j < resultRows.length; j++) {
    var r = resultRows[j];
    if (r.result_category === "sign_success" || r.result_category === "already_done" || r.result_category === "query_only") {
      if (r.result_category === "already_done" || r.result_category === "query_only") skipCount += 1;
      else successCount += 1;
    } else {
      failCount += 1;
    }
    lines.push(r.summary_line);
  }

  var subtitle =
    "mode=" +
    mode +
    " | 成功:" +
    successCount +
    " | 跳过:" +
    skipCount +
    " | 失败:" +
    failCount;

  var removedCount = purgeInvalidStoredSessions(invalidStoreCookies);
  if (removedCount > 0) {
    subtitle += " | 清理失效Cookie:" + removedCount;
    $.log(ts() + " [CLEANUP] 已自动删除失效账号 " + removedCount + " 个");
  }

  var hasAuthExpired = resultRows.some(function (x) {
    return x && x.result_category === "auth_expired";
  });
  $.msg(SCRIPT_NAME, subtitle, lines.join("\n"), hasAuthExpired ? buildUnicomOpenOption() : null);

  if (debug) {
    $.log(ts() + " [RESULT] " + JSON.stringify(resultRows));
  }
}

async function runOneAccount(session, index, total) {
  var account = session.mobile ? maskMobile(session.mobile) : "账号" + index;
  $.log(ts() + " [A" + index + "/" + total + "] START " + account);

  var state = await queryState(session, false);
  if (!state.ok && state.category === "auth_expired") {
    $.log(ts() + " [A" + index + "] AUTH expired, try onLine refresh");
    var refreshed = await refreshAuthByOnline(session);
    if (refreshed.ok) {
      $.log(ts() + " [A" + index + "] AUTH refresh success, retry state");
      state = await queryState(session, false);
    } else {
      $.log(ts() + " [A" + index + "] AUTH refresh failed: " + (refreshed.reason || "unknown"));
    }
  }
  if (!state.ok) {
    var autoRemoved = state.category === "auth_expired" && session.source === "store";
    var failRow = buildResult({
      account: account,
      decision_path: "query_state_failed",
      action_taken: false,
      result_category: state.category || "state_undecidable",
      key_fields: { reason: state.reason || "unknown" },
      next_step: autoRemoved ? "该账号 Cookie 已自动移除，请重新抓包" : "请重新抓包更新 Cookie 后重试",
      summary_line:
        account +
        " 状态查询失败(" +
        (state.reason || "unknown") +
        ")" +
        (autoRemoved ? " | 已自动移除" : ""),
    });
    $.log(ts() + " [A" + index + "] STOP " + (state.category || "state_undecidable"));
    return failRow;
  }

  $.log(
    ts() +
      " [A" +
      index +
      "] STATE todayIsSignIn=" +
      (state.todaySigned ? "y" : "n") +
      " continue=" +
      state.continueCount
  );

  if (state.todaySigned) {
    var integralDone = await queryIntegral(session);
    var doneLine = account + " 已签到" + (integralDone.ok ? " | 积分:" + integralDone.integralTotal : "");
    $.log(ts() + " [A" + index + "] SKIP already signed");
    return buildResult({
      account: account,
      decision_path: "query_state(y)->skip_action",
      action_taken: false,
      result_category: "already_done",
      key_fields: {
        todayIsSignIn: "y",
        continueCount: state.continueCount,
        integralTotal: integralDone.ok ? integralDone.integralTotal : "",
      },
      next_step: "none",
      summary_line: doneLine,
    });
  }

  if (mode === "query_only") {
    $.log(ts() + " [A" + index + "] QUERY_ONLY stop before action");
    return buildResult({
      account: account,
      decision_path: "query_state(n)->query_only_stop",
      action_taken: false,
      result_category: "query_only",
      key_fields: {
        todayIsSignIn: "n",
        continueCount: state.continueCount,
      },
      next_step: "切换 mode=execute 才会执行签到",
      summary_line: account + " 未签到 | query_only 模式未执行",
    });
  }

  var sign = await executeSign(session);
  $.log(
    ts() +
      " [A" +
      index +
      "] ACTION code=" +
      sign.code +
      " status=" +
      sign.status +
      " desc=" +
      (sign.desc || "-")
  );

  if (!sign.ok) {
    var signAutoRemoved = sign.category === "auth_expired" && session.source === "store";
    return buildResult({
      account: account,
      decision_path: "query_state(n)->execute_sign_failed",
      action_taken: true,
      result_category: sign.category || "action_rejected",
      key_fields: {
        code: sign.code,
        status: sign.status,
        desc: sign.desc,
      },
      next_step: signAutoRemoved ? "该账号 Cookie 已自动移除，请重新抓包" : "检查 Cookie 是否过期，必要时重新抓包",
      summary_line:
        account +
        " 签到失败(" +
        (sign.desc || sign.code || "unknown") +
        ")" +
        (signAutoRemoved ? " | 已自动移除" : ""),
    });
  }

  var verify = await queryState(session, false);
  if (!verify.ok || !verify.todaySigned) {
    return buildResult({
      account: account,
      decision_path: "query_state(n)->execute_sign->verify_failed",
      action_taken: true,
      result_category: "state_undecidable",
      key_fields: {
        verify_ok: verify.ok ? "1" : "0",
        verify_todayIsSignIn: verify.ok ? (verify.todaySigned ? "y" : "n") : "",
        sign_desc: sign.desc || "",
      },
      next_step: "建议手动打开页面确认签到状态",
      summary_line: account + " 执行后校验未通过",
    });
  }

  var integral = await queryIntegral(session);
  $.log(ts() + " [A" + index + "] VERIFY todayIsSignIn=y");
  return buildResult({
    account: account,
    decision_path: "query_state(n)->execute_sign->verify_state(y)",
    action_taken: true,
    result_category: "sign_success",
    key_fields: {
      sign_desc: sign.desc || "",
      reward: sign.reward || "",
      continueCount: verify.continueCount || "",
      integralTotal: integral.ok ? integral.integralTotal : "",
    },
    next_step: "none",
    summary_line:
      account +
      " 签到成功" +
      (sign.reward ? " " + sign.reward : "") +
      (integral.ok ? " | 积分:" + integral.integralTotal : ""),
  });
}

async function queryState(session, internalCall) {
  var imei = encodeURIComponent(inferImei(session.cookie));
  var resp = await requestJson("GET", API.state + imei, buildHeaders(session, false, !!internalCall), "");
  if (!resp.ok) {
    if (resp.statusCode === 401 || resp.statusCode === 403) {
      return { ok: false, category: "auth_expired", reason: "http_" + resp.statusCode };
    }
    return { ok: false, category: "network_error", reason: resp.reason || "network_error" };
  }
  var obj = resp.json;
  if (!obj || String(obj.code || "") !== "0000" || !obj.data) {
    var apiMsg = pickApiMessage(obj);
    if (isAuthExpiredCodeOrMsg(obj && obj.code, apiMsg)) {
      return {
        ok: false,
        category: "auth_expired",
        reason: "auth_" + String((obj && obj.code) || "unknown") + "_" + apiMsg,
      };
    }
    return {
      ok: false,
      category: "state_undecidable",
      reason: "bad_code_" + String((obj && obj.code) || "unknown"),
    };
  }
  var signed = parseTodaySigned(obj.data);
  if (signed === null) {
    return { ok: false, category: "state_undecidable", reason: "todayIsSignIn_missing" };
  }
  return {
    ok: true,
    todaySigned: signed,
    continueCount: String(obj.data.continueCount || ""),
    continueCountCur: String(obj.data.continueCountCur || ""),
  };
}

async function executeSign(session) {
  var resp = await requestJson(
    "POST",
    API.sign,
    buildHeaders(session, true, false),
    "shareCl=&shareCode="
  );
  if (!resp.ok) {
    if (resp.statusCode === 401 || resp.statusCode === 403) {
      return { ok: false, category: "auth_expired", code: "", status: "", desc: "http_" + resp.statusCode };
    }
    return { ok: false, category: "network_error", code: "", status: "", desc: resp.reason || "network_error" };
  }
  var obj = resp.json || {};
  var data = obj.data || {};
  var code = String(obj.code || "");
  var status = String(data.status || "");
  var desc = String(data.statusDesc || obj.desc || obj.msg || "");
  var reward = String(data.redSignMessage || data.blackSignMessage || "");

  if (!obj || code !== "0000") {
    if (isAuthExpiredCodeOrMsg(code, desc || pickApiMessage(obj))) {
      return {
        ok: false,
        category: "auth_expired",
        code: code,
        status: status,
        desc: desc || pickApiMessage(obj),
        reward: "",
      };
    }
  }

  var already = /已签到/.test(desc);
  var ok = (code === "0000" && (!status || status === "0000")) || already;
  return {
    ok: ok,
    category: ok ? "ok" : "action_rejected",
    code: code,
    status: status,
    desc: desc,
    reward: reward,
  };
}

async function refreshAuthByOnline(session) {
  if (!session || !session.onLineBody) return { ok: false, reason: "missing_online_template" };
  var bodyObj = parseFormBody(session.onLineBody);
  if (!bodyObj.token_online && !session.tokenOnline) {
    return { ok: false, reason: "missing_token_online" };
  }
  if (session.tokenOnline) bodyObj.token_online = session.tokenOnline;
  bodyObj.reqtime = formatOnlineReqTime(new Date());
  if (!bodyObj.version) bodyObj.version = getCookieVal(session.cookie, "c_version") || "iphone_c@12.1000";
  if (!bodyObj.deviceOS) bodyObj.deviceOS = "26.3";
  if (!bodyObj.uniqueIdentifier) bodyObj.uniqueIdentifier = "ios";

  var reqBody = toFormBody(bodyObj);
  var resp;
  try {
    resp = await $.request({
      method: "POST",
      url: API.onlineRefresh,
      headers: buildOnlineHeaders(session),
      body: reqBody,
      timeout: 15000,
    });
  } catch (err) {
    return { ok: false, reason: "network_" + stringifyError(err) };
  }

  var statusCode = Number(resp.statusCode || 0);
  if (statusCode < 200 || statusCode >= 400) {
    return { ok: false, reason: "http_" + statusCode };
  }

  var json = safeJsonParse(String(resp.body || ""), {});
  if (json && json.token_online) session.tokenOnline = String(json.token_online);
  var mergedCookie = mergeCookieString(session.cookie, pickSetCookieValues(resp.headers));
  if (mergedCookie) session.cookie = mergedCookie;
  session.onLineBody = reqBody;
  session.updatedAt = Date.now();
  persistSessionUpdate(session);
  return { ok: true, reason: "ok" };
}

async function queryIntegral(session) {
  var resp = await requestJson("GET", API.integral, buildHeaders(session, false, false), "");
  if (!resp.ok) return { ok: false, integralTotal: "" };
  var obj = resp.json || {};
  if (String(obj.code || "") !== "0000") return { ok: false, integralTotal: "" };
  var total = "";
  if (obj.data && (obj.data.integralTotal || obj.data.integralTotal === 0)) {
    total = String(obj.data.integralTotal);
  }
  return { ok: true, integralTotal: total };
}

async function requestJson(method, url, headers, body) {
  try {
    var resp = await $.request({
      method: method,
      url: url,
      headers: headers,
      body: body,
      timeout: 15000,
    });
    var statusCode = Number(resp.statusCode || 0);
    if (statusCode < 200 || statusCode >= 400) {
      return { ok: false, reason: "http_" + statusCode, statusCode: statusCode, json: null };
    }
    var text = typeof resp.body === "string" ? resp.body : "";
    var json = safeJsonParse(text, null);
    if (!json) return { ok: false, reason: "parse_error", statusCode: statusCode, json: null };
    return { ok: true, statusCode: statusCode, json: json };
  } catch (err) {
    return { ok: false, reason: stringifyError(err), statusCode: 0, json: null };
  }
}

function buildHeaders(session, withFormContentType, internalCall) {
  var headers = {
    Accept: "application/json, text/plain, */*",
    Origin: "https://img.client.10010.com",
    Referer: "https://img.client.10010.com/",
    "User-Agent": session.ua || DEFAULT_UA,
    Cookie: session.cookie,
  };
  if (internalCall) headers[INTERNAL_HEADER_KEY] = "1";
  if (withFormContentType) headers["Content-Type"] = "application/x-www-form-urlencoded";
  return headers;
}

function buildOnlineHeaders(session) {
  return {
    Accept: "*/*",
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": session.ua || DEFAULT_UA,
    Cookie: session.cookie || "",
    "X-Requested-With": "XMLHttpRequest",
    Origin: "https://img.client.10010.com",
    Referer: "https://img.client.10010.com/",
    "X-Tingyun": "c=A|uBuVhVARE0A",
  };
}

function inferImei(cookie) {
  return (
    getCookieVal(cookie, "devicedId") ||
    getCookieVal(cookie, "d_deviceCode") ||
    getCookieVal(cookie, "PvSessionId") ||
    ""
  );
}

function parseTodaySigned(data) {
  if (!data || typeof data !== "object") return null;
  var direct = ynToBool(data.todayIsSignIn);
  if (direct !== null) return direct;
  if (Array.isArray(data.current) && data.current.length) {
    var today = String(new Date().getDate());
    for (var i = 0; i < data.current.length; i++) {
      var item = data.current[i] || {};
      if (String(item.day || "") === today) {
        var fromDay = ynToBool(item.isSigned);
        if (fromDay !== null) return fromDay;
      }
    }
  }
  return null;
}

function ynToBool(v) {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  var s = String(v === undefined || v === null ? "" : v).toLowerCase();
  if (s === "y" || s === "yes" || s === "1" || s === "true") return true;
  if (s === "n" || s === "no" || s === "0" || s === "false") return false;
  return null;
}

function loadSessionsForRun() {
  var fromArg = (args.cookie || args.cookies || "").trim();
  var envCookie =
    getNodeEnvValue(["UNICOM_HALL_COOKIES", "unicom_hall_cookies"]) ||
    getNodeEnvValue(["UNICOM_HALL_COOKIE", "unicom_hall_cookie"]);
  var envUa = getNodeEnvValue(["UNICOM_HALL_UA", "unicom_hall_ua"]);
  var raw = fromArg || envCookie;
  if (raw) {
    var list = splitSessionInput(raw);
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var ck = list[i];
      if (!ck) continue;
      out.push({
        mobile: detectAccountId(ck),
        cookie: ck,
        ua: envUa || $.getdata(STORAGE_UA_KEY) || DEFAULT_UA,
        updatedAt: Date.now(),
        source: "input",
        onLineBody: "",
        tokenOnline: "",
      });
    }
    return out;
  }
  return readSessionList();
}

function readSessionList() {
  var raw = $.getdata(STORAGE_SESSION_KEY) || "";
  if (!raw) return [];
  var arr = safeJsonParse(raw, []);
  if (!Array.isArray(arr)) return [];
  var out = [];
  for (var i = 0; i < arr.length; i++) {
    var item = arr[i];
    if (!item || typeof item.cookie !== "string" || !item.cookie.trim()) continue;
    out.push({
      mobile: item.mobile || detectAccountId(item.cookie),
      cookie: item.cookie.trim(),
      ua: item.ua || $.getdata(STORAGE_UA_KEY) || DEFAULT_UA,
      updatedAt: item.updatedAt || 0,
      source: "store",
      onLineBody: item.onLineBody || "",
      tokenOnline: item.tokenOnline || "",
    });
  }
  return out;
}

function saveSessionList(list) {
  $.setdata(JSON.stringify(list), STORAGE_SESSION_KEY);
}

function persistSessionUpdate(session) {
  if (!session || session.source !== "store") return;
  var list = readSessionList();
  var idx = findSessionIndex(list, session.mobile, session.cookie);
  if (idx < 0 && session.mobile) {
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].mobile || "") === String(session.mobile)) {
        idx = i;
        break;
      }
    }
  }
  if (idx < 0) return;
  list[idx] = {
    mobile: session.mobile || list[idx].mobile || detectAccountId(session.cookie),
    cookie: session.cookie || list[idx].cookie,
    ua: session.ua || list[idx].ua || DEFAULT_UA,
    updatedAt: Date.now(),
    onLineBody: session.onLineBody || list[idx].onLineBody || "",
    tokenOnline: session.tokenOnline || list[idx].tokenOnline || "",
  };
  saveSessionList(list);
}

function findSessionIndex(list, mobile, cookie) {
  var i;
  if (mobile) {
    for (i = 0; i < list.length; i++) {
      if (String(list[i].mobile || "") === String(mobile)) return i;
    }
  }
  for (i = 0; i < list.length; i++) {
    if (list[i].cookie === cookie) return i;
  }
  return -1;
}

function detectAccountId(cookie) {
  return (
    getCookieVal(cookie, "c_mobile") ||
    getCookieVal(cookie, "u_account") ||
    getCookieVal(cookie, "TOKEN_UID") ||
    ""
  );
}

function getCookieVal(cookie, key) {
  if (!cookie || !key) return "";
  var reg = new RegExp("(^|;\\s*)" + escapeRegExp(key) + "=([^;]*)");
  var m = cookie.match(reg);
  return m ? m[2] : "";
}

function splitSessionInput(raw) {
  var text = String(raw || "").trim();
  if (!text) return [];
  var arr;
  if (text.indexOf("\n") >= 0) {
    arr = text.split(/\n+/);
  } else if (text.indexOf("&&") >= 0) {
    arr = text.split("&&");
  } else if (text.indexOf("@@") >= 0) {
    arr = text.split("@@");
  } else {
    arr = [text];
  }
  var out = [];
  for (var i = 0; i < arr.length; i++) {
    var s = String(arr[i] || "").trim();
    if (s) out.push(s);
  }
  return out;
}

function buildResult(input) {
  return {
    account: input.account || "",
    decision_path: input.decision_path || "",
    action_taken: !!input.action_taken,
    result_category: input.result_category || "",
    key_fields: input.key_fields || {},
    next_step: input.next_step || "",
    summary_line: input.summary_line || "",
  };
}

function normalizeMode(s) {
  var t = String(s || "").toLowerCase().trim();
  if (t === "query_only" || t === "dry_run" || t === "query") return "query_only";
  return "execute";
}

function parseArg(str) {
  var out = {};
  var raw = String(str || "").trim();
  if (!raw) return out;
  var parts = raw.split("&");
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    var idx = p.indexOf("=");
    if (idx <= 0) continue;
    var k = p.slice(0, idx).trim();
    var v = p.slice(idx + 1).trim();
    if (!k) continue;
    out[k] = decodeTry(v);
  }
  return out;
}

function getRuntimeArgument() {
  if (typeof $argument !== "undefined") return $argument;
  if (isNodeRuntime()) return process.argv.slice(2).join("&");
  return "";
}

function getNodeEnvValue(keys) {
  if (!isNodeRuntime() || !process || !process.env) return "";
  for (var i = 0; i < keys.length; i++) {
    var v = process.env[keys[i]];
    if (v) return String(v).trim();
  }
  return "";
}

function isNodeRuntime() {
  return typeof module !== "undefined" && !!module.exports;
}

function getHeader(headers, name) {
  if (!headers || !name) return "";
  var lower = String(name).toLowerCase();
  var keys = Object.keys(headers);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (String(k).toLowerCase() === lower) return headers[k];
  }
  return "";
}

function decodeTry(s) {
  try {
    return decodeURIComponent(s);
  } catch (e) {
    return s;
  }
}

function parseFormBody(raw) {
  var out = {};
  var text = String(raw || "").trim();
  if (!text) return out;
  var pairs = text.split("&");
  for (var i = 0; i < pairs.length; i++) {
    if (!pairs[i]) continue;
    var idx = pairs[i].indexOf("=");
    var k = idx >= 0 ? pairs[i].slice(0, idx) : pairs[i];
    var v = idx >= 0 ? pairs[i].slice(idx + 1) : "";
    var key = decodeTry(k.replace(/\+/g, "%20"));
    var val = decodeTry(v.replace(/\+/g, "%20"));
    if (key) out[key] = val;
  }
  return out;
}

function toFormBody(obj) {
  var keys = Object.keys(obj || {});
  var out = [];
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    out.push(
      encodeURIComponent(k) +
        "=" +
        encodeURIComponent(obj[k] == null ? "" : String(obj[k]))
    );
  }
  return out.join("&");
}

function pickSetCookieValues(headers) {
  if (!headers || typeof headers !== "object") return [];
  var found = [];
  var keys = Object.keys(headers);
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i]).toLowerCase() !== "set-cookie") continue;
    var val = headers[keys[i]];
    if (Array.isArray(val)) {
      for (var j = 0; j < val.length; j++) {
        if (val[j]) found.push(String(val[j]));
      }
    } else if (typeof val === "string") {
      var split = splitSetCookieHeader(val);
      for (var k = 0; k < split.length; k++) {
        if (split[k]) found.push(split[k]);
      }
    }
  }
  return found;
}

function splitSetCookieHeader(s) {
  var text = String(s || "");
  if (!text) return [];
  if (text.indexOf(",") < 0) return [text];
  var out = [];
  var cur = "";
  var inExpires = false;
  for (var i = 0; i < text.length; i++) {
    var ch = text.charAt(i);
    if (!inExpires && text.slice(i, i + 8).toLowerCase() === "expires=") {
      inExpires = true;
    }
    if (ch === "," && !inExpires) {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
      continue;
    }
    if (inExpires && ch === ";") inExpires = false;
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function mergeCookieString(oldCookie, setCookies) {
  var map = cookieStringToMap(oldCookie);
  var arr = setCookies || [];
  for (var i = 0; i < arr.length; i++) {
    var first = String(arr[i] || "").split(";")[0];
    var idx = first.indexOf("=");
    if (idx <= 0) continue;
    var k = first.slice(0, idx).trim();
    var v = first.slice(idx + 1).trim();
    if (!k) continue;
    if (!v) delete map[k];
    else map[k] = v;
  }
  return cookieMapToString(map);
}

function cookieStringToMap(cookie) {
  var out = {};
  var arr = String(cookie || "").split(";");
  for (var i = 0; i < arr.length; i++) {
    var p = arr[i].trim();
    if (!p) continue;
    var idx = p.indexOf("=");
    if (idx <= 0) continue;
    var k = p.slice(0, idx).trim();
    var v = p.slice(idx + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

function cookieMapToString(map) {
  var keys = Object.keys(map || {});
  var out = [];
  for (var i = 0; i < keys.length; i++) {
    out.push(keys[i] + "=" + String(map[keys[i]]));
  }
  return out.join("; ");
}

function formatOnlineReqTime(d) {
  return (
    d.getFullYear() +
    "-" +
    pad2(d.getMonth() + 1) +
    "-" +
    pad2(d.getDate()) +
    " " +
    pad2(d.getHours()) +
    ":" +
    pad2(d.getMinutes()) +
    ":" +
    pad2(d.getSeconds())
  );
}

function safeJsonParse(text, fallback) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return fallback;
  }
}

function maskMobile(v) {
  var s = String(v || "");
  if (/^\d{11}$/.test(s)) return s.slice(0, 3) + "****" + s.slice(7);
  if (s.length > 8) return s.slice(0, 2) + "****" + s.slice(-2);
  return s || "未知账号";
}

function ts() {
  var d = new Date();
  return (
    "[" +
    d.getFullYear() +
    "-" +
    pad2(d.getMonth() + 1) +
    "-" +
    pad2(d.getDate()) +
    " " +
    pad2(d.getHours()) +
    ":" +
    pad2(d.getMinutes()) +
    ":" +
    pad2(d.getSeconds()) +
    "]"
  );
}

function pad2(n) {
  return n < 10 ? "0" + n : String(n);
}

function stringifyError(err) {
  if (!err) return "unknown_error";
  if (typeof err === "string") return err;
  return err.message || JSON.stringify(err);
}

function purgeInvalidStoredSessions(invalidCookieMap) {
  var keys = Object.keys(invalidCookieMap || {});
  if (!keys.length) return 0;
  var list = readSessionList();
  if (!list.length) return 0;
  var remain = [];
  var removed = 0;
  for (var i = 0; i < list.length; i++) {
    if (invalidCookieMap[list[i].cookie]) {
      removed += 1;
      continue;
    }
    remain.push(list[i]);
  }
  if (removed > 0) saveSessionList(remain);
  return removed;
}

function pickApiMessage(obj) {
  if (!obj || typeof obj !== "object") return "";
  var data = obj.data || {};
  return String(
    obj.msg ||
      obj.desc ||
      data.msg ||
      data.desc ||
      data.statusDesc ||
      ""
  );
}

function isAuthExpiredCodeOrMsg(code, msg) {
  var c = String(code || "").toLowerCase();
  var m = String(msg || "").toLowerCase();
  if (c === "401" || c === "403") return true;
  if (/未登录|请先登录|登录失效|登录过期|token|expired|cookie|session|鉴权|认证|失效/.test(m)) return true;
  return false;
}

function buildUnicomOpenOption() {
  if (!($.isQX() || $.isSurge() || $.isLoon())) return null;
  return {
    "open-url": UNICOM_APP_SCHEME,
    url: UNICOM_APP_SCHEME,
  };
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Env(name) {
  this.name = name;
  this.data = null;
  this.dataFile = "box.dat";
}

Env.prototype.isNode = function () {
  return typeof module !== "undefined" && !!module.exports;
};

Env.prototype.isQX = function () {
  return typeof $task !== "undefined";
};

Env.prototype.isSurge = function () {
  return typeof $httpClient !== "undefined" && typeof $loon === "undefined";
};

Env.prototype.isLoon = function () {
  return typeof $loon !== "undefined";
};

Env.prototype.log = function (msg) {
  console.log(msg);
};

Env.prototype.msg = function (title, subtitle, desc, opts) {
  var option = this._convertNotifyOption(opts);
  if (this.isQX()) {
    $notify(title, subtitle || "", desc || "", option);
  } else if (this.isSurge() || this.isLoon()) {
    $notification.post(title, subtitle || "", desc || "", option);
  } else {
    console.log(title + " | " + (subtitle || "") + " | " + (desc || ""));
  }
};

Env.prototype._convertNotifyOption = function (opts) {
  if (!opts || typeof opts !== "object") return undefined;
  var openUrl = opts["open-url"] || opts.openUrl || opts.url || "";
  if (!openUrl) return undefined;
  if (this.isQX()) return { "open-url": openUrl };
  if (this.isSurge() || this.isLoon()) return { url: openUrl };
  return undefined;
};

Env.prototype.done = function (value) {
  if (this.isQX() || this.isSurge() || this.isLoon()) $done(value || {});
};

Env.prototype.getdata = function (key) {
  if (this.isQX()) return $prefs.valueForKey(key);
  if (this.isSurge() || this.isLoon()) return $persistentStore.read(key);
  if (this.isNode()) {
    this.data = this._loadData();
    return this.data[key] || "";
  }
  return "";
};

Env.prototype.setdata = function (val, key) {
  if (this.isQX()) return $prefs.setValueForKey(String(val), key);
  if (this.isSurge() || this.isLoon()) return $persistentStore.write(String(val), key);
  if (this.isNode()) {
    this.data = this._loadData();
    this.data[key] = String(val);
    this._saveData();
    return true;
  }
  return false;
};

Env.prototype.wait = function (ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
};

Env.prototype._loadData = function () {
  if (!this.isNode()) return {};
  var fs = require("fs");
  var path = require("path");
  var p1 = path.resolve(this.dataFile);
  var p2 = path.resolve(process.cwd(), this.dataFile);
  var target = fs.existsSync(p1) ? p1 : fs.existsSync(p2) ? p2 : p1;
  try {
    if (!fs.existsSync(target)) return {};
    var txt = fs.readFileSync(target, "utf8");
    return safeJsonParse(txt, {});
  } catch (e) {
    return {};
  }
};

Env.prototype._saveData = function () {
  if (!this.isNode()) return;
  var fs = require("fs");
  var path = require("path");
  var p = path.resolve(this.dataFile);
  fs.writeFileSync(p, JSON.stringify(this.data || {}), "utf8");
};

Env.prototype.request = function (opts) {
  var self = this;
  var method = String(opts.method || "GET").toUpperCase();
  var req = {
    url: opts.url,
    method: method,
    headers: opts.headers || {},
    body: opts.body || "",
  };

  return new Promise(function (resolve, reject) {
    if (self.isQX()) {
      $task
        .fetch(req)
        .then(function (resp) {
          resolve({
            statusCode: resp.statusCode || resp.status || 0,
            headers: resp.headers || {},
            body: resp.body || "",
          });
        })
        .catch(reject);
      return;
    }

    if (self.isSurge() || self.isLoon()) {
      var fn = method === "POST" ? "post" : "get";
      var reqObj = {
        url: req.url,
        headers: req.headers,
        body: method === "POST" ? req.body : undefined,
      };
      $httpClient[fn](reqObj, function (err, resp, body) {
        if (err) {
          reject(err);
          return;
        }
        resolve({
          statusCode: (resp && (resp.status || resp.statusCode)) || 0,
          headers: (resp && resp.headers) || {},
          body: body || "",
        });
      });
      return;
    }

    if (self.isNode()) {
      (async function () {
        try {
          if (typeof fetch === "undefined") {
            throw new Error("Node 环境缺少 fetch，请使用 Node 18+");
          }
          var ac = new AbortController();
          var timeoutMs = Number(opts.timeout || 15000);
          var timer = setTimeout(function () {
            ac.abort();
          }, timeoutMs);
          var res = await fetch(req.url, {
            method: method,
            headers: req.headers,
            body: method === "POST" ? req.body : undefined,
            signal: ac.signal,
          });
          clearTimeout(timer);
          var text = await res.text();
          var h = {};
          res.headers.forEach(function (v, k) {
            h[k] = v;
          });
          resolve({ statusCode: res.status, headers: h, body: text });
        } catch (e) {
          reject(e);
        }
      })();
      return;
    }

    reject(new Error("unsupported_runtime"));
  });
};

!(async function () {
  if (typeof $request !== "undefined") {
    await captureSession();
    return;
  }
  await runTask();
})()
  .catch(function (err) {
    $.log(ts() + " [ERROR] " + stringifyError(err));
    $.msg(SCRIPT_NAME, "运行异常", stringifyError(err));
  })
  .finally(function () {
    $.done();
  });

