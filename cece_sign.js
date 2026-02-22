/*
测测签到（QX / Surge / Loon / Node）

[rewrite_local]
^https:\/\/api\.cece\.com\/activity\/Activity\/getuserId(?:\?.*)?$            url script-request-header cece_sign.js
^https:\/\/api\.cece\.com\/user\/h5_register_task\/gift_list(?:\?.*)?$        url script-request-header cece_sign.js
^https:\/\/api\.cece\.com\/user\/h5_register_task\/get_gift(?:\?.*)?$         url script-request-body   cece_sign.js

[mitm]
hostname = api.cece.com

使用说明：
1) 先进入签到/新手任务页，触发一次请求，脚本会自动保存 Cookie 与 UA。
2) 再执行定时任务，脚本会先查状态，仅在“可领取”时才执行领取动作。
3) 可选参数：task_id=123（强制指定任务 id）。
*/

const $ = new Env("测测签到");

const SCRIPT_VERSION = "v0.2.0";
const SCRIPT_PREFIX = "cece_signin";

const CFG = {
  store: {
    cookieKey: SCRIPT_PREFIX + "_cookie_v1",
    uaKey: SCRIPT_PREFIX + "_ua_v1",
    originKey: SCRIPT_PREFIX + "_origin_v1",
    refererKey: SCRIPT_PREFIX + "_referer_v1",
    paramsKey: SCRIPT_PREFIX + "_params_v1",
    legacyCookieKey: "cece_cookie",
    legacyUaKey: "cece_ua",
  },
  api: {
    base: "https://api.cece.com",
    getUserId: "/activity/Activity/getuserId",
    giftList: "/user/h5_register_task/gift_list",
    getGift: "/user/h5_register_task/get_gift",
  },
  capture: {
    userPathRe: /^https:\/\/api\.cece\.com\/activity\/Activity\/getuserId(?:\?.*)?$/,
    listPathRe: /^https:\/\/api\.cece\.com\/user\/h5_register_task\/gift_list(?:\?.*)?$/,
    claimPathRe: /^https:\/\/api\.cece\.com\/user\/h5_register_task\/get_gift(?:\?.*)?$/,
  },
  defaults: {
    origin: "https://m.cece.com",
    referer: "https://m.cece.com/",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
    timeoutMs: 30000,
  },
  debug: false,
};

const CAPTURE_CONFIG_TEXT = String.raw`[rewrite_local]
^https:\/\/api\.cece\.com\/activity\/Activity\/getuserId(?:\?.*)?$            url script-request-header cece_sign.js
^https:\/\/api\.cece\.com\/user\/h5_register_task\/gift_list(?:\?.*)?$        url script-request-header cece_sign.js
^https:\/\/api\.cece\.com\/user\/h5_register_task\/get_gift(?:\?.*)?$         url script-request-body   cece_sign.js
[mitm]
hostname = api.cece.com`;

const summaries = [];
const runtimeArgs = parseArguments(typeof $argument === "string" ? $argument : "");
const runtime = {
  taskId: parseIntSafe(runtimeArgs.task_id || runtimeArgs.taskId, null),
  debug: toBool(runtimeArgs.debug, CFG.debug),
};

async function main() {
  migrateLegacyStore();
  log("==========");
  log("🚀 脚本启动 | 版本 " + SCRIPT_VERSION);
  log(
    "🧩 运行参数: task_id=" +
      (runtime.taskId === null ? "自动识别" : runtime.taskId) +
      " | debug=" +
      runtime.debug
  );

  if (typeof $request !== "undefined") {
    captureRequest();
    return;
  }

  const cookies = loadCookies();
  if (!cookies.length) {
    log("❌ 未获取到 Cookie，无法执行任务");
    log("📋 抓包配置（可整段复制）:\n" + CAPTURE_CONFIG_TEXT);
    $.msg($.name, "未获取到 Cookie", "请先进入签到页抓包一次");
    return;
  }

  for (let i = 0; i < cookies.length; i++) {
    await runAccount(cookies[i], i + 1, cookies.length);
  }

  notifyFinal();
}

function captureRequest() {
  const url = String($request.url || "");
  if (!isCaptureUrl(url)) return;

  const headers = normalizeHeaderObject($request.headers || {});
  const body = typeof $request.body === "string" ? $request.body : "";
  const cookie = headers.cookie || "";
  const ua = headers["user-agent"] || "";
  const origin = headers.origin || "";
  const referer = headers.referer || "";

  if (!cookie) {
    $.msg($.name, "抓包失败", "请求头未找到 Cookie");
    return;
  }

  const cookieRet = saveCookie(cookie);
  const uaRet = ua ? saveValueIfChanged(CFG.store.uaKey, ua) : { changed: false };
  const originRet = origin ? saveValueIfChanged(CFG.store.originKey, origin) : { changed: false };
  const refererRet = referer
    ? saveValueIfChanged(CFG.store.refererKey, referer)
    : { changed: false };
  const paramRet = updateRuntimeParams(url, body);

  const changedParts = [];
  if (cookieRet.changed) changedParts.push("Cookie");
  if (uaRet.changed) changedParts.push("UA");
  if (originRet.changed) changedParts.push("Origin");
  if (refererRet.changed) changedParts.push("Referer");
  if (paramRet.changed) changedParts.push("Params");

  const normalizedCookie = cookieRet.newCookie || normalizeCookie(cookie);
  const accountHint = getAccountHintFromCookie(normalizedCookie);
  const cookieFields = formatCookieFieldPairs(parseCookieMap(normalizedCookie));
  const runtimeFieldText = formatRuntimeParams(paramRet.current);

  if (!changedParts.length) {
    log("ℹ️ 抓包字段无变化，跳过写入与通知");
    log("👤 账号: " + accountHint);
    log("🍪 Cookie字段(全量): " + (cookieFields || "空"));
    if (runtimeFieldText) log("🧩 参数字段(全量): " + runtimeFieldText);
    return;
  }

  log("✅ 抓包字段已更新: " + changedParts.join(" / "));
  log("👤 账号: " + accountHint);
  log("🍪 Cookie字段(全量): " + (cookieFields || "空"));
  if (runtimeFieldText) log("🧩 参数字段(全量): " + runtimeFieldText);

  const lines = [];
  lines.push("变更项: " + changedParts.join(" / "));
  lines.push("账号: " + accountHint);
  lines.push("Cookie字段: " + (cookieFields || "空"));
  if (runtimeFieldText) lines.push("参数字段: " + runtimeFieldText);
  $.msg($.name, "抓包字段已更新", lines.join("\n"));
}

async function runAccount(cookie, index, total) {
  log("==========");
  log("🧾 账号 " + index + "/" + total);

  const result = {
    decision_path: [],
    action_taken: "none",
    result_category: "",
    key_fields: {},
    next_step: "",
  };

  const normalizedCookie = normalizeCookie(cookie);
  const runtimeCfg = getRuntimeCfg();
  const headers = buildHeaders(normalizedCookie, runtimeCfg.ua, runtimeCfg.origin, runtimeCfg.referer);

  if (runtime.debug) {
    log("🔍 调试: 请求头 UA=" + runtimeCfg.ua);
    log("🔍 调试: 请求头 Origin=" + runtimeCfg.origin + " | Referer=" + runtimeCfg.referer);
  }

  const cookieHint = getAccountHintFromCookie(normalizedCookie);
  if (cookieHint) log("👤 Cookie账号: " + cookieHint);

  const userResp = await requestJSON("GET", CFG.api.getUserId, {
    headers: headers,
    timeout: CFG.defaults.timeoutMs,
  });
  if (!userResp.ok) {
    log("❌ 查询用户信息失败: " + userResp.error);
    result.decision_path.push("query_user_network_failed");
    result.result_category = "network_error";
    result.next_step = "检查网络后重试";
    summaries.push(buildSummaryLine(index, "", "❌ 网络异常", "", ""));
    logResultObject(result);
    return;
  }

  const userObj = userResp.data;
  const userCode = parseIntSafe(userObj.code, -1);
  const userMsg = cleanText(userObj.msg || "");
  if (userCode !== 0) {
    const cat = classifyError(userCode, userMsg);
    log("❌ 登录态异常: code=" + userCode + " msg=" + (userMsg || "空"));
    result.decision_path.push("query_user_failed");
    result.result_category = cat;
    result.key_fields.user_api = { code: userCode, msg: userMsg };
    result.next_step = "更新 Cookie 后重试";
    summaries.push(buildSummaryLine(index, cookieHint, "❌ 登录态失效", "", ""));
    logResultObject(result);
    return;
  }

  const userData = userObj.data && typeof userObj.data === "object" ? userObj.data : {};
  const profile = buildProfile(userData, normalizedCookie);
  const profileText = formatProfile(profile, true);
  if (profileText) log("👤 账号信息: " + profileText);
  result.key_fields.profile = profile;
  result.decision_path.push("query_user_ok");

  const giftListResp = await requestJSON("GET", CFG.api.giftList, {
    headers: headers,
    params: buildGiftListParams(runtimeCfg.params),
    timeout: CFG.defaults.timeoutMs,
  });
  if (!giftListResp.ok) {
    log("❌ 查询任务状态失败: " + giftListResp.error);
    result.decision_path.push("query_state_network_failed");
    result.result_category = "network_error";
    result.next_step = "检查网络后重试";
    summaries.push(buildSummaryLine(index, formatProfile(profile, false), "❌ 状态查询失败", "", ""));
    logResultObject(result);
    return;
  }

  const giftObj = giftListResp.data;
  const giftCode = parseIntSafe(giftObj.code, -1);
  const giftMsg = cleanText(giftObj.msg || "");
  if (giftCode !== 0) {
    const cat = classifyError(giftCode, giftMsg);
    log("❌ 状态接口失败: code=" + giftCode + " msg=" + (giftMsg || "空"));
    result.decision_path.push("query_state_failed");
    result.result_category = cat;
    result.key_fields.state_api = { code: giftCode, msg: giftMsg };
    result.next_step = "检查活动页登录态后重试";
    summaries.push(buildSummaryLine(index, formatProfile(profile, false), "❌ 状态异常", "", ""));
    logResultObject(result);
    return;
  }

  const giftData = giftObj.data && typeof giftObj.data === "object" ? giftObj.data : {};
  const taskList = Array.isArray(giftData.list) ? giftData.list : [];
  const dayNum = parseIntSafe(giftData.day_num, -1);
  const endTime = parseIntSafe(giftData.endTime, 0);
  log("📅 本月累计签到: " + (dayNum >= 0 ? dayNum + " 天" : "未返回"));
  log("📦 任务总数: " + taskList.length + (endTime > 0 ? " | 失效时间戳: " + endTime : ""));
  result.decision_path.push("query_state_ok");
  result.key_fields.state = {
    day_num: dayNum,
    endTime: endTime,
    task_count: taskList.length,
  };

  const targetTask = pickTargetTask(taskList, runtime.taskId, runtimeCfg.params.lastTaskId);
  if (!targetTask) {
    const sample = summarizeTaskList(taskList);
    log("⚠️ 未识别到签到任务，停止执行");
    if (sample) log("🧩 任务样本: " + sample);
    result.decision_path.push("task_not_found");
    result.result_category = "state_undecidable";
    result.next_step = "抓取签到页 gift_list 或 get_gift 请求";
    summaries.push(buildSummaryLine(index, formatProfile(profile, false), "⚠️ 未识别签到任务", dayNum, ""));
    logResultObject(result);
    return;
  }

  const taskId = parseIntSafe(targetTask.task_id, null);
  const taskTitle = cleanText(targetTask.title || "");
  const taskStatus = parseIntSafe(targetTask.status, -1);
  const taskContent = cleanText(targetTask.content || "");
  log(
    "🎯 目标任务: id=" +
      (taskId === null ? "空" : taskId) +
      " | 标题=" +
      (taskTitle || "空") +
      " | 状态=" +
      statusText(taskStatus)
  );
  if (taskContent) log("📝 任务按钮文案: " + taskContent);

  result.key_fields.target_task = {
    task_id: taskId,
    title: taskTitle,
    status: taskStatus,
    content: taskContent,
  };

  if (taskStatus === 2) {
    log("✅ 状态判定: 今日已签，停止执行");
    result.decision_path.push("already_signed_stop");
    result.action_taken = "none";
    result.result_category = "ok";
    result.next_step = "明日再执行";
    summaries.push(buildSummaryLine(index, formatProfile(profile, false), "✅ 今日已签到", dayNum, ""));
    logResultObject(result);
    return;
  }

  if (taskStatus === 0) {
    log("ℹ️ 状态判定: 当前任务不可领取，停止执行");
    result.decision_path.push("task_not_ready_stop");
    result.action_taken = "none";
    result.result_category = "ok";
    result.next_step = "等待状态变为可领取后再执行";
    summaries.push(buildSummaryLine(index, formatProfile(profile, false), "ℹ️ 任务未就绪", dayNum, ""));
    logResultObject(result);
    return;
  }

  if (taskStatus !== 1) {
    log("⚠️ 状态判定: 状态值无法识别(" + taskStatus + ")，停止执行");
    result.decision_path.push("state_undecidable_stop");
    result.action_taken = "none";
    result.result_category = "state_undecidable";
    result.next_step = "等待明确状态字段后再执行";
    summaries.push(buildSummaryLine(index, formatProfile(profile, false), "⚠️ 状态无法判定", dayNum, ""));
    logResultObject(result);
    return;
  }

  if (taskId === null) {
    log("❌ 任务可领取但 task_id 缺失，停止执行");
    result.decision_path.push("missing_task_id_stop");
    result.action_taken = "none";
    result.result_category = "state_undecidable";
    result.next_step = "抓取 get_gift 请求补齐 task_id";
    summaries.push(buildSummaryLine(index, formatProfile(profile, false), "❌ 缺少 task_id", dayNum, ""));
    logResultObject(result);
    return;
  }

  log("🛠️ 状态判定: 可领取，准备执行签到领取");
  result.decision_path.push("state_need_claim");
  result.action_taken = "claim_attempted";

  const claimResp = await requestJSON("POST", CFG.api.getGift, {
    headers: headers,
    json: { task_id: taskId },
    timeout: CFG.defaults.timeoutMs,
  });
  if (!claimResp.ok) {
    log("❌ 领取请求失败: " + claimResp.error);
    result.decision_path.push("claim_network_failed");
    result.result_category = "network_error";
    result.next_step = "稍后重试";
    summaries.push(buildSummaryLine(index, formatProfile(profile, false), "❌ 领取请求失败", dayNum, ""));
    logResultObject(result);
    return;
  }

  const claimObj = claimResp.data;
  const claimCode = parseIntSafe(claimObj.code, -1);
  const claimMsg = cleanText(claimObj.msg || "");
  const claimData = claimObj.data && typeof claimObj.data === "object" ? claimObj.data : {};
  const rewardText = extractRewardText(claimData);

  result.key_fields.claim = {
    code: claimCode,
    msg: claimMsg,
    reward: rewardText,
  };

  if (claimCode !== 0) {
    const cat = classifyError(claimCode, claimMsg);
    log("❌ 领取失败: code=" + claimCode + " msg=" + (claimMsg || "空"));
    if (rewardText) log("🎁 服务端返回奖励字段: " + rewardText);
    result.decision_path.push("claim_rejected");
    result.result_category = cat;
    result.next_step = "检查活动状态后重试";
    summaries.push(buildSummaryLine(index, formatProfile(profile, false), "❌ 领取失败", dayNum, ""));
    logResultObject(result);
    return;
  }

  if (rewardText) {
    log("🎁 领取结果: " + rewardText);
  } else {
    log("🎁 奖励字段: 奖励名未返回");
  }
  result.decision_path.push("claim_success");

  const verifyResp = await requestJSON("GET", CFG.api.giftList, {
    headers: headers,
    params: buildGiftListParams(runtimeCfg.params),
    timeout: CFG.defaults.timeoutMs,
  });

  let finalDayNum = dayNum;
  if (verifyResp.ok) {
    const verifyObj = verifyResp.data;
    const verifyCode = parseIntSafe(verifyObj.code, -1);
    if (verifyCode === 0 && verifyObj.data && typeof verifyObj.data === "object") {
      finalDayNum = parseIntSafe(verifyObj.data.day_num, finalDayNum);
      const verifyList = Array.isArray(verifyObj.data.list) ? verifyObj.data.list : [];
      const verifyTask = findTaskById(verifyList, taskId);
      if (verifyTask) {
        const verifyStatus = parseIntSafe(verifyTask.status, -1);
        log("✅ 结果复核: 状态=" + statusText(verifyStatus));
      } else {
        log("ℹ️ 结果复核: 未找到同 task_id 任务");
      }
    } else {
      log("ℹ️ 结果复核: 状态接口返回异常，跳过复核");
    }
  } else {
    log("ℹ️ 结果复核: 请求失败，保留首次查询数据");
  }

  result.result_category = "ok";
  result.next_step = "明日再执行";
  summaries.push(
    buildSummaryLine(
      index,
      formatProfile(profile, false),
      "✅ 签到成功",
      finalDayNum,
      formatRewardForNotify(rewardText)
    )
  );
  logResultObject(result);
}

function notifyFinal() {
  if (!summaries.length) {
    $.msg($.name, "⚠️ 无可用结果", "请查看日志定位问题");
    return;
  }
  const subtitle = buildNotifySubtitle(summaries);
  $.msg($.name, subtitle, summaries.join("\n"));
}

function buildNotifySubtitle(lines) {
  if (!lines || !lines.length) return "📌 签到结果";
  const first = String(lines[0] || "");
  const status =
    first.indexOf("✅") >= 0
      ? "✅"
      : first.indexOf("❌") >= 0
        ? "❌"
        : first.indexOf("⚠️") >= 0
          ? "⚠️"
          : "📌";
  const accountMatch = first.match(/\(([^)]+)\)/);
  let subtitle = status + " ";
  if (accountMatch && accountMatch[1]) subtitle += accountMatch[1];
  else subtitle += "测测签到";
  if (lines.length > 1) subtitle += " | +" + (lines.length - 1) + "账号";
  return subtitle;
}

function buildSummaryLine(index, profileText, statusTextLine, dayNum, rewardText) {
  let line = "🧾账号" + index;
  if (profileText) line += "(" + profileText + ")";
  line += ": " + statusTextLine;
  if (typeof dayNum === "number" && dayNum >= 0) line += " | 📅累签" + dayNum + "天";
  if (rewardText) line += " | 🎁奖励:" + rewardText;
  return line;
}

function buildProfile(userData, cookie) {
  const sessionUid = extractUidFromCookie(cookie);
  const userId = cleanText(userData.userId || "");
  const username = cleanText(userData.username || "");
  const dataId = cleanText(userData.dataId || "");
  return {
    userId: userId || sessionUid,
    username: username,
    dataId: dataId,
    sessionUid: sessionUid,
  };
}

function formatProfile(profile, forLog) {
  const parts = [];
  if (profile.username) parts.push("📝" + profile.username);
  if (profile.userId) parts.push("👤" + profile.userId);
  if (profile.sessionUid && profile.sessionUid !== profile.userId) parts.push("🔑" + profile.sessionUid);
  if (profile.dataId) parts.push("🆔" + shortText(profile.dataId, 18));
  if (!parts.length) {
    return forLog ? "账号信息未返回" : "";
  }
  return parts.join(" | ");
}

function pickTargetTask(tasks, forceTaskId, capturedTaskId) {
  if (!Array.isArray(tasks) || !tasks.length) return null;

  const preferredTaskId = forceTaskId !== null ? forceTaskId : parseIntSafe(capturedTaskId, null);
  if (preferredTaskId !== null) {
    const exact = findTaskById(tasks, preferredTaskId);
    if (exact) return exact;
  }

  const signByKeyword = tasks.filter(function (t) {
    const title = cleanText((t && t.title) || "");
    const desc = cleanText((t && t.desc) || "");
    const content = cleanText((t && t.content) || "");
    return /签到|sign/i.test(title + " " + desc + " " + content);
  });
  if (signByKeyword.length) {
    const ready = signByKeyword.find(function (t) {
      return parseIntSafe(t.status, -1) === 1;
    });
    if (ready) return ready;
    return signByKeyword[0];
  }

  const statusReady = tasks.find(function (t) {
    return parseIntSafe(t.status, -1) === 1;
  });
  if (statusReady) return statusReady;

  return tasks[0];
}

function findTaskById(tasks, taskId) {
  if (!Array.isArray(tasks)) return null;
  for (let i = 0; i < tasks.length; i++) {
    if (String(tasks[i].task_id) === String(taskId)) return tasks[i];
  }
  return null;
}

function summarizeTaskList(tasks) {
  if (!Array.isArray(tasks) || !tasks.length) return "";
  const sample = [];
  const max = Math.min(tasks.length, 4);
  for (let i = 0; i < max; i++) {
    const t = tasks[i] || {};
    const id = cleanText(t.task_id);
    const title = cleanText(t.title || "");
    const status = parseIntSafe(t.status, -1);
    sample.push("[" + id + "]" + (title || "未命名") + ":" + statusText(status));
  }
  return sample.join(" | ");
}

function statusText(status) {
  if (status === 0) return "待完成(0)";
  if (status === 1) return "可领取(1)";
  if (status === 2) return "已完成(2)";
  return "未知(" + status + ")";
}

function extractRewardText(claimData) {
  if (!claimData || typeof claimData !== "object") return "";
  const candidates = [];
  pushRewardCandidate(candidates, claimData.title);
  pushRewardCandidate(candidates, claimData.success_content);
  pushRewardCandidate(candidates, claimData.next_gift);
  pushRewardCandidate(candidates, claimData.use_but);
  const uniq = uniqueList(candidates).filter(function (s) {
    return !/领取成功|我知道了|取消|查看权益|去查看/i.test(s);
  });
  if (!uniq.length) return "";
  return uniq.slice(0, 2).join(" | ");
}

function pushRewardCandidate(arr, value) {
  const txt = cleanText(String(value || "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " "));
  if (!txt) return;
  arr.push(txt);
}

function formatRewardForNotify(text) {
  const raw = cleanText(text || "");
  if (!raw) return "";
  if (/奖励名未返回|未返回奖励|未知奖励/i.test(raw)) return "";
  return raw;
}

function classifyError(code, msg) {
  const c = String(code);
  const m = String(msg || "");
  if (c === "401" || c === "403" || /未登录|登录|token|sid|auth/i.test(m)) return "auth_expired";
  if (/频繁|太快|稍后|限流|rate/i.test(m)) return "rate_limited";
  if (/参数|非法|task/i.test(m)) return "action_rejected";
  if (c !== "0") return "action_rejected";
  return "parse_error";
}

function logResultObject(obj) {
  try {
    log("🧩 结果对象: " + JSON.stringify(obj, null, 0));
  } catch (e) {
    log("🧩 结果对象序列化失败");
  }
}

function buildGiftListParams(storedParams) {
  const out = {};
  const src = storedParams && typeof storedParams === "object" ? storedParams : {};
  if (src.source !== undefined && src.source !== null && String(src.source) !== "") {
    out.source = src.source;
  }
  if (runtime.taskId !== null) out.task_id = runtime.taskId;
  return out;
}

function getRuntimeCfg() {
  return {
    ua: $.getdata(CFG.store.uaKey) || CFG.defaults.userAgent,
    origin: $.getdata(CFG.store.originKey) || CFG.defaults.origin,
    referer: $.getdata(CFG.store.refererKey) || CFG.defaults.referer,
    params: loadRuntimeParams(),
  };
}

function loadRuntimeParams() {
  const raw = $.getdata(CFG.store.paramsKey) || "";
  const obj = toJSON(raw, {});
  if (!obj || typeof obj !== "object") return {};
  return obj;
}

function updateRuntimeParams(url, body) {
  const oldObj = loadRuntimeParams();
  const nextObj = cloneByJSON(oldObj);

  const q = parseQueryFromUrl(url);
  const b = parseFormBody(body);

  if (CFG.capture.listPathRe.test(url)) {
    if (q.source !== undefined) nextObj.source = q.source;
    if (q.task_id !== undefined) nextObj.lastTaskId = parseIntSafe(q.task_id, nextObj.lastTaskId || null);
  }
  if (CFG.capture.claimPathRe.test(url)) {
    if (b.task_id !== undefined) nextObj.lastTaskId = parseIntSafe(b.task_id, nextObj.lastTaskId || null);
    if (q.task_id !== undefined) nextObj.lastTaskId = parseIntSafe(q.task_id, nextObj.lastTaskId || null);
  }

  const oldSig = stableStringify(buildRuntimeParamSnapshot(oldObj));
  const newSig = stableStringify(buildRuntimeParamSnapshot(nextObj));
  const changed = oldSig !== newSig;

  if (changed) {
    nextObj.updatedAt = Date.now();
    $.setdata(JSON.stringify(nextObj), CFG.store.paramsKey);
  }

  return {
    changed: changed,
    previous: buildRuntimeParamSnapshot(oldObj),
    current: buildRuntimeParamSnapshot(nextObj),
  };
}

function buildRuntimeParamSnapshot(obj) {
  const src = obj && typeof obj === "object" ? obj : {};
  return {
    source: src.source !== undefined ? src.source : "",
    lastTaskId: src.lastTaskId !== undefined ? src.lastTaskId : "",
  };
}

function formatRuntimeParams(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return "";
  const parts = [];
  parts.push("source=" + (snapshot.source !== undefined ? snapshot.source : ""));
  parts.push("lastTaskId=" + (snapshot.lastTaskId !== undefined ? snapshot.lastTaskId : ""));
  return parts.join(" | ");
}

function saveCookie(cookie) {
  const normalizedCookie = normalizeCookie(cookie);
  const oldRaw = $.getdata(CFG.store.cookieKey) || "";
  const oldList = splitCookieList(oldRaw);

  const accountId = getCookieIdentity(normalizedCookie);
  const newSig = cookieSignatureForDiff(normalizedCookie);

  let changed = false;
  let existed = false;
  let oldCookie = "";
  const nextList = [];

  for (let i = 0; i < oldList.length; i++) {
    const old = normalizeCookie(oldList[i]);
    const oldId = getCookieIdentity(old);
    if (oldId === accountId) {
      existed = true;
      oldCookie = old;
      if (cookieSignatureForDiff(old) === newSig) {
        nextList.push(old);
      } else {
        nextList.push(normalizedCookie);
        changed = true;
      }
    } else {
      nextList.push(old);
    }
  }

  if (!existed) {
    nextList.push(normalizedCookie);
    changed = true;
  }

  if (changed) {
    $.setdata(nextList.join("\n"), CFG.store.cookieKey);
  }

  return {
    changed: changed,
    isNew: !existed,
    accountId: accountId,
    oldCookie: oldCookie,
    newCookie: normalizedCookie,
  };
}

function loadCookies() {
  const envCookie = getNodeEnv("CECE_SIGNIN_COOKIE") || getNodeEnv("cece_signin_cookie") || "";
  const localCookie = $.getdata(CFG.store.cookieKey) || "";
  const raw = (envCookie || localCookie || "").trim();
  if (!raw) return [];
  const list = splitCookieList(raw);

  const seen = {};
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const cookie = normalizeCookie(list[i]);
    const id = getCookieIdentity(cookie);
    if (seen[id]) continue;
    seen[id] = 1;
    out.push(cookie);
  }
  return out;
}

function splitCookieList(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/\n/)
    .map(function (s) {
      return s.trim();
    })
    .filter(function (s) {
      return !!s;
    });
}

function getCookieIdentity(cookie) {
  const uid = extractUidFromCookie(cookie);
  if (uid) return "uid:" + uid;
  const map = parseCookieMap(cookie);
  if (map.XXWOLO_SESSION) return "sess:" + shortText(map.XXWOLO_SESSION, 40);
  const all = buildCookieFromMap(map);
  return "raw:" + shortText(all, 40);
}

function getAccountHintFromCookie(cookie) {
  const map = parseCookieMap(cookie);
  const parts = [];
  const uid = extractUidFromCookie(cookie);
  if (uid) parts.push("uid=" + uid);
  if (map.XXWOLO_SESSION) parts.push("XXWOLO_SESSION=" + shortText(map.XXWOLO_SESSION, 24));
  const keys = Object.keys(map);
  if (keys.length) parts.push("keys=" + keys.join(","));
  return parts.join(" | ");
}

function cookieSignatureForDiff(cookie) {
  const map = parseCookieMap(cookie);
  const keys = Object.keys(map);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (/^(sensorsdata2015jssdkcross|_ga|_gid|_gat|hm_|um_)/i.test(key)) {
      delete map[key];
    }
  }
  return stableStringify(map);
}

function normalizeCookie(cookie) {
  const map = parseCookieMap(cookie);
  return buildCookieFromMap(map);
}

function parseCookieMap(cookie) {
  const map = {};
  if (!cookie) return map;
  const parts = String(cookie).split(";");
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i].trim();
    if (!seg || seg.indexOf("=") < 0) continue;
    const idx = seg.indexOf("=");
    const key = seg.slice(0, idx).trim();
    const value = seg.slice(idx + 1).trim();
    if (key) map[key] = value;
  }
  return map;
}

function buildCookieFromMap(map) {
  const keys = Object.keys(map || {});
  const out = [];
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const value = map[key];
    if (value === undefined || value === null || value === "") continue;
    out.push(key + "=" + value);
  }
  return out.join("; ");
}

function formatCookieFieldPairs(map) {
  if (!map || typeof map !== "object") return "";
  const keys = Object.keys(map).sort();
  if (!keys.length) return "";
  const out = [];
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    out.push(k + "=" + shortText(String(map[k] || ""), 48));
  }
  return out.join("; ");
}

function extractUidFromCookie(cookie) {
  const map = parseCookieMap(cookie);
  const sess = map.XXWOLO_SESSION || "";
  if (!sess) return "";

  const decoded = safeDecode(sess);
  const m = decoded.match(/uid:([A-Za-z0-9_\-]+)/);
  if (m && m[1]) return m[1];
  return "";
}

function isCaptureUrl(url) {
  return (
    CFG.capture.userPathRe.test(url) ||
    CFG.capture.listPathRe.test(url) ||
    CFG.capture.claimPathRe.test(url)
  );
}

function buildHeaders(cookie, ua, origin, referer) {
  return {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json;charset=UTF-8",
    Origin: origin || CFG.defaults.origin,
    Referer: referer || CFG.defaults.referer,
    "User-Agent": ua || CFG.defaults.userAgent,
    Cookie: cookie,
  };
}

async function requestJSON(method, path, options) {
  const opts = options || {};
  const url = buildUrl(path, opts.params);
  const headers = opts.headers || {};
  const timeout = opts.timeout || CFG.defaults.timeoutMs;
  let body = opts.body || "";

  if (opts.json && typeof opts.json === "object") {
    body = JSON.stringify(opts.json);
  }

  const req = {
    url: url,
    headers: headers,
    timeout: timeout,
  };

  if (method.toUpperCase() !== "GET" && body !== "") {
    req.body = body;
  }

  try {
    const resp = method.toUpperCase() === "GET" ? await $.http.get(req) : await $.http.post(req);
    const rawBody = resp && resp.body ? resp.body : "";
    const data = toJSON(rawBody, null);
    if (runtime.debug) {
      log(
        "🌐 " +
          method.toUpperCase() +
          " " +
          path +
          " -> status=" +
          (resp && (resp.statusCode || resp.status))
      );
    }
    if (!data || typeof data !== "object") {
      return {
        ok: false,
        error: "JSON解析失败",
        status: resp && (resp.statusCode || resp.status),
        body: rawBody,
      };
    }
    return {
      ok: true,
      status: resp && (resp.statusCode || resp.status),
      data: data,
      body: rawBody,
    };
  } catch (err) {
    return {
      ok: false,
      error: String(err),
      status: 0,
      body: "",
    };
  }
}

function buildUrl(path, params) {
  const base = CFG.api.base + path;
  const p = params && typeof params === "object" ? params : {};
  const keys = Object.keys(p);
  if (!keys.length) return base;
  const arr = [];
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const val = p[key];
    if (val === undefined || val === null || String(val) === "") continue;
    arr.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(val)));
  }
  if (!arr.length) return base;
  return base + (base.indexOf("?") >= 0 ? "&" : "?") + arr.join("&");
}

function parseArguments(argStr) {
  const out = {};
  if (!argStr) return out;
  const segs = String(argStr).split("&");
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (!seg) continue;
    const idx = seg.indexOf("=");
    const key = idx >= 0 ? seg.slice(0, idx) : seg;
    const val = idx >= 0 ? seg.slice(idx + 1) : "";
    if (!key) continue;
    out[safeDecode(key)] = safeDecode(val.replace(/\+/g, "%20"));
  }
  return out;
}

function parseQueryFromUrl(url) {
  if (!url || url.indexOf("?") < 0) return {};
  const query = url.slice(url.indexOf("?") + 1);
  return parseFormBody(query);
}

function parseFormBody(raw) {
  const out = {};
  if (!raw || typeof raw !== "string") return out;
  const arr = raw.split("&");
  for (let i = 0; i < arr.length; i++) {
    const seg = arr[i];
    if (!seg) continue;
    const idx = seg.indexOf("=");
    const key = idx >= 0 ? seg.slice(0, idx) : seg;
    const val = idx >= 0 ? seg.slice(idx + 1) : "";
    const decodedKey = safeDecode(key);
    const decodedVal = safeDecode(val.replace(/\+/g, "%20"));
    if (decodedKey) out[decodedKey] = decodedVal;
  }
  return out;
}

function safeDecode(v) {
  try {
    return decodeURIComponent(v);
  } catch (e) {
    return v;
  }
}

function cleanText(v) {
  return String(v || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shortText(v, len) {
  const s = String(v || "");
  if (!len || s.length <= len) return s;
  return s.slice(0, len) + "...";
}

function uniqueList(arr) {
  const out = [];
  const seen = {};
  for (let i = 0; i < arr.length; i++) {
    const key = String(arr[i] || "");
    if (!key) continue;
    if (seen[key]) continue;
    seen[key] = 1;
    out.push(key);
  }
  return out;
}

function parseIntSafe(v, fallback) {
  const n = parseInt(String(v), 10);
  return isNaN(n) ? fallback : n;
}

function toBool(v, fallback) {
  if (v === undefined || v === null || v === "") return !!fallback;
  const s = String(v).toLowerCase();
  if (s === "1" || s === "true" || s === "yes" || s === "on") return true;
  if (s === "0" || s === "false" || s === "no" || s === "off") return false;
  return !!fallback;
}

function cloneByJSON(obj) {
  return toJSON(JSON.stringify(obj || {}), {});
}

function stableStringify(value) {
  if (value === null || typeof value === "undefined") return "null";
  const t = typeof value;
  if (t === "number" || t === "boolean") return JSON.stringify(value);
  if (t === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    const arr = [];
    for (let i = 0; i < value.length; i++) arr.push(stableStringify(value[i]));
    return "[" + arr.join(",") + "]";
  }
  if (t === "object") {
    const keys = Object.keys(value).sort();
    const arr = [];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      arr.push(JSON.stringify(k) + ":" + stableStringify(value[k]));
    }
    return "{" + arr.join(",") + "}";
  }
  return JSON.stringify(String(value));
}

function saveValueIfChanged(key, nextValue) {
  if (!key) return { changed: false, oldValue: "", newValue: "" };
  const next = String(nextValue || "");
  const old = String($.getdata(key) || "");
  if (next === old) return { changed: false, oldValue: old, newValue: next };
  $.setdata(next, key);
  return { changed: true, oldValue: old, newValue: next };
}

function migrateLegacyStore() {
  migrateKey(CFG.store.legacyCookieKey, CFG.store.cookieKey);
  migrateKey(CFG.store.legacyUaKey, CFG.store.uaKey);
}

function migrateKey(fromKey, toKey) {
  if (!fromKey || !toKey || fromKey === toKey) return;
  const toVal = $.getdata(toKey);
  if (toVal !== null && toVal !== undefined && String(toVal).trim() !== "") return;
  const fromVal = $.getdata(fromKey);
  if (fromVal === null || fromVal === undefined || String(fromVal).trim() === "") return;
  $.setdata(fromVal, toKey);
  log("🔁 存储迁移: " + fromKey + " -> " + toKey);
}

function normalizeHeaderObject(headers) {
  const out = {};
  const src = headers && typeof headers === "object" ? headers : {};
  const keys = Object.keys(src);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    out[String(k).toLowerCase()] = String(src[k] || "");
  }
  return out;
}

function getNodeEnv(name) {
  try {
    if (typeof process !== "undefined" && process.env && process.env[name]) return process.env[name];
  } catch (e) {}
  return "";
}

function toJSON(str, defVal) {
  if (!str || typeof str !== "string") return defVal;
  try {
    return JSON.parse(str);
  } catch (e) {
    return defVal;
  }
}

function nowText() {
  const d = new Date();
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const h = pad2(d.getHours());
  const min = pad2(d.getMinutes());
  const sec = pad2(d.getSeconds());
  return y + "-" + m + "-" + day + " " + h + ":" + min + ":" + sec;
}

function pad2(n) {
  return n < 10 ? "0" + n : String(n);
}

function log(msg) {
  $.log("[" + nowText() + "] " + msg);
}

function Env(name) {
  this.name = name;
  this.startTime = Date.now();
  this.data = null;
  this.dataFile = "box.dat";
  this.logs = [];
  this.logSeparator = "\n";
  const self = this;
  this.http = {
    get: function (opts) {
      return self._request("GET", opts);
    },
    post: function (opts) {
      return self._request("POST", opts);
    },
  };
}

Env.prototype.isNode = function () {
  return typeof module !== "undefined" && !!module.exports;
};
Env.prototype.isQuanX = function () {
  return typeof $task !== "undefined";
};
Env.prototype.isSurge = function () {
  return typeof $httpClient !== "undefined" && typeof $loon === "undefined";
};
Env.prototype.isLoon = function () {
  return typeof $loon !== "undefined";
};

Env.prototype.getdata = function (key) {
  if (this.isSurge() || this.isLoon()) return $persistentStore.read(key);
  if (this.isQuanX()) return $prefs.valueForKey(key);
  if (this.isNode()) {
    this.data = this.loaddata();
    return this.data[key];
  }
  return null;
};

Env.prototype.setdata = function (val, key) {
  if (this.isSurge() || this.isLoon()) return $persistentStore.write(val, key);
  if (this.isQuanX()) return $prefs.setValueForKey(val, key);
  if (this.isNode()) {
    this.data = this.loaddata();
    this.data[key] = val;
    this.writedata();
    return true;
  }
  return false;
};

Env.prototype.loaddata = function () {
  if (!this.isNode()) return {};
  const fs = require("fs");
  const path = require("path");
  const p1 = path.resolve(this.dataFile);
  const p2 = path.resolve(process.cwd(), this.dataFile);
  const target = fs.existsSync(p1) ? p1 : fs.existsSync(p2) ? p2 : "";
  if (!target) return {};
  try {
    return JSON.parse(fs.readFileSync(target));
  } catch (e) {
    return {};
  }
};

Env.prototype.writedata = function () {
  if (!this.isNode()) return;
  const fs = require("fs");
  const path = require("path");
  const p = path.resolve(this.dataFile);
  fs.writeFileSync(p, JSON.stringify(this.data, null, 2));
};

Env.prototype.msg = function (title, subtitle, body, opts) {
  if (this.isSurge() || this.isLoon()) {
    $notification.post(title, subtitle, body, opts);
  } else if (this.isQuanX()) {
    $notify(title, subtitle, body, opts);
  } else {
    console.log(["", "==============系统通知==============", title, subtitle || "", body || ""].join("\n"));
  }
};

Env.prototype.log = function () {
  const args = Array.prototype.slice.call(arguments);
  this.logs = this.logs.concat(args);
  console.log(args.join(this.logSeparator));
};

Env.prototype.logErr = function (err) {
  const e = err && err.stack ? err.stack : String(err);
  this.log("❗️" + this.name + " 错误: " + e);
};

Env.prototype.done = function (val) {
  const cost = (Date.now() - this.startTime) / 1000;
  this.log("[" + nowText() + "] " + this.name + " 结束, 耗时 " + cost.toFixed(3) + " 秒");
  if (this.isSurge() || this.isQuanX() || this.isLoon()) $done(val || {});
};

Env.prototype._request = function (method, opts) {
  const self = this;
  return new Promise(function (resolve, reject) {
    const req = typeof opts === "string" ? { url: opts } : opts || {};
    const timeout = parseIntSafe(req.timeout, 30000);

    if (self.isQuanX()) {
      const qxReq = {
        url: req.url,
        method: method,
        headers: req.headers || {},
      };
      if (method !== "GET" && req.body !== undefined) qxReq.body = req.body;
      $task
        .fetch(qxReq)
        .then(function (resp) {
          resolve({
            status: resp.statusCode,
            statusCode: resp.statusCode,
            headers: resp.headers,
            body: resp.body,
          });
        })
        .catch(function (e) {
          reject(e);
        });
      return;
    }

    if (self.isSurge() || self.isLoon()) {
      const surgeReq = {
        url: req.url,
        headers: req.headers || {},
        timeout: timeout / 1000,
      };
      if (method !== "GET" && req.body !== undefined) surgeReq.body = req.body;
      const cb = function (err, resp, body) {
        if (err) reject(err);
        else {
          resp.body = body;
          resp.statusCode = resp.status;
          resolve(resp);
        }
      };
      if (method === "GET") $httpClient.get(surgeReq, cb);
      else $httpClient.post(surgeReq, cb);
      return;
    }

    if (self.isNode()) {
      const fetchFn = global.fetch;
      if (!fetchFn) {
        reject(new Error("Node 环境未找到 fetch"));
        return;
      }
      const headers = req.headers || {};
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      let timer = null;
      if (controller) {
        timer = setTimeout(function () {
          controller.abort();
        }, timeout);
      }

      const fetchOpts = {
        method: method,
        headers: headers,
      };
      if (method !== "GET" && req.body !== undefined) fetchOpts.body = req.body;
      if (controller) fetchOpts.signal = controller.signal;

      fetchFn(req.url, fetchOpts)
        .then(function (resp) {
          return resp.text().then(function (body) {
            if (timer) clearTimeout(timer);
            resolve({
              status: resp.status,
              statusCode: resp.status,
              headers: resp.headers,
              body: body,
            });
          });
        })
        .catch(function (e) {
          if (timer) clearTimeout(timer);
          reject(e);
        });
      return;
    }

    reject(new Error("Unknown runtime"));
  });
};

main()
  .catch(function (err) {
    $.logErr(err);
  })
  .finally(function () {
    log("🏁 脚本结束 | 版本 " + SCRIPT_VERSION);
    log("==========");
    $.done();
  });
