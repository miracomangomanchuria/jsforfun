/*
本脚本仅供个人学习交流使用，严禁用于任何商业用途，请于下载后24小时内删除。
脚本无意侵犯任何第三方的肖像权、名誉权、著作权、商标权等合法权益，如涉嫌侵权，请权利人联系脚本，脚本将在收到通知后24小时内删除相关内容。
测测签到+任务（QX/Surge/Loon/Node）

抓包说明：
QX:
[rewrite_local]
^https:\/\/api\.cece\.com\/user\/auth\/refresh_token(?:\?.*)?$ url script-request-body cece_sign.js
[mitm]
hostname = api.cece.com

Loon:
[Script]
http-request ^https:\/\/api\.cece\.com\/user\/auth\/refresh_token(?:\?.*)?$ script-path=cece_sign.js, requires-body=true, timeout=60, tag=cece_sign_capture
[MITM]
hostname = api.cece.com

Surge:
[Script]
cece_sign_capture = type=http-request,pattern=^https:\/\/api\.cece\.com\/user\/auth\/refresh_token(?:\?.*)?$,script-path=cece_sign.js,requires-body=1,timeout=60
[MITM]
hostname = api.cece.com

说明：
1) 仅抓 refresh 也可完成签到状态查询（脚本会注入内置查询端点）。
2) 星星/精灵等任务端点若签名失效会自动跳过，不做盲执行。
*/
const $ = new Env("测测签到");
const VER = "v1.3.5";
const STORE = "cece_task_state_v1";
const CAPTURE_QX = String.raw`[rewrite_local]
^https:\/\/api\.cece\.com\/user\/auth\/refresh_token(?:\?.*)?$ url script-request-body cece_sign.js
[mitm]
hostname = api.cece.com`;
const CAPTURE_LOON = String.raw`[Script]
http-request ^https:\/\/api\.cece\.com\/user\/auth\/refresh_token(?:\?.*)?$ script-path=cece_sign.js, requires-body=true, timeout=60, tag=cece_sign_capture
[MITM]
hostname = api.cece.com`;
const CAPTURE_SURGE = String.raw`[Script]
cece_sign_capture = type=http-request,pattern=^https:\/\/api\.cece\.com\/user\/auth\/refresh_token(?:\?.*)?$,script-path=cece_sign.js,requires-body=1,timeout=60
[MITM]
hostname = api.cece.com`;
const EMBEDDED_FP = {
  apikey: "03096a948345c67323f533565acef6cb",
  uuid: "61b2abe0-cab7-11ef-b24b-17987d946043",
};
const EMBEDDED_ENDPOINTS = [
  {
    key: "sign_index",
    method: "GET",
    url: "https://api.cece.com/user/signIn/index_v2?agent=ios.cc&apikey=03096a948345c67323f533565acef6cb&appType=cece&appid=cece&brand=iPhone&carrier=6553565535&channel=AppStore&client=ios&color_id=burgundyRed&deviceId=&deviceVersion=iOS26.3&iosidfa=&lang=zh-CN&model=iPhone17%2C1&network=wifi&oaid=&seed=1771777366367&sign=990434FB2919944398A7DA319F6D51E8&uuid=61b2abe0-cab7-11ef-b24b-17987d946043&vs=10.30.0",
    body: "",
    meta: { method: "GET" },
    req: { nonce: "D57W416n", contentType: "application/json" },
  },
  {
    key: "sign_record",
    method: "GET",
    url: "https://api.cece.com/user/signIn/record?agent=ios.cc&apikey=03096a948345c67323f533565acef6cb&appType=cece&appid=cece&brand=iPhone&carrier=6553565535&channel=AppStore&client=ios&deviceId=&deviceVersion=iOS26.3&iosidfa=&lang=zh-CN&model=iPhone17%2C1&network=wifi&oaid=&page=1&page_size=20&seed=1771777368563&sign=1920234CBF3421594A0A2F9AF70FEC30&uuid=61b2abe0-cab7-11ef-b24b-17987d946043&vs=10.30.0",
    body: "",
    meta: { method: "GET" },
    req: { nonce: "nc5q9W7e", contentType: "application/json" },
  },
  {
    key: "user_info",
    method: "GET",
    url: "https://api.cece.com/user/index/info?agent=ios.cc&apikey=03096a948345c67323f533565acef6cb&appType=cece&appid=cece&brand=iPhone&carrier=6553565535&channel=AppStore&client=ios&deviceId=&deviceVersion=iOS26.3&iosidfa=&lang=zh-CN&model=iPhone17%2C1&network=wifi&oaid=&seed=1771777366654&sign=D7B806F15B97A6B7CCC4CBFE6F9B6020&uuid=61b2abe0-cab7-11ef-b24b-17987d946043&vs=10.30.0",
    body: "",
    meta: { method: "GET" },
    req: { nonce: "rVipMUD6", contentType: "application/json" },
  },
  {
    key: "scrape_lucky_note",
    method: "GET",
    url: "https://api.cece.com/activity/activity_new/scrape_lucky_note?agent=ios.cc&apikey=03096a948345c67323f533565acef6cb&appType=cece&appid=cece&brand=iPhone&carrier=6553565535&channel=AppStore&client=ios&deviceId=&deviceVersion=iOS26.3&iosidfa=&lang=zh-CN&model=iPhone17%2C1&network=wifi&oaid=&seed=1771862540840&sign=24ECFD2E1529895371858CCE649351EC&uuid=61b2abe0-cab7-11ef-b24b-17987d946043&vs=10.30.0",
    body: "",
    meta: { method: "GET" },
    req: { nonce: "8bQ1J9nx", contentType: "application/json" },
  },
  {
    key: "lucky_note",
    method: "POST",
    url: "https://api.cece.com/community/luck/b01_luck?agent=ios.cc&apikey=03096a948345c67323f533565acef6cb&appType=cece&appid=cece&brand=iPhone&carrier=6553565535&channel=AppStore&client=ios&deviceId=&deviceVersion=iOS26.3&iosidfa=&lang=zh-CN&model=iPhone17%2C1&network=wifi&oaid=&seed=1771862540426&sign=2BC743EF5FFE2EB3339ED510FCB12A49&uuid=61b2abe0-cab7-11ef-b24b-17987d946043&vs=10.30.0",
    body: "{\"luck_keys\":[\"Moon-H2-N-Merc:1771894800000\"],\"point\":null,\"item_id\":\"tspt401fa441f431c0a54ce345cc\",\"need_ai_info\":false,\"need_fortune\":true,\"type_point\":{\"all\":\"null\",\"love\":\"null\",\"money\":\"null\",\"work\":\"null\",\"study\":\"null\",\"scale\":\"null\"}}",
    meta: { method: "POST" },
    req: { nonce: "6iyD2i4g", contentType: "application/json" },
  },
  {
    key: "star_ways",
    method: "GET",
    url: "https://api.cece.com/user/star/ways?agent=ios.cc&apikey=03096a948345c67323f533565acef6cb&appType=cece&appid=cece&brand=iPhone&carrier=6553565535&channel=AppStore&client=ios&deviceId=&deviceVersion=iOS26.3&iosidfa=&lang=zh-CN&model=iPhone17%2C1&network=wifi&oaid=&seed=1771862536368&sign=E2E1DA81A0C4B6314CDF3C8D4E875B99&uuid=61b2abe0-cab7-11ef-b24b-17987d946043&vs=10.30.0",
    body: "",
    meta: { method: "GET" },
    req: { nonce: "1fv25c63", contentType: "application/json" },
  },
  {
    key: "star_report_watch_live",
    method: "GET",
    url: "https://api.cece.com/user/star/report_task_done?agent=ios.cc&apikey=03096a948345c67323f533565acef6cb&appType=cece&appid=cece&brand=iPhone&carrier=6553565535&channel=AppStore&client=ios&deviceId=&deviceVersion=iOS26.3&iosidfa=&lang=zh-CN&model=iPhone17%2C1&network=wifi&oaid=&seed=1771862532895&sign=C316B170F3AAF2AD6F01630811C3AC92&task_type=watch_live&uuid=61b2abe0-cab7-11ef-b24b-17987d946043&vs=10.30.0",
    body: "",
    meta: { method: "GET", task: "watch_live" },
    req: { nonce: "7YN1130R", contentType: "application/json" },
  },
  {
    key: "star_claim_watch_live",
    method: "GET",
    url: "https://api.cece.com/user/star/get_star?agent=ios.cc&apikey=03096a948345c67323f533565acef6cb&appType=cece&appid=cece&brand=iPhone&carrier=6553565535&channel=AppStore&client=ios&deviceId=&deviceVersion=iOS26.3&iosidfa=&lang=zh-CN&model=iPhone17%2C1&network=wifi&oaid=&seed=1771862536281&sign=27F17F13DFBC87418578D473E8D3E582&task_type=watch_live&uuid=61b2abe0-cab7-11ef-b24b-17987d946043&vs=10.30.0",
    body: "",
    meta: { method: "GET", task: "watch_live" },
    req: { nonce: "pCn0n10S", contentType: "application/json" },
  },
  {
    key: "elf_overview",
    method: "GET",
    url: "https://api.cece.com/elf?agent=ios.cc&apikey=03096a948345c67323f533565acef6cb&appType=cece&appid=cece&brand=iPhone&carrier=6553565535&channel=AppStore&client=ios&deviceId=&deviceVersion=iOS26.3&iosidfa=&lang=zh-CN&model=iPhone17%2C1&network=wifi&oaid=&seed=1771862541937&sign=A22E9363C656B1C430EFEFDF2EEE4CCE&uri=elf/get_user_elf_v2&uuid=61b2abe0-cab7-11ef-b24b-17987d946043&vs=10.30.0",
    body: "",
    meta: { method: "GET", uri: "elf/get_user_elf_v2" },
    req: { nonce: "Z127n5GA", contentType: "application/json" },
  },
  {
    key: "elf_my_list",
    method: "GET",
    url: "https://api.cece.com/elf?agent=ios.cc&apikey=03096a948345c67323f533565acef6cb&appType=cece&appid=cece&brand=iPhone&carrier=6553565535&channel=AppStore&client=ios&deviceId=&deviceVersion=iOS26.3&iosidfa=&lang=zh-CN&model=iPhone17%2C1&network=wifi&oaid=&seed=1771862553651&sign=B81A88E198EA3FB747651DF4AE48B5E9&uri=elf/get_my_list&uuid=61b2abe0-cab7-11ef-b24b-17987d946043&vs=10.30.0",
    body: "",
    meta: { method: "GET", uri: "elf/get_my_list" },
    req: { nonce: "rYCqk5dd", contentType: "application/json" },
  },
  {
    key: "elf_get_free_food",
    method: "GET",
    url: "https://api.cece.com/elf/bg/get_free_food?agent=ios.cc&apikey=03096a948345c67323f533565acef6cb&appType=cece&appid=cece&brand=iPhone&carrier=6553565535&channel=AppStore&client=ios&deviceId=&deviceVersion=iOS26.3&iosidfa=&lang=zh-CN&model=iPhone17%2C1&network=wifi&oaid=&seed=1771862554797&sign=9BE312D1A7861FBDEF9BDC27D654DCDD&uuid=61b2abe0-cab7-11ef-b24b-17987d946043&vs=10.30.0",
    body: "",
    meta: { method: "GET" },
    req: { nonce: "32U3W46v", contentType: "application/json" },
  },
  {
    key: "ad_cfg_elf",
    method: "GET",
    url: "https://api.cece.com/user/ad/config_detail?ad_palace=elf&ad_type=incentive_video&agent=ios.cc&apikey=03096a948345c67323f533565acef6cb&appType=cece&appid=cece&brand=iPhone&carrier=6553565535&channel=AppStore&client=ios&deviceId=&deviceVersion=iOS26.3&iosidfa=&lang=zh-CN&model=iPhone17%2C1&network=wifi&oaid=&seed=1771862541938&sign=AF67EED9A628CFE5D4CAEFD08D38A68C&uuid=61b2abe0-cab7-11ef-b24b-17987d946043&vs=10.30.0",
    body: "{\"ad_palace\":\"elf\",\"ad_type\":\"incentive_video\"}",
    meta: { method: "GET", palace: "elf", adType: "incentive_video" },
    req: { nonce: "j5k036ls", contentType: "application/json" },
  },
  {
    key: "elf_add_ats12sco3449_star_at_01",
    method: "GET",
    url: "https://api.cece.com/elf?agent=ios.cc&apikey=03096a948345c67323f533565acef6cb&appType=cece&appid=cece&brand=iPhone&carrier=6553565535&channel=AppStore&client=ios&deviceId=&deviceVersion=iOS26.3&elfId=ATS12SCO3449&iosidfa=&lang=zh-CN&model=iPhone17%2C1&network=wifi&oaid=&seed=1771862545216&sign=08D0565E2E096FCA667E186F5A37B835&starId=star_at_01&uri=elf/user_add_stars&uuid=61b2abe0-cab7-11ef-b24b-17987d946043&vs=10.30.0",
    body: "",
    meta: { method: "GET", uri: "elf/user_add_stars", elfId: "ATS12SCO3449", starId: "star_at_01" },
    req: { nonce: "186183M8", contentType: "application/json" },
  },
  {
    key: "elf_feed_ats12sco3449",
    method: "GET",
    url: "https://api.cece.com/elf?agent=ios.cc&apikey=03096a948345c67323f533565acef6cb&appType=cece&appid=cece&brand=iPhone&carrier=6553565535&channel=AppStore&client=ios&deviceId=&deviceVersion=iOS26.3&elfId=ATS12SCO3449&iosidfa=&lang=zh-CN&model=iPhone17%2C1&network=wifi&oaid=&seed=1771862549765&sign=A866AC60532540E64BEB9423C7F70596&uri=elf/feed_elf_v2&uuid=61b2abe0-cab7-11ef-b24b-17987d946043&vs=10.30.0",
    body: "",
    meta: { method: "GET", uri: "elf/feed_elf_v2", elfId: "ATS12SCO3449" },
    req: { nonce: "00J5p82N", contentType: "application/json" },
  },
];
const arg = parseArg(typeof $argument === "string" ? $argument : "");
const CFG = {
  queryOnly: toBool(arg.query_only, false),
  doStar: toBool(arg.do_star_tasks, true),
  doElf: toBool(arg.do_elf_tasks, true),
  strictTaskCapture: toBool(arg.strict_task_capture, true),
  embeddedBaseline: toBool(arg.use_embedded_baseline, true),
  waitMin: toInt(arg.min_extra_wait, 2),
  waitMax: toInt(arg.max_extra_wait, 6),
  maxAuto: toInt(arg.max_auto_star_tasks, 2),
  debug: toBool(arg.debug, false),
};
if (CFG.waitMin < 0) CFG.waitMin = 0;
if (CFG.waitMax < CFG.waitMin) CFG.waitMax = CFG.waitMin;
if (CFG.maxAuto < 0) CFG.maxAuto = 0;
const summaries = [];
const UA = "Cece/10.30.0 Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";

Promise.resolve().then(async function () {
  try {
    log("==========");
    log("🚀 启动 " + VER + " | query_only=" + CFG.queryOnly + " | doStar=" + CFG.doStar + " | doElf=" + CFG.doElf + " | strictTaskCapture=" + CFG.strictTaskCapture + " | embeddedBaseline=" + CFG.embeddedBaseline);
    if (typeof $request !== "undefined") return capReq();
    const st = load();
    const seedRet = injectEmbeddedBaseline(st, "startup");
    if (seedRet.warn) log("⚠️ 内置基线提示: " + seedRet.warn);
    if (seedRet.added > 0) {
      save(st);
      log("🧱 已注入内置查询端点 " + seedRet.added + " 条（仅抓 refresh 可完成状态查询）");
    }
    const s = ep(st, "sign_index");
    if (!s) {
      const cli = captureClientName();
      const guide = captureGuideByClient();
      log("❌ 缺少 sign_index");
      log("📋 抓包配置(" + cli + "):\n" + guide);
      msgLong($.name, "未获取到抓包字段", "请先进入签到页触发抓包\n" + guide, 260);
      return;
    }
    await ensureAuth(st, "启动检测");
    await runOne(st, 1, 1);
    if (!summaries.length) $.msg($.name, "⚠️ 无可用结果", "请查看日志");
    else $.msg($.name, subline(summaries), summaries.join("\n"));
  } catch (e) {
    $.logErr(e);
  } finally {
    log("🏁 结束 " + VER);
    log("==========");
    $.done();
  }
});

function capReq() {
  const url = String($request.url || "");
  const body = typeof $request.body === "string" ? $request.body : "";
  const d = detect(url, body);
  if (!d) return;
  const h = normH($request.headers || {});
  const req = { authorization: txt(h.authorization), s_id: txt(h.s_id || h["s-id"]), nonce: txt(h.nonce), ua: txt(h["user-agent"]), contentType: txt(h["content-type"]) };
  if (d.key !== "auth_refresh" && !req.authorization) {
    const cli = captureClientName();
    const guide = captureGuideByClient();
    log("⚠️ 抓包失败: 未找到 Authorization");
    log("📋 抓包配置(" + cli + "):\n" + guide);
    return msgLong($.name, "抓包失败", "未找到 Authorization\n请确认按以下配置抓包\n" + guide, 260);
  }
  const st = load();
  if (!st.eps || typeof st.eps !== "object") st.eps = {};
  st.eps[d.key] = {
    url: url,
    req: req,
    body: body || "",
    meta: {
      method: d.method,
      task: d.task || "",
      uri: d.uri || "",
      elfId: d.elfId || "",
      starId: d.starId || "",
      palace: d.palace || "",
      adType: d.adType || "",
    },
    t: Date.now(),
  };
  if (d.key === "sign_index") {
    st.indexUrl = url;
    st.authorization = req.authorization;
    st.s_id = req.s_id;
    st.nonce = req.nonce;
    st.ua = req.ua;
    st.contentType = req.contentType;
  }
  if (d.key === "auth_refresh") {
    const jb = toJSON(body || "", {});
    const rt = txt(jb.refresh_token);
    if (rt) st.refresh_token = rt;
    if (req.s_id) st.s_id = req.s_id;
    if (req.ua) st.ua = req.ua;
    if (req.contentType) st.contentType = req.contentType;
  }
  const seedRet = injectEmbeddedBaseline(st, "capture");
  if (seedRet.warn) log("⚠️ 内置基线提示: " + seedRet.warn);
  if (seedRet.added > 0) log("🧱 抓包后补全查询端点: +" + seedRet.added);
  save(st);
  log("✅ 抓包更新: " + d.key);
  logLong("🌐 URL", url, 220);
  if (req.nonce) log("🧪 nonce: " + req.nonce);
  if (req.s_id) logLong("🧷 s_id", req.s_id, 220);
  if (req.authorization) logLong("🔐 Authorization", req.authorization, 220);
  if (body) logLong("🧾 body", body, 220);
  if (d.key === "auth_refresh") {
    const jb = toJSON(body || "", {});
    const rt = txt(jb.refresh_token);
    const exp = jwtExp(rt);
    const expStr = exp > 0 ? iso(exp) : "未解析";
    notifyCapture(d.key, req, url, body, expStr);
  } else notifyCapture(d.key, req, url, body, "");
}

function injectEmbeddedBaseline(st, source) {
  const ret = { added: 0, warn: "" };
  if (!CFG.embeddedBaseline) return ret;
  if (!st || typeof st !== "object") return ret;
  if (!st.eps || typeof st.eps !== "object") st.eps = {};
  const authEp = ep(st, "auth_refresh");
  if (authEp && authEp.url) {
    const chk = compatCheck(authEp.url);
    if (!chk.ok) ret.warn = chk.msg;
  }
  const srcReq = authEp && authEp.req ? authEp.req : {};
  const reqBase = {
    authorization: txt(st.authorization),
    s_id: txt(st.s_id || srcReq.s_id),
    nonce: txt(st.nonce || srcReq.nonce),
    ua: txt(st.ua || srcReq.ua || UA),
    contentType: txt(st.contentType || srcReq.contentType || "application/json"),
  };
  if (reqBase.s_id) st.s_id = reqBase.s_id;
  if (reqBase.nonce) st.nonce = reqBase.nonce;
  if (reqBase.ua) st.ua = reqBase.ua;
  if (reqBase.contentType) st.contentType = reqBase.contentType;
  EMBEDDED_ENDPOINTS.forEach(function (it) {
    if (!it || !it.key || !it.url) return;
    if (ep(st, it.key)) return;
    const ro = it.req || {};
    st.eps[it.key] = {
      url: it.url,
      req: {
        authorization: reqBase.authorization,
        s_id: txt(ro.s_id || reqBase.s_id),
        nonce: txt(ro.nonce || reqBase.nonce),
        ua: txt(ro.ua || reqBase.ua),
        contentType: txt(ro.contentType || reqBase.contentType),
      },
      body: txt(it.body) ? it.body : "",
      meta: jclone(it.meta || { method: txt(it.method || "GET") || "GET" }),
      t: Date.now(),
    };
    ret.added++;
  });
  if (source === "capture" && ret.added > 0) {
    const signIndex = ep(st, "sign_index");
    if (signIndex && signIndex.url) st.indexUrl = signIndex.url;
    const userInfo = ep(st, "user_info");
    if (userInfo && userInfo.url) st.infoUrl = userInfo.url;
  }
  return ret;
}

function compatCheck(refreshUrl) {
  try {
    const u = new URL(String(refreshUrl || ""));
    const apikey = txt(u.searchParams.get("apikey"));
    const uuid = txt(u.searchParams.get("uuid"));
    if (apikey && apikey !== EMBEDDED_FP.apikey) return { ok: false, msg: "refresh apikey 与内置基线不一致，可能触发签名错误" };
    if (uuid && uuid !== EMBEDDED_FP.uuid) return { ok: false, msg: "refresh uuid 与内置基线不一致，可能触发签名错误" };
    return { ok: true, msg: "" };
  } catch (e) {
    return { ok: true, msg: "" };
  }
}

function detect(url, body) {
  let u;
  try {
    u = new URL(url);
  } catch (e) {
    return null;
  }
  if (u.host !== "api.cece.com") return null;
  const p = u.pathname;
  const m = String(($request && $request.method) || "GET").toUpperCase();
  const jb = toJSON(body, {});
  if (p === "/user/signIn/index_v2") return { key: "sign_index", method: m };
  if (p === "/user/signIn/record") return { key: "sign_record", method: m };
  if (p === "/user/index/info") return { key: "user_info", method: m };
  if (p === "/user/auth/refresh_token") return { key: "auth_refresh", method: m };
  if (p === "/activity/activity_new/scrape_lucky_note") return { key: "scrape_lucky_note", method: m };
  if (p === "/community/luck/b01_luck") return { key: "lucky_note", method: m };
  if (p === "/user/star/ways") return { key: "star_ways", method: m };
  if (p === "/user/star/report_task_done") {
    const t = txt(u.searchParams.get("task_type") || jb.task_type);
    return { key: t ? "star_report_" + sk(t) : "star_report", method: m, task: t };
  }
  if (p === "/user/star/get_star") {
    const t = txt(u.searchParams.get("task_type") || jb.task_type);
    return { key: t ? "star_claim_" + sk(t) : "star_claim", method: m, task: t };
  }
  if (p === "/user/ad/config_detail") {
    const palace = txt(u.searchParams.get("ad_palace") || jb.ad_palace);
    const adType = txt(u.searchParams.get("ad_type") || jb.ad_type);
    return { key: palace ? "ad_cfg_" + sk(palace) : "ad_cfg", method: m, palace: palace, adType: adType };
  }
  if (p === "/user/ad/reward") {
    const palace = txt(u.searchParams.get("ad_palace") || jb.ad_palace);
    const adType = txt(u.searchParams.get("ad_type") || jb.ad_type);
    return { key: palace ? "ad_reward_" + sk(palace) : "ad_reward", method: m, palace: palace, adType: adType };
  }
  if (p === "/elf/bg/get_free_food") return { key: "elf_get_free_food", method: m };
  if (p === "/elf") {
    const uri = txt(u.searchParams.get("uri") || jb.uri);
    const elfId = txt(u.searchParams.get("elfId") || jb.elfId);
    const starId = txt(u.searchParams.get("starId") || jb.starId);
    if (uri === "elf/get_user_elf_v2") return { key: "elf_overview", method: m };
    if (uri === "elf/get_my_list") return { key: "elf_my_list", method: m };
    if (uri === "elf/user_add_stars") return { key: "elf_add_" + sk(elfId || "x") + "_" + sk(starId || "y"), method: m, elfId: elfId, starId: starId };
    if (uri === "elf/feed_elf_v2") return { key: "elf_feed_" + sk(elfId || "x"), method: m, elfId: elfId };
    if (uri) return { key: "elf_uri_" + sk(uri), method: m };
    return { key: "elf_generic", method: m };
  }
  return null;
}

async function runOne(st, i, n) {
  log("==========");
  log("🧾 账号 " + i + "/" + n);
  await ensureAuth(st, "账号流程开始");
  const p = await profile(st);
  if (fmtP(p)) log("👤 " + fmtP(p));
  let s = await sign(st);
  if (!s.ok && isAuthExpiredErr(s.err)) {
    log("⚠️ 检测到授权失效，尝试刷新 token");
    const rr = await refreshAuth(st, "sign接口返回失效");
    if (rr.ok) s = await sign(st);
  }
  if (!s.ok) {
    if (/code=1001|签名错误/.test(txt(s.err))) {
      log("⚠️ 接口签名错误：当前业务端点签名不可用。若只抓 refresh，请先确认内置基线兼容或补抓业务端点。");
    }
    log("❌ 状态查询失败: " + s.err);
    summaries.push(line(i, fmtP(p), "❌ 状态查询失败", -1, "", "", -1, ""));
    return;
  }
  log("📅 " + (s.date || "未返回") + " | 连签 " + pday(s.cycle) + " | 累签 " + pday(s.actual));
  log("⭐ 小星星: " + pval(s.star));
  s.tasks.forEach((t) => log("  - " + txt(t.tip || "未命名") + " | type=" + txt(t.type) + " | done=" + toInt(t.done, -1) + " | ⭐" + toInt(t.star, 0)));
  const r = await record(st);
  if (r.desc) log("🧾 最新记录: " + (r.create || "") + " | " + r.desc);
  const b = await bless(st);
  if (b.text) {
    log("🌈 今日祝福: " + b.text);
    if (b.rec) log("✨ 建议: " + b.rec);
    if (b.avoid) log("⚠️ 避免: " + b.avoid);
  } else log("ℹ️ 祝福语未返回");
  await scrape(st);
  const sr = await starFlow(st);
  const er = await elfFlow(st);
  if (CFG.debug) log("DEBUG star_actions=" + JSON.stringify(sr.actions || []) + " elf_actions=" + JSON.stringify(er.actions || []));
  let stat = "⚠️ 状态待确认";
  if (s.hasResult) stat = "✅ 本次签到成功";
  else if (s.hasScrape) stat = "✅ 今日已签到";
  const rw = fmtR(parseR(s.signResult) || r.desc || "");
  const fs = sr.after >= 0 ? sr.after : s.star;
  const ds = sr.before >= 0 && sr.after >= 0 ? diff(sr.before, sr.after) : "";
  const signHint = starIssueHint(sr.signIssues);
  summaries.push(line(i, fmtP(p), stat, s.cycle >= 0 ? s.cycle : s.actual, rw, b.text ? short(b.text, 24) : "", fs, ds, signHint));
}

async function ensureAuth(st, reason) {
  const s = ep(st, "sign_index");
  if (!s || !s.req) return false;
  const auth = txt((s.req || {}).authorization || st.authorization);
  if (auth && !txt((s.req || {}).authorization)) bindAuth(st, auth);
  const rt = getRefreshToken(st);
  if (!auth) {
    const qr = await call(s, "GET");
    if (qr.ok && toInt(((qr.data || {}).code), -1) === 0) {
      log("ℹ️ 当前端点可在无Authorization下使用，跳过刷新");
      return true;
    }
    const rr = await refreshAuth(st, reason + ": 缺少Authorization");
    if (!rr.ok) log("ℹ️ 无法自动刷新: " + rr.err);
    return rr.ok;
  }
  const exp = jwtExp(auth);
  if (exp <= 0) {
    log("ℹ️ Authorization 不是可解析 JWT，跳过预刷新");
    return true;
  }
  const nowSec = Math.floor(Date.now() / 1000);
  const left = exp - nowSec;
  log("🔐 access_token 到期=" + iso(exp) + " | 剩余=" + left + "秒");
  if (rt) {
    const re = jwtExp(rt);
    if (re > 0) log("🧷 refresh_token 到期=" + iso(re) + " | 剩余=" + (re - nowSec) + "秒");
    else log("🧷 refresh_token 未解析到exp");
  } else log("ℹ️ 未抓到 refresh_token，过期后无法自动续签");
  if (left > 120) {
    if (CFG.debug) log("🧪 access_token剩余 " + left + " 秒");
    return true;
  }
  log("⏱️ access_token 剩余 " + left + " 秒，尝试刷新");
  const rr = await refreshAuth(st, reason + ": 临近过期");
  if (!rr.ok) log("⚠️ token刷新失败: " + rr.err);
  return rr.ok;
}

function isAuthExpiredErr(err) {
  const s = txt(err || "").toLowerCase();
  return s.indexOf("expired token") >= 0 || s.indexOf("code=401") >= 0 || s.indexOf("token") >= 0 && s.indexOf("expired") >= 0;
}

async function refreshAuth(st, reason) {
  const e = ep(st, "auth_refresh");
  if (!e || !e.url) return { ok: false, err: "未抓到 /user/auth/refresh_token" };
  const rt = txt(getRefreshToken(st));
  if (!rt) return { ok: false, err: "缺少 refresh_token" };
  const b = JSON.stringify({ refresh_token: rt });
  const r = await call(e, "POST", b);
  if (!r.ok) return { ok: false, err: r.err };
  const j = r.data || {};
  if (toInt(j.code, -1) !== 0) return { ok: false, err: "code=" + j.code + " msg=" + txt(j.msg) };
  const d = (((j.data || {}).user_token) || {});
  const at = txt(d.access_token);
  const nrt = txt(d.refresh_token) || rt;
  if (!at) return { ok: false, err: "响应缺少access_token" };
  const ah = at.indexOf("Bearer ") === 0 ? at : "Bearer " + at;
  bindAuth(st, ah);
  st.authorization = ah;
  st.refresh_token = nrt;
  // Do NOT rewrite captured auth_refresh body template.
  // Some targets sign POST body bytes; rewriting refresh_token can break signature replay.
  const exp = jwtExp(at);
  const expStr = exp > 0 ? iso(exp) : "未解析";
  const ttl = toInt(d.expires_in, -1);
  save(st);
  log("🔄 token刷新成功 | reason=" + reason + " | exp=" + expStr + (ttl > 0 ? " | ttl=" + ttl + "s" : ""));
  return { ok: true, exp: exp, expStr: expStr };
}

function bindAuth(st, authHeader) {
  if (!st || !st.eps) return;
  Object.keys(st.eps).forEach(function (k) {
    const e = st.eps[k];
    if (!e || !e.req) return;
    if (k === "auth_refresh") return;
    e.req.authorization = authHeader;
  });
}

async function profile(st) {
  const e = ep(st, "user_info");
  if (!e) return {};
  const r = await call(e, "GET");
  if (!r.ok) return {};
  const d = ((r.data || {}).data || {});
  return { user_id: txt(d.user_id), username: txt(d.username), item_id: txt(d.item_id), score: toInt(d.score, -1) };
}
async function sign(st) {
  const e = ep(st, "sign_index");
  if (!e) return { ok: false, err: "缺少 sign_index" };
  const r = await call(e, "GET");
  if (!r.ok) return { ok: false, err: r.err };
  const j = r.data || {};
  if (toInt(j.code, -1) !== 0) return { ok: false, err: "code=" + j.code + " msg=" + txt(j.msg) };
  const d = j.data || {};
  const c = d.calendar || {};
  return { ok: true, star: toInt(d.star_num, -1), cycle: toInt(d.cycle_continuous_days, -1), actual: toInt(d.actual_continuous_days, -1), hasScrape: !!c.hasScrape, hasResult: !!(d.sign_in_result && Object.keys(d.sign_in_result).length), signResult: d.sign_in_result || null, tasks: Array.isArray(d.task_list) ? d.task_list : [], date: [txt(c.dateMonth), txt(c.dateDay), txt(c.dateWeek)].filter(Boolean).join(" ") };
}
async function record(st) {
  const e = ep(st, "sign_record");
  if (!e) return {};
  const r = await call(e, "GET");
  if (!r.ok) return {};
  const j = r.data || {};
  if (toInt(j.code, -1) !== 0) return {};
  const arr = (((j.data || {}).records) || []);
  if (!arr.length) return {};
  const x = arr[0] || {};
  return { desc: txt(x.desc), create: txt(x.create), raw: x };
}
async function bless(st) {
  const e = ep(st, "lucky_note");
  if (!e) return {};
  const r = await call(e, "POST", txt(e.body) ? e.body : "{}");
  if (!r.ok) return {};
  const j = r.data || {};
  if (toInt(j.code, -1) !== 0) return {};
  const d = j.data || {};
  const c0 = (Array.isArray(d.content) ? d.content[0] : null) || {};
  const t0 = (Array.isArray(d.text) ? d.text[0] : "") || "";
  return { text: txt(t0 || c0.text), rec: txt(c0.recommend), avoid: txt(c0.avoidance) };
}
async function scrape(st) {
  const e = ep(st, "scrape_lucky_note");
  if (!e) return;
  const r = await call(e, "GET");
  if (!r.ok) return log("ℹ️ scrape_lucky_note失败: " + r.err);
  const j = r.data || {};
  log("🧪 scrape_lucky_note: code=" + toInt(j.code, -1) + (txt(j.msg) ? " msg=" + txt(j.msg) : ""));
}

async function starFlow(st) {
  const out = { before: -1, after: -1, actions: [], signIssues: [] };
  if (!CFG.doStar) return out;
  const w = ep(st, "star_ways");
  if (!w) return (log("ℹ️ 未抓到 star/ways"), out);
  const rs = taskSet(st, "star_report_");
  const cs = taskSet(st, "star_claim_");
  const rsTxt = rs.size ? Array.from(rs).sort().join(",") : "无";
  const csTxt = cs.size ? Array.from(cs).sort().join(",") : "无";
  log("🧩 星星任务白名单 | report=" + rsTxt + " | claim=" + csTxt + (CFG.strictTaskCapture ? " | strict=on" : " | strict=off"));
  let s = await qWays(w);
  if (!s.ok) {
    log("ℹ️ star/ways失败: " + s.err);
    if (isSignErrText(s.err)) {
      addSignIssue(out, "star/ways");
      log("⚠️ 签名模板失效: star/ways");
      log("📌 请补抓: /user/star/ways");
    }
    return out;
  }
  out.before = s.star;
  out.after = s.star;
  log("⭐ 星星任务当前: " + s.star);
  const got = {};
  for (let i = 0; i < s.list.length; i++) {
    const t = s.list[i] || {};
    const ty = txt(t.type);
    if (!ty || toInt(t.done, -1) !== 2 || got[ty]) continue;
    if (CFG.strictTaskCapture && !hasTask(st, "claim", ty)) {
      log("⏭️ 待领取但未抓到 get_star(" + ty + ")，跳过");
      continue;
    }
    if (await claim(st, ty, out)) {
      got[ty] = 1;
      out.actions.push("领取:" + ty);
    }
  }
  if (!CFG.queryOnly && CFG.maxAuto > 0) {
    let n = 0;
    for (let i = 0; i < s.list.length; i++) {
      if (n >= CFG.maxAuto) break;
      const t = s.list[i] || {};
      const ty = txt(t.type);
      if (!ty || toInt(t.done, -1) !== 0 || !auto(t)) continue;
      if (CFG.strictTaskCapture && !hasTask(st, "report", ty)) {
        log("⏭️ 自动任务未抓到 report_task_done(" + ty + ")，跳过");
        continue;
      }
      const re = tEp(st, "report", ty);
      if (!re) {
        log("ℹ️ 未抓到 report_task_done: " + ty);
        continue;
      }
      const sec = wsec(t);
      if (sec > 0) {
        log("⏳ 等待 " + sec + " 秒后上报: " + ty);
        await sleep(sec * 1000);
      }
      n++;
      const rr = await call(re, "GET");
      if (!rr.ok || toInt((rr.data || {}).code, -1) !== 0) {
        const j = rr.data || {};
        if (rr.ok && isSignErrCodeMsg(j.code, j.msg)) {
          addSignIssue(out, "report_task_done(" + ty + ")");
          log("⚠️ 签名模板失效: report_task_done(" + ty + ") | code=" + toInt(j.code, -1) + " msg=" + txt(j.msg));
          log("📌 请补抓: /user/star/report_task_done?task_type=" + ty);
        }
        log("ℹ️ 上报失败: " + ty + " | " + (rr.ok ? txt((rr.data || {}).msg) : rr.err));
        continue;
      }
      out.actions.push("上报:" + ty);
      log("✅ 已上报: " + ty);
      const rf = await qWays(w);
      if (rf.ok) {
        s = rf;
        const cur = bt(s.list, ty);
        if (cur && toInt(cur.done, -1) === 2 && !got[ty] && (!CFG.strictTaskCapture || hasTask(st, "claim", ty)) && (await claim(st, ty, out))) {
          got[ty] = 1;
          out.actions.push("领取:" + ty);
        } else if (cur && toInt(cur.done, -1) === 2 && !got[ty] && CFG.strictTaskCapture && !hasTask(st, "claim", ty)) {
          log("⏭️ 上报后可领取但未抓到 get_star(" + ty + ")，跳过");
        }
      }
    }
  } else if (CFG.queryOnly) log("ℹ️ query_only=true，跳过星星动作");
  const f = await qWays(w);
  if (f.ok) {
    out.after = f.star;
    log("⭐ 星星任务后: " + f.star + " (" + diff(out.before, out.after) + ")");
  }
  return out;
}
async function qWays(e) {
  const r = await call(e, "GET");
  if (!r.ok) return { ok: false, err: r.err };
  const j = r.data || {};
  if (toInt(j.code, -1) !== 0) return { ok: false, err: "code=" + j.code + " msg=" + txt(j.msg) };
  const d = j.data || {};
  return { ok: true, star: toInt(d.star_num, -1), list: Array.isArray(d.list) ? d.list : [] };
}
async function claim(st, ty, out) {
  const e = tEp(st, "claim", ty);
  if (!e) return (log("ℹ️ 未抓到 get_star: " + ty), false);
  const r = await call(e, "GET");
  if (!r.ok) return (log("ℹ️ 领取失败: " + ty + " | " + r.err), false);
  const j = r.data || {};
  if (toInt(j.code, -1) !== 0) {
    if (isSignErrCodeMsg(j.code, j.msg)) {
      addSignIssue(out, "get_star(" + ty + ")");
      log("⚠️ 签名模板失效: get_star(" + ty + ") | code=" + toInt(j.code, -1) + " msg=" + txt(j.msg));
      log("📌 请补抓: /user/star/get_star?task_type=" + ty);
    }
    return (log("ℹ️ 领取异常: " + ty + " | code=" + j.code + " msg=" + txt(j.msg)), false);
  }
  log("🎁 已领取: " + ty);
  return true;
}
function auto(t) {
  if (toInt(t.done, -1) !== 0) return false;
  const ty = txt(t.type).toLowerCase();
  const tip = txt(t.tip);
  const btn = txt(t.button_text).toLowerCase();
  return /(\\d+)\\s*秒/.test(tip) || /(watch|view|browse)/.test(ty) || /观看|浏览/.test(tip) || /观看|浏览/.test(btn);
}
function wsec(t) {
  let b = 0;
  const tip = txt(t.tip);
  const ty = txt(t.type).toLowerCase();
  const m = tip.match(/(\\d{1,3})\\s*秒/);
  if (m && m[1]) b = toInt(m[1], 0);
  if (!b && ty.indexOf("watch") >= 0) b = 30;
  if (!b && ty.indexOf("view") >= 0) b = 15;
  if (b <= 0) return 0;
  return Math.min(120, b + rand(CFG.waitMin, CFG.waitMax));
}
function bt(list, ty) {
  const a = Array.isArray(list) ? list : [];
  for (let i = 0; i < a.length; i++) if (txt((a[i] || {}).type) === txt(ty)) return a[i];
  return null;
}
function hasTask(st, kind, ty) {
  const k = "star_" + kind + "_" + sk(ty || "");
  return !!ep(st, k);
}
function taskSet(st, prefix) {
  const set = new Set();
  pref(st, prefix).forEach(function (k) {
    const v = k.slice(prefix.length);
    if (v) set.add(v);
  });
  return set;
}
function tEp(st, kind, ty) {
  const k = "star_" + kind + "_" + sk(ty || "");
  if (ep(st, k)) return ep(st, k);
  if (CFG.strictTaskCapture) return null;
  const ks = pref(st, "star_" + kind + "_");
  if (ks.length === 1) return ep(st, ks[0]);
  return ep(st, "star_" + kind) || null;
}

async function elfFlow(st) {
  const out = { before: -1, after: -1, actions: [] };
  if (!CFG.doElf) return out;
  const me = ep(st, "elf_my_list");
  const oe = ep(st, "elf_overview");
  const fe = ep(st, "elf_get_free_food");
  const ace = adCfgEp(st, "elf");
  let m0 = null;
  if (me) {
    m0 = await qMy(me);
    if (m0.ok) log("🐾 精灵签到: finished=" + m0.fin + " | signedDays=" + m0.days);
  }
  let o0 = null;
  if (oe) {
    o0 = await qOv(oe);
    if (o0.ok) {
      out.before = o0.food;
      log("🧪 精灵概览: food=" + o0.food + " | elfId=" + (o0.elfId || "未返回") + " | starId=" + (o0.starId || "未返回"));
    }
  }
  let ad0 = null;
  if (ace) {
    ad0 = await qAdCfg(ace);
    if (ad0.ok) {
      log("🎬 仙果广告配置: show=" + (ad0.show ? "1" : "0") + " | reward=" + ad0.rewardNum + " | times=" + ad0.rewarded + "/" + ad0.maxTimes + " | watch=" + ad0.watchSec + "s | adId=" + (ad0.adId || "未返回"));
    } else log("ℹ️ 仙果广告配置查询失败: " + ad0.err);
  }
  if (!CFG.queryOnly && m0 && m0.ok && fe && !m0.fin) {
    const r = await call(fe, "GET");
    if (r.ok && toInt((r.data || {}).code, -1) === 0) {
      out.actions.push("领取精灵签到仙果");
      log("🎁 已触发精灵签到仙果领取");
    } else log("ℹ️ 精灵签到仙果领取失败: " + (r.ok ? txt((r.data || {}).msg) : r.err));
  }
  if (!CFG.queryOnly && o0 && o0.ok) {
    if (ad0 && ad0.ok) {
      if (!ad0.show) log("ℹ️ 仙果广告当前不展示");
      else if (ad0.maxTimes > 0 && ad0.rewarded >= ad0.maxTimes) log("ℹ️ 今日仙果广告奖励已达上限");
      else {
        const ar = await adReward(st, "elf");
        if (!ar.hasEp) {
          log("⏭️ 未抓到 /user/ad/reward(ad_palace=elf)，跳过广告仙果奖励");
          log("📌 待补抓广告发奖: watch=" + ad0.watchSec + "s | reward=" + ad0.rewardNum + " | adId=" + (ad0.adId || "未返回"));
        }
        else if (ar.ok) {
          out.actions.push("广告仙果奖励提交");
          log("🎥 广告仙果奖励提交成功" + (ar.msg ? " | " + ar.msg : ""));
        } else log("ℹ️ 广告仙果奖励提交失败: " + ar.err);
      }
    }
    if (o0.elfId && o0.starId) {
      const ae = addEp(st, o0.elfId, o0.starId);
      if (ae) {
        const r = await call(ae, "GET");
        if (r.ok && toInt((r.data || {}).code, -1) === 0) {
          const d = (r.data || {}).data || {};
          const m = txt(d.message || "星星添加成功");
          out.actions.push(m);
          log("⭐ 精灵加星成功: " + m + (d.star_val !== undefined ? " | star_val=" + d.star_val : ""));
        } else log("ℹ️ 精灵加星失败: " + (r.ok ? txt((r.data || {}).msg) : r.err));
      } else log("ℹ️ 未抓到 elf/user_add_stars 端点");
    }
    if (o0.elfId) {
      const fd = feedEp(st, o0.elfId);
      if (fd) {
        if (o0.food > 0) {
          const r = await call(fd, "GET");
          if (r.ok && toInt((r.data || {}).code, -1) === 0) {
            out.actions.push("精灵投喂成功");
            log("🍎 精灵投喂成功");
          } else log("ℹ️ 精灵投喂未成功: " + (r.ok ? txt((r.data || {}).msg) : r.err));
        } else log("ℹ️ 仙果为0，跳过投喂");
      } else log("ℹ️ 未抓到 elf/feed_elf_v2 端点");
    }
  } else if (CFG.queryOnly) log("ℹ️ query_only=true，跳过精灵动作");
  if (oe) {
    const o1 = await qOv(oe);
    if (o1.ok) {
      out.after = o1.food;
      log("🐾 精灵执行后仙果: " + o1.food);
    }
  }
  return out;
}
async function qMy(e) {
  const r = await call(e, "GET");
  if (!r.ok) return { ok: false, err: r.err };
  const j = r.data || {};
  if (toInt(j.code, -1) !== 0) return { ok: false, err: "code=" + j.code + " msg=" + txt(j.msg) };
  const s = (((j.data || {}).sign_in_task) || {});
  const ds = Array.isArray(s.days) ? s.days : [];
  let c = 0;
  for (let i = 0; i < ds.length; i++) if (ds[i] && ds[i].signed) c++;
  return { ok: true, fin: !!s.finished, days: c };
}
async function qAdCfg(e) {
  const m = String(((e.meta || {}).method) || "GET").toUpperCase();
  const r = await call(e, m);
  if (!r.ok) return { ok: false, err: r.err };
  const j = r.data || {};
  if (toInt(j.code, -1) !== 0) return { ok: false, err: "code=" + j.code + " msg=" + txt(j.msg) };
  const d = j.data || {};
  return {
    ok: true,
    show: !!toInt(d.is_show, 0),
    rewardNum: toInt(d.reward_num, 0),
    maxTimes: toInt(d.reward_max_times, 0),
    rewarded: toInt(d.rewarded_times, 0),
    watchSec: toInt(d.reward_watch_time, 0),
    adId: txt(d.reward_ad_id || d.rewardAdId),
  };
}
async function qOv(e) {
  const r = await call(e, "GET");
  if (!r.ok) return { ok: false, err: r.err };
  const j = r.data || {};
  if (toInt(j.code, -1) !== 0) return { ok: false, err: "code=" + j.code + " msg=" + txt(j.msg) };
  const d = j.data || {};
  const l = Array.isArray(d.list) ? d.list : [];
  const f = l[0] || {};
  const sa = Array.isArray(f.starArr) ? f.starArr : [];
  const s0 = sa[0] || {};
  return { ok: true, food: toInt(d.allFood, -1), elfId: txt(f.elfId || f.id), starId: txt(s0.starId) };
}
function addEp(st, elfId, starId) {
  const k = "elf_add_" + sk(elfId) + "_" + sk(starId);
  if (ep(st, k)) return ep(st, k);
  if (CFG.strictTaskCapture) return null;
  const ks = pref(st, "elf_add_");
  return ks.length === 1 ? ep(st, ks[0]) : null;
}
function feedEp(st, elfId) {
  const k = "elf_feed_" + sk(elfId);
  if (ep(st, k)) return ep(st, k);
  if (CFG.strictTaskCapture) return null;
  const ks = pref(st, "elf_feed_");
  return ks.length === 1 ? ep(st, ks[0]) : null;
}
function adCfgEp(st, palace) {
  const k = "ad_cfg_" + sk(palace || "");
  if (ep(st, k)) return ep(st, k);
  if (CFG.strictTaskCapture) return null;
  const ks = pref(st, "ad_cfg_");
  if (ks.length === 1) return ep(st, ks[0]);
  return ep(st, "ad_cfg") || null;
}
function adRewardEp(st, palace) {
  const k = "ad_reward_" + sk(palace || "");
  if (ep(st, k)) return ep(st, k);
  if (CFG.strictTaskCapture) return null;
  const ks = pref(st, "ad_reward_");
  if (ks.length === 1) return ep(st, ks[0]);
  return ep(st, "ad_reward") || null;
}
async function adReward(st, palace) {
  const e = adRewardEp(st, palace);
  if (!e) return { hasEp: false, ok: false, err: "未抓到 /user/ad/reward" };
  const m = String(((e.meta || {}).method) || "POST").toUpperCase();
  const r = await call(e, m);
  if (!r.ok) return { hasEp: true, ok: false, err: r.err };
  const j = r.data || {};
  if (toInt(j.code, -1) !== 0) {
    if (isSignErrCodeMsg(j.code, j.msg)) {
      log("⚠️ 签名模板失效: user/ad/reward(" + palace + ") | code=" + toInt(j.code, -1) + " msg=" + txt(j.msg));
      log("📌 请补抓: /user/ad/reward?ad_palace=" + palace);
    }
    return { hasEp: true, ok: false, err: "code=" + j.code + " msg=" + txt(j.msg) };
  }
  const d = j.data || {};
  const msg = txt(d.msg || d.message || j.msg);
  return { hasEp: true, ok: true, msg: msg };
}

function call(e, m, body) {
  if (!e || !e.url) return Promise.resolve({ ok: false, err: "缺少端点" });
  const req = e.req || {};
  const H = { "User-Agent": req.ua || UA, "Accept-Encoding": "gzip", "Content-Type": req.contentType || "application/json" };
  if (txt(req.authorization)) H.Authorization = req.authorization;
  if (req.s_id) H.s_id = req.s_id;
  if (req.nonce) H.nonce = req.nonce;
  const mm = String(m || ((e.meta || {}).method || "GET")).toUpperCase();
  const o = { url: e.url, headers: H, timeout: 30000 };
  if (mm !== "GET") o.body = body !== undefined ? String(body) : (txt(e.body) ? e.body : "{}");
  const p = mm === "GET" ? $.http.get(o) : $.http.post(o);
  return p
    .then(function (resp) {
      const raw = String((resp && resp.body) || "");
      const j = toJSON(unchunk(raw), null);
      if (!j || typeof j !== "object") return { ok: false, err: "JSON解析失败", raw: raw };
      return { ok: true, data: j };
    })
    .catch(function (err) {
      return { ok: false, err: String(err) };
    });
}

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, Math.max(0, toInt(ms, 0)));
  });
}

function unchunk(s) {
  const t = String(s || "");
  const trim = t.trim();
  if (!trim) return "";
  if (/^[\[{]/.test(trim)) return t;
  const ls = t.split(/\r?\n/);
  let hexCount = 0;
  let joined = "";
  for (let i = 0; i < ls.length; i++) {
    const rawLine = ls[i];
    const line = (rawLine || "").trim();
    if (!line) continue;
    if (/^[0-9a-fA-F]{1,8}$/.test(line)) {
      hexCount++;
      continue;
    }
    joined += rawLine;
  }
  if (hexCount > 0 && /^[\[{]/.test(joined.trim())) return joined;
  if (ls.length >= 3 && /^[0-9a-fA-F]+$/.test((ls[0] || "").trim()) && (ls[ls.length - 1] || "").trim() === "0") return ls.slice(1, -1).join("\n");
  return t;
}
function ep(st, k) {
  return st && st.eps && st.eps[k] ? st.eps[k] : null;
}
function pref(st, p) {
  if (!st || !st.eps) return [];
  return Object.keys(st.eps).filter((k) => k.indexOf(p) === 0).sort();
}
function load() {
  const env = envv("CECE_SIGNIN_STATE_JSON");
  let st = env ? toJSON(env, null) : null;
  if (!st) st = toJSON($.getdata(STORE) || "", {}) || {};
  if (!st.eps || typeof st.eps !== "object") st.eps = {};
  if (!st.eps.sign_index && st.indexUrl) st.eps.sign_index = { url: st.indexUrl, req: { authorization: txt(st.authorization), s_id: txt(st.s_id), nonce: txt(st.nonce), ua: txt(st.ua), contentType: txt(st.contentType) }, meta: { method: "GET" }, body: "" };
  if (!st.eps.user_info && st.info && st.info.url) st.eps.user_info = jclone(st.info);
  if (!st.eps.sign_record && st.record && st.record.url) st.eps.sign_record = jclone(st.record);
  if (!st.eps.auth_refresh) {
    if (st.refresh && st.refresh.url) st.eps.auth_refresh = jclone(st.refresh);
    else if (st.refreshUrl) st.eps.auth_refresh = {
      url: st.refreshUrl,
      req: {
        authorization: "",
        s_id: txt(st.s_id),
        nonce: txt(st.nonce),
        ua: txt(st.ua),
        contentType: txt(st.contentType || "application/json"),
      },
      meta: { method: "POST" },
      body: txt(st.refreshBody) ? st.refreshBody : "{}",
    };
  }
  return st;
}
function save(st) {
  return $.setdata(JSON.stringify(st || {}), STORE);
}

function parseR(o) {
  if (!o || typeof o !== "object") return "";
  const out = [];
  walk(o, out, 0);
  return uniq(out)
    .filter((x) => x && !/^(ok|success|null|undefined)$/i.test(x) && !/^https?:\/\//i.test(x) && !/签到|成功|已签/i.test(x))
    .slice(0, 2)
    .join(" | ");
}
function walk(n, out, d) {
  if (!n || d > 4) return;
  if (typeof n === "string") {
    const t = txt(n);
    if (t && t.length <= 120) out.push(t);
    return;
  }
  if (Array.isArray(n)) return n.forEach((x) => walk(x, out, d + 1));
  if (typeof n !== "object") return;
  Object.keys(n).forEach((k) => {
    const v = n[k];
    if (typeof v === "string" && /(reward|gift|star|coin|coupon|title|desc|content|text|award|name|day|num|奖励|奖品)/i.test(k)) {
      const t = txt(v);
      if (t && t.length <= 120) out.push(t);
    } else walk(v, out, d + 1);
  });
}
function fmtP(p) {
  if (!p || typeof p !== "object") return "";
  const a = [];
  if (p.username) a.push("📝" + p.username);
  if (p.user_id) a.push("👤" + p.user_id);
  if (p.item_id) a.push("🆔" + short(p.item_id, 18));
  return a.join(" | ");
}
function fmtR(s) {
  const r = txt(s || "");
  if (!r) return "";
  if (/奖励名未返回|未知|未返回/i.test(r)) return "";
  if (/^无（?非奖励日）?$/i.test(r)) return "";
  return r;
}
function line(i, p, st, d, r, b, star, ds, hint) {
  let x = "🧾账号" + i;
  if (p) x += "(" + p + ")";
  x += ": " + st;
  if (d >= 0) x += " | 📅连签" + d + "天";
  if (star >= 0) x += " | ⭐" + star + (ds ? "(" + ds + ")" : "");
  if (r) x += " | 🎁" + r;
  if (b) x += " | 🌈" + b;
  if (hint) x += " | ⚠️" + hint;
  return x;
}
function addSignIssue(out, issue) {
  if (!out || !issue) return;
  if (!Array.isArray(out.signIssues)) out.signIssues = [];
  const s = txt(issue);
  if (!s) return;
  if (out.signIssues.indexOf(s) >= 0) return;
  out.signIssues.push(s);
}
function starIssueHint(arr) {
  if (!Array.isArray(arr) || !arr.length) return "";
  return short("补抓:" + arr.join("、"), 64);
}
function isSignErrCodeMsg(code, msg) {
  const c = toInt(code, -1);
  const m = txt(msg || "").toLowerCase();
  return c === 1001 || m.indexOf("签名") >= 0 || m.indexOf("signature") >= 0 || m.indexOf("sign error") >= 0;
}
function isSignErrText(err) {
  const s = txt(err || "").toLowerCase();
  return s.indexOf("code=1001") >= 0 || s.indexOf("签名") >= 0 || s.indexOf("signature") >= 0 || s.indexOf("sign error") >= 0;
}
function subline(lines) {
  const f = String(lines[0] || "");
  const s = f.indexOf("✅") >= 0 ? "✅" : f.indexOf("❌") >= 0 ? "❌" : f.indexOf("⚠️") >= 0 ? "⚠️" : "📌";
  const m = f.match(/\(([^)]+)\)/);
  let out = s + " " + (m && m[1] ? m[1] : "测测任务");
  if (lines.length > 1) out += " | +" + (lines.length - 1) + "账号";
  return out;
}
function pday(n) { return n >= 0 ? n + "天" : "未返回"; }
function pval(n) { return n >= 0 ? String(n) : "未返回"; }
function diff(a, b) { if (a < 0 || b < 0) return ""; const d = b - a; return d > 0 ? "+" + d : String(d); }
function txt(v) { return String(v || "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }
function toInt(v, d) { const n = parseInt(String(v), 10); return isNaN(n) ? d : n; }
function sk(v) { const s = String(v || "").trim().toLowerCase(); return s ? s.replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") : "none"; }
function short(v, n) { const s = String(v || ""); return !n || s.length <= n ? s : s.slice(0, n) + "..."; }
function splitChunks(v, n) {
  const s = String(v || "");
  const max = toInt(n, 240);
  if (!s) return [];
  if (s.length <= max) return [s];
  const out = [];
  for (let i = 0; i < s.length; i += max) out.push(s.slice(i, i + max));
  return out;
}
function logLong(label, value, n) {
  const arr = splitChunks(value, n || 220);
  if (!arr.length) return;
  if (arr.length === 1) return log(label + ": " + arr[0]);
  for (let i = 0; i < arr.length; i++) {
    log(label + " (" + (i + 1) + "/" + arr.length + "): " + arr[i]);
  }
}
function msgLong(title, subtitle, value, n) {
  const s = String(value || "");
  $.msg(title, subtitle, s);
}
function captureClientName() {
  if ($.isQuanX()) return "QX";
  if ($.isLoon()) return "Loon";
  if ($.isSurge()) return "Surge";
  return "Node";
}
function captureGuideByClient() {
  if ($.isQuanX()) return CAPTURE_QX;
  if ($.isLoon()) return CAPTURE_LOON;
  if ($.isSurge()) return CAPTURE_SURGE;
  return "QX:\n" + CAPTURE_QX + "\n\nLoon:\n" + CAPTURE_LOON + "\n\nSurge:\n" + CAPTURE_SURGE;
}
function notifyCapture(key, req, url, body, refreshExp) {
  const lines = [];
  lines.push("key=" + key);
  lines.push("url=" + String(url || ""));
  if (req && req.nonce) lines.push("nonce=" + req.nonce);
  if (req && req.s_id) lines.push("s_id=" + req.s_id);
  if (req && req.authorization) lines.push("authorization=" + req.authorization);
  if (body) lines.push("body=" + body);
  if (refreshExp) lines.push("refresh_exp=" + refreshExp);
  msgLong($.name, "抓包字段已更新", lines.join("\n"), 260);
}
function normH(h) { const o = {}; Object.keys(h || {}).forEach((k) => (o[String(k).toLowerCase()] = String(h[k] || ""))); return o; }
function parseArg(s) { const o = {}; if (!s) return o; String(s).split("&").forEach((seg) => { if (!seg) return; const i = seg.indexOf("="); const k = i >= 0 ? seg.slice(0, i) : seg; const v = i >= 0 ? seg.slice(i + 1) : ""; if (!k) return; o[ud(k)] = ud(v.replace(/\+/g, "%20")); }); return o; }
function ud(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }
function toBool(v, d) { if (v === undefined || v === null || v === "") return !!d; const s = String(v).toLowerCase(); if (s === "1" || s === "true" || s === "yes" || s === "on") return true; if (s === "0" || s === "false" || s === "no" || s === "off") return false; return !!d; }
function toJSON(s, d) { if (!s || typeof s !== "string") return d; try { return JSON.parse(s); } catch (e) { return d; } }
function getRefreshToken(st) {
  if (!st) return "";
  const e = ep(st, "auth_refresh");
  const jb = toJSON(e && txt(e.body) ? e.body : "{}", {});
  if (txt(jb.refresh_token)) return txt(jb.refresh_token);
  if (txt(st.refresh_token)) return txt(st.refresh_token);
  return "";
}
function jwtPayload(v) {
  const tok = txt(v).replace(/^Bearer\s+/i, "");
  const arr = tok.split(".");
  if (arr.length < 2) return null;
  let b = arr[1].replace(/-/g, "+").replace(/_/g, "/");
  while (b.length % 4) b += "=";
  let raw = "";
  try {
    if (typeof atob === "function") raw = atob(b);
  } catch (e) { }
  if (!raw) {
    try {
      if (typeof Buffer !== "undefined") raw = Buffer.from(b, "base64").toString("utf8");
    } catch (e) { }
  }
  return toJSON(raw, null);
}
function jwtExp(v) {
  const p = jwtPayload(v);
  return p && p.exp ? toInt(p.exp, -1) : -1;
}
function iso(sec) {
  const n = toInt(sec, -1);
  if (n <= 0) return "未解析";
  try { return new Date(n * 1000).toISOString(); } catch (e) { return String(n); }
}
function jclone(o) { return toJSON(JSON.stringify(o || {}), {}); }
function uniq(a) { const o = []; const m = {}; (a || []).forEach((x) => { const k = String(x || ""); if (!k || m[k]) return; m[k] = 1; o.push(k); }); return o; }
function envv(n) { try { return typeof process !== "undefined" && process.env ? process.env[n] || "" : ""; } catch (e) { return ""; } }
function now() { const d = new Date(); return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()) + " " + p2(d.getHours()) + ":" + p2(d.getMinutes()) + ":" + p2(d.getSeconds()); }
function p2(n) { return n < 10 ? "0" + n : String(n); }
function rand(a, b) { const x = toInt(a, 0), y = toInt(b, 0); if (y <= x) return x; return x + Math.floor(Math.random() * (y - x + 1)); }
function log(s) {
  const l = "[" + now() + "] " + s;
  if ($ && typeof $.log === "function") $.log(l);
  else console.log(l);
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
    get: function (opts) { return self._request("GET", opts); },
    post: function (opts) { return self._request("POST", opts); },
  };
}
Env.prototype.isNode = function () { return typeof module !== "undefined" && !!module.exports; };
Env.prototype.isQuanX = function () { return typeof $task !== "undefined"; };
Env.prototype.isSurge = function () { return typeof $httpClient !== "undefined" && typeof $loon === "undefined"; };
Env.prototype.isLoon = function () { return typeof $loon !== "undefined"; };
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
  const t = fs.existsSync(p1) ? p1 : fs.existsSync(p2) ? p2 : "";
  if (!t) return {};
  try {
    return JSON.parse(fs.readFileSync(t));
  } catch (e) {
    return {};
  }
};
Env.prototype.writedata = function () {
  if (!this.isNode()) return;
  const fs = require("fs");
  const path = require("path");
  fs.writeFileSync(path.resolve(this.dataFile), JSON.stringify(this.data, null, 2));
};
Env.prototype.msg = function (title, subtitle, body, opts) {
  if (this.isSurge() || this.isLoon()) $notification.post(title, subtitle, body, opts);
  else if (this.isQuanX()) $notify(title, subtitle, body, opts);
  else console.log(["", "==============系统通知==============", title, subtitle || "", body || ""].join("\n"));
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
  const sec = (Date.now() - this.startTime) / 1000;
  this.log("[" + now() + "] " + this.name + " 结束, 耗时 " + sec.toFixed(3) + " 秒");
  if (this.isSurge() || this.isQuanX() || this.isLoon()) $done(val || {});
};
Env.prototype._request = function (method, opts) {
  const self = this;
  return new Promise(function (resolve, reject) {
    const req = typeof opts === "string" ? { url: opts } : opts || {};
    const timeout = toInt(req.timeout, 30000);
    if (self.isQuanX()) {
      const q = { url: req.url, method: method, headers: req.headers || {} };
      if (method !== "GET" && req.body !== undefined) q.body = req.body;
      return $task.fetch(q)
        .then(function (r) {
          resolve({ status: r.statusCode, statusCode: r.statusCode, headers: r.headers, body: r.body });
        })
        .catch(reject);
    }
    if (self.isSurge() || self.isLoon()) {
      const s = { url: req.url, headers: req.headers || {}, timeout: timeout / 1000 };
      if (method !== "GET" && req.body !== undefined) s.body = req.body;
      const cb = function (err, resp, body) {
        if (err) reject(err);
        else {
          resp.body = body;
          resp.statusCode = resp.status;
          resolve(resp);
        }
      };
      return method === "GET" ? $httpClient.get(s, cb) : $httpClient.post(s, cb);
    }
    if (self.isNode()) {
      const fetchFn = global.fetch;
      if (!fetchFn) return reject(new Error("Node 环境未找到 fetch"));
      const c = typeof AbortController !== "undefined" ? new AbortController() : null;
      let timer = null;
      if (c) timer = setTimeout(function () { c.abort(); }, timeout);
      const fo = { method: method, headers: req.headers || {} };
      if (method !== "GET" && req.body !== undefined) fo.body = req.body;
      if (c) fo.signal = c.signal;
      return fetchFn(req.url, fo)
        .then(function (resp) {
          return resp.text().then(function (body) {
            if (timer) clearTimeout(timer);
            resolve({ status: resp.status, statusCode: resp.status, headers: resp.headers, body: body });
          });
        })
        .catch(function (e) {
          if (timer) clearTimeout(timer);
          reject(e);
        });
    }
    reject(new Error("Unknown runtime"));
  });
};




