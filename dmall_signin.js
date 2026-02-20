/**
 * 多点商城签到（兼容 QX / Surge / 青龙）
 * 说明：打开签到页自动抓 Cookie；脚本本体同时负责签到与任务查询
 * QX 抓包重写规则：
 * [rewrite_local]
 * ^https:\/\/appsign-in\.dmall\.com\/.* url script-request-header dmall_signin.js
 * ^https:\/\/sign-in\.dmall\.com\/.*      url script-request-header dmall_signin.js
 * ^https:\/\/sign-in\.dmall\.com\/checkIn url script-request-body   dmall_signin.js
 * [mitm]
 * hostname = appsign-in.dmall.com, sign-in.dmall.com
 */
const $ = new Env('多点商城签到')

const COOKIE_KEY = 'dmall_cookie'
const UA_KEY = 'dmall_ua'
const CHECKIN_BODY_KEY = 'dmall_checkin_body'
const TRACK_DATA_KEY = 'dmall_track_data'
const USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148Dmall/6.7.8'
const BASE_HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Content-Type': 'application/x-www-form-urlencoded',
  'Origin': 'https://appsign-in.dmall.com',
  'Referer': 'https://appsign-in.dmall.com/',
  'User-Agent': USER_AGENT
}

const API = {
  queryTasks: 'https://sign-in.dmall.com/queryTasks',
  checkIn: 'https://sign-in.dmall.com/checkIn',
  checkInQuery: 'https://sign-in.dmall.com/checkInQuery',
  queryInviteAct: 'https://sign-in.dmall.com/queryInviteAct',
  queryUserPoint: 'https://sign-in.dmall.com/queryUserPoint'
}

const BODY = {
  queryTasks: { currentPage: 1, pageSize: 20 },
  queryInviteAct: '{}'
}

const accountSummaries = []

!(async () => {
  if (typeof $request !== 'undefined') {
    captureCookie()
    return
  }
  const cookies = loadCookies()
  if (!cookies.length) {
    $.msg($.name, '未获取到 Cookie', '请打开签到页面进行抓包')
    return
  }
  for (let i = 0; i < cookies.length; i++) {
    await runAccount(cookies[i], i + 1, cookies.length)
  }
  showMsg()
})()
  .catch((e) => $.logErr(e))
  .finally(() => $.done())

function captureCookie() {
  const url = $request.url || ''
  if (!/appsign-in\.dmall\.com|sign-in\.dmall\.com/.test(url)) {
    return
  }
  const cookie = $request.headers?.Cookie || $request.headers?.cookie
  const ua = $request.headers?.['User-Agent'] || $request.headers?.['user-agent']
  const body = typeof $request.body === 'string' ? $request.body : ''
  if (!cookie) {
    $.msg($.name, '获取 Cookie 失败', '未在请求头中找到 Cookie')
    return
  }
  $.setdata(cookie, COOKIE_KEY)
  if (ua) $.setdata(ua, UA_KEY)
  let hasTrackData = false
  if (/sign-in\.dmall\.com\/checkIn/.test(url) && body) {
    hasTrackData = saveCheckInBody(body)
  }
  const info = parseCookieInfo(cookie)
  const summary = formatCookieSummary(info)
  $.log('✅ 抓包成功')
  if (summary) $.log(`👤 用户概要: ${summary}`)
  if (hasTrackData) $.log('🧩 已保存 checkIn 请求体（含 trackData）')
  $.msg($.name, '获取 Cookie 成功', hasTrackData ? `${summary || '已保存到本地'} | 已捕获trackData` : (summary || '已保存到本地'))
}

function loadCookies() {
  const envCookie = (typeof process !== 'undefined' && process.env && (process.env.DMALL_COOKIE || process.env.dmall_cookie)) || ''
  const dataCookie = $.getdata(COOKIE_KEY) || ''
  const raw = (envCookie || dataCookie || '').trim()
  if (!raw) return []
  return raw.split(/\n/).map(s => s.trim()).filter(Boolean)
}

function saveCheckInBody(body) {
  const form = parseFormBody(body)
  if (!form.trackData) return false
  $.setdata(body, CHECKIN_BODY_KEY)
  const parsedTrack = safeJSONParse(form.trackData, null)
  if (parsedTrack) {
    $.setdata($.toStr(parsedTrack), TRACK_DATA_KEY)
  }
  return true
}

function buildRuntimeContext(cookie, ua) {
  const tenantId = getCookieVal(cookie, 'dmTenantId') || getCookieVal(cookie, 'tenantId') || '1'
  const vendorId = getCookieVal(cookie, 'venderId') || getCookieVal(cookie, 'vender_id') || getCookieVal(cookie, 'vendorId') || getCookieVal(cookie, 'vendor_id') || '1'
  const platform = (getCookieVal(cookie, 'platform') || 'IOS').toUpperCase()
  const appVersion = getCookieVal(cookie, 'appVersion') || '6.7.8'
  const storeId = getCookieVal(cookie, 'storeId') || getCookieVal(cookie, 'store_id') || ''
  const ticketName = getCookieVal(cookie, 'ticketName') || ''
  const sessionId = getCookieVal(cookie, 'track_id') || getCookieVal(cookie, 'session_id') || randomHex(32)
  const sessionCount = parseInt(getCookieVal(cookie, 'web_session_count') || getCookieVal(cookie, 'session_count') || '0', 10) || 0
  const firstSessionTime = parseInt(getCookieVal(cookie, 'first_session_time') || '0', 10) || 0
  const env = platform === 'IOS' ? 'app_ios' : 'app_android'
  return {
    tenantId,
    vendorId,
    platform,
    appVersion,
    storeId,
    ticketName,
    sessionId,
    sessionCount,
    firstSessionTime,
    env,
    ua: ua || USER_AGENT
  }
}

function buildCheckInBody(cookie, ua) {
  const ctx = buildRuntimeContext(cookie, ua)
  const trackData = buildTrackData(cookie, ctx)
  return buildFormBody({
    tenantId: ctx.tenantId,
    platform: ctx.platform,
    vendorId: ctx.vendorId,
    trackData: $.toStr(trackData)
  })
}

function buildTrackData(cookie, ctx) {
  const fromBody = parseFormBody($.getdata(CHECKIN_BODY_KEY) || '')
  const fromBodyTrack = safeJSONParse(fromBody.trackData || '', null)
  const fromDataTrack = safeJSONParse($.getdata(TRACK_DATA_KEY) || '', null)
  const base = cloneObj(fromDataTrack || fromBodyTrack || {})
  const guessed = guessDeviceInfo(ctx.ua, ctx.platform)

  const tpc = getCookieVal(cookie, 'tpc') || base?.source?.tpc || base?.$source?.tpc || ''
  const tdc = getCookieVal(cookie, 'tdc') || base?.source?.tdc || base?.$source?.tdc || ''
  const pageUrl = base?.attrs?.page_url || base?.$attrs?.page_url || 'https://appsign-in.dmall.com/?dmTransStatusBar=true&dmShowTitleBar=false&bounces=false&dmNeedLogin=true#/'
  const pageTitle = base?.attrs?.page_title || base?.$attrs?.page_title || '签到'

  base.session_id = ctx.sessionId
  base.sdk_type = base.sdk_type || 'js'
  base.data_seq = Number.isFinite(base.data_seq) ? base.data_seq : 0
  base.data_version = base.data_version || '1.0'
  base.debug_mode = base.debug_mode || 'DEBUG_OFF'
  base.client_time = Number.isFinite(base.client_time) ? base.client_time : 0
  base.unique_id = typeof base.unique_id === 'string' ? base.unique_id : ''
  base.user_id = typeof base.user_id === 'string' ? base.user_id : ''
  if (ctx.ticketName) base.ticket_name = ctx.ticketName
  base.project = base.project || '商城APP'
  base.env = base.env || ctx.env

  const system = {
    app_version: ctx.appVersion,
    first_session_time: ctx.firstSessionTime,
    session_count: ctx.sessionCount,
    imei: '',
    idfa: '',
    mac: '',
    android_id: '',
    user_agent: ctx.ua,
    dev_type: base?.system?.dev_type || base?.$system?.dev_type || guessed.devType,
    dev_platform: ctx.platform,
    dev_platform_version: base?.system?.dev_platform_version || base?.$system?.dev_platform_version || guessed.devPlatformVersion,
    dev_manufacturer: base?.system?.dev_manufacturer || base?.$system?.dev_manufacturer || guessed.devManufacturer,
    dev_carrier: '',
    dev_network_type: base?.system?.dev_network_type || base?.$system?.dev_network_type || '2',
    app_notification_state: getCookieVal(cookie, 'isOpenNotification') || base?.system?.app_notification_state || '0'
  }

  const attrs = {
    page_title: pageTitle,
    page_url: pageUrl,
    vender_id: ctx.vendorId,
    store_id: ctx.storeId
  }

  const source = { tpc, tdc }

  base.system = system
  base.$system = cloneObj(system)
  base.attrs = attrs
  base.$attrs = cloneObj(attrs)
  base.source = source
  base.$source = cloneObj(source)
  return base
}

async function runAccount(cookie, index, total) {
  const ua = $.getdata(UA_KEY) || USER_AGENT
  const headers = { ...BASE_HEADERS, 'User-Agent': ua, 'Cookie': cookie }
  const ctx = buildRuntimeContext(cookie, ua)
  const runtimeBody = {
    queryTasks: buildFormBody({
      tenantId: ctx.tenantId,
      vendorId: ctx.vendorId,
      currentPage: BODY.queryTasks.currentPage,
      pageSize: BODY.queryTasks.pageSize,
      platform: ctx.platform
    }),
    checkInQuery: buildFormBody({
      tenantId: ctx.tenantId,
      platform: ctx.platform,
      vendorId: ctx.vendorId
    }),
    checkIn: buildCheckInBody(cookie, ua),
    queryInviteAct: BODY.queryInviteAct,
    queryUserPoint: buildFormBody({
      tenantId: ctx.tenantId,
      vendorId: ctx.vendorId
    })
  }
  const userId = getCookieVal(cookie, 'userId')
  $.log(`\n🧾 ===== 账号 ${index}/${total} =====`)
  $.log(`👤 userId: ${userId || '未知'}`)

  let signStatus = '未知'
  let progressText = ''
  let rewardText = ''
  let nextDesc = ''
  let signPoint = 0
  let taskCount = '未知'
  let pointText = '未知'

  const checkInfo = await post(API.checkInQuery, runtimeBody.checkInQuery, headers)
  if (checkInfo?.code === '0000') {
    const checkObj = checkInfo?.data?.checkInQuery || {}
    const checked = !!checkObj.checked
    const step = Number.isFinite(checkObj.step) ? checkObj.step : null
    if (step !== null) progressText = `连续签到${step}天`
    $.log(`📌 签到状态: ${checked ? '已签到' : '未签到'}`)
    if (progressText) $.log(`🔁 ${progressText}`)
    if (checked) {
      signStatus = '已签到'
      $.log('✅ 今日已签到')
    } else {
      const signRes = await post(API.checkIn, runtimeBody.checkIn, headers)
      if (signRes?.code === '0000') {
        signStatus = '签到成功'
        if (step !== null) progressText = `连续签到${step + 1}天`
        const rewards = signRes?.data?.rewards || []
        rewardText = formatRewards(rewards)
        signPoint = sumRewardPoints(rewards)
        nextDesc = signRes?.data?.nextPeriodRewardDesc || ''
        $.log('✅ 签到成功')
        if (rewardText) $.log(`🎁 签到奖励: ${rewardText}`)
        if (signPoint) $.log(`🪙 签到积分: ${signPoint}`)
        if (nextDesc) $.log(`🔜 ${nextDesc}`)
      } else {
        signStatus = '签到失败'
        $.log(`❌ 签到失败: code=${signRes?.code || '未知'} msg=${signRes?.msg || '未知'}`)
      }
    }
  } else {
    signStatus = '签到状态查询失败'
    $.log(`❌ 查询签到失败: code=${checkInfo?.code || '未知'} msg=${checkInfo?.msg || '未知'}`)
  }

  const tasksRes = await post(API.queryTasks, runtimeBody.queryTasks, headers)
  if (tasksRes?.code === '0000') {
    const list = tasksRes?.data?.list || []
    taskCount = String(list.length)
    $.log(`🧩 任务数量: ${list.length}`)
  } else {
    $.log(`⚠️ 查询任务失败: ${tasksRes?.msg || '未知'}`)
  }

  const pointRes = await post(API.queryUserPoint, runtimeBody.queryUserPoint, headers)
  if (pointRes?.code === '0000') {
    const pointData = pointRes?.data
    const point = (pointData && typeof pointData === 'object')
      ? (pointData.userPoint ?? pointData.point)
      : pointData
    pointText = point === 0 || point ? String(point) : '未知'
    $.log(`💰 当前积分: ${pointText}`)
  } else {
    $.log(`⚠️ 查询积分失败: ${pointRes?.msg || '未知'}`)
  }

  const inviteRes = await post(API.queryInviteAct, runtimeBody.queryInviteAct, headers)
  if (inviteRes?.code === '0000') {
    const title = inviteRes?.data?.title || inviteRes?.data?.name || ''
    if (title) $.log(`🤝 邀请活动: ${title}`)
  }

  const statusEmoji = pickStatusEmoji(signStatus)
  const progressLine = progressText ? `🔁${progressText}` : '🔁连续签到未知'
  const taskLine = taskCount !== '未知' ? `🧩任务${taskCount}` : '🧩任务?'
  const pointLine = pointText !== '未知' ? `💰${pointText}` : '💰未知'
  const signPointLine = signPoint ? `🪙+${signPoint}` : ''
  const summaryLine = `账号${index}(${userId || '未知'}): ${statusEmoji}${signStatus} | ${progressLine} | ${taskLine} | ${pointLine}${signPointLine ? ' | ' + signPointLine : ''}`
  accountSummaries.push(summaryLine)
  if (rewardText) accountSummaries.push(`🎁 签到奖励: ${rewardText}`)
  if (nextDesc) accountSummaries.push(`🔜 ${nextDesc}`)
}

async function post(url, body, headers) {
  const resp = await $.http.post({ url, headers, body })
  return $.toObj(resp?.body, {})
}

function parseFormBody(raw) {
  const out = {}
  if (!raw || typeof raw !== 'string') return out
  raw.split('&').forEach((item) => {
    if (!item) return
    const idx = item.indexOf('=')
    const k = idx === -1 ? item : item.slice(0, idx)
    const v = idx === -1 ? '' : item.slice(idx + 1)
    const key = safeDecode(k)
    const val = safeDecode(v.replace(/\+/g, '%20'))
    if (key) out[key] = val
  })
  return out
}

function buildFormBody(obj) {
  return Object.keys(obj).map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(obj[k] == null ? '' : String(obj[k]))}`).join('&')
}

function safeDecode(str) {
  try {
    return decodeURIComponent(str)
  } catch {
    return str
  }
}

function safeJSONParse(str, fallback) {
  if (!str || typeof str !== 'string') return fallback
  try {
    return JSON.parse(str)
  } catch {
    return fallback
  }
}

function cloneObj(obj) {
  if (!obj || typeof obj !== 'object') return {}
  return safeJSONParse($.toStr(obj), {})
}

function guessDeviceInfo(ua, platform) {
  const text = String(ua || '').toLowerCase()
  const isIOS = platform === 'IOS'
  let devPlatformVersion = ''
  if (isIOS) {
    const m = text.match(/os\s+([0-9_]+)/)
    if (m && m[1]) devPlatformVersion = m[1].replace(/_/g, '.')
  } else {
    const m = text.match(/android\s+([0-9.]+)/)
    if (m && m[1]) devPlatformVersion = m[1]
  }
  return {
    devType: isIOS ? 'iPhone' : 'Android',
    devPlatformVersion,
    devManufacturer: isIOS ? 'iPhone' : 'Android'
  }
}

function randomHex(len) {
  const chars = '0123456789ABCDEF'
  let out = ''
  for (let i = 0; i < len; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return out
}

function getCookieVal(cookie, name) {
  const match = cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? match[1] : ''
}

function parseCookieInfo(cookie) {
  return {
    userId: getCookieVal(cookie, 'userId') || getCookieVal(cookie, 'user_id'),
    storeId: getCookieVal(cookie, 'storeId') || getCookieVal(cookie, 'store_id'),
    platform: getCookieVal(cookie, 'platform'),
    appVersion: getCookieVal(cookie, 'appVersion'),
    dmTenantId: getCookieVal(cookie, 'dmTenantId'),
    businessCode: getCookieVal(cookie, 'businessCode')
  }
}

function formatCookieSummary(info) {
  if (!info) return ''
  const parts = []
  if (info.userId) parts.push(`userId:${info.userId}`)
  if (info.storeId) parts.push(`storeId:${info.storeId}`)
  if (info.platform) parts.push(`平台:${info.platform}`)
  if (info.appVersion) parts.push(`版本:${info.appVersion}`)
  if (info.dmTenantId) parts.push(`租户:${info.dmTenantId}`)
  if (info.businessCode) parts.push(`业务:${info.businessCode}`)
  return parts.join(' | ')
}

function formatRewards(rewards) {
  if (!Array.isArray(rewards) || !rewards.length) return ''
  return rewards.map((r) => {
    const name = r?.name || '奖励'
    const count = r?.count ?? 1
    return `${name}x${count}`
  }).join('、')
}

function sumRewardPoints(rewards) {
  if (!Array.isArray(rewards) || !rewards.length) return 0
  return rewards.reduce((sum, r) => {
    if (r?.type !== 2) return sum
    const num = Number(r?.count || 0)
    return Number.isFinite(num) ? sum + num : sum
  }, 0)
}

function pickStatusEmoji(status) {
  if (!status) return '⚠️'
  if (status.includes('成功') || status.includes('已签到')) return '✅'
  if (status.includes('失败')) return '❌'
  return '⚠️'
}

function showMsg() {
  if (!accountSummaries.length) {
    $.msg($.name, '⚠️ 执行完成', '未生成摘要，请查看日志详情')
    return
  }
  const accountCount = accountSummaries.filter(l => l.startsWith('账号')).length
  const subtitle = accountCount > 1 ? `✅ 执行完成（${accountCount}账号）` : '✅ 执行完成'
  const desc = accountSummaries.join('\n')
  $.msg($.name, subtitle, desc)
}

// prettier-ignore
function Env(t,e){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`🔔${this.name}, 开始!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}isShadowrocket(){return"undefined"!=typeof $rocket}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getjson(t,e){let s=e;const i=this.getdata(t);if(i)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,i)=>e(i))})}runScript(t,e){return new Promise(s=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let r=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");r=r?1*r:20,r=e&&e.timeout?e.timeout:r;const[o,h]=i.split("@"),a={url:`http://${h}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:r},headers:{"X-Key":o,Accept:"*/*"}};this.post(a,(t,e,i)=>s(i))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e);if(!s&&!i)return{};{const i=s?t:e;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e),r=JSON.stringify(this.data);s?this.fs.writeFileSync(t,r):i?this.fs.writeFileSync(e,r):this.fs.writeFileSync(t,r)}}lodash_get(t,e,s){const i=e.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of i)if(r=Object(r)[t],void 0===r)return s;return r}lodash_set(t,e,s){return Object(t)!==t?t:(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce((t,s,i)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[i+1])>>0==+e[i+1]?[]:{},t)[e[e.length-1]]=s,t)}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,r]=/^@(.*?)\.(.*?)$/.exec(e),o=this.getval(i),h=i?"null"===o?null:o||"{}":"{}";try{const e=JSON.parse(h);this.lodash_set(e,r,t),s=this.setval(JSON.stringify(e),i)}catch(e){const o={};this.lodash_set(o,r,t),s=this.setval(JSON.stringify(o),i)}}else s=this.setval(t,e);return s}getval(t){return this.isSurge()||this.isLoon()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setval(t,e){return this.isSurge()||this.isLoon()?$persistentStore.write(t,e):this.isQuanX()?$prefs.setValueForKey(t,e):this.isNode()?(this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0):this.data&&this.data[e]||null}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,e=(()=>{})){t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isLoon()?(this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)})):this.isQuanX()?(this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t))):this.isNode()&&(this.initGotEnv(t),this.got(t).on("redirect",(t,e)=>{try{if(t.headers["set-cookie"]){const s=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();s&&this.ckjar.setCookieSync(s,null),e.cookieJar=this.ckjar}}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)}))}post(t,e=(()=>{})){const s=t.method?t.method.toLocaleLowerCase():"post";if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient[s](t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)});else if(this.isQuanX())t.method=s,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t));else if(this.isNode()){this.initGotEnv(t);const{url:i,...r}=t;this.got[s](i,r).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)})}}time(t,e=null){const s=e?new Date(e):new Date;let i={"M+":s.getMonth()+1,"d+":s.getDate(),"H+":s.getHours(),"m+":s.getMinutes(),"s+":s.getSeconds(),"q+":Math.floor((s.getMonth()+3)/3),S:s.getMilliseconds()};/(y+)/.test(t)&&(t=t.replace(RegExp.$1,(s.getFullYear()+"").substr(4-RegExp.$1.length)));for(let e in i)new RegExp("("+e+")").test(t)&&(t=t.replace(RegExp.$1,1==RegExp.$1.length?i[e]:("00"+i[e]).substr((""+i[e]).length)));return t}msg(e=t,s="",i="",r){const o=t=>{if(!t)return t;if("string"==typeof t)return this.isLoon()?t:this.isQuanX()?{"open-url":t}:this.isSurge()?{url:t}:void 0;if("object"==typeof t){if(this.isLoon()){let e=t.openUrl||t.url||t["open-url"],s=t.mediaUrl||t["media-url"];return{openUrl:e,mediaUrl:s}}if(this.isQuanX()){let e=t["open-url"]||t.url||t.openUrl,s=t["media-url"]||t.mediaUrl;return{"open-url":e,"media-url":s}}if(this.isSurge()){let e=t.url||t.openUrl||t["open-url"];return{url:e}}}};if(this.isMute||(this.isSurge()||this.isLoon()?$notification.post(e,s,i,o(r)):this.isQuanX()&&$notify(e,s,i,o(r))),!this.isMuteLog){let t=["","==============📣系统通知📣=============="];t.push(e),s&&t.push(s),i&&t.push(i),console.log(t.join("\n")),this.logs=this.logs.concat(t)}}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`❗️${this.name}, 错误!`,t.stack):this.log("",`❗️${this.name}, 错误!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`🔔${this.name}, 结束! 🕛 ${s} 秒`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}}(t,e)}
