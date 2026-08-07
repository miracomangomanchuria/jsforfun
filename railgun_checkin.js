/*
本脚本仅供个人学习交流使用，严禁用于任何商业用途，请于下载后24小时内删除。
脚本无意侵犯任何第三方的肖像权、名誉权、著作权、商标权等合法权益，如涉嫌侵权，请权利人联系脚本，脚本将在收到通知后24小时内删除相关内容。
Railgun 每日签到（QX / Surge / Loon / Node）

QX:
[rewrite_local]
^https:\/\/railgun\.info\/(?:api\/user\/(?:info|status)|console(?:\/checkin)?)(?:\?.*)?$ url script-request-header railgun_checkin.js
[mitm]
hostname = railgun.info

Loon:
[Script]
http-request ^https:\/\/railgun\.info\/(?:api\/user\/(?:info|status)|console(?:\/checkin)?)(?:\?.*)?$ script-path=railgun_checkin.js, timeout=60, tag=railgun_checkin_capture
[MITM]
hostname = railgun.info

Surge:
[Script]
railgun_checkin_capture = type=http-request,pattern=^https:\/\/railgun\.info\/(?:api\/user\/(?:info|status)|console(?:\/checkin)?)(?:\?.*)?$,script-path=railgun_checkin.js,timeout=60
[MITM]
hostname = railgun.info

使用：登录 https://railgun.info/ 后，跳转到控制台、签到页，或加载首页用户信息时均可保存 Cookie。
脚本只抓严格列出的登录后页面/用户查询请求；同一字段不会重复通知。
Node 多账号：RAILGUN_CHECKIN_COOKIE 按换行分隔 Cookie。
*/

const $ = new Env('Railgun 签到');
const VER = 'v1.2.0';
const STORE_KEY = 'railgun_checkin_capture_state_v1';
const STATUS_URL = 'https://railgun.info/api/user/status';
const CHECKIN_URL = 'https://railgun.info/api/user/checkin';
const REFERER = 'https://railgun.info/console/checkin';
const LOGIN_URL = 'https://railgun.info/console/checkin';
const CAPTURE_QX = String.raw`[rewrite_local]
^https:\/\/railgun\.info\/(?:api\/user\/(?:info|status)|console(?:\/checkin)?)(?:\?.*)?$ url script-request-header railgun_checkin.js
[mitm]
hostname = railgun.info`;
const CAPTURE_LOON = String.raw`[Script]
http-request ^https:\/\/railgun\.info\/(?:api\/user\/(?:info|status)|console(?:\/checkin)?)(?:\?.*)?$ script-path=railgun_checkin.js, timeout=60, tag=railgun_checkin_capture
[MITM]
hostname = railgun.info`;
const CAPTURE_SURGE = String.raw`[Script]
railgun_checkin_capture = type=http-request,pattern=^https:\/\/railgun\.info\/(?:api\/user\/(?:info|status)|console(?:\/checkin)?)(?:\?.*)?$,script-path=railgun_checkin.js,timeout=60
[MITM]
hostname = railgun.info`;

Promise.resolve().then(async () => {
  log('==========');
  log('🚀 启动 ' + VER + ' | query_only=' + CFG.queryOnly);
  if (typeof $request !== 'undefined') return captureRequest();

  const captured = loadCapture();
  const cookies = loadCookies(captured);
  if (!cookies.length) {
    const guide = captureGuideByClient();
    log('❌ 缺少 Cookie');
    $.msg($.name, '缺少登录状态', '点击跳转登录页；登录成功后进入控制台、签到页或首页即可自动抓取。\n\n' + guide, loginNotifyOptions());
    return;
  }

  const resultLines = [];
  for (let i = 0; i < cookies.length; i++) {
    const item = cookies[i];
    log('----------');
    log('👤 账号 ' + (i + 1) + '/' + cookies.length + ' | Cookie=' + summarizeCookie(item.cookie));
    const result = await runOne(item.cookie, item.ua);
    resultLines.push(formatResult(i + 1, result));
  }

  const hasExpired = resultLines.some(function (line) { return line.indexOf('登录状态已失效') >= 0; });
  $.msg($.name, buildSubtitle(resultLines), resultLines.join('\n'), hasExpired ? loginNotifyOptions() : null);
}).catch(function (e) {
  $.logErr(e);
}).finally(function () {
  log('🏁 结束 ' + VER);
  log('==========');
  $.done();
});

const CFG = {
  queryOnly: toBool(typeof $argument === 'string' ? parseArg($argument).query_only : '', false),
  timeout: 20000,
};

async function runOne(cookie, capturedUA) {
  const status = parseStatus(await requestJSON('GET', STATUS_URL, cookie, '', capturedUA));
  if (!status.ok) return { category: status.authExpired ? 'auth_expired' : 'status_error', message: status.message, days: '', points: '' };
  log('📊 会员状态查询成功 | 剩余天数=' + displayValue(status.days, '未返回'));
  logSubscriptions(status.subscriptions);
  if (CFG.queryOnly) return { category: 'query_only', message: 'query_only=true，跳过签到', days: status.days, points: '' };

  // The status endpoint validates the session but does not return today's
  // completion flag. The captured check-in endpoint is server-idempotent and
  // explicitly reports either a successful or an already-completed result.
  const checkin = parseCheckin(await requestJSON('POST', CHECKIN_URL, cookie, JSON.stringify({ token: 'railgun.info' }), capturedUA));
  if (!checkin.ok) return { category: checkin.authExpired ? 'auth_expired' : 'action_rejected', message: checkin.message, days: status.days, points: '' };
  log((checkin.repeat ? '⏭️ ' : '✅ ') + checkin.message + (checkin.points !== '' ? ' | 本次积分=' + checkin.points : ''));
  return { category: checkin.repeat ? 'already_done' : 'ok', message: checkin.message, days: status.days, points: checkin.points };
}

function requestJSON(method, url, cookie, body, capturedUA) {
  const headers = {
    Accept: 'application/json, text/plain, */*',
    'User-Agent': getUA(capturedUA),
    Referer: REFERER,
    Origin: 'https://railgun.info',
    Cookie: cookie,
  };
  if (method === 'POST') headers['Content-Type'] = 'application/json';
  return httpJSON(method, url, headers, body);
}

function parseStatus(raw) {
  if (!raw || raw.error) return rawError(raw);
  const obj = raw.json || {};
  const code = toInt(obj.code, -1);
  const msg = clean(obj.message || obj.msg || '');
  if (code !== 0) return { ok: false, authExpired: isAuth(raw, code, msg), message: msg || '状态接口返回异常 code=' + code };
  const data = obj.data || {};
  const days = data.leftDays == null ? '' : formatNumber(data.leftDays);
  return { ok: true, authExpired: false, message: msg, days: days, subscriptions: data.subscriptions || null };
}

function parseCheckin(raw) {
  if (!raw || raw.error) return rawError(raw);
  const obj = raw.json || {};
  const code = toInt(obj.code, -1);
  const msg = clean(obj.message || obj.msg || '');
  const repeat = /Checkin Repeats|Today's observation logged|already\s*check/i.test(msg);
  if (code !== 0 && !repeat) return { ok: false, authExpired: isAuth(raw, code, msg), message: msg || '签到接口返回异常 code=' + code };
  return { ok: true, authExpired: false, repeat: repeat, message: msg || (repeat ? '今日已签到' : '签到成功'), points: obj.points == null ? '' : formatNumber(obj.points) };
}

function rawError(raw) {
  const msg = clean(raw && raw.error && raw.error.message) || '网络请求失败';
  return { ok: false, authExpired: isAuth(raw, -1, msg), message: msg };
}

function isAuth(raw, code, message) {
  const status = toInt(raw && raw.status, 0);
  return status === 401 || status === 403 || code === 401 || code === 403 || /unauthori[sz]ed|login|cookie.*(?:expired|invalid)|未登录|登录失效/i.test(String(message || ''));
}

function formatResult(index, result) {
  const tag = '账号' + index;
  if (result.category === 'ok') return '✅ ' + tag + ': 签到成功' + (hasValue(result.points) ? ' | 本次积分+' + result.points : '') + formatDays(result.days);
  if (result.category === 'already_done') return '⏭️ ' + tag + ': 今日已签到' + formatDays(result.days);
  if (result.category === 'query_only') return '🧪 ' + tag + ': 查询成功，跳过签到' + formatDays(result.days);
  if (result.category === 'auth_expired') return '⚠️ ' + tag + ': 登录状态已失效，请重新抓包';
  return '❌ ' + tag + ': ' + (result.message || '执行失败') + formatDays(result.days);
}

function formatDays(days) { return hasValue(days) ? ' | 剩余' + days + '天' : ''; }
function displayValue(value, fallback) { return hasValue(value) ? String(value) : fallback; }
function hasValue(value) { return value !== '' && value !== null && value !== undefined; }
function buildSubtitle(lines) {
  let ok = 0, skip = 0, bad = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].indexOf('✅') === 0) ok++;
    else if (lines[i].indexOf('⏭️') === 0 || lines[i].indexOf('🧪') === 0) skip++;
    else bad++;
  }
  return '成功' + ok + ' | 已签到' + skip + ' | 异常' + bad;
}

function captureRequest() {
  const p = parseUrl($request.url);
  const method = String($request.method || 'GET').toUpperCase();
  const capturePaths = ['/api/user/info', '/api/user/status', '/console', '/console/checkin'];
  if (!p || method !== 'GET' || p.host !== 'railgun.info' || capturePaths.indexOf(p.path) < 0) return;
  const headers = normalizeHeaders($request.headers || {});
  const cookie = clean(headers.cookie);
  if (!cookie) return log('⚠️ 抓包请求未包含 Cookie，未保存 | path=' + p.path);
  const next = { cookie: cookie, ua: clean(headers['user-agent']), updatedAt: now() };
  const old = loadCapture();
  if (old.cookie === next.cookie && old.ua === next.ua) return log('ℹ️ 抓包字段无变化: railgun_cookie');
  saveCapture(next);
  log('✅ 抓包更新: railgun_cookie | ' + summarizeCookie(cookie));
  $.msg($.name, '抓包更新: Railgun Cookie', 'Cookie字段=' + summarizeCookie(cookie) + '\nupdatedAt=' + next.updatedAt);
}

function logSubscriptions(subscriptions) {
  if (!subscriptions) return log('📡 订阅: 服务端未返回');
  if ($.isNode()) return log('📡 订阅: Node 环境默认不输出订阅原文');

  const entries = [];
  if (Array.isArray(subscriptions)) {
    subscriptions.forEach(function (item, index) { collectSubscriptionEntries(item, '订阅' + (index + 1), entries); });
  } else {
    collectSubscriptionEntries(subscriptions, '订阅', entries);
  }
  if (!entries.length) return log('📡 订阅: 服务端未返回可复制链接');
  log('📡 订阅链接: ' + entries.length + ' 条（以下为完整内容）');
  entries.forEach(function (entry) {
    logChunked('📎 ' + entry.name + ': ', entry.value);
  });
}

function collectSubscriptionEntries(value, prefix, entries) {
  if (typeof value === 'string') {
    if (isSubscriptionLink(value)) entries.push({ name: prefix, value: value });
    return;
  }
  if (!value || typeof value !== 'object') return;
  Object.keys(value).forEach(function (key) {
    const item = value[key];
    if (typeof item === 'string' && isSubscriptionLink(item)) entries.push({ name: prefix + '.' + key, value: item });
  });
}

function isSubscriptionLink(value) {
  // Status objects can contain internal fields beside subscription URLs.
  // Only log URI-shaped values that a client can actually import.
  return /^(?:https?|clash|shadowrocket|stash|sub):\/\//i.test(String(value || '').trim());
}

function logChunked(prefix, value) {
  // QX logs can truncate long lines; preserve every byte by emitting fixed chunks.
  const text = String(value == null ? '' : value);
  const size = 900;
  const total = Math.max(1, Math.ceil(text.length / size));
  for (let i = 0; i < total; i++) {
    const label = total === 1 ? prefix : prefix + '[' + (i + 1) + '/' + total + '] ';
    log(label + text.slice(i * size, (i + 1) * size));
  }
}

function loadCookies(captured) {
  if ($.isNode()) {
    const raw = String(process.env.RAILGUN_CHECKIN_COOKIE || '').trim();
    const ua = clean(process.env.RAILGUN_CHECKIN_UA);
    if (raw) return raw.split(/\r?\n/).map(clean).filter(Boolean).map(function (cookie) { return { cookie: cookie, ua: ua }; });
  }
  return captured && clean(captured.cookie) ? [{ cookie: clean(captured.cookie), ua: clean(captured.ua) }] : [];
}

function loadCapture() { const o = toJSON($.getdata(STORE_KEY), {}); return o && typeof o === 'object' ? o : {}; }
function saveCapture(v) { $.setdata(JSON.stringify(v), STORE_KEY); }
function captureGuideByClient() {
  if ($.isQuanX()) return CAPTURE_QX;
  if ($.isLoon()) return CAPTURE_LOON;
  if ($.isSurge()) return CAPTURE_SURGE;
  return 'QX:\n' + CAPTURE_QX + '\n\nLoon:\n' + CAPTURE_LOON + '\n\nSurge:\n' + CAPTURE_SURGE;
}

function getUA(capturedUA) {
  return clean(capturedUA) || clean(typeof process !== 'undefined' && process.env ? process.env.RAILGUN_CHECKIN_UA : '') ||
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
}

function loginNotifyOptions() {
  return { url: LOGIN_URL, 'open-url': LOGIN_URL };
}

async function httpJSON(method, url, headers, body) {
  try {
    const response = await $.http[method.toLowerCase()]({ url: url, headers: headers, body: method === 'GET' ? undefined : body, timeout: CFG.timeout });
    const status = toInt(response.statusCode || response.status, 0);
    const text = typeof response.body === 'string' ? response.body : '';
    if (status < 200 || status >= 300) return { error: { message: 'HTTP ' + status }, status: status, json: null };
    const json = toJSON(text, null);
    if (!json) return { error: { message: '非JSON响应' }, status: status, json: null };
    return { error: null, status: status, json: json };
  } catch (e) {
    return { error: { message: clean(e && e.message ? e.message : e) }, status: 0, json: null };
  }
}

function parseUrl(url) { const m = /^https?:\/\/([^\/?#]+)([^?#]*)/.exec(String(url || '')); return m ? { host: clean(m[1]), path: clean(m[2]) || '/' } : null; }
function normalizeHeaders(headers) { const out = {}; Object.keys(headers || {}).forEach(function (key) { out[String(key).toLowerCase()] = String(headers[key] == null ? '' : headers[key]); }); return out; }
function parseArg(raw) { const out = {}; String(raw || '').split('&').forEach(function (part) { const i = part.indexOf('='); const k = i < 0 ? part : part.slice(0, i); const v = i < 0 ? '' : part.slice(i + 1); if (k) out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, '%20')); }); return out; }
function toBool(v, fallback) { const s = String(v == null ? '' : v).toLowerCase(); if (!s) return fallback; return /^(1|true|yes|on)$/.test(s); }
function toInt(v, fallback) { const n = parseInt(String(v), 10); return isNaN(n) ? fallback : n; }
function toJSON(v, fallback) { try { return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }
function clean(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
function formatNumber(v) { const n = Number(v); return isFinite(n) ? (Math.round(n * 100) / 100).toString() : clean(v); }
function summarizeCookie(cookie) { const keys = String(cookie || '').split(';').map(function (x) { return clean(x).split('=')[0]; }).filter(Boolean); return 'keys=' + keys.join(',') + ' | count=' + keys.length + ' | len=' + String(cookie || '').length; }
function now() { const d = new Date(); const p = function (n) { return n < 10 ? '0' + n : String(n); }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()); }
function log(message) { $.log('[' + now() + '] ' + message); }

function Env(name) {
  this.name = name; this.startTime = Date.now(); this.dataFile = 'box.dat'; this.data = null;
  const self = this;
  this.http = { get: function (opts) { return self.request('GET', opts); }, post: function (opts) { return self.request('POST', opts); } };
}
Env.prototype.isNode = function () { return typeof module !== 'undefined' && !!module.exports; };
Env.prototype.isQuanX = function () { return typeof $task !== 'undefined'; };
Env.prototype.isSurge = function () { return typeof $httpClient !== 'undefined' && typeof $loon === 'undefined'; };
Env.prototype.isLoon = function () { return typeof $loon !== 'undefined'; };
Env.prototype.getdata = function (key) { if (this.isQuanX()) return $prefs.valueForKey(key); if (this.isSurge() || this.isLoon()) return $persistentStore.read(key); if (this.isNode()) { this.data = this.loaddata(); return this.data[key]; } return ''; };
Env.prototype.setdata = function (value, key) { if (this.isQuanX()) return $prefs.setValueForKey(value, key); if (this.isSurge() || this.isLoon()) return $persistentStore.write(value, key); if (this.isNode()) { this.data = this.loaddata(); this.data[key] = value; this.writedata(); return true; } return false; };
Env.prototype.loaddata = function () { try { const fs = require('fs'); const p = require('path').resolve(this.dataFile); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p)) : {}; } catch (e) { return {}; } };
Env.prototype.writedata = function () { const fs = require('fs'); const p = require('path').resolve(this.dataFile); fs.writeFileSync(p, JSON.stringify(this.data, null, 2)); };
Env.prototype.log = function (message) { console.log(message); };
Env.prototype.logErr = function (err) { this.log('❌ ' + this.name + ': ' + (err && err.stack ? err.stack : err)); };
Env.prototype.msg = function (title, subtitle, body, opts) {
  if (this.isQuanX()) return $notify(title, subtitle || '', body || '', opts || undefined);
  if (this.isSurge()) return $notification.post(title, subtitle || '', body || '', opts && opts.url ? { url: opts.url } : undefined);
  if (this.isLoon()) return $notification.post(title, subtitle || '', body || '', opts && opts.url ? opts.url : undefined);
  console.log(['', '==============系统通知==============', title, subtitle || '', body || ''].join('\n'));
};
Env.prototype.done = function () { if (this.isQuanX() || this.isSurge() || this.isLoon()) $done({}); else this.log('[' + now() + '] ' + this.name + ' 结束, 耗时 ' + ((Date.now() - this.startTime) / 1000).toFixed(3) + ' 秒'); };
Env.prototype.request = function (method, opts) {
  const self = this; const req = typeof opts === 'string' ? { url: opts } : (opts || {});
  return new Promise(function (resolve, reject) {
    if (self.isQuanX()) { const q = { url: req.url, method: method, headers: req.headers || {} }; if (method !== 'GET') q.body = req.body; return $task.fetch(q).then(function (r) { resolve({ statusCode: r.statusCode, body: r.body, headers: r.headers }); }, reject); }
    if (self.isSurge() || self.isLoon()) { const fn = method === 'GET' ? $httpClient.get : $httpClient.post; const p = { url: req.url, headers: req.headers || {}, body: req.body }; return fn(p, function (err, resp, body) { if (err) reject(err); else { resp.body = body; resolve(resp); } }); }
    if (self.isNode()) { const u = new URL(req.url); const lib = require(u.protocol === 'https:' ? 'https' : 'http'); const r = lib.request({ method: method, hostname: u.hostname, path: u.pathname + u.search, headers: req.headers || {} }, function (resp) { const chunks = []; resp.on('data', function (c) { chunks.push(c); }); resp.on('end', function () { resolve({ statusCode: resp.statusCode, body: Buffer.concat(chunks).toString() }); }); }); r.on('error', reject); r.setTimeout(req.timeout || 20000, function () { r.destroy(new Error('Request timeout')); }); if (method !== 'GET' && req.body) r.write(req.body); r.end(); return; }
    reject(new Error('Unknown runtime'));
  });
};
