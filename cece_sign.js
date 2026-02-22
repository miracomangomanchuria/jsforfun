/*
测测转盘脚本（QX / Surge / Loon / Node）

抓包说明（QX，简版）：
[rewrite_local]
# 首选：查询接口（推荐）
^https:\/\/api\.cece\.com\/activity\/Activity\/getuserId(?:\?.*)?$               url script-request-header cece_sign.js
^https:\/\/api\.cece\.com\/user\/star_draw_v2\/lottery_list(?:\?.*)?$            url script-request-header cece_sign.js
^https:\/\/api\.cece\.com\/user\/star_draw_v2\/luck_user_list(?:\?.*)?$          url script-request-header cece_sign.js
# 可选兜底：仅在首选接口抓不到时临时开启
# ^https:\/\/api\.cece\.com\/user\/star_draw_v2\/luck_draw(?:\?.*)?$              url script-request-header cece_sign.js
[mitm]
hostname = api.cece.com

使用说明：
1) 优先在“查询状态页”触发一次请求，脚本会自动保存 Cookie / UA / 关键头字段。
2) 再跑定时任务执行：先查状态，再决定是否抽奖。
3) 支持参数 query_only=true（只查询不抽奖）。
*/

const $ = new Env('测测转盘');
const VERSION = 'v1.0.1';

const STORE = {
  cookieKey: 'cece_turntable_cookie_v1',
  uaKey: 'cece_turntable_ua_v1',
  originKey: 'cece_turntable_origin_v1',
  refererKey: 'cece_turntable_referer_v1',
  authKey: 'cece_turntable_auth_v1',
  apikeyKey: 'cece_turntable_apikey_v1',
  sidKey: 'cece_turntable_sid_v1',
  secretKeyKey: 'cece_turntable_secret_key_v1',
};

const API_BASE = 'https://api.cece.com';
const API = {
  userInfo: '/activity/Activity/getuserId',
  lotteryList: '/user/star_draw_v2/lottery_list',
  luckUserList: '/user/star_draw_v2/luck_user_list',
  draw: '/user/star_draw_v2/luck_draw',
  myLotteryList: '/user/star_draw_v2/my_lottery_list',
};

const CAPTURE_ENDPOINTS = [
  { path: API.userInfo, label: '👤 用户查询接口', preferred: true },
  { path: API.lotteryList, label: '📅 状态查询接口', preferred: true },
  { path: API.luckUserList, label: '🧾 中奖记录查询接口', preferred: true },
  { path: API.draw, label: '⚠️ 非首选抽奖接口(兜底)', preferred: false },
  { path: API.myLotteryList, label: '⚠️ 非首选我的奖品接口(兜底)', preferred: false },
];

const DEFAULTS = {
  ua:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  origin: 'https://m.cece.com',
  referer: 'https://m.cece.com/check_turntable',
  agent: 'ios.cc',
  timeoutMs: 20000,
  poolMax: 10,
};

const CAPTURE_CONFIG_TEXT = String.raw`[rewrite_local]
# 首选：查询接口（推荐）
^https:\/\/api\.cece\.com\/activity\/Activity\/getuserId(?:\?.*)?$               url script-request-header cece_sign.js
^https:\/\/api\.cece\.com\/user\/star_draw_v2\/lottery_list(?:\?.*)?$            url script-request-header cece_sign.js
^https:\/\/api\.cece\.com\/user\/star_draw_v2\/luck_user_list(?:\?.*)?$          url script-request-header cece_sign.js
# 可选兜底：仅在首选接口抓不到时临时开启
# ^https:\/\/api\.cece\.com\/user\/star_draw_v2\/luck_draw(?:\?.*)?$              url script-request-header cece_sign.js
[mitm]
hostname = api.cece.com`;

const RUN_ARGS = parseArgs(resolveRunArgString());
const QUERY_ONLY = toBool(RUN_ARGS.query_only || RUN_ARGS.queryOnly || RUN_ARGS.dry_run);
const RUN_AGENT = RUN_ARGS.agent || DEFAULTS.agent;
const RUN_POOL_MAX = parseIntSafe(RUN_ARGS.pool_max || RUN_ARGS.poolMax, DEFAULTS.poolMax);

const summaries = [];

async function main() {
  logLine('==========');
  logLine('🚀 启动 | 版本: ' + VERSION);

  if (typeof $request !== 'undefined') {
    captureSession();
    return;
  }

  const runtime = loadRuntime();
  if (!runtime.cookies.length) {
    logLine('📋 QX 抓包配置（可整段复制）:\n' + CAPTURE_CONFIG_TEXT);
    $.msg($.name, '未获取到会话', '请先打开活动页抓包一次');
    return;
  }

  for (let i = 0; i < runtime.cookies.length; i++) {
    await runOneAccount(runtime.cookies[i], runtime, i + 1, runtime.cookies.length);
  }
  notifyFinal();
}

function captureSession() {
  const reqUrl = ($request && $request.url) || '';
  const captureHit = matchCaptureEndpoint(reqUrl);
  if (!captureHit) return;
  logLine('🎯 抓包来源: ' + captureHit.label + ' | ' + captureHit.path);
  if (!captureHit.preferred) logLine('⚠️ 当前命中非首选接口，仅作为兜底抓包来源');

  const h = normalizeHeaders(($request && $request.headers) || {});
  const cookie = h.cookie || '';
  if (!cookie) {
    $.msg($.name, '抓包失败', '请求头中未找到 Cookie');
    return;
  }

  const ua = h['user-agent'] || '';
  const origin = h.origin || '';
  const referer = h.referer || '';
  const authorization = h.authorization || '';
  const apikey = h.apikey || '';
  const sid = h.s_id || '';
  const secretKey = h['secret-key'] || '';

  const changedParts = [];
  const cookieRet = saveCookie(cookie);
  if (cookieRet.changed) changedParts.push('Cookie');
  if (saveValueIfChanged(STORE.uaKey, ua).changed) changedParts.push('UA');
  if (saveValueIfChanged(STORE.originKey, origin).changed) changedParts.push('Origin');
  if (saveValueIfChanged(STORE.refererKey, referer).changed) changedParts.push('Referer');
  if (saveValueIfChanged(STORE.authKey, authorization).changed) changedParts.push('Authorization');
  if (saveValueIfChanged(STORE.apikeyKey, apikey).changed) changedParts.push('Apikey');
  if (saveValueIfChanged(STORE.sidKey, sid).changed) changedParts.push('s_id');
  if (saveValueIfChanged(STORE.secretKeyKey, secretKey).changed) changedParts.push('secret-key');

  const normalizedCookie = cookieRet.newCookie || normalizeCookie(cookie);
  const who = getAccountHintFromCookie(normalizedCookie);
  const cookieFieldsText = formatCookiePairs(normalizedCookie);
  const headerFieldsText = formatHeaderFields({
    ua,
    origin,
    referer,
    authorization,
    apikey,
    sid,
    secretKey,
  });

  if (!changedParts.length) {
    logLine('ℹ️ 抓包字段无变化，跳过写入与通知');
    logLine('👤 账号: ' + who);
    logLine('🧭 接口: ' + captureHit.path);
    logLine('🍪 Cookie字段(全量): ' + (cookieFieldsText || '无'));
    if (headerFieldsText) logLine('🧩 头字段(全量): ' + headerFieldsText);
    return;
  }

  logLine('✅ 抓包字段已更新: ' + changedParts.join(' / '));
  logLine('👤 账号: ' + who);
  logLine('🧭 接口: ' + captureHit.path);
  logLine('🍪 Cookie字段(全量): ' + (cookieFieldsText || '无'));
  if (headerFieldsText) logLine('🧩 头字段(全量): ' + headerFieldsText);

  const lines = [];
  lines.push('变更项: ' + changedParts.join(' / '));
  lines.push('抓包来源: ' + captureHit.path);
  lines.push('账号: ' + who);
  lines.push('Cookie字段(全量): ' + (cookieFieldsText || '无'));
  if (headerFieldsText) lines.push('头字段(全量): ' + headerFieldsText);
  $.msg($.name, '抓包字段已更新', lines.join('\n'));
}

function matchCaptureEndpoint(url) {
  const m = /^https:\/\/api\.cece\.com(\/[^?#]*)/.exec(url || '');
  if (!m || !m[1]) return null;
  const path = m[1];
  for (let i = 0; i < CAPTURE_ENDPOINTS.length; i++) {
    if (CAPTURE_ENDPOINTS[i].path === path) return CAPTURE_ENDPOINTS[i];
  }
  return null;
}

function saveCookie(cookie) {
  const normalized = normalizeCookie(cookie);
  const oldRaw = ($.getdata(STORE.cookieKey) || '').trim();
  const oldList = splitCookieList(oldRaw);
  const id = getCookieIdentity(normalized);
  const newSig = cookieSignature(normalized);
  let existed = false;
  let changed = false;
  const next = [];
  let oldCookie = '';

  for (let i = 0; i < oldList.length; i++) {
    const item = normalizeCookie(oldList[i]);
    if (getCookieIdentity(item) === id) {
      existed = true;
      oldCookie = item;
      if (cookieSignature(item) === newSig) {
        next.push(item);
      } else {
        next.push(normalized);
        changed = true;
      }
    } else {
      next.push(item);
    }
  }
  if (!existed) {
    next.push(normalized);
    changed = true;
  }
  if (changed) $.setdata(next.join('\n'), STORE.cookieKey);
  return { changed, oldCookie, newCookie: normalized, accountId: id };
}

function saveValueIfChanged(key, val) {
  const newVal = (val || '').trim();
  if (!newVal) return { changed: false, skipped: true };
  const oldVal = ($.getdata(key) || '').trim();
  if (oldVal === newVal) return { changed: false };
  $.setdata(newVal, key);
  return { changed: true };
}

function loadRuntime() {
  const envCookie = getEnvAny([
    'CECE_TURNTABLE_COOKIE',
    'cece_turntable_cookie',
    'CECE_SIGN_COOKIE',
    'cece_sign_cookie',
    'CECE_COOKIE',
    'cece_cookie',
  ]);
  const rawCookies = (envCookie || $.getdata(STORE.cookieKey) || '').trim();
  const cookies = splitCookieList(rawCookies);
  return {
    cookies,
    ua: (getEnvAny(['CECE_TURNTABLE_UA']) || $.getdata(STORE.uaKey) || DEFAULTS.ua).trim(),
    origin: (getEnvAny(['CECE_TURNTABLE_ORIGIN']) || $.getdata(STORE.originKey) || DEFAULTS.origin).trim(),
    referer: (getEnvAny(['CECE_TURNTABLE_REFERER']) || $.getdata(STORE.refererKey) || DEFAULTS.referer).trim(),
    authorization: (getEnvAny(['CECE_TURNTABLE_AUTH']) || $.getdata(STORE.authKey) || '').trim(),
    apikey: (getEnvAny(['CECE_TURNTABLE_APIKEY']) || $.getdata(STORE.apikeyKey) || '').trim(),
    sid: (getEnvAny(['CECE_TURNTABLE_SID']) || $.getdata(STORE.sidKey) || '').trim(),
    secretKey: (getEnvAny(['CECE_TURNTABLE_SECRET_KEY']) || $.getdata(STORE.secretKeyKey) || '').trim(),
  };
}

async function runOneAccount(cookie, runtime, idx, total) {
  logLine('');
  logLine('==========');
  logLine('🧾 账号 ' + idx + '/' + total);

  const summary = {
    ok: false,
    profile: {},
    decision: '',
    category: '',
    progress: '',
    reward: '',
    detail: '',
  };

  const headers = buildHeaders(cookie, runtime);
  logLine('👤 账号标识: ' + getAccountHintFromCookie(cookie));

  const userRes = await getJson(API.userInfo, headers, null);
  if (!userRes.ok) {
    summary.category = 'network_error';
    summary.decision = 'query_user_failed';
    summary.detail = userRes.error;
    logLine('❌ 用户查询失败: ' + userRes.error);
    summaries.push(summary);
    return;
  }

  const userCode = userRes.data.code;
  const userMsg = toStr(userRes.data.msg);
  if (userCode !== 0) {
    summary.category = classifyError(userCode, userMsg);
    summary.decision = 'query_user_failed';
    summary.detail = 'code=' + userCode + ' msg=' + (userMsg || '空');
    logLine('❌ 用户状态异常: ' + summary.detail);
    summaries.push(summary);
    return;
  }

  const ud = userRes.data.data || {};
  const userId = RUN_ARGS.user_id || ud.userId || '';
  summary.profile.userId = userId;
  summary.profile.username = ud.username || '';
  summary.profile.dataId = ud.dataId || '';
  logLine('👤 账号信息: ' + renderProfile(summary.profile));

  if (!userId) {
    summary.category = 'state_undecidable';
    summary.decision = 'query_user_no_userid';
    summary.detail = '未返回userId';
    logLine('❌ 未获取到 userId，停止执行');
    summaries.push(summary);
    return;
  }

  const stateRes = await getJson(API.lotteryList, headers, null);
  if (!stateRes.ok) {
    summary.category = 'network_error';
    summary.decision = 'query_state_failed';
    summary.detail = stateRes.error;
    logLine('❌ 状态查询失败: ' + stateRes.error);
    summaries.push(summary);
    return;
  }

  const sCode = stateRes.data.code;
  const sMsg = toStr(stateRes.data.msg);
  if (sCode !== 0) {
    summary.category = classifyError(sCode, sMsg);
    summary.decision = 'query_state_failed';
    summary.detail = 'code=' + sCode + ' msg=' + (sMsg || '空');
    logLine('❌ 状态查询异常: ' + summary.detail);
    summaries.push(summary);
    return;
  }

  const sData = stateRes.data.data || {};
  const info = sData.info || {};
  const myStars = parseIntSafe(info.myStars, 0);
  const consumeStar = parseIntSafe(info.consumeStar, 0);
  summary.progress = '星星' + myStars + ' / 单次' + consumeStar;
  logLine('📅 当前小星星: ' + myStars + ' | 🎯 单次消耗: ' + consumeStar);

  const pool = summarizePrizePool(sData.list || {}, RUN_POOL_MAX);
  if (pool.length) {
    logLine('🎁 奖池样本(' + pool.length + '条):');
    for (let i = 0; i < pool.length; i++) logLine('  - ' + pool[i]);
  }

  if (QUERY_ONLY) {
    summary.ok = true;
    summary.category = 'ok';
    summary.decision = 'query_only';
    summary.detail = '仅查询';
    logLine('🧭 query_only 模式，停止在状态查询');
    summaries.push(summary);
    return;
  }

  if (myStars < consumeStar) {
    summary.ok = true;
    summary.category = 'state_ok_no_action';
    summary.decision = 'insufficient_stars_stop';
    summary.detail = '小星星不足';
    logLine('ℹ️ 小星星不足，停止抽奖请求');
    summaries.push(summary);
    return;
  }

  const drawRes = await getJson(API.draw, headers, { agent: RUN_AGENT, user_id: userId });
  if (!drawRes.ok) {
    summary.category = 'network_error';
    summary.decision = 'draw_network_error';
    summary.detail = drawRes.error;
    logLine('❌ 抽奖请求失败: ' + drawRes.error);
    summaries.push(summary);
    return;
  }

  const dCode = drawRes.data.code;
  const dMsg = toStr(drawRes.data.msg);
  if (dCode !== 0) {
    summary.category = classifyError(dCode, dMsg);
    summary.decision = 'draw_rejected';
    summary.detail = 'code=' + dCode + ' msg=' + (dMsg || '空');
    logLine('❌ 抽奖失败: ' + summary.detail);
    summaries.push(summary);
    return;
  }

  const dd = drawRes.data.data || {};
  summary.ok = true;
  summary.category = 'ok';
  summary.decision = 'draw_success';
  summary.reward = cleanHtmlText(dd.name || '');
  summary.detail = 'luckId=' + (dd.luckId || '');
  logLine('✅ 抽奖成功: ' + (summary.reward || '奖励名未返回') + ' (' + (dd.luckId || '无luckId') + ')');

  const rec = await getJson(API.myLotteryList, headers, { agent: RUN_AGENT, page: 1 });
  if (rec.ok && rec.data && rec.data.code === 0 && isArray(rec.data.data) && rec.data.data.length) {
    const top = rec.data.data[0] || {};
    logLine('🧾 最近奖品: ' + cleanHtmlText(top.name || '未返回') + ' | 时间: ' + (top.dateTime || '未返回'));
  }
  summaries.push(summary);
}

function buildHeaders(cookie, runtime) {
  const h = {
    Accept: 'application/json, text/plain, */*',
    Origin: runtime.origin || DEFAULTS.origin,
    Referer: runtime.referer || DEFAULTS.referer,
    'User-Agent': runtime.ua || DEFAULTS.ua,
    Cookie: cookie,
  };
  if (runtime.authorization) h.Authorization = runtime.authorization;
  if (runtime.apikey) h.Apikey = runtime.apikey;
  if (runtime.sid) h.s_id = runtime.sid;
  if (runtime.secretKey) h['secret-key'] = runtime.secretKey;
  return h;
}

async function getJson(path, headers, queryObj) {
  const url = appendQuery(API_BASE + path, queryObj || null);
  try {
    const resp = await $.http.get({ url, headers, timeout: DEFAULTS.timeoutMs });
    const body = resp && (resp.body || resp);
    const data = safeJSON(body);
    if (!data) return { ok: false, error: 'JSON解析失败' };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

function notifyFinal() {
  if (!summaries.length) return;
  const lines = [];
  for (let i = 0; i < summaries.length; i++) {
    const s = summaries[i];
    const profileText = renderProfile(s.profile || {});
    let line = '账号' + (i + 1) + '(' + (profileText || '无账号信息') + '): ' + pickStatusEmoji(s) + renderDecisionText(s);
    if (s.progress) line += ' | 📅' + s.progress;
    if (s.reward) line += ' | 🎁' + s.reward;
    lines.push(line);
  }
  let subtitle = '🧭 ' + (QUERY_ONLY ? '仅查询模式' : '状态优先执行');
  if (summaries.length === 1 && summaries[0].profile) subtitle = renderProfile(summaries[0].profile) || subtitle;
  $.msg($.name, subtitle, lines.join('\n'));
}

function renderDecisionText(s) {
  if (s.decision === 'query_only') return '仅查询';
  if (s.decision === 'insufficient_stars_stop') return '小星星不足，未抽奖';
  if (s.decision === 'draw_success') return '抽奖成功';
  if (s.decision === 'draw_rejected') return '抽奖失败(' + (s.category || 'unknown') + ')';
  if (s.decision === 'query_state_failed') return '状态查询失败(' + (s.category || 'unknown') + ')';
  if (s.decision === 'query_user_failed') return '用户状态失败(' + (s.category || 'unknown') + ')';
  if (s.decision === 'draw_network_error') return '抽奖网络错误';
  if (s.decision === 'query_user_no_userid') return '未获取到userId';
  return s.detail || '执行完成';
}

function pickStatusEmoji(s) {
  if (s.ok && s.decision === 'draw_success') return '✅';
  if (s.ok && (s.decision === 'query_only' || s.decision === 'insufficient_stars_stop')) return 'ℹ️';
  if (s.category === 'rate_limited') return '⏳';
  if (s.category === 'auth_expired') return '🔐';
  if (s.category === 'network_error') return '🌐';
  return '❌';
}

function renderProfile(p) {
  const parts = [];
  if (p.username) parts.push('📝' + p.username);
  if (p.userId) parts.push('👤' + maskId(p.userId));
  if (p.dataId) parts.push('🧩' + maskId(p.dataId));
  return parts.join(' ');
}

function classifyError(code, msg) {
  const c = String(code || '');
  const m = toStr(msg);
  if (c === '401' || c === '403' || m.indexOf('未登录') !== -1) return 'auth_expired';
  if (m.indexOf('太快') !== -1 || m.indexOf('频繁') !== -1) return 'rate_limited';
  if (m.indexOf('参数') !== -1) return 'param_error';
  if (c && c !== '0') return 'action_rejected';
  return 'unknown';
}

function summarizePrizePool(prizeMap, maxCount) {
  const out = [];
  if (!prizeMap || typeof prizeMap !== 'object') return out;
  const keys = Object.keys(prizeMap).sort();
  for (let i = 0; i < keys.length; i++) {
    const item = prizeMap[keys[i]] || {};
    const name = cleanHtmlText(item.name || '');
    if (!name) continue;
    out.push(keys[i] + ': ' + name);
    if (out.length >= maxCount) break;
  }
  return out;
}

function getAccountHintFromCookie(cookie) {
  const map = parseCookieMap(cookie);
  const id = map.userId || map.uid || map.uin || map.st_uin || '';
  if (id) return maskId(id);
  const keys = Object.keys(map);
  return keys.length ? 'cookie(' + keys.length + '键)' : '未知账号';
}

function getCookieIdentity(cookie) {
  const map = parseCookieMap(cookie);
  const id = map.userId || map.uid || map.uin || map.st_uin || '';
  if (id) return 'id:' + id;
  return 'sig:' + cookieSignature(cookie).slice(0, 40);
}

function formatCookiePairs(cookie) {
  const map = parseCookieMap(cookie);
  const keys = Object.keys(map).sort();
  if (!keys.length) return '';
  const parts = [];
  for (let i = 0; i < keys.length; i++) parts.push(keys[i] + '=' + shortText(map[keys[i]], 80));
  return parts.join('; ');
}

function formatHeaderFields(obj) {
  const arr = [];
  if (obj.ua) arr.push('UA=' + shortText(obj.ua, 70));
  if (obj.origin) arr.push('Origin=' + obj.origin);
  if (obj.referer) arr.push('Referer=' + obj.referer);
  if (obj.authorization) arr.push('Authorization=' + shortText(obj.authorization, 40));
  if (obj.apikey) arr.push('Apikey=' + shortText(obj.apikey, 28));
  if (obj.sid) arr.push('s_id=' + shortText(obj.sid, 28));
  if (obj.secretKey) arr.push('secret-key=' + shortText(obj.secretKey, 28));
  return arr.join(' | ');
}

function parseCookieMap(cookie) {
  const map = {};
  const arr = (cookie || '').split(';');
  for (let i = 0; i < arr.length; i++) {
    const seg = arr[i].trim();
    if (!seg) continue;
    const idx = seg.indexOf('=');
    const k = idx >= 0 ? seg.slice(0, idx).trim() : seg.trim();
    const v = idx >= 0 ? seg.slice(idx + 1).trim() : '';
    if (!k) continue;
    map[k] = v;
  }
  return map;
}

function normalizeCookie(cookie) {
  const arr = (cookie || '').split(';');
  const map = {};
  const ordered = [];
  for (let i = 0; i < arr.length; i++) {
    const seg = arr[i].trim();
    if (!seg) continue;
    const idx = seg.indexOf('=');
    const k = idx >= 0 ? seg.slice(0, idx).trim() : seg.trim();
    const v = idx >= 0 ? seg.slice(idx + 1).trim() : '';
    if (!k) continue;
    if (!Object.prototype.hasOwnProperty.call(map, k)) ordered.push(k);
    map[k] = v;
  }
  const out = [];
  for (let i = 0; i < ordered.length; i++) out.push(ordered[i] + '=' + map[ordered[i]]);
  return out.join('; ');
}

function cookieSignature(cookie) {
  const map = parseCookieMap(cookie);
  const keys = Object.keys(map).sort();
  const arr = [];
  for (let i = 0; i < keys.length; i++) arr.push([keys[i], map[keys[i]]]);
  return JSON.stringify(arr);
}

function splitCookieList(raw) {
  if (!raw) return [];
  return raw
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseArgs(str) {
  const out = {};
  if (!str) return out;
  const pairs = str.split('&');
  for (let i = 0; i < pairs.length; i++) {
    const seg = pairs[i];
    if (!seg) continue;
    const idx = seg.indexOf('=');
    if (idx === -1) out[decodeURIComponent(seg)] = '';
    else out[decodeURIComponent(seg.slice(0, idx))] = decodeURIComponent(seg.slice(idx + 1));
  }
  return out;
}

function resolveRunArgString() {
  const qxArg = typeof $argument === 'undefined' ? '' : $argument;
  if (qxArg && String(qxArg).trim()) return String(qxArg).trim();
  if (typeof process === 'undefined' || !process.argv || process.argv.length < 3) return '';
  const arr = [];
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a) continue;
    if (a.indexOf('--') === 0) {
      const body = a.slice(2);
      const eq = body.indexOf('=');
      if (eq > -1) {
        arr.push(body.slice(0, eq) + '=' + body.slice(eq + 1));
      } else if (i + 1 < argv.length && argv[i + 1].indexOf('-') !== 0) {
        arr.push(body + '=' + argv[i + 1]);
        i++;
      } else {
        arr.push(body + '=true');
      }
    } else if (a.indexOf('=') > -1) {
      arr.push(a);
    }
  }
  return arr.join('&');
}

function appendQuery(url, queryObj) {
  if (!queryObj) return url;
  const keys = Object.keys(queryObj);
  if (!keys.length) return url;
  const arr = [];
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const v = queryObj[k];
    if (v === null || typeof v === 'undefined') continue;
    arr.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
  }
  if (!arr.length) return url;
  return url + (url.indexOf('?') === -1 ? '?' : '&') + arr.join('&');
}

function getEnvAny(keys) {
  if (!$.isNode()) return '';
  for (let i = 0; i < keys.length; i++) {
    const v = process.env[keys[i]];
    if (v && String(v).trim()) return String(v).trim();
  }
  return '';
}

function parseIntSafe(v, defVal) {
  const n = parseInt(v, 10);
  return isNaN(n) ? defVal : n;
}

function toBool(v) {
  const s = String(v || '').toLowerCase().trim();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

function toStr(v) {
  if (v === null || typeof v === 'undefined') return '';
  return String(v);
}

function shortText(s, n) {
  const t = toStr(s);
  if (t.length <= n) return t;
  return t.slice(0, n) + '...';
}

function cleanHtmlText(s) {
  return toStr(s).replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim();
}

function safeJSON(txt) {
  try {
    return JSON.parse(txt);
  } catch (e) {
    return null;
  }
}

function isArray(v) {
  return Object.prototype.toString.call(v) === '[object Array]';
}

function normalizeHeaders(obj) {
  const out = {};
  const keys = Object.keys(obj || {});
  for (let i = 0; i < keys.length; i++) out[keys[i].toLowerCase()] = obj[keys[i]];
  return out;
}

function maskId(s) {
  const v = toStr(s);
  if (!v) return '';
  if (v.length <= 10) return v;
  return v.slice(0, 6) + '...' + v.slice(-4);
}

function logLine(msg) {
  $.log('[' + formatTime(new Date()) + '] ' + msg);
}

function formatTime(d) {
  const p = (n) => (n < 10 ? '0' + n : '' + n);
  return (
    d.getFullYear() +
    '-' +
    p(d.getMonth() + 1) +
    '-' +
    p(d.getDate()) +
    ' ' +
    p(d.getHours()) +
    ':' +
    p(d.getMinutes()) +
    ':' +
    p(d.getSeconds())
  );
}

function Env(name, opts) {
  this.name = name;
  this.http = new Http(this);
  this.data = null;
  this.dataFile = 'box.dat';
  this.logs = [];
  this.isMute = false;
  this.logSeparator = '\n';
  this.startTime = new Date().getTime();
  Object.assign(this, opts);
  console.log('🔔' + this.name + ', 开始!');
}

Env.prototype.isNode = function () {
  return typeof module !== 'undefined' && !!module.exports;
};
Env.prototype.isQuanX = function () {
  return typeof $task !== 'undefined';
};
Env.prototype.isSurge = function () {
  return typeof $httpClient !== 'undefined' && typeof $loon === 'undefined';
};
Env.prototype.isLoon = function () {
  return typeof $loon !== 'undefined';
};
Env.prototype.getdata = function (k) {
  return this.getval(k);
};
Env.prototype.setdata = function (v, k) {
  return this.setval(v, k);
};
Env.prototype.getval = function (k) {
  if (this.isSurge() || this.isLoon()) return $persistentStore.read(k);
  if (this.isQuanX()) return $prefs.valueForKey(k);
  if (this.isNode()) {
    this.data = this.loaddata();
    return this.data[k];
  }
  return null;
};
Env.prototype.setval = function (v, k) {
  if (this.isSurge() || this.isLoon()) return $persistentStore.write(v, k);
  if (this.isQuanX()) return $prefs.setValueForKey(v, k);
  if (this.isNode()) {
    this.data = this.loaddata();
    this.data[k] = v;
    this.writedata();
    return true;
  }
  return false;
};
Env.prototype.loaddata = function () {
  if (!this.isNode()) return {};
  this.fs = this.fs || require('fs');
  this.path = this.path || require('path');
  const p = this.path.resolve(this.dataFile);
  const p2 = this.path.resolve(process.cwd(), this.dataFile);
  const f = this.fs.existsSync(p) ? p : this.fs.existsSync(p2) ? p2 : null;
  if (!f) return {};
  try {
    return JSON.parse(this.fs.readFileSync(f));
  } catch (e) {
    return {};
  }
};
Env.prototype.writedata = function () {
  if (!this.isNode()) return;
  this.fs = this.fs || require('fs');
  this.path = this.path || require('path');
  const p = this.path.resolve(this.dataFile);
  this.fs.writeFileSync(p, JSON.stringify(this.data));
};
Env.prototype.msg = function (title, sub, body, opts) {
  if (!this.isMute) {
    if (this.isSurge() || this.isLoon()) $notification.post(title, sub, body, opts);
    else if (this.isQuanX()) $notify(title, sub, body, opts);
  }
  this.log('\n==============📣系统通知📣==============');
  this.log(title);
  if (sub) this.log(sub);
  if (body) this.log(body);
};
Env.prototype.log = function () {
  console.log([].slice.call(arguments).join(this.logSeparator));
};
Env.prototype.logErr = function (e) {
  this.log('❗️' + this.name + ', 错误!', e && e.stack ? e.stack : e);
};
Env.prototype.done = function (v) {
  const s = (new Date().getTime() - this.startTime) / 1000;
  this.log('🔔' + this.name + ', 结束! 🕛 ' + s + ' 秒');
  if (this.isSurge() || this.isQuanX() || this.isLoon()) $done(v);
};

function Http(env) {
  this.env = env;
}
Http.prototype.send = function (opts, method) {
  const env = this.env;
  opts = typeof opts === 'string' ? { url: opts } : opts;
  opts.method = method;
  return new Promise((resolve, reject) => {
    if (env.isSurge() || env.isLoon()) {
      const fn = method === 'POST' ? 'post' : 'get';
      $httpClient[fn](opts, (err, resp, body) => {
        if (err) reject(err);
        else resolve({ statusCode: resp.status || resp.statusCode, headers: resp.headers, body });
      });
      return;
    }
    if (env.isQuanX()) {
      $task
        .fetch(opts)
        .then((resp) => resolve({ statusCode: resp.statusCode, headers: resp.headers, body: resp.body }))
        .catch((err) => reject(err));
      return;
    }
    if (env.isNode()) {
      const hasFetch = typeof fetch !== 'undefined';
      if (hasFetch) {
        fetch(opts.url, { method, headers: opts.headers || {}, body: method === 'POST' ? opts.body : undefined })
          .then((resp) => resp.text().then((text) => resolve({ statusCode: resp.status, headers: {}, body: text })))
          .catch((err) => reject(err));
      } else {
        const got = require('got');
        got(opts.url, {
          method,
          headers: opts.headers || {},
          body: method === 'POST' ? opts.body : undefined,
          timeout: { request: opts.timeout || DEFAULTS.timeoutMs },
        })
          .then((resp) => resolve({ statusCode: resp.statusCode, headers: resp.headers, body: resp.body }))
          .catch((err) => reject(err));
      }
      return;
    }
    reject(new Error('unsupported runtime'));
  });
};
Http.prototype.get = function (opts) {
  return this.send(opts, 'GET');
};
Http.prototype.post = function (opts) {
  return this.send(opts, 'POST');
};

main()
  .catch((e) => $.logErr(e))
  .finally(() => {
    logLine('🏁 结束 | 版本: ' + VERSION);
    logLine('==========');
    $.done();
  });
