/*
本脚本仅供个人学习交流使用，严禁用于任何商业用途，请于下载后24小时内删除。
脚本无意侵犯任何第三方的肖像权、名誉权、著作权、商标权等合法权益，如涉嫌侵权，请权利人联系脚本，脚本将在收到通知后24小时内删除相关内容。
QQ三国活动签到（QX / Surge / Loon / Node）

抓包说明（QX，简版）：
[rewrite_local]
^https:\/\/x8m8\.ams\.game\.qq\.com\/ams\/ame\/amesvr.* url script-request-body qqsg_signin.js
^https:\/\/comm\.ams\.game\.qq\.com\/ide\/.*            url script-request-body qqsg_signin.js
[mitm]
hostname = x8m8.ams.game.qq.com, comm.ams.game.qq.com
完整可复制配置见文件后部 CAPTURE_CONFIG_TEXT（缺少 Cookie 时会自动打印）。

使用说明：
1) 先打开活动页并触发一次请求，脚本会自动保存 Cookie 和 UA。
2) 再跑定时任务执行签到。
3) 多账号可在环境变量 QQSG_SIGNIN_COOKIE 中按换行分隔多个 Cookie（兼容旧变量 QQSG_COOKIE）。
*/

const $ = new Env('QQ三国签到');

const CFG = {
  cookieKey: 'qqsg_signin_cookie_v1',
  uaKey: 'qqsg_signin_ua_v1',
  paramsKey: 'qqsg_signin_params_v1',
  roleUrlKey: 'qqsg_signin_role_url_v1',
  rewardMapKey: 'qqsg_signin_reward_map_v1',
  rewardMapTsKey: 'qqsg_signin_reward_map_ts_v1',
  legacy: {
    cookieKey: 'qqsg_cookie',
    uaKey: 'qqsg_ua',
    paramsKey: 'qqsg_params',
    roleUrlKey: 'qqsg_role_url',
  },
  ideUrl: 'https://comm.ams.game.qq.com/ide/',
  roleUrl:
    'https://x8m8.ams.game.qq.com/ams/ame/amesvr?sServiceType=sg&iActivityId=638986&sServiceDepartment=group_g&sSDID=1d027a5da7ec7edea26e5dfff6243ff2',
  serviceType: 'sg',
  activityId: '638986',
  serviceDepartment: 'group_g',
  roleFlowId: '1035202',
  statusFlowId: '1035342',
  signFlowId: '1035343',
  statusChartId: '288091',
  signChartId: '288092',
  statusIdeToken: 'tZP91Q',
  signIdeToken: 'IlzTIB',
  // 注意：这里存“单层编码”值，提交 form 时会再次编码成抓包中的 %25 形式
  easUrl: 'http%3A%2F%2Fsg.qq.com%2Fcp%2Fa20240429gzhqd%2F',
  easRefer: 'http%3A%2F%2Fnoreferrer%2F',
  origin: 'https://sg.qq.com',
  referer: 'https://sg.qq.com/',
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 26_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 QQ/9.2.66.625',
  debug: false,
};

const summaries = [];
let runtimeRewardMap = null;
let rewardMapSource = '';
let rewardMapLogged = false;

const CAPTURE_CONFIG_TEXT = String.raw`[rewrite_local]
^https:\/\/x8m8\.ams\.game\.qq\.com\/ams\/ame\/amesvr.* url script-request-body qqsg_signin.js
^https:\/\/comm\.ams\.game\.qq\.com\/ide\/.*            url script-request-body qqsg_signin.js
[mitm]
hostname = x8m8.ams.game.qq.com, comm.ams.game.qq.com`;

!(async function () {
  migrateLegacyStore();

  if (typeof $request !== 'undefined') {
    captureRequest();
    return;
  }

  const cookies = loadCookies();
  if (!cookies.length) {
    $.log('📋 QX 抓包配置（可整段复制）:\n' + CAPTURE_CONFIG_TEXT);
    $.msg($.name, '未获取到 Cookie', '请先打开活动页抓包一次');
    return;
  }

  for (let i = 0; i < cookies.length; i++) {
    await runAccount(cookies[i], i + 1, cookies.length);
  }
  notifyFinal();
})()
  .catch(function (err) {
    $.logErr(err);
  })
  .finally(function () {
    $.done();
  });

function captureRequest() {
  const url = $request.url || '';
  if (!/x8m8\.ams\.game\.qq\.com\/ams\/ame\/amesvr|comm\.ams\.game\.qq\.com\/ide\//.test(url)) {
    return;
  }
  const headers = $request.headers || {};
  const body = typeof $request.body === 'string' ? $request.body : '';
  const cookie = headers.Cookie || headers.cookie || '';
  const ua = headers['User-Agent'] || headers['user-agent'] || '';

  if (!cookie) {
    $.msg($.name, '抓包失败', '请求头中未找到 Cookie');
    return;
  }

  const cookieRet = saveCookie(cookie);
  const uaRet = ua ? saveValueIfChanged(CFG.uaKey, ua) : { changed: false };
  const roleUrlRet = url.indexOf('/ams/ame/amesvr') !== -1 ? saveValueIfChanged(CFG.roleUrlKey, url) : { changed: false };
  const paramRet = updateRuntimeParams(url, body);

  const normalizedCookie = cookieRet.newCookie || normalizeQQSGCookie(cookie);
  const cookieMap = parseCookieMap(normalizedCookie);
  const cookieFieldsText = formatMapFields(cookieMap);
  const runtimeFieldsText = formatRuntimeParamFields(paramRet.current);
  const who = getAccountHintFromCookie(normalizedCookie);

  const changedParts = [];
  if (cookieRet.changed) changedParts.push('Cookie');
  if (uaRet.changed) changedParts.push('UA');
  if (roleUrlRet.changed) changedParts.push('RoleURL');
  if (paramRet.changed) changedParts.push('Params');

  if (!changedParts.length) {
    $.log('ℹ️ 抓包字段无变化，跳过写入与通知');
    $.log('👤 账号: ' + who);
    $.log('🍪 Cookie字段(全量): ' + (cookieFieldsText || '无'));
    if (runtimeFieldsText) $.log('🧩 参数字段(全量): ' + runtimeFieldsText);
    return;
  }

  const lines = [];
  lines.push('变更项: ' + changedParts.join(' / '));
  lines.push('账号: ' + who);
  lines.push('Cookie字段(全量): ' + (cookieFieldsText || '无'));
  if (runtimeFieldsText) lines.push('参数字段(全量): ' + runtimeFieldsText);

  $.log('✅ 抓包字段已更新: ' + changedParts.join(' / '));
  $.log('👤 账号: ' + who);
  $.log('🍪 Cookie字段(全量): ' + (cookieFieldsText || '无'));
  if (runtimeFieldsText) $.log('🧩 参数字段(全量): ' + runtimeFieldsText);
  $.msg($.name, '抓包字段已更新', lines.join('\n'));
}

function saveCookie(cookie) {
  const normalizedCookie = normalizeQQSGCookie(cookie);
  const raw = ($.getdata(CFG.cookieKey) || '').trim();
  const oldList = splitCookieList(raw);
  const id = getCookieVal(normalizedCookie, 'openid') || getCookieVal(normalizedCookie, 'uin') || normalizedCookie.slice(0, 32);
  let existed = false;
  let changed = false;
  let oldCookie = '';
  const next = [];
  const newSig = cookieSignature(normalizedCookie);
  for (let i = 0; i < oldList.length; i++) {
    const old = normalizeQQSGCookie(oldList[i]);
    const oldId = getCookieVal(old, 'openid') || getCookieVal(old, 'uin') || old.slice(0, 32);
    if (oldId === id) {
      existed = true;
      oldCookie = old;
      if (cookieSignature(old) === newSig) {
        next.push(old);
      } else {
        next.push(normalizedCookie);
        changed = true;
      }
    } else {
      next.push(old);
    }
  }
  if (!existed) {
    next.push(normalizedCookie);
    changed = true;
  }
  if (changed) $.setdata(next.join('\n'), CFG.cookieKey);
  return {
    changed: changed,
    isNew: !existed,
    accountId: id,
    oldCookie: oldCookie,
    newCookie: normalizedCookie,
  };
}

function migrateLegacyStore() {
  migrateOneStoreKey(CFG.legacy.cookieKey, CFG.cookieKey);
  migrateOneStoreKey(CFG.legacy.uaKey, CFG.uaKey);
  migrateOneStoreKey(CFG.legacy.paramsKey, CFG.paramsKey);
  migrateOneStoreKey(CFG.legacy.roleUrlKey, CFG.roleUrlKey);
}

function migrateOneStoreKey(fromKey, toKey) {
  if (!fromKey || !toKey || fromKey === toKey) return;
  const newVal = $.getdata(toKey);
  if (newVal !== null && newVal !== undefined && String(newVal).trim() !== '') return;
  const oldVal = $.getdata(fromKey);
  if (oldVal === null || oldVal === undefined || String(oldVal).trim() === '') return;
  $.setdata(oldVal, toKey);
  $.log('🔁 存储迁移: ' + fromKey + ' -> ' + toKey);
}

function loadCookies() {
  const envCookie =
    (typeof process !== 'undefined' &&
      process.env &&
      (
        process.env.QQSG_SIGNIN_COOKIE ||
        process.env.qqsg_signin_cookie ||
        process.env.QQSG_COOKIE ||
        process.env.qqsg_cookie ||
        ''
      )) ||
    '';
  const localCookie = $.getdata(CFG.cookieKey) || '';
  const raw = (envCookie || localCookie || '').trim();
  return splitCookieList(raw);
}

function splitCookieList(raw) {
  if (!raw) return [];
  return raw
    .split(/\n/)
    .map(function (s) {
      return s.trim();
    })
    .filter(function (s) {
      return !!s;
    });
}

function getRuntimeCfg() {
  const p = loadParamStore();
  const out = {
    roleUrl: p.roleUrl || CFG.roleUrl,
    serviceType: p.serviceType || CFG.serviceType,
    activityId: p.activityId || CFG.activityId,
    serviceDepartment: p.serviceDepartment || CFG.serviceDepartment,
    roleFlowId: p.roleFlowId || CFG.roleFlowId,
    statusFlowId: p.statusFlowId || CFG.statusFlowId,
    signFlowId: p.signFlowId || CFG.signFlowId,
    statusChartId: p.statusChartId || CFG.statusChartId,
    signChartId: p.signChartId || CFG.signChartId,
    statusIdeToken: p.statusIdeToken || CFG.statusIdeToken,
    signIdeToken: p.signIdeToken || CFG.signIdeToken,
    easUrl: p.easUrl || CFG.easUrl,
    easRefer: p.easRefer || CFG.easRefer,
  };
  return out;
}

function loadParamStore() {
  const raw = $.getdata(CFG.paramsKey) || '';
  const obj = toJSON(raw);
  if (!obj || typeof obj !== 'object') return {};
  return obj;
}

function saveParamStore(obj) {
  $.setdata($.toStr(obj), CFG.paramsKey);
}

function updateRuntimeParams(url, body) {
  const oldStore = loadParamStore();
  const p = cloneByJSON(oldStore);
  const oldSnapshot = buildRuntimeSnapshot(oldStore);

  if (url.indexOf('/ams/ame/amesvr') !== -1) {
    const q = parseQueryFromUrl(url);
    const b = parseFormBody(body);
    if (url) p.roleUrl = url;
    if (q.sServiceType || b.sServiceType) p.serviceType = q.sServiceType || b.sServiceType;
    if (q.iActivityId || b.iActivityId) p.activityId = q.iActivityId || b.iActivityId;
    if (q.sServiceDepartment || b.sServiceDepartment) p.serviceDepartment = q.sServiceDepartment || b.sServiceDepartment;
    if (b.iFlowId) p.roleFlowId = b.iFlowId;
    if (b.eas_url) p.easUrl = b.eas_url;
    if (b.eas_refer) p.easRefer = b.eas_refer;
  }

  if (url.indexOf('/ide/') !== -1 && body) {
    const b = parseFormBody(body);
    if (b.eas_url) p.easUrl = b.eas_url;
    if (b.eas_refer) p.easRefer = b.eas_refer;
    if (!p.seenCharts || typeof p.seenCharts !== 'object') p.seenCharts = {};
    if (b.iChartId) {
      const chartId = String(b.iChartId);
      const flowId = getFlowIdFromTag(b.sMiloTag || '');
      const oldItem = p.seenCharts[chartId] || {};
      const nextItem = {
        ideToken: b.sIdeToken || '',
        flowId: flowId || '',
        ts: oldItem.ts || 0,
      };
      const oldSign = stableStringify({
        ideToken: oldItem.ideToken || '',
        flowId: oldItem.flowId || '',
      });
      const newSign = stableStringify({
        ideToken: nextItem.ideToken || '',
        flowId: nextItem.flowId || '',
      });
      if (oldSign !== newSign) {
        nextItem.ts = Date.now();
        p.seenCharts[chartId] = nextItem;
      } else if (!oldItem || typeof oldItem !== 'object') {
        p.seenCharts[chartId] = nextItem;
      }
    }
    inferStatusSignBySeenCharts(p);
  }

  const newSnapshot = buildRuntimeSnapshot(p);
  const changed = stableStringify(oldSnapshot) !== stableStringify(newSnapshot);
  if (changed) {
    p.updatedAt = Date.now();
    saveParamStore(p);
  }
  return {
    changed: changed,
    previous: oldSnapshot,
    current: newSnapshot,
  };
}

function inferStatusSignBySeenCharts(p) {
  const seen = p.seenCharts || {};
  const ids = Object.keys(seen);
  if (!ids.length) return;

  const items = ids
    .map(function (id) {
      const it = seen[id] || {};
      const flow = parseInt(it.flowId || '0', 10);
      return {
        chartId: id,
        ideToken: it.ideToken || '',
        flowId: it.flowId || '',
        flowNum: isNaN(flow) ? 0 : flow,
        ts: it.ts || 0,
      };
    })
    .sort(function (a, b) {
      if (a.flowNum && b.flowNum && a.flowNum !== b.flowNum) return a.flowNum - b.flowNum;
      return a.ts - b.ts;
    });

  if (!p.statusChartId || !p.statusIdeToken || !p.statusFlowId) {
    const first = items[0];
    p.statusChartId = first.chartId;
    p.statusIdeToken = first.ideToken || p.statusIdeToken || CFG.statusIdeToken;
    p.statusFlowId = first.flowId || p.statusFlowId || CFG.statusFlowId;
  }
  if (items.length >= 2) {
    const last = items[items.length - 1];
    p.signChartId = last.chartId;
    p.signIdeToken = last.ideToken || p.signIdeToken || CFG.signIdeToken;
    p.signFlowId = last.flowId || p.signFlowId || CFG.signFlowId;
  }
}

function parseQueryFromUrl(url) {
  const out = {};
  if (!url || url.indexOf('?') === -1) return out;
  const query = url.split('?')[1] || '';
  return parseFormBody(query);
}

function parseFormBody(raw) {
  const out = {};
  if (!raw || typeof raw !== 'string') return out;
  const arr = raw.split('&');
  for (let i = 0; i < arr.length; i++) {
    const seg = arr[i];
    if (!seg) continue;
    const idx = seg.indexOf('=');
    const k = idx >= 0 ? seg.slice(0, idx) : seg;
    const v = idx >= 0 ? seg.slice(idx + 1) : '';
    const key = safeDecode(k);
    const val = safeDecode(v.replace(/\+/g, '%20'));
    if (key) out[key] = val;
  }
  return out;
}

function safeDecode(str) {
  try {
    return decodeURIComponent(str);
  } catch (e) {
    return str;
  }
}

function getFlowIdFromTag(tag) {
  if (!tag) return '';
  const arr = String(tag).split('-');
  if (arr.length < 2) return '';
  const x = arr[arr.length - 1];
  return /^\d+$/.test(x) ? x : '';
}

function cloneByJSON(obj) {
  return toJSON(JSON.stringify(obj || {}));
}

function stableStringify(value) {
  if (value === null) return 'null';
  if (typeof value === 'undefined') return 'null';
  const t = typeof value;
  if (t === 'number' || t === 'boolean') return JSON.stringify(value);
  if (t === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    const arr = [];
    for (let i = 0; i < value.length; i++) {
      arr.push(stableStringify(value[i]));
    }
    return '[' + arr.join(',') + ']';
  }
  if (t === 'object') {
    const keys = Object.keys(value).sort();
    const arr = [];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      arr.push(JSON.stringify(k) + ':' + stableStringify(value[k]));
    }
    return '{' + arr.join(',') + '}';
  }
  return JSON.stringify(String(value));
}

function saveValueIfChanged(key, nextValue) {
  if (!key) return { changed: false, oldValue: '', newValue: '' };
  const next = String(nextValue || '');
  const old = String($.getdata(key) || '');
  if (next === old) {
    return { changed: false, oldValue: old, newValue: next };
  }
  $.setdata(next, key);
  return { changed: true, oldValue: old, newValue: next };
}

function buildRuntimeSnapshot(store) {
  const p = store || {};
  return {
    roleUrl: p.roleUrl || '',
    serviceType: p.serviceType || '',
    activityId: p.activityId || '',
    serviceDepartment: p.serviceDepartment || '',
    roleFlowId: p.roleFlowId || '',
    statusFlowId: p.statusFlowId || '',
    signFlowId: p.signFlowId || '',
    statusChartId: p.statusChartId || '',
    signChartId: p.signChartId || '',
    statusIdeToken: p.statusIdeToken || '',
    signIdeToken: p.signIdeToken || '',
    easUrl: p.easUrl || '',
    easRefer: p.easRefer || '',
    seenCharts: buildSeenChartsSnapshot(p.seenCharts),
  };
}

function buildSeenChartsSnapshot(seenCharts) {
  const out = {};
  if (!seenCharts || typeof seenCharts !== 'object') return out;
  const ids = Object.keys(seenCharts).sort();
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const item = seenCharts[id] || {};
    out[id] = {
      ideToken: item.ideToken || '',
      flowId: item.flowId || '',
    };
  }
  return out;
}

function formatMapFields(map) {
  if (!map || typeof map !== 'object') return '';
  const keys = Object.keys(map).sort();
  if (!keys.length) return '';
  const out = [];
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    out.push(k + '=' + String(map[k]));
  }
  return out.join('; ');
}

function formatRuntimeParamFields(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return '';
  const keys = [
    'serviceType',
    'activityId',
    'serviceDepartment',
    'roleFlowId',
    'statusFlowId',
    'signFlowId',
    'statusChartId',
    'signChartId',
    'statusIdeToken',
    'signIdeToken',
    'easUrl',
    'easRefer',
    'roleUrl',
  ];
  const parts = [];
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    parts.push(k + '=' + (snapshot[k] || ''));
  }
  const seen = snapshot.seenCharts || {};
  const ids = Object.keys(seen).sort();
  if (ids.length) {
    const seenParts = [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const item = seen[id] || {};
      seenParts.push(id + '(flow=' + (item.flowId || '') + ',token=' + (item.ideToken || '') + ')');
    }
    parts.push('seenCharts=' + seenParts.join(','));
  } else {
    parts.push('seenCharts=');
  }
  return parts.join(' | ');
}

function getAccountHintFromCookie(cookie) {
  const openid = getCookieVal(cookie, 'openid');
  const openId = getCookieVal(cookie, 'openId');
  const uin = getCookieVal(cookie, 'uin') || getCookieVal(cookie, 'newuin');
  const parts = [];
  if (openid) parts.push('openid=' + openid);
  if (openId && openId !== openid) parts.push('openId=' + openId);
  if (uin) parts.push('uin=' + uin);
  return parts.join(' | ') || '未知账号';
}

function parseCookieMap(cookie) {
  const map = {};
  if (!cookie) return map;
  const parts = String(cookie).split(';');
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i].trim();
    if (!seg || seg.indexOf('=') < 0) continue;
    const k = seg.split('=')[0].trim();
    const v = seg.slice(k.length + 1);
    if (k) map[k] = v;
  }
  return map;
}

function cookieSignature(cookie) {
  const map = parseCookieMap(normalizeQQSGCookie(cookie));
  return stableStringify(map);
}

function buildCookieFromMap(map) {
  const keys = Object.keys(map || {});
  const parts = [];
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const v = map[k];
    if (v === undefined || v === null || v === '') continue;
    parts.push(k + '=' + v);
  }
  return parts.join('; ');
}

function normalizeQQSGCookie(cookie) {
  const map = parseCookieMap(cookie);

  // 严格模式：业务键大小写与命名必须按抓包原样保留，不做跨键补齐。
  // 例如 openId/openid、accessToken/access_token 视为不同字段。

  if (!map.appid) map.appid = '101491592';
  if (!map.acctype) map.acctype = 'qc';

  return buildCookieFromMap(map);
}

function checkLoginField(cookie) {
  const map = parseCookieMap(cookie);
  const miss = [];
  if (!map.openid) miss.push('openid');
  if (!map.access_token) miss.push('access_token');
  if (!map.appid) miss.push('appid');
  if (!map.acctype) miss.push('acctype');
  return {
    ok: miss.length === 0,
    msg: miss.length ? '缺少 ' + miss.join(', ') : 'ok',
  };
}

function parseRoleProfile(roleRes) {
  const data =
    (roleRes &&
      roleRes.modRet &&
      roleRes.modRet.jData &&
      roleRes.modRet.jData.data &&
      typeof roleRes.modRet.jData.data === 'object' &&
      roleRes.modRet.jData.data) ||
    {};
  return {
    openid: '',
    openId: '',
    uin: normalizeUin(decodeMaybe(data.Fuin || '', 2)),
    nickName: decodeMaybe(data.FnickName || '', 2),
    areaId: decodeMaybe(data.Farea || data.FPartition || '', 2),
    areaName: decodeMaybe(data.FareaName || '', 2),
    roleId: decodeMaybe(data.FroleId || '', 2),
    roleName: decodeMaybe(data.FroleName || '', 2),
    roleLevel: decodeMaybe(data.FroleLevel || '', 2),
    partition: decodeMaybe(data.FPartition || '', 2),
    platId: decodeMaybe(data.FplatId || '', 2),
  };
}

function buildProfileFromCookie(cookie) {
  const map = parseCookieMap(cookie);
  const iedRaw = map.IED_LOG_INFO_NEW || '';
  const ied = parseIEDLogInfo(iedRaw);
  return {
    openid: map.openid || ied.openid || '',
    openId: map.openId || '',
    uin: normalizeUin(map.uin || map.newuin || ied.uin || ''),
    nickName: decodeMaybe(map.nickName || ied.nickName || '', 2),
    areaId: '',
    areaName: '',
    roleId: '',
    roleName: '',
    roleLevel: '',
    partition: '',
    platId: '',
  };
}

function parseIEDLogInfo(raw) {
  const out = {};
  if (!raw) return out;
  const text = decodeMaybe(raw, 2);
  const obj = parseFormBody(text);
  if (obj.openid) out.openid = decodeMaybe(obj.openid, 2);
  if (obj.uin) out.uin = normalizeUin(decodeMaybe(obj.uin, 2));
  if (obj.nickName) out.nickName = decodeMaybe(obj.nickName, 2);
  return out;
}

function decodeMaybe(value, maxDepth) {
  let out = String(value || '').trim();
  if (!out) return '';
  const depth = typeof maxDepth === 'number' ? maxDepth : 2;
  for (let i = 0; i < depth; i++) {
    const decoded = safeDecode(out.replace(/\+/g, '%20'));
    if (!decoded || decoded === out) break;
    out = decoded;
  }
  return out;
}

function normalizeUin(v) {
  const x = String(v || '').trim();
  if (!x) return '';
  return x.replace(/^o0*/i, '');
}

function mergeProfile(base, next) {
  const b = base || {};
  const n = next || {};
  const keys = [
    'openid',
    'openId',
    'uin',
    'nickName',
    'areaId',
    'areaName',
    'roleId',
    'roleName',
    'roleLevel',
    'partition',
    'platId',
  ];
  const out = {};
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    out[k] = n[k] || b[k] || '';
  }
  return out;
}

function formatAccountLine(profile, fallbackId) {
  const p = profile || {};
  const account = p.uin || p.openid || p.openId || fallbackId || '';
  const parts = [];
  if (account) parts.push('👤账号=' + account);
  if (p.nickName) parts.push('📝昵称=' + p.nickName);
  if (p.openid) parts.push('🪪openid=' + shortId(p.openid));
  if (!parts.length) return '账号信息未返回';
  return parts.join(' | ');
}

function formatRoleLine(profile) {
  const p = profile || {};
  const area = p.areaName || p.areaId || '';
  const role = p.roleName || p.roleId || '';
  const parts = [];
  if (area) parts.push('🗺️大区=' + area);
  if (role) parts.push('🎭角色=' + role);
  if (p.roleLevel) parts.push('📈等级=' + p.roleLevel);
  if (!parts.length) return '';
  return parts.join(' | ');
}

function buildSummaryAccountPrefix(index, profile, fallbackId) {
  const p = profile || {};
  const account = p.uin || p.openid || p.openId || fallbackId || '';
  const nick = p.nickName || '';
  const area = p.areaName || p.areaId || '';
  const role = p.roleName || p.roleId || '';
  const tags = [];
  if (account) tags.push('👤' + account);
  if (nick) tags.push('📝' + nick);
  if (area) tags.push('🗺️' + area);
  if (role) tags.push('🎭' + role);
  if (!tags.length) return '🧾账号' + index;
  return '🧾账号' + index + '(' + tags.join(' | ') + ')';
}

function shortId(v) {
  const s = String(v || '');
  if (s.length <= 12) return s;
  return s.slice(0, 8) + '...' + s.slice(-4);
}

function getObjKeys(obj) {
  return Object.keys(obj || {});
}

function hasRewardMap(map) {
  return getObjKeys(map).length > 0;
}

function resolveActivityPageUrl(rcfg) {
  const easUrl = decodeMaybe((rcfg && rcfg.easUrl) || '', 2);
  if (/^https?:\/\//i.test(easUrl)) return ensureSlash(easUrl);
  if (/^https?:\/\//i.test(CFG.referer)) return ensureSlash(CFG.referer);
  return 'https://sg.qq.com/cp/a20240429gzhqd/';
}

function ensureSlash(url) {
  const u = String(url || '').trim();
  if (!u) return u;
  return /\/$/.test(u) ? u : u + '/';
}

function toAbsoluteUrl(raw, base) {
  const u = String(raw || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  if (/^\/\//.test(u)) return 'https:' + u;
  const b = String(base || '').replace(/[#?].*$/, '');
  const m = b.match(/^(https?:\/\/[^/]+)/i);
  const origin = m ? m[1] : '';
  if (/^\//.test(u)) return origin + u;
  const baseDir = b.replace(/\/[^/]*$/, '/');
  return baseDir + u.replace(/^\.\//, '');
}

function parseGiftMapFromText(text) {
  const out = {};
  const src = String(text || '');
  if (!src) return out;
  const block = src.match(/giftMap\s*=\s*\{([\s\S]*?)\}/i);
  if (!block || !block[1]) return out;
  const body = block[1];
  const reg = /(\d+)\s*:\s*(\d+)/g;
  let m;
  while ((m = reg.exec(body))) {
    const day = String(m[1] || '').trim();
    const idx = parseInt(String(m[2] || '').trim(), 10);
    if (day && !isNaN(idx) && idx > 0) out[day] = idx;
  }
  return out;
}

function stripHtmlToText(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractRewardNamesFromHtml(html) {
  const out = [];
  const src = String(html || '');
  if (!src) return out;
  const reg = /<div[^>]*class=["'][^"']*reward-name[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
  let m;
  while ((m = reg.exec(src))) {
    const text = stripHtmlToText(m[1]);
    if (text) out.push(text);
  }
  return out;
}

function extractActJsUrlFromHtml(html, pageUrl) {
  const src = String(html || '');
  const m = src.match(/<script[^>]+src=["']([^"']*\/js\/act\.js[^"']*)["']/i);
  if (!m || !m[1]) return '';
  return toAbsoluteUrl(m[1], pageUrl);
}

function defaultGiftMapByNames(rewardNames) {
  const days = [1, 3, 5, 7, 10, 15];
  const out = {};
  for (let i = 0; i < rewardNames.length && i < days.length; i++) {
    out[String(days[i])] = i + 1;
  }
  return out;
}

function buildRewardMapByGiftMap(rewardNames, giftMap) {
  const out = {};
  const names = Array.isArray(rewardNames) ? rewardNames : [];
  const gm = giftMap || {};
  const days = getObjKeys(gm);
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const idx = parseInt(String(gm[day] || ''), 10);
    if (isNaN(idx) || idx <= 0) continue;
    const name = names[idx - 1] || '';
    if (name) out['day' + day] = name;
  }
  return out;
}

function loadCachedRewardMap() {
  const raw = $.getdata(CFG.rewardMapKey) || '';
  const obj = toJSON(raw);
  if (!obj || typeof obj !== 'object') return {};
  const keys = getObjKeys(obj);
  const out = {};
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (!/^day\d+$/.test(k)) continue;
    const v = String(obj[k] || '').trim();
    if (v) out[k] = v;
  }
  return out;
}

function saveCachedRewardMap(map) {
  if (!hasRewardMap(map)) return;
  $.setdata($.toStr(map), CFG.rewardMapKey);
  $.setdata(String(Date.now()), CFG.rewardMapTsKey);
}

async function getTextByGet(url, headers) {
  if (!url) return '';
  try {
    const resp = await $.http.get({ url: url, headers: headers || {} });
    return (resp && resp.body) || '';
  } catch (e) {
    return '';
  }
}

async function fetchRewardMapLive(headers, rcfg) {
  const pageUrl = resolveActivityPageUrl(rcfg);
  const pageHeaders = {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    Referer: CFG.referer,
    'User-Agent': (headers && headers['User-Agent']) || CFG.userAgent,
  };
  const html = await getTextByGet(pageUrl, pageHeaders);
  if (!html) return {};

  const rewardNames = extractRewardNamesFromHtml(html);
  if (!rewardNames.length) return {};

  let giftMap = parseGiftMapFromText(html);
  const actJsUrl = extractActJsUrlFromHtml(html, pageUrl);
  if (actJsUrl) {
    const jsText = await getTextByGet(actJsUrl, pageHeaders);
    const jsGiftMap = parseGiftMapFromText(jsText);
    if (hasRewardMap(jsGiftMap)) giftMap = jsGiftMap;
  }
  if (!hasRewardMap(giftMap)) giftMap = defaultGiftMapByNames(rewardNames);

  return buildRewardMapByGiftMap(rewardNames, giftMap);
}

async function ensureRewardMap(headers, rcfg) {
  if (runtimeRewardMap) return runtimeRewardMap;

  const cached = loadCachedRewardMap();
  if (hasRewardMap(cached)) {
    runtimeRewardMap = cached;
    rewardMapSource = 'cache';
  } else {
    runtimeRewardMap = {};
    rewardMapSource = 'none';
  }

  const live = await fetchRewardMapLive(headers, rcfg);
  if (hasRewardMap(live)) {
    runtimeRewardMap = live;
    rewardMapSource = 'live';
    saveCachedRewardMap(live);
  }

  if (!rewardMapLogged) {
    rewardMapLogged = true;
    const count = getObjKeys(runtimeRewardMap).length;
    if (count > 0) {
      $.log('🧩 里程碑奖励映射: ' + (rewardMapSource === 'live' ? '实时解析' : '本地缓存') + ' ' + count + '项');
    } else {
      $.log('⚠️ 里程碑奖励映射: 未获取到，仅显示领取状态');
    }
  }
  return runtimeRewardMap;
}

async function runAccount(cookie, index, total) {
  const normalizedCookie = normalizeQQSGCookie(cookie);
  const ua = $.getdata(CFG.uaKey) || CFG.userAgent;
  const rcfg = getRuntimeCfg();
  const openid = getCookieVal(normalizedCookie, 'openid');
  const uin = getCookieVal(normalizedCookie, 'uin');
  const showId = uin || (openid ? openid.slice(0, 8) + '...' : '未知');
  const headers = buildHeaders(normalizedCookie, ua);
  let profile = mergeProfile(buildProfileFromCookie(normalizedCookie), {});

  $.log('\n🧾 ===== 账号 ' + index + '/' + total + ' =====');
  $.log('👤 账号信息: ' + formatAccountLine(profile, showId));
  const preRoleLine = formatRoleLine(profile);
  if (preRoleLine) $.log('🎮 角色信息: ' + preRoleLine);

  const loginCheck = checkLoginField(normalizedCookie);
  if (!loginCheck.ok) {
    $.log('❌ Cookie 登录字段不足: ' + loginCheck.msg);
    summaries.push(
      buildSummaryAccountPrefix(index, profile, showId) + ': ❌ Cookie字段不足 - ' + loginCheck.msg
    );
    return;
  }
  const gtk = getGtk(normalizedCookie);
  $.log('🔐 g_tk=' + gtk);
  if (CFG.debug) {
    $.log('🧩 运行参数: iActivityId=' + rcfg.activityId + ' statusChart=' + rcfg.statusChartId + ' signChart=' + rcfg.signChartId);
  }

  const roleUrl = $.getdata(CFG.roleUrlKey) || rcfg.roleUrl || CFG.roleUrl;
  if (gtk) {
    const roleBody = buildRoleBody(gtk, rcfg);
    const roleRes = await post(roleUrl, roleBody, headers);
    if (!isRoleOk(roleRes)) {
      const roleMsg = getRespMsg(roleRes) || '角色查询失败';
      $.log('⚠️ 角色查询异常: ' + roleMsg);
    } else {
      const roleProfile = parseRoleProfile(roleRes);
      profile = mergeProfile(profile, roleProfile);
      $.log('✅ 角色查询成功');
      $.log('👤 账号信息: ' + formatAccountLine(profile, showId));
      const roleLine = formatRoleLine(profile);
      if (roleLine) $.log('🎮 角色信息: ' + roleLine);
    }
  } else {
    $.log('⚠️ 缺少 skey/p_skey，跳过角色预查询，直接尝试状态查询');
  }

  const queryBody = buildIdeBody(rcfg.statusChartId, rcfg.statusIdeToken, rcfg.statusFlowId, rcfg);
  const queryRes = await post(CFG.ideUrl, queryBody, headers);
  const queryIRet = getIRet(queryRes);
  if (queryIRet !== 0) {
    const qMsg = getRespMsg(queryRes) || '查询状态失败';
    $.log('❌ 签到状态查询失败: ' + qMsg);
    summaries.push(buildSummaryAccountPrefix(index, profile, showId) + ': ❌ 状态查询失败 - ' + qMsg);
    return;
  }

  const rewardMap = await ensureRewardMap(headers, rcfg);
  const queryDays = getSignDays(queryRes);
  const signState = getTodaySignState(queryRes);
  const milestoneState = getMilestoneStateText(queryRes, rewardMap);
  if (queryDays >= 0) $.log('📅 本月累计签到: ' + queryDays + ' 天');
  if (milestoneState) $.log('🎯 里程碑状态: ' + milestoneState);
  if (signState === null) {
    $.log('⚠️ 状态字段不足：未发现 hold.sign 的有效字段，停止执行以避免误签到');
    summaries.push(
      buildSummaryAccountPrefix(index, profile, showId) +
        ': ⚠️ 状态不可判定，已停止执行（避免盲目签到）' +
        (queryDays >= 0 ? ' | 📅当前累签' + queryDays + '天' : '')
    );
    return;
  }
  const signedToday = signState;
  $.log('🧭 状态判定: ' + (signedToday ? '今日已签，停止签到请求' : '今日未签，继续签到请求'));

  if (signedToday) {
    const queryPackage = getPackageName(queryRes);
    const queryRewardDay = getRewardDay(queryRes);
    if (queryPackage || queryRewardDay > 0) {
      $.log(
        '🎁 服务端奖励字段: day=' +
          (queryRewardDay > 0 ? queryRewardDay : '-') +
          ' packageName=' +
          (queryPackage || '空')
      );
    } else {
      $.log('🎁 服务端奖励字段: 状态查询接口未返回 packageName/day');
    }
    const rewardText = buildRewardText({
      signDays: queryDays,
      packageName: queryPackage,
      rewardDay: queryRewardDay,
      byQuery: true,
      queryRes: queryRes,
      rewardNameMap: rewardMap,
    });
    const notifyRewardText = formatRewardForNotify(rewardText);
    $.log('✅ 今日已签到');
    $.log('🎁 今日奖励: ' + rewardText);
    summaries.push(
      buildSummaryAccountPrefix(index, profile, showId) +
        ': ✅ 已签到 | 📅累签' +
        (queryDays >= 0 ? queryDays : '?') +
        '天' +
        (notifyRewardText ? ' | 🎁奖励:' + notifyRewardText : '')
    );
    return;
  }

  const signBody = buildIdeBody(rcfg.signChartId, rcfg.signIdeToken, rcfg.signFlowId, rcfg);
  const signRes = await post(CFG.ideUrl, signBody, headers);
  const signIRet = getIRet(signRes);
  const signMsg = getRespMsg(signRes) || '未知';
  if (signIRet === 0) {
    const signDaysRaw = getSignDays(signRes);
    const finalDays = signDaysRaw >= 0 ? signDaysRaw : queryDays >= 0 ? queryDays + 1 : -1;
    const signPackage = getPackageName(signRes);
    const signRewardDay = getRewardDay(signRes);
    if (signPackage || signRewardDay > 0) {
      $.log(
        '🎁 服务端奖励字段: day=' +
          (signRewardDay > 0 ? signRewardDay : '-') +
          ' packageName=' +
          (signPackage || '空')
      );
    } else {
      $.log('🎁 服务端奖励字段: 未返回 packageName/day');
    }
    const rewardText = buildRewardText({
      signDays: finalDays,
      packageName: signPackage,
      rewardDay: signRewardDay,
      byQuery: false,
      queryRes: queryRes,
      rewardNameMap: rewardMap,
    });
    const notifyRewardText = formatRewardForNotify(rewardText);
    $.log('✅ 签到成功: ' + signMsg);
    if (finalDays >= 0) $.log('📅 本月累计签到: ' + finalDays + ' 天');
    $.log('🎁 今日奖励: ' + rewardText);
    summaries.push(
      buildSummaryAccountPrefix(index, profile, showId) +
        ': ✅ 签到成功 | 📅累签' +
        (finalDays >= 0 ? finalDays : '?') +
        '天' +
        (notifyRewardText ? ' | 🎁奖励:' + notifyRewardText : '') +
        ' | ' +
        signMsg
    );
  } else {
    $.log('❌ 签到失败: ' + signMsg);
    summaries.push(
      buildSummaryAccountPrefix(index, profile, showId) +
        ': ❌ 签到失败 - ' +
        signMsg +
        (queryDays >= 0 ? ' | 📅当前累签' + queryDays + '天' : '')
    );
  }
}

function buildHeaders(cookie, ua) {
  return {
    Accept: 'application/json, text/plain, */*',
    'Content-Type': 'application/x-www-form-urlencoded',
    Origin: CFG.origin,
    Referer: CFG.referer,
    'User-Agent': ua || CFG.userAgent,
    Cookie: cookie,
  };
}

function buildRoleBody(gtk, rcfg) {
  return formEncode({
    sServiceType: rcfg.serviceType,
    iActivityId: rcfg.activityId,
    sServiceDepartment: rcfg.serviceDepartment,
    iFlowId: rcfg.roleFlowId,
    g_tk: String(gtk),
    sMiloTag: makeMiloTag(rcfg.roleFlowId, rcfg),
    e_code: '0',
    g_code: '0',
    eas_url: rcfg.easUrl,
    eas_refer: rcfg.easRefer,
    query: 'true',
    sRoleId: 'undefined',
  });
}

function buildIdeBody(chartId, ideToken, flowId, rcfg) {
  return formEncode({
    iChartId: chartId,
    iSubChartId: chartId,
    sIdeToken: ideToken,
    e_code: '0',
    g_code: '0',
    eas_url: rcfg.easUrl,
    eas_refer: rcfg.easRefer,
    sMiloTag: makeMiloTag(flowId, rcfg),
  });
}

function makeMiloTag(flowId, rcfg) {
  return 'AMS-' + rcfg.serviceType + '-' + nowTagTime() + '-' + randomWord(6) + '-' + rcfg.activityId + '-' + flowId;
}

function nowTagTime() {
  const d = new Date();
  return (
    pad2(d.getMonth() + 1) +
    pad2(d.getDate()) +
    pad2(d.getHours()) +
    pad2(d.getMinutes()) +
    pad2(d.getSeconds())
  );
}

function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

function randomWord(len) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

function formEncode(obj) {
  const keys = Object.keys(obj);
  const arr = [];
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    let v = obj[k];
    if (v === undefined || v === null) v = '';
    arr.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
  }
  return arr.join('&');
}

async function post(url, body, headers) {
  const resp = await $.http.post({ url: url, headers: headers, body: body });
  if (CFG.debug) {
    $.log('🌐 POST ' + url);
    $.log('↪ status=' + (resp && (resp.statusCode || resp.status)));
  }
  return toJSON(resp && resp.body);
}

function toJSON(str) {
  if (!str || typeof str !== 'string') return {};
  try {
    return JSON.parse(str);
  } catch (e) {
    return {};
  }
}

function getIRet(obj) {
  if (!obj || typeof obj !== 'object') return -1;
  if (typeof obj.iRet !== 'undefined') return Number(obj.iRet);
  if (obj.jData && typeof obj.jData.iRet !== 'undefined') return Number(obj.jData.iRet);
  return -1;
}

function toInt(value, fallback) {
  const n = parseInt(String(value), 10);
  return isNaN(n) ? fallback : n;
}

function getSignDays(obj) {
  if (!obj || !obj.jData) return -1;
  return toInt(obj.jData.ticket, -1);
}

function getHoldMap(obj) {
  if (!obj || !obj.jData || !obj.jData.hold || typeof obj.jData.hold !== 'object') return {};
  return obj.jData.hold;
}

function getTodaySignState(obj) {
  const hold = getHoldMap(obj);
  const sign = hold.sign;
  if (!sign || typeof sign !== 'object') return null;

  const hasUsed = typeof sign.iUsedNum !== 'undefined';
  const hasLeft = typeof sign.iLeftNum !== 'undefined';
  if (!hasUsed && !hasLeft) return null;

  const used = toInt(sign.iUsedNum, -1);
  const left = toInt(sign.iLeftNum, -1);
  if (used > 0) return true;
  if (left >= 0 && left <= 0) return true;
  if (used === 0) return false;
  if (left > 0) return false;
  return null;
}

function getPackageName(obj) {
  if (!obj || !obj.jData) return '';
  const x = obj.jData.packageName;
  return typeof x === 'string' ? x.trim() : '';
}

function getRewardDay(obj) {
  if (!obj || !obj.jData) return -1;
  return toInt(obj.jData.day, -1);
}

function getMilestoneDaysFromHold(hold) {
  const keys = Object.keys(hold || {});
  const days = [];
  for (let i = 0; i < keys.length; i++) {
    const m = keys[i].match(/^day(\d+)$/);
    if (!m) continue;
    const n = toInt(m[1], -1);
    if (n > 0) days.push(n);
  }
  days.sort(function (a, b) {
    return a - b;
  });
  return days;
}

function hasMilestoneDay(hold, day) {
  return !!(hold && Object.prototype.hasOwnProperty.call(hold, 'day' + day));
}

function hasNameHintKey(key) {
  return /(name|package|reward|award|prize|gift|item|goods|title|desc|礼包|奖励|奖品|道具)/i.test(
    String(key || '')
  );
}

function isUsefulRewardText(v) {
  const s = String(v || '').trim();
  if (!s) return false;
  if (/^(succ|ok|null|undefined|none)$/i.test(s)) return false;
  if (/^\d+$/.test(s)) return false;
  if (/^https?:\/\//i.test(s)) return false;
  if (s.length > 96) return false;
  return true;
}

function collectRewardNameCandidates(node, out, depth) {
  if (!node || depth > 4) return;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      collectRewardNameCandidates(node[i], out, depth + 1);
    }
    return;
  }
  if (typeof node !== 'object') return;
  const keys = Object.keys(node);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const val = node[k];
    if (typeof val === 'string' && hasNameHintKey(k)) {
      const txt = decodeMaybe(val, 2);
      if (isUsefulRewardText(txt)) out.push(txt);
    }
    if (val && typeof val === 'object') {
      collectRewardNameCandidates(val, out, depth + 1);
    }
  }
}

function getMilestoneRewardName(item, day, rewardNameMap) {
  const candidates = [];
  collectRewardNameCandidates(item || {}, candidates, 0);
  if (candidates.length) return candidates[0];
  const key = 'day' + String(day || '');
  if (rewardNameMap && rewardNameMap[key]) return String(rewardNameMap[key]).trim();
  return '';
}

function getMilestoneStateText(obj, rewardNameMap) {
  const hold = getHoldMap(obj);
  const days = getMilestoneDaysFromHold(hold);
  if (!days.length) return '';

  const out = [];
  let unknownRewardCount = 0;
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const item = hold['day' + day] || {};
    const used = toInt(item.iUsedNum, 0);
    const rewardName = getMilestoneRewardName(item, day, rewardNameMap);
    const state = day + '天' + (used > 0 ? '已领' : '未领');
    if (rewardName) {
      out.push(state + '(奖励:' + rewardName + ')');
    } else {
      out.push(state);
      unknownRewardCount += 1;
    }
  }
  if (unknownRewardCount > 0) {
    out.push('奖励名未返回:' + unknownRewardCount + '项');
  }
  return out.join(' ');
}

function buildRewardText(opts) {
  const signDays = opts && typeof opts.signDays === 'number' ? opts.signDays : -1;
  const packageName = opts && opts.packageName ? String(opts.packageName).trim() : '';
  const rewardDay = opts && typeof opts.rewardDay === 'number' ? opts.rewardDay : -1;
  const byQuery = !!(opts && opts.byQuery);
  const queryRes = (opts && opts.queryRes) || {};
  const rewardNameMap = (opts && opts.rewardNameMap) || {};
  const hold = getHoldMap(queryRes);
  const hasMilestoneInfo = getMilestoneDaysFromHold(hold).length > 0;

  // 奖励名以服务端返回为准，避免活动月更替导致脚本内写死失效
  if (packageName) return packageName;

  if (rewardDay > 0) {
    return '第' + rewardDay + '天奖励（名称未返回）';
  }

  if (signDays > 0 && hasMilestoneDay(hold, signDays)) {
    const item = hold['day' + signDays] || {};
    const used = toInt(item.iUsedNum, 0);
    const rewardName = getMilestoneRewardName(item, signDays, rewardNameMap) || '奖励名未返回';
    if (byQuery) {
      return (
        '第' + signDays + '天奖励:' + rewardName + (used > 0 ? '（已领取）' : '（待领取）')
      );
    }
    return '第' + signDays + '天奖励:' + rewardName;
  }

  if (signDays > 0 && hasMilestoneInfo) return '无（非奖励日）';
  return byQuery ? '已签到（奖励信息未返回）' : '无（未返回奖励信息）';
}

function formatRewardForNotify(rewardText) {
  const raw = String(rewardText || '').trim();
  if (!raw) return '';
  if (raw === '无（非奖励日）') return '';
  if (!/奖励名未返回|未返回奖励信息|名称未返回/.test(raw)) return raw;

  let concise = raw
    .replace(/奖励名未返回/g, '')
    .replace(/（名称未返回）/g, '')
    .replace(/（未返回奖励信息）/g, '')
    .replace(/[:：]\s*（已领取）/g, '')
    .replace(/[:：]\s*（待领取）/g, '')
    .replace(/未返回奖励信息/g, '')
    .replace(/:\s*$/g, '')
    .replace(/：\s*$/g, '')
    .replace(/（\s*）/g, '')
    .trim();

  if (!concise) return '';
  if (concise === '已签到' || concise === '无') return '';
  return concise;
}

function getRespMsg(obj) {
  if (!obj || typeof obj !== 'object') return '';
  if (obj.sMsg) return String(obj.sMsg);
  if (obj.jData && obj.jData.sMsg) return String(obj.jData.sMsg);
  return '';
}

function isRoleOk(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const flowRet = obj.flowRet || {};
  if (String(flowRet.iRet || '') !== '0') return false;
  const modRet = obj.modRet || {};
  const jData = modRet.jData || {};
  if (typeof jData.iRet !== 'undefined' && Number(jData.iRet) !== 0) return false;
  return true;
}

function getCookieVal(cookie, key) {
  if (!cookie) return '';
  const reg = new RegExp('(?:^|;\\s*)' + key.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + '=([^;]*)');
  const m = cookie.match(reg);
  return m ? m[1] : '';
}

function getGtk(cookie) {
  const skey = getCookieVal(cookie, 'skey') || getCookieVal(cookie, 'p_skey');
  if (!skey) return 0;
  let hash = 5381;
  for (let i = 0; i < skey.length; i++) {
    hash += (hash << 5) + skey.charCodeAt(i);
  }
  return hash & 2147483647;
}

function buildNotifySubtitle(lines) {
  const list = Array.isArray(lines) ? lines : [];
  if (!list.length) return '📌 签到结果';
  const first = String(list[0] || '');
  const status = first.indexOf('✅') >= 0 ? '✅' : first.indexOf('❌') >= 0 ? '❌' : first.indexOf('⚠️') >= 0 ? '⚠️' : '📌';
  const infoMatch = first.match(/🧾账号\d+\(([^)]+)\)/);
  const dayMatch = first.match(/📅(?:累签|当前累签)(\d+天)/);
  let info = infoMatch && infoMatch[1] ? infoMatch[1] : '';
  if (dayMatch && dayMatch[1]) {
    info = info ? info + ' | 📅' + dayMatch[1] : '📅' + dayMatch[1];
  }
  if (!info) info = 'QQ三国';
  if (list.length > 1) info += ' | + ' + (list.length - 1) + '账号';
  return status + ' ' + info;
}

function notifyFinal() {
  if (!summaries.length) {
    $.msg($.name, '⚠️ 无结果', '请查看日志定位原因');
    return;
  }
  const subtitle = buildNotifySubtitle(summaries);
  const text = summaries.join('\n');
  $.msg($.name, subtitle, text);
}

// prettier-ignore
function Env(t,e){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`🔔${this.name}, 开始!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}isShadowrocket(){return"undefined"!=typeof $rocket}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getjson(t,e){let s=e;const i=this.getdata(t);if(i)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,i)=>e(i))})}runScript(t,e){return new Promise(s=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let r=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");r=r?1*r:20,r=e&&e.timeout?e.timeout:r;const[o,h]=i.split("@"),a={url:`http://${h}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:r},headers:{"X-Key":o,Accept:"*/*"}};this.post(a,(t,e,i)=>s(i))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e);if(!s&&!i)return{};{const i=s?t:e;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e),r=JSON.stringify(this.data);s?this.fs.writeFileSync(t,r):i?this.fs.writeFileSync(e,r):this.fs.writeFileSync(t,r)}}lodash_get(t,e,s){const i=e.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of i)if(r=Object(r)[t],void 0===r)return s;return r}lodash_set(t,e,s){return Object(t)!==t?t:(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce((t,s,i)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[i+1])>>0==+e[i+1]?[]:{},t)[e[e.length-1]]=s,t)}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,r]=/^@(.*?)\.(.*?)$/.exec(e),o=this.getval(i),h=i?"null"===o?null:o||"{}":"{}";try{const e=JSON.parse(h);this.lodash_set(e,r,t),s=this.setval(JSON.stringify(e),i)}catch(e){const o={};this.lodash_set(o,r,t),s=this.setval(JSON.stringify(o),i)}}else s=this.setval(t,e);return s}getval(t){return this.isSurge()||this.isLoon()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setval(t,e){return this.isSurge()||this.isLoon()?$persistentStore.write(t,e):this.isQuanX()?$prefs.setValueForKey(t,e):this.isNode()?(this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0):this.data&&this.data[e]||null}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,e=(()=>{})){t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isLoon()?(this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)})):this.isQuanX()?(this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t))):this.isNode()&&(this.initGotEnv(t),this.got(t).on("redirect",(t,e)=>{try{if(t.headers["set-cookie"]){const s=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();s&&this.ckjar.setCookieSync(s,null),e.cookieJar=this.ckjar}}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)}))}post(t,e=(()=>{})){const s=t.method?t.method.toLocaleLowerCase():"post";if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient[s](t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)});else if(this.isQuanX())t.method=s,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t));else if(this.isNode()){this.initGotEnv(t);const{url:i,...r}=t;this.got[s](i,r).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)})}}time(t,e=null){const s=e?new Date(e):new Date;let i={"M+":s.getMonth()+1,"d+":s.getDate(),"H+":s.getHours(),"m+":s.getMinutes(),"s+":s.getSeconds(),"q+":Math.floor((s.getMonth()+3)/3),S:s.getMilliseconds()};/(y+)/.test(t)&&(t=t.replace(RegExp.$1,(s.getFullYear()+"").substr(4-RegExp.$1.length)));for(let e in i)new RegExp("("+e+")").test(t)&&(t=t.replace(RegExp.$1,1==RegExp.$1.length?i[e]:("00"+i[e]).substr((""+i[e]).length)));return t}msg(e=t,s="",i="",r){const o=t=>{if(!t)return t;if("string"==typeof t)return this.isLoon()?t:this.isQuanX()?{"open-url":t}:this.isSurge()?{url:t}:void 0;if("object"==typeof t){if(this.isLoon()){let e=t.openUrl||t.url||t["open-url"],s=t.mediaUrl||t["media-url"];return{openUrl:e,mediaUrl:s}}if(this.isQuanX()){let e=t["open-url"]||t.url||t.openUrl,s=t["media-url"]||t.mediaUrl;return{"open-url":e,"media-url":s}}if(this.isSurge()){let e=t.url||t.openUrl||t["open-url"];return{url:e}}}};if(this.isMute||(this.isSurge()||this.isLoon()?$notification.post(e,s,i,o(r)):this.isQuanX()&&$notify(e,s,i,o(r))),!this.isMuteLog){let t=["","==============📣系统通知📣=============="];t.push(e),s&&t.push(s),i&&t.push(i),console.log(t.join("\n")),this.logs=this.logs.concat(t)}}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`❗️${this.name}, 错误!`,t.stack):this.log("",`❗️${this.name}, 错误!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`🔔${this.name}, 结束! 🕛 ${s} 秒`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}}(t,e)}




