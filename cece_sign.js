/*
测测签到+任务（QX/Surge/Loon/Node）
[rewrite_local]
^https:\/\/api\.cece\.com\/user\/auth\/refresh_token(?:\?.*)?$ url script-request-body cece_sign.js
[mitm]
hostname = api.cece.com
*/
const $ = new Env("测测签到");
const VER = "v1.2.1";
const STORE = "cece_task_state_v1";
const CAPTURE = String.raw`[rewrite_local]
^https:\/\/api\.cece\.com\/user\/auth\/refresh_token(?:\?.*)?$ url script-request-body cece_sign.js
[mitm]
hostname = api.cece.com`;
const arg = parseArg(typeof $argument === "string" ? $argument : "");
const CFG = {
  queryOnly: toBool(arg.query_only, false),
  doStar: toBool(arg.do_star_tasks, true),
  doElf: toBool(arg.do_elf_tasks, true),
  strictTaskCapture: toBool(arg.strict_task_capture, true),
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
    log("🚀 启动 " + VER + " | query_only=" + CFG.queryOnly + " | doStar=" + CFG.doStar + " | doElf=" + CFG.doElf + " | strictTaskCapture=" + CFG.strictTaskCapture);
    if (typeof $request !== "undefined") return capReq();
    const st = load();
    const s = ep(st, "sign_index");
    if (!s) {
      log("❌ 缺少 sign_index");
      log("📋 抓包配置:\n" + CAPTURE);
      $.msg($.name, "未获取到抓包字段", "请先进入签到页触发抓包");
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
  if (d.key !== "auth_refresh" && !req.authorization) return $.msg($.name, "抓包失败", "未找到 Authorization");
  const st = load();
  if (!st.eps || typeof st.eps !== "object") st.eps = {};
  st.eps[d.key] = { url: url, req: req, body: body || "", meta: { method: d.method, task: d.task || "", uri: d.uri || "", elfId: d.elfId || "", starId: d.starId || "" }, t: Date.now() };
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
  save(st);
  log("✅ 抓包更新: " + d.key + " | " + short(url, 120));
  if (d.key === "auth_refresh") {
    const jb = toJSON(body || "", {});
    const rt = txt(jb.refresh_token);
    const exp = jwtExp(rt);
    const expStr = exp > 0 ? iso(exp) : "未解析";
    $.msg($.name, "抓包字段已更新", d.key + " | refresh_exp=" + expStr);
  } else $.msg($.name, "抓包字段已更新", d.key);
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
  summaries.push(line(i, fmtP(p), stat, s.cycle >= 0 ? s.cycle : s.actual, rw, b.text ? short(b.text, 24) : "", fs, ds));
}

async function ensureAuth(st, reason) {
  const s = ep(st, "sign_index");
  if (!s || !s.req) return false;
  const auth = txt((s.req || {}).authorization);
  const rt = getRefreshToken(st);
  if (!auth) {
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
  const jb = toJSON(txt(e.body) ? e.body : "{}", {});
  const rt = txt(jb.refresh_token || getRefreshToken(st));
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
  try {
    const eb = toJSON(txt(e.body) ? e.body : "{}", {});
    eb.refresh_token = nrt;
    e.body = JSON.stringify(eb);
  } catch (x) {
    e.body = JSON.stringify({ refresh_token: nrt });
  }
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
  const out = { before: -1, after: -1, actions: [] };
  if (!CFG.doStar) return out;
  const w = ep(st, "star_ways");
  if (!w) return (log("ℹ️ 未抓到 star/ways"), out);
  const rs = taskSet(st, "star_report_");
  const cs = taskSet(st, "star_claim_");
  const rsTxt = rs.size ? Array.from(rs).sort().join(",") : "无";
  const csTxt = cs.size ? Array.from(cs).sort().join(",") : "无";
  log("🧩 星星任务白名单 | report=" + rsTxt + " | claim=" + csTxt + (CFG.strictTaskCapture ? " | strict=on" : " | strict=off"));
  let s = await qWays(w);
  if (!s.ok) return (log("ℹ️ star/ways失败: " + s.err), out);
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
    if (await claim(st, ty)) {
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
        log("ℹ️ 上报失败: " + ty + " | " + (rr.ok ? txt((rr.data || {}).msg) : rr.err));
        continue;
      }
      out.actions.push("上报:" + ty);
      log("✅ 已上报: " + ty);
      const rf = await qWays(w);
      if (rf.ok) {
        s = rf;
        const cur = bt(s.list, ty);
        if (cur && toInt(cur.done, -1) === 2 && !got[ty] && (!CFG.strictTaskCapture || hasTask(st, "claim", ty)) && (await claim(st, ty))) {
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
async function claim(st, ty) {
  const e = tEp(st, "claim", ty);
  if (!e) return (log("ℹ️ 未抓到 get_star: " + ty), false);
  const r = await call(e, "GET");
  if (!r.ok) return (log("ℹ️ 领取失败: " + ty + " | " + r.err), false);
  const j = r.data || {};
  if (toInt(j.code, -1) !== 0) return (log("ℹ️ 领取异常: " + ty + " | code=" + j.code + " msg=" + txt(j.msg)), false);
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
  if (!CFG.queryOnly && m0 && m0.ok && fe && !m0.fin) {
    const r = await call(fe, "GET");
    if (r.ok && toInt((r.data || {}).code, -1) === 0) {
      out.actions.push("领取精灵签到仙果");
      log("🎁 已触发精灵签到仙果领取");
    } else log("ℹ️ 精灵签到仙果领取失败: " + (r.ok ? txt((r.data || {}).msg) : r.err));
  }
  if (!CFG.queryOnly && o0 && o0.ok) {
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

function call(e, m, body) {
  if (!e || !e.url) return Promise.resolve({ ok: false, err: "缺少端点" });
  const req = e.req || {};
  const H = { "User-Agent": req.ua || UA, Authorization: req.authorization || "", "Accept-Encoding": "gzip", "Content-Type": req.contentType || "application/json" };
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
function line(i, p, st, d, r, b, star, ds) {
  let x = "🧾账号" + i;
  if (p) x += "(" + p + ")";
  x += ": " + st;
  if (d >= 0) x += " | 📅连签" + d + "天";
  if (star >= 0) x += " | ⭐" + star + (ds ? "(" + ds + ")" : "");
  if (r) x += " | 🎁" + r;
  if (b) x += " | 🌈" + b;
  return x;
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
function normH(h) { const o = {}; Object.keys(h || {}).forEach((k) => (o[String(k).toLowerCase()] = String(h[k] || ""))); return o; }
function parseArg(s) { const o = {}; if (!s) return o; String(s).split("&").forEach((seg) => { if (!seg) return; const i = seg.indexOf("="); const k = i >= 0 ? seg.slice(0, i) : seg; const v = i >= 0 ? seg.slice(i + 1) : ""; if (!k) return; o[ud(k)] = ud(v.replace(/\+/g, "%20")); }); return o; }
function ud(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }
function toBool(v, d) { if (v === undefined || v === null || v === "") return !!d; const s = String(v).toLowerCase(); if (s === "1" || s === "true" || s === "yes" || s === "on") return true; if (s === "0" || s === "false" || s === "no" || s === "off") return false; return !!d; }
function toJSON(s, d) { if (!s || typeof s !== "string") return d; try { return JSON.parse(s); } catch (e) { return d; } }
function getRefreshToken(st) {
  if (!st) return "";
  if (txt(st.refresh_token)) return txt(st.refresh_token);
  const e = ep(st, "auth_refresh");
  const jb = toJSON(e && txt(e.body) ? e.body : "{}", {});
  return txt(jb.refresh_token);
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
