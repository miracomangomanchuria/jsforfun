/*
[rewrite_local]
^https:\/\/(?:ccsp-egmas\.sf-express\.com\/cx-app-member\/member\/app\/user\/universalSign|mcs-mimp-web\.sf-express\.com\/mcs-mimp\/commonPost\/~memberNonactivity~integralTaskStrategyService~queryPointTaskAndSignFromES)(?:\?[^#]*)?$ url script-request-body sysy.js
[mitm]
hostname = ccsp-egmas.sf-express.com, mcs-mimp-web.sf-express.com

[task_local]
0 9 * * * sysy.js, tag=顺丰速运签到, enabled=true

已有 Chavy 抓包可先直接运行本脚本。需要更新时，启用覆写后正常登录顺丰并进入积分页。
若暂时保留 Chavy 覆写，请避免同一 universalSign 请求重复配置两个抓包脚本。

本脚本仅供个人学习交流使用，严禁用于任何商业用途，请于下载后24小时内删除。
脚本无意侵犯任何第三方的肖像权、名誉权、著作权、商标权等合法权益，如涉嫌侵权，请权利人联系脚本，脚本将在收到通知后24小时内删除相关内容。

接口参考
https://github.com/chavyleung/scripts/tree/master/sfexpress
https://github.com/yang7758258/ohhh_QL-script/blob/main/sf_qinglong.js
*/

'use strict';

const QUERY_ONLY = false;
const CLAIM_COMPLETED_TASKS = true;
const CLAIM_SIGN_PACKAGE = false; // 该接口会直接领取，开启前请确认需要独立签到礼包。

const VERSION = '1.0.0';
const MEMBER_KEY = 'sysy_member_session_v1';
const APP_KEY = 'sysy_app_capture_v1';
const CHAVY_KEY = 'chavy_login_sfexpress';
const MCS = 'https://mcs-mimp-web.sf-express.com';
const MEMBER_PAGE = MCS + '/up-member/newPoints';
const APP_PATTERN = 'ccsp-egmas\\.sf-express\\.com\\/cx-app-member\\/member\\/app\\/user\\/universalSign';
const TASK_PATH = '/mcs-mimp/commonPost/~memberNonactivity~integralTaskStrategyService~';
const SIGN_PATH = '/mcs-mimp/commonPost/~memberNonactivity~integralSignV2Service~';
const LIST = TASK_PATH + 'queryPointTaskAndSignFromES';
const PACKAGE = '/mcs-mimp/commonPost/~memberNonactivity~integralTaskSignPlusService~automaticSignFetchPackage';
const BIZ_CODE = '647@RnlvejM1R3VTSVZ6d3BNaXJxRFpOUVVtQkp0ZnFpNDBKdytobm5TQWxMeHpVUXVrVzVGMHVmTU5BVFA1bXlwcw==';
const CAPTURE_RULE = String.raw`^https:\/\/(?:${APP_PATTERN}|mcs-mimp-web\.sf-express\.com\/mcs-mimp\/commonPost\/~memberNonactivity~integralTaskStrategyService~queryPointTaskAndSignFromES)(?:\?[^#]*)?$`;
const APP_URL = new RegExp(String.raw`^https:\/\/${APP_PATTERN}(?:\?[^#]*)?$`);
const CAPTURE_URL = new RegExp(CAPTURE_RULE);
const GUIDE = `[rewrite_local]\n${CAPTURE_RULE} url script-request-body sysy.js\n[mitm]\nhostname = ccsp-egmas.sf-express.com, mcs-mimp-web.sf-express.com`;
const HOP_HEADERS = /^(host|content-length|connection|accept-encoding|transfer-encoding|proxy-.*)$/i;

function log(message) {
  console.log(`[${new Date().toLocaleString('zh-CN', { hour12: false })}] [sysy v${VERSION}] ${message}`);
}

function notify(title, body, openPage = false) {
  $notify('顺丰速运签到', title, body, openPage ? { 'open-url': MEMBER_PAGE } : undefined);
}

function parseJson(text) {
  try { return JSON.parse(text); } catch (_) { return null; }
}

function header(headers, name) {
  const fields = headers || {};
  const key = Object.keys(fields).find((item) => item.toLowerCase() === name);
  return key ? fields[key] : '';
}

function parseCookies(text) {
  const jar = Object.create(null);
  for (const part of String(text || '').split(';')) {
    const pair = /^([\w.-]+)=([^\r\n]*)$/.exec(part.trim());
    if (pair && pair[2]) jar[pair[1]] = pair[2];
  }
  return jar;
}

function cookieText(jar) {
  return Object.keys(jar).sort().map((key) => `${key}=${jar[key]}`).join('; ');
}

function hasSession(jar) {
  return Boolean(jar.sessionId || jar.JSESSIONID);
}

function responseCookies(jar, headers) {
  const value = header(headers, 'set-cookie');
  const rows = Array.isArray(value) ? value : String(value || '').split(/,(?=\s*[\w.-]+=)/);
  for (const row of rows) {
    const pair = /^\s*([\w.-]+)=([^;\r\n]*)/.exec(row);
    if (!pair) continue;
    if (!pair[2] || /;\s*max-age=0(?:;|$)/i.test(row)) delete jar[pair[1]];
    else jar[pair[1]] = pair[2];
  }
}

function appHeaders(headers) {
  const result = {};
  for (const key of Object.keys(headers || {}).sort()) {
    if (!HOP_HEADERS.test(key)) result[key.toLowerCase()] = headers[key];
  }
  return result;
}

function capture(req) {
  const url = String(req.url || '');
  if (req.method !== 'POST' || !CAPTURE_URL.test(url)) return;
  let key;
  let value;
  if (APP_URL.test(url)) {
    if (typeof req.body !== 'string' || !req.body) return;
    key = APP_KEY;
    value = { url, body: req.body, headers: appHeaders(req.headers) };
  } else {
    const jar = parseCookies(header(req.headers, 'cookie'));
    if (!hasSession(jar)) return;
    const body = parseJson(req.body) || {};
    key = MEMBER_KEY;
    value = {
      cookie: cookieText(jar),
      ua: header(req.headers, 'user-agent') || '',
      channel: header(req.headers, 'channel') || '',
      platform: header(req.headers, 'platform') || '',
      syscode: header(req.headers, 'syscode') || '',
      deviceId: typeof body.deviceId === 'string' ? body.deviceId : '',
    };
  }
  const payload = JSON.stringify(value);
  if ($prefs.valueForKey(key) === payload) return;
  if (!$prefs.setValueForKey(payload, key)) throw new Error('storage');
  const label = key === APP_KEY ? 'App 登录请求已更新' : '积分页会话已更新';
  log(label);
  notify(label, '可以运行签到任务。');
}

function fetchQX(url, method, headers, body) {
  const req = { url, method, headers, opts: { redirection: false } };
  if (body !== undefined) req.body = body;
  return $task.fetch(req);
}

function sameOriginRedirect(location) {
  if (typeof location !== 'string' || /[\s\\]/.test(location)) return '';
  if (location.startsWith(MCS + '/')) return location;
  return /^\/(?!\/)/.test(location) ? MCS + location : '';
}

async function openFromApp(app) {
  if (!app || !APP_URL.test(String(app.url || '')) || typeof app.body !== 'string' || !app.body) return null;
  const headers = appHeaders(app.headers);
  const response = await fetchQX(app.url, 'POST', headers, app.body);
  const data = parseJson(response.body);
  const sign = data && data.obj && data.obj.sign;
  if (response.statusCode !== 200 || typeof sign !== 'string' || !sign) return null;

  const ua = header(headers, 'user-agent');
  const jar = Object.create(null);
  let url = `${MCS}/mcs-mimp/share/app/shareRedirect?sign=${encodeURIComponent(sign)}&source=SFAPP&bizCode=${BIZ_CODE}`;
  for (let hops = 0; url && hops < 4; hops += 1) {
    const nextHeaders = {};
    if (ua) nextHeaders['User-Agent'] = ua;
    if (Object.keys(jar).length) nextHeaders.Cookie = cookieText(jar);
    const page = await fetchQX(url, 'GET', nextHeaders);
    responseCookies(jar, page.headers);
    url = [301, 302, 303, 307, 308].includes(page.statusCode)
      ? sameOriginRedirect(header(page.headers, 'location')) : '';
  }
  return hasSession(jar) ? { cookie: cookieText(jar), ua, fromApp: true } : null;
}

function client(session) {
  const jar = parseCookies(session.cookie);
  return async (path, body = {}) => {
    const headers = {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      Origin: MCS,
      Referer: MEMBER_PAGE,
      Cookie: cookieText(jar),
    };
    if (session.ua) headers['User-Agent'] = session.ua;
    for (const field of ['channel', 'platform', 'syscode']) {
      if (session[field]) headers[field] = session[field];
    }
    let response;
    try {
      response = await fetchQX(MCS + path, 'POST', headers, JSON.stringify(body));
    } catch (_) {
      return { ok: false, expired: false, transportError: true };
    }
    responseCookies(jar, response.headers);
    const data = parseJson(response.body) || {};
    const status = response.statusCode;
    const code = /^\d{1,10}$/.test(String(data.errorCode)) ? String(data.errorCode) : '';
    return { ok: status === 200 && data.success === true, expired: status === 401 || code === '100111', status, code, obj: data.obj };
  };
}

function detail(result) {
  if (result.transportError) return '网络请求失败';
  return `HTTP ${result.status || '未知'}${result.code ? ` / ${result.code}` : ''}`;
}

function numeric(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : null;
}

function label(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/https?:\/\/\S+|\b\d{7,}\b|[A-Za-z0-9_=-]{28,}/g, '[已隐藏]')
    .replace(/[\r\n\t]/g, ' ').trim().slice(0, 60);
}

function signLine(result, fallbackDays) {
  if (result.code === '3400002') return '今日已签到';
  if (!result.ok || result.obj === false) return `签到失败（${detail(result)}）`;
  const data = result.obj || {};
  const award = data.award || {};
  const product = Array.isArray(award.productDTOList) && award.productDTOList[0];
  const title = label(award.giftBagName || (product && product.productName));
  const count = numeric(data.awardNum ?? award.awardNum);
  const days = numeric(data.dayCount) ?? fallbackDays;
  const reward = title ? `${title}${count === null ? '' : ` ×${count}`}` : '奖励名未返回';
  return `签到成功${days === null ? '' : ` · 连签 ${days} 天`} · ${reward}`;
}

function listTasks(call, session, channelType) {
  const body = { channelType };
  if (session.deviceId) body.deviceId = session.deviceId;
  return call(LIST, body);
}

async function runTasks(call, session, lines) {
  const canClaim = CLAIM_COMPLETED_TASKS && !QUERY_ONLY;
  const channels = session.deviceId && canClaim ? ['1', '2', '3', '4'] : ['1'];
  const tasks = new Map();
  let points = null;
  let failures = 0;
  for (const channel of channels) {
    const result = await listTasks(call, session, channel);
    if (result.expired) return true;
    if (!result.ok || !result.obj) {
      failures += 1;
      log(`任务分组 ${channel} 查询失败（${detail(result)}）`);
      continue;
    }
    if (points === null) points = numeric(result.obj.totalPoint);
    const items = result.obj.taskTitleLevels;
    if (!Array.isArray(items)) continue;
    for (const task of items) {
      if (!task || ![task.strategyId, task.taskId, task.taskCode].every((id) => typeof id === 'number' || (typeof id === 'string' && id.trim()))) continue;
      const key = JSON.stringify([task.strategyId, task.taskId, task.taskCode].map(String));
      const prior = tasks.get(key);
      const status = numeric(task.status);
      if (!prior || status === 3 || (status === 1 && prior.status !== 3)) tasks.set(key, { task, status, channel });
    }
  }
  const ready = [...tasks.values()].filter(({ status }) => status === 1);
  let claimed = false;
  if (canClaim) {
    for (const [index, { task, channel }] of ready.entries()) {
      const { strategyId, taskId, taskCode } = task;
      const name = label(task.title || task.description) || `任务 ${index + 1}`;
      const body = { strategyId, taskId, taskCode };
      if (session.deviceId) body.deviceId = session.deviceId;
      else body.channelType = channel;
      const result = await call(TASK_PATH + 'fetchIntegral', body);
      if (result.expired) return true;
      if (result.code === '600005') log(`${name} · 已领取`);
      else if (result.ok && result.obj !== false) {
        claimed = true;
        const point = numeric(result.obj && result.obj.point);
        lines.push(`${name} · ${point === null ? '已领取，积分未返回' : `+${point} 积分`}`);
      } else lines.push(`${name} · 领取未确认（${detail(result)}）`);
    }
  } else if (failures < channels.length) lines.push(`待领任务 ${ready.length} 项`);

  if (claimed) {
    const after = await listTasks(call, session, '1');
    if (after.expired) return true;
    const latest = after.ok && after.obj ? numeric(after.obj.totalPoint) : null;
    if (latest === null && points !== null) lines.push(`领奖前积分 ${points}`);
    points = latest;
  }
  if (points !== null) lines.push(`可用积分 ${points}`);
  if (failures === channels.length) lines.push('任务及积分查询失败');
  else if (failures) lines.push(`${failures} 个任务分组查询失败`);
  return false;
}

async function run() {
  const saved = parseJson($prefs.valueForKey(MEMBER_KEY));
  const app = parseJson($prefs.valueForKey(APP_KEY)) || parseJson($prefs.valueForKey(CHAVY_KEY));
  let session = saved && hasSession(parseCookies(saved.cookie)) ? saved : null;
  let call = session && client(session);
  let state = call && await call(SIGN_PATH + 'getTodaySign');
  if ((!session || state.expired) && app) {
    session = await openFromApp(app);
    if (session) {
      call = client(session);
      state = await call(SIGN_PATH + 'getTodaySign');
    }
  }
  if (!session || state.expired) {
    const title = saved || app ? '会员会话不可用' : '缺少顺丰登录态';
    log(title);
    notify(title, `请在顺丰速运打开积分页更新会话。\n\n${GUIDE}`, true);
    return;
  }

  const data = state.ok && state.obj ? state.obj : {};
  const days = numeric(data.dayCount);
  const lines = [];
  let expired = false;
  if (data.signed === true) {
    lines.push(`今日已签到${days === null ? '' : ` · 连签 ${days} 天`}`);
  } else if (data.signed === false && !QUERY_ONLY) {
    const sign = await call(SIGN_PATH + 'sign');
    expired = sign.expired;
    if (!expired) lines.push(signLine(sign, days));
  } else {
    lines.push(data.signed === false ? '今日待签到 · 只读模式' : `签到状态未确认（${detail(state)}）`);
  }
  if (!expired && CLAIM_SIGN_PACKAGE && !QUERY_ONLY && typeof data.signed === 'boolean') {
    const result = await call(PACKAGE, { comeFrom: 'vioin', channelFrom: session.fromApp ? 'SFAPP' : 'WEIXIN' });
    expired = result.expired;
    if (result.ok && result.obj) {
      const pack = result.obj;
      const items = Array.isArray(pack.integralTaskSignPackageVOList) ? pack.integralTaskSignPackageVOList : [];
      const names = items.map((item) => label(item && item.packetName)).filter(Boolean);
      const count = numeric(pack.countDay);
      if (names.length) lines.push(`签到礼包 ${names.join('、')}${count === null ? '' : ` · ${count} 天`}`);
      else lines.push(numeric(pack.hasFinishSign) === 1 ? '签到礼包已领' : '签到礼包奖励未返回');
    } else if (!expired) lines.push(`签到礼包未确认（${detail(result)}）`);
  }
  if (!expired) expired = await runTasks(call, session, lines);
  if (expired) lines.push('登录态已失效，请重新打开积分页抓包');
  for (const line of lines) log(line);
  const title = lines.shift() || '顺丰会员状态';
  notify(title, lines.join('\n'), expired);
}

(async () => {
  try {
    if (typeof $request !== 'undefined') capture($request);
    else {
      log(`========== ${QUERY_ONLY ? '只读查询' : '开始'} ==========`);
      await run();
    }
  } catch (_) {
    log('请求或本地存储异常');
    notify('运行异常', '请检查网络或 QX 本地存储。');
  } finally {
    $done({});
  }
})();
