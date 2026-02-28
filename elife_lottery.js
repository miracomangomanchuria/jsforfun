/*
本脚本仅供个人学习交流使用，严禁用于任何商业用途，请于下载后24小时内删除。
脚本无意侵犯任何第三方的肖像权、名誉权、著作权、商标权等合法权益，如涉嫌侵权，请权利人联系脚本，脚本将在收到通知后24小时内删除相关内容。
e生活抽奖（QX/Surge/Loon/Node）

QX抓包：
[rewrite_local]
^https:\/\/chp\.icbc\.com\.cn\/bmcs\/api-bmcs\/v[23]\/lott\/h5\/getActivityDetail(?:\?.*)?$ url script-request-header elife_lottery.js
^https:\/\/eiop\.icbc\.com\.cn\/actugs\/cCoupon\/listCashbackCoupon\.action$      url script-request-body elife_lottery.js
[mitm]
hostname = chp.icbc.com.cn, eiop.icbc.com.cn
*/

const $ = new Env('e生活抽奖');
const VER = 'v1.0.5';
const STORE_KEY = 'elife_lottery_capture_state_v1';

const CAPTURE_QX = String.raw`[rewrite_local]
^https:\/\/chp\.icbc\.com\.cn\/bmcs\/api-bmcs\/v[23]\/lott\/h5\/getActivityDetail(?:\?.*)?$ url script-request-header elife_lottery.js
^https:\/\/eiop\.icbc\.com\.cn\/actugs\/cCoupon\/listCashbackCoupon\.action$      url script-request-body elife_lottery.js
[mitm]
hostname = chp.icbc.com.cn, eiop.icbc.com.cn`;

const CAPTURE_LOON = String.raw`[Script]
http-request ^https:\/\/chp\.icbc\.com\.cn\/bmcs\/api-bmcs\/v[23]\/lott\/h5\/getActivityDetail(?:\?.*)?$ script-path=elife_lottery.js, requires-body=false, timeout=60, tag=elife_lottery_capture_lottery
http-request ^https:\/\/eiop\.icbc\.com\.cn\/actugs\/cCoupon\/listCashbackCoupon\.action$ script-path=elife_lottery.js, requires-body=true, timeout=60, tag=elife_lottery_capture_coupon
[MITM]
hostname = chp.icbc.com.cn, eiop.icbc.com.cn`;

const CAPTURE_SURGE = String.raw`[Script]
elife_lottery_capture_lottery = type=http-request,pattern=^https:\/\/chp\.icbc\.com\.cn\/bmcs\/api-bmcs\/v[23]\/lott\/h5\/getActivityDetail(?:\?.*)?$,script-path=elife_lottery.js,requires-body=0,timeout=60
elife_lottery_capture_coupon = type=http-request,pattern=^https:\/\/eiop\.icbc\.com\.cn\/actugs\/cCoupon\/listCashbackCoupon\.action$,script-path=elife_lottery.js,requires-body=1,timeout=60
[MITM]
hostname = chp.icbc.com.cn, eiop.icbc.com.cn`;

const DEFAULT_ACTS = [
  { key: 'daily', name: '刷卡金天天抽', actId: 'LOT20251230091958948510' },
  { key: 'food', name: '美食刮刮乐', actId: 'LOT20251231142538552213' },
  { key: 'weekly', name: '周周好运刮刮乐', actId: 'LOT20260104093637913054' },
  { key: 'movie', name: '电影刮刮乐', actId: 'LOT20260104114622189618' },
];

const arg = parseArg(typeof $argument === 'string' ? $argument : '');
const CFG = {
  queryOnly: toBool(arg.query_only, false),
  maxDrawEach: toInt(arg.max_draw_each, 3),
  couponFetchNum: toInt(arg.coupon_fetch_num, 20),
  couponMaxPages: toInt(arg.coupon_max_pages, 8),
  detailTimeout: toInt(arg.detail_timeout_ms, 20000),
  drawTimeout: toInt(arg.draw_timeout_ms, 20000),
  couponTimeout: toInt(arg.coupon_timeout_ms, 20000),
  debug: toBool(arg.debug, false),
};
if (CFG.maxDrawEach < 1) CFG.maxDrawEach = 1;
if (CFG.couponFetchNum < 1) CFG.couponFetchNum = 20;
if (CFG.couponMaxPages < 1) CFG.couponMaxPages = 8;

const BJ_DRAW_START_HOUR = 9;
const BJ_DRAW_START_MINUTE = 30;

Promise.resolve()
  .then(async function () {
    log('==========');
    log('🚀 启动 ' + VER + ' | query_only=' + CFG.queryOnly + ' | maxDrawEach=' + CFG.maxDrawEach);
    log('🕘 北京时间: ' + formatBeijingNow() + ' | 抽奖开始=' + pad2(BJ_DRAW_START_HOUR) + ':' + pad2(BJ_DRAW_START_MINUTE));

    if (typeof $request !== 'undefined') {
      captureReq();
      return;
    }

    const st = loadState();
    const hasLotteryCapture = !!(st.lottery && txt(st.lottery.cookie) && txt(st.lottery.ua));
    const hasCouponCapture = !!(st.coupon && txt(st.coupon.cookie) && txt(st.coupon.ua));
    const acts = buildActs();
    const runLines = [];
    const prizes = [];

    if (!hasLotteryCapture && !hasCouponCapture) {
      const g = captureGuideByClient();
      log('❌ 缺少抓包字段（lottery/coupon）');
      log('📋 抓包配置:\n' + g);
      $.msg($.name, '缺少抓包字段', '请先抓 getActivityDetail / listCashbackCoupon.action\n' + g);
      return;
    }

    if (hasLotteryCapture) {
      for (let i = 0; i < acts.length; i++) {
        const rs = await runOneActivity(st, acts[i]);
        runLines.push(formatActLine(acts[i].name, rs));
        for (let j = 0; j < (rs.prizes || []).length; j++) {
          prizes.push('🎁 ' + acts[i].name + ': ' + rs.prizes[j]);
        }
      }
    } else {
      log('⚠️ 未抓到抽奖参数（getActivityDetail），本次仅执行查券汇总');
      for (let i = 0; i < acts.length; i++) {
        runLines.push('⏭️ ' + acts[i].name + ': 未抓抽奖参数，仅查券');
      }
    }

    const couponInfo = hasCouponCapture
      ? await queryValidCoupons(st)
      : { ok: false, reason: '未抓到券列表请求(listCashbackCoupon.action)，已跳过查券', totalValid: 0, categories: {} };

    const lines = [];
    lines.push('📌 抽奖执行结果');
    lines.push(runLines.join('\n'));
    lines.push('');
    lines.push('✨ 本次奖品');
    lines.push(prizes.length ? prizes.join('\n') : '无新增奖品');
    lines.push('');
    lines.push('🧾 有效券汇总');
    lines.push(formatCouponBrief(couponInfo));

    $.msg($.name, buildSubtitle(runLines, couponInfo), lines.join('\n'));
  })
  .catch(function (e) {
    $.logErr(e);
  })
  .finally(function () {
    log('🏁 结束 ' + VER);
    log('==========');
    $.done();
  });

function buildActs() {
  const m = {
    daily: txt(arg.act_daily),
    food: txt(arg.act_food),
    weekly: txt(arg.act_weekly),
    movie: txt(arg.act_movie),
  };
  const out = [];
  for (let i = 0; i < DEFAULT_ACTS.length; i++) {
    out.push({ key: DEFAULT_ACTS[i].key, name: DEFAULT_ACTS[i].name, actId: m[DEFAULT_ACTS[i].key] || DEFAULT_ACTS[i].actId });
  }
  return out;
}

function captureReq() {
  const url = txt($request.url);
  const method = txt($request.method || 'GET').toUpperCase();
  const body = typeof $request.body === 'string' ? $request.body : '';
  const d = detectCap(url, method);
  if (!d) return;

  const hs = normHeaders($request.headers || {});
  const st = loadState();
  const oldS = st[d.type] ? JSON.stringify(st[d.type]) : '';

  if (d.type === 'lottery') {
    const q = parseQuery(url);
    const ref = txt(hs.referer);
    st.lottery = {
      type: 'lottery',
      host: d.host,
      path: d.path,
      version: d.version,
      corpId: txt(q.corpId) || txt(st.lottery && st.lottery.corpId) || '2000000882',
      roccSwt: txt(q.roccSwt) || txt(st.lottery && st.lottery.roccSwt) || '0',
      ua: txt(hs['user-agent']),
      cookie: txt(hs.cookie),
      referer: ref,
      origin: txt(hs.origin) || deriveOrigin(ref) || 'https://chp.icbc.com.cn',
      contentType: txt(hs['content-type']) || 'application/json; charset=UTF-8',
      updateAt: now(),
    };
  } else {
    const ref = txt(hs.referer);
    const ck = txt(hs.cookie);
    st.coupon = {
      type: 'coupon',
      host: d.host,
      path: d.path,
      ua: txt(hs['user-agent']),
      cookie: ck,
      referer: ref || 'https://eiop.icbc.com.cn/actugsnewweb/dist/',
      origin: txt(hs.origin) || deriveOrigin(ref) || 'https://eiop.icbc.com.cn',
      contentType: txt(hs['content-type']) || 'application/json',
      eiopugsSessionId: txt(hs.eiopugssessionid) || getCookieField(ck, 'EIOP_ACT_UGS_SESSIONID'),
      lastBody: body,
      updateAt: now(),
    };
  }

  const newS = st[d.type] ? JSON.stringify(st[d.type]) : '';
  if (oldS === newS) {
    log('ℹ️ 抓包字段无变化: ' + d.type);
    return;
  }

  saveState(st);
  if (d.type === 'lottery') {
    const msg = [
      'type=lottery_state',
      'url=' + url,
      'version=' + st.lottery.version,
      'corpId=' + st.lottery.corpId,
      'roccSwt=' + st.lottery.roccSwt,
      'ua=' + st.lottery.ua,
      'cookie=' + st.lottery.cookie,
      'referer=' + st.lottery.referer,
      'origin=' + st.lottery.origin,
      'updatedAt=' + st.lottery.updateAt,
    ].join('\n');
    log('✅ 抓包更新: lottery_state');
    log(msg);
    $.msg($.name, '抓包更新: lottery_state', msg);
  } else {
    const msg = [
      'type=coupon_list',
      'url=' + url,
      'ua=' + st.coupon.ua,
      'cookie=' + st.coupon.cookie,
      'eiopugsSessionId=' + st.coupon.eiopugsSessionId,
      'referer=' + st.coupon.referer,
      'origin=' + st.coupon.origin,
      'body=' + body,
      'updatedAt=' + st.coupon.updateAt,
    ].join('\n');
    log('✅ 抓包更新: coupon_list');
    log(msg);
    $.msg($.name, '抓包更新: coupon_list', msg);
  }
}

function detectCap(url, method) {
  const p = parseUrl(url);
  if (!p) return null;
  if (method === 'GET' && p.host === 'chp.icbc.com.cn' && (p.path === '/bmcs/api-bmcs/v3/lott/h5/getActivityDetail' || p.path === '/bmcs/api-bmcs/v2/lott/h5/getActivityDetail')) {
    return { type: 'lottery', host: p.host, path: p.path, version: p.path.indexOf('/v3/') >= 0 ? 'v3' : 'v2' };
  }
  if (method === 'POST' && p.host === 'eiop.icbc.com.cn' && p.path === '/actugs/cCoupon/listCashbackCoupon.action') {
    return { type: 'coupon', host: p.host, path: p.path };
  }
  return null;
}

function loadState() {
  const obj = toJSON($.getdata(STORE_KEY), {});
  if (!obj || typeof obj !== 'object') return { lottery: {}, coupon: {} };
  if (!obj.lottery || typeof obj.lottery !== 'object') obj.lottery = {};
  if (!obj.coupon || typeof obj.coupon !== 'object') obj.coupon = {};
  return obj;
}

function saveState(st) {
  $.setdata(JSON.stringify(st || {}), STORE_KEY);
}

function captureGuideByClient() {
  if ($.isQuanX()) return CAPTURE_QX;
  if ($.isLoon()) return CAPTURE_LOON;
  if ($.isSurge()) return CAPTURE_SURGE;
  return 'QX:\n' + CAPTURE_QX + '\n\nLoon:\n' + CAPTURE_LOON + '\n\nSurge:\n' + CAPTURE_SURGE;
}
async function runOneActivity(st, act) {
  log('----------');
  log('🎯 活动: ' + act.name + ' | actId=' + act.actId);

  const detail = parseDetail(await reqDetail(st, act.actId));
  if (!detail.ok) return { category: detail.category || 'parse_error', reason: detail.msg || '状态解析失败', prizes: [] };

  log('📊 状态: drawFlag=' + detail.drawFlag + ' | drawCount=' + detail.drawCount + ' | totalCount=' + detail.totalCount + ' | errCode=' + detail.errCode + ' | errMsg=' + detail.errMsg);

  if (!CFG.queryOnly && !isAfterBeijingDrawStart() && shouldTreatAsTimeLocked(detail)) {
    return { category: 'time_locked', reason: detail.errMsg || ('北京时间' + pad2(BJ_DRAW_START_HOUR) + ':' + pad2(BJ_DRAW_START_MINUTE) + '后开放'), prizes: [], remain: detail.drawCount, totalCount: detail.totalCount };
  }
  if (!detail.drawFlag || detail.drawCount <= 0) {
    return { category: 'already_done', reason: detail.errMsg || '无可用次数', prizes: [], remain: detail.drawCount, totalCount: detail.totalCount };
  }
  if (CFG.queryOnly) {
    return { category: 'query_only', reason: 'query_only=true，跳过刮奖', prizes: [], remain: detail.drawCount, totalCount: detail.totalCount };
  }
  if (!isAfterBeijingDrawStart()) {
    return { category: 'time_locked', reason: '北京时间' + pad2(BJ_DRAW_START_HOUR) + ':' + pad2(BJ_DRAW_START_MINUTE) + '后开放', prizes: [], remain: detail.drawCount, totalCount: detail.totalCount };
  }

  let remain = detail.drawCount;
  let done = 0;
  const prizes = [];
  const maxTry = Math.min(remain, CFG.maxDrawEach);

  for (let i = 0; i < maxTry; i++) {
    const draw = parseDraw(await reqDraw(st, act.actId));
    if (!draw.ok) {
      log('❌ 刮奖失败: code=' + draw.code + ' | returnCode=' + draw.returnCode + ' | errCode=' + draw.errCode + ' | msg=' + draw.msg);
      if (String(draw.errCode) === '200004' || txt(draw.msg).indexOf('次数用完') >= 0) {
        return { category: 'already_done', reason: draw.msg || '次数已用完', prizes: prizes, done: done };
      }
      return { category: 'action_rejected', reason: draw.msg || '服务端拒绝', prizes: prizes, done: done };
    }

    const pz = draw.prizeName || '奖励名未返回';
    prizes.push(pz);
    done += 1;
    log('✅ 第' + done + '次刮奖: ' + pz);

    const re = parseDetail(await reqDetail(st, act.actId));
    if (re.ok) {
      remain = re.drawCount;
      log('🔁 刮后状态: drawFlag=' + re.drawFlag + ' | drawCount=' + re.drawCount + ' | errMsg=' + re.errMsg);
      if (!re.drawFlag || re.drawCount <= 0) break;
    } else {
      remain -= 1;
      if (remain <= 0) break;
    }
  }

  return { category: 'ok', reason: done > 0 ? '执行完成' : '未执行', prizes: prizes, done: done };
}

function formatActLine(name, rs) {
  if (rs.category === 'ok') return '✅ ' + name + ': 已刮' + toInt(rs.done, 0) + '次 | 本次=' + (rs.prizes.length ? rs.prizes.join('、') : '奖励名未返回');
  if (rs.category === 'already_done') return '⏭️ ' + name + ': 无可用次数' + fmtRemain(rs) + ' | ' + (rs.reason || '已刮过');
  if (rs.category === 'query_only') return '🧪 ' + name + ': 状态可刮，query_only跳过' + fmtRemain(rs);
  if (rs.category === 'time_locked') return '🕘 ' + name + ': 未到时间' + fmtRemain(rs) + ' | ' + (rs.reason || '');
  return '❌ ' + name + ': ' + (rs.reason || rs.category || '失败');
}

function fmtRemain(rs) {
  const n = toInt(rs && rs.remain, -1);
  return n >= 0 ? ' | 剩余' + n + '次' : '';
}

function shouldTreatAsTimeLocked(detail) {
  const msg = txt(detail && detail.errMsg);
  if (toInt(detail && detail.drawCount, 0) > 0) return true;
  return /(?:^|[^\d])(9:30|09:30|9：30|09：30)(?:$|[^\d])/.test(msg) || msg.indexOf('开始') >= 0;
}

function buildSubtitle(runLines, couponInfo) {
  let ok = 0, skip = 0, bad = 0;
  for (let i = 0; i < runLines.length; i++) {
    if (runLines[i].indexOf('✅') === 0) ok++;
    else if (runLines[i].indexOf('⏭️') === 0 || runLines[i].indexOf('🧪') === 0 || runLines[i].indexOf('🕘') === 0) skip++;
    else bad++;
  }
  return '成功' + ok + ' | 跳过' + skip + ' | 异常' + bad + ' | 有效券' + (couponInfo && couponInfo.ok ? couponInfo.totalValid : 0);
}

async function reqDetail(st, actId) {
  const l = st.lottery || {};
  const url =
    'https://chp.icbc.com.cn/bmcs/api-bmcs/' + txt(l.version || 'v3') + '/lott/h5/getActivityDetail?corpId=' +
    encodeURIComponent(txt(l.corpId || '2000000882')) + '&actId=' + encodeURIComponent(actId) + '&roccSwt=' + encodeURIComponent(txt(l.roccSwt || '0'));

  return httpJSON('GET', url, {
    Accept: 'application/json',
    'Content-Type': txt(l.contentType || 'application/json; charset=UTF-8'),
    'User-Agent': txt(l.ua),
    Referer: txt(l.referer),
    Origin: txt(l.origin || 'https://chp.icbc.com.cn'),
    Cookie: txt(l.cookie),
  }, '', CFG.detailTimeout);
}

async function reqDraw(st, actId) {
  const l = st.lottery || {};
  const url = 'https://chp.icbc.com.cn/bmcs/api-bmcs/' + txt(l.version || 'v3') + '/lott/h5/lottery?corpId=' + encodeURIComponent(txt(l.corpId || '2000000882'));

  return httpJSON('POST', url, {
    Accept: 'application/json',
    'Content-Type': txt(l.contentType || 'application/json; charset=UTF-8'),
    'User-Agent': txt(l.ua),
    Referer: txt(l.referer),
    Origin: txt(l.origin || 'https://chp.icbc.com.cn'),
    Cookie: txt(l.cookie),
  }, JSON.stringify({ actId: actId }), CFG.drawTimeout);
}

function parseDetail(raw) {
  if (!raw || raw.error) return { ok: false, category: raw && raw.error ? raw.error.category : 'network_error', msg: raw && raw.error ? raw.error.message : 'request failed' };
  const obj = raw.json;
  if (!obj || typeof obj !== 'object') return { ok: false, category: 'parse_error', msg: 'detail JSON为空' };

  const rootCode = toInt(pick(obj, ['code']), -9999);
  const returnCode = toInt(pick(obj, ['data.returnCode', 'returnCode']), -9999);
  const data = pickObj(obj, ['data.data', 'data', 'result', 'data.result']) || {};

  if (rootCode !== 0 || returnCode !== 0) {
    return { ok: false, category: 'action_rejected', msg: txt(pick(obj, ['data.returnMsg', 'message', 'msg'])) || '状态接口返回异常' };
  }

  return {
    ok: true,
    drawFlag: toBool(data.drawFlag, false),
    drawCount: toInt(data.drawCount, 0),
    totalCount: toInt(data.totalCount, -1),
    errCode: toInt(data.errCode, 0),
    errMsg: txt(data.errMsg),
  };
}

function parseDraw(raw) {
  if (!raw || raw.error) return { ok: false, category: raw && raw.error ? raw.error.category : 'network_error', msg: raw && raw.error ? raw.error.message : 'request failed', code: -1, returnCode: -1, errCode: -1, prizeName: '' };
  const obj = raw.json;
  if (!obj || typeof obj !== 'object') return { ok: false, category: 'parse_error', msg: 'lottery JSON为空', code: -1, returnCode: -1, errCode: -1, prizeName: '' };

  const code = toInt(pick(obj, ['code']), -9999);
  const returnCode = toInt(pick(obj, ['data.returnCode', 'returnCode']), -9999);
  const data = pickObj(obj, ['data.data', 'data', 'result']) || {};
  const errCode = toInt(pick(data, ['errCode', 'code']), 0);
  const msg = txt(pick(data, ['errMsg', 'returnMsg', 'msg'])) || txt(pick(obj, ['data.returnMsg', 'message', 'msg'])) || '';

  let prizeName = extractPrize(data) || extractPrize(obj);
  if (!prizeName && msg.indexOf('未中奖') >= 0) prizeName = '未中奖';

  const ok = code === 0 && returnCode === 0 && (errCode === 0 || errCode === -1);
  return { ok: ok, category: ok ? 'ok' : 'action_rejected', msg: msg || (ok ? '成功' : '服务端返回失败'), code: code, returnCode: returnCode, errCode: errCode, prizeName: prizeName || '' };
}

function extractPrize(obj) {
  if (!obj || typeof obj !== 'object') return '';
  const keys = ['goodsSimpleName', 'prizeName', 'goodsName', 'rewardName', 'awardName', 'ec_name', 'ecName'];
  for (let i = 0; i < keys.length; i++) {
    const v = findDeep(obj, keys[i], 5);
    if (v) return txt(v);
  }
  const s = txt(JSON.stringify(obj));
  return s.indexOf('未中奖') >= 0 ? '未中奖' : '';
}

function findDeep(obj, key, depth) {
  if (!obj || depth < 0 || typeof obj !== 'object') return '';
  if (Object.prototype.hasOwnProperty.call(obj, key) && txt(obj[key])) return txt(obj[key]);
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const v = findDeep(obj[i], key, depth - 1);
      if (v) return v;
    }
    return '';
  }
  const ks = Object.keys(obj);
  for (let i = 0; i < ks.length; i++) {
    const v = findDeep(obj[ks[i]], key, depth - 1);
    if (v) return v;
  }
  return '';
}

async function queryValidCoupons(st) {
  const c = st.coupon || {};
  const all = [];
  let beginNum = 1;
  let page = 0;

  while (page < CFG.couponMaxPages) {
    page += 1;
    const req = await reqCouponPage(c, { flag: '2', beginNum: beginNum, fetchNum: CFG.couponFetchNum });
    if (!req || req.error) {
      return { ok: false, reason: req && req.error ? req.error.message : '券接口请求失败', totalValid: 0, categories: {} };
    }

    const obj = req.json;
    const codeTxt = txt(pick(obj, ['code']));
    if (!(codeTxt === '0' || codeTxt === '200' || codeTxt === '')) {
      return { ok: false, reason: txt(pick(obj, ['message', 'msg'])) || ('券接口返回异常 code=' + codeTxt), totalValid: 0, categories: {} };
    }

    const list = pickArr(obj, ['data.ecList', 'ecList']);
    for (let i = 0; i < list.length; i++) all.push(list[i]);

    const nextBegin = toInt(pick(obj, ['data.beginNum']), -1);
    log('🧾 券查询: page=' + page + ' | beginNum=' + beginNum + ' -> next=' + nextBegin + ' | items=' + list.length);

    if (!list.length) break;
    if (nextBegin > beginNum) {
      beginNum = nextBegin;
      continue;
    }
    if (list.length < CFG.couponFetchNum) break;
    beginNum += 1;
  }

  const uniq = dedupeCoupons(all);
  const valid = uniq.filter(isValidCoupon);
  const categories = groupCoupons(valid);

  log('🧾 券统计: raw=' + all.length + ' | uniq=' + uniq.length + ' | valid=' + valid.length);
  const ks = Object.keys(categories);
  for (let i = 0; i < ks.length; i++) {
    log('📂 ' + ks[i] + ': ' + categories[ks[i]].length + ' 张');
    for (let j = 0; j < categories[ks[i]].length; j++) log('  - ' + formatCouponLine(categories[ks[i]][j]));
  }

  return { ok: true, reason: '', totalValid: valid.length, categories: categories };
}

async function reqCouponPage(c, bodyObj) {
  const sid = txt(c.eiopugsSessionId || getCookieField(txt(c.cookie), 'EIOP_ACT_UGS_SESSIONID'));
  const headers = {
    Accept: 'application/json',
    'Content-Type': txt(c.contentType || 'application/json'),
    'User-Agent': txt(c.ua),
    Referer: txt(c.referer || 'https://eiop.icbc.com.cn/actugsnewweb/dist/'),
    Origin: txt(c.origin || 'https://eiop.icbc.com.cn'),
    Cookie: txt(c.cookie),
    timestamp: String(Date.now()),
    requestUID: genUUID(),
    MSGID: genHex(64),
  };
  if (sid) headers.EIOPUGSSESSIONID = sid;

  return httpJSON('POST', 'https://eiop.icbc.com.cn/actugs/cCoupon/listCashbackCoupon.action', headers, JSON.stringify(bodyObj), CFG.couponTimeout);
}

function isValidCoupon(x) {
  const invalid = txt(x.invalid_status);
  const state = txt(x.effect_state);
  if (invalid !== '0') return false;
  if (state && state !== '1') return false;
  return true;
}

function dedupeCoupons(arr) {
  const out = [];
  const seen = {};
  for (let i = 0; i < arr.length; i++) {
    const x = arr[i] || {};
    const k = txt(x.ec_code) || (txt(x.ecActRuleId) + '|' + txt(x.effect_beginDate) + '|' + txt(x.ec_name));
    if (!k || seen[k]) continue;
    seen[k] = 1;
    out.push(x);
  }
  return out;
}

function groupCoupons(list) {
  const map = {};
  for (let i = 0; i < list.length; i++) {
    const cat = couponCategory(txt(list[i].ec_name));
    if (!map[cat]) map[cat] = [];
    map[cat].push(list[i]);
  }

  const ks = Object.keys(map);
  for (let i = 0; i < ks.length; i++) {
    map[ks[i]].sort(function (a, b) {
      const da = toInt(txt(a.effect_beginDate), 0);
      const db = toInt(txt(b.effect_beginDate), 0);
      if (da !== db) return da - db;
      const na = txt(a.ec_name), nb = txt(b.ec_name);
      if (na < nb) return -1;
      if (na > nb) return 1;
      return 0;
    });
  }

  return map;
}

function couponCategory(name) {
  const n = txt(name);
  if (n.indexOf('刷卡金天天抽') >= 0) return '刷卡金天天抽';
  if (n.indexOf('周周好运') >= 0) return '周周好运刮刮乐';
  if (n.indexOf('电影') >= 0) return '电影刮刮乐';
  if (n.indexOf('美食') >= 0) return '美食刮刮乐';
  return '其他';
}

function formatCouponBrief(info) {
  if (!info || !info.ok) return '⚠️ ' + (info && info.reason ? info.reason : '查询失败');
  const ks = Object.keys(info.categories || {});
  if (!ks.length) return '无有效券';
  const lines = [];
  for (let i = 0; i < ks.length; i++) {
    lines.push('[' + ks[i] + '] ' + info.categories[ks[i]].length + '张');
    for (let j = 0; j < info.categories[ks[i]].length; j++) lines.push('- ' + formatCouponLine(info.categories[ks[i]][j]));
  }
  return lines.join('\n');
}

function formatCouponLine(c) {
  return fmtDate(txt(c.effect_beginDate)) + ' | ' + (txt(c.ec_name) || '未知券') + ' | ¥' + (txt(c.effect_price) || '0') + '/满' + (txt(c.lower_use_amt) || '0') + ' | 到期' + fmtDate(txt(c.effect_endDate));
}

function fmtDate(v) {
  const s = txt(v);
  return /^\d{8}$/.test(s) ? (s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8)) : (s || '未知日期');
}
function parseUrl(url) {
  const m = /^https?:\/\/([^\/?#]+)([^?#]*)(\?[^#]*)?/i.exec(String(url || ''));
  if (!m) return null;
  return { host: txt(m[1]).toLowerCase(), path: txt(m[2]) || '/', search: txt(m[3] || '') };
}

function parseQuery(url) {
  const out = {};
  const i = String(url || '').indexOf('?');
  if (i < 0) return out;
  const arr = String(url || '').slice(i + 1).split('&');
  for (let k = 0; k < arr.length; k++) {
    const seg = arr[k];
    if (!seg) continue;
    const p = seg.indexOf('=');
    const kk = p >= 0 ? seg.slice(0, p) : seg;
    const vv = p >= 0 ? seg.slice(p + 1) : '';
    if (!kk) continue;
    out[decodeU(kk)] = decodeU(vv);
  }
  return out;
}

function deriveOrigin(ref) {
  const m = /^https?:\/\/[^\/?#]+/i.exec(String(ref || ''));
  return m ? m[0] : '';
}

function getCookieField(cookie, key) {
  const arr = String(cookie || '').split(';');
  for (let i = 0; i < arr.length; i++) {
    const seg = arr[i].trim();
    const p = seg.indexOf('=');
    if (p <= 0) continue;
    const k = seg.slice(0, p).trim();
    const v = seg.slice(p + 1).trim();
    if (k === key) return v;
  }
  return '';
}

function normHeaders(h) {
  const out = {};
  const ks = Object.keys(h || {});
  for (let i = 0; i < ks.length; i++) out[String(ks[i]).toLowerCase()] = String(h[ks[i]] || '');
  return out;
}

async function httpJSON(method, url, headers, body, timeoutMs) {
  try {
    const resp = await $.http[method.toLowerCase()]({
      url: url,
      headers: headers || {},
      body: method === 'GET' ? undefined : body,
      timeout: timeoutMs || 20000,
    });

    const status = toInt(resp.statusCode || resp.status, 0);
    const text = typeof resp.body === 'string' ? resp.body : '';
    if (CFG.debug) log('🐞 HTTP ' + method + ' ' + url + ' | status=' + status + ' | bodyLen=' + text.length);

    if (status < 200 || status >= 300) {
      return { error: { category: 'network_error', message: 'HTTP ' + status }, status: status, text: text, json: null };
    }

    const js = toJSON(text, null);
    if (!js) return { error: { category: 'parse_error', message: '非JSON响应' }, status: status, text: text, json: null };
    return { error: null, status: status, text: text, json: js };
  } catch (e) {
    return { error: { category: 'network_error', message: txt(e && e.message ? e.message : e) }, status: 0, text: '', json: null };
  }
}

function pick(obj, paths) {
  for (let i = 0; i < paths.length; i++) {
    const v = pickOne(obj, paths[i]);
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

function pickObj(obj, paths) {
  const v = pick(obj, paths);
  return v && typeof v === 'object' ? v : null;
}

function pickArr(obj, paths) {
  const v = pick(obj, paths);
  return Array.isArray(v) ? v : [];
}

function pickOne(obj, path) {
  const segs = String(path || '').split('.');
  let cur = obj;
  for (let i = 0; i < segs.length; i++) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    const k = segs[i];
    if (!Object.prototype.hasOwnProperty.call(cur, k)) return undefined;
    cur = cur[k];
  }
  return cur;
}

function genUUID() {
  const tpl = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  let out = '';
  for (let i = 0; i < tpl.length; i++) {
    const ch = tpl.charAt(i);
    if (ch === 'x') out += Math.floor(Math.random() * 16).toString(16);
    else if (ch === 'y') out += ((Math.floor(Math.random() * 16) & 3) | 8).toString(16);
    else out += ch;
  }
  return out;
}

function genHex(n) {
  const len = toInt(n, 32);
  let out = '';
  for (let i = 0; i < len; i++) out += Math.floor(Math.random() * 16).toString(16);
  return out;
}

function parseArg(s) {
  const o = {};
  if (!s) return o;
  const segs = String(s).split('&');
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (!seg) continue;
    const p = seg.indexOf('=');
    const k = p >= 0 ? seg.slice(0, p) : seg;
    const v = p >= 0 ? seg.slice(p + 1) : '';
    if (!k) continue;
    o[decodeU(k)] = decodeU(v.replace(/\+/g, '%20'));
  }
  return o;
}

function decodeU(s) {
  try {
    return decodeURIComponent(String(s || ''));
  } catch (e) {
    return String(s || '');
  }
}

function toBool(v, d) {
  if (v === undefined || v === null || v === '') return !!d;
  const s = String(v).toLowerCase();
  if (s === '1' || s === 'true' || s === 'yes' || s === 'on') return true;
  if (s === '0' || s === 'false' || s === 'no' || s === 'off') return false;
  return !!d;
}

function toInt(v, d) {
  const n = parseInt(String(v), 10);
  return isNaN(n) ? d : n;
}

function toJSON(s, d) {
  if (!s || typeof s !== 'string') return d;
  try {
    return JSON.parse(s);
  } catch (e) {
    return d;
  }
}

function txt(v) {
  return String(v === undefined || v === null ? '' : v)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getBeijingNowDate() {
  const d = new Date();
  return new Date(d.getTime() + (8 * 60 + d.getTimezoneOffset()) * 60 * 1000);
}

function isAfterBeijingDrawStart() {
  const bj = getBeijingNowDate();
  const hh = bj.getHours();
  const mm = bj.getMinutes();
  if (hh > BJ_DRAW_START_HOUR) return true;
  if (hh < BJ_DRAW_START_HOUR) return false;
  return mm >= BJ_DRAW_START_MINUTE;
}

function formatBeijingNow() {
  const d = getBeijingNowDate();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
}

function now() {
  const d = new Date();
  return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
}

function p2(n) {
  return n < 10 ? '0' + n : String(n);
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

function log(s) {
  const line = '[' + now() + '] ' + s;
  if ($ && typeof $.log === 'function') $.log(line);
  else console.log(line);
}

function Env(name) {
  this.name = name;
  this.startTime = Date.now();
  this.data = null;
  this.dataFile = 'box.dat';
  this.logs = [];
  this.logSeparator = '\n';
  const self = this;
  this.http = {
    get: function (opts) {
      return self._request('GET', opts);
    },
    post: function (opts) {
      return self._request('POST', opts);
    },
  };
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
  const fs = require('fs');
  const path = require('path');
  const p1 = path.resolve(this.dataFile);
  const p2 = path.resolve(process.cwd(), this.dataFile);
  const t = fs.existsSync(p1) ? p1 : fs.existsSync(p2) ? p2 : '';
  if (!t) return {};
  try {
    return JSON.parse(fs.readFileSync(t));
  } catch (e) {
    return {};
  }
};
Env.prototype.writedata = function () {
  if (!this.isNode()) return;
  const fs = require('fs');
  const path = require('path');
  fs.writeFileSync(path.resolve(this.dataFile), JSON.stringify(this.data, null, 2));
};
Env.prototype.msg = function (title, subtitle, body, opts) {
  if (this.isSurge() || this.isLoon()) $notification.post(title, subtitle, body, opts);
  else if (this.isQuanX()) $notify(title, subtitle, body, opts);
  else console.log(['', '==============系统通知==============', title, subtitle || '', body || ''].join('\n'));
};
Env.prototype.log = function () {
  const args = Array.prototype.slice.call(arguments);
  this.logs = this.logs.concat(args);
  console.log(args.join(this.logSeparator));
};
Env.prototype.logErr = function (err) {
  const e = err && err.stack ? err.stack : String(err);
  this.log('❗️' + this.name + ' 错误: ' + e);
};
Env.prototype.done = function (val) {
  const sec = (Date.now() - this.startTime) / 1000;
  this.log('[' + now() + '] ' + this.name + ' 结束, 耗时 ' + sec.toFixed(3) + ' 秒');
  if (this.isSurge() || this.isQuanX() || this.isLoon()) $done(val || {});
};
Env.prototype._request = function (method, opts) {
  const self = this;
  return new Promise(function (resolve, reject) {
    const req = typeof opts === 'string' ? { url: opts } : opts || {};
    const timeout = toInt(req.timeout, 30000);
    if (self.isQuanX()) {
      const q = { url: req.url, method: method, headers: req.headers || {} };
      if (method !== 'GET' && req.body !== undefined) q.body = req.body;
      return $task.fetch(q).then(function (r) {
        resolve({ status: r.statusCode, statusCode: r.statusCode, headers: r.headers, body: r.body });
      }).catch(reject);
    }
    if (self.isSurge() || self.isLoon()) {
      const s = { url: req.url, headers: req.headers || {}, timeout: timeout / 1000 };
      if (method !== 'GET' && req.body !== undefined) s.body = req.body;
      const cb = function (err, resp, body) {
        if (err) reject(err);
        else {
          resp.body = body;
          resp.statusCode = resp.status;
          resolve(resp);
        }
      };
      return method === 'GET' ? $httpClient.get(s, cb) : $httpClient.post(s, cb);
    }
    if (self.isNode()) {
      try {
        const u = new URL(req.url);
        const isHttps = u.protocol === 'https:';
        const lib = require(isHttps ? 'https' : 'http');
        const nodeReq = {
          method: method,
          hostname: u.hostname,
          port: u.port || (isHttps ? 443 : 80),
          path: (u.pathname || '/') + (u.search || ''),
          headers: req.headers || {},
        };
        if (isHttps) {
          const crypto = require('crypto');
          if (crypto && crypto.constants && crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT) {
            // Some legacy upstreams still require legacy renegotiation in Node/OpenSSL.
            nodeReq.secureOptions = crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT;
          }
        }
        const r = lib.request(nodeReq, function (res) {
          const chunks = [];
          res.on('data', function (c) { chunks.push(c); });
          res.on('end', function () {
            resolve({
              status: res.statusCode,
              statusCode: res.statusCode,
              headers: res.headers || {},
              body: Buffer.concat(chunks).toString('utf8'),
            });
          });
        });
        r.on('error', reject);
        r.setTimeout(timeout, function () {
          r.destroy(new Error('Request timeout ' + timeout + 'ms'));
        });
        if (method !== 'GET' && req.body !== undefined) r.write(req.body);
        r.end();
      } catch (e) {
        reject(e);
      }
      return;
    }
    reject(new Error('Unknown runtime'));
  });
};




