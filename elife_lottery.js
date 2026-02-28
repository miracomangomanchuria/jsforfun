/*
本脚本仅供个人学习交流使用，严禁用于任何商业用途，请于下载后24小时内删除。
脚本无意侵犯任何第三方的肖像权、名誉权、著作权、商标权等合法权益，如涉嫌侵权，请权利人联系脚本，脚本将在收到通知后24小时内删除相关内容。
e生活抽奖（QX/Surge/Loon/Node）

QX:
[rewrite_local]
^https:\/\/chp\.icbc\.com\.cn\/bmcs\/api-bmcs\/v[23]\/lott\/h5\/getActivityDetail(?:\?.*)?$ url script-request-header elife_lottery.js
[mitm]
hostname = chp.icbc.com.cn

Loon:
[Script]
http-request ^https:\/\/chp\.icbc\.com\.cn\/bmcs\/api-bmcs\/v[23]\/lott\/h5\/getActivityDetail(?:\?.*)?$ script-path=elife_lottery.js, timeout=60, tag=elife_lottery_capture
[MITM]
hostname = chp.icbc.com.cn

Surge:
[Script]
elife_lottery_capture = type=http-request,pattern=^https:\/\/chp\.icbc\.com\.cn\/bmcs\/api-bmcs\/v[23]\/lott\/h5\/getActivityDetail(?:\?.*)?$,script-path=elife_lottery.js,timeout=60
[MITM]
hostname = chp.icbc.com.cn
*/

const $ = new Env('e生活抽奖');
const VER = 'v1.3.4';
const STORE_KEY = 'elife_lottery_capture_state_v1';
const LEDGER_KEY = 'elife_lottery_reward_map_ledger_v1';
const LEGACY_LEDGER_KEY = 'elife_lottery_coupon_ledger_v1';

const CAPTURE_QX = String.raw`[rewrite_local]
^https:\/\/chp\.icbc\.com\.cn\/bmcs\/api-bmcs\/v[23]\/lott\/h5\/getActivityDetail(?:\?.*)?$ url script-request-header elife_lottery.js
[mitm]
hostname = chp.icbc.com.cn`;
const CAPTURE_LOON = String.raw`[Script]
http-request ^https:\/\/chp\.icbc\.com\.cn\/bmcs\/api-bmcs\/v[23]\/lott\/h5\/getActivityDetail(?:\?.*)?$ script-path=elife_lottery.js, timeout=60, tag=elife_lottery_capture
[MITM]
hostname = chp.icbc.com.cn`;
const CAPTURE_SURGE = String.raw`[Script]
elife_lottery_capture = type=http-request,pattern=^https:\/\/chp\.icbc\.com\.cn\/bmcs\/api-bmcs\/v[23]\/lott\/h5\/getActivityDetail(?:\?.*)?$,script-path=elife_lottery.js,timeout=60
[MITM]
hostname = chp.icbc.com.cn`;

const ACTS = [
  { key: 'daily', name: '刷卡金天天抽', actId: 'LOT20251230091958948510' },
  { key: 'food', name: '美食刮刮乐', actId: 'LOT20251231142538552213' },
  { key: 'weekly', name: '周周好运刮刮乐', actId: 'LOT20260104093637913054' },
  { key: 'movie', name: '电影刮刮乐', actId: 'LOT20260104114622189618' },
];
const DAILY_THRESHOLD_RULES = {
  cashback: { '0.18': '20', '0.88': '20', '8.8': '100' },
  coupon: { '20': '120', '30': '130', '50': '150' },
};

const arg = parseArg(typeof $argument === 'string' ? $argument : '');
const CFG = {
  queryOnly: toBool(arg.query_only, false),
  maxDrawEach: Math.max(1, toInt(arg.max_draw_each, 3)),
  verifyAfterDraw: toBool(arg.verify_after_draw, false),
  mappingViewLimit: Math.max(1, toInt(arg.mapping_view_limit, 12)),
  mappedValidDays: Math.max(1, toInt(arg.mapped_valid_days, 7)),
  detailTimeout: toInt(arg.detail_timeout_ms, 20000),
  drawTimeout: toInt(arg.draw_timeout_ms, 20000),
  waitMinMs: Math.max(0, toInt(arg.wait_min_s, 1) * 1000),
  waitMaxMs: Math.max(0, toInt(arg.wait_max_s, 3) * 1000),
  waitLog: toBool(arg.wait_log, true),
  debug: toBool(arg.debug, false),
};
if (CFG.waitMaxMs < CFG.waitMinMs) { const t = CFG.waitMinMs; CFG.waitMinMs = CFG.waitMaxMs; CFG.waitMaxMs = t; }

Promise.resolve().then(async () => {
  log('==========');
  log('🚀 启动 ' + VER + ' | query_only=' + CFG.queryOnly + ' | maxDrawEach=' + CFG.maxDrawEach + ' | verify_after_draw=' + CFG.verifyAfterDraw + ' | mapped_valid_days=' + CFG.mappedValidDays);
  if (typeof $request !== 'undefined') return captureReq();

  const st = loadState();
  const lottery = st.lottery || {};
  if (!txt(lottery.cookie) || !txt(lottery.ua)) {
    const g = captureGuideByClient();
    log('❌ 缺少抓包字段（lottery）');
    log(g);
    $.msg($.name, '缺少抓包字段', '请先抓 getActivityDetail\n' + g);
    return;
  }

  const lines = [];
  const prizeRows = [];
  const poolRows = [];
  for (let i = 0; i < ACTS.length; i++) {
    const a = ACTS[i];
    const rs = await runOneActivity(st, a);
    lines.push(formatActLine(a.name, rs));
    for (let j = 0; j < rs.prizes.length; j++) {
      const p = txt(rs.prizes[j]);
      prizeRows.push({ actName: a.name, prizeName: p });
    }
    for (let k = 0; k < rs.rewardPool.length; k++) {
      const rp = txt(rs.rewardPool[k]);
      if (!rp) continue;
      poolRows.push({ actName: a.name, rewardName: rp });
    }
  }

  const ledger = syncLedger(st, prizeRows, poolRows);
  const body = [
    '📌 抽奖执行结果',
    lines.join('\n'),
    '',
    '🎁 奖品列表',
    formatPrizeListBySource(ledger),
  ].join('\n');

  $.msg($.name, buildSubtitle(lines), body);
}).catch(e => $.logErr(e)).finally(() => { log('🏁 结束 ' + VER); log('=========='); $.done(); });

async function runOneActivity(st, act) {
  log('----------');
  log('🎯 活动: ' + act.name + ' | actId=' + act.actId);

  const detail = parseDetail(await reqDetail(st, act.actId));
  if (!detail.ok) return { category: 'error', reason: detail.msg, prizes: [], remain: -1, done: 0, rewardPool: [] };
  log('📊 状态: drawFlag=' + detail.drawFlag + ' | drawCount=' + detail.drawCount + ' | totalCount=' + detail.totalCount + ' | errCode=' + detail.errCode + ' | errMsg=' + detail.errMsg);

  if (!detail.drawFlag || detail.drawCount <= 0) return { category: 'already_done', reason: detail.errMsg || '无可用次数', prizes: [], remain: detail.drawCount, done: 0, rewardPool: detail.rewardPool };
  if (CFG.queryOnly) return { category: 'query_only', reason: 'query_only=true，跳过刮奖', prizes: [], remain: detail.drawCount, done: 0, rewardPool: detail.rewardPool };

  let remain = detail.drawCount;
  let done = 0;
  const prizes = [];
  const maxTry = Math.min(remain, CFG.maxDrawEach);
  for (let i = 0; i < maxTry; i++) {
    const draw = parseDraw(await reqDraw(st, act.actId));
    if (!draw.ok) {
      if (String(draw.errCode) === '200004' || txt(draw.msg).indexOf('次数用完') >= 0) return { category: 'already_done', reason: draw.msg || '次数已用完', prizes, remain: 0, done, rewardPool: detail.rewardPool };
      return { category: 'error', reason: draw.msg || '服务端拒绝', prizes, remain, done, rewardPool: detail.rewardPool };
    }
    const p = draw.prizeName || '奖励名未返回';
    prizes.push(p);
    done += 1;
    remain = Math.max(0, remain - 1);
    log('✅ 第' + done + '次刮奖: ' + p);
  }

  if (done > 0 && CFG.verifyAfterDraw) {
    const re = parseDetail(await reqDetail(st, act.actId));
    if (re.ok) remain = re.drawCount;
  }
  return { category: 'ok', reason: '执行完成', prizes, remain, done, rewardPool: detail.rewardPool };
}

function formatActLine(name, rs) {
  if (rs.category === 'ok') return '✅ ' + name + ': 已刮' + rs.done + '次 | 本次=' + (rs.prizes.length ? rs.prizes.join('、') : '奖励名未返回') + fmtRemain(rs.remain);
  if (rs.category === 'already_done') return '⏭️ ' + name + ': 无可用次数' + fmtRemain(rs.remain) + ' | ' + (rs.reason || '已刮过');
  if (rs.category === 'query_only') return '🧪 ' + name + ': 状态可刮，query_only跳过' + fmtRemain(rs.remain);
  return '❌ ' + name + ': ' + (rs.reason || '失败');
}

function fmtRemain(n) { return toInt(n, -1) >= 0 ? ' | 剩余' + n + '次' : ''; }

function buildSubtitle(runLines) {
  let ok = 0, skip = 0, bad = 0;
  for (let i = 0; i < runLines.length; i++) {
    if (runLines[i].indexOf('✅') === 0) ok++;
    else if (runLines[i].indexOf('⏭️') === 0 || runLines[i].indexOf('🧪') === 0) skip++;
    else bad++;
  }
  return '成功' + ok + ' | 跳过' + skip + ' | 异常' + bad;
}

function formatPrizeListBySource(ledger) {
  const items = (ledger && Array.isArray(ledger.items)) ? ledger.items.slice() : [];
  const valid = [];
  for (let i = 0; i < items.length; i++) {
    const x = items[i] || {};
    const src = txt(x.source);
    const name = txt(x.name);
    if (src !== 'prize_mapping') continue;
    if (!name) continue;
    if (name.indexOf('未中奖') >= 0 || name.indexOf('谢谢参与') >= 0) continue;
    valid.push(x);
  }
  if (!valid.length) return '无实得奖品记录';

  const group = {};
  const order = [];
  for (let i = 0; i < valid.length; i++) {
    const x = valid[i];
    const k = txt(x.actName) || '未分类来源';
    if (!group[k]) { group[k] = []; order.push(k); }
    group[k].push(x);
  }

  order.sort(compareActNameOrder);
  const lines = [];
  for (let i = 0; i < order.length; i++) {
    const act = order[i];
    const arr = group[act] || [];
    arr.sort(comparePrizeRowsForNotify);
    lines.push('【' + act + '】');
    for (let j = 0; j < arr.length; j++) lines.push(formatPrizeLine(arr[j]));
  }
  return lines.join('\n');
}

function compareActNameOrder(a, b) {
  const da = isDailyActName(a) ? 0 : 1;
  const db = isDailyActName(b) ? 0 : 1;
  if (da !== db) return da - db;

  const ia = actOrderIndex(a);
  const ib = actOrderIndex(b);
  if (ia !== ib) return ia - ib;
  const sa = txt(a), sb = txt(b);
  if (sa < sb) return -1;
  if (sa > sb) return 1;
  return 0;
}
function isDailyActName(n) {
  return txt(n).indexOf('刷卡金天天抽') >= 0;
}

function actOrderIndex(n) {
  const s = txt(n);
  for (let i = 0; i < ACTS.length; i++) if (txt(ACTS[i].name) === s) return i;
  return 999;
}

function comparePrizeRowsForNotify(a, b) {
  const ea = toTsMs(txt(a && a.endAt));
  const eb = toTsMs(txt(b && b.endAt));
  if (ea > 0 && eb > 0 && ea !== eb) return ea - eb;
  if (ea > 0 && eb <= 0) return -1;
  if (ea <= 0 && eb > 0) return 1;

  const ba = toTsMs(txt(a && (a.beginAt || a.createdAt)));
  const bb = toTsMs(txt(b && (b.beginAt || b.createdAt)));
  if (ba !== bb) return ba - bb;

  const na = txt(a && a.name), nb = txt(b && b.name);
  if (na < nb) return -1;
  if (na > nb) return 1;
  return 0;
}

function formatPrizeLine(x) {
  const n = prizeDisplayName(x);
  const t = txt(x && x.threshold);
  const eAt = txt(x && x.endAt);
  const eDate = txt(x && x.endDate);
  const cnt = toInt(x && x.count, 1);
  let s = n;
  if (t) s += '（满' + t + '可用）';
  if (eAt) s += '到期：' + fmtDateTime(eAt) + '（剩余' + fmtRemainDhm(eAt) + '）';
  else if (eDate) s += '到期：' + fmtDate(eDate);
  if (cnt > 1) s += ' x' + cnt;
  return s;
}

function prizeDisplayName(x) {
  const name = txt(x && x.name);
  const amount = txt(x && x.amount);
  if (name.indexOf('刷卡金') >= 0 && amount) return amount + '元';
  return name || '未知奖品';
}

async function reqDetail(st, actId) {
  const l = st.lottery || {};
  const url = 'https://chp.icbc.com.cn/bmcs/api-bmcs/' + txt(l.version || 'v3') + '/lott/h5/getActivityDetail?corpId=' + encodeURIComponent(txt(l.corpId || '2000000882')) + '&actId=' + encodeURIComponent(actId) + '&roccSwt=' + encodeURIComponent(txt(l.roccSwt || '0'));
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
  }, JSON.stringify({ actId }), CFG.drawTimeout);
}

function parseDetail(raw) {
  if (!raw || raw.error) return { ok: false, msg: raw && raw.error ? raw.error.message : 'request failed' };
  const obj = raw.json || {};
  const code = toInt(pick(obj, ['code']), -1);
  const rc = toInt(pick(obj, ['data.returnCode', 'returnCode']), -1);
  const d = pick(obj, ['data.data', 'data', 'result']) || {};
  if (code !== 0 || rc !== 0) return { ok: false, msg: txt(pick(obj, ['data.returnMsg', 'message', 'msg'])) || '状态接口返回异常' };
  const rewardPool = extractRewardPool(d);
  return {
    ok: true,
    drawFlag: toBool(d.drawFlag, false),
    drawCount: toInt(d.drawCount, 0),
    totalCount: toInt(d.totalCount, -1),
    errCode: toInt(d.errCode, 0),
    errMsg: txt(d.errMsg),
    rewardPool: rewardPool,
  };
}

function extractRewardPool(d) {
  const out = [];
  const seen = {};
  const arr = pick(d, ['detail.actGoodsRelList', 'actGoodsRelList']);
  if (!Array.isArray(arr)) return out;
  for (let i = 0; i < arr.length; i++) {
    const x = arr[i] || {};
    const n = txt(x.goodsSimpleName || x.prizeName || x.goodsName || x.rewardName || x.awardName || x.ec_name);
    if (!n || seen[n]) continue;
    seen[n] = 1;
    out.push(n);
  }
  return out;
}

function parseDraw(raw) {
  if (!raw || raw.error) return { ok: false, msg: raw && raw.error ? raw.error.message : 'request failed', errCode: -1, prizeName: '' };
  const obj = raw.json || {};
  const code = toInt(pick(obj, ['code']), -1);
  const rc = toInt(pick(obj, ['data.returnCode', 'returnCode']), -1);
  const d = pick(obj, ['data.data', 'data', 'result']) || {};
  const errCode = toInt(pick(d, ['errCode', 'code']), 0);
  const msg = txt(pick(d, ['errMsg', 'returnMsg', 'msg'])) || txt(pick(obj, ['data.returnMsg', 'message', 'msg'])) || '';
  let prizeName = deepFind(d, ['goodsSimpleName', 'prizeName', 'goodsName', 'rewardName', 'awardName', 'ec_name']) || deepFind(obj, ['goodsSimpleName', 'prizeName', 'goodsName', 'rewardName', 'awardName', 'ec_name']);
  if (!prizeName && msg.indexOf('未中奖') >= 0) prizeName = '未中奖';
  const ok = code === 0 && rc === 0 && (errCode === 0 || errCode === -1);
  return { ok, msg, errCode, prizeName: txt(prizeName) };
}

function syncLedger(st, prizeRows, poolRows) {
  st.runtime = st.runtime || {};
  const rt = st.runtime;
  const old = (rt[LEDGER_KEY] && typeof rt[LEDGER_KEY] === 'object') ? rt[LEDGER_KEY] : ((rt[LEGACY_LEDGER_KEY] && typeof rt[LEGACY_LEDGER_KEY] === 'object') ? rt[LEGACY_LEDGER_KEY] : { items: [] });
  let items = Array.isArray(old.items) ? old.items.slice() : [];
  items = normalizeImportedLedger(items);
  const before = items.length;
  items = pruneLedger(items);
  const afterPruneLen = items.length;

  let added = 0;
  const mergedRows = toMappedItems(prizeRows || []).concat(toPoolItems(poolRows || []));
  for (let i = 0; i < mergedRows.length; i++) {
    const m = mergedRows[i];
    const idx = findByKey(items, m.key);
    if (idx >= 0) items[idx] = mergeItem(items[idx], m);
    else { items.push(m); added += 1; }
  }

  items = normalizeLedger(items);
  rt[LEDGER_KEY] = { items, updateAt: now(), source: 'prize_mapping' };
  if (Object.prototype.hasOwnProperty.call(rt, LEGACY_LEDGER_KEY)) delete rt[LEGACY_LEDGER_KEY];
  st.runtime = rt;
  saveState(st);
  return { total: items.length, added, pruned: before - afterPruneLen, items };
}

function pruneLedger(items) {
  const out = [];
  const today = ymdInt(beijingYmd());
  const nowMs = Date.now();
  const ttl = 45 * 24 * 3600 * 1000;
  for (let i = 0; i < items.length; i++) {
    const x = items[i] || {};
    const endAtTs = toTsMs(x.endAt);
    if (endAtTs > 0 && endAtTs <= nowMs) continue;
    const end = ymdInt(txt(x.endDate));
    if (endAtTs <= 0 && end > 0 && end < today) continue;
    if (!end) {
      const t = toTsMs(x.createdAt || x.updateAt || '');
      if (t > 0 && nowMs - t > ttl) continue;
    }
    out.push(x);
  }
  return out;
}

function toMappedItems(rows) {
  const out = [];
  const beginTs = Date.now();
  const endTs = beginTs + CFG.mappedValidDays * 24 * 3600 * 1000;
  const beginAt = fmtTs(beginTs);
  const endAt = fmtTs(endTs);
  const today = ymdFromAny(beginAt) || beijingYmd();
  const endYmd = ymdFromAny(endAt) || addDaysYmd(today, CFG.mappedValidDays);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || {};
    const name = txt(r.prizeName);
    if (!name || name === '奖励名未返回') continue;
    if (name.indexOf('未中奖') >= 0 || name.indexOf('谢谢参与') >= 0) continue;
    const amount = parseAmount(name);
    const actName = txt(r.actName);
    out.push({
      key: 'mapped|' + actName + '|' + name + '|' + today,
      source: 'prize_mapping',
      category: categoryOf(name),
      name,
      actName: actName,
      beginDate: today,
      beginAt: beginAt,
      endDate: endYmd,
      endAt: endAt,
      endDateSource: 'estimated_days_' + CFG.mappedValidDays,
      amount: amount,
      threshold: inferThreshold(name, actName, amount),
      createdAt: now(),
      updateAt: now(),
      count: 1,
    });
  }
  return out;
}

function toPoolItems(rows) {
  const out = [];
  const beginAt = now();
  const today = ymdFromAny(beginAt) || beijingYmd();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || {};
    const name = txt(r.rewardName);
    if (!name) continue;
    const amount = parseAmount(name);
    const actName = txt(r.actName);
    out.push({
      key: 'pool|' + actName + '|' + name,
      source: 'server_pool',
      category: categoryOf(name),
      name: name,
      actName: actName,
      beginDate: today,
      beginAt: beginAt,
      endDate: '',
      endAt: '',
      amount: amount,
      threshold: inferThreshold(name, actName, amount),
      createdAt: now(),
      updateAt: now(),
      count: 1,
    });
  }
  return out;
}

function findByKey(items, key) { for (let i = 0; i < items.length; i++) if (txt(items[i].key) === txt(key)) return i; return -1; }
function mergeItem(a, b) {
  const x = a || {};
  x.key = txt(b.key) || txt(x.key);
  x.source = txt(b.source) || txt(x.source);
  x.category = txt(b.category) || txt(x.category);
  x.name = txt(b.name) || txt(x.name);
  x.actName = txt(b.actName) || txt(x.actName);
  x.beginDate = preferOlderDate(txt(x.beginDate), txt(b.beginDate));
  x.beginAt = preferOlderTime(txt(x.beginAt), txt(b.beginAt));
  x.endDate = txt(b.endDate) || txt(x.endDate);
  x.endAt = txt(b.endAt) || txt(x.endAt);
  x.endDateSource = txt(b.endDateSource) || txt(x.endDateSource);
  x.amount = txt(b.amount) || txt(x.amount);
  x.threshold = txt(b.threshold) || txt(x.threshold);
  x.createdAt = txt(x.createdAt) || txt(b.createdAt) || now();
  x.updateAt = txt(b.updateAt) || now();
  x.count = Math.max(toInt(x.count, 1), toInt(b.count, 1));
  if (txt(x.source) === 'prize_mapping' && txt(b.source) === 'prize_mapping') x.count = toInt(x.count, 1) + 1;
  return x;
}
function normalizeLedger(items) {
  const map = {};
  const out = [];
  for (let i = 0; i < items.length; i++) {
    const x = items[i] || {};
    const k = txt(x.key);
    if (!k) continue;
    if (!map[k]) { map[k] = x; out.push(x); }
    else map[k] = mergeItem(map[k], x);
  }
  out.sort((a, b) => toTsMs(b.updateAt || b.createdAt) - toTsMs(a.updateAt || a.createdAt));
  return out;
}

function viewMapping(ledger) {
  const items = ledger && Array.isArray(ledger.items) ? ledger.items.slice() : [];
  items.sort(compareMappingRows);
  return { total: items.length, rows: items.slice(0, CFG.mappingViewLimit) };
}

function formatMapping(v) {
  if (!v || !v.total) return '无映射记录';
  const lines = ['总计' + v.total + '条 | 展示' + v.rows.length + '条'];
  for (let i = 0; i < v.rows.length; i++) {
    const x = v.rows[i] || {};
    const src = txt(x.source);
    let s = fmtDate(txt(x.beginDate)) + ' | ' + (txt(x.name) || '未知奖品');
    if (txt(x.amount)) s += ' | ¥' + txt(x.amount);
    if (txt(x.threshold)) s += ' | 满' + txt(x.threshold) + '可用';
    if (src === 'server_pool') s += ' | 奖池';
    else if (src === 'prize_mapping') s += ' | 实得';
    if (txt(x.actName)) s += ' | 来源' + txt(x.actName);
    const hasEstimatedEnd = (src === 'prize_mapping' && txt(x.endDateSource).indexOf('estimated_days_') === 0);
    if (txt(x.endAt)) {
      s += ' | ' + (hasEstimatedEnd ? '到期(估)' : '到期') + fmtDateTime(txt(x.endAt));
      s += ' | 剩余' + fmtRemainDhm(txt(x.endAt));
    } else if (txt(x.endDate)) {
      const endLabel = (src === 'prize_mapping' && txt(x.endDateSource).indexOf('estimated_days_') === 0) ? '到期(估)' : '到期';
      s += ' | ' + endLabel + fmtDate(txt(x.endDate));
    }
    if (toInt(x.count, 1) > 1) s += ' | x' + toInt(x.count, 1);
    lines.push('- ' + s);
  }
  return lines.join('\n');
}

function categoryOf(n) {
  const s = txt(n);
  if (s.indexOf('刷卡金天天抽') >= 0) return '刷卡金天天抽';
  if (s.indexOf('周周好运') >= 0) return '周周好运刮刮乐';
  if (s.indexOf('电影') >= 0) return '电影刮刮乐';
  if (s.indexOf('美食') >= 0) return '美食刮刮乐';
  return '其他';
}
function parseAmount(n) { const m = /(\d+(?:\.\d+)?)/.exec(txt(n)); return m ? m[1] : ''; }
function parseThreshold(n) {
  const s = txt(n).replace(/，/g, ',');
  const m = /满\s*([0-9]+(?:\.[0-9]+)?)\s*元/.exec(s);
  return m ? m[1] : '';
}
function inferThreshold(name, actName, amount) {
  const direct = parseThreshold(name);
  if (direct) return direct;
  if (!isDailyFirstRow({ name, actName })) return '';

  const n = txt(name);
  const amt = normalizeAmount(amount || parseAmount(name));
  if (!amt) return '';
  const amtNum = Number(amt);

  if (n.indexOf('刷卡金') >= 0) {
    const t = DAILY_THRESHOLD_RULES.cashback[amt];
    if (t) return t;
    if (Math.abs(amtNum - 0.18) < 0.000001 || Math.abs(amtNum - 0.88) < 0.000001) return '20';
    if (Math.abs(amtNum - 8.8) < 0.000001) return '100';
  }

  const isCouponLike = n.indexOf('电子券') >= 0 || n.indexOf('e生活') >= 0 || n.indexOf('优惠券') >= 0 || n.indexOf('消费券') >= 0;
  if (isCouponLike) {
    const t = DAILY_THRESHOLD_RULES.coupon[amt];
    if (t) return t;
    if (Math.abs(amtNum - 20) < 0.000001) return '120';
    if (Math.abs(amtNum - 30) < 0.000001) return '130';
    if (Math.abs(amtNum - 50) < 0.000001) return '150';
  }
  return '';
}
function normalizeAmount(v) {
  const s = txt(v);
  if (!s) return '';
  const n = Number(s);
  if (!isFinite(n)) return s;
  return String(n);
}
function preferOlderDate(oldYmd, newYmd) {
  const o = ymdInt(oldYmd);
  const n = ymdInt(newYmd);
  if (o > 0 && n > 0) return o <= n ? oldYmd : newYmd;
  if (o > 0) return oldYmd;
  if (n > 0) return newYmd;
  return txt(oldYmd) || txt(newYmd);
}
function preferOlderTime(oldAt, newAt) {
  const o = toTsMs(oldAt);
  const n = toTsMs(newAt);
  if (o > 0 && n > 0) return o <= n ? txt(oldAt) : txt(newAt);
  if (o > 0) return txt(oldAt);
  if (n > 0) return txt(newAt);
  return txt(oldAt) || txt(newAt);
}
function isDailyFirstRow(x) {
  const n = txt(x && x.name);
  const a = txt(x && x.actName);
  return n.indexOf('刷卡金天天抽') >= 0 || a.indexOf('刷卡金天天抽') >= 0;
}
function compareMappingRows(a, b) {
  const pa = isDailyFirstRow(a) ? 0 : 1;
  const pb = isDailyFirstRow(b) ? 0 : 1;
  if (pa !== pb) return pa - pb;

  const eAtA = toTsMs(txt(a && a.endAt));
  const eAtB = toTsMs(txt(b && b.endAt));
  if (eAtA > 0 && eAtB > 0 && eAtA !== eAtB) return eAtA - eAtB;
  if (eAtA > 0 && eAtB <= 0) return -1;
  if (eAtA <= 0 && eAtB > 0) return 1;

  const ea = ymdInt(txt(a && a.endDate));
  const eb = ymdInt(txt(b && b.endDate));
  if (ea > 0 && eb > 0 && ea !== eb) return ea - eb;
  if (ea > 0 && eb <= 0) return -1;
  if (ea <= 0 && eb > 0) return 1;

  const bAtA = toTsMs(txt(a && a.beginAt));
  const bAtB = toTsMs(txt(b && b.beginAt));
  if (bAtA > 0 && bAtB > 0 && bAtA !== bAtB) return bAtA - bAtB;
  if (bAtA > 0 && bAtB <= 0) return -1;
  if (bAtA <= 0 && bAtB > 0) return 1;

  const ba = ymdInt(txt(a && a.beginDate));
  const bb = ymdInt(txt(b && b.beginDate));
  if (ba > 0 && bb > 0 && ba !== bb) return ba - bb;
  if (ba > 0 && bb <= 0) return -1;
  if (ba <= 0 && bb > 0) return 1;

  const ta = toTsMs((a && (a.createdAt || a.updateAt)) || '');
  const tb = toTsMs((b && (b.createdAt || b.updateAt)) || '');
  if (ta !== tb) return ta - tb;

  const na = txt(a && a.name), nb = txt(b && b.name);
  if (na < nb) return -1;
  if (na > nb) return 1;
  return 0;
}
function normalizeImportedLedger(items) {
  const out = [];
  for (let i = 0; i < (items || []).length; i++) {
    const x = items[i] || {};
    const name = txt(x.name || x.ec_name || x.goodsSimpleName || x.prizeName || x.rewardName || x.awardName);
    if (!name) continue;
    const beginAt = txt(x.beginAt || x.effect_beginDate || '');
    const endAt = txt(x.endAt || x.effect_endDate || '');
    const beginDate = txt(x.beginDate || ymdFromAny(beginAt) || ymdFromAny(x.effect_beginDate) || '');
    const endDate = txt(x.endDate || ymdFromAny(endAt) || ymdFromAny(x.effect_endDate) || '');
    const src = txt(x.source || (txt(x.ec_code) ? 'legacy_coupon' : 'prize_mapping'));
    const actName = txt(x.actName);
    const amount = txt(x.amount || x.effect_price || parseAmount(name));
    const threshold = txt(x.threshold || x.lower_use_amt || '') || inferThreshold(name, actName, amount);
    out.push({
      key: txt(x.key) || ('legacy|' + src + '|' + name + '|' + beginDate + '|' + endDate),
      source: src,
      category: txt(x.category) || categoryOf(name),
      name: name,
      actName: actName,
      beginDate: beginDate,
      beginAt: beginAt,
      endDate: endDate,
      endAt: endAt,
      endDateSource: txt(x.endDateSource),
      amount: amount,
      threshold: threshold,
      createdAt: txt(x.createdAt || x.updateAt || now()),
      updateAt: txt(x.updateAt || x.createdAt || now()),
      count: Math.max(1, toInt(x.count, 1)),
    });
  }
  return out;
}

function captureReq() {
  const url = txt($request.url);
  const method = txt($request.method || 'GET').toUpperCase();
  const p = parseUrl(url);
  if (!p) return;
  if (!(method === 'GET' && p.host === 'chp.icbc.com.cn' && (p.path === '/bmcs/api-bmcs/v3/lott/h5/getActivityDetail' || p.path === '/bmcs/api-bmcs/v2/lott/h5/getActivityDetail'))) return;

  const hs = normHeaders($request.headers || {});
  const st = loadState();
  const old = st.lottery ? JSON.stringify(st.lottery) : '';
  const q = parseQuery(url);
  const ref = txt(hs.referer);
  st.lottery = {
    type: 'lottery',
    host: p.host,
    path: p.path,
    version: p.path.indexOf('/v3/') >= 0 ? 'v3' : 'v2',
    corpId: txt(q.corpId) || txt(st.lottery && st.lottery.corpId) || '2000000882',
    roccSwt: txt(q.roccSwt) || txt(st.lottery && st.lottery.roccSwt) || '0',
    ua: txt(hs['user-agent']),
    cookie: txt(hs.cookie),
    referer: ref,
    origin: txt(hs.origin) || deriveOrigin(ref, 'https://chp.icbc.com.cn'),
    contentType: txt(hs['content-type']) || 'application/json; charset=UTF-8',
    updateAt: now(),
  };
  const cur = JSON.stringify(st.lottery);
  if (old === cur) return log('ℹ️ 抓包字段无变化: lottery_state');
  saveState(st);
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
}

function captureGuideByClient() {
  if ($.isQuanX()) return CAPTURE_QX;
  if ($.isLoon()) return CAPTURE_LOON;
  if ($.isSurge()) return CAPTURE_SURGE;
  return 'QX:\n' + CAPTURE_QX + '\n\nLoon:\n' + CAPTURE_LOON + '\n\nSurge:\n' + CAPTURE_SURGE;
}

function loadState() {
  const o = toJSON($.getdata(STORE_KEY), {});
  if (!o || typeof o !== 'object') return { lottery: {}, runtime: {} };
  if (!o.lottery || typeof o.lottery !== 'object') o.lottery = {};
  if (!o.runtime || typeof o.runtime !== 'object') o.runtime = {};
  return o;
}
function saveState(st) { $.setdata(JSON.stringify(st || {}), STORE_KEY); }

function parseUrl(url) { const m = /^https?:\/\/([^\/?#]+)([^?#]*)(\?[^#]*)?/i.exec(String(url || '')); return m ? { host: txt(m[1]).toLowerCase(), path: txt(m[2]) || '/', search: txt(m[3] || '') } : null; }
function parseQuery(url) {
  const out = {}, i = String(url || '').indexOf('?');
  if (i < 0) return out;
  const arr = String(url || '').slice(i + 1).split('&');
  for (let k = 0; k < arr.length; k++) { const s = arr[k]; if (!s) continue; const p = s.indexOf('='); const kk = p >= 0 ? s.slice(0, p) : s; const vv = p >= 0 ? s.slice(p + 1) : ''; if (kk) out[decodeU(kk)] = decodeU(vv); }
  return out;
}
function deriveOrigin(ref, fallback) { const m = /^https?:\/\/[^\/?#]+/i.exec(String(ref || '')); return m ? m[0] : txt(fallback); }
function normHeaders(h) { const out = {}; const ks = Object.keys(h || {}); for (let i = 0; i < ks.length; i++) { const k = String(ks[i]).toLowerCase(); const v = h[ks[i]]; out[k] = Array.isArray(v) ? v.join('; ') : String(v == null ? '' : v); } return out; }

async function httpJSON(method, url, headers, body, timeoutMs) {
  try {
    await maybeWait(method, url);
    const resp = await $.http[method.toLowerCase()]({ url, headers: headers || {}, body: method === 'GET' ? undefined : body, timeout: timeoutMs || 20000 });
    const status = toInt(resp.statusCode || resp.status, 0);
    const text = typeof resp.body === 'string' ? resp.body : '';
    if (CFG.debug) log('🐞 HTTP ' + method + ' ' + url + ' | status=' + status + ' | bodyLen=' + text.length);
    if (status < 200 || status >= 300) return { error: { message: 'HTTP ' + status }, status, text, json: null };
    const js = toJSON(text, null);
    if (!js) return { error: { message: '非JSON响应' }, status, text, json: null };
    return { error: null, status, text, json: js };
  } catch (e) {
    return { error: { message: txt(e && e.message ? e.message : e) }, status: 0, text: '', json: null };
  }
}
async function maybeWait(method, url) {
  if (CFG.waitMinMs <= 0 && CFG.waitMaxMs <= 0) return;
  const lo = Math.min(CFG.waitMinMs, CFG.waitMaxMs), hi = Math.max(CFG.waitMinMs, CFG.waitMaxMs);
  const ms = hi <= lo ? lo : (lo + Math.floor(Math.random() * (hi - lo + 1)));
  if (ms <= 0) return;
  if (CFG.waitLog) log('⏳ 随机等待 ' + (ms / 1000).toFixed(2) + 's | ' + method + ' ' + (parseUrl(url) ? (parseUrl(url).host + parseUrl(url).path) : url));
  await new Promise(r => setTimeout(r, ms));
}

function deepFind(obj, keys) {
  for (let i = 0; i < keys.length; i++) {
    const v = findKey(obj, keys[i], 6);
    if (txt(v)) return txt(v);
  }
  return '';
}
function findKey(obj, key, depth) {
  if (!obj || depth < 0 || typeof obj !== 'object') return '';
  if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) { const v = findKey(obj[i], key, depth - 1); if (v) return v; }
    return '';
  }
  const ks = Object.keys(obj);
  for (let j = 0; j < ks.length; j++) { const v = findKey(obj[ks[j]], key, depth - 1); if (v) return v; }
  return '';
}

function pick(obj, paths) {
  for (let i = 0; i < paths.length; i++) {
    const segs = String(paths[i]).split('.');
    let cur = obj;
    let ok = true;
    for (let j = 0; j < segs.length; j++) {
      if (!cur || typeof cur !== 'object' || !Object.prototype.hasOwnProperty.call(cur, segs[j])) { ok = false; break; }
      cur = cur[segs[j]];
    }
    if (ok && cur != null) return cur;
  }
  return undefined;
}

function parseArg(s) { const o = {}; if (!s) return o; const arr = String(s).split('&'); for (let i = 0; i < arr.length; i++) { const seg = arr[i]; if (!seg) continue; const p = seg.indexOf('='); const k = p >= 0 ? seg.slice(0, p) : seg; const v = p >= 0 ? seg.slice(p + 1) : ''; if (k) o[decodeU(k)] = decodeU(v.replace(/\+/g, '%20')); } return o; }
function decodeU(s) { try { return decodeURIComponent(String(s || '')); } catch (e) { return String(s || ''); } }
function toBool(v, d) { if (v === undefined || v === null || v === '') return !!d; const s = String(v).toLowerCase(); if (s === '1' || s === 'true' || s === 'yes' || s === 'on') return true; if (s === '0' || s === 'false' || s === 'no' || s === 'off') return false; return !!d; }
function toInt(v, d) { const n = parseInt(String(v), 10); return isNaN(n) ? d : n; }
function toTsMs(v) { if (v === undefined || v === null || v === '') return 0; const s = String(v).trim(); if (/^\d{10,13}$/.test(s)) { const n = parseInt(s, 10); return s.length === 10 ? n * 1000 : n; } const p = Date.parse(s.replace(' ', 'T')); return isNaN(p) ? 0 : p; }
function toJSON(s, d) { if (!s || typeof s !== 'string') return d; try { return JSON.parse(s); } catch (e) { return d; } }
function txt(v) { return String(v == null ? '' : v).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function ymdFromAny(v) {
  const s = txt(v);
  if (!s) return '';
  if (/^\d{8}$/.test(s)) return s;
  const m = /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/.exec(s);
  if (m) return m[1] + pad2(toInt(m[2], 0)) + pad2(toInt(m[3], 0));
  const t = toTsMs(s);
  if (t > 0) {
    const d = new Date(t);
    return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
  }
  return '';
}
function fmtDateTime(v) {
  const s = txt(v);
  if (!s) return '未知时间';
  if (/^\d{8}$/.test(s)) return fmtDate(s);
  const t = toTsMs(s);
  if (t > 0) return fmtTs(t);
  return s;
}
function fmtRemainDhm(endAt) {
  const ts = toTsMs(endAt);
  if (!(ts > 0)) return '未知';
  let diff = ts - Date.now();
  if (diff <= 0) return '0天0小时0分钟';
  const totalMin = Math.floor(diff / 60000);
  const d = Math.floor(totalMin / (24 * 60));
  const h = Math.floor((totalMin % (24 * 60)) / 60);
  const m = totalMin % 60;
  return d + '天' + h + '小时' + m + '分钟';
}
function beijingYmd() { const d = new Date(Date.now() + (8 * 60 + new Date().getTimezoneOffset()) * 60000); return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()); }
function addDaysYmd(ymd, days) {
  const s = txt(ymd);
  if (!/^\d{8}$/.test(s)) return '';
  const y = parseInt(s.slice(0, 4), 10);
  const m = parseInt(s.slice(4, 6), 10);
  const d = parseInt(s.slice(6, 8), 10);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + toInt(days, 0));
  return dt.getUTCFullYear() + pad2(dt.getUTCMonth() + 1) + pad2(dt.getUTCDate());
}
function ymdInt(s) { const t = txt(s); return /^\d{8}$/.test(t) ? toInt(t, 0) : 0; }
function fmtDate(v) { const s = txt(v); return /^\d{8}$/.test(s) ? (s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8)) : (s || '未知日期'); }
function fmtTs(v) {
  const t = typeof v === 'number' ? v : toTsMs(v);
  if (!(t > 0)) return txt(v);
  const d = new Date(t);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
}
function now() { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()); }
function pad2(n) { return n < 10 ? '0' + n : String(n); }
function log(s) { const line = '[' + now() + '] ' + s; if ($ && typeof $.log === 'function') $.log(line); else console.log(line); }

function Env(name) {
  this.name = name;
  this.startTime = Date.now();
  this.data = null;
  this.dataFile = 'box.dat';
  this.logs = [];
  this.logSeparator = '\n';
  const self = this;
  this.http = {
    get: function (opts) { return self._request('GET', opts); },
    post: function (opts) { return self._request('POST', opts); },
  };
}
Env.prototype.isNode = function () { return typeof module !== 'undefined' && !!module.exports; };
Env.prototype.isQuanX = function () { return typeof $task !== 'undefined'; };
Env.prototype.isSurge = function () { return typeof $httpClient !== 'undefined' && typeof $loon === 'undefined'; };
Env.prototype.isLoon = function () { return typeof $loon !== 'undefined'; };
Env.prototype.getdata = function (key) {
  if (this.isSurge() || this.isLoon()) return $persistentStore.read(key);
  if (this.isQuanX()) return $prefs.valueForKey(key);
  if (this.isNode()) { this.data = this.loaddata(); return this.data[key]; }
  return null;
};
Env.prototype.setdata = function (val, key) {
  if (this.isSurge() || this.isLoon()) return $persistentStore.write(val, key);
  if (this.isQuanX()) return $prefs.setValueForKey(val, key);
  if (this.isNode()) { this.data = this.loaddata(); this.data[key] = val; this.writedata(); return true; }
  return false;
};
Env.prototype.loaddata = function () {
  if (!this.isNode()) return {};
  const fs = require('fs'); const path = require('path');
  const p1 = path.resolve(this.dataFile); const p2 = path.resolve(process.cwd(), this.dataFile);
  const t = fs.existsSync(p1) ? p1 : (fs.existsSync(p2) ? p2 : '');
  if (!t) return {};
  try { return JSON.parse(fs.readFileSync(t)); } catch (e) { return {}; }
};
Env.prototype.writedata = function () { if (!this.isNode()) return; const fs = require('fs'); const path = require('path'); fs.writeFileSync(path.resolve(this.dataFile), JSON.stringify(this.data, null, 2)); };
Env.prototype.msg = function (title, subtitle, body, opts) {
  if (this.isSurge() || this.isLoon()) $notification.post(title, subtitle, body, opts);
  else if (this.isQuanX()) $notify(title, subtitle, body, opts);
  else console.log(['', '==============系统通知==============', title, subtitle || '', body || ''].join('\n'));
};
Env.prototype.log = function () { const args = Array.prototype.slice.call(arguments); this.logs = this.logs.concat(args); console.log(args.join(this.logSeparator)); };
Env.prototype.logErr = function (err) { const e = err && err.stack ? err.stack : String(err); this.log('❗️' + this.name + ' 错误: ' + e); };
Env.prototype.done = function (val) { const sec = (Date.now() - this.startTime) / 1000; this.log('[' + now() + '] ' + this.name + ' 结束, 耗时 ' + sec.toFixed(3) + ' 秒'); if (this.isSurge() || this.isQuanX() || this.isLoon()) $done(val || {}); };
Env.prototype._request = function (method, opts) {
  const self = this;
  return new Promise(function (resolve, reject) {
    const req = typeof opts === 'string' ? { url: opts } : (opts || {});
    const timeout = toInt(req.timeout, 30000);
    if (self.isQuanX()) {
      const q = { url: req.url, method: method, headers: req.headers || {} };
      if (method !== 'GET' && req.body !== undefined) q.body = req.body;
      return $task.fetch(q).then(r => resolve({ status: r.statusCode, statusCode: r.statusCode, headers: r.headers, body: r.body })).catch(reject);
    }
    if (self.isSurge() || self.isLoon()) {
      const s = { url: req.url, headers: req.headers || {}, timeout: timeout / 1000 };
      if (method !== 'GET' && req.body !== undefined) s.body = req.body;
      const cb = function (err, resp, body) { if (err) reject(err); else { resp.body = body; resp.statusCode = resp.status; resolve(resp); } };
      return method === 'GET' ? $httpClient.get(s, cb) : $httpClient.post(s, cb);
    }
    if (self.isNode()) {
      try {
        const u = new URL(req.url); const isHttps = u.protocol === 'https:'; const lib = require(isHttps ? 'https' : 'http');
        const nodeReq = { method: method, hostname: u.hostname, port: u.port || (isHttps ? 443 : 80), path: (u.pathname || '/') + (u.search || ''), headers: req.headers || {} };
        if (isHttps) {
          const crypto = require('crypto');
          if (crypto && crypto.constants && crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT) nodeReq.secureOptions = crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT;
        }
        const r = lib.request(nodeReq, function (res) {
          const chunks = [];
          res.on('data', c => chunks.push(c));
          res.on('end', () => resolve({ status: res.statusCode, statusCode: res.statusCode, headers: res.headers || {}, body: Buffer.concat(chunks).toString('utf8') }));
        });
        r.on('error', reject);
        r.setTimeout(timeout, function () { r.destroy(new Error('Request timeout ' + timeout + 'ms')); });
        if (method !== 'GET' && req.body !== undefined) r.write(req.body);
        r.end();
      } catch (e) { reject(e); }
      return;
    }
    reject(new Error('Unknown runtime'));
  });
};
