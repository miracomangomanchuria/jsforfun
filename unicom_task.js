/*
unicom_task（QX / Surge / Loon / Node）

[rewrite_local]
^https:\/\/loginxhm\.10010\.com\/mobileService\/.* url script-request-header unicom_task.js
^https:\/\/loginxhm\.10010\.com\/mobileService\/.* url script-request-body unicom_task.js

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
   - 不需要找特定活动页，首页或“我的”页都可以触发抓包。
   - 建议在首页和“我的”之间切一次，并在“我的”页下拉刷新。
   - 抓到任意 loginxhm/mobileService 请求即可保存 Cookie；抓到 onLine 请求会同时保存 token_online 链路。
   - 回到 QX 运行定时脚本即可。
*/

var SCRIPT_NAME = "联通营业厅签到";
var SCRIPT_VERSION = "v1.5.1";
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
  taskList: BASE_URL + "/task/taskList?type=",
  completeTask: BASE_URL + "/task/completeTask",
  getTaskReward: BASE_URL + "/task/getTaskReward",
  onlineRefresh: "https://loginxhm.10010.com/mobileService/onLine.htm",
};
var TASK_TYPES = ["0", "1", "2", "3"];
var SEP = "==========";
var SUB_SEP = "----------";
var CAPTURE_GUIDE_TEXT =
  "联通App保持登录 -> 首页/我的切换并下拉刷新 -> 抓到loginxhm/mobileService请求 -> 再跑脚本";
var CAPTURE_CONFIG_TEXT = String.raw`[rewrite_local]
^https:\/\/loginxhm\.10010\.com\/mobileService\/.* url script-request-header unicom_task.js
^https:\/\/loginxhm\.10010\.com\/mobileService\/.* url script-request-body unicom_task.js
[mitm]
hostname = loginxhm.10010.com`;

var $ = new Env(SCRIPT_NAME);
var args = parseArg(getRuntimeArgument());
var mode = normalizeMode(args.mode || args.run_mode || "");
var debug = String(args.debug || "0") === "1";
var resultRows = [];

async function captureSession() {
  var url = ($request && $request.url) || "";
  var isMobileService = /loginxhm\.10010\.com\/mobileService\//.test(url);
  var isOnline = /loginxhm\.10010\.com\/mobileService\/onLine\.htm/.test(url);
  if (!isMobileService) return;

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
  var onlineParsed = parseFormBody(reqBody);
  var capturedTokenOnline = onlineParsed.token_online || "";
  var newOnlineTemplate =
    isOnline &&
    !!capturedTokenOnline &&
    (!existing ||
      !existing.onLineBody ||
      String(existing.tokenOnline || "") !== String(capturedTokenOnline));
  var changed = !existing || existing.cookie !== cookie || existing.ua !== ua || newOnlineTemplate;

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
      " | onLineTpl=" +
      (row.onLineBody ? "y" : "n") +
      " | todayIsSignIn=" +
      (probeState.todaySigned ? "y" : "n")
  );
  $.msg(
    SCRIPT_NAME,
    "抓包成功",
    "账号: " + accountText + " | 已保存会话" + (row.onLineBody ? " | 已捕获onLine模板" : "")
  );
}

async function runTask() {
  var sessions = loadSessionsForRun();
  if (!sessions.length) {
    $.log(ts() + " [INIT] 未检测到会话，输出抓包配置");
    $.log(CAPTURE_CONFIG_TEXT);
    $.msg(SCRIPT_NAME, "未获取到 Cookie", CAPTURE_GUIDE_TEXT, buildUnicomOpenOption());
    return;
  }

  $.log(SEP);
  $.log(ts() + " [INIT] " + SCRIPT_NAME + " " + SCRIPT_VERSION + " | 模式=" + mode + " | 账号数=" + sessions.length);
  $.log(ts() + " [QUEUE] 账号队列: " + formatAccountQueue(sessions));
  $.log(SEP);
  var invalidStoreCookies = {};

  for (var i = 0; i < sessions.length; i++) {
    var row;
    try {
      row = await runOneAccount(sessions[i], i + 1, sessions.length);
    } catch (err) {
      row = buildResult({
        account: sessions[i].mobile ? maskMobile(sessions[i].mobile) : "账号" + (i + 1),
        decision_path: "runtime_exception",
        action_taken: false,
        result_category: "network_error",
        key_fields: { reason: stringifyError(err) },
        next_step: "请查看日志后重试",
        summary_line:
          (sessions[i].mobile ? maskMobile(sessions[i].mobile) : "账号" + (i + 1)) +
          " | 运行异常(" +
          stringifyError(err) +
          ")",
        count_as: "fail",
      });
      $.log(ts() + " [A" + (i + 1) + "] EXCEPTION " + stringifyError(err));
    }
    resultRows.push(row);
    $.log(ts() + " [A" + (i + 1) + "/" + sessions.length + "] 完成: " + row.summary_line);
    if (row.result_category === "auth_expired" && sessions[i].source === "store") {
      invalidStoreCookies[sessions[i].cookie] = 1;
    }
    if (i < sessions.length - 1) await $.wait(500);
  }

  var stat = { success: 0, skip: 0, fail: 0 };
  var lines = [];

  for (var j = 0; j < resultRows.length; j++) {
    var r = resultRows[j];
    stat[normalizeCountBucket(r.count_as, r.result_category)] += 1;
    lines.push(r.summary_line);
  }

  var subtitle =
    "模式=" +
    mode +
    " | 成功:" +
    stat.success +
    " | 跳过:" +
    stat.skip +
    " | 失败:" +
    stat.fail;

  var removedCount = purgeInvalidStoredSessions(invalidStoreCookies);
  if (removedCount > 0) {
    subtitle += " | 清理失效Cookie:" + removedCount;
    $.log(ts() + " [CLEANUP] 已自动删除失效账号 " + removedCount + " 个");
  }

  var hasAuthExpired = resultRows.some(function (x) {
    return x && x.result_category === "auth_expired";
  });
  $.log(SEP);
  $.log(ts() + " [DONE] " + subtitle);
  $.log(SEP);
  $.msg(SCRIPT_NAME, subtitle, lines.join("\n"), hasAuthExpired ? buildUnicomOpenOption() : null);

  if (debug) {
    $.log(ts() + " [RESULT] " + JSON.stringify(resultRows));
  }
}

async function runOneAccount(session, index, total) {
  var account = session.mobile ? maskMobile(session.mobile) : "账号" + index;
  $.log(SUB_SEP);
  $.log(ts() + " [A" + index + "/" + total + "] " + account + " | 来源=" + formatSourceName(session.source));

  var state = await queryState(session, false);
  if (!state.ok && state.category === "auth_expired") {
    $.log(ts() + " [A" + index + "] 鉴权失效，尝试 onLine 刷新");
    var refreshed = await refreshAuthByOnline(session);
    if (refreshed.ok) {
      $.log(ts() + " [A" + index + "] onLine 刷新成功，重查状态");
      state = await queryState(session, false);
    } else {
      $.log(ts() + " [A" + index + "] onLine 刷新失败: " + (refreshed.reason || "unknown"));
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
        account + " | 状态失败(" + (state.reason || "unknown") + ")" + (autoRemoved ? " | 已自动移除" : ""),
      count_as: "fail",
    });
    $.log(ts() + " [A" + index + "] 结束: " + (state.category || "state_undecidable"));
    return failRow;
  }

  $.log(
    ts() +
      " [A" +
      index +
      "] 状态: todayIsSignIn=" +
      (state.todaySigned ? "y" : "n") +
      " 连签=" +
      state.continueCount
  );

  var signInfo = {
    category: "",
    decision: "",
    text: "",
    actionTaken: false,
    failed: false,
    key: {
      todayIsSignIn: state.todaySigned ? "y" : "n",
      continueCount: state.continueCount || "",
    },
  };

  if (mode === "query_only") {
    signInfo.category = "query_only";
    signInfo.decision = state.todaySigned ? "query_state(y)->query_only" : "query_state(n)->query_only";
    signInfo.text = state.todaySigned ? "签到:已签(仅查询)" : "签到:未签(仅查询)";
  } else if (state.todaySigned) {
    var integralDone = await queryIntegral(session);
    signInfo.category = "already_done";
    signInfo.decision = "query_state(y)->skip_sign";
    signInfo.text = "签到:已签" + (integralDone.ok ? " 积分:" + integralDone.integralTotal : "");
    signInfo.key.integralTotal = integralDone.ok ? integralDone.integralTotal : "";
  } else {
    signInfo.actionTaken = true;
    var sign = await executeSign(session);
    $.log(
      ts() +
        " [A" +
        index +
        "] 签到执行: code=" +
        sign.code +
        " status=" +
        sign.status +
        " desc=" +
        (sign.desc || "-")
    );

    if (!sign.ok) {
      if (sign.category === "auth_expired") {
        var signAutoRemoved = session.source === "store";
        return buildResult({
          account: account,
          decision_path: "query_state(n)->execute_sign_failed(auth)",
          action_taken: true,
          result_category: "auth_expired",
          key_fields: {
            code: sign.code,
            status: sign.status,
            desc: sign.desc,
          },
          next_step: signAutoRemoved ? "该账号 Cookie 已自动移除，请重新抓包" : "请重新抓包更新 Cookie 后重试",
          summary_line:
            account + " | 签到失败(" + (sign.desc || sign.code || "unknown") + ")" + (signAutoRemoved ? " | 已自动移除" : ""),
          count_as: "fail",
        });
      }
      signInfo.failed = true;
      signInfo.category = sign.category || "action_rejected";
      signInfo.decision = "query_state(n)->execute_sign_failed";
      signInfo.text = "签到失败(" + (sign.desc || sign.code || "unknown") + ")";
      signInfo.key.sign_desc = sign.desc || "";
    } else {
      var verify = await queryState(session, false);
      if (!verify.ok || !verify.todaySigned) {
        signInfo.failed = true;
        signInfo.category = "state_undecidable";
        signInfo.decision = "query_state(n)->execute_sign->verify_failed";
        signInfo.text = "签到后校验未通过";
        signInfo.key.verify_ok = verify.ok ? "1" : "0";
        signInfo.key.verify_todayIsSignIn = verify.ok ? (verify.todaySigned ? "y" : "n") : "";
      } else {
        var integral = await queryIntegral(session);
        signInfo.category = "sign_success";
        signInfo.decision = "query_state(n)->execute_sign->verify_state(y)";
        signInfo.text =
          "签到成功" +
          (sign.reward ? " " + sign.reward : "") +
          (integral.ok ? " 积分:" + integral.integralTotal : "");
        signInfo.key.sign_desc = sign.desc || "";
        signInfo.key.reward = sign.reward || "";
        signInfo.key.continueCount = verify.continueCount || state.continueCount || "";
        signInfo.key.integralTotal = integral.ok ? integral.integralTotal : "";
      }
    }
  }

  var taskInfo = await processTasks(session, mode);
  if (!taskInfo.ok) {
    var taskAutoRemoved = taskInfo.category === "auth_expired" && session.source === "store";
    return buildResult({
      account: account,
      decision_path: signInfo.decision + "->task_query_failed",
      action_taken: !!signInfo.actionTaken,
      result_category: taskInfo.category || "network_error",
      key_fields: {
        sign: signInfo.text,
        task_reason: taskInfo.reason || "unknown",
      },
      next_step: taskAutoRemoved ? "该账号 Cookie 已自动移除，请重新抓包" : "建议稍后重试；若持续失败请重新抓包",
      summary_line:
        account +
        " | " +
        (signInfo.text || "签到:未知") +
        " | 任务失败(" +
        (taskInfo.reason || "unknown") +
        ")" +
        (taskAutoRemoved ? " | 已自动移除" : ""),
      count_as: "fail",
    });
  }

  $.log(
    ts() +
      " [A" +
      index +
      "] 任务统计: 总=" +
      taskInfo.total +
      " 可做=" +
      taskInfo.canDo +
      " 领奖=" +
      taskInfo.claimed +
      " 完成=" +
      taskInfo.completed +
      " 跳过=" +
      taskInfo.skipped +
      " 失败=" +
      taskInfo.failed
  );

  var finalCategory = signInfo.category;
  var finalCount = "success";
  var nextStep = "none";
  if (mode === "query_only") {
    finalCategory = "query_only";
    finalCount = "skip";
    nextStep = "切换 mode=execute 才会执行签到与任务";
  } else if (signInfo.failed) {
    finalCategory = signInfo.category || "action_rejected";
    finalCount = "fail";
    nextStep = "签到失败，建议稍后重试";
  } else if (signInfo.category === "already_done") {
    finalCategory = "already_done";
    finalCount = "skip";
  } else if (signInfo.category === "sign_success") {
    finalCategory = "sign_success";
    finalCount = "success";
  } else {
    finalCategory = signInfo.category || "query_only";
    finalCount = finalCategory === "query_only" ? "skip" : "success";
  }

  if (taskInfo.failed > 0) {
    finalCategory = finalCategory === "query_only" ? "query_only" : "task_partial";
    finalCount = "fail";
    nextStep = "部分任务执行失败，可稍后重试";
  }

  var finalLine = account + " | " + (signInfo.text || "签到:未知") + " | " + taskInfo.summaryShort;
  return buildResult({
    account: account,
    decision_path: signInfo.decision + "->task(" + taskInfo.decision + ")",
    action_taken: !!signInfo.actionTaken || taskInfo.actionTaken,
    result_category: finalCategory,
    key_fields: mergeObjects(signInfo.key, taskInfo.keyFields),
    next_step: nextStep,
    summary_line: finalLine,
    count_as: finalCount,
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

async function processTasks(session, runMode) {
  var map = {};
  var queryErrors = [];
  var totalFetched = 0;
  var queryTypes = [];

  for (var i = 0; i < TASK_TYPES.length; i++) {
    var type = TASK_TYPES[i];
    var q = await queryTaskListByType(session, type);
    if (!q.ok) {
      if (q.category === "auth_expired") {
        return {
          ok: false,
          category: "auth_expired",
          reason: "taskList_type" + type + "_" + (q.reason || "auth_expired"),
        };
      }
      queryErrors.push("type" + type + ":" + (q.reason || q.category || "unknown"));
      continue;
    }
    queryTypes.push(type);
    totalFetched += q.tasks.length;
    for (var j = 0; j < q.tasks.length; j++) {
      var t = q.tasks[j];
      if (!t.id) continue;
      if (!map[t.id] || taskDecisionPriority(t) > taskDecisionPriority(map[t.id])) {
        map[t.id] = t;
      }
    }
  }

  var ids = Object.keys(map);
  if (!queryTypes.length) {
    return {
      ok: false,
      category: "network_error",
      reason: queryErrors.length ? queryErrors.join("|") : "task_list_all_failed",
    };
  }
  var tasks = [];
  for (var k = 0; k < ids.length; k++) tasks.push(map[ids[k]]);
  tasks.sort(function (a, b) {
    var pa = taskDecisionPriority(a);
    var pb = taskDecisionPriority(b);
    if (pa !== pb) return pb - pa;
    return String(a.taskName || "").localeCompare(String(b.taskName || ""));
  });

  var stat = {
    total: tasks.length,
    totalFetched: totalFetched,
    canDo: 0,
    completed: 0,
    claimed: 0,
    skipped: 0,
    failed: 0,
    rewardReady: 0,
    claimReady: 0,
    tryReady: 0,
  };
  var actionTaken = false;
  var debugRows = [];

  for (var n = 0; n < tasks.length; n++) {
    var task = tasks[n];
    var action = decideTaskAction(task);
    if (action !== "skip") stat.canDo += 1;
    if (action === "reward_only") stat.rewardReady += 1;
    if (action === "complete_and_reward") stat.claimReady += 1;
    if (action === "try_complete_reward") stat.tryReady += 1;

    if (runMode === "query_only") continue;
    if (action === "skip") {
      stat.skipped += 1;
      continue;
    }

    actionTaken = true;
    if (action === "reward_only") {
      var rewardOnly = await getTaskRewardWithRetry(session, task.id, 2);
      if (!rewardOnly.ok) {
        if (rewardOnly.category === "auth_expired") {
          return {
            ok: false,
            category: "auth_expired",
            reason: "taskReward_" + task.id + "_" + (rewardOnly.reason || "auth_expired"),
          };
        }
        stat.failed += 1;
        debugRows.push("reward_fail:" + shortTaskName(task.taskName) + ":" + (rewardOnly.reason || rewardOnly.desc || "unknown"));
      } else {
        stat.claimed += 1;
      }
      continue;
    }

    var complete = await completeTaskById(session, task.id);
    if (!complete.ok) {
      if (complete.category === "auth_expired") {
        return {
          ok: false,
          category: "auth_expired",
          reason: "taskComplete_" + task.id + "_" + (complete.reason || "auth_expired"),
        };
      }
      if (action === "try_complete_reward") {
        stat.skipped += 1;
        debugRows.push("try_complete_skip:" + shortTaskName(task.taskName) + ":" + (complete.reason || complete.desc || "unknown"));
      } else {
        debugRows.push("complete_fail:" + shortTaskName(task.taskName) + ":" + (complete.reason || complete.desc || "unknown"));
      }
    } else {
      stat.completed += 1;
    }

    var reward = await getTaskRewardWithRetry(session, task.id, 2);
    if (!reward.ok) {
      if (reward.category === "auth_expired") {
        return {
          ok: false,
          category: "auth_expired",
          reason: "taskReward_" + task.id + "_" + (reward.reason || "auth_expired"),
        };
      }
      if (action === "try_complete_reward" && isExpectedTaskNotReady(reward.desc || reward.reason || "")) {
        stat.skipped += 1;
        debugRows.push("try_reward_skip:" + shortTaskName(task.taskName) + ":" + (reward.reason || reward.desc || "unknown"));
      } else {
        stat.failed += 1;
        debugRows.push("reward_fail:" + shortTaskName(task.taskName) + ":" + (reward.reason || reward.desc || "unknown"));
      }
    } else {
      stat.claimed += 1;
    }
    await $.wait(180);
  }

  if (runMode === "query_only") {
    stat.skipped = tasks.length - stat.canDo;
  }

  var summaryShort =
    runMode === "query_only"
      ? "任务:可做" + stat.canDo + "/" + stat.total + " (仅查询)"
      : "任务:领" + stat.claimed + " 完" + stat.completed + " 尝" + stat.tryReady + " 跳" + stat.skipped + " 失" + stat.failed;

  var decision = "query_types(" + queryTypes.join(",") + ")";
  if (queryErrors.length) decision += "_partial";

  var keyFields = {
    task_total: String(stat.total),
    task_can_do: String(stat.canDo),
    task_claimed: String(stat.claimed),
    task_completed: String(stat.completed),
    task_skipped: String(stat.skipped),
    task_failed: String(stat.failed),
  };
  if (queryErrors.length) keyFields.task_query_warn = queryErrors.join("|");

  if (debug && debugRows.length) {
    $.log(ts() + " [TASK_DEBUG] " + debugRows.slice(0, 10).join(" | "));
  }

  return {
    ok: true,
    decision: decision,
    summaryShort: summaryShort,
    actionTaken: actionTaken,
    keyFields: keyFields,
    total: stat.total,
    canDo: stat.canDo,
    claimed: stat.claimed,
    completed: stat.completed,
    skipped: stat.skipped,
    failed: stat.failed,
  };
}

async function queryTaskListByType(session, type) {
  var resp = await requestJson("GET", API.taskList + encodeURIComponent(type), buildHeaders(session, false, false), "");
  if (!resp.ok) {
    if (resp.statusCode === 401 || resp.statusCode === 403) {
      return { ok: false, category: "auth_expired", reason: "http_" + resp.statusCode };
    }
    return { ok: false, category: "network_error", reason: resp.reason || "network_error" };
  }

  var obj = resp.json || {};
  if (String(obj.code || "") !== "0000") {
    var msg = pickApiMessage(obj);
    if (isAuthExpiredCodeOrMsg(obj.code, msg)) {
      return { ok: false, category: "auth_expired", reason: "auth_" + String(obj.code || "") + "_" + msg };
    }
    return { ok: false, category: "action_rejected", reason: "bad_code_" + String(obj.code || "") };
  }

  var tasks = extractTasksFromData(obj.data, String(type || ""));
  return { ok: true, tasks: tasks };
}

function extractTasksFromData(data, type) {
  var out = [];
  var i;
  if (!data || typeof data !== "object") return out;

  if (Array.isArray(data.taskList)) {
    for (i = 0; i < data.taskList.length; i++) {
      var t0 = normalizeTaskItem(data.taskList[i], type);
      if (t0.id) out.push(t0);
    }
  }
  if (Array.isArray(data.tagList)) {
    for (i = 0; i < data.tagList.length; i++) {
      var tag = data.tagList[i] || {};
      var tagName = String(tag.tagName || "");
      if (!Array.isArray(tag.taskDTOList)) continue;
      for (var j = 0; j < tag.taskDTOList.length; j++) {
        var t1 = normalizeTaskItem(tag.taskDTOList[j], type);
        if (!t1.id) continue;
        if (tagName) t1.tagName = tagName;
        out.push(t1);
      }
    }
  }
  return out;
}

function normalizeTaskItem(item, type) {
  var it = item || {};
  return {
    id: String(it.id || it.taskId || ""),
    taskName: String(it.taskName || it.name || ""),
    taskState: String(it.taskState == null ? "" : it.taskState),
    buttonName: String(it.buttonName || ""),
    bubbleButtonName: String(it.bubbleButtonName || ""),
    showStyle: String(it.showStyle == null ? "" : it.showStyle),
    type: String(type || ""),
  };
}

function decideTaskAction(task) {
  if (!task || !task.id) return "skip";
  if (isTaskRewardReady(task)) return "reward_only";
  if (isTaskClaimReady(task)) return "complete_and_reward";
  if (isTaskTryCompleteReady(task)) return "try_complete_reward";
  return "skip";
}

function taskDecisionPriority(task) {
  var action = decideTaskAction(task);
  if (action === "reward_only") return 3;
  if (action === "complete_and_reward") return 2;
  return 1;
}

function isTaskRewardReady(task) {
  var state = String((task && task.taskState) || "");
  var button = String((task && task.buttonName) || "");
  var showStyle = String((task && task.showStyle) || "");
  return state === "3" || /已完成/.test(button) || showStyle === "3";
}

function isTaskClaimReady(task) {
  var state = String((task && task.taskState) || "");
  var button = String((task && task.buttonName) || "");
  var showStyle = String((task && task.showStyle) || "");
  return state === "0" || /去领取|领取/.test(button) || showStyle === "2";
}

function isTaskTryCompleteReady(task) {
  var state = String((task && task.taskState) || "");
  var button = String((task && task.buttonName) || "");
  var bubble = String((task && task.bubbleButtonName) || "");
  var showStyle = String((task && task.showStyle) || "");
  if (state === "1") return true;
  if (/^去/.test(button) || /立即抽奖/.test(button)) return true;
  if (/^去/.test(bubble) || /立即抽奖/.test(bubble)) return true;
  if (showStyle === "0") return true;
  return false;
}

function isExpectedTaskNotReady(text) {
  var t = String(text || "");
  return /任务失败|未完成|先去完成|请先完成|未达成|未达到|条件不满足|不满足/.test(t);
}

async function completeTaskById(session, taskId) {
  var url =
    API.completeTask +
    "?taskId=" +
    encodeURIComponent(taskId) +
    "&orderId=&systemCode=QDQD";
  var resp = await requestJson("GET", url, buildHeaders(session, false, false), "");
  if (!resp.ok) {
    if (resp.statusCode === 401 || resp.statusCode === 403) {
      return { ok: false, category: "auth_expired", reason: "http_" + resp.statusCode };
    }
    return { ok: false, category: "network_error", reason: resp.reason || "network_error" };
  }

  var obj = resp.json || {};
  var code = String(obj.code || "");
  var msg = pickApiMessage(obj);
  if (code === "0000") {
    return { ok: true, category: "ok", reason: "ok", desc: msg };
  }
  if (isAuthExpiredCodeOrMsg(code, msg)) {
    return { ok: false, category: "auth_expired", reason: "auth_" + code + "_" + msg, desc: msg };
  }
  if (/已完成|已领取|无需重复/.test(msg)) {
    return { ok: true, category: "ok", reason: "already", desc: msg };
  }
  return { ok: false, category: "action_rejected", reason: "bad_code_" + code, desc: msg };
}

async function getTaskRewardWithRetry(session, taskId, maxTry) {
  var tries = Math.max(1, Number(maxTry || 1));
  var last = null;
  for (var i = 0; i < tries; i++) {
    last = await getTaskRewardById(session, taskId);
    if (last.ok) return last;
    if (last.category === "auth_expired") return last;
    var busy = /火爆|稍后|繁忙|频繁/.test(String(last.desc || ""));
    if (!busy || i === tries - 1) return last;
    await $.wait(400 + i * 200);
  }
  return last || { ok: false, category: "action_rejected", reason: "unknown_reward_error", desc: "" };
}

async function getTaskRewardById(session, taskId) {
  var url = API.getTaskReward + "?taskId=" + encodeURIComponent(taskId);
  var resp = await requestJson("GET", url, buildHeaders(session, false, false), "");
  if (!resp.ok) {
    if (resp.statusCode === 401 || resp.statusCode === 403) {
      return { ok: false, category: "auth_expired", reason: "http_" + resp.statusCode, desc: "http_" + resp.statusCode };
    }
    return { ok: false, category: "network_error", reason: resp.reason || "network_error", desc: resp.reason || "" };
  }

  var obj = resp.json || {};
  var topCode = String(obj.code || "");
  var data = obj.data || {};
  var innerCode = String(data.code || "");
  var desc = String(data.desc || data.statusDesc || obj.desc || obj.msg || "");

  if (topCode !== "0000") {
    if (isAuthExpiredCodeOrMsg(topCode, desc || pickApiMessage(obj))) {
      return { ok: false, category: "auth_expired", reason: "auth_" + topCode, desc: desc };
    }
    return { ok: false, category: "action_rejected", reason: "bad_top_code_" + topCode, desc: desc };
  }

  if (!innerCode || innerCode === "0000") {
    return {
      ok: true,
      category: "ok",
      reason: "ok",
      desc: desc,
      reward: String(data.prizeNameRed || data.prizeName || data.prizeCount || ""),
    };
  }
  if (/已领取|已完成|已发放/.test(desc)) {
    return { ok: true, category: "ok", reason: "already", desc: desc };
  }
  if (isAuthExpiredCodeOrMsg(innerCode, desc)) {
    return { ok: false, category: "auth_expired", reason: "auth_" + innerCode, desc: desc };
  }
  return { ok: false, category: "action_rejected", reason: "bad_inner_code_" + innerCode, desc: desc };
}

function shortTaskName(name) {
  var s = String(name || "");
  if (!s) return "未知任务";
  if (s.length <= 12) return s;
  return s.slice(0, 12) + "...";
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
  if (!Array.isArray(arr)) {
    if (arr && typeof arr === "object" && arr.cookie) arr = [arr];
    else if (arr && typeof arr === "object" && Array.isArray(arr.sessions)) arr = arr.sessions;
    else return [];
  }
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
    count_as: input.count_as || "",
  };
}

function normalizeCountBucket(countAs, category) {
  var c = String(countAs || "").toLowerCase();
  if (c === "success" || c === "skip" || c === "fail") return c;
  if (category === "already_done" || category === "query_only") return "skip";
  if (category === "sign_success") return "success";
  return "fail";
}

function formatAccountQueue(sessions) {
  var out = [];
  for (var i = 0; i < sessions.length; i++) {
    var s = sessions[i] || {};
    var mobile = s.mobile || detectAccountId(s.cookie || "");
    out.push("A" + (i + 1) + ":" + (mobile ? maskMobile(mobile) : "未知账号"));
  }
  return out.join(" | ");
}

function formatSourceName(source) {
  var s = String(source || "");
  if (s === "store") return "本地存储";
  if (s === "input") return "传入参数";
  return s || "未知";
}

function mergeObjects(a, b) {
  var out = {};
  var x = a || {};
  var y = b || {};
  var k1 = Object.keys(x);
  for (var i = 0; i < k1.length; i++) out[k1[i]] = x[k1[i]];
  var k2 = Object.keys(y);
  for (var j = 0; j < k2.length; j++) out[k2[j]] = y[k2[j]];
  return out;
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

