/*
[rewrite_local]
^https:\/\/(?:ccsp-egmas\.sf-express\.com\/cx-app-member\/member\/app\/user\/universalSign|mcs-mimp-web\.sf-express\.com\/mcs-mimp\/commonPost\/~memberNonactivity~integralTaskStrategyService~queryPointTaskAndSignFromES)(?:\?[^#]*)?$ url script-request-body sfsy.js
[mitm]
hostname = ccsp-egmas.sf-express.com, mcs-mimp-web.sf-express.com

[task_local]
0 9 * * * sfsy.js, tag=顺丰速运签到, enabled=true

默认执行每日签到、独立签到礼包和待领取的任务奖励。本地脚本设 QUERY_ONLY = true 可切回只读。
通过 HTTP(S) 脚本 URL 配置任务时可加 #mode=query 强制只读。

QX 抓包步骤
1. 把顶部的覆写行加入 QX 配置的 [rewrite_local]，把两个域名追加到 [mitm] 的现有 hostname 列表。
2. 启用 QX、重写和 MITM。首次使用 MITM 时，在 iOS 安装并信任 QX 的证书。
3. 在顺丰速运 App 正常登录自己的账号，打开会员积分页。已经停在积分页时，可先退出该页再进入。
4. 收到「会员积分页 · 会话已保存」可运行定时任务。收到「顺丰 App · 登录请求已保存」时，脚本会先尝试建立会员会话。重复抓包只在日志中提示。
5. 抓包后运行上面的定时任务即可签到和领奖。要先检查状态和积分，可用上面的只读设置。

同一个 QX 里已有 Chavy 抓包时，可以直接试跑本脚本。改用本脚本抓包时，停用 Chavy 的 universalSign 覆写，避免同一请求同时匹配两条规则。

本脚本仅供个人学习交流使用，严禁用于任何商业用途，请于下载后24小时内删除。
脚本无意侵犯任何第三方的肖像权、名誉权、著作权、商标权等合法权益，如涉嫌侵权，请权利人联系脚本，脚本将在收到通知后24小时内删除相关内容。

接口参考
https://github.com/chavyleung/scripts/tree/master/sfexpress
https://github.com/yang7758258/ohhh_QL-script/blob/main/sf_qinglong.js
*/

'use strict';

const QUERY_ONLY = false;
const CLAIM_COMPLETED_TASKS = true;
const CLAIM_SIGN_PACKAGE = true;

const VERSION = '1.0.5';
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
const GUIDE = `[rewrite_local]\n${CAPTURE_RULE} url script-request-body sfsy.js\n[mitm]\nhostname = ccsp-egmas.sf-express.com, mcs-mimp-web.sf-express.com`;
const HOP_HEADERS = /^(host|content-length|connection|accept-encoding|transfer-encoding|proxy-.*)$/i;

function log(message) {
  console.log(`[${new Date().toLocaleString('zh-CN', { hour12: false })}] [sfsy v${VERSION}] ${message}`);
}

function notify(title, body, openPage = false) {
  $notify('顺丰速运', title, body, openPage ? { 'open-url': MEMBER_PAGE } : undefined);
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
  const fromApp = APP_URL.test(url);
  const source = fromApp ? '顺丰 App · universalSign' : '会员积分页 · 任务查询';
  const key = fromApp ? APP_KEY : MEMBER_KEY;
  let value;
  if (fromApp) {
    if (typeof req.body !== 'string' || !req.body) {
      log(`抓包 | ${source} | 请求体为空，未保存`);
      return;
    }
    value = { url, body: req.body, headers: appHeaders(req.headers) };
  } else {
    const jar = parseCookies(header(req.headers, 'cookie'));
    if (!hasSession(jar)) {
      log(`抓包 | ${source} | 缺少会员会话 Cookie，未保存`);
      return;
    }
    const body = parseJson(req.body) || {};
    value = {
      cookie: cookieText(jar),
      ua: header(req.headers, 'user-agent') || '',
      channel: header(req.headers, 'channel') || '',
      platform: header(req.headers, 'platform') || '',
      syscode: header(req.headers, 'syscode') || '',
      deviceId: typeof body.deviceId === 'string' ? body.deviceId : '',
    };
  }

  const previous = parseJson($prefs.valueForKey(key));
  const payload = JSON.stringify(value);
  if (previous && JSON.stringify(previous) === payload) {
    log(`抓包 | ${source} | 与已保存内容一致`);
    return;
  }
  if (!$prefs.setValueForKey(payload, key)) {
    log(`抓包 | ${source} | QX 存储失败`);
    notify('抓包保存失败', `${source}\n请检查 QX 本地存储，再重新进入积分页。`);
    return;
  }

  const ua = fromApp ? header(value.headers, 'user-agent') : value.ua;
  const fields = [`UA ${ua ? '已保存' : '未返回'}`];
  if (!fromApp) {
    fields.unshift('Cookie 已保存');
    fields.push(`deviceId ${value.deviceId ? '已保存' : '未返回，仅查询分组 1'}`);
  }
  const action = previous ? '更新' : '首次保存';
  log(`抓包 | ${source} | ${action} | ${fields.join(' · ')}`);
  const title = fromApp ? '顺丰 App · 登录请求已保存' : '会员积分页 · 会话已保存';
  const next = fromApp
    ? '正式运行时会先验证能否建立会员会话。'
    : '运行顺丰速运任务可检查签到并领取可用奖励。';
  notify(title, `${fields.join(' · ')}\n${next}`);
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

async function runTasks(call, session, queryOnly) {
  const canClaim = CLAIM_COMPLETED_TASKS && !queryOnly;
  const channels = session.deviceId && canClaim ? ['1', '2', '3', '4'] : ['1'];
  const tasks = new Map();
  let points = null;
  let listedGroups = 0;
  let failedGroups = 0;
  let missingLists = 0;
  let missingIds = 0;
  let expired = false;
  log(`任务中心 · 查询分组 ${channels.join('、')} · ${canClaim ? '领取待领奖励' : '仅查询'}`);
  for (const channel of channels) {
    const result = await listTasks(call, session, channel);
    if (result.expired) {
      expired = true;
      log(`任务分组 ${channel} 查询中断 · 登录态失效（${detail(result)}）`);
      break;
    }
    if (!result.ok || !result.obj) {
      failedGroups += 1;
      log(`任务分组 ${channel} 查询失败（${detail(result)}）`);
      continue;
    }
    if (points === null) points = numeric(result.obj.totalPoint);
    const items = result.obj.taskTitleLevels;
    if (!Array.isArray(items)) {
      missingLists += 1;
      log(`任务分组 ${channel} · 服务端未返回任务列表字段 taskTitleLevels`);
      continue;
    }
    listedGroups += 1;
    log(`任务分组 ${channel} · 返回 ${items.length} 项`);
    for (const task of items) {
      if (!task || typeof task !== 'object') continue;
      const ids = [task.strategyId, task.taskId, task.taskCode];
      const hasIds = ids.every((id) => (typeof id === 'number' && Number.isFinite(id)) || (typeof id === 'string' && id.trim()));
      const status = numeric(task.status);
      if (!hasIds) {
        missingIds += 1;
        const name = label(task.title || task.description) || '未命名任务';
        log(`${name} · 缺少领取字段 · 状态 ${status ?? '未返回'}`);
        continue;
      }
      const key = JSON.stringify(ids.map(String));
      const prior = tasks.get(key);
      if (!prior || status === 3 || (status === 1 && prior.status !== 3)) tasks.set(key, { task, status, channel });
    }
  }

  const ready = [];
  const browseTitles = new Set();
  let incomplete = 0;
  let alreadyClaimed = 0;
  let unknown = 0;
  for (const item of tasks.values()) {
    const { task, status } = item;
    const description = label(task.description);
    const title = label(task.title) || description;
    if (status === 1) ready.push(item);
    else if (status === 3) alreadyClaimed += 1;
    else if (status === 0 || status === 2) {
      incomplete += 1;
      if (title && (/浏览|停留/.test(title) || /浏览|停留/.test(description))) browseTitles.add(title);
    } else {
      unknown += 1;
    }
  }

  const rewardNames = [];
  let claimed = 0;
  let claimPoints = 0;
  let pointsUnreported = 0;
  let claimFailures = 0;
  if (canClaim && !expired) {
    for (const { task, channel } of ready) {
      const { strategyId, taskId, taskCode } = task;
      const name = label(task.title || task.description) || '未命名任务';
      const body = { strategyId, taskId, taskCode };
      if (session.deviceId) body.deviceId = session.deviceId;
      else body.channelType = channel;
      const result = await call(TASK_PATH + 'fetchIntegral', body);
      if (result.expired) {
        expired = true;
        log(`${name} · 领取中断，登录态失效`);
        break;
      }
      if (result.code === '600005') {
        alreadyClaimed += 1;
        log(`${name} · 已领取过`);
      } else if (result.ok && result.obj !== false) {
        claimed += 1;
        if (name !== '未命名任务') rewardNames.push(name);
        const point = numeric(result.obj && result.obj.point);
        if (point === null) pointsUnreported += 1;
        else claimPoints += point;
        log(`${name} · ${point === null ? '已领取，积分未返回' : `+${point} 积分`}`);
      } else {
        claimFailures += 1;
        const reason = result.code === '600006' ? '服务端判定任务未完成' : '领取未确认';
        log(`${name} · ${reason}（${detail(result)}）`);
      }
    }
  }

  let summary = '任务中心查询失败';
  if (listedGroups) {
    const parts = [`${tasks.size} 项中 ${ready.length} 项待领`];
    if (alreadyClaimed) parts.push(`此前已领 ${alreadyClaimed} 项`);
    if (incomplete) parts.push(`未完成 ${incomplete} 项`);
    if (unknown) parts.push(`状态未识别 ${unknown} 项`);
    if (missingIds) parts.push(`缺少领取字段 ${missingIds} 条`);
    log(`任务中心 | ${parts.join(' · ')}`);
    if (canClaim) summary = expired ? '任务处理因会话失效中断' : ready.length ? '本次未领到任务积分' : '暂无待领任务积分';
    else summary = `只读查询 · ${ready.length} 项待领`;
    if (!tasks.size && !missingIds) summary = '任务列表为空';
    if (!tasks.size && missingIds) summary = '任务缺少领取字段';
  } else if (expired) {
    summary = '任务查询因会话失效中断';
  } else if (missingLists) {
    summary = '服务端未返回任务列表';
  }
  if (claimed) {
    const earned = pointsUnreported === claimed ? '积分数未返回' : `+${claimPoints} 积分`;
    summary = `已领 ${claimed} 项 · ${earned}`;
    if (pointsUnreported && pointsUnreported !== claimed) summary += ` · ${pointsUnreported} 项积分数未返回`;
  }
  if (claimFailures) summary += ` · ${claimFailures} 项未确认`;
  if (listedGroups && (failedGroups || missingLists)) summary += ` · ${failedGroups + missingLists} 个分组无结果`;
  log(`任务奖励 | ${summary}`);

  let browse = '';
  if (browseTitles.size) {
    const titles = [...browseTitles];
    const more = titles.length > 3 ? ` 等 ${titles.length} 项` : '';
    browse = `${titles.slice(0, 3).join('、')}${more}`;
    log(`待浏览 | ${browse}`);
  }

  let before = null;
  if (claimed) {
    before = points;
    points = null;
    if (!expired) {
      const after = await listTasks(call, session, '1');
      expired = after.expired;
      points = after.ok && after.obj ? numeric(after.obj.totalPoint) : null;
      if (points === null) log(`积分余额复查未确认（${detail(after)}）`);
    }
  }
  let balance = '';
  if (points !== null) balance = `可用 ${points}`;
  else if (before !== null) balance = `领奖前 ${before} · 当前余额未确认`;
  if (balance) log(`积分 | ${balance}`);
  const names = [...new Set(rewardNames)];
  const rewards = names.slice(0, 3).join('、') + (names.length > 3 ? ` 等 ${names.length} 项` : '');
  return { summary, rewards, browse, balance, expired };
}

function useQueryMode() {
  const sourcePath = typeof $environment === 'undefined' ? '' : String($environment.sourcePath || '');
  const fragment = sourcePath.split('#')[1] || '';
  const modes = fragment.split('&').filter((option) => option.startsWith('mode='));
  if (!modes.length) return QUERY_ONLY;
  return modes.length !== 1 || modes[0] !== 'mode=execute';
}

async function run(queryOnly) {
  const saved = parseJson($prefs.valueForKey(MEMBER_KEY));
  const appCapture = parseJson($prefs.valueForKey(APP_KEY));
  const app = appCapture || parseJson($prefs.valueForKey(CHAVY_KEY));
  let session = saved && hasSession(parseCookies(saved.cookie)) ? saved : null;
  let call;
  let state;
  if (session) {
    log('登录态 | 使用积分页抓包');
    call = client(session);
    state = await call(SIGN_PATH + 'getTodaySign');
  }
  if ((!session || state.expired) && app) {
    if (session) log(`登录态 | 积分页会话失效（${detail(state)}）`);
    log(`登录态 | 尝试通过${appCapture ? '顺丰 App 抓包' : ' Chavy 抓包'}建立会员会话`);
    try {
      session = await openFromApp(app);
    } catch (_) {
      session = null;
      log('登录态 | 建立会员会话时请求失败');
    }
    if (session) {
      call = client(session);
      state = await call(SIGN_PATH + 'getTodaySign');
    }
  }
  if (!session || state.expired) {
    const title = saved || app ? '会员会话不可用' : '缺少顺丰登录态';
    const detailText = session && state.expired ? `（${detail(state)}）` : '';
    log(`登录态 | ${title}${detailText} | 签到和任务已跳过\n${GUIDE}`);
    notify(title, '请登录顺丰速运并重新进入会员积分页抓包。', true);
    return;
  }

  const data = state.ok && state.obj ? state.obj : {};
  const days = numeric(data.dayCount);
  let expired = false;
  let sign;
  if (data.signed === true) {
    sign = `今日已签到${days === null ? '' : ` · 连签 ${days} 天`}`;
  } else if (data.signed === false && !queryOnly) {
    log('签到 | 今日待签，正在提交');
    const result = await call(SIGN_PATH + 'sign');
    expired = result.expired;
    sign = expired ? '会话失效，签到中断' : signLine(result, days);
  } else {
    sign = data.signed === false ? '今日待签到' : `状态未确认（${detail(state)}）`;
  }
  log(`签到 | ${sign}`);

  let packageResult = '';
  if (!expired && CLAIM_SIGN_PACKAGE && !queryOnly && typeof data.signed === 'boolean') {
    const result = await call(PACKAGE, { comeFrom: 'vioin', channelFrom: session.fromApp ? 'SFAPP' : 'WEIXIN' });
    expired = result.expired;
    if (result.ok && result.obj) {
      const pack = result.obj;
      const items = Array.isArray(pack.integralTaskSignPackageVOList) ? pack.integralTaskSignPackageVOList : [];
      const names = items.map((item) => label(item && item.packetName)).filter(Boolean);
      const count = numeric(pack.countDay);
      if (names.length) packageResult = `${names.slice(0, 4).join('、')}${names.length > 4 ? ` 等 ${names.length} 项` : ''}${count === null ? '' : ` · ${count} 天`}`;
      else packageResult = numeric(pack.hasFinishSign) === 1 ? '今日已领' : '服务端未返回奖励';
    } else {
      packageResult = expired ? '会话失效，领取中断' : `领取未确认（${detail(result)}）`;
    }
    log(`签到礼包 | ${packageResult}`);
  }

  const tasks = expired
    ? { summary: '会话失效，任务中心未查询', expired: true }
    : await runTasks(call, session, queryOnly);
  if (expired) log(`任务中心 | ${tasks.summary}`);
  const lines = [`任务奖励 · ${tasks.summary}`];
  if (tasks.balance) lines.push(`积分余额 · ${tasks.balance}`);
  if (packageResult) lines.push(`签到礼包 · ${packageResult}`);
  if (tasks.rewards) lines.push(`获得 · ${tasks.rewards}`);
  if (tasks.expired) lines.push('会话失效，请重新进入会员积分页抓包');
  else if (tasks.browse) lines.push(`待浏览 · ${tasks.browse}（点通知打开积分页）`);
  notify(`${queryOnly ? '只读 · ' : ''}${sign}`, lines.join('\n'), tasks.expired || Boolean(tasks.browse));
}

(async () => {
  try {
    if (typeof $request !== 'undefined') capture($request);
    else {
      const queryOnly = useQueryMode();
      const started = Date.now();
      log(`========== ${queryOnly ? '仅查询签到和任务' : '签到与任务领奖'} ==========`);
      try {
        await run(queryOnly);
      } finally {
        log(`结束 | 耗时 ${((Date.now() - started) / 1000).toFixed(1)} 秒`);
      }
    }
  } catch (_) {
    log('请求或本地存储异常');
    notify('运行异常', '请检查网络或 QX 本地存储。');
  } finally {
    $done({});
  }
})();
