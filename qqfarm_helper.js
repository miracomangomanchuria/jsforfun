/*
本脚本仅供个人学习交流使用，严禁用于任何商业用途，请于下载后24小时内删除。
脚本无意侵犯任何第三方的肖像权、名誉权、著作权、商标权等合法权益，如涉嫌侵权，请权利人联系脚本，脚本将在收到通知后24小时内删除相关内容。
QQ 农牧场助手（Node / Quantumult X / Surge / Loon）

使用方式：
1) 填写 INLINE_COOKIE（推荐）或设置环境变量 QQFARM_COOKIE。
2) 在 CONFIG.ENABLE 中开关任务。

说明：
- 以已知历史接口为基础的脚本骨架。
- 方便后续结合抓包逐步完善与适配。
*/

/* =======================
 *  配置区（在此修改）
 * ======================= */
var CONFIG = {
  // 优先使用完整 Cookie（ptcz/openId/accessToken/newuin/openid/token/skey/uin）
  INLINE_COOKIE: "",
  // 仅走 WAP：不使用 g_tk；skey/uin 仅作为 Cookie 字段参与请求。

  // 牧场域名
  RANCH_BASE: "https://mcapp.z.qq.com",
  RANCH_SID: "c",
  RANCH_G_UT: "2",
  RANCH_FOOD: "", // 空则从页面链接里取第一个 food
  RANCH_MAX_SERIAL: 6,
  RANCH_TRY_ONEKEY_PRODUCT: true,
  RANCH_AUTO_REFILL: true, // 牧场补栏：优先背包饲养，不足再商店购买并饲养
  RANCH_REFILL_BAG_FIRST: true,
  RANCH_REFILL_SHOP_AFTER_BAG: true,
  RANCH_REFILL_SHOP_MAX_PAGES: 3,
  // 牧场售卖优先请求 step2（step1 在当前环境“系统繁忙”概率较高）
  RANCH_SELL_STEP2_FIRST: true,
  // 牧场售卖前后复查仓库“可售总价值”，用于结果核对与金额兜底
  RANCH_SELL_VERIFY_REP: true,
  // 牧场收获数量兜底：当接口不返回数量时，用仓库前后快照推断增量
  RANCH_HARVEST_REP_INFER: true,
  // 牧场仓库分页扫描上限（0=不限制，按页面总数扫描）
  RANCH_REP_SCAN_MAX_PAGES: 0,
  RANCH_DIRECT_REFERER: "", // 牧场进入时的 Referer（空=使用农场首页）

  // 农场 WAP（售卖/签到等）
  FARM_WAP_BASE: "https://mcapp.z.qq.com",
  FARM_G_UT: "", // 可手动指定；空则自动探测/沿用牧场 g_ut

  // 农场 JSON（farmTime/farmKey）
  FARM_JSON_BASE: "https://nc.qzone.qq.com",
  FARM_JSON_ENABLE: true,
  FARM_JSON_FALLBACK_WAP: true,
  // JSON 成功后仍跑一次 WAP 维护(除草/除虫/浇水)做对账，修正 JSON 与端游状态口径差异
  FARM_JSON_WAP_MAINT_RECHECK: true,
  // 清理后执行 JSON+WAP 双口径复查；仍有残留时可触发一次补打
  FARM_JSON_WAP_MAINT_POSTCHECK: true,
  FARM_JSON_WAP_MAINT_POSTCHECK_RETRY: 1,
  FARM_JSON_MAX_PASS: 2,
  // 仅观察(新接口判定)：只拉取/输出 JSON 状态与任务计划，不执行任何农场动作（含 WAP 维护）
  // 用于排查“手游显示待收获，但脚本不动/状态不一致”等问题。
  FARM_JSON_OBSERVE_ONLY: false,
  FARM_JSON_ENCODE_KEY: "@#$N*9Fi@KLJH#$dfghKLJHdfgh!$Fl12aOAISDs",
  FARM_JSON_USE_SWF_PARAMS: true,
  FARM_JSON_EMPTY_UIDX: true,
  FARM_JSON_LOCK_HEURISTIC: true,
  FARM_JSON_LOCK_GUARD: true,
  FARM_JSON_LOCK_GUARD_MIN_TOTAL: 18,
  FARM_JSON_GET_OUTPUT_ON_FAIL: true,
  FARM_JSON_SEED_ENABLE: true,
  FARM_JSON_CROP_ENABLE: true,
  FARM_JSON_SALE_ENABLE: true,
  FARM_SEED_JSON_BASE: "https://farm.qzone.qq.com",
  FARM_JSON_SWF_PARAMS: {
    "0": "http://appimg.qq.com/happyfarm/module/ui/main/farmui1_v_11.swf:239205",
    "1": "http://appimg.qq.com/happyfarm/module/ui/main/farmui2_v_3.swf:84829",
    "2": "http://appimg.qq.com/happyfarm/module/ui/main/commonui_v_2.swf:34689",
    "3": "http://appimg1.qq.com/happyfarm/module/ui/crops/Seeds.swf?v=5:121403",
    "4": "http://appimg1.qq.com/happyfarm/module/ui/crops/Seeds_2.swf?v=4:104972",
    "5": "http://appimg1.qq.com/happyfarm/module/ui/crops/Seeds_3.swf?v=2:6223",
    "6": "http://appimg1.qq.com/happyfarm/module/ui/crops/Flowers.swf?v=4:49838",
    "7": "http://appimg.qq.com/happyfarm/module/ui/main/task.swf?v=42:35155",
    "8": "http://appimg.qq.com/happyfarm/module/ui/main/NPC2.swf:10162",
    "9": "http://appimg.qq.com/happyfarm/module/Main_v_33.swf:198778",
    "10": "module/loading_v_11.swf"
  },

  // 鱼塘
  FISH_BASE: "https://mcapp.z.qq.com",
  FISH_G_UT: "", // 可手动指定；空则沿用农场/牧场 g_ut
  FISH_USE_ONEKEY_FEED: true,
  // 鱼塘动作先查询后执行，减少“无效请求”
  FISH_FEED_QUERY_FIRST: true,
  FISH_HARVEST_QUERY_JSON_FIRST: true,
  FISH_BUY_QUERY_FIRST: true,
  FISH_SELL_QUERY_FIRST: true,
  // 喂鱼若触发花费/购买提示则视为异常（仍会记录提示）
  FISH_FEED_ALLOW_SPEND: false,
  FISH_SELL_IDS: "",
  FISH_AUTO_PLANT: true,
  FISH_AUTO_BUY: true,
  FISH_BUY_FID: "35",
  FISH_MIN_SEED: 50, // 背包/仓库鱼苗目标数
  FISH_BUY_NUM: 50, // 单次购买量(默认与目标数一致)
  FISH_TRY_FALLBACK_HARVEST: false,
  FISH_FALLBACK_INDEX: "",
  // 目标池塘格数：手游端常见为 8；若你实际只有 6 格也没关系，放养会自动停止。
  FISH_MAX_POND: 8,
  // 鱼塘复查安全上限（0=不限制，达到条件即退出）
  FISH_CLEANUP_MAX_PASS: 0,
  // 空池塘未知时，尝试通过购买预览页补判空位
  FISH_EMPTY_FALLBACK: true,
  // 鱼塘空位主判定：优先走 JSON(cgi_fish_index)，WAP 仅作兜底与对照
  FISH_JSON_INDEX_ENABLE: true,
  // 放养优先走 JSON(cgi_fish_plant)，WAP 作为兜底
  FISH_PLANT_JSON_FIRST: true,
  // 珍珠抽奖：每次运行按 free_times 判定免费额度并尝试（QX/Surge/Loon 默认启用，Node 默认关闭）
  FISH_PEARL_DRAW_DAILY: true,
  FISH_PEARL_DRAW_NODE: false,
  FISH_PEARL_DRAW_FORCE_FREE: true,
  FISH_PEARL_ITEM_NAME_MAP: {}, // 可按奖励 id 映射名称，如 {"117":"海蓝碎片"}
  FISH_PEARL_NAME_AUTO_MAP: true, // 自动从鱼塘图鉴接口拉取 fid->名称 映射（若接口返回）
  FISH_AUTO_COMPOSE: true, // 自动将可合成的鱼苗碎片合成为鱼苗
  FISH_COMPOSE_HISTORY_TYPE: "2", // 图鉴分页，默认 2（根据抓包可返回可合成列表）
  FISH_COMPOSE_MAX_PER_ID: 0, // 单个 fid 最多合成次数（0=按接口可合成次数）
  FISH_COMPOSE_MAX_TOTAL: 0, // 单次总合成上限（0=不限制）
  FISH_COMPOSE_PRECHECK: true, // 合成前先结合 piece 状态做门槛预判，减少“碎片不足”空请求
  FISH_COMPOSE_HINTS_ENABLE: false, // 关闭静态门槛表，优先按接口“能否 compose”判定（近似按钮亮/暗）
  FISH_COMPOSE_NEED_HINTS: {
    // 依据“我的碎片”界面分母门槛，可按实际抓包/界面继续补充
    "108": 5,
    "109": 5,
    "110": 10,
    "111": 10,
    "112": 10,
    "113": 10,
    "114": 10,
    "115": 20,
    "116": 20,
    "117": 20,
    "118": 20,
    "119": 20,
    "120": 40,
    "121": 40,
    "122": 40,
    "123": 40,
    "124": 40,
    "125": 60,
    "126": 80,
    "127": 80,
    "128": 80,
    "129": 80
  },
  FISH_PREFER_RARE_SEED: true, // 放养时优先珍稀鱼苗（非基础鱼苗/高 fid）
  FISH_RARE_FID_PRIORITY: "117,116,119,118,115,114,113,112,111,110,109,108",

  // 蜂巢（放养蜜蜂/收获蜂蜜）
  HIVE_BASE: "https://nc.qzone.qq.com",
  HIVE_ENABLE: true,
  HIVE_AUTO_HARVEST: true, // 收蜂蜜(非卖蜜)
  HIVE_AUTO_UPGRADE: true, // 自动升级蜜蜂（可升才升）
  HIVE_UPGRADE_IDS: "2,1", // 升级顺序（优先2号蜂，再尝试1号蜂）
  HIVE_UPGRADE_COST_HINTS: {
    "2": 200,
    "1": 100
  }, // 升级耗蜜预判（用于“先判定再请求”，按抓包可调）
  HIVE_UPGRADE_MAX: 2, // 单轮最多升级次数（0=不限制）
  HIVE_UPGRADE_BUSY_COOLDOWN_SEC: 1800, // 升级接口繁忙后，该蜂冷却时长（秒）
  HIVE_AUTO_POLLEN: true, // 自动喂花粉（优先免费）
  HIVE_AUTO_WORK: true,
  HIVE_WORK_REQUIRE_FREECD: true, // 放蜂前要求花粉可用值>0（本轮喂粉成功可放行）
  HIVE_TRY_HARVEST_ON_STATUS1: true, // 状态1但蜂蜜>0时，仍补探测一次收蜜

  // 节气/活动（状态检测 + 每日领取）
  FARM_EVENT_BASE: "https://nc.qzone.qq.com",
  FARM_EVENT_ENABLE: true,
  FARM_EVENT_SEEDHB_ENABLE: true, // /cgi_farm_seedhb act=9/10
  FARM_EVENT_SEEDHB_AUTO_CLAIM: true, // 有可领时自动 act=10
  FARM_EVENT_BULING_ENABLE: true, // /cgi_farm_buling act=index/get
  FARM_EVENT_BULING_AUTO_CLAIM: true, // 奖励补领有可领时自动领取
  FARM_EVENT_BULING_MAX_LOOP: 5, // 奖励补领复查轮次上限
  FARM_EVENT_WISH_ENABLE: true, // /cgi_farm_wish_*
  FARM_EVENT_WISH_MAX_PASS: 8, // 许愿链路循环上限（按状态逐步推进）
  FARM_EVENT_WISH_AUTO_COLLECT: true, // 一键收取星星（type=1）
  FARM_EVENT_WISH_AUTO_RANDOM: true, // 许愿（act=random）
  FARM_EVENT_WISH_RANDOM_MAX: 0, // 单轮最多许愿次数（0=按星值自动）
  FARM_EVENT_WISH_AUTO_STAR: true, // 自动领取 starlist 中可领奖（type=0）
  FARM_EVENT_WISH_AUTO_HARVEST: true, // status=4 时自动收取许愿奖励
  FARM_EVENT_WISH_AUTO_PLANT: true, // status=0 时自动许愿（优先当前可选愿望）
  FARM_EVENT_WISH_AUTO_UPGRADE: true, // status=0 且星值足够时自动点星升级
  FARM_EVENT_WISH_UPGRADE_MAX: 20, // 单轮点星升级上限（0=不限制）
  FARM_EVENT_WISH_AUTO_HELP: true, // 自动执行一次 wish_help
  FARM_EVENT_DAY7_PROBE: true, // 仅状态探测 day7Login_index
  FARM_EVENT_RETRY_TRANSIENT: 5, // 活动接口遇到“系统繁忙”等提示时重试次数（最少1）
  FARM_SIGNIN_BOARD_ENABLE: true, // 月签签到板（/cgi_farm_month_signin_*）自动领奖
  FARM_SIGNIN_BOARD_MAX_LOOP: 12, // 月签签到板单轮最多领奖次数

  // 时光农场（独立于普通农场）
  TIME_FARM_BASE: "https://nc.qzone.qq.com",
  TIME_FARM_SEED_BASE: "https://farm.qzone.qq.com",
  TIME_FARM_ENABLE: true,
  TIME_FARM_MAX_PASS: 2,
  TIME_FARM_HARVEST_ENABLE: true,
  TIME_FARM_DIG_ENABLE: true,
  TIME_FARM_PLANT_ENABLE: true,
  TIME_FARM_PLANT_CROPID: "", // 空=从时光农场种子列表自动选择首个可种
  TIME_FARM_PREFER_SPECIAL_SEED: true, // 优先时光农场专用种子（若背包有）
  TIME_FARM_FERTILIZE_ENABLE: false, // 默认关闭，避免日常误消耗化肥
  TIME_FARM_FERT_TOOLID: "1",
  TIME_FARM_TASK_AUTO_CLAIM: true, // 时光任务达成后自动领奖（taskid）
  TIME_FARM_TASK_NAME_MAP: {
    // 时光任务名称映射（按任务面板可见文案自行维护，key=taskid）
    // "4": "收获时光作物",
    // "7": "连续签到"
  },
  TIME_FARM_TASK_TARGET_HINTS: {
    // 仅用于“状态仍为进行中但进度已达标”的补判，门槛可按个人任务面板补齐
    "3": 10,
    "4": 10
  },

  // 播种作物（兼容旧版/现代接口时使用）
  PLANT_CID: "40",
  GRASS_THRESHOLD: 10000, // 牧草果实库存低于此值，优先种牧草
  // 农场售卖保护：优先保护时光/节气等特殊果实，避免一键售卖误卖
  FARM_SELL_PROTECT_ENABLE: true,
  FARM_SELL_PROTECT_LOCK_ENABLE: true, // 先在 WAP 仓库执行加锁，再走售卖
  FARM_SELL_PROTECT_STRICT: true, // 保护模式下若 JSON 售卖失败，不回退 WAP 一键售卖，避免误卖
  FARM_SELL_PROTECT_NAMES: ["占城稻"], // 精确名称保护（可按需追加）
  FARM_SELL_PROTECT_PREFIXES: [
    "立春",
    "雨水",
    "惊蛰",
    "春分",
    "清明",
    "谷雨",
    "立夏",
    "小满",
    "芒种",
    "夏至",
    "小暑",
    "大暑",
    "立秋",
    "处暑",
    "白露",
    "秋分",
    "寒露",
    "霜降",
    "立冬",
    "小雪",
    "大雪",
    "冬至",
    "小寒",
    "大寒",
    "除夕",
    "元宵"
  ], // 前缀命中保护（如“雨水-银柳”）
  FARM_SELL_PROTECT_TIME_KEYWORDS: "时光|占城|吴中|关陇|滇西|南蛮|龟兹|南阳",

  // 农场买种子（牧草）
  FARM_SEED_HOST: "https://farm.qzone.qq.com",
  FARM_APPID: "353",
  FARM_PLATFORM: "13",
  FARM_VERSION: "4.0.20.0",
  FARM_GRASS_SEED_ID: "40",
  FARM_GRASS_BUY_NUM: 2,
  FARM_SEED_MIN_TOTAL: 25,
  FARM_SEED_BUY_NUM: 50,
  FARM_BUY_GRASS_ON_EMPTY: true,
  FARM_TRY_ONEKEY_SOW: true,
  FARM_TRY_ONEKEY_DIG: true,
  // WAP 兜底轮次（0=不限制，状态稳定即退出）
  FARM_WAP_MAX_PASS: 0,

  // 频率控制
  WAIT_MS: 600,
  // 0 = 不限制，直到无空地/无种子/无入口
  MAX_REPEAT: 0,
  RETRY_502: 2,
  RETRY_SHORT_BODY_LEN: 120,
  RETRY_WAIT_MS: 800,
  // 针对“系统繁忙/网络繁忙/请稍后再试”等提示的额外重试次数（不影响 502 重试）
  RETRY_TRANSIENT: 5,

  // 任务开关
  ENABLE: {
    harvest: true,
    scarify: true,
    plant: true,
    clearWeed: true,
    spraying: true,
    water: true,
    farm_sell_all: true,
    farm_signin: true,
    // 牧场占位（需真实接口）
    ranch_harvest: true,
    ranch_feed: true,
    ranch_help: true,
    ranch_product: true,
    ranch_sell_all: true,
    ranch_signin: true,
    fish_feed: true,
    fish_sell_all: true,
    fish_harvest: true,
    time_farm: true,
    hive: true
  },

  // 调试开关
  DEBUG: true,
  // 诊断模式：输出请求/响应摘要（用于定位空页/跳转）
  DIAG: true,
  // 是否输出背包/仓库统计
  LOG_BAG_STATS: false
};

var SCRIPT_REV = "2026.03.03-r42";

/* =======================
 *  ENV (NobyDa-like style)
 * ======================= */
var $ = Env("QQ Farm Helper");
var IS_QX = $.isQuanX;
var IS_LOON = $.isLoon;
var IS_SURGE = $.isSurge;
var IS_NODE = $.isNode;
var ENV_NAME = $.envName;
var COOKIE_SOURCE = "";

function getFarmGut() {
  return CONFIG.FARM_G_UT || CONFIG.RANCH_G_UT || "1";
}

function getFishGut() {
  return CONFIG.FISH_G_UT || CONFIG.FARM_G_UT || CONFIG.RANCH_G_UT || "1";
}

function Env(name) {
  var isQuanX = typeof $task !== "undefined";
  var isLoon = typeof $loon !== "undefined";
  var isSurge = typeof $httpClient !== "undefined" && !isLoon;
  var isNode = typeof module !== "undefined" && !!module.exports;
  var dataFile = "qqfarm_storage.json";
  var node = null;
  if (isNode) {
    node = {
      fs: require("fs"),
      path: require("path")
    };
  }

  function envName() {
    if (isQuanX) return "Quantumult X";
    if (isLoon) return "Loon";
    if (isSurge) return "Surge";
    if (isNode) return "Node";
    return "Unknown";
  }

  function notify(title, subtitle, body, opts) {
    if (isQuanX) {
      $notify(title, subtitle || "", body || "", opts || {});
    } else if (isSurge || isLoon) {
      $notification.post(title, subtitle || "", body || "", opts || {});
    } else {
      console.log(title + (subtitle ? " | " + subtitle : ""));
      if (body) console.log(body);
    }
  }

  function read(key) {
    if (isQuanX) return $prefs.valueForKey(key);
    if (isSurge || isLoon) return $persistentStore.read(key);
    if (isNode) {
      try {
        var f = node.path.resolve(__dirname, dataFile);
        if (!node.fs.existsSync(f)) return null;
        var data = JSON.parse(node.fs.readFileSync(f));
        return data[key];
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  function write(value, key) {
    if (isQuanX) return $prefs.setValueForKey(value, key);
    if (isSurge || isLoon) return $persistentStore.write(value, key);
    if (isNode) {
      try {
        var f = node.path.resolve(__dirname, dataFile);
        if (!node.fs.existsSync(f)) node.fs.writeFileSync(f, JSON.stringify({}));
        var data = JSON.parse(node.fs.readFileSync(f));
        if (value === null || value === undefined) delete data[key];
        else data[key] = value;
        node.fs.writeFileSync(f, JSON.stringify(data));
        return true;
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  function done(value) {
    if (isQuanX) return $done(value);
    if (isSurge || isLoon) return $done();
  }

  return {
    name: name,
    envName: envName(),
    isQuanX: isQuanX,
    isLoon: isLoon,
    isSurge: isSurge,
    isNode: isNode,
    notify: notify,
    read: read,
    write: write,
    done: done
  };
}

/* =======================
 *  UTIL
 * ======================= */
function log(msg) {
  console.log(msg);
  LOGS.push(msg);
}

function notify(title, subtitle, body, opts) {
  $.notify(title, subtitle || "", body || "", opts || {});
}

function clipText(text, maxLen) {
  var s = text === null || text === undefined ? "" : String(text);
  var max = Number(maxLen || 0);
  if (!max || max <= 0 || s.length <= max) return s;
  return s.slice(0, max) + "...";
}

function errText(e) {
  if (e === null || e === undefined) return String(e);
  if (typeof e === "string") return e;
  if (e && e.stack) return clipText(String(e.stack), 800);
  var parts = [];
  if (e.name) parts.push(String(e.name));
  if (e.code !== undefined && e.code !== null) parts.push("code=" + String(e.code));
  if (e.status !== undefined && e.status !== null) parts.push("status=" + String(e.status));
  if (e.message) parts.push(String(e.message));
  if (e.error && String(e.error) !== String(e.message || "")) parts.push(String(e.error));
  if (parts.length) return clipText(parts.join(" | "), 800);
  try {
    return clipText(JSON.stringify(e), 800);
  } catch (_) {
    return clipText(String(e), 800);
  }
}

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function nowTs() {
  return Math.floor(Date.now() / 1000);
}

function localDateKey() {
  var d = new Date();
  var y = d.getFullYear();
  var m = d.getMonth() + 1;
  var day = d.getDate();
  return y + "-" + (m < 10 ? "0" + m : m) + "-" + (day < 10 ? "0" + day : day);
}

function getFarmTime() {
  var base = nowTs();
  var delta = FARM_CTX.timeDelta || 0;
  return base + delta;
}

function updateFarmTimeDelta(t) {
  var n = parseInt(t, 10);
  if (!n || isNaN(n) || n < 1000000000) return;
  FARM_CTX.timeDelta = n - nowTs();
}

function logFarmTimeSync(serverTime) {
  if (!CONFIG.DEBUG) return;
  var n = parseInt(serverTime, 10);
  if (!n || isNaN(n) || n < 1000000000) return;
  logDebug("⏱ farmTime校准: serverTime=" + n + " now=" + nowTs() + " delta=" + (FARM_CTX.timeDelta || 0));
}

function extractServerTime(obj) {
  if (!obj) return null;
  if (obj.serverTime) {
    if (typeof obj.serverTime === "object" && obj.serverTime.time) return obj.serverTime.time;
    return obj.serverTime;
  }
  if (obj.serverTime2) {
    if (typeof obj.serverTime2 === "object" && obj.serverTime2.time) return obj.serverTime2.time;
    return obj.serverTime2;
  }
  if (obj.farmTime) return obj.farmTime;
  if (obj.time) {
    if (obj.time.serverTime) return obj.time.serverTime;
    if (obj.time.farmTime) return obj.time.farmTime;
    if (obj.time.svrTime) return obj.time.svrTime;
  }
  if (obj.user && obj.user.serverTime) return obj.user.serverTime;
  return null;
}

function getFarmUinFromCookie(cookie) {
  var map = parseCookieMap(cookie || "");
  return map.newuin || map.uin || "";
}

function getFarmUin(cookie) {
  return FARM_CTX.uIdx || FARM_CTX.uinY || getFarmUinFromCookie(cookie) || "";
}

function parseCookieMap(cookie) {
  var map = {};
  if (!cookie) return map;
  var parts = cookie.split(";");
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i].trim();
    if (!part) continue;
    var idx = part.indexOf("=");
    if (idx < 0) continue;
    var k = part.substring(0, idx).trim();
    var v = part.substring(idx + 1).trim();
    map[k] = v;
  }
  return map;
}

function mapToCookie(map) {
  var parts = [];
  for (var k in map) {
    if (!map.hasOwnProperty(k)) continue;
    parts.push(k + "=" + map[k]);
  }
  return parts.join("; ");
}

function cookieKeyCount(cookie) {
  var map = parseCookieMap(cookie || "");
  var n = 0;
  for (var k in map) {
    if (map.hasOwnProperty(k)) n += 1;
  }
  return n;
}

function preferRicherCookie(primary, fallback) {
  var a = primary || "";
  var b = fallback || "";
  if (!a && !b) return "";
  if (!a) return b;
  if (!b) return a;
  var na = cookieKeyCount(a);
  var nb = cookieKeyCount(b);
  if (nb > na) return b;
  if (na > nb) return a;
  return b.length > a.length ? b : a;
}

function mergeSetCookie(cookie, setCookie) {
  if (!setCookie) return cookie;
  var map = parseCookieMap(cookie);
  var list = [];
  if (Object.prototype.toString.call(setCookie) === "[object Array]") list = setCookie;
  else list = [setCookie];
  for (var i = 0; i < list.length; i++) {
    var part = String(list[i]).split(";")[0];
    if (part.indexOf("=") < 0) continue;
    var kv = part.split("=");
    var key = kv.shift().trim();
    var val = kv.join("=");
    if (key) map[key] = val;
  }
  return mapToCookie(map);
}

function hasOpenidToken(cookie) {
  var map = parseCookieMap(cookie);
  return !!(map.openid && map.token);
}

function buildLiteCookie(cookie) {
  var map = parseCookieMap(cookie);
  var keys = ["ptcz", "openId", "accessToken", "newuin", "openid", "token"];
  var parts = [];
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (map[k]) parts.push(k + "=" + map[k]);
  }
  return parts.join("; ");
}

function tryJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    // 尝试提取 JSON 子串
    var m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch (e2) {}
    }
  }
  return null;
}

function buildCookie() {
  if (CONFIG.INLINE_COOKIE) {
    COOKIE_SOURCE = "INLINE_COOKIE";
    return CONFIG.INLINE_COOKIE;
  }
  if (IS_NODE && process.env.QQFARM_COOKIE) {
    COOKIE_SOURCE = "ENV:QQFARM_COOKIE";
    return process.env.QQFARM_COOKIE;
  }
  var stored = $.read("qcdld_Cookie");
  if (stored) {
    COOKIE_SOURCE = "qcdld_Cookie";
    return stored;
  }
  stored = $.read("qqfarm_cookie");
  if (stored) {
    COOKIE_SOURCE = "qqfarm_cookie";
    return stored;
  }
  return "";
}

function logDebug(msg) {
  if (CONFIG.DEBUG) log("🔎 调试: " + msg);
}

function simpleHash(str) {
  if (!str) return "0";
  var h = 5381;
  for (var i = 0; i < str.length; i++) {
    h = ((h << 5) + h) + str.charCodeAt(i);
    h = h & 0xffffffff;
  }
  if (h < 0) h = 0xffffffff + h + 1;
  return h.toString(16);
}

function cookieKeyList(cookie) {
  var map = parseCookieMap(cookie || "");
  var keys = [];
  for (var k in map) {
    if (!map.hasOwnProperty(k)) continue;
    keys.push(k);
  }
  keys.sort();
  return keys.join(",");
}

function shouldDiag(label, url) {
  if (!CONFIG.DIAG) return false;
  var key = (label || "") + " " + (url || "");
  return /农场|牧场|鱼塘|背包|跳转|会话/.test(key) ||
    /wap_farm_index|wap_farm_user_bag|wap_farm_fish_index|wap_pasture_index|phonepk/.test(key);
}

function summarizeHtml(html) {
  var text = stripTags(html || "");
  var flags = [];
  if (isFarmHome(html)) flags.push("土地");
  if (isRanchHome(html)) flags.push("牧场");
  if (isFishHome(html)) flags.push("鱼塘");
  if (text.indexOf("我的背包") >= 0 || /我\s*的\s*背\s*包/.test(text)) flags.push("背包");
  if (isContinuePage(html)) flags.push("继续访问页");
  return {
    title: extractTitle(html) || "",
    len: (html || "").length,
    flags: flags.join("|")
  };
}

function logDiagRequest(label, url, referer, cookie) {
  if (!shouldDiag(label, url)) return;
  var safeLabel = String(label || "请求")
    .replace(/6字段探测/g, "牧场进入")
    .replace(/原始Cookie探测/g, "牧场进入");
  var keys = cookieKeyList(cookie);
  var hash = simpleHash(cookie || "");
  log("🛰️ REQ[" + safeLabel + "] " + (url || ""));
  log("🧾 CookieKeys: " + (keys || "无") + " | Hash: " + hash);
  if (referer) log("↪️ Referer: " + referer);
}

function logDiagResponse(label, url, html, status) {
  if (!shouldDiag(label, url)) return;
  var safeLabel = String(label || "响应")
    .replace(/6字段探测/g, "牧场进入")
    .replace(/原始Cookie探测/g, "牧场进入");
  var sum = summarizeHtml(html || "");
  log("🛰️ RES[" + safeLabel + "] status=" + (status || "-") + " len=" + sum.len + " title=" + (sum.title || "无") + " flags=" + (sum.flags || "无"));
  if (CONFIG.DIAG && html) {
    var snippet = stripTags(html).slice(0, 120);
    if (snippet) log("🔎 片段: " + snippet);
  }
}

function logCookieHealth(cookie) {
  var map = parseCookieMap(cookie || "");
  var keys = ["ptcz", "openId", "accessToken", "newuin", "openid", "token", "skey", "uin"];
  var present = [];
  for (var i = 0; i < keys.length; i++) {
    if (map[keys[i]]) present.push(keys[i]);
  }
  log("🍪 Cookie关键字段: " + (present.length ? present.join(", ") : "无"));
  if (!map.openid || !map.token) {
    log("⚠️ Cookie缺少 openid/token，6字段不完整，牧场进入可能失败");
  }
  if (map.openid && map.openId && map.openid === map.openId) {
    log("⚠️ Cookie openid 与 openId 值相同，疑似抓包混淆（会导致请求参数错误）");
  }
}

/* =======================
 *  HTTP WRAPPER
 * ======================= */
function httpRequest(opts) {
  if (IS_QX) return qxRequest(opts);
  if (IS_SURGE || IS_LOON) return surgeRequest(opts);
  return nodeRequest(opts);
}

function qxRequest(opts) {
  var qxOpts = {
    url: opts.url,
    method: opts.method || "GET",
    headers: opts.headers || {},
    body: opts.body || "",
    timeout: opts.timeout || 15000
  };
  return $task.fetch(qxOpts).then(function (resp) {
    return {
      status: resp.statusCode,
      headers: resp.headers,
      body: resp.body
    };
  }).catch(function (e) {
    var target = opts && opts.url ? " " + opts.url : "";
    throw new Error("QX请求失败" + target + " | " + errText(e));
  });
}

function surgeRequest(opts) {
  return new Promise(function (resolve, reject) {
    var method = (opts.method || "GET").toUpperCase();
    var req = {
      url: opts.url,
      headers: opts.headers || {},
      body: opts.body || ""
    };
    var fn = method === "GET" ? $httpClient.get : $httpClient.post;
    fn(req, function (err, resp, data) {
      if (err) return reject(new Error("HTTP请求失败 | " + errText(err)));
      resolve({
        status: resp.status || resp.statusCode,
        headers: resp.headers,
        body: data
      });
    });
  });
}

function nodeRequest(opts) {
  return new Promise(function (resolve, reject) {
    var urlObj = new URL(opts.url);
    var lib = urlObj.protocol === "https:" ? require("https") : require("http");
    var headers = opts.headers || {};
    var body = opts.body || "";
    var method = (opts.method || "GET").toUpperCase();

    var req = lib.request(
      {
        protocol: urlObj.protocol,
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === "https:" ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: method,
        headers: headers
      },
      function (res) {
        var chunks = [];
        res.on("data", function (d) {
          chunks.push(d);
        });
        res.on("end", function () {
          var buf = Buffer.concat(chunks);
          var enc = (res.headers["content-encoding"] || "").toLowerCase();
          var finish = function (err, outBuf) {
            if (err) return reject(err);
            var text = outBuf.toString("utf8");
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: text
            });
          };
          try {
            if (enc.indexOf("gzip") >= 0) {
              require("zlib").gunzip(buf, finish);
            } else if (enc.indexOf("deflate") >= 0) {
              require("zlib").inflate(buf, finish);
            } else if (enc.indexOf("br") >= 0 && require("zlib").brotliDecompress) {
              require("zlib").brotliDecompress(buf, finish);
            } else {
              finish(null, buf);
            }
          } catch (e) {
            finish(e, buf);
          }
        });
      }
    );

    req.on("error", reject);
    req.setTimeout(opts.timeout || 15000, function () {
      req.destroy(new Error("timeout"));
    });
    if (body) req.write(body);
    req.end();
  });
}

function normalizeMcappUrl(url) {
  if (!url) return url;
  if (url.indexOf("http://mcapp.z.qq.com") === 0) {
    return "https://mcapp.z.qq.com" + url.substring("http://mcapp.z.qq.com".length);
  }
  return url;
}

function getWithRetry(opts, label) {
  var tries = typeof CONFIG.RETRY_502 === "number" ? CONFIG.RETRY_502 : 0;
  var waitMs = CONFIG.RETRY_WAIT_MS || 800;
  var shortLimit = CONFIG.RETRY_SHORT_BODY_LEN || 0;
  var attempt = 0;
  function run() {
    attempt += 1;
    return httpRequest(opts)
      .then(function (resp) {
        var body = resp && resp.body ? String(resp.body) : "";
        if (resp && resp.status === 502 && attempt <= tries) {
          logDebug((label || "请求") + " 502，重试 " + attempt + "/" + tries);
          return sleep(waitMs).then(run);
        }
        if (body && body.indexOf("502 Bad Gateway") >= 0 && attempt <= tries) {
          logDebug((label || "请求") + " 502正文，重试 " + attempt + "/" + tries);
          return sleep(waitMs).then(run);
        }
        if (shortLimit > 0 && resp && resp.status === 200 && attempt <= tries) {
          var ctype = getHeader(resp.headers, "content-type");
          var isHtml =
            /text\/html|application\/xhtml/i.test(ctype || "") ||
            /<html|<!doctype/i.test(body);
          if (isHtml && body && body.length < shortLimit) {
            logDebug((label || "请求") + " 正文过短(" + body.length + ")，重试 " + attempt + "/" + tries);
            return sleep(waitMs).then(run);
          }
        }
        return resp;
      })
      .catch(function (e) {
        if (attempt <= tries) {
          logDebug((label || "请求") + " 异常重试 " + attempt + "/" + tries + " " + errText(e));
          return sleep(waitMs).then(run);
        }
        throw e;
      });
  }
  return run();
}

function getHeader(headers, key) {
  if (!headers) return "";
  var k = key.toLowerCase();
  for (var name in headers) {
    if (!headers.hasOwnProperty(name)) continue;
    if (String(name).toLowerCase() === k) return headers[name];
  }
  return "";
}

function getHtmlWithStatus(url, cookie, referer, label) {
  var target = normalizeMcappUrl(url);
  var ref = referer || defaultMcappReferer();
  logDiagRequest(label || "会话", target, ref, cookie);
  return getWithRetry(
    {
      method: "GET",
      url: target,
      headers: buildRanchHeaders(cookie, ref)
    },
    label || "会话"
  ).then(function (resp) {
    logDiagResponse(label || "会话", target, resp.body || "", resp.status);
    return {
      status: resp.status,
      headers: resp.headers || {},
      body: resp.body || ""
    };
  });
}

function extractMcappLink(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var m = h.match(/https?:\/\/mcapp\.z\.qq\.com[^"'\s]+/i);
  return m ? m[0] : "";
}

function extractDldPastureLink(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var m = h.match(/https?:\/\/mcapp\.z\.qq\.com[^"'\s]*wap_pasture_index[^"'\s]*/i);
  if (m) return m[0];
  m = h.match(/mcapp\.z\.qq\.com[^"'\s]*wap_pasture_index[^"'\s]*/i);
  if (m) {
    var raw = m[0].replace(/^https?:\/\//i, "");
    return "https://" + raw;
  }
  m = h.match(/href=['"]([^'"]*wap_pasture_index[^'"]*)['"]/i);
  return m ? m[1] : "";
}

function extractFirstHref(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var m = h.match(/href=['"]([^'"]+)['"]/i);
  return m ? m[1] : "";
}

function extractContinueLink(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var m = h.match(/href=['"]([^'"]+)['"][^>]*>([^<]*(继续访问|触屏版)[^<]*)<\/a>/i);
  if (m) return m[1];
  return "";
}

function extractAnyMcappPath(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var m = h.match(/(\/(?:nc|mc)\/cgi-bin\/wap_[^"'\s>]+)/i);
  return m ? m[1] : "";
}

function resolveUrl(base, link) {
  if (!link) return "";
  if (link.indexOf("http://") === 0 || link.indexOf("https://") === 0) return link;
  if (link.indexOf("//") === 0) return "https:" + link;
  try {
    if (typeof URL !== "undefined") {
      return new URL(link, base).toString();
    }
  } catch (e) {}
  // 回退
  var m = base.match(/^(https?:\/\/[^/]+)/);
  if (link.charAt(0) === "/" && m) return m[1] + link;
  if (m) return m[1] + "/" + link;
  return link;
}

function extractRedirectUrl(html) {
  var h = html || "";
  var meta = h.match(/http-equiv=["']?refresh["']?[^>]*content=["']?[^;]+;\s*url=([^"'>\s]+)/i);
  if (meta) return meta[1];
  var js = h.match(/location\.href\s*=\s*['"]([^'"]+)['"]/i);
  if (js) return js[1];
  return "";
}

function buildMcappLink(base, link) {
  if (!link) return "";
  if (link.indexOf("http") === 0) return link;
  var clean = link.replace(/^\.?\//, "");
  if (clean.indexOf("mc/cgi-bin/") === 0 || clean.indexOf("nc/cgi-bin/") === 0) {
    return base + "/" + clean;
  }
  return base + "/nc/cgi-bin/" + clean;
}

function defaultMcappReferer() {
  var sid = CONFIG.RANCH_SID || "c";
  var gut = getFarmGut();
  return CONFIG.FARM_WAP_BASE + "/nc/cgi-bin/wap_farm_index?sid=" + sid + "&g_ut=" + gut;
}

function getHtmlFollow(url, cookie, referer, label, depth) {
  if (depth > 3) return Promise.resolve({ body: "", cookie: cookie, url: url });
  return getHtmlWithStatus(url, cookie, referer, label).then(function (resp) {
    var merged = mergeSetCookie(cookie, getHeader(resp.headers, "set-cookie"));
    var loc = getHeader(resp.headers, "location") || getHeader(resp.headers, "Location");
    var next = "";
    if (loc) next = resolveUrl(url, loc);
    if (!next) {
      var redirect = extractRedirectUrl(resp.body);
      if (redirect) next = resolveUrl(url, redirect);
      else if (isContinuePage(resp.body)) {
        var link =
          extractContinueLink(resp.body) ||
          extractMcappLink(resp.body) ||
          extractAnyMcappPath(resp.body) ||
          extractFirstHref(resp.body);
        if (link) next = resolveUrl(url, link);
      }
    }
    if (next && next !== url && depth < 3) {
      return getHtmlFollow(next, merged, url, label, depth + 1);
    }
    return { body: resp.body || "", cookie: merged, url: url, status: resp.status };
  });
}

function ensureMcappAccess(cookie) {
  var base = CONFIG.RANCH_BASE;
  var sid = CONFIG.RANCH_SID;
  var g_ut = CONFIG.RANCH_G_UT;
  var directReferer = CONFIG.RANCH_DIRECT_REFERER;
  var liteCookie = "";
  if (hasOpenidToken(cookie)) {
    liteCookie = buildLiteCookie(cookie);
  }

  function buildReferer(gut) {
    if (directReferer) return directReferer;
    return CONFIG.FARM_WAP_BASE + "/nc/cgi-bin/wap_farm_index?sid=" + sid + "&g_ut=" + gut;
  }

  function tryDirect(cookieVal, label) {
    var gList = ["1", "2", "3"];
    var extra = String(g_ut || "");
    if (extra && gList.indexOf(extra) < 0) gList.unshift(extra);
    function step(idx) {
      if (idx >= gList.length) return Promise.resolve(null);
      var gut = gList[idx];
      var indexUrl = base + "/mc/cgi-bin/wap_pasture_index?sid=" + sid + "&g_ut=" + gut;
    var altUrl = base + "/mc/cgi-bin/wap_pasture_index?sid=" + sid + "&g_ut=" + gut + "&source=fallback";
      var referer = buildReferer(gut);
      return getHtmlFollow(indexUrl, cookieVal, referer, label || "牧场", 0).then(function (resp) {
        var ctx = extractRanchContext(resp.body);
        setStartStats("ranch", parseCommonStats(resp.body));
        if (ctx.sid && ctx.g_ut && isRanchHome(resp.body)) {
          CONFIG.RANCH_G_UT = ctx.g_ut || gut;
          return { cookie: resp.cookie || cookieVal, ok: true, ranchCookie: resp.cookie || cookieVal };
        }
        if (ctx.sid && ctx.g_ut && !isRanchHome(resp.body)) {
          log("⚠️ 牧场进入返回非主页(" + (extractTitle(resp.body) || "无标题") + ")");
        }
        return getHtmlFollow(altUrl, resp.cookie || cookieVal, referer, (label || "牧场") + "-兼容", 0).then(function (alt) {
          var ctx2 = extractRanchContext(alt.body);
          if (ctx2.sid && ctx2.g_ut && isRanchHome(alt.body)) {
            CONFIG.RANCH_G_UT = ctx2.g_ut || gut;
            setStartStats("ranch", parseCommonStats(alt.body));
            return { cookie: alt.cookie || resp.cookie || cookieVal, ok: true, ranchCookie: alt.cookie || resp.cookie || cookieVal };
          }
          if (ctx2.sid && ctx2.g_ut && !isRanchHome(alt.body)) {
            log("⚠️ 牧场兼容进入返回非主页(" + (extractTitle(alt.body) || "无标题") + ")");
          }
          return step(idx + 1);
        });
      });
    }
    return step(0);
  }

  if (liteCookie) {
    return tryDirect(liteCookie, "6字段探测")
      .then(function (ok) {
        if (ok) {
          logDebug("牧场进入: 6字段可用");
          return { cookie: cookie, ok: true, ranchCookie: ok.ranchCookie || liteCookie };
        }
        logDebug("牧场进入: 6字段未命中，改用原始 Cookie");
        return tryDirect(cookie, "原始Cookie探测");
      })
      .catch(function () {
        logDebug("牧场进入: 6字段异常，改用原始 Cookie");
        return tryDirect(cookie, "原始Cookie探测");
      });
  }

  return tryDirect(cookie, "原始Cookie探测")
    .then(function (ok) {
      if (ok) return ok;
      log("⚠️ 牧场进入失败，尝试乐斗跳转");
      return fetchFromDld(cookie);
    })
    .catch(function () {
      log("⚠️ 牧场进入异常，尝试乐斗跳转");
      return fetchFromDld(cookie);
    });
}

function ensureFarmAccess(cookie) {
  var base = CONFIG.FARM_WAP_BASE;
  var sid = CONFIG.RANCH_SID;
  var list = [];
  function push(v) {
    if (!v) return;
    var s = String(v);
    if (list.indexOf(s) < 0) list.push(s);
  }
  push(CONFIG.FARM_G_UT);
  push(CONFIG.RANCH_G_UT);
  push("2");
  push("1");
  push("3");

  function step(idx, curCookie) {
    if (idx >= list.length) {
      log("⚠️ 农场入口未确认");
      if (CONFIG.DEBUG && LAST_FARM_HOME_HTML) {
        log("🔎 农场页内容片段: " + stripTags(LAST_FARM_HOME_HTML).slice(0, 120));
      }
      return Promise.resolve({ ok: false, cookie: curCookie });
    }
    var gut = list[idx];
    var url = base + "/nc/cgi-bin/wap_farm_index?sid=" + sid + "&g_ut=" + gut;
    return getHtmlFollow(url, curCookie, null, "农场探测", 0)
      .then(function (ret) {
        var html = ret.body || "";
        if (isFarmHome(html)) {
          CONFIG.FARM_G_UT = gut;
          if (!CONFIG.FISH_G_UT) CONFIG.FISH_G_UT = gut;
          LAST_FARM_HOME_HTML = html;
          var fishEntry = extractFishEntryLink(html);
          if (fishEntry) LAST_FISH_ENTRY_URL = fishEntry;
          log("✅ 农场入口确认: g_ut=" + gut);
          return { ok: true, cookie: ret.cookie || curCookie, html: html };
        }
        logDebug("农场入口非主页(" + (extractTitle(html) || "无标题") + ") g_ut=" + gut);
        return step(idx + 1, ret.cookie || curCookie);
      })
      .catch(function () {
        return step(idx + 1, curCookie);
      });
  }

  return step(0, cookie);
}

function fetchFromDld(cookie) {
  var dldUrl = "https://dld.qzapp.z.qq.com/qpet/cgi-bin/phonepk?cmd=index&channel=0";
  var hardLink = "http://mcapp.z.qq.com/mc/cgi-bin/wap_pasture_index?sid=&g_ut=1&source=fallback";
  function step(url, curCookie, referer, depth) {
    if (depth > 3) return Promise.resolve({ cookie: curCookie, link: "" });
      return getWithRetry(
      {
        method: "GET",
        url: url,
        headers: buildDldHeaders(curCookie)
      },
      "乐斗跳转"
    )
      .then(function (resp) {
        var respObj = {
          status: resp.status,
          headers: resp.headers || {},
          body: resp.body || ""
        };
        var body = respObj.body || "";
        var merged = mergeSetCookie(curCookie, getHeader(resp.headers, "set-cookie"));
        var loc = getHeader(resp.headers, "location") || getHeader(resp.headers, "Location");
        if (loc) {
          var nextUrl = resolveUrl(url, loc);
          if (nextUrl && nextUrl.indexOf("mcapp.z.qq.com") >= 0) {
            return { cookie: merged, link: nextUrl };
          }
          return step(nextUrl, merged, url, depth + 1);
        }
        var link = extractDldPastureLink(body) || extractMcappLink(body);
        if (!link) {
          var r = extractRedirectUrl(body);
          if (r) {
            var rurl = resolveUrl(url, r);
            if (rurl && rurl.indexOf("mcapp.z.qq.com") >= 0) return { cookie: merged, link: rurl };
            return step(rurl, merged, url, depth + 1);
          }
          if (isContinuePage(body)) {
            var href = extractContinueLink(body) || extractFirstHref(body);
            if (href) {
              var hurl = resolveUrl(url, href);
              return step(hurl, merged, url, depth + 1);
            }
          }
        }
        return { cookie: merged, link: link };
      })
      .catch(function () {
        return { cookie: curCookie, link: "" };
      });
  }

  return step(dldUrl, cookie, null, 0)
    .then(function (ret) {
      var merged = ret.cookie || cookie;
      var link = ret.link;
      if (!link) {
        log("⚠️ 乐斗跳转页未发现牧场进入链接，改用固定链接");
        link = hardLink;
      }
      return getHtmlFollow(link, merged, dldUrl, "乐斗跳转", 0).then(function (resp2) {
        var merged2 = mergeSetCookie(merged, getHeader(resp2.headers || {}, "set-cookie"));
        var ctx = extractRanchContext(resp2.body);
        if (ctx.sid && ctx.g_ut) {
          logDebug("乐斗跳转已进入牧场");
          return { cookie: merged2, ok: true };
        }
        log("⚠️ 乐斗跳转后仍未进入牧场");
        return { cookie: merged2, ok: false };
      });
    })
    .catch(function (e) {
      log("⚠️ 乐斗跳转失败: " + e);
      return { cookie: cookie, ok: false };
    });
}

/* =======================
 *  CORE LOGIC
 * ======================= */
var LOGS = [];
var ACTION_STATS = {
  harvest: 0,
  scarify: 0,
  plant: 0,
  clearWeed: 0,
  spraying: 0,
  water: 0,
  errors: 0
};

// 动作尝试/无动作统计（以地块为单位）
var ACTION_TRY = {
  harvest: 0,
  scarify: 0,
  plant: 0,
  clearWeed: 0,
  spraying: 0,
  water: 0
};

var ACTION_NOOP = {
  harvest: 0,
  scarify: 0,
  plant: 0,
  clearWeed: 0,
  spraying: 0,
  water: 0
};

var PLANT_FAIL = {
  noLand: 0,
  seedLack: 0,
  landLimit: 0
};

var CROP_NAME_MAP = {};
// Seed name bootstrap: avoid leaking raw "cIdxx" in logs/notifications when mapping is not yet populated.
// FARM_GRASS_SEED_ID is stable (default 40) and widely used in strategy decisions.
CROP_NAME_MAP[String(CONFIG.FARM_GRASS_SEED_ID || "40")] = "牧草";
var FARM_PLACE_CID = {};
var FARM_PLACE_NAME = {};

var HARVEST_DETAIL = {
  total: 0,
  byName: {}
};

var FARM_DETAIL = {
  witheredTry: 0,
  witheredClear: 0
};

var FARM_EXTRA = {
  sell: 0,
  signin: 0
};

var FARM_EVENT_STATS = {
  seedTerm: 0,
  seedRound: 0,
  seedCanClaim: 0,
  seedTodayClaimed: -1,
  seedClaim: 0,
  seedReward: "",
  bulingCanClaim: 0,
  bulingClaim: 0,
  bulingReward: "",
  wishOpen: 0,
  wishStatus: -1,
  wishSelfStart: -1,
  wishSelfEnd: -1,
  wishProgressStart: -1,
  wishProgressEnd: -1,
  wishProgressMax: 0,
  wishStarStart: 0,
  wishStarEnd: 0,
  wishCollect: 0,
  wishRandom: 0,
  wishStarClaim: 0,
  wishHarvest: 0,
  wishPlant: 0,
  wishUpgrade: 0,
  wishHelp: 0,
  wishReward: "",
  day7Days: 0,
  day7Flag: 0,
  busy: 0,
  errors: 0
};

var RANCH_STATS = {
  harvest: 0,
  harvestUnknown: 0,
  feed: 0,
  help: 0,
  product: 0,
  sell: 0,
  signin: 0,
  errors: 0
};

var FISH_STATS = {
  feed: 0,
  feedUsed: 0,
  feedItem: "",
  harvest: 0,
  sell: 0,
  buy: 0,
  plant: 0,
  compose: 0,
  composeByName: {},
  pearlDraw: 0,
  pearlSpend: 0,
  pearlGain: "",
  errors: 0
};

var HIVE_STATS = {
  harvest: 0,
  upgrade: 0,
  pollen: 0,
  work: 0,
  honey: 0,
  errors: 0,
  start: "",
  end: ""
};

var TIME_FARM_STATS = {
  harvest: 0,
  dig: 0,
  plant: 0,
  fertilize: 0,
  taskClaim: 0,
  taskReward: "",
  taskStart: "",
  taskEnd: "",
  errors: 0,
  start: "",
  end: "",
  startSum: null,
  endSum: null,
  plantSkipReason: ""
};

var PLANT_STATS = {
  total: 0,
  byCid: {}
};

var MONEY_STATS = {
  farmSell: 0,
  ranchSell: 0,
  fishSell: 0,
  farmBuy: 0,
  grassBuy: 0,
  fishBuy: 0,
  fishFeed: 0
};

var BAG_STATS = {
  seed: { total: 0, items: [] },
  fish: { total: 0, items: [] },
  fishFeed: { total: 0, items: [], loaded: false }
};

var STATS_START = { farm: null, ranch: null };
var STATS_END = { farm: null, ranch: null };
var RUN_START = 0;
var STATUS_START = { farm: [], fish: [], ranch: [] };
var STATUS_END = { farm: [], fish: [], ranch: [] };
var FARM_STATUS_JSON_START = null;
var FARM_STATUS_JSON_END = null;

var LAST_FARM = null;
var LAST_FARM_HOME_HTML = "";
var FARM_CTX = { uinY: "", uIdx: "", timeDelta: 0, lockHeuristicOff: false };
var LAST_RANCH = null;
var LAST_RANCH_HOME_HTML = "";
var LAST_RANCH_COOKIE = "";
var LAST_MODE = "";
var LAST_BASE = "";
var LAST_GRASS_COUNT = null;
var RANCH_FEED_STATE = { start: null, end: null };
var GRASS_LOW_SEEN = false;
var PLANT_SEED_LOCKED = false;
var LAST_FISH_ENTRY_URL = "";
var PURCHASE_LOGS = [];
var LAST_FISH_EMPTY = null;
var LAST_FISH_HAS_EMPTY = false;
var LAST_FISH_CAP = 0;
var FISH_PEARL_ID_NAME_MAP = {};
var TIME_FARM_SPECIAL_SEED_MAP = {};
var NO_MONEY = { farmSeed: false, grassSeed: false, fishSeed: false };
var FISH_FEED_EMPTY_SEEN = false;
var FISH_FEED_NOOP_SEEN = false;
var STORE_KEY_FISH_PEARL_DAY = "qqfarm_fish_pearl_day";
var STORE_KEY_FISH_PEARL_FREE_TIMES = "qqfarm_fish_pearl_free_times";
var STORE_KEY_FISH_PEARL_FREE_STAMP = "qqfarm_fish_pearl_free_stamp";
var STORE_KEY_FISH_COMPOSE_NEED = "qqfarm_fish_compose_need";
var STORE_KEY_FISH_COMPOSE_FREEZE = "qqfarm_fish_compose_freeze";
var STORE_KEY_HIVE_UPGRADE_BUSY_UNTIL = "qqfarm_hive_upgrade_busy_until";
var FISH_COMPOSE_NEED_MAP = null;
var FISH_COMPOSE_FREEZE_MAP = null;
var HIVE_UPGRADE_BUSY_MAP = null;

function pad2(n) {
  var x = Number(n || 0);
  return x < 10 ? "0" + x : String(x);
}

function tzOffsetText(d) {
  var mins = -d.getTimezoneOffset();
  var sign = mins >= 0 ? "+" : "-";
  var abs = Math.abs(mins);
  var hh = Math.floor(abs / 60);
  var mm = abs % 60;
  return "UTC" + sign + pad2(hh) + ":" + pad2(mm);
}

function dateTimeText(d) {
  return (
    d.getFullYear() +
    "-" +
    pad2(d.getMonth() + 1) +
    "-" +
    pad2(d.getDate()) +
    " " +
    pad2(d.getHours()) +
    ":" +
    pad2(d.getMinutes()) +
    ":" +
    pad2(d.getSeconds())
  );
}

function formatRunClockLine(d) {
  var now = d || new Date();
  return "时区 " + tzOffsetText(now) + " | " + dateTimeText(now);
}

function bannerStart() {
  log(LINE);
  log("🌾 QQ 农牧场助手");
  log("🧩 脚本修订 " + SCRIPT_REV);
  var meta = "🧭 环境 " + ENV_NAME;
  if (CONFIG.DEBUG) meta += " | DEBUG";
  log("🕒 开始时间 | " + formatRunClockLine(new Date()));
  log(meta);
  log(LINE);
  RUN_START = Date.now();
  FARM_CTX.lockHeuristicOff = false;
  FISH_FEED_NOOP_SEEN = false;
}

function bannerEnd() {
  log(LINE);
  log("🕒 结束时间 | " + formatRunClockLine(new Date()));
  log("✅ 结束 | 农场 " + actionSummaryLine());
  log("🐮 牧场 " + ranchSummaryLine());
  log("🐟 鱼塘 " + fishSummaryLine());
  if (hiveEnabled()) log("🐝 蜂巢 " + hiveSummaryLine());
  if (timeFarmEnabled()) log("🕰️ 时光农场 " + timeFarmSummaryLine());
  log(LINE);
}

function buildHeaders(cookie) {
  return {
    "User-Agent":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
    Accept: "*/*",
    "Accept-Language": "zh-CN,zh;q=0.9",
    Cookie: cookie,
    Referer: "https://game.qzone.qq.com/app/353.html"
  };
}

function buildLegacyHeaders(cookie) {
  return {
    "User-Agent":
      "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; SV1)",
    Accept: "*/*",
    Cookie: cookie,
    Referer: "https://appimg.qq.com/happyfarm/module/Main.swf"
  };
}

function buildFarmJsonHeaders(cookie) {
  var h = buildHeaders(cookie);
  h["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
  return h;
}

function buildFarmSeedJsonHeaders(cookie) {
  var h = buildFarmHeaders(cookie);
  h["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
  return h;
}

function buildFarmHeaders(cookie) {
  return {
    "User-Agent":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9",
    Cookie: cookie,
    Origin: "https://farm.qzone.qq.com",
    Referer: "https://farm.qzone.qq.com/"
  };
}

function normalizeRefererHeader(referer) {
  var ref = String(referer || "https://mcapp.z.qq.com/").trim();
  if (!ref) ref = "https://mcapp.z.qq.com/";
  try {
    ref = encodeURI(ref);
  } catch (_) {}
  if (/[^\x20-\x7E]/.test(ref)) return "https://mcapp.z.qq.com/";
  return ref;
}

function buildRanchHeaders(cookie, referer) {
  return {
    "User-Agent":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Encoding": "identity",
    "Accept-Language": "zh-CN,zh;q=0.9",
    Cookie: cookie,
    Referer: normalizeRefererHeader(referer)
  };
}

function buildFishJsonHeaders(cookie) {
  return {
    "User-Agent": "qqfarm/45 CFNetwork/3860.400.51 Darwin/25.3.0",
    Accept: "*/*",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "Content-Type": "application/x-www-form-urlencoded",
    Cookie: cookie
  };
}

function buildDldHeaders(cookie) {
  return {
    "User-Agent":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Encoding": "identity",
    "Accept-Language": "zh-CN,zh;q=0.9",
    Cookie: cookie,
    Referer: "https://dld.qzapp.z.qq.com/"
  };
}

function stripTags(html) {
  if (!html) return "";
  var s = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/&nbsp;|&ensp;|&emsp;|&thinsp;|&#160;/g, " ");
  s = s.replace(/&amp;/g, "&");
  s = s.replace(/&quot;/g, "\"");
  s = s.replace(/&lt;/g, "<");
  s = s.replace(/&gt;/g, ">");
  s = s.replace(/&apos;|&#39;/g, "'");
  s = s.replace(/&middot;|&#183;/g, "·");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function extractMessage(html) {
  var text = stripTags(html);
  if (/没什么好收获/.test(text)) return "这块地没什么好收获的";
  var m = text.match(/(成功|失败|获得|收获|无法|不能)[^。！!]{0,40}/);
  if (!m) return "";
  if (m[0] === "收获的" && /没什么好收获/.test(text)) return "这块地没什么好收获的";
  return m[0];
}

function extractWapHint(html) {
  var text = stripTags(html);
  if (!text) return "";
  var noise = [
    "QQ空间",
    "回我的应用",
    "我的农场",
    "好友农场",
    "我的牧场",
    "我的鱼塘",
    "QQ农场牧场版",
    "QQ农场HD版",
    "应用",
    "刷新",
    "首页",
    "返回"
  ];
  for (var i = 0; i < noise.length; i++) {
    var re = new RegExp(noise[i], "g");
    text = text.replace(re, " ");
  }
  text = text.replace(/\s+/g, " ").trim();
  var patterns = [
    /对不起[^。！!]{0,60}/,
    /没有空[^。！!]{0,60}/,
    /没有可播种[^。！!]{0,60}/,
    /地块已满[^。！!]{0,60}/,
    /种子[^。！!]{0,40}(不足|不够|缺少)[^。！!]{0,10}/,
    /已播种[^。！!]{0,60}/,
    /成功[^。！!]{0,60}/,
    /失败[^。！!]{0,60}/,
    /无法[^。！!]{0,60}/,
    /不能[^。！!]{0,60}/
  ];
  for (var j = 0; j < patterns.length; j++) {
    var m = text.match(patterns[j]);
    if (m) {
      var out = m[0];
      var cutWords = ["个人中心", "手机腾讯网", "导航", "我的", "家园", "朋友", "设置", "反馈", "退出"];
      for (var k = 0; k < cutWords.length; k++) {
        var idx = out.indexOf(cutWords[k]);
        if (idx > 0) {
          out = out.substring(0, idx).trim();
        }
      }
      return out;
    }
  }
  return "";
}

function cleanActionMsg(msg) {
  if (!msg) return "";
  if (!/(成功|失败|已)/.test(msg) && /(QQ提醒|超Q|黄钻|土地|施肥)/.test(msg)) return "";
  return msg;
}

function extractSignInReward(html) {
  if (!html) return "";
  var m = html.match(
    /<p[^>]*class=["']?[^"']*(?:txt-warning\d*|farm-yellow)[^"']*["']?[^>]*>([\s\S]*?)<\/p>/i
  );
  if (m) {
    var text = stripTags(m[1]);
    if (text) return text;
  }
  return extractWapHint(html) || extractMessage(html);
}

function hasSignInEntry(html) {
  if (!html) return false;
  if (/signin=1/i.test(html)) return true;
  var m = html.match(/<a[^>]+href=["'][^"']*signin=1[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
  if (m && /签到/.test(stripTags(m[1]))) return true;
  return false;
}

function recordPlant(cid, count) {
  if (!count || count <= 0) return;
  PLANT_STATS.total += count;
  var key = cid ? String(cid) : "unknown";
  if (!PLANT_STATS.byCid[key]) PLANT_STATS.byCid[key] = 0;
  PLANT_STATS.byCid[key] += count;
}

function parseMoneyFromMsg(msg) {
  if (!msg) return 0;
  var m = msg.match(/获得(?:了)?([0-9]+)个?金币/);
  if (m) return Number(m[1] || 0);
  m = msg.match(/获得([0-9]+)金币/);
  if (m) return Number(m[1] || 0);
  return 0;
}

function parseSellMoneyFromText(text) {
  var t = normalizeSpace(text || "");
  if (!t) return 0;
  var m =
    t.match(/(?:获得|卖得|收入|共计|共卖得|总价) *([0-9]+) *金币/) ||
    t.match(/卖出[^。！!]{0,30}?([0-9]+) *金币/);
  if (m) return Number(m[1] || 0);
  if (!/(卖|售|总价|仓库)/.test(t)) return 0;
  m = t.match(/([0-9]+) *金币/);
  return m ? Number(m[1] || 0) : 0;
}

function isSellSuccess(msg, html) {
  var text = normalizeSpace(msg || stripTags(html || ""));
  if (!text) return false;
  if (/系统繁忙|网络|错误|稍候|请输入|返回/.test(text)) return false;
  if (/你共有0个|总价0金币|单价0金币/.test(text)) return false;
  if (/成功|卖出|出售|已卖/.test(text)) return true;
  return parseMoneyFromMsg(text) > 0;
}

function isTransientFailText(text) {
  var t = normalizeSpace(text || "");
  if (!t) return false;
  return /系统繁忙|网络繁忙|网络异常|网络错误|错误代码|请求失败|超时|返回重试|请稍[后候]再试/.test(t);
}

function parseRanchRepTotalValue(html) {
  var t = normalizeSpace(stripTags(html || ""));
  if (!t) return null;
  var m =
    t.match(/当前[^0-9]{0,40}总价值[^0-9]{0,50}([0-9]+) *金币/) ||
    t.match(/总价值[^0-9]{0,50}([0-9]+) *金币/);
  if (!m) return null;
  var n = Number(m[1] || 0);
  if (isNaN(n)) return null;
  return n;
}

function fetchRanchRepTotalValue(base, cookie, ctx, label) {
  if (!ctx || !ctx.sid || !ctx.g_ut) return Promise.resolve(null);
  var url = base + "/mc/cgi-bin/wap_pasture_rep_list?sid=" + ctx.sid + "&g_ut=" + ctx.g_ut;
  return ranchGet(url, cookie)
    .then(function (html) {
      var v = parseRanchRepTotalValue(html);
      if (CONFIG.DEBUG) {
        logDebug("🐮 仓库可售总价值" + (label ? "(" + label + ")" : "") + ": " + (v === null ? "未知" : v));
      }
      return v;
    })
    .catch(function () {
      return null;
    });
}

function parseRanchRepItemMap(html) {
  var text = normalizeSpace(stripTags(html || ""));
  var map = {};
  if (!text) return map;
  var re = /\d+\)\s*(?:【锁】)?\s*([^:：\s(]+)(?:\s*\([^)]*\))?\s*[:：]\s*([0-9]+)\s*个/g;
  var m;
  while ((m = re.exec(text))) {
    var name = normalizeSpace(m[1] || "");
    var count = Number(m[2] || 0);
    if (!name || !count || isNaN(count)) continue;
    map[name] = (map[name] || 0) + count;
  }
  return map;
}

function mergeRanchRepItemMap(dst, src) {
  if (!src) return dst;
  for (var k in src) {
    if (!src.hasOwnProperty(k)) continue;
    dst[k] = (dst[k] || 0) + (Number(src[k] || 0) || 0);
  }
  return dst;
}

function calcRanchRepTotalUnits(map) {
  var total = 0;
  if (!map) return total;
  for (var k in map) {
    if (!map.hasOwnProperty(k)) continue;
    total += Number(map[k] || 0) || 0;
  }
  return total;
}

function fetchRanchRepSnapshot(base, cookie, ctx, label) {
  if (!ctx || !ctx.sid || !ctx.g_ut) return Promise.resolve(null);
  var baseUrl = base + "/mc/cgi-bin/wap_pasture_rep_list?sid=" + ctx.sid + "&g_ut=" + ctx.g_ut;
  var map = {};
  var pages = 0;
  var max = Number(CONFIG.RANCH_REP_SCAN_MAX_PAGES || 0);
  if (isNaN(max) || max < 0) max = 0;

  function pageUrl(pageNo) {
    if (!pageNo || pageNo <= 1) return baseUrl;
    return baseUrl + "&page=" + pageNo;
  }

  function fetchPage(pageNo) {
    return ranchGet(pageUrl(pageNo), cookie).then(function (html) {
      pages += 1;
      mergeRanchRepItemMap(map, parseRanchRepItemMap(html));
      var info = parseBagPageInfo(html);
      return { page: info.page || pageNo || 1, total: info.total || 1 };
    });
  }

  return fetchPage(1)
    .then(function (ret) {
      var total = Number((ret && ret.total) || 1);
      if (!total || isNaN(total) || total <= 1) return;
      var end = max > 0 ? Math.min(total, max) : total;
      var p = Promise.resolve();
      for (var page = 2; page <= end; page++) {
        (function (pno) {
          p = p.then(function () {
            return sleep(CONFIG.WAIT_MS || 0);
          }).then(function () {
            return fetchPage(pno);
          });
        })(page);
      }
      return p;
    })
    .then(function () {
      var snap = {
        map: map,
        totalUnits: calcRanchRepTotalUnits(map),
        pages: pages
      };
      if (CONFIG.DEBUG) {
        logDebug(
          "🐮 仓库快照" +
            (label ? "(" + label + ")" : "") +
            ": 总数量" +
            snap.totalUnits +
            " 页数" +
            snap.pages
        );
      }
      return snap;
    })
    .catch(function () {
      return null;
    });
}

function diffRanchRepSnapshot(before, after) {
  if (!before || !before.map || !after || !after.map) return { count: 0, detail: "" };
  var deltaMap = {};
  var total = 0;
  for (var name in after.map) {
    if (!after.map.hasOwnProperty(name)) continue;
    var d = Number(after.map[name] || 0) - Number(before.map[name] || 0);
    if (isNaN(d) || d <= 0) continue;
    deltaMap[name] = d;
    total += d;
  }
  return { count: total, detail: formatRanchHarvestInferDetail(deltaMap, 4) };
}

function inferRanchHarvestFromRep(base, cookie, ctx, preSnap) {
  if (!preSnap || !preSnap.map) return Promise.resolve({ count: 0, detail: "" });
  return fetchRanchRepSnapshot(base, cookie, ctx, "收获后").then(function (postSnap) {
    if (!postSnap || !postSnap.map) return { count: 0, detail: "" };
    return diffRanchRepSnapshot(preSnap, postSnap);
  });
}

function isMoneyShortText(text) {
  var t = normalizeSpace(text || "");
  if (!t) return false;
  if (/金币不足|点券不足|余额不足|钱不够|金币不够|资金不足|余额不够|账户余额不足/.test(t)) {
    return true;
  }
  if (/最多可购买\s*0/.test(t) && /(金币|点券)/.test(t)) return true;
  return false;
}

function isSignInSuccess(msg, html) {
  var text = normalizeSpace(msg || stripTags(html || ""));
  if (!text) return false;
  if (/系统繁忙|网络|错误|稍候|返回/.test(text)) return false;
  if (/签到成功|已签到|已连续签到|累计签到|获得奖励/.test(text)) return true;
  return /成功/.test(text) && /签到/.test(text);
}

function isFeedSuccess(msg, html) {
  var text = normalizeSpace(msg || stripTags(html || ""));
  if (!text) return false;
  if (/系统繁忙|网络|错误|稍候|返回/.test(text)) return false;
  if (/喂食成功|成功添加|成功喂/.test(text)) return true;
  return isSuccessMsg(text);
}

function isFishFeedNoopText(msg, html) {
  var text = normalizeSpace(msg || stripTags(html || ""));
  if (!text) return false;
  if (/喂鱼食失败/.test(text) && /(是否有鱼可以喂|点券鱼苗不能喂食|没有鱼可以喂|无鱼可喂|无可喂鱼)/.test(text)) {
    return true;
  }
  if (/(是否有鱼可以喂|点券鱼苗不能喂食)/.test(text) && /(失败|不能喂|无鱼|无可喂)/.test(text)) {
    return true;
  }
  if (/(没有鱼可以喂|暂无可喂|无鱼可喂|无可喂鱼)/.test(text)) return true;
  return false;
}

function parseSpendFromMsg(msg) {
  if (!msg) return 0;
  var m = msg.match(/花费\s*([0-9]+)\s*个?金币/);
  if (m) return Number(m[1] || 0);
  m = msg.match(/共花费\s*([0-9]+)\s*个?金币/);
  if (m) return Number(m[1] || 0);
  return 0;
}

function countCommaList(text) {
  if (!text) return 0;
  var parts = String(text)
    .split(",")
    .filter(function (it) {
      return it !== "";
    });
  return parts.length;
}

function countParamList(link, key) {
  if (!link || !key) return 0;
  var re = new RegExp(key + "=([0-9,]+)");
  var m = re.exec(link);
  if (!m) return 0;
  if (key === "landid") return 1;
  return countCommaList(m[1]);
}

function parseFishFeedPondCount(textOrHtml) {
  var text = stripTags(textOrHtml || "");
  if (!text) return 0;
  var m = text.match(/为\s*([0-9]+)\s*块?池塘.*?喂/);
  if (m) return Number(m[1] || 0);
  m = text.match(/喂鱼[^0-9]{0,6}([0-9]+)\s*块?池塘/);
  if (m) return Number(m[1] || 0);
  return 0;
}

function parseRanchHelpCount(textOrHtml) {
  var text = stripTags(textOrHtml || "");
  if (!text) return 0;
  var m = text.match(/清理[^xX0-9]{0,8}[xX]([0-9]+)/);
  if (m) return Number(m[1] || 0);
  m = text.match(/清理[^0-9]{0,8}([0-9]+)\s*个/);
  if (m) return Number(m[1] || 0);
  return 0;
}

function parseActionCountFromMsg(msg, type) {
  if (!msg) return 0;
  var text = String(msg);
  var m;
  if (type === "harvest") {
    var h = parseFarmHarvestCountFromMsg(text);
    if (h) return h;
  }
  if (type === "spraying") {
    m = text.match(/消灭([0-9]+)条/);
    if (m) return Number(m[1] || 0);
    m = text.match(/消灭([0-9]+)只/);
    if (m) return Number(m[1] || 0);
    m = text.match(/除虫[^0-9]{0,6}([0-9]+)(条|只)/);
    if (m) return Number(m[1] || 0);
    m = text.match(/杀虫[^0-9]{0,6}([0-9]+)(条|只)/);
    if (m) return Number(m[1] || 0);
  }
  if (type === "clearWeed") {
    m = text.match(/清除([0-9]+)棵/);
    if (m) return Number(m[1] || 0);
    m = text.match(/除草[^0-9]{0,6}([0-9]+)棵/);
    if (m) return Number(m[1] || 0);
    m = text.match(/除去([0-9]+)堆/);
    if (m) return Number(m[1] || 0);
    m = text.match(/除草[^0-9]{0,6}([0-9]+)堆/);
    if (m) return Number(m[1] || 0);
    m = text.match(/清除[^0-9]{0,6}([0-9]+)(棵|株|堆)/);
    if (m) return Number(m[1] || 0);
  }
  if (type === "water") {
    m = text.match(/浇水[^0-9]{0,6}([0-9]+)块/);
    if (m) return Number(m[1] || 0);
    m = text.match(/为\s*([0-9]+)\s*块[^。！!]{0,12}浇水/);
    if (m) return Number(m[1] || 0);
    m = text.match(/浇水成功[^0-9]{0,6}([0-9]+)块/);
    if (m) return Number(m[1] || 0);
  }
  if (type === "scarify") {
    m = text.match(/铲除[^0-9]{0,8}([0-9]+)土/);
    if (m) return Number(m[1] || 0);
    m = text.match(/([0-9]+)\s*土地[^0-9]{0,20}铲除/);
    if (m) return Number(m[1] || 0);
    m = text.match(/铲除[^0-9]{0,8}([0-9]+)块/);
    if (m) return Number(m[1] || 0);
    m = text.match(/铲除[^0-9]{0,8}([0-9]+)堆/);
    if (m) return Number(m[1] || 0);
    m = text.match(/翻地[^0-9]{0,6}([0-9]+)块/);
    if (m) return Number(m[1] || 0);
  }
  return 0;
}

function parseFarmHarvestCountFromMsg(msg) {
  if (!msg) return 0;
  var text = stripTags(String(msg || "")).replace(/\s+/g, " ").trim();
  if (!text) return 0;
  var sum = 0;
  var head = text;
  var hit = head.indexOf("你成功收获");
  if (hit < 0) hit = head.indexOf("成功收获");
  if (hit < 0) hit = head.indexOf("收获了");
  if (hit >= 0) head = head.substring(hit);
  var idx = head.indexOf("获得");
  if (idx > 0) head = head.substring(0, idx);
  var re = /([0-9]+)\s*个\s*([^\s，。,.]+)?/g;
  var m;
  while ((m = re.exec(head))) {
    var n = Number(m[1] || 0);
    if (!n) continue;
    var name = normalizeSpace(m[2] || "");
    if (/^(金币|经验|点券|经验值|积分|贡献|人气)$/.test(name)) continue;
    if ((/金币|经验|点券|经验值/.test(name)) && name.length <= 4) continue;
    sum += n;
  }
  var reX = /[×xX]\s*([0-9]+)/g;
  while ((m = reX.exec(head))) {
    var n2 = Number(m[1] || 0);
    if (!n2) continue;
    var pre = head.substring(Math.max(0, m.index - 6), m.index);
    if (/(金币|经验|点券|经验值|积分|贡献|人气)/.test(pre)) continue;
    sum += n2;
  }
  if (sum > 0) return sum;
  var re2 = /([0-9]+)\s*个(?!金币|经验|点券|经验值)/g;
  while ((m = re2.exec(head))) {
    var n3 = Number(m[1] || 0);
    if (n3) sum += n3;
  }
  return sum;
}

function parsePlantCountFromMsg(msg) {
  if (!msg) return 0;
  var text = String(msg);
  var m;
  m = text.match(/成功在\s*([0-9]+)\s*块空地上种植/);
  if (m) return Number(m[1] || 0);
  m = text.match(/成功种植\s*([0-9]+)\s*块/);
  if (m) return Number(m[1] || 0);
  m = text.match(/种植[^0-9]{0,6}([0-9]+)\s*块/);
  if (m) return Number(m[1] || 0);
  return 0;
}

function parseJsonArrayResult(arr, type) {
  if (!arr || typeof arr.length !== "number") return null;
  var okMsg = "";
  var errMsg = "";
  var okCount = 0;
  var harvestSum = 0;
  for (var i = 0; i < arr.length; i++) {
    var it = arr[i];
    if (!it || typeof it !== "object") continue;
    var code = it.code;
    if (code === 1) {
      okCount += 1;
      if (!okMsg && it.direction) okMsg = String(it.direction);
      if (type === "harvest") {
        var hv = Number(it.harvest || 0);
        if (!isNaN(hv) && hv > 0) harvestSum += hv;
      }
    } else {
      if (!errMsg && it.direction) errMsg = String(it.direction);
    }
  }
  var msg = okMsg || errMsg || "";
  var success = okCount > 0;
  var count = 0;
  if (type === "harvest") count = harvestSum;
  else if (okCount > 0) count = okCount;
  return { success: success, count: count, msg: msg, okCount: okCount, harvestSum: harvestSum };
}

function parseActionResult(res, type) {
  var success = false;
  var msg = "";
  var count = 0;
  var hasCode = false;
  var isArray = false;
  var arrayHarvest = 0;
  if (res && typeof res === "object" && Object.prototype.toString.call(res) === "[object Array]") {
    isArray = true;
    var jr = parseJsonArrayResult(res, type);
    if (jr) {
      success = jr.success;
      msg = jr.msg || "";
      count = jr.count || 0;
      arrayHarvest = jr.harvestSum || 0;
    }
  }
  if (res && typeof res === "object") {
    var code =
      res.ret != null
        ? res.ret
        : res.code != null
          ? res.code
          : res.errcode != null
            ? res.errcode
            : res.errorCode != null
              ? res.errorCode
              : res.status != null
                ? res.status
                : null;
    if (typeof code === "number") {
      hasCode = true;
      if (res.code != null && res.ret == null && res.errcode == null && res.errorCode == null && res.status == null) {
        success = code === 1;
      } else {
        success = code === 0;
      }
    }
    msg =
      res.msg ||
      res.message ||
      res.errmsg ||
      res.errorMsg ||
      (res.data && res.data.msg) ||
      "";
    if (!msg && res.direction) msg = String(res.direction || "");
  } else if (typeof res === "string") {
    msg = extractWapHint(res) || extractMessage(res) || "";
  }
  var text = msg || (typeof res === "string" ? res : JSON.stringify(res || {}));
  if (!msg && typeof res === "string") msg = extractMessage(res) || "";
  if (!hasCode && !isArray && msg) {
    success = isSuccessMsg(msg);
  } else if (!hasCode && !isArray && text) {
    success = isSuccessMsg(text);
  }
  if (type === "harvest" && arrayHarvest > 0) count = arrayHarvest;
  if (type === "plant") {
    var pc = parsePlantCountFromMsg(msg || text);
    if (count <= 0 && pc > 0) count = pc;
  } else {
    var ac = parseActionCountFromMsg(msg || text, type);
    if (count <= 0 && ac > 0) count = ac;
  }
  if (type === "harvest" && res && typeof res === "object" && res.harvest != null) {
    var hv = Number(res.harvest || 0);
    if (!isNaN(hv) && hv > 0) count = hv;
  }
  if (!success && count > 0) {
    var msgText = normalizeSpace(msg || text || "");
    if (!isNoActionMsg(msgText, type)) success = true;
  }
  if (success && count <= 0 && type !== "harvest") count = 1;
  return { success: success, count: count, msg: msg };
}

function parseSeedUnitPrice(html) {
  var text = stripTags(html || "");
  if (!text) return 0;
  text = text.replace(/\s+/g, " ");
  var re = /单价[:：]?\s*([0-9]+)/g;
  var m;
  while ((m = re.exec(text))) {
    var price = Number(m[1] || 0);
    if (!price) continue;
    var start = Math.max(0, m.index - 12);
    var end = Math.min(text.length, m.index + m[0].length + 12);
    var seg = text.substring(start, end);
    if (seg.indexOf("点券") >= 0) continue;
    return price;
  }
  return 0;
}

function parseFishFeedUsage(textOrHtml) {
  var text = stripTags(textOrHtml || "");
  if (!text) return null;
  var m = text.match(/使用\s*([^\d,，。！!]{0,12}?鱼食)\s*([0-9]+)\s*袋/);
  if (m) {
    return { name: normalizeSpace(m[1]), count: Number(m[2] || 0) };
  }
  m = text.match(/使用\s*([0-9]+)\s*袋/);
  if (m) {
    return { name: "鱼食", count: Number(m[1] || 0) };
  }
  return null;
}

function parseFishPlantCountFromMsg(msg) {
  if (!msg) return 0;
  var text = String(msg);
  var m = text.match(/放养[^0-9]{0,6}([0-9]+)\s*条/);
  if (m) return Number(m[1] || 0);
  m = text.match(/养殖了\s*([0-9]+)\s*条/);
  if (m) return Number(m[1] || 0);
  m = text.match(/池塘养殖了\s*([0-9]+)\s*条/);
  if (m) return Number(m[1] || 0);
  m = text.match(/成功[^0-9]{0,6}([0-9]+)\s*条/);
  if (m) return Number(m[1] || 0);
  return 0;
}

function parseFishHarvestCountFromMsg(msg) {
  if (!msg) return 0;
  var text = String(msg);
  var m = text.match(/收获了\s*([0-9]+)\s*条/);
  if (m) return Number(m[1] || 0);
  m = text.match(/成功收获[^0-9]{0,6}([0-9]+)\s*条/);
  if (m) return Number(m[1] || 0);
  return 0;
}

function parseRanchFeedCountFromMsg(msg) {
  if (!msg) return 0;
  var text = String(msg);
  var m = text.match(/成功添加\s*([0-9]+)\s*[棵颗]/);
  if (m) return Number(m[1] || 0);
  return 0;
}

function parseRanchHarvestCountFromMsg(msg) {
  if (!msg) return 0;
  var text = stripTags(String(msg || "")).replace(/\s+/g, " ").trim();
  if (!text) return 0;
  var sum = 0;
  var head = text;
  var hit = head.indexOf("你成功收获");
  if (hit < 0) hit = head.indexOf("成功收获");
  if (hit < 0) hit = head.indexOf("收获了");
  if (hit >= 0) head = head.substring(hit);
  var idx = head.indexOf("获得");
  if (idx > 0) head = head.substring(0, idx);
  var m;
  var re = /[×xX]\s*([0-9]+)/g;
  while ((m = re.exec(head))) {
    var n = Number(m[1] || 0);
    if (n) sum += n;
  }
  if (sum > 0) return sum;
  var re2 = /收获了\s*([0-9]+)\s*(只|头|个|颗|件)/g;
  while ((m = re2.exec(head))) {
    var n2 = Number(m[1] || 0);
    if (n2) sum += n2;
  }
  return sum;
}

function isRanchBlankHarvestMsg(msg, html) {
  var text = normalizeSpace(msg || stripTags(html || ""));
  if (!text) return false;
  if (/成功收获了\s*获得经验/.test(text)) return true;
  if (/成功收获/.test(text) && /获得经验/.test(text) && !/[0-9]/.test(text) && !/[×xX]/.test(text)) {
    return true;
  }
  return false;
}

function parseRanchProductCountFromMsg(msg) {
  if (!msg) return 0;
  var text = stripTags(String(msg || "")).replace(/\s+/g, " ").trim();
  if (!text) return 0;
  var m = text.match(/成功将\s*([0-9]+)\s*只/);
  if (m) return Number(m[1] || 0);
  m = text.match(/赶去生产[^0-9]{0,8}([0-9]+)\s*只/);
  if (m) return Number(m[1] || 0);
  return 0;
}

function formatRanchProductMsg(msg, animal) {
  var text = normalizeSpace(msg || "");
  if (!animal) return text;
  if (!text) return "成功将" + animal + "赶去生产";
  if (/成功将\s*赶去生产/.test(text)) {
    return text.replace(/成功将\s*赶去生产/, "成功将" + animal + "赶去生产");
  }
  return text;
}

function trackFishFeedUsage(html) {
  var info = parseFishFeedUsage(html);
  if (info && info.count) {
    FISH_STATS.feedUsed += info.count;
    if (!FISH_STATS.feedItem) {
      FISH_STATS.feedItem = info.name || "鱼食";
    } else if (info.name && FISH_STATS.feedItem.indexOf(info.name) < 0) {
      FISH_STATS.feedItem += "/" + info.name;
    }
  }
  var spend = parseSpendFromMsg(stripTags(html || ""));
  if (spend > 0) {
    MONEY_STATS.fishFeed += spend;
    PURCHASE_LOGS.push({
      name: info && info.name ? info.name : "鱼食",
      count: info && info.count ? info.count : 0,
      cost: spend
    });
  }
}

function isSuccessMsg(msg) {
  if (!msg) return false;
  if (/(没什么好收获|不需要收获|无需收获|不需要|无需)/.test(msg)) return false;
  return /(成功|获得|完成|已收获|已浇水|已除草|已除虫)/.test(msg);
}

function isNoActionMsg(msg, type) {
  if (!msg) return false;
  var text = String(msg);
  if (/(没什么好收获|不需要收获|无需收获|不需要|无需)/.test(text)) return true;
  if (/没有可/.test(text) && /(浇水|除草|除虫|收获|铲除)/.test(text)) return true;
  if (/已经/.test(text) && /(浇水|除草|除虫|收获|铲除)/.test(text) && !/(成功|完成|获得)/.test(text)) return true;
  if (/已[^。！!]{0,12}过/.test(text) && /(浇水|除草|除虫|收获|铲除)/.test(text) && !/(成功|完成|获得)/.test(text)) return true;
  if (type === "water" && /(无需浇水|不需要浇水)/.test(text)) return true;
  if (type === "clearWeed" && /(无需除草|不需要除草)/.test(text)) return true;
  if (type === "spraying" && /(无需除虫|不需要除虫|无需杀虫|不需要杀虫)/.test(text)) return true;
  if (type === "scarify" && /(无需铲除|不需要铲除|无需翻地|不需要翻地)/.test(text)) return true;
  return false;
}

function recordActionTry(type, n) {
  if (!type || ACTION_TRY[type] === undefined) return;
  var inc = typeof n === "number" ? n : 1;
  if (!inc || isNaN(inc)) inc = 1;
  ACTION_TRY[type] += inc;
}

function recordActionNoop(type, n) {
  if (!type || ACTION_NOOP[type] === undefined) return;
  var inc = typeof n === "number" ? n : 1;
  if (!inc || isNaN(inc)) inc = 1;
  ACTION_NOOP[type] += inc;
}

function buildFishFallbackIndex() {
  if (CONFIG.FISH_FALLBACK_INDEX) return CONFIG.FISH_FALLBACK_INDEX;
  var max = CONFIG.FISH_MAX_POND || 8;
  var arr = [];
  for (var i = 0; i < max; i++) arr.push(i);
  return arr.join(",");
}

function firstMatch(html, reg) {
  var m = reg.exec(html);
  return m ? m[1] : "";
}

function safeUrlDecode(s) {
  var v = s == null ? "" : String(s);
  if (!v) return "";
  try {
    return decodeURIComponent(v.replace(/\+/g, "%20"));
  } catch (_) {
    return v;
  }
}

function queryValue(url, key) {
  if (!url || !key) return "";
  var escaped = String(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  var re = new RegExp("[?&]" + escaped + "=([^&]+)");
  var m = re.exec(String(url));
  return m ? safeUrlDecode(m[1]) : "";
}

function buildPastureUrl(base, link) {
  var u = String(link || "").replace(/&amp;/g, "&");
  if (!u) return "";
  if (u.indexOf("http://") === 0 || u.indexOf("https://") === 0) return u;
  if (u.indexOf("/mc/cgi-bin/") === 0 || u.indexOf("/nc/cgi-bin/") === 0) return base + u;
  return base + "/mc/cgi-bin/" + u.replace(/^\.?\//, "");
}

function parseRanchSlotState(html) {
  var text = stripTags(html || "").replace(/\s+/g, " ");
  if (!text) return null;
  var m = text.match(/窝\(\s*([0-9]+)\s*\/\s*([0-9]+)\s*\)\s*棚\(\s*([0-9]+)\s*\/\s*([0-9]+)\s*\)/);
  if (!m) return null;
  var denUsed = Number(m[1] || 0);
  var denCap = Number(m[2] || 0);
  var shedUsed = Number(m[3] || 0);
  var shedCap = Number(m[4] || 0);
  if ([denUsed, denCap, shedUsed, shedCap].some(function (n) { return isNaN(n); })) return null;
  var denEmpty = denCap - denUsed;
  var shedEmpty = shedCap - shedUsed;
  if (denEmpty < 0) denEmpty = 0;
  if (shedEmpty < 0) shedEmpty = 0;
  return {
    denUsed: denUsed,
    denCap: denCap,
    denEmpty: denEmpty,
    shedUsed: shedUsed,
    shedCap: shedCap,
    shedEmpty: shedEmpty
  };
}

function parseRanchBuyPreEmpty(html) {
  var text = stripTags(html || "").replace(/\s+/g, " ");
  if (!text) return null;
  var denEmpty = null;
  var shedEmpty = null;
  var m = text.match(/还可以领养\s*([0-9]+)\s*只住窝[^0-9]+([0-9]+)\s*只住棚/);
  if (m) {
    denEmpty = Number(m[1] || 0);
    shedEmpty = Number(m[2] || 0);
  }
  if (denEmpty === null || isNaN(denEmpty)) {
    m = text.match(/窝还有\s*([0-9]+)\s*个空位/);
    if (m) denEmpty = Number(m[1] || 0);
  }
  if (shedEmpty === null || isNaN(shedEmpty)) {
    m = text.match(/棚还有\s*([0-9]+)\s*个空位/);
    if (m) shedEmpty = Number(m[1] || 0);
  }
  if (denEmpty === null && shedEmpty === null) return null;
  if (denEmpty === null || isNaN(denEmpty)) denEmpty = 0;
  if (shedEmpty === null || isNaN(shedEmpty)) shedEmpty = 0;
  return { denEmpty: denEmpty, shedEmpty: shedEmpty };
}

function emptyByRanchType(slot, type) {
  if (!slot) return 0;
  if (type === "窝") return Number(slot.denEmpty || 0) || 0;
  return Number(slot.shedEmpty || 0) || 0;
}

function updateRanchSlotState(ctx, html) {
  if (!ctx) return null;
  var slot = parseRanchSlotState(html || "");
  if (slot) ctx.slotState = slot;
  return slot || ctx.slotState || null;
}

function extractRanchContext(html) {
  var ctx = {};
  var h = (html || "").replace(/&amp;/g, "&");
  ctx.sid = firstMatch(h, /sid=([a-zA-Z0-9]+)/);
  ctx.g_ut = firstMatch(h, /g_ut=([0-9]+)/);
  ctx.B_UID = firstMatch(h, /B_UID=([0-9]+)/);
  ctx.lv = firstMatch(h, /lv=([0-9]+)/);
  ctx.money = firstMatch(h, /money=([0-9]+)/);

  // 饲料列表
  var foodIds = {};
  var foodRe = /food=([0-9]+)/g;
  var fm;
  while ((fm = foodRe.exec(h))) {
    foodIds[fm[1]] = true;
  }
  ctx.foods = Object.keys(foodIds);

  // 序列号列表
  var serials = {};
  var sRe = /serial=([0-9]+)/g;
  while ((fm = sRe.exec(h))) {
    serials[fm[1]] = true;
  }
  ctx.serials = Object.keys(serials);

  return ctx;
}

function extractHelpParams(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var hh = h.replace(/\s+/g, "");
  var pos = firstMatch(hh, /pos=([0-9]+)/);
  var num = firstMatch(hh, /num=([0-9]+)/);
  var type = firstMatch(hh, /type=([0-9]+)/);
  if (pos && num && type) {
    return { pos: pos, num: num, type: type };
  }
  return null;
}

function extractHelpLinks(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var re = /wap_pasture_help\?[^\"'>]*/g;
  var list = [];
  var m;
  while ((m = re.exec(h))) list.push(m[0].replace(/\s+/g, ""));
  return uniqLinks(list);
}

function extractRanchHarvestAllLink(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var re = /href=["']([^"']*wap_pasture_harvest\?[^"']+)["']/gi;
  var m;
  while ((m = re.exec(h))) {
    var link = String(m[1] || "").replace(/\s+/g, "");
    if (!link) continue;
    if (/serial=-1/i.test(link) || /htype=3/i.test(link)) return link;
  }
  var raw = h.match(/wap_pasture_harvest\?[^\"'\s>]+/i);
  if (raw && raw[0]) return String(raw[0]).replace(/\s+/g, "");
  return "";
}

function extractProductionSerials(html) {
  var meta = extractProductionMeta(html);
  return meta.serials || [];
}

function extractProductionMeta(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var oneKeyLink = "";
  var serialSet = {};
  var bySerial = {};
  var m;

  var pRe = /<p[^>]*class=["']tabs-1["'][^>]*>([\s\S]*?)<\/p>/gi;
  while ((m = pRe.exec(h))) {
    var block = m[1] || "";
    if (block.indexOf("wap_pasture_product") < 0) continue;
    var text = normalizeSpace(stripTags(block));
    var name = "";
    // Examples seen on different pages:
    // - "1) 奶牛: ..."
    // - "1. 奶牛 ..."
    // - "1、奶牛(成熟) ..."
    var nm = text.match(/^\s*\d+\s*[)\.\u3001]\s*([^:：\s（(]+)\s*(?:[:：]|$)/);
    if (nm) name = normalizeSpace(nm[1] || "");
    var linkRe = /wap_pasture_product\?[^\"'\s>]+/gi;
    var lm;
    while ((lm = linkRe.exec(block))) {
      var link = String(lm[0] || "").replace(/\s+/g, "");
      if (!link) continue;
      var sm = link.match(/serial=([0-9]+)/);
      if (sm) {
        var serial = sm[1];
        if (!serialSet[serial]) {
          serialSet[serial] = true;
        }
        if (name && !bySerial[serial]) bySerial[serial] = name;
      } else if (!/serial=/.test(link) && !oneKeyLink) {
        oneKeyLink = link;
      }
    }
  }

  var re = /生产期[\s\S]{0,120}?wap_pasture_product[^\"'>]*serial=([0-9]+)/g;
  while ((m = re.exec(h))) {
    serialSet[m[1]] = true;
  }
  if (!oneKeyLink) {
    var om =
      h.match(/wap_pasture_product\?[^\"'>]*B_UID=[^\"'>]*/i) ||
      h.match(/wap_pasture_product\?[^\"'>]*/i);
    if (om && om[0] && !/serial=/.test(om[0])) oneKeyLink = String(om[0]).replace(/\s+/g, "");
  }
  var out = [];
  for (var k in serialSet) {
    if (!serialSet.hasOwnProperty(k)) continue;
    out.push(k);
  }
  out.sort(function (a, b) {
    return Number(a) - Number(b);
  });
  return { serials: out, bySerial: bySerial, oneKeyLink: oneKeyLink };
}

function extractFoodId(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var m = h.match(/wap_pasture_feed_pre[^\"'>]*food=([0-9]+)/);
  return m ? m[1] : "";
}

function parseGrassCount(html) {
  var text = stripTags(html || "");
  if (!text) return null;
  text = text.replace(/\s+/g, " ").trim();

  // 牧场背包页常见展示：牧草：347
  var m = text.match(/牧草\s*[:：]\s*([0-9]+)/);
  if (m) {
    var v0 = parseInt(m[1], 10);
    return isNaN(v0) ? null : v0;
  }

  // 喂草预览页常见提示：仓库里还剩315颗牧草
  m = text.match(/仓库里还剩\s*([0-9]+)\s*颗?牧草/);
  if (m) {
    var v1 = parseInt(m[1], 10);
    return isNaN(v1) ? null : v1;
  }

  // 兜底：旧样式（尽量避免误匹配“种子/阈值”等）
  m =
    text.match(/(?:^|\s)牧草[^0-9]{0,8}([0-9]+)(?:$|\s)/) ||
    text.match(/(?:^|\s)([0-9]+)[^0-9]{0,8}牧草(?:$|\s)/) ||
    text.match(/牧草\s*[×xX]\s*([0-9]+)/) ||
    text.match(/牧草\s*\((\d+)\)/);
  if (!m) return null;
  var v = parseInt(m[1], 10);
  return isNaN(v) ? null : v;
}

function parseFeedPreInfo(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var info = { B_UID: "", total: null, n: null, cap: 1000 };
  var m = h.match(/name=["']B_UID["']\s+value=["']([^"']+)/i);
  if (m) info.B_UID = m[1];
  m = h.match(/name=["']total["']\s+value=["']([^"']+)/i);
  if (m) info.total = parseInt(m[1], 10);
  m = h.match(/name=["']n["']\s+value=["']([^"']+)/i);
  if (m) info.n = parseInt(m[1], 10);
  var text = stripTags(h);
  var clean = text.replace(/\s+/g, "");
  m = text.match(/饲料[:：]?\s*([0-9]+)\s*\/\s*([0-9]+)/);
  if (m) {
    var n1 = parseInt(m[1], 10);
    var c1 = parseInt(m[2], 10);
    if (!isNaN(n1)) info.n = n1;
    if (!isNaN(c1)) info.cap = c1;
  }
  m =
    clean.match(/剩余饲料([0-9]+)/) ||
    clean.match(/你目前剩余饲料([0-9]+)/) ||
    text.match(/剩余饲料[:：]?\s*([0-9]+)/) ||
    text.match(/你目前剩余饲料\s*([0-9]+)/);
  if (m) {
    var n2 = parseInt(m[1], 10);
    if (!isNaN(n2)) info.n = n2;
  }
  m = clean.match(/仓库里还剩([0-9]+)颗?牧草/) || text.match(/仓库里还剩\s*([0-9]+)\s*颗?牧草/);
  if (m) {
    var t2 = parseInt(m[1], 10);
    if (!isNaN(t2)) info.total = t2;
  }
  if (/仓库里已经没有牧草|仓库没有牧草|已没有牧草/.test(text)) {
    info.total = 0;
  }
  m = text.match(/最多可(?:喂|放|添加)\s*([0-9]+)/);
  if (m) {
    var c2 = parseInt(m[1], 10);
    if (!isNaN(c2)) info.cap = c2;
  }
  return info;
}

function toNonNegativeIntOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  var n = Number(v);
  if (isNaN(n) || n < 0) return null;
  return Math.floor(n);
}

function mergeRanchFeedInfo(prev, next) {
  if (!prev && !next) return null;
  var out = {
    total: prev && prev.total !== undefined ? prev.total : null,
    n: prev && prev.n !== undefined ? prev.n : null,
    cap: prev && prev.cap !== undefined ? prev.cap : null
  };
  if (next) {
    if (next.total !== null && next.total !== undefined) out.total = next.total;
    if (next.n !== null && next.n !== undefined) out.n = next.n;
    if (next.cap !== null && next.cap !== undefined) out.cap = next.cap;
  }
  return out;
}

function updateRanchFeedState(stage, info) {
  if (!stage || !info) return;
  var next = {
    total: toNonNegativeIntOrNull(info.total),
    n: toNonNegativeIntOrNull(info.n),
    cap: toNonNegativeIntOrNull(info.cap)
  };
  if (next.total === null && next.n === null && next.cap === null) return;
  var prev = stage === "start" ? RANCH_FEED_STATE.start : RANCH_FEED_STATE.end;
  var merged = mergeRanchFeedInfo(prev, next);
  if (stage === "start") RANCH_FEED_STATE.start = merged;
  else RANCH_FEED_STATE.end = merged;
}

function formatRanchFeedInfoLine(info) {
  var slot = "未知";
  var store = "未知";
  if (info && info.n !== null && info.n !== undefined) {
    var cap = info.cap !== null && info.cap !== undefined ? info.cap : 1000;
    slot = info.n + "/" + cap;
  } else if (info && info.cap !== null && info.cap !== undefined) {
    slot = "?/" + info.cap;
  }
  if (info && info.total !== null && info.total !== undefined) {
    store = String(info.total);
  }
  return "饲料槽" + slot + " 仓库牧草果实" + store;
}

function extractFeedFormAction(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var m = h.match(/<form[^>]+action=["']([^"']*wap_pasture_feed_food[^"']*)/i);
  return m ? m[1] : "";
}

function extractFishLevel(html) {
  var text = stripTags(html);
  var m = text.match(/等级[:：]?\s*([0-9]+)/);
  return m ? m[1] : "";
}

function extractFishFertilizeIndices(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var idx = {};
  var re = /wap_farm_fish_fertilize\?[^\"\s>]*index=([0-9]+)/g;
  var m;
  while ((m = re.exec(h))) {
    idx[m[1]] = true;
  }
  return Object.keys(idx);
}

function extractFishHarvestLinks(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var links = [];
  var re = /wap_farm_fish_harvest[^\"'>]*/g;
  var m;
  while ((m = re.exec(h))) {
    links.push(m[0].replace(/\s+/g, ""));
  }
  return links;
}

function extractFishHarvestIndex(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var m = h.match(/wap_farm_fish_harvest\?[^\"\s>]*index=([0-9,]+)/);
  return m ? m[1] : "";
}

function extractFishPlantLink(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var m = h.match(/wap_fish_plant\?[^\"'>]*/);
  return m ? m[0].replace(/\s+/g, "") : "";
}

function extractFishSeedOptions(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var list = [];
  var seen = {};
  var re = /([^<>\n]{1,50}?)\s*[×xX]\s*([0-9]+)\s*<a[^>]+href="([^"]*wap_fish_plant\?[^"]*)"/g;
  var m;
  while ((m = re.exec(h))) {
    var name = normalizeSpace(m[1] || "");
    var count = parseInt(m[2], 10);
    var link = (m[3] || "").replace(/\s+/g, "");
    var fid = firstMatch(link, /fid=([0-9]+)/) || "";
    if (!fid || seen[fid]) continue;
    if (!count || isNaN(count) || count <= 0) continue;
    seen[fid] = true;
    list.push({ fid: fid, name: name, count: count, link: link });
  }
  return list;
}

function parseNumberSet(input) {
  var set = {};
  var arr = String(input || "")
    .split(",")
    .map(function (s) {
      return normalizeSpace(s);
    })
    .filter(Boolean);
  for (var i = 0; i < arr.length; i++) {
    var n = Number(arr[i]);
    if (!n || isNaN(n) || n <= 0) continue;
    set[n] = i + 1;
  }
  return set;
}

function pickPreferredFishSeedOption(list) {
  var arr = ensureArray(list);
  if (!arr.length) return null;
  if (!CONFIG.FISH_PREFER_RARE_SEED) return arr[0];
  var rareOrder = parseNumberSet(CONFIG.FISH_RARE_FID_PRIORITY || "");
  var commonFid = Number(CONFIG.FISH_BUY_FID || 35);

  function score(it) {
    var fid = Number(it && it.fid ? it.fid : 0);
    var cnt = Number(it && it.count ? it.count : 0);
    var name = normalizeSpace(it && it.name ? it.name : "");
    var s = 0;
    if (fid && rareOrder[fid]) s += 100000 - rareOrder[fid];
    else if (fid >= 100) s += 60000;
    else if (fid > 0 && fid !== commonFid) s += 30000;
    if (/珍|稀|神仙|帝王|东方|刺鲷|绸/.test(name)) s += 15000;
    s += Math.min(cnt || 0, 999);
    return s;
  }

  var best = null;
  var bestScore = -1;
  for (var i = 0; i < arr.length; i++) {
    var it = arr[i];
    var sc = score(it);
    if (sc > bestScore) {
      bestScore = sc;
      best = it;
    }
  }
  return best || arr[0];
}

function extractFishBuyFids(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var ids = [];
  var seen = {};
  var re = /wap_fish_buy_(?:pre_)?new\?[^\"'>]*fid=([0-9]+)/g;
  var m;
  while ((m = re.exec(h))) {
    if (!seen[m[1]]) {
      seen[m[1]] = true;
      ids.push(m[1]);
    }
  }
  return ids;
}

function extractFishBuyOptions(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var list = [];
  var seen = {};
  var re = /<p>\s*\d+\.\s*([^<(]+?)\s*\([^)]*\)[\s\S]{0,200}?wap_fish_buy_(?:pre_)?new\?[^\"'>]*fid=([0-9]+)/g;
  var m;
  while ((m = re.exec(h))) {
    var name = (m[1] || "").replace(/\s+/g, " ").trim();
    var fid = m[2];
    if (!fid || seen[fid]) continue;
    seen[fid] = true;
    list.push({ fid: fid, name: name });
  }
  return list;
}

function extractFishNameFromPre(html) {
  var text = stripTags(html || "");
  var m = text.match(/([^\s]+)鱼苗/);
  return m ? m[1] : "";
}

function extractFishMaxBuy(html) {
  var text = stripTags(html || "");
  var m = text.match(/最多可购买\s*([0-9]+)/);
  if (!m) return null;
  var v = parseInt(m[1], 10);
  return isNaN(v) ? null : v;
}

function extractFishEmptyPonds(html) {
  var text = stripTags(html || "");
  var clean = text.replace(/\s+/g, "");
  var m = clean.match(/你有([0-9]+)块空池塘/);
  if (!m) m = text.match(/你有\s*([0-9]+)\s*块空池塘/);
  if (!m) m = clean.match(/你有([0-9]+)块空鱼塘/);
  if (!m) m = text.match(/你有\s*([0-9]+)\s*块空鱼塘/);
  if (!m) m = clean.match(/你有([0-9]+)块空鱼池/);
  if (!m) m = text.match(/你有\s*([0-9]+)\s*块空鱼池/);
  if (!m) m = clean.match(/空池塘[:：]?([0-9]+)/);
  if (!m) m = clean.match(/空鱼塘[:：]?([0-9]+)/);
  if (!m) m = clean.match(/空鱼池[:：]?([0-9]+)/);
  if (!m) return null;
  var v = parseInt(m[1], 10);
  return isNaN(v) ? null : v;
}

function calcFishBuyNeed(seedTotal, emptyPonds) {
  var total = Number(seedTotal || 0);
  if (isNaN(total) || total < 0) total = 0;
  var target = Number(CONFIG.FISH_MIN_SEED || 0);
  if (isNaN(target) || target < 0) target = 0;
  var buyNum = Number(CONFIG.FISH_BUY_NUM || 0);
  if (isNaN(buyNum) || buyNum < 0) buyNum = 0;

  if (emptyPonds !== null && emptyPonds !== undefined) {
    var empty = Number(emptyPonds);
    if (isNaN(empty) || empty < 0) empty = 0;
    var needByEmpty = Math.max(empty - total, 0);
    // 兼容原有策略：空池塘=0 且配置了库存目标时，允许补库存到目标值。
    if (empty === 0 && target > 0) return Math.max(target - total, 0);
    return needByEmpty;
  }

  if (target > 0) return Math.max(target - total, 0);
  return buyNum;
}

function parseFishIndexOccupancy(html) {
  var out = {
    occupied: 0,
    maxNo: 0,
    serialNos: [],
    indices: [],
    hasOneKeyFeed: false
  };
  if (!html) return out;
  var h = String(html || "").replace(/&amp;/g, "&");

  // 1) 编号行（最稳）：1. / 2. / ... / 8.
  var noSet = {};
  var m;
  var noRe = /(?:^|[\r\n>])\s*([0-9]{1,2})\.\s*/g;
  while ((m = noRe.exec(h))) {
    var no = parseInt(m[1], 10);
    if (isNaN(no) || no <= 0 || no > 99) continue;
    noSet[no] = true;
  }
  for (var k in noSet) {
    if (!noSet.hasOwnProperty(k)) continue;
    var n = parseInt(k, 10);
    if (isNaN(n)) continue;
    out.serialNos.push(n);
    if (n > out.maxNo) out.maxNo = n;
  }
  out.serialNos.sort(function (a, b) {
    return a - b;
  });

  // 2) fish_fertilize index（用于定位已占用的真实槽位，0-based）
  var idxSet = {};
  var idxRe = /wap_farm_fish_fertilize\?[^\"\s>]*index=([0-9]+)/g;
  while ((m = idxRe.exec(h))) {
    var idx = parseInt(m[1], 10);
    if (isNaN(idx) || idx < 0 || idx > 98) continue;
    idxSet[idx] = true;
  }
  for (var k2 in idxSet) {
    if (!idxSet.hasOwnProperty(k2)) continue;
    var i2 = parseInt(k2, 10);
    if (isNaN(i2)) continue;
    out.indices.push(i2);
  }
  out.indices.sort(function (a, b) {
    return a - b;
  });

  // 3) occupied 优先看编号数量；若未解析到则回退 index 数量
  if (out.serialNos.length > 0) out.occupied = out.serialNos.length;
  else if (out.indices.length > 0) out.occupied = out.indices.length;

  // 4) 是否存在“一键喂鱼食”入口（可作为页面识别辅助）
  out.hasOneKeyFeed = /index=-1/.test(h) || /一键[^<]{0,8}喂鱼食/.test(stripTags(h));

  return out;
}

function guessFishPoolCap(maxIndex, occupied) {
  var cap = Number(CONFIG.FISH_MAX_POND || 8);
  if (!cap || isNaN(cap) || cap < 1) cap = 8;
  if (LAST_FISH_CAP && LAST_FISH_CAP > cap) cap = LAST_FISH_CAP;
  if (maxIndex >= 0 && maxIndex + 1 > cap) cap = maxIndex + 1;
  if (occupied > cap) cap = occupied;
  return cap;
}

function parseFishIndexJsonState(json) {
  if (!json || Number(json.code) !== 1) return null;
  var hasFishField = json && Object.prototype.hasOwnProperty.call(json, "fish");
  if (!hasFishField) return null;
  var fishRaw = json.fish;
  var fish = ensureArray(fishRaw);
  if (!fish.length && fishRaw && typeof fishRaw !== "object") return null;
  if (!fish.length && fishRaw && typeof fishRaw === "object") {
    var keys = Object.keys(fishRaw);
    for (var ki = 0; ki < keys.length; ki++) {
      var kk = keys[ki];
      if (kk === "length") continue;
      if (!/^\d+$/.test(kk)) return null;
    }
  }
  var occupied = fish.length;
  var maxIndex = -1;
  var feedable = 0;
  var harvestable = 0;
  var harvestIndices = [];
  var stageMap = {};
  for (var i = 0; i < fish.length; i++) {
    var it = fish[i] || {};
    var idx = Number(it.i);
    if (!isNaN(idx) && idx >= 0 && idx > maxIndex) maxIndex = idx;
    var g = Number(it.g || 0);
    var f = Number(it.f || 0);
    var l = Number(it.l || 0);
    var o = Number(it.o || 0);
    if (!isNaN(g) && g > 0) {
      if (!stageMap[g]) stageMap[g] = 0;
      stageMap[g] += 1;
    }
    if (!isNaN(f) && f > 0) feedable += 1;
    var canHarvest = (!isNaN(g) && g >= 4) || (!isNaN(l) && l > 0) || (!isNaN(o) && o > 0);
    if (canHarvest) {
      harvestable += 1;
      if (!isNaN(idx) && idx >= 0) harvestIndices.push(idx);
    }
  }
  if (harvestIndices.length > 1) {
    harvestIndices = harvestIndices
      .filter(function (x, p, arr) {
        return arr.indexOf(x) === p;
      })
      .sort(function (a, b) {
        return a - b;
      });
  }
  var cap = guessFishPoolCap(maxIndex, occupied);
  var empty = cap - occupied;
  if (empty < 0) empty = 0;
  var pearl = json.pearl != null ? Number(json.pearl) : null;
  if (pearl !== null && isNaN(pearl)) pearl = null;
  var pieceMap = {};
  var pieceArr = ensureArray(json.piece);
  for (var pi = 0; pi < pieceArr.length; pi++) {
    var pz = pieceArr[pi] || {};
    var pfid = Number(pz.fid || pz.id || 0);
    var pnum = Number(pz.num || 0);
    if (!pfid || isNaN(pfid) || pfid <= 0) continue;
    if (isNaN(pnum) || pnum < 0) continue;
    pieceMap[String(pfid)] = Math.floor(pnum);
  }
  return {
    occupied: occupied,
    cap: cap,
    empty: empty,
    maxIndex: maxIndex,
    feedable: feedable,
    harvestable: harvestable,
    harvestIndices: harvestIndices,
    stageMap: stageMap,
    pearl: pearl,
    pieceMap: pieceMap,
    raw: json
  };
}

function ensureFishJsonContext(cookie) {
  var uIdx = FARM_CTX.uIdx || "";
  var uinY = FARM_CTX.uinY || getFarmUinFromCookie(cookie) || "";
  if (uIdx && uinY) return Promise.resolve({ uIdx: uIdx, uinY: uinY });
  if (!CONFIG.FARM_JSON_ENABLE) return Promise.resolve({ uIdx: uIdx, uinY: uinY });
  return ensureFarmJsonContext(cookie)
    .then(function () {
      return {
        uIdx: FARM_CTX.uIdx || "",
        uinY: FARM_CTX.uinY || getFarmUinFromCookie(cookie) || ""
      };
    })
    .catch(function () {
      return { uIdx: uIdx, uinY: uinY };
    });
}

function fetchFishIndexJsonState(cookie, tag) {
  if (!CONFIG.FISH_JSON_INDEX_ENABLE) return Promise.resolve(null);
  return ensureFishJsonContext(cookie).then(function (ctx) {
    var uIdx = ctx.uIdx || "";
    var uinY = ctx.uinY || "";
    if (!uIdx || !uinY) {
      if (CONFIG.DEBUG) logDebug("🐟 JSON空位(" + (tag || "读取") + "): 缺少 uIdx/uinY，跳过");
      return null;
    }
    var params = {
      uinY: uinY,
      uIdx: uIdx,
      ownerId: uIdx,
      farmTime: getFarmTime(),
      platform: CONFIG.FARM_PLATFORM || "13",
      appid: CONFIG.FARM_APPID || "353",
      version: CONFIG.FARM_VERSION || "4.0.20.0"
    };
    var url = (CONFIG.FARM_JSON_BASE || "https://nc.qzone.qq.com") + "/cgi-bin/cgi_fish_index";
    return httpRequest({
      method: "POST",
      url: url,
      headers: buildFishJsonHeaders(cookie),
      body: buildLegacyBody(params)
    })
      .then(function (resp) {
        var json = tryJson(resp.body);
        var state = parseFishIndexJsonState(json);
        if (!state) {
          if (CONFIG.DEBUG) {
            var code = json && json.code != null ? json.code : "非JSON";
            var fishRaw = json && Object.prototype.hasOwnProperty.call(json, "fish") ? json.fish : undefined;
            var fishType = Object.prototype.toString.call(fishRaw);
            var fishKeys =
              fishRaw && typeof fishRaw === "object"
                ? Object.keys(fishRaw)
                    .slice(0, 5)
                    .join(",")
                : "";
            logDebug(
              "🐟 JSON空位(" +
                (tag || "读取") +
                "): 无效回包 code=" +
                code +
                " status=" +
                resp.status +
                " fishType=" +
                fishType +
                (fishKeys ? " fishKeys=" + fishKeys : "")
            );
          }
          return null;
        }
        LAST_FISH_EMPTY = state.empty;
        LAST_FISH_HAS_EMPTY = state.empty > 0;
        if (state.cap > 0) LAST_FISH_CAP = state.cap;
        if (CONFIG.DEBUG) {
          logDebug(
            "🐟 JSON空位(" +
              (tag || "读取") +
            "): 占用" +
              state.occupied +
              "/" +
              state.cap +
              " 空位" +
              state.empty +
              " 可喂" +
              state.feedable +
              " 可收" +
              state.harvestable +
              (state.pearl !== null ? " 珍珠" + state.pearl : "")
          );
        }
        return state;
      })
      .catch(function (e) {
        if (CONFIG.DEBUG) logDebug("🐟 JSON空位(" + (tag || "读取") + ")失败: " + e);
        return null;
      });
  });
}

function parseFishPearlPkg(pkg, itemTip) {
  var arr = ensureArray(pkg);
  var tipName = normalizeSpace(itemTip || "");
  if (!arr.length) return tipName || "";
  var byName = {};
  var order = [];
  var nameMap = CONFIG.FISH_PEARL_ITEM_NAME_MAP || {};
  var runtimeMap = FISH_PEARL_ID_NAME_MAP || {};
  for (var i = 0; i < arr.length; i++) {
    var it = arr[i] || {};
    var id = it.id != null ? String(it.id) : "";
    var name = normalizeSpace(
      it.name || it.itemName || it.item_name || it.title || it.tName || it.item || ""
    );
    if (!name && id && runtimeMap[id]) name = normalizeSpace(runtimeMap[id]);
    if (!name && id && nameMap[id]) name = normalizeSpace(nameMap[id]);
    var tp = Number(it.type || 0);
    if (!name) {
      name = tipName || (tp === 89 ? "珍珠碎片" : "道具奖励");
    }
    var num = Number(it.num || 0);
    if (isNaN(num) || num <= 0) num = 1;
    if (!byName[name]) {
      byName[name] = 0;
      order.push(name);
    }
    byName[name] += num;
  }
  var parts = [];
  for (var j = 0; j < order.length; j++) {
    var nm = order[j];
    parts.push(nm + "×" + byName[nm]);
  }
  return parts.join("，");
}

function mergeFishPearlNameMap(list) {
  var arr = ensureArray(list);
  var add = 0;
  for (var i = 0; i < arr.length; i++) {
    var it = arr[i] || {};
    var id = "";
    if (it.fid !== null && it.fid !== undefined && it.fid !== "") id = String(it.fid);
    else if (it.id !== null && it.id !== undefined && it.id !== "") id = String(it.id);
    var name = normalizeSpace(it.name || it.tName || it.itemName || "");
    if (!id || !name) continue;
    if (!FISH_PEARL_ID_NAME_MAP[id] || FISH_PEARL_ID_NAME_MAP[id] !== name) {
      FISH_PEARL_ID_NAME_MAP[id] = name;
      add += 1;
    }
  }
  return add;
}

function getFishNameByFid(fid) {
  var key = String(fid || "");
  if (!key) return "";
  var nm = normalizeSpace(FISH_PEARL_ID_NAME_MAP[key] || "");
  return nm;
}

function fetchFishPearlNameMap(cookie) {
  if (!CONFIG.FISH_PEARL_NAME_AUTO_MAP) return Promise.resolve(0);
  return ensureFishJsonContext(cookie)
    .then(function (ctx) {
      var uIdx = ctx && ctx.uIdx ? ctx.uIdx : "";
      var uinY = ctx && ctx.uinY ? ctx.uinY : "";
      if (!uIdx || !uinY) return 0;
      var base = CONFIG.FARM_JSON_BASE || "https://nc.qzone.qq.com";
      var totalAdd = 0;
      var queue = [1, 2, 3, 4, 5, 6, 7, 8];
      var checked = {};

      function appendFlagTypes(flagObj) {
        var fo = flagObj || {};
        for (var k in fo) {
          if (!fo.hasOwnProperty(k)) continue;
          var t = Number(k);
          if (!t || isNaN(t) || t <= 0) continue;
          if (checked[t]) continue;
          var exists = false;
          for (var i = 0; i < queue.length; i++) {
            if (queue[i] === t) {
              exists = true;
              break;
            }
          }
          if (!exists) queue.push(t);
        }
      }

      function pullNext() {
        if (queue.length === 0) return Promise.resolve(totalAdd);
        var t = Number(queue.shift() || 0);
        if (!t || checked[t]) return pullNext();
        checked[t] = true;
        var params = {
          uinY: uinY,
          uIdx: uIdx,
          farmTime: getFarmTime(),
          platform: CONFIG.FARM_PLATFORM || "13",
          appid: CONFIG.FARM_APPID || "353",
          version: CONFIG.FARM_VERSION || "4.0.20.0"
        };
        var url = base + "/cgi-bin/cgi_fish_history_list?type=" + t;
        return httpRequest({
          method: "POST",
          url: url,
          headers: buildFishJsonHeaders(cookie),
          body: buildLegacyBody(params)
        })
          .then(function (resp) {
            var json = tryJson(resp.body);
            if (!json || Number(json.ret) !== 0 || Number(json.ecode || 0) !== 0) return;
            totalAdd += mergeFishPearlNameMap(json.list);
            appendFlagTypes(json.flag);
          })
          .catch(function () {
            return;
          })
          .then(function () {
            return pullNext();
          });
      }
      return pullNext();
    })
    .then(function (added) {
      if (CONFIG.DEBUG && added > 0) {
        var keys = Object.keys(FISH_PEARL_ID_NAME_MAP || {});
        keys.sort(function (a, b) {
          return Number(a) - Number(b);
        });
        logDebug("🎁 珍珠名称映射: 新增" + added + "，累计" + keys.length);
      }
      return added;
    })
    .catch(function () {
      return 0;
    });
}

function loadFishComposeNeedMap() {
  if (FISH_COMPOSE_NEED_MAP && typeof FISH_COMPOSE_NEED_MAP === "object") return FISH_COMPOSE_NEED_MAP;
  var out = {};
  var raw = $.read(STORE_KEY_FISH_COMPOSE_NEED) || "";
  if (raw) {
    var obj = tryJson(raw);
    if (obj && typeof obj === "object") out = obj;
  }
  var map = {};
  for (var k in out) {
    if (!out.hasOwnProperty(k)) continue;
    if (!/^\d+$/.test(String(k))) continue;
    var n = Number(out[k] || 0);
    if (isNaN(n) || n <= 0) continue;
    if (n > 999) n = 999;
    map[String(k)] = Math.floor(n);
  }
  FISH_COMPOSE_NEED_MAP = map;
  return FISH_COMPOSE_NEED_MAP;
}

function saveFishComposeNeedMap() {
  var map = loadFishComposeNeedMap();
  try {
    $.write(JSON.stringify(map || {}), STORE_KEY_FISH_COMPOSE_NEED);
  } catch (e) {
    if (CONFIG.DEBUG) logDebug("🧬 合成门槛缓存写入失败: " + e);
  }
}

function loadFishComposeFreezeMap() {
  if (FISH_COMPOSE_FREEZE_MAP && typeof FISH_COMPOSE_FREEZE_MAP === "object") return FISH_COMPOSE_FREEZE_MAP;
  var out = {};
  var raw = $.read(STORE_KEY_FISH_COMPOSE_FREEZE) || "";
  if (raw) {
    var obj = tryJson(raw);
    if (obj && typeof obj === "object") out = obj;
  }
  var map = {};
  for (var k in out) {
    if (!out.hasOwnProperty(k)) continue;
    if (!/^\d+$/.test(String(k))) continue;
    var n = Number(out[k]);
    if (isNaN(n) || n < 0) continue;
    if (n > 99999) n = 99999;
    map[String(k)] = Math.floor(n);
  }
  FISH_COMPOSE_FREEZE_MAP = map;
  return FISH_COMPOSE_FREEZE_MAP;
}

function saveFishComposeFreezeMap() {
  var map = loadFishComposeFreezeMap();
  try {
    $.write(JSON.stringify(map || {}), STORE_KEY_FISH_COMPOSE_FREEZE);
  } catch (e) {
    if (CONFIG.DEBUG) logDebug("🧬 合成冻结缓存写入失败: " + e);
  }
}

function fishComposeFreezeCountOf(fid) {
  var key = String(Number(fid || 0) || 0);
  if (!key || key === "0") return null;
  var map = loadFishComposeFreezeMap();
  if (!Object.prototype.hasOwnProperty.call(map, key)) return null;
  var n = Number(map[key]);
  if (isNaN(n) || n < 0) return null;
  return Math.floor(n);
}

function setFishComposeFreeze(fid, pieceCount) {
  var key = String(Number(fid || 0) || 0);
  if (!key || key === "0") return false;
  var n = Number(pieceCount);
  if (isNaN(n) || n < 0) return false;
  n = Math.floor(n);
  var map = loadFishComposeFreezeMap();
  var old = fishComposeFreezeCountOf(key);
  if (old !== null && old === n) return false;
  map[key] = n;
  saveFishComposeFreezeMap();
  return true;
}

function clearFishComposeFreeze(fid) {
  var key = String(Number(fid || 0) || 0);
  if (!key || key === "0") return false;
  var map = loadFishComposeFreezeMap();
  if (!Object.prototype.hasOwnProperty.call(map, key)) return false;
  delete map[key];
  saveFishComposeFreezeMap();
  return true;
}

function fishComposeNeedHint(fid) {
  if (!CONFIG.FISH_COMPOSE_HINTS_ENABLE) return 0;
  var key = String(Number(fid || 0) || 0);
  if (!key || key === "0") return 0;
  var hints = (CONFIG && CONFIG.FISH_COMPOSE_NEED_HINTS) || {};
  var n = Number(hints[key] || 0);
  if (isNaN(n) || n <= 0) return 0;
  return Math.floor(n);
}

function fishComposeNeedOf(fid) {
  var key = String(Number(fid || 0) || 0);
  if (!key || key === "0") return 0;
  var map = loadFishComposeNeedMap();
  var n = Number(map[key] || 0);
  if (isNaN(n) || n <= 0) n = fishComposeNeedHint(key);
  if (isNaN(n) || n <= 0) return 0;
  return n;
}

function updateFishComposeNeed(fid, need, mode) {
  var key = String(Number(fid || 0) || 0);
  if (!key || key === "0") return false;
  var n = Number(need || 0);
  if (isNaN(n) || n <= 0) return false;
  if (n > 999) n = 999;
  n = Math.floor(n);
  var map = loadFishComposeNeedMap();
  var old = Number(map[key] || 0);
  if (isNaN(old) || old <= 0) old = fishComposeNeedHint(key);
  if (isNaN(old) || old < 0) old = 0;
  var next = old;
  if (mode === "ceil") {
    if (old <= 0) return false;
    next = old > n ? n : old;
  } else {
    next = old < n ? n : old;
  }
  if (next <= 0 || next === old) return false;
  map[key] = next;
  saveFishComposeNeedMap();
  return true;
}

function fishPieceCountByFid(state, fid) {
  if (!state || !state.pieceMap) return null;
  var key = String(Number(fid || 0) || 0);
  if (!key || key === "0") return null;
  if (!Object.prototype.hasOwnProperty.call(state.pieceMap, key)) return null;
  var n = Number(state.pieceMap[key]);
  if (isNaN(n) || n < 0) return null;
  return n;
}

function fetchFishComposeCandidates(cookie) {
  if (!CONFIG.FISH_AUTO_COMPOSE) return Promise.resolve(null);
  return ensureFishJsonContext(cookie)
    .then(function (ctx) {
      var uIdx = ctx && ctx.uIdx ? ctx.uIdx : "";
      var uinY = ctx && ctx.uinY ? ctx.uinY : "";
      if (!uIdx || !uinY) return null;
      var base = CONFIG.FARM_JSON_BASE || "https://nc.qzone.qq.com";
      var map = {};
      var order = [];
      var checked = {};
      var seedType = Number(CONFIG.FISH_COMPOSE_HISTORY_TYPE || 2);
      if (isNaN(seedType) || seedType <= 0) seedType = 2;
      var queue = [seedType];

      function mergeList(list) {
        var arr = ensureArray(list);
        if (!arr.length) return;
        mergeFishPearlNameMap(arr);
        for (var i = 0; i < arr.length; i++) {
          var it = arr[i] || {};
          var fid = Number(it.fid != null ? it.fid : it.id);
          var num = Number(it.num || 0);
          if (!fid || isNaN(fid) || fid <= 0) continue;
          if (!num || isNaN(num) || num <= 0) continue;
          var key = String(fid);
          var name =
            normalizeSpace(it.name || it.tName || it.itemName || FISH_PEARL_ID_NAME_MAP[key] || "") ||
            ("鱼苗#" + key);
          if (!map[key]) {
            map[key] = { fid: fid, name: name, num: num };
            order.push(key);
          } else {
            if (num > map[key].num) map[key].num = num;
            if (name && !/^鱼苗#/.test(name)) map[key].name = name;
          }
        }
      }

      function appendFlagTypes(flagObj) {
        var fo = flagObj || {};
        for (var k in fo) {
          if (!fo.hasOwnProperty(k)) continue;
          var t = Number(k);
          if (!t || isNaN(t) || t <= 0) continue;
          var v = Number(fo[k] || 0);
          if (isNaN(v) || v <= 0) continue;
          if (checked[t]) continue;
          var exists = false;
          for (var i = 0; i < queue.length; i++) {
            if (queue[i] === t) {
              exists = true;
              break;
            }
          }
          if (!exists) queue.push(t);
        }
      }

      function pullNext() {
        if (queue.length === 0) return Promise.resolve();
        var t = Number(queue.shift() || 0);
        if (!t || checked[t]) return pullNext();
        checked[t] = true;
        var params = {
          uinY: uinY,
          uIdx: uIdx,
          farmTime: getFarmTime(),
          platform: CONFIG.FARM_PLATFORM || "13",
          appid: CONFIG.FARM_APPID || "353",
          version: CONFIG.FARM_VERSION || "4.0.20.0"
        };
        var url = base + "/cgi-bin/cgi_fish_history_list?type=" + t;
        return httpRequest({
          method: "POST",
          url: url,
          headers: buildFishJsonHeaders(cookie),
          body: buildLegacyBody(params)
        })
          .then(function (resp) {
            var json = tryJson(resp.body);
            if (!json || Number(json.ret) !== 0 || Number(json.ecode || 0) !== 0) return;
            mergeList(json.list);
            appendFlagTypes(json.flag);
          })
          .catch(function () {
            return;
          })
          .then(function () {
            return pullNext();
          });
      }

      return pullNext().then(function () {
        var out = [];
        for (var i = 0; i < order.length; i++) {
          var key = order[i];
          if (map[key]) out.push(map[key]);
        }
        if (CONFIG.DEBUG && out.length > 0) {
          var parts = [];
          for (var j = 0; j < out.length; j++) {
            parts.push(out[j].name + "×" + out[j].num);
          }
          logDebug("🧬 碎片候选(历史): " + parts.join("；"));
        }
        return { uIdx: uIdx, uinY: uinY, list: out };
      });
    })
    .catch(function () {
      return null;
    });
}

function runFishComposeFromPieces(cookie) {
  if (!CONFIG.FISH_AUTO_COMPOSE) return Promise.resolve(false);
  var transientRetries = Math.max(0, Number(CONFIG.RETRY_TRANSIENT || 0));
  if (isNaN(transientRetries)) transientRetries = 0;
  var maxPerId = Number(CONFIG.FISH_COMPOSE_MAX_PER_ID || 0);
  var maxTotal = Number(CONFIG.FISH_COMPOSE_MAX_TOTAL || 0);
  if (isNaN(maxPerId) || maxPerId < 0) maxPerId = 0;
  if (isNaN(maxTotal) || maxTotal < 0) maxTotal = 0;

  function composeOnce(cookie0, ctx0, fid) {
    var params = {
      uIdx: ctx0.uIdx,
      act: "compose",
      uinY: ctx0.uinY,
      id: String(fid),
      farmTime: getFarmTime(),
      platform: CONFIG.FARM_PLATFORM || "13",
      appid: CONFIG.FARM_APPID || "353",
      version: CONFIG.FARM_VERSION || "4.0.20.0"
    };
    var url = (CONFIG.FARM_JSON_BASE || "https://nc.qzone.qq.com") + "/cgi-bin/cgi_fish_piece";
    return httpRequest({
      method: "POST",
      url: url,
      headers: buildFishJsonHeaders(cookie0),
      body: buildLegacyBody(params)
    }).then(function (resp) {
      var json = tryJson(resp.body);
      if (!json) return { ok: false, transient: false, msg: "响应非JSON" };
      var ok = Number(json.ret) === 0 && Number(json.ecode || 0) === 0;
      var msg = normalizeSpace(json.direction || json.msg || json.message || "");
      if (!msg && !ok) msg = "ret=" + json.ret + " ecode=" + json.ecode;
      return { ok: ok, transient: isTransientFailText(msg || ""), msg: msg, json: json };
    });
  }

  return fetchFishComposeCandidates(cookie).then(function (meta) {
    if (!meta || !meta.list || meta.list.length === 0) {
      if (CONFIG.DEBUG) logDebug("🧬 碎片合成: 无可合成鱼苗");
      return false;
    }
    var list = meta.list || [];
    var totalDone = 0;
    var doneByName = {};
    var nameOrder = [];
    var precheckEnabled = !!CONFIG.FISH_COMPOSE_PRECHECK;

    function doneHit(name, n) {
      var nm = normalizeSpace(name || "鱼苗");
      var cnt = Number(n || 0);
      if (!cnt || isNaN(cnt) || cnt <= 0) return;
      totalDone += cnt;
      if (!doneByName[nm]) {
        doneByName[nm] = 0;
        nameOrder.push(nm);
      }
      doneByName[nm] += cnt;
      recordFishCompose(nm, cnt);
    }

    return (precheckEnabled ? fetchFishIndexJsonState(cookie, "碎片合成预判") : Promise.resolve(null))
      .catch(function () {
        return null;
      })
      .then(function (pieceState) {
        var hasPieceState = !!(pieceState && pieceState.pieceMap);
        function composeItem(item, idx) {
          if (!item) return Promise.resolve();
          var fid = Number(item.fid || 0);
          var name = normalizeSpace(item.name || "") || ("鱼苗#" + fid);
          var quota = Number(item.num || 0);
          if (!fid || isNaN(fid) || fid <= 0) return Promise.resolve();
          if (!quota || isNaN(quota) || quota <= 0) return Promise.resolve();
          if (maxPerId > 0 && quota > maxPerId) quota = maxPerId;
          if (maxTotal > 0) {
            var remainTotal = maxTotal - totalDone;
            if (remainTotal <= 0) return Promise.resolve();
            if (quota > remainTotal) quota = remainTotal;
          }
          if (quota <= 0) return Promise.resolve();

          var pieceCount = hasPieceState ? fishPieceCountByFid(pieceState, fid) : null;
          var knownNeed = precheckEnabled ? fishComposeNeedOf(fid) : 0;
          var frozenAt = hasPieceState ? fishComposeFreezeCountOf(fid) : null;
          if (hasPieceState && pieceCount !== null && frozenAt !== null) {
            if (pieceCount === frozenAt) {
              if (CONFIG.DEBUG) logDebug("🧬 碎片冻结跳过(" + name + "): 持有" + pieceCount + "未变化");
              return Promise.resolve();
            }
            clearFishComposeFreeze(fid);
            if (CONFIG.DEBUG) logDebug("🧬 碎片冻结解除(" + name + "): " + frozenAt + "→" + pieceCount);
          }
          if (hasPieceState && knownNeed > 0) {
            var current = pieceCount !== null ? pieceCount : 0;
            if (current < knownNeed) {
              if (CONFIG.DEBUG) {
                logDebug("🧬 碎片预判跳过(" + name + "): 持有" + current + " < 门槛" + knownNeed);
              }
              return Promise.resolve();
            }
          }
          if (hasPieceState && pieceCount !== null && pieceCount <= 0) {
            if (CONFIG.DEBUG) logDebug("🧬 碎片预判跳过(" + name + "): 持有碎片为0");
            return Promise.resolve();
          }

          function loop(remain, retry) {
            if (remain <= 0) return Promise.resolve();
            return composeOnce(cookie, meta, fid)
              .then(function (ret) {
                if (ret && ret.ok) {
                  doneHit(name, 1);
                  clearFishComposeFreeze(fid);
                  if (precheckEnabled && pieceCount !== null && pieceCount > 0) {
                    updateFishComposeNeed(fid, pieceCount, "ceil");
                  }
                  return loop(remain - 1, 0);
                }
                if (ret && ret.transient && retry < transientRetries) {
                  log("⚠️ 鱼苗合成: " + name + " 系统繁忙，第" + (retry + 1) + "次重试");
                  return sleep(CONFIG.RETRY_WAIT_MS || 800).then(function () {
                    return loop(remain, retry + 1);
                  });
                }
                var msg = (ret && ret.msg) || "";
                var lack = /碎片不足|不足|不满足|不可合成|未达到|没有可合成/.test(msg);
                if (precheckEnabled && lack && pieceCount !== null) {
                  setFishComposeFreeze(fid, pieceCount);
                  var changed = updateFishComposeNeed(fid, pieceCount + 1, "floor");
                  if (changed && CONFIG.DEBUG) {
                    logDebug("🧬 合成门槛学习(" + name + "): 当前" + pieceCount + "，门槛至少" + (pieceCount + 1));
                  }
                }
                if (ret && ret.msg && !/碎片不足|不足|不满足|不可合成|未达到|没有可合成|该鱼苗已拥有/.test(ret.msg)) {
                  log("⚠️ 鱼苗合成失败(" + name + "): " + ret.msg);
                } else if (CONFIG.DEBUG && ret && ret.msg) {
                  logDebug("🧬 鱼苗合成停止(" + name + "): " + ret.msg);
                }
                return;
              })
              .catch(function (e) {
                log("⚠️ 鱼苗合成异常(" + name + "): " + e);
              });
          }
          return loop(quota, 0);
        }

        function runAt(i) {
          if (i >= list.length) return Promise.resolve();
          return composeItem(list[i], i).then(function () {
            return runAt(i + 1);
          });
        }

        return runAt(0).then(function () {
          if (totalDone <= 0) return false;
          BAG_STATS.fish = { total: 0, items: [] };
          var parts = [];
          for (var i = 0; i < nameOrder.length; i++) {
            var nm = nameOrder[i];
            parts.push(nm + "×" + doneByName[nm]);
          }
          log("🧬 鱼苗合成: " + parts.join("；") + " (合计" + totalDone + ")");
          return true;
        });
      });
  });
}

function updateFishPearlFreeCache(freeTimes, freeStamp) {
  if (freeTimes !== null && freeTimes !== undefined && freeTimes !== "") {
    $.write(String(freeTimes), STORE_KEY_FISH_PEARL_FREE_TIMES);
  }
  if (freeStamp !== null && freeStamp !== undefined && freeStamp !== "") {
    $.write(String(freeStamp), STORE_KEY_FISH_PEARL_FREE_STAMP);
  }
}

function fetchFishPieceState(cookie, tag) {
  return ensureFishJsonContext(cookie).then(function (ctx) {
    var uIdx = ctx.uIdx || "";
    var uinY = ctx.uinY || "";
    if (!uIdx || !uinY) return null;
    var params = {
      act: "index",
      uIdx: uIdx,
      uinY: uinY,
      farmTime: getFarmTime(),
      platform: CONFIG.FARM_PLATFORM || "13",
      appid: CONFIG.FARM_APPID || "353",
      version: CONFIG.FARM_VERSION || "4.0.20.0"
    };
    var url = (CONFIG.FARM_JSON_BASE || "https://nc.qzone.qq.com") + "/cgi-bin/cgi_fish_piece";
    return httpRequest({
      method: "POST",
      url: url,
      headers: buildFishJsonHeaders(cookie),
      body: buildLegacyBody(params)
    })
      .then(function (resp) {
        var json = tryJson(resp.body);
        if (!json || Number(json.ret) !== 0 || Number(json.ecode || 0) !== 0) return null;
        var freeTimes = json.free_times != null ? Number(json.free_times) : null;
        var freeStamp = json.free_stamp != null ? Number(json.free_stamp) : null;
        if (freeTimes !== null && isNaN(freeTimes)) freeTimes = null;
        if (freeStamp !== null && isNaN(freeStamp)) freeStamp = null;
        updateFishPearlFreeCache(freeTimes, freeStamp);
        if (CONFIG.DEBUG) {
          logDebug(
            "🎁 珍珠池(" +
              (tag || "读取") +
              "): free_times=" +
              (freeTimes !== null ? freeTimes : "未知") +
              " free_stamp=" +
              (freeStamp !== null ? freeStamp : "未知")
          );
        }
        return { freeTimes: freeTimes, freeStamp: freeStamp, raw: json };
      })
      .catch(function (e) {
        if (CONFIG.DEBUG) logDebug("🎁 珍珠池(" + (tag || "读取") + ")失败: " + e);
        return null;
      });
  });
}

function shouldRunFishPearlDraw() {
  if (!CONFIG.FISH_PEARL_DRAW_DAILY) return false;
  if (IS_NODE && !CONFIG.FISH_PEARL_DRAW_NODE) return false;
  return true;
}

function formatTsLocal(ts) {
  var n = Number(ts || 0);
  if (!n || isNaN(n) || n < 1000000000) return "";
  var d = new Date(n * 1000);
  var hh = d.getHours();
  var mm = d.getMinutes();
  var ss = d.getSeconds();
  return (
    (hh < 10 ? "0" + hh : "" + hh) +
    ":" +
    (mm < 10 ? "0" + mm : "" + mm) +
    ":" +
    (ss < 10 ? "0" + ss : "" + ss)
  );
}

function formatWaitSec(sec) {
  var n = Number(sec || 0);
  if (!n || isNaN(n) || n <= 0) return "0秒";
  var m = Math.floor(n / 60);
  var s = n % 60;
  if (m > 0) return m + "分" + s + "秒";
  return s + "秒";
}

function runFishPearlDrawDaily(cookie) {
  if (!shouldRunFishPearlDraw()) {
    if (IS_NODE && CONFIG.DEBUG && CONFIG.FISH_PEARL_DRAW_DAILY && !CONFIG.FISH_PEARL_DRAW_NODE) {
      logDebug("🎁 珍珠抽奖: Node 默认关闭");
    }
    return Promise.resolve(false);
  }
  var today = localDateKey();
  var oldDay = $.read(STORE_KEY_FISH_PEARL_DAY) || "";
  if (oldDay !== today) {
    $.write(today, STORE_KEY_FISH_PEARL_DAY);
    $.write("", STORE_KEY_FISH_PEARL_FREE_TIMES);
    $.write("", STORE_KEY_FISH_PEARL_FREE_STAMP);
    if (CONFIG.DEBUG) logDebug("🎁 珍珠抽奖: 新的一天，已重置日计数(" + today + ")");
  }

  var beforePearl = null;
  var afterPearl = null;
  var latestFreeTimes = null;
  var latestFreeStamp = null;
  var pieceState = null;
  var cooldownHint = null;
  return ensureFishJsonContext(cookie)
    .then(function (ctx) {
      var uIdx = ctx.uIdx || "";
      var uinY = ctx.uinY || "";
      if (!uIdx || !uinY) {
        log("⚠️ 珍珠抽奖: 缺少 uIdx/uinY，跳过");
        return { skip: true, reason: "ctx-missing" };
      }
      return fetchFishPieceState(cookie, "抽奖前").then(function (piece) {
        pieceState = piece;
        if (piece) {
          latestFreeTimes = piece.freeTimes;
          latestFreeStamp = piece.freeStamp;
        }
        // free_times 是“今日已免费抽次数”，达到 5 表示当天免费额度用完
        if (piece && piece.freeTimes !== null && piece.freeTimes >= 5) {
          var tail = [];
          if (piece.freeStamp !== null && piece.freeStamp !== undefined) tail.push("free_stamp=" + piece.freeStamp);
          return { skip: true, reason: "free-limit", extra: tail.join(" ") };
        }
        // free_stamp 仅作提示，不作为硬门槛；是否可抽以 gift 接口返回为准。
        if (
          piece &&
          piece.freeStamp !== null &&
          piece.freeStamp !== undefined &&
          Number(piece.freeStamp) > 1000000000
        ) {
          var now = getFarmTime();
          var waitSec = Number(piece.freeStamp) - now;
          if (waitSec > 0) {
            cooldownHint = { freeStamp: Number(piece.freeStamp), waitSec: waitSec };
          }
        }
        return { skip: false, uIdx: uIdx, uinY: uinY };
      });
    })
    .then(function (meta) {
      if (!meta || meta.skip) {
        if (meta && meta.reason === "free-limit") {
          log("🎁 珍珠抽奖: 今日免费次数已用完，跳过" + (meta.extra ? " (" + meta.extra + ")" : ""));
        }
        return false;
      }
      if (cooldownHint && CONFIG.DEBUG) {
        var when2 = formatTsLocal(cooldownHint.freeStamp);
        logDebug(
          "🎁 珍珠抽奖预判: 可能仍在冷却(剩余" +
            formatWaitSec(cooldownHint.waitSec) +
            (when2 ? "，约 " + when2 : "") +
            ")，继续实测 gift 接口"
        );
      }
      return fetchFishIndexJsonState(cookie, "珍珠抽奖前")
        .then(function (st) {
          if (st && st.pearl !== null && st.pearl !== undefined) beforePearl = st.pearl;
          var params = {
            uinY: meta.uinY,
            uIdx: meta.uIdx,
            type: 1,
            farmTime: getFarmTime(),
            platform: CONFIG.FARM_PLATFORM || "13",
            appid: CONFIG.FARM_APPID || "353",
            version: CONFIG.FARM_VERSION || "4.0.20.0"
          };
          if (CONFIG.FISH_PEARL_DRAW_FORCE_FREE) params.free = 1;
          var url = (CONFIG.FARM_JSON_BASE || "https://nc.qzone.qq.com") + "/cgi-bin/cgi_fish_pearl_gift";
          return httpRequest({
            method: "POST",
            url: url,
            headers: buildFishJsonHeaders(cookie),
            body: buildLegacyBody(params)
          }).then(function (resp) {
            var json = tryJson(resp.body);
            if (!json) {
              log("⚠️ 珍珠抽奖: 响应非 JSON");
              return false;
            }
            if (json.free_times != null && json.free_times !== "") {
              var ft = Number(json.free_times);
              if (!isNaN(ft)) latestFreeTimes = ft;
            }
            if (json.free_stamp != null && json.free_stamp !== "") {
              var fs = Number(json.free_stamp);
              if (!isNaN(fs)) latestFreeStamp = fs;
            }
            updateFishPearlFreeCache(
              json.free_times != null ? json.free_times : "",
              json.free_stamp != null ? json.free_stamp : ""
            );
            var ok = Number(json.ret) === 0 && Number(json.ecode || 0) === 0;
            var pkg = parseFishPearlPkg(json.pkg, json.itemTip || json.item_tip || "");
            var tip = pkg ? " 奖励[" + pkg + "]" : "";
            if (ok) {
              FISH_STATS.pearlDraw += 1;
              if (pkg) FISH_STATS.pearlGain = pkg;
              log("🎁 珍珠抽奖: 已执行" + tip);
            } else {
              var msg = json.direction || json.msg || json.message || ("ret=" + json.ret + " ecode=" + json.ecode);
              if (/免费抽取时间还没有到/.test(msg)) {
                var wait2 = "";
                if (json.free_stamp != null && Number(json.free_stamp) > 1000000000) {
                  var now2 = getFarmTime();
                  var sec2 = Number(json.free_stamp) - now2;
                  if (sec2 > 0) {
                    var when3 = formatTsLocal(Number(json.free_stamp));
                    wait2 =
                      " (剩余" + formatWaitSec(sec2) + (when3 ? "，约 " + when3 : "") + ")";
                  }
                }
                log("🎁 珍珠抽奖: 免费冷却中，未执行" + wait2);
              } else {
                log("⚠️ 珍珠抽奖失败: " + msg);
              }
            }
            if (json.free_times != null || json.free_stamp != null) {
              logDebug(
                "🎁 珍珠抽奖状态: free_times=" +
                  (json.free_times != null ? json.free_times : "未知") +
                  " free_stamp=" +
                  (json.free_stamp != null ? json.free_stamp : "未知")
              );
            }
            return ok;
          });
        })
        .then(function (ok) {
          if (!ok) return false;
          return fetchFishIndexJsonState(cookie, "珍珠抽奖后").then(function (st2) {
            if (st2 && st2.pearl !== null && st2.pearl !== undefined) afterPearl = st2.pearl;
            return true;
          });
        });
    })
    .then(function (ok) {
      if (!ok) return false;
      if (beforePearl !== null && afterPearl !== null) {
        var delta = afterPearl - beforePearl;
        if (delta < 0) {
          FISH_STATS.pearlSpend += -delta;
          log("⚠️ 珍珠抽奖: 珍珠变化 " + beforePearl + "→" + afterPearl + " (Δ" + delta + ")");
        } else {
          log("🎁 珍珠抽奖: 珍珠变化 " + beforePearl + "→" + afterPearl + " (Δ+" + delta + ")");
        }
      }
      $.write(today, STORE_KEY_FISH_PEARL_DAY);
      if (latestFreeTimes !== null || latestFreeStamp !== null || pieceState) {
        logDebug(
          "🎁 珍珠抽奖缓存: free_times=" +
            (latestFreeTimes !== null ? latestFreeTimes : "未知") +
            " free_stamp=" +
            (latestFreeStamp !== null ? latestFreeStamp : "未知")
        );
      }
      return true;
    })
    .catch(function (e) {
      log("⚠️ 珍珠抽奖异常: " + e);
      return false;
    });
}

function extractFishEntryLink(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var m = h.match(/wap_(?:farm_)?fish_index\?[^\"'>]*/);
  if (m) return m[0].replace(/\s+/g, "");
  m = h.match(/fish_index\?[^\"'>]*/);
  return m ? m[0].replace(/\s+/g, "") : "";
}

function isContinuePage(html) {
  var text = stripTags(html || "");
  return /继续访问触屏版|继续访问|立即进入|跳转|redirect/i.test(text);
}

function isFishPage(html) {
  var text = stripTags(html || "");
  return /鱼塘|鱼池|池塘|鱼苗|鱼食/.test(text);
}

function isFarmHome(html) {
  var text = stripTags(html || "");
  return (
    text.indexOf("我的土地") >= 0 ||
    text.indexOf("【我的土地】") >= 0 ||
    /我\s*的\s*土\s*地/.test(text)
  );
}

function isRanchHome(html) {
  var text = stripTags(html || "");
  return (
    text.indexOf("我的牧场") >= 0 ||
    text.indexOf("牧场动物及产品") >= 0 ||
    /我\s*的\s*牧\s*场/.test(text)
  );
}

function isFishHome(html) {
  var text = stripTags(html || "");
  return /我的池塘|我的鱼塘|鱼塘|鱼池|我\s*的\s*池\s*塘|我\s*的\s*鱼\s*塘/.test(text);
}

function extractTitle(html) {
  if (!html) return "";
  var m = html.match(/<title>([^<]+)<\/title>/i);
  return m ? m[1] : "";
}

function extractFishSeedIds(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var ids = {};
  var re = /fid=([0-9]+)/g;
  var m;
  while ((m = re.exec(h))) {
    ids[m[1]] = true;
  }
  return Object.keys(ids);
}

function parseBagItems(html) {
  var h = (html || "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ");
  var items = [];
  var re = /<p>\s*([^<]*?)\s*[×x]\s*([0-9]+)\s*<\/p>/g;
  var m;
  while ((m = re.exec(h))) {
    var name = (m[1] || "").replace(/\s+/g, " ").trim();
    var cnt = parseInt(m[2], 10);
    if (!name || isNaN(cnt)) continue;
    if (name.indexOf("第") === 0 || name.indexOf("回") === 0) continue;
    items.push({ name: name, count: cnt });
  }
  if (items.length > 0) return items;
  var text = stripTags(h).replace(/\s+/g, " ");
  var seg = text;
  var mark = "【我的背包】";
  if (seg.indexOf(mark) >= 0) seg = seg.split(mark)[1];
  var endMarks = ["下页", "回农场首页", "道具", "商店", "仓库", "背包", "扩建", "客服", "去我的牧场"];
  var cut = seg.length;
  for (var i = 0; i < endMarks.length; i++) {
    var p = seg.indexOf(endMarks[i]);
    if (p >= 0 && p < cut) cut = p;
  }
  seg = seg.substring(0, cut);
  var re2 = /([^\s×x]+)\s*[×x]\s*([0-9]+)/g;
  while ((m = re2.exec(seg))) {
    var n = normalizeSpace(m[1]);
    var c = parseInt(m[2], 10);
    if (!n || isNaN(c)) continue;
    if (/^第\d+\/\d+页/.test(n)) continue;
    if (n.indexOf("页") >= 0 || n.indexOf("到") >= 0) continue;
    items.push({ name: n, count: c });
  }
  return items;
}

function parseWarehouseItemCount(html, name) {
  if (!html || !name) return null;
  var text = stripTags(html || "").replace(/\s+/g, " ");
  if (!text) return null;
  // 常见仓库展示：牧草(6金币/个):347个 / 牧草(6金币/个)：347个
  // 需要兼容英文冒号与全角冒号，同时避免误取“单价”里的数字。
  var re = new RegExp(name + "[^:：]{0,120}[:：]\\s*([0-9]+)\\s*个");
  var m = text.match(re);
  if (m) return parseInt(m[1], 10);
  m = text.match(new RegExp(name + "[^0-9]{0,10}([0-9]+)\\s*个"));
  if (m) return parseInt(m[1], 10);
  m = text.match(new RegExp(name + "\\s*[×x]\\s*([0-9]+)"));
  if (m) return parseInt(m[1], 10);
  return null;
}

function fetchFarmWarehouseGrass(cookie) {
  var base = CONFIG.FARM_WAP_BASE;
  var sid = CONFIG.RANCH_SID;
  var g_ut = getFarmGut();
  var baseUrl = base + "/nc/cgi-bin/wap_farm_rep_list?sid=" + sid + "&g_ut=" + g_ut;
  var curCookie = cookie;
  var total = 0;
  var found = false;

  function buildUrl(page) {
    if (!page || page <= 1) return baseUrl;
    return baseUrl + "&page=" + page;
  }

  function fetchPage(page) {
    return getHtmlFollow(buildUrl(page), curCookie, null, "仓库", 0).then(function (ret) {
      if (ret.cookie) curCookie = ret.cookie;
      var html = ret.body || "";
      var count = parseWarehouseItemCount(html, "牧草");
      if (count !== null) {
        total += count;
        found = true;
      }
      var info = parseBagPageInfo(html);
      return { info: info };
    });
  }

  return fetchPage(1)
    .then(function (ret) {
      var totalPage = ret.info.total || 1;
      var cur = ret.info.page || 1;
      if (totalPage <= 1) return;
      var p = Promise.resolve();
      var max = totalPage;
      for (var page = cur + 1; page <= max; page++) {
        (function (pno) {
          p = p.then(function () {
            return fetchPage(pno);
          }).then(function () {
            return sleep(CONFIG.WAIT_MS);
          });
        })(page);
      }
      return p;
    })
    .then(function () {
      return found ? total : null;
    })
    .catch(function (e) {
      if (CONFIG.LOG_BAG_STATS) log("🎒 仓库读取失败: " + e);
      return null;
    });
}

function parseCommonStats(html) {
  var text = stripTags(html || "").replace(/\s+/g, " ");
  var level = null;
  var money = null;
  var expCur = null;
  var expTotal = null;
  var m;
  m = text.match(/等级[:：]?\s*([0-9]+)/);
  if (m) level = parseInt(m[1], 10);
  m = text.match(/金币[:：]?\s*([0-9]+)/);
  if (m) money = parseInt(m[1], 10);
  m = text.match(/经验[:：]?\s*([0-9]+)\s*\/\s*([0-9]+)/);
  if (m) {
    expCur = parseInt(m[1], 10);
    expTotal = parseInt(m[2], 10);
  }
  if (level === null && money === null && expCur === null) return null;
  return { level: level, money: money, expCur: expCur, expTotal: expTotal };
}

function normalizeSpace(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function landCropId(land) {
  if (!land) return "";
  if (land.c !== undefined && land.c !== null && land.c !== "" && Number(land.c) > 0) return String(land.c);
  if (land.a !== undefined && land.a !== null && land.a !== "" && Number(land.a) > 0) return String(land.a);
  return "";
}

function recordCropName(cid, name) {
  if (!cid || !name) return;
  var key = String(cid);
  var nm = normalizeSpace(name);
  if (!nm) return;
  if (/^作物#?\d+$/i.test(nm)) return;
  if (!CROP_NAME_MAP[key] || /^cId\d+/.test(CROP_NAME_MAP[key])) CROP_NAME_MAP[key] = nm;
}

function getCropNameByCid(cid) {
  if (!cid) return "";
  var key = String(cid);
  return CROP_NAME_MAP[key] || ("cId" + key);
}

function normalizeCropName(name) {
  var nm = normalizeSpace(name || "");
  if (!nm) return "";
  nm = nm.replace(/^【\s*锁\s*】\s*/g, "");
  return normalizeSpace(nm);
}

function buildCropNameSet(raw) {
  var set = {};
  var arr = ensureArray(raw);
  for (var i = 0; i < arr.length; i++) {
    var nm = normalizeCropName(arr[i]);
    if (nm) set[nm] = true;
  }
  return set;
}

function buildCropPrefixList(raw) {
  var arr = ensureArray(raw);
  var out = [];
  var seen = {};
  for (var i = 0; i < arr.length; i++) {
    var p = normalizeCropName(arr[i]);
    if (!p || seen[p]) continue;
    seen[p] = true;
    out.push(p);
  }
  return out;
}

function cropNameHitPrefix(name, prefixes) {
  var nm = normalizeCropName(name);
  if (!nm) return "";
  var arr = ensureArray(prefixes);
  for (var i = 0; i < arr.length; i++) {
    var p = normalizeCropName(arr[i]);
    if (!p) continue;
    if (nm === p) return p;
    if (nm.indexOf(p + "-") === 0) return p;
    if (nm.indexOf(p + "－") === 0) return p;
    if (nm.indexOf(p + "—") === 0) return p;
    if (nm.indexOf(p) === 0) return p;
  }
  return "";
}

function isTimeFarmKeywordCrop(name) {
  var nm = normalizeCropName(name);
  if (!nm) return false;
  var kw = String(CONFIG.FARM_SELL_PROTECT_TIME_KEYWORDS || "");
  if (!kw) return false;
  var re = null;
  try {
    re = new RegExp(kw);
  } catch (_) {
    return false;
  }
  return re.test(nm);
}

function isFarmProtectedCropForSell(name, cid) {
  if (!CONFIG.FARM_SELL_PROTECT_ENABLE) return "";
  var key = cid != null && cid !== "" ? String(cid) : "";
  var names = [];
  var seen = {};
  function addName(v) {
    var nm = normalizeCropName(v);
    if (!nm || seen[nm]) return;
    seen[nm] = true;
    names.push(nm);
  }
  addName(name);
  if (key) {
    addName(CROP_NAME_MAP[key] || "");
    addName(TIME_FARM_SPECIAL_SEED_MAP[key] || "");
    addName(getCropNameByCid(key));
  }

  var exactSet = buildCropNameSet(CONFIG.FARM_SELL_PROTECT_NAMES);
  for (var i = 0; i < names.length; i++) {
    if (exactSet[names[i]]) return "名单";
  }

  var prefixes = buildCropPrefixList(CONFIG.FARM_SELL_PROTECT_PREFIXES);
  for (var j = 0; j < names.length; j++) {
    var hit = cropNameHitPrefix(names[j], prefixes);
    if (hit) return "节气前缀(" + hit + ")";
  }

  if (key && TIME_FARM_SPECIAL_SEED_MAP[key]) return "时光映射";
  for (var k = 0; k < names.length; k++) {
    if (isTimeFarmKeywordCrop(names[k])) return "时光关键字";
  }
  return "";
}

function formatProtectedCropList(items, limit) {
  var arr = ensureArray(items);
  if (!arr.length) return "";
  var max = Number(limit || 4);
  if (isNaN(max) || max <= 0) max = 4;
  var out = [];
  for (var i = 0; i < arr.length; i++) {
    var it = arr[i] || {};
    var nm = normalizeCropName(it.name || (it.cid ? getCropNameByCid(it.cid) : ""));
    var cid = it.cid != null && it.cid !== "" ? String(it.cid) : "";
    var reason = normalizeSpace(it.reason || "");
    if (!nm) nm = cid ? "cId" + cid : "作物";
    var part = nm;
    if (cid) part += "(cId=" + cid + ")";
    if (reason) part += ":" + reason;
    out.push(part);
    if (out.length >= max) break;
  }
  if (arr.length > out.length) out.push("+" + (arr.length - out.length));
  return out.join("；");
}

function setFarmPlaceNameFromStatus(list) {
  if (!list || !list.length) return;
  for (var i = 0; i < list.length; i++) {
    var it = list[i] || {};
    if (it.idx == null) continue;
    var place = Number(it.idx) - 1;
    if (isNaN(place) || place < 0) continue;
    if (it.name) FARM_PLACE_NAME[place] = it.name;
  }
}

function getPlaceCropName(place) {
  var p = Number(place);
  if (isNaN(p)) return "";
  if (FARM_PLACE_CID[p]) return getCropNameByCid(FARM_PLACE_CID[p]);
  if (FARM_PLACE_NAME[p]) return FARM_PLACE_NAME[p];
  return "";
}

function harvestDisplayName(name) {
  var nm = normalizeSpace(name || "");
  if (!nm) return "";
  if (nm === "空地" || nm === "锁地") return "";
  if (nm === "作物") return nm;
  var m = nm.match(/^cId(\d+)$/i);
  if (m) {
    var cid = m[1];
    var mapped = CROP_NAME_MAP[cid];
    if (mapped && !/^cId\d+$/i.test(mapped)) return mapped;
    return "作物";
  }
  var m2 = nm.match(/cId(\d+)/i);
  if (m2) {
    var cid2 = m2[1];
    var mapped2 = CROP_NAME_MAP[cid2];
    if (mapped2 && !/^cId\d+$/i.test(mapped2)) return mapped2;
    return "作物";
  }
  return nm;
}

function recordHarvestByName(name, count) {
  if (!count || count <= 0) return;
  var nm = normalizeSpace(name || "");
  if (!nm || nm === "空地" || nm === "锁地") return;
  if (!HARVEST_DETAIL.byName[nm]) HARVEST_DETAIL.byName[nm] = 0;
  HARVEST_DETAIL.byName[nm] += count;
  HARVEST_DETAIL.total += count;
}

function parseHarvestDetailFromMsg(msg) {
  if (!msg) return [];
  var text = stripTags(String(msg)).replace(/\s+/g, " ").trim();
  if (!text) return [];
  var list = [];
  var m;
  var re1 = /收获了?\s*([0-9]+)\s*个\s*([^\s，。,.]+)/g;
  while ((m = re1.exec(text))) {
    var n1 = Number(m[1] || 0);
    var name1 = normalizeSpace(m[2] || "");
    if (!n1 || !name1) continue;
    if (/^(金币|经验|点券|经验值|积分|贡献|人气)$/.test(name1)) continue;
    list.push({ name: name1, count: n1 });
  }
  var re2 = /([^\s，。,.]+)\s*[×xX]\s*([0-9]+)/g;
  while ((m = re2.exec(text))) {
    var n2 = Number(m[2] || 0);
    var name2 = normalizeSpace(m[1] || "");
    if (!n2 || !name2) continue;
    if (/^(金币|经验|点券|经验值|积分|贡献|人气)$/.test(name2)) continue;
    list.push({ name: name2, count: n2 });
  }
  return list;
}

function recordHarvestDetail(ret, place) {
  if (!ret || !ret.count || ret.count <= 0) return;
  var details = parseHarvestDetailFromMsg(ret.msg);
  if (details.length) {
    for (var i = 0; i < details.length; i++) {
      recordHarvestByName(details[i].name, details[i].count);
    }
    return;
  }
  var name = getPlaceCropName(place) || "作物";
  recordHarvestByName(name, ret.count);
}

function buildHarvestDetailLine(limit) {
  var map = {};
  for (var k in HARVEST_DETAIL.byName) {
    if (!HARVEST_DETAIL.byName.hasOwnProperty(k)) continue;
    var name = harvestDisplayName(k);
    var cnt = HARVEST_DETAIL.byName[k] || 0;
    if (!name || !cnt) continue;
    if (!map[name]) map[name] = 0;
    map[name] += cnt;
  }
  var items = [];
  for (var n in map) {
    if (!map.hasOwnProperty(n)) continue;
    items.push({ name: n, count: map[n] });
  }
  if (!items.length) return "";
  items.sort(function (a, b) {
    return b.count - a.count;
  });
  var max = limit || 6;
  var show = items.slice(0, max);
  var parts = [];
  for (var i = 0; i < show.length; i++) {
    parts.push(show[i].name + "×" + show[i].count);
  }
  if (items.length > show.length) parts.push("…+" + (items.length - show.length));
  return parts.join("，");
}

function getHarvestTypeCount() {
  var seen = {};
  var n = 0;
  for (var k in HARVEST_DETAIL.byName) {
    if (!HARVEST_DETAIL.byName.hasOwnProperty(k)) continue;
    var name = harvestDisplayName(k);
    if (!name || seen[name]) continue;
    seen[name] = true;
    n += 1;
  }
  return n;
}

function recordWitheredTry(n) {
  var inc = typeof n === "number" ? n : 1;
  if (!inc || isNaN(inc)) inc = 1;
  FARM_DETAIL.witheredTry += inc;
}

function recordWitheredClear(n) {
  var inc = typeof n === "number" ? n : 1;
  if (!inc || isNaN(inc)) inc = 1;
  FARM_DETAIL.witheredClear += inc;
}

function formatWitheredRecon(startList, endList) {
  var s = summarizeFarmStatusCounts(startList).withered;
  var e = summarizeFarmStatusCounts(endList).withered;
  if (!s && !e && !FARM_DETAIL.witheredTry && !FARM_DETAIL.witheredClear) return "";
  var delta = e - s;
  var line = "开始" + s;
  if (FARM_DETAIL.witheredTry || FARM_DETAIL.witheredClear) {
    line += " → 铲除成功" + FARM_DETAIL.witheredClear + "  (尝试" + FARM_DETAIL.witheredTry + ")";
  }
  line += " → 结束" + e + " （Δ" + formatDelta(delta) + "）";
  return line;
}

function formatEmptyPlantRecon(startList, endList) {
  var s = summarizeFarmStatusCounts(startList).empty;
  var e = summarizeFarmStatusCounts(endList).empty;
  if (!s && !e && !PLANT_STATS.total) return "";
  var delta = e - s;
  var line = "开始" + s;
  if (PLANT_STATS.total) line += " → 播种成功" + PLANT_STATS.total;
  line += " → 结束" + e + " （Δ" + formatDelta(delta) + "）";
  return line;
}

function formatFarmMaintainSum() {
  var total = ACTION_STATS.clearWeed + ACTION_STATS.spraying + ACTION_STATS.water;
  if (!total && !ACTION_STATS.clearWeed && !ACTION_STATS.spraying && !ACTION_STATS.water) return "";
  return (
    total +
    " (草" +
    ACTION_STATS.clearWeed +
    " 虫" +
    ACTION_STATS.spraying +
    " 水" +
    ACTION_STATS.water +
    ")"
  );
}

function formatRanchOpsSum() {
  var total = RANCH_STATS.harvest + RANCH_STATS.product + RANCH_STATS.feed + RANCH_STATS.help;
  var hasUnknown = RANCH_STATS.harvestUnknown > 0;
  if (!total && !hasUnknown) return "";
  var line =
    "收" +
    formatCountWithUnknown(RANCH_STATS.harvest, RANCH_STATS.harvestUnknown) +
    " 产" +
    RANCH_STATS.product +
    " 喂" +
    RANCH_STATS.feed +
    " 清" +
    RANCH_STATS.help +
    " 合计" +
    total;
  return line;
}

function formatFishComposeItems(limit) {
  var map = FISH_STATS.composeByName || {};
  var items = [];
  for (var k in map) {
    if (!map.hasOwnProperty(k)) continue;
    var n = Number(map[k] || 0);
    if (!n || isNaN(n) || n <= 0) continue;
    items.push({ name: k, count: n });
  }
  if (!items.length) return "";
  items.sort(function (a, b) {
    if (b.count !== a.count) return b.count - a.count;
    return a.name > b.name ? 1 : -1;
  });
  var max = Number(limit || 0);
  if (!max || isNaN(max) || max <= 0) max = items.length;
  var show = items.slice(0, max);
  var parts = [];
  for (var i = 0; i < show.length; i++) {
    parts.push(show[i].name + "×" + show[i].count);
  }
  if (items.length > show.length) parts.push("…+" + (items.length - show.length));
  return parts.join("；");
}

function recordFishCompose(name, count) {
  var nm = normalizeSpace(name || "鱼苗");
  var c = Number(count || 0);
  if (!c || isNaN(c) || c <= 0) return;
  FISH_STATS.compose += c;
  if (!FISH_STATS.composeByName) FISH_STATS.composeByName = {};
  if (!FISH_STATS.composeByName[nm]) FISH_STATS.composeByName[nm] = 0;
  FISH_STATS.composeByName[nm] += c;
}

function formatFishOpsSum() {
  var total =
    FISH_STATS.feed + FISH_STATS.harvest + FISH_STATS.plant + FISH_STATS.buy + FISH_STATS.sell + FISH_STATS.compose;
  if (!total && !FISH_STATS.pearlDraw && !FISH_STATS.pearlSpend && !FISH_STATS.pearlGain) return "";
  var base =
    "喂" +
    FISH_STATS.feed +
    " 收" +
    FISH_STATS.harvest +
    " 下" +
    FISH_STATS.plant +
    " 买" +
    FISH_STATS.buy +
    " 卖" +
    FISH_STATS.sell +
    " 合" +
    FISH_STATS.compose +
    " 合计" +
    total;
  var composeDetail = formatFishComposeItems(6);
  if (composeDetail) base += " 合成[" + composeDetail + "]";
  if (FISH_STATS.pearlDraw) base += " 抽" + FISH_STATS.pearlDraw;
  if (FISH_STATS.pearlSpend) base += " 扣珠" + FISH_STATS.pearlSpend;
  if (FISH_STATS.pearlGain) base += " 奖励[" + FISH_STATS.pearlGain + "]";
  return base;
}

function recordPlantFail(kind, n) {
  var inc = typeof n === "number" ? n : 1;
  if (!inc || isNaN(inc)) inc = 1;
  if (kind === "noLand") PLANT_FAIL.noLand += inc;
  else if (kind === "seedLack") PLANT_FAIL.seedLack += inc;
  else if (kind === "landLimit") PLANT_FAIL.landLimit += inc;
}

function buildPlantFailLine() {
  var parts = [];
  if (PLANT_FAIL.seedLack) parts.push("种子不足" + PLANT_FAIL.seedLack);
  if (PLANT_FAIL.landLimit) parts.push("土地限制" + PLANT_FAIL.landLimit);
  return parts.length ? parts.join(" ") : "";
}

function buildPlantSkipLine() {
  var parts = [];
  if (PLANT_FAIL.noLand) parts.push("无空地" + PLANT_FAIL.noLand);
  return parts.length ? parts.join(" ") : "";
}

function groupStatusItems(list) {
  function displayStatusName(name) {
    var nm = normalizeSpace(name || "");
    if (!nm) return "";
    var m = nm.match(/^cId(\d+)$/i);
    if (m) {
      var cid = m[1];
      var mapped = CROP_NAME_MAP[cid];
      if (mapped && !/^cId\d+$/i.test(mapped)) return mapped;
      if (String(CONFIG.FARM_GRASS_SEED_ID || "40") === String(cid)) return "牧草";
      return "作物";
    }
    var m2 = nm.match(/cId(\d+)/i);
    if (m2) {
      var cid2 = m2[1];
      var mapped2 = CROP_NAME_MAP[cid2];
      if (mapped2 && !/^cId\d+$/i.test(mapped2)) return mapped2;
      if (String(CONFIG.FARM_GRASS_SEED_ID || "40") === String(cid2)) return "牧草";
      return nm.replace(/cId\d+/gi, "作物");
    }
    return nm;
  }

  var map = {};
  for (var i = 0; i < list.length; i++) {
    var it = list[i];
    if (!it || !it.name) continue;
    var name = displayStatusName(it.name);
    if (!name) continue;
    var status = normalizeSpace(it.status || "");
    var key = name + (status ? "(" + status + ")" : "");
    map[key] = (map[key] || 0) + 1;
  }
  var out = [];
  for (var k in map) {
    if (!map.hasOwnProperty(k)) continue;
    out.push(k + "×" + map[k]);
  }
  return out;
}

function countStatusItems(list) {
  if (!list || !list.length) return 0;
  return list.length;
}

function summarizeFarmStatusCounts(list) {
  var sum = { total: 0, locked: 0, empty: 0, withered: 0, mature: 0, growing: 0, other: 0 };
  if (!list || !list.length) return sum;
  for (var i = 0; i < list.length; i++) {
    var it = list[i] || {};
    var status = normalizeSpace(it.status || "");
    var name = normalizeSpace(it.name || "");
    sum.total += 1;
    if (/锁/.test(status) || /锁/.test(name)) {
      sum.locked += 1;
      continue;
    }
    if (/未播种|空地|未种植/.test(status) || /空地/.test(name)) {
      sum.empty += 1;
      continue;
    }
    if (/枯萎/.test(status)) {
      sum.withered += 1;
      continue;
    }
    if (/成熟|可收|待收|已成熟/.test(status)) {
      sum.mature += 1;
      continue;
    }
    if (/幼苗|成长|开花|发芽|成株|初熟|种子|休眠/.test(status)) {
      sum.growing += 1;
      continue;
    }
    sum.other += 1;
  }
  return sum;
}

function countHarvestableFromStatus(list) {
  if (!list || !list.length) return 0;
  var n = 0;
  for (var i = 0; i < list.length; i++) {
    var it = list[i] || {};
    var status = normalizeSpace(it.status || "");
    if (!status) continue;
    if (/成熟|可收|待收|已成熟/.test(status) && !/枯萎/.test(status)) n += 1;
  }
  return n;
}

function formatFarmStatusCounts(label, list) {
  var sum = summarizeFarmStatusCounts(list);
  var out =
    (label || "") +
    "总" +
    sum.total +
    " 锁" +
    sum.locked +
    " 空" +
    sum.empty +
    " 枯" +
    sum.withered +
    " 熟" +
    sum.mature;
  if (sum.growing) out += " 长" + sum.growing;
  if (sum.other) out += " 其" + sum.other;
  return out;
}

function formatFarmStatusCountsNoLock(label, list) {
  if (!list || !list.length) return (label || "") + "未知";
  var sum = summarizeFarmStatusCounts(list);
  var out =
    (label || "") +
    "总" +
    sum.total +
    " 空" +
    sum.empty +
    " 枯" +
    sum.withered +
    " 熟" +
    sum.mature;
  if (sum.growing) out += " 长" + sum.growing;
  if (sum.other) out += " 其" + sum.other;
  return out;
}

function formatFarmStatusLine(list) {
  if (!list || !list.length) return "未知";
  return formatStatusLine("", list).replace(/^:\s*/, "");
}

function formatFarmStatusDelta(startList, endList, includeLock) {
  var s = summarizeFarmStatusCounts(startList);
  var e = summarizeFarmStatusCounts(endList);
  if (!s.total && !e.total) return "";
  var parts = [];
  function add(label, val) {
    if (!val) return;
    parts.push(label + formatDelta(val));
  }
  if (includeLock !== false) add("锁", e.locked - s.locked);
  add("空", e.empty - s.empty);
  add("枯", e.withered - s.withered);
  add("熟", e.mature - s.mature);
  add("长", e.growing - s.growing);
  add("其", e.other - s.other);
  if (!parts.length) return "无变化";
  return parts.join(" ");
}

function formatHarvestableDelta(startList, endList) {
  var s = countHarvestableFromStatus(startList);
  var e = countHarvestableFromStatus(endList);
  if (!s && !e) return "";
  return "可收地块: 开始" + s + " 结束" + e + " Δ" + formatDelta(e - s);
}

function parseFarmStatus(html) {
  var list = [];
  if (!html) return list;
  var blockRe = /<div[^>]*class="[^"]*border-btm[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  var m;
  while ((m = blockRe.exec(html))) {
    if (m[1].indexOf("土地") === -1) continue;
    var ps = m[1].match(/<p[^>]*class="tabs-1"[^>]*>[\s\S]*?<\/p>/gi);
    if (!ps || ps.length < 2) continue;
    var title = stripTags(ps[0]).replace(/\s+/g, " ").trim();
    var idxNum = null;
    var idxMatch = title.match(/^\s*(\d+)\./);
    if (!idxMatch) idxMatch = title.match(/土地\s*([0-9]+)/);
    if (idxMatch) idxNum = parseInt(idxMatch[1], 10);
    if (title.indexOf("土地") === -1) continue;
    var info = stripTags(ps[1]).replace(/\s+/g, " ").trim();
    var t = title.replace(/^\d+\.\s*/, "");
    t = t.replace(/^\([^)]+\)\s*/, "");
    t = t.replace(/^土地\d+\s*/, "");
    var name = t.replace(/\([^)]*\)/g, "").trim();
    var status = info;
    if (status) {
      status = status
        .replace(/\s*(收获|翻地|播种|除草|除虫|浇水|施肥|铲除|清理|收割|购买|买种子|查看).*$/g, "")
        .trim();
    }
    if (!status) {
      var sm = t.match(/(成熟[^\s]*|枯萎|待收[^\s]*|待收获|幼苗期|成长中|休眠中|未播种|空地|未种植|成熟期)/);
      status = sm ? sm[1] : "";
    }
    if (!name) {
      if (/空地|未播种|未种植/.test(t)) {
        name = "空地";
        if (!status) status = "未播种";
      }
    }
    if (name) list.push({ name: normalizeSpace(name), status: normalizeSpace(status), idx: idxNum });
  }
  if (list.length > 0) return list;
  var text = stripTags(html || "").replace(/（/g, "(").replace(/）/g, ")").replace(/\s+/g, " ");
  var re2 = /土地\s*([0-9]+)\s*([^\s()]+)\s*\(([^)]+)\)/g;
  while ((m = re2.exec(text))) {
    var idx2 = parseInt(m[1], 10);
    list.push({ name: normalizeSpace(m[2]), status: normalizeSpace(m[3]), idx: idx2 });
  }
  if (list.length > 0) {
    var ok = false;
    for (var li = 0; li < list.length; li++) {
      if (/(成熟|枯萎|幼苗|成长|待收|休眠|未播种|空地)/.test(list[li].status || "")) {
        ok = true;
        break;
      }
    }
    if (ok) return list;
    list = [];
  }
  var seg = text;
  var mark = "【我的土地】";
  if (seg.indexOf(mark) >= 0) seg = seg.substring(seg.indexOf(mark) + mark.length);
  var endMarks = ["商店", "仓库", "背包", "扩建", "客服", "去我的牧场", "个人中心"];
  var cut = seg.length;
  for (var i = 0; i < endMarks.length; i++) {
    var p = seg.indexOf(endMarks[i]);
    if (p >= 0 && p < cut) cut = p;
  }
  seg = seg.substring(0, cut);
  var startRe = /\d+\.\s*(?:\([^)]+\)\s*)?土地\d+/g;
  var starts = [];
  while ((m = startRe.exec(seg))) starts.push(m.index);
  for (var si = 0; si < starts.length; si++) {
    var start = starts[si];
    var end = si + 1 < starts.length ? starts[si + 1] : seg.length;
    var line = seg.substring(start, end).trim();
    var idx3 = null;
    var idx3m = line.match(/土地\s*([0-9]+)/);
    if (idx3m) idx3 = parseInt(idx3m[1], 10);
    line = line.replace(/\s*(收获|翻地|播种|除草|杀虫|浇水|施肥|铲除|清理|查看).*$/g, "").trim();
    line = line.replace(/^\d+\.\s*/, "");
    line = line.replace(/^\([^)]+\)\s*/, "");
    line = line.replace(/^土地\d+\s*/, "");
    var name = "";
    var rest = line;
    if (rest.indexOf(" ") >= 0) {
      name = rest.split(" ")[0];
      rest = rest.substring(name.length).trim();
    } else {
      name = rest;
      rest = "";
    }
    rest = rest.replace(/^\([^)]*\)\s*/, "");
    var status = "";
    var sm = rest.match(/(成熟[^\s]*|已成熟|枯萎|幼苗[^\s]*|成长[^\s]*|待收[^\s]*|休眠[^\s]*|未播种|空地)/);
    if (sm) {
      status = rest.substring(rest.indexOf(sm[1]));
    } else {
      status = rest;
    }
    status = status.replace(/\s*(收获|翻地|播种|除草|杀虫|浇水|施肥|铲除|清理|查看).*$/g, "").trim();
    if (!name && /空地|未播种/.test(rest)) {
      name = "空地";
      if (!status) status = "未播种";
    }
    if (name) list.push({ name: normalizeSpace(name), status: normalizeSpace(status), idx: idx3 });
  }
  return list;
}

function parseFishStatus(html) {
  var list = [];
  if (!html) return list;
  var blockRe = /<div[^>]*class="[^"]*border-btm[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  var m;
  while ((m = blockRe.exec(html))) {
    if (m[1].indexOf("鱼") === -1 && m[1].indexOf("龟") === -1) continue;
    var ps = m[1].match(/<p[^>]*class="tabs-1"[^>]*>[\s\S]*?<\/p>/gi);
    if (!ps || ps.length < 2) continue;
    var title = stripTags(ps[0]).replace(/\s+/g, " ").trim();
    if (!/^\d+\./.test(title)) continue;
    var info = stripTags(ps[1]).replace(/\s+/g, " ").trim();
    var t = title.replace(/^\d+\.\s*/, "");
    var name = t.replace(/\([^)]*\)/g, "").trim();
    var ts = t.match(/\(([^)]+)\)/);
    var titleStatus = ts ? ts[1] : "";
    var status = info;
    if (status) {
      status = status.replace(/\s*(喂鱼食|收获|出售|卖出|喂食|放养|查看).*$/g, "").trim();
    }
    if (status && titleStatus && status.indexOf(titleStatus) < 0) {
      status = titleStatus + " " + status;
    }
    if (!status) status = titleStatus;
    if (name) list.push({ name: normalizeSpace(name), status: normalizeSpace(status) });
  }
  if (list.length > 0) return list;
  var text = stripTags(html || "").replace(/（/g, "(").replace(/）/g, ")").replace(/\s+/g, " ");
  var re2 = /\d+\.\s*([^\s()]+)\s*\(([^)]+)\)/g;
  while ((m = re2.exec(text))) {
    list.push({ name: normalizeSpace(m[1]), status: normalizeSpace(m[2]) });
  }
  if (list.length > 0) return list;
  var seg = text;
  var mark = "我的池塘";
  if (seg.indexOf(mark) >= 0) seg = seg.substring(seg.indexOf(mark) + mark.length);
  var endMarks = ["商店", "仓库", "背包", "扩建", "客服", "去我的牧场", "个人中心"];
  var cut = seg.length;
  for (var i = 0; i < endMarks.length; i++) {
    var p = seg.indexOf(endMarks[i]);
    if (p >= 0 && p < cut) cut = p;
  }
  seg = seg.substring(0, cut);
  var startRe = /\d+\.\s*[^\s]+/g;
  var starts = [];
  while ((m = startRe.exec(seg))) starts.push(m.index);
  for (var si = 0; si < starts.length; si++) {
    var start = starts[si];
    var end = si + 1 < starts.length ? starts[si + 1] : seg.length;
    var line = seg.substring(start, end).trim();
    line = line.replace(/\s*(捞鱼|喂鱼食|出售|卖出|放养|查看).*$/g, "").trim();
    line = line.replace(/^\d+\.\s*/, "");
    var name = "";
    var rest = line;
    if (rest.indexOf(" ") >= 0) {
      name = rest.split(" ")[0];
      rest = rest.substring(name.length).trim();
    } else {
      name = rest;
      rest = "";
    }
    rest = rest.replace(/^\([^)]*\)\s*/, "");
    var status = "";
    var sm = rest.match(/(已成熟|成熟[^\s]*|鱼苗期|幼鱼期|成鱼期|休眠[^\s]*|死亡)/);
    if (sm) {
      status = rest.substring(rest.indexOf(sm[1]));
    } else {
      status = rest;
    }
    status = status.replace(/\s*(捞鱼|喂鱼食|出售|卖出|放养|查看).*$/g, "").trim();
    if (name) list.push({ name: normalizeSpace(name), status: normalizeSpace(status) });
  }
  return list;
}

function parseRanchStatus(html) {
  var text = stripTags(html || "").replace(/（/g, "(").replace(/）/g, ")").replace(/\s+/g, " ");
  var list = [];
  var seg = text;
  var marks = ["牧场动物及产品", "可操作的动物及产品", "可操作动物及产品"];
  for (var mi = 0; mi < marks.length; mi++) {
    var mark = marks[mi];
    if (seg.indexOf(mark) >= 0) {
      seg = seg.substring(seg.indexOf(mark) + mark.length);
      break;
    }
  }
  var endMarks = ["商店", "仓库", "背包", "客服", "去我的农场", "去我的餐厅", "跳转", "个人中心"];
  var cut = seg.length;
  for (var i = 0; i < endMarks.length; i++) {
    var p = seg.indexOf(endMarks[i]);
    if (p >= 0 && p < cut) cut = p;
  }
  seg = seg.substring(0, cut);
  var re = /(\d+)\)\s*([^:：\s]+)[:：]\s*([\s\S]*?)(?=\s*\d+\)|$)/g;
  var m;
  while ((m = re.exec(seg))) {
    var name = normalizeSpace(m[2]);
    if (!name || name === "饲料") continue;
    var status = normalizeSpace(m[3])
      .replace(/\s*(喂罐头|喂草|收获|清理|出售|卖出|查看)\s*$/g, "")
      .replace(/\(\(([^)]+)\)\)/g, "($1)")
      .trim();
    if (status.charAt(0) === "(" && status.charAt(status.length - 1) === ")") {
      status = status.substring(1, status.length - 1).trim();
    }
    if (!status) continue;
    list.push({ name: name, status: status, idx: parseInt(m[1], 10) || 0 });
  }
  return list;
}

function isRanchHarvestableStatus(status) {
  var st = normalizeSpace(status || "");
  if (!st) return false;
  if (/待产|休眠|成长|幼崽|幼苗/.test(st)) return false;
  return /(待收|可收获|成熟|收获期|可收)/.test(st);
}

function summarizeRanchHarvestable(list) {
  var out = { total: 0, byName: {} };
  if (!list || list.length === 0) return out;
  for (var i = 0; i < list.length; i++) {
    var it = list[i] || {};
    if (!isRanchHarvestableStatus(it.status)) continue;
    var name = normalizeSpace(it.name || "动物");
    out.total += 1;
    if (!out.byName[name]) out.byName[name] = 0;
    out.byName[name] += 1;
  }
  return out;
}

function parsePastureBagAnimalEntries(html) {
  var h = (html || "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ");
  var list = [];
  var re =
    /([^<\r\n()]+?)\((窝|棚)\)\s*[×xX]\s*([0-9]+)\s*<a[^>]+href="([^"]*wap_pasture_plant_info\?[^"]+)"/gi;
  var m;
  while ((m = re.exec(h))) {
    var name = normalizeSpace(m[1] || "");
    var type = normalizeSpace(m[2] || "");
    var count = Number(m[3] || 0);
    var infoLink = (m[4] || "").replace(/&amp;/g, "&");
    var cid = queryValue(infoLink, "cid");
    var qName = queryValue(infoLink, "name");
    if (!name && qName) name = normalizeSpace(qName);
    if (!name || (type !== "窝" && type !== "棚") || !count || !cid) continue;
    list.push({
      name: name,
      type: type,
      count: count,
      cid: String(cid),
      infoLink: infoLink
    });
  }
  return list;
}

function mergePastureBagAnimals(items) {
  var arr = ensureArray(items);
  if (!arr.length) return [];
  var map = {};
  var out = [];
  for (var i = 0; i < arr.length; i++) {
    var it = arr[i] || {};
    var key = String(it.type || "") + "#" + String(it.cid || "");
    if (!it.type || !it.cid) continue;
    if (!map[key]) {
      map[key] = {
        name: normalizeSpace(it.name || ""),
        type: it.type,
        cid: String(it.cid),
        count: 0,
        infoLink: it.infoLink || ""
      };
      out.push(map[key]);
    }
    map[key].count += Number(it.count || 0) || 0;
    if (!map[key].infoLink && it.infoLink) map[key].infoLink = it.infoLink;
    if (!map[key].name && it.name) map[key].name = normalizeSpace(it.name);
  }
  return out;
}

function fetchPastureBagAnimals(base, cookie, ctx) {
  var sid = (ctx && ctx.sid) || CONFIG.RANCH_SID;
  var g_ut = (ctx && ctx.g_ut) || CONFIG.RANCH_G_UT;
  var baseUrl = base + "/mc/cgi-bin/wap_pasture_bag_list?sid=" + sid + "&g_ut=" + g_ut;
  var all = [];

  function pageUrl(pageNo) {
    if (!pageNo || pageNo <= 1) return baseUrl;
    return baseUrl + "&page=" + pageNo;
  }

  function fetchPage(pageNo) {
    return ranchGet(pageUrl(pageNo), cookie).then(function (html) {
      var list = parsePastureBagAnimalEntries(html);
      if (list.length) all = all.concat(list);
      var info = parseBagPageInfo(html);
      return { html: html, page: info.page || pageNo || 1, total: info.total || 1 };
    });
  }

  return fetchPage(1)
    .then(function (ret) {
      updateRanchSlotState(ctx, ret && ret.html ? ret.html : "");
      var total = Number((ret && ret.total) || 1);
      if (!total || isNaN(total) || total <= 1) return;
      var p = Promise.resolve();
      for (var page = 2; page <= total; page++) {
        (function (pno) {
          p = p.then(function () {
            return sleep(CONFIG.WAIT_MS || 0);
          }).then(function () {
            return fetchPage(pno).then(function (ret2) {
              updateRanchSlotState(ctx, ret2 && ret2.html ? ret2.html : "");
            });
          });
        })(page);
      }
      return p;
    })
    .then(function () {
      return mergePastureBagAnimals(all);
    })
    .catch(function (e) {
      log("⚠️ 牧场背包读取失败: " + errText(e));
      return [];
    });
}

function parsePastureShopAnimalEntries(html) {
  var h = (html || "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ");
  var list = [];
  var re = /<p[^>]*>\s*\d+\)\s*([^<(]+)\(住(窝|棚)[^)]*\)[\s\S]{0,260}?href="([^"]*wap_pasture_buy_pre\?[^"]+)"/gi;
  var m;
  while ((m = re.exec(h))) {
    var name = normalizeSpace(m[1] || "");
    var type = normalizeSpace(m[2] || "");
    var buyPreLink = (m[3] || "").replace(/&amp;/g, "&");
    var cid = queryValue(buyPreLink, "cId");
    if (!name) name = normalizeSpace(queryValue(buyPreLink, "cName"));
    if (!name || (type !== "窝" && type !== "棚") || !cid) continue;
    list.push({
      name: name,
      type: type,
      cid: String(cid),
      lv: queryValue(buyPreLink, "lv") || "",
      flag: queryValue(buyPreLink, "flag") || "0",
      buyPreLink: buyPreLink
    });
  }
  return list;
}

function fetchPastureShopAnimals(base, cookie, ctx, maxPages) {
  var sid = (ctx && ctx.sid) || CONFIG.RANCH_SID;
  var g_ut = (ctx && ctx.g_ut) || CONFIG.RANCH_G_UT;
  var baseUrl = base + "/mc/cgi-bin/wap_pasture_animal_list?sid=" + sid + "&g_ut=" + g_ut;
  var all = [];
  var max = Number(maxPages || 0);
  if (isNaN(max) || max < 0) max = 0;

  function pageUrl(pageNo) {
    if (!pageNo || pageNo <= 1) return baseUrl;
    return baseUrl + "&page=" + pageNo;
  }

  function fetchPage(pageNo) {
    return ranchGet(pageUrl(pageNo), cookie).then(function (html) {
      var list = parsePastureShopAnimalEntries(html);
      if (list.length) all = all.concat(list);
      var info = parseBagPageInfo(html);
      return { html: html, page: info.page || pageNo || 1, total: info.total || 1 };
    });
  }

  return fetchPage(1)
    .then(function (ret) {
      updateRanchSlotState(ctx, ret && ret.html ? ret.html : "");
      var total = Number((ret && ret.total) || 1);
      if (!total || isNaN(total) || total <= 1) return;
      var end = max > 0 ? Math.min(total, max) : total;
      var p = Promise.resolve();
      for (var page = 2; page <= end; page++) {
        (function (pno) {
          p = p.then(function () {
            return sleep(CONFIG.WAIT_MS || 0);
          }).then(function () {
            return fetchPage(pno).then(function (ret2) {
              updateRanchSlotState(ctx, ret2 && ret2.html ? ret2.html : "");
            });
          });
        })(page);
      }
      return p;
    })
    .then(function () {
      return all;
    })
    .catch(function (e) {
      log("⚠️ 牧场商店读取失败: " + errText(e));
      return [];
    });
}

function pasturePostForm(url, body, cookie, referer, label) {
  var activeCookie = preferRicherCookie(cookie, LAST_RANCH_COOKIE);
  var headers = buildRanchHeaders(activeCookie, referer || defaultMcappReferer());
  headers["Content-Type"] = "application/x-www-form-urlencoded";
  return httpRequest({ method: "POST", url: url, headers: headers, body: body })
    .then(function (resp) {
      var merged = mergeSetCookie(activeCookie, getHeader(resp.headers || {}, "set-cookie"));
      LAST_RANCH_COOKIE = preferRicherCookie(merged, LAST_RANCH_COOKIE);
      var html = resp.body || "";
      if (resp.status >= 300 && resp.status < 400) {
        var loc = getHeader(resp.headers || {}, "location") || getHeader(resp.headers || {}, "Location");
        if (loc) {
          var next = resolveUrl(url, loc);
          return getHtmlFollow(next, merged, referer || defaultMcappReferer(), label || "牧场POST跳转", 0).then(function (ret) {
            if (ret && ret.cookie) LAST_RANCH_COOKIE = preferRicherCookie(ret.cookie, LAST_RANCH_COOKIE);
            return (ret && ret.body) || "";
          });
        }
      }
      return html;
    })
    .catch(function (e) {
      log("⚠️ 牧场POST失败: " + errText(e));
      return "";
    });
}

function refillRanchAnimals(base, cookie, ctx) {
  if (!CONFIG.RANCH_AUTO_REFILL) return Promise.resolve({ bag: 0, buy: 0, skipped: true });
  var startSlot = ctx && ctx.slotState ? ctx.slotState : null;
  var bagFilled = 0;
  var buyFilled = 0;
  var bagItems = [];
  var shopItems = [];
  var skipped = false;

  function ensureSlot(forceRefresh) {
    if (!forceRefresh && ctx && ctx.slotState) return Promise.resolve(ctx.slotState);
    return refreshRanchContext(base, cookie, ctx).then(function () {
      return ctx.slotState || null;
    });
  }

  function pickBagItem(type) {
    for (var i = 0; i < bagItems.length; i++) {
      var it = bagItems[i] || {};
      if (it.type === type && Number(it.count || 0) > 0 && it.cid) return it;
    }
    return null;
  }

  function pickShopItem(type) {
    for (var i = 0; i < shopItems.length; i++) {
      var it = shopItems[i] || {};
      if (it.type === type && it.cid) return it;
    }
    return null;
  }

  function plantFromBag(item, need) {
    if (!item || !item.cid || need <= 0) return Promise.resolve(0);
    var infoUrl = buildPastureUrl(base, item.infoLink || "");
    if (!infoUrl) return Promise.resolve(0);
    return ranchGet(infoUrl, cookie).then(function (infoHtml) {
      updateRanchSlotState(ctx, infoHtml);
      var slot = ctx.slotState || startSlot;
      var type = item.type === "窝" ? "窝" : "棚";
      var realNeed = emptyByRanchType(slot, type);
      if (realNeed <= 0) return 0;
      var can = Number(firstMatch(infoHtml, /name=["']can["']\s+value=["']([0-9]+)/i) || 0);
      if (isNaN(can) || can <= 0) can = realNeed;
      var num = Math.min(need, Number(item.count || 0), can, realNeed);
      if (!num || num <= 0) return 0;
      var postUrl = base + "/mc/cgi-bin/wap_pasture_plant?sid=" + ctx.sid + "&g_ut=" + ctx.g_ut;
      var body =
        "num=" +
        encodeURIComponent(num) +
        "&cid=" +
        encodeURIComponent(item.cid) +
        "&name=" +
        encodeURIComponent(item.name || "") +
        "&can=" +
        encodeURIComponent(can) +
        "&sb=%E7%A1%AE%E5%AE%9A";
      return pasturePostForm(postUrl, body, cookie, infoUrl, "背包饲养")
        .then(function (retHtml) {
          updateRanchSlotState(ctx, retHtml);
          var msg = extractMessage(retHtml) || extractWapHint(retHtml) || "";
          if (msg) log("🐮 背包饲养(" + type + "): " + msg);
          if (/(成功添加|添加成功|饲养成功)/.test(msg || stripTags(retHtml || ""))) return num;
          return 0;
        });
    });
  }

  function buyFromShop(item, need) {
    if (!item || !item.cid || need <= 0) return Promise.resolve(0);
    var preUrl = buildPastureUrl(base, item.buyPreLink || "");
    if (!preUrl) return Promise.resolve(0);
    return ranchGet(preUrl, cookie).then(function (preHtml) {
      updateRanchSlotState(ctx, preHtml);
      var type = item.type === "窝" ? "窝" : "棚";
      var slot = ctx.slotState || startSlot;
      var preEmpty = parseRanchBuyPreEmpty(preHtml);
      var realNeed = preEmpty
        ? type === "窝"
          ? Number(preEmpty.denEmpty || 0)
          : Number(preEmpty.shedEmpty || 0)
        : emptyByRanchType(slot, type);
      if (!realNeed || realNeed <= 0) return 0;
      var num = Math.min(need, realNeed);
      if (!num || num <= 0) return 0;
      var lv = item.lv || queryValue(preUrl, "lv") || ctx.lv || "";
      var flag = item.flag || queryValue(preUrl, "flag") || "0";
      var postUrl = base + "/mc/cgi-bin/wap_pasture_animal_buy?sid=" + ctx.sid + "&g_ut=" + ctx.g_ut;
      var body =
        "number=" +
        encodeURIComponent(num) +
        "&g_ut=" +
        encodeURIComponent(ctx.g_ut) +
        "&lv=" +
        encodeURIComponent(lv) +
        "&cId=" +
        encodeURIComponent(item.cid) +
        "&flag=" +
        encodeURIComponent(flag) +
        "&max=1";
      var transientRetries = Math.max(0, Number(CONFIG.RETRY_TRANSIENT || 0));
      function attemptBuy(attempt) {
        return pasturePostForm(postUrl, body, cookie, preUrl, "商店购买并饲养").then(function (retHtml) {
          updateRanchSlotState(ctx, retHtml);
          var msg = extractMessage(retHtml) || extractWapHint(retHtml) || "";
          if (msg) log("🐮 商店补栏(" + type + "): " + msg);
          var fullText = normalizeSpace(stripTags(retHtml || ""));
          if (/(购买并饲养成功|购买成功|成功购买并饲养)/.test(msg || fullText)) return num;
          if (isMoneyShortText(msg || fullText)) return 0;
          if (isTransientFailText(msg || fullText) && attempt < transientRetries) {
            if (CONFIG.DEBUG) logDebug("🐮 商店补栏繁忙(" + type + ")，第" + (attempt + 1) + "次重试");
            return sleep(CONFIG.RETRY_WAIT_MS || 600).then(function () {
              return attemptBuy(attempt + 1);
            });
          }
          return 0;
        });
      }
      return attemptBuy(0);
    });
  }

  function fillType(type) {
    function currentNeed() {
      var slot = ctx && ctx.slotState ? ctx.slotState : startSlot;
      return emptyByRanchType(slot, type);
    }
    var need0 = currentNeed();
    if (need0 <= 0) return Promise.resolve();

    var chain = Promise.resolve();

    if (CONFIG.RANCH_REFILL_BAG_FIRST) {
      chain = chain.then(function () {
        function bagLoop() {
          var need = currentNeed();
          if (need <= 0) return Promise.resolve();
          var item = pickBagItem(type);
          if (!item) return Promise.resolve();
          return plantFromBag(item, need).then(function (added) {
            if (added > 0) {
              item.count = Math.max(0, Number(item.count || 0) - added);
              bagFilled += added;
              return bagLoop();
            }
            item.count = 0;
            return bagLoop();
          });
        }
        return bagLoop();
      });
    }

    if (CONFIG.RANCH_REFILL_SHOP_AFTER_BAG) {
      chain = chain.then(function () {
        function shopLoop(round) {
          var need = currentNeed();
          if (need <= 0) return Promise.resolve();
          if (round > 6) return Promise.resolve();
          var item = pickShopItem(type);
          if (!item) return Promise.resolve();
          return buyFromShop(item, need).then(function (added) {
            if (added > 0) {
              buyFilled += added;
              return shopLoop(round + 1);
            }
            return Promise.resolve();
          });
        }
        return shopLoop(1);
      });
    }

    return chain;
  }

  return ensureSlot(true)
    .then(function () {
      var slot = ctx && ctx.slotState ? ctx.slotState : startSlot;
      if (!slot) {
        skipped = true;
        return;
      }
      startSlot = slot;
      var denNeedStart = emptyByRanchType(slot, "窝");
      var shedNeedStart = emptyByRanchType(slot, "棚");
      if (denNeedStart <= 0 && shedNeedStart <= 0) {
        skipped = true;
        return;
      }
      log(
        "🐮 补栏: 开始 窝空" +
          denNeedStart +
          " 棚空" +
          shedNeedStart
      );
      return fetchPastureBagAnimals(base, cookie, ctx);
    })
    .then(function (items) {
      if (skipped) return;
      bagItems = items || [];
      return fetchPastureShopAnimals(base, cookie, ctx, CONFIG.RANCH_REFILL_SHOP_MAX_PAGES);
    })
    .then(function (items) {
      if (skipped) return;
      shopItems = items || [];
      return fillType("窝");
    })
    .then(function () {
      if (skipped) return;
      return fillType("棚");
    })
    .then(function () {
      if (skipped) return;
      return refreshRanchContext(base, cookie, ctx).catch(function () {
        return;
      });
    })
    .then(function () {
      if (skipped) return { bag: 0, buy: 0, skipped: true };
      var slot = ctx && ctx.slotState ? ctx.slotState : startSlot;
      log(
        "🐮 补栏: 结束 窝空" +
          emptyByRanchType(slot, "窝") +
          " 棚空" +
          emptyByRanchType(slot, "棚") +
          " | 背包+" +
          bagFilled +
          " 商店+" +
          buyFilled
      );
      return { bag: bagFilled, buy: buyFilled, skipped: false };
    })
    .catch(function (e) {
      log("⚠️ 牧场补栏异常: " + errText(e));
      return { bag: bagFilled, buy: buyFilled, skipped: false };
    });
}

function formatRanchHarvestInferDetail(map, limit) {
  var arr = [];
  for (var k in map) {
    if (!map.hasOwnProperty(k)) continue;
    if (map[k] > 0) arr.push({ name: k, count: map[k] });
  }
  if (arr.length === 0) return "";
  arr.sort(function (a, b) {
    if (b.count !== a.count) return b.count - a.count;
    return a.name > b.name ? 1 : -1;
  });
  var max = limit || 4;
  var show = arr.slice(0, max);
  var parts = [];
  for (var i = 0; i < show.length; i++) {
    parts.push(show[i].name + "×" + show[i].count);
  }
  if (arr.length > max) parts.push("…");
  return parts.join("，");
}

function inferRanchHarvestFromStatus(beforeList, afterList) {
  if (!beforeList || !afterList) return { count: 0, detail: "" };
  if (beforeList.length === 0 || afterList.length === 0) return { count: 0, detail: "" };
  var b = summarizeRanchHarvestable(beforeList);
  var a = summarizeRanchHarvestable(afterList);
  var delta = b.total - a.total;
  if (delta <= 0) return { count: 0, detail: "" };
  var diff = {};
  for (var name in b.byName) {
    if (!b.byName.hasOwnProperty(name)) continue;
    var d = b.byName[name] - (a.byName[name] || 0);
    if (d > 0) diff[name] = d;
  }
  return {
    count: delta,
    detail: formatRanchHarvestInferDetail(diff, 4),
    before: b.total,
    after: a.total
  };
}

function farmStatusTextFromB(b) {
  if (b === 0) return "未播种";
  if (b === 1) return "种子";
  if (b === 2) return "发芽";
  if (b === 3) return "成株";
  if (b === 4) return "开花";
  if (b === 5) return "初熟";
  if (b === 6) return "成熟";
  if (b === 7) return "枯萎";
  return "未知";
}

function numVal(v) {
  var n = Number(v);
  return isNaN(n) ? 0 : n;
}

function isZeroVal(v) {
  return v === 0 || v === "0" || v === "" || v === null || v === undefined;
}

function explicitLandLockReason(land) {
  if (!land || typeof land !== "object") return "null";
  if (land.locked != null && Number(land.locked) === 1) return "locked=1";
  if (land.isLocked != null && Number(land.isLocked) === 1) return "isLocked=1";
  if (land.isLock != null && Number(land.isLock) === 1) return "isLock=1";
  if (land.open != null && Number(land.open) === 0) return "open=0";
  if (land.isOpen != null && Number(land.isOpen) === 0) return "isOpen=0";
  return "";
}

function isZeroLockCandidate(land) {
  if (!land || typeof land !== "object") return false;
  var a0 = isZeroVal(land.a) && isZeroVal(land.c);
  var b0 = isZeroVal(land.b);
  var hasSignal =
    numVal(land.i) > 0 ||
    numVal(land.e) > 0 ||
    numVal(land.s) > 0 ||
    numVal(land.bitmap) > 0 ||
    numVal(land.bitmap2) > 0;
  return a0 && b0 && !hasSignal;
}

function useFarmLockHeuristic() {
  return !!CONFIG.FARM_JSON_LOCK_HEURISTIC && !FARM_CTX.lockHeuristicOff;
}

function landLockReason(land) {
  var explicit = explicitLandLockReason(land);
  if (explicit) return explicit;
  if (useFarmLockHeuristic() && isZeroLockCandidate(land)) return "zero-fields";
  return "";
}

function isLandLocked(land) {
  return !!landLockReason(land);
}

function isLandEmpty(land) {
  if (isLandLocked(land)) return false;
  var b = Number(land && land.b);
  if (!isNaN(b) && b === 0) return true;
  var a0 = isZeroVal(land && land.a) && isZeroVal(land && land.c);
  var k0 =
    numVal(land && land.k) <= 0 &&
    numVal(land && land.l) <= 0 &&
    numVal(land && land.m) <= 0;
  return a0 && k0;
}

function isLandWithered(land) {
  return !isLandLocked(land) && Number(land && land.b) === 7;
}

function farmNameFromLand(land, status) {
  if (status === "未播种") return "空地";
  if (status === "锁定") return "锁地";
  if (land && land.c !== undefined && land.c !== null && land.c !== "" && Number(land.c) > 0)
    return "cId" + land.c;
  if (land && land.a !== undefined && land.a !== null && land.a !== "" && Number(land.a) > 0)
    return "cId" + land.a;
  return "作物";
}

function buildFarmStatusFromJson(farm) {
  var list = [];
  if (!farm || !farm.farmlandStatus) return list;
  var lands = ensureArray(farm.farmlandStatus);
  for (var i = 0; i < lands.length; i++) {
    var land = lands[i] || {};
    if (!land) continue;
    var b = land.b;
    var status = farmStatusTextFromB(b);
    if (isLandLocked(land)) status = "锁定";
    else if (isLandEmpty(land)) status = "未播种";
    var name = farmNameFromLand(land, status);
    list.push({ name: name, status: status, idx: i + 1 });
  }
  return list;
}

function summarizeFarmJsonStatus(farm) {
  var list = ensureArray(farm && farm.farmlandStatus);
  var counts = {};
  var total = 0;
  var locked = 0;
  for (var i = 0; i < list.length; i++) {
    var land = list[i] || {};
    if (!land) continue;
    total += 1;
    if (isLandLocked(land)) {
      locked += 1;
      continue;
    }
    var b = land.b;
    if (!counts[b]) counts[b] = 0;
    counts[b] += 1;
  }
  return { total: total, counts: counts, locked: locked };
}

function summarizeFarmJsonCore(farm) {
  var list = ensureArray(farm && farm.farmlandStatus);
  var out = { total: 0, locked: 0, harvestable: 0, withered: 0, empty: 0 };
  for (var i = 0; i < list.length; i++) {
    var land = list[i];
    if (!land) continue;
    out.total += 1;
    if (isLandLocked(land)) {
      out.locked += 1;
      continue;
    }
    var b = Number(land.b || 0);
    var k = Number(land.k || 0);
    if (k > 0 && b !== 7) out.harvestable += 1;
    if (b === 7) out.withered += 1;
    if (isLandEmpty(land)) out.empty += 1;
  }
  return out;
}

function collectFarmJsonCoreTodoPlaces(farm) {
  var list = ensureArray(farm && farm.farmlandStatus);
  var out = { harvestable: [], withered: [], empty: [] };
  for (var i = 0; i < list.length; i++) {
    var land = list[i];
    if (!land) continue;
    if (isLandLocked(land)) continue;
    var b = Number(land.b || 0);
    var k = Number(land.k || 0);
    if (k > 0 && b !== 7) out.harvestable.push(i + 1);
    if (b === 7) out.withered.push(i + 1);
    if (isLandEmpty(land)) out.empty.push(i + 1);
  }
  return out;
}

function formatPlaceListSample(arr, limit) {
  if (!arr || arr.length === 0) return "";
  var max = typeof limit === "number" && limit > 0 ? limit : 10;
  var show = arr.slice(0, max).join(",");
  if (arr.length > max) show += " ...+" + (arr.length - max);
  return show;
}

function formatJsonCoreTodoPlaceSample(farm, limit) {
  var p = collectFarmJsonCoreTodoPlaces(farm);
  var a = formatPlaceListSample(p.harvestable, limit);
  var b = formatPlaceListSample(p.withered, limit);
  var c = formatPlaceListSample(p.empty, limit);
  return (
    "收[" +
    (a || "-") +
    "] 枯[" +
    (b || "-") +
    "] 空[" +
    (c || "-") +
    "]"
  );
}

function hasJsonCoreTodo(sum) {
  if (!sum) return false;
  if (CONFIG.ENABLE.harvest && sum.harvestable > 0) return true;
  if (CONFIG.ENABLE.scarify && sum.withered > 0) return true;
  if (CONFIG.ENABLE.plant && sum.empty > 0) return true;
  return false;
}

function formatJsonCoreTodo(sum) {
  if (!sum) return "无";
  return "收" + sum.harvestable + " 枯" + sum.withered + " 空" + sum.empty;
}

function applyFarmLockHeuristicGuard(farm, tag) {
  if (!CONFIG.FARM_JSON_LOCK_HEURISTIC || !CONFIG.FARM_JSON_LOCK_GUARD) return;
  if (FARM_CTX.lockHeuristicOff) return;
  var list = ensureArray(farm && farm.farmlandStatus);
  if (!list.length) return;
  var total = 0;
  var explicitLocked = 0;
  var zeroLocked = 0;
  for (var i = 0; i < list.length; i++) {
    var land = list[i];
    if (!land || typeof land !== "object") continue;
    total += 1;
    if (explicitLandLockReason(land)) {
      explicitLocked += 1;
      continue;
    }
    if (isZeroLockCandidate(land)) zeroLocked += 1;
  }
  if (!total) return;
  var minTotal = Number(CONFIG.FARM_JSON_LOCK_GUARD_MIN_TOTAL || 18);
  if (!minTotal || isNaN(minTotal) || minTotal < 1) minTotal = 18;
  var lv = Number(
    (farm && farm.user && (farm.user.level || farm.user.lv || farm.user.userLevel)) || 0
  );
  var allZeroLocked = explicitLocked === 0 && zeroLocked === total && total >= minTotal;
  var nearAllZeroLocked =
    explicitLocked === 0 &&
    zeroLocked >= total - 1 &&
    total >= minTotal &&
    lv >= 30;
  if (!allZeroLocked && !nearAllZeroLocked) return;
  FARM_CTX.lockHeuristicOff = true;
  log(
    "⚠️ 锁地识别保护(" +
      (tag || "unknown") +
      "): 疑似误判，已自动关闭 zero-fields 锁地判定"
  );
  if (CONFIG.DEBUG) {
    logDebug(
      "🔒 保护详情: total=" +
        total +
        " explicit=" +
        explicitLocked +
        " zero=" +
        zeroLocked +
        " lv=" +
        lv
    );
  }
}

function logFarmJsonStatus(tag, farm) {
  var sum = summarizeFarmJsonStatus(farm);
  if (!sum || !sum.total) {
    log("🌾 JSON状态(" + tag + "): 空");
    return;
  }
  var c = sum.counts || {};
  var msg =
    "🌾 JSON状态(" +
    tag +
    "): 总=" +
    sum.total +
    " 锁地=" +
    (sum.locked || 0) +
    " 成熟=" +
    (c[6] || 0) +
    " 枯萎=" +
    (c[7] || 0) +
    " 初熟=" +
    (c[5] || 0) +
    " 成株=" +
    (c[3] || 0) +
    " 开花=" +
    (c[4] || 0) +
    " 发芽=" +
    (c[2] || 0) +
    " 种子=" +
    (c[1] || 0) +
    " 空地=" +
    (c[0] || 0);
  log(msg);
}

function setFarmStatusFromJson(farm, isStart) {
  var list = buildFarmStatusFromJson(farm);
  if (!list.length) return false;
  if (isStart) {
    FARM_STATUS_JSON_START = list;
    STATUS_START.farm = list;
    setFarmPlaceNameFromStatus(list);
  } else {
    FARM_STATUS_JSON_END = list;
    STATUS_END.farm = list;
  }
  return true;
}

function formatStatusLine(label, items) {
  var grouped = groupStatusItems(items || []);
  return label + (grouped.length ? grouped.join("；") : "无");
}

function setStartStats(kind, stats) {
  if (!stats) return;
  if (!STATS_START[kind]) STATS_START[kind] = stats;
}

function setEndStats(kind, stats) {
  if (!stats) return;
  STATS_END[kind] = stats;
}

function formatDelta(val) {
  if (val === null || val === undefined || isNaN(val)) return "未知";
  return (val >= 0 ? "+" : "") + val;
}

function formatStatsLine(label, start, end) {
  if (!end) return label + "：等级/经验/金币 未知";
  var level = end.level != null ? String(end.level) : "未知";
  if (start && start.level != null && end.level != null) {
    var dl = end.level - start.level;
    if (dl > 0) level += "(↑" + dl + ")";
    else if (dl < 0) level += "(↓" + Math.abs(dl) + ")";
  }
  var expStr = "经验未知";
  var expDelta = "未知";
  if (end.expCur != null && end.expTotal != null) {
    expStr = end.expCur + "/" + end.expTotal;
    if (start && start.level === end.level && start.expCur != null) {
      expDelta = formatDelta(end.expCur - start.expCur);
    } else if (start && start.level != null && end.level != null && start.level !== end.level) {
      expDelta = "等级变化";
    }
  }
  var moneyStr = end.money != null ? String(end.money) : "未知";
  var moneyDelta = "未知";
  if (start && start.money != null && end.money != null) {
    moneyDelta = formatDelta(end.money - start.money);
  }
  return (
    label +
    "：Lv" +
    level +
    " 经验" +
    expStr +
    "(Δ" +
    expDelta +
    ") 金币" +
    moneyStr +
    "(Δ" +
    moneyDelta +
    ")"
  );
}

function summarizePurchases() {
  if (!PURCHASE_LOGS || PURCHASE_LOGS.length === 0) return "";
  var map = {};
  for (var i = 0; i < PURCHASE_LOGS.length; i++) {
    var it = PURCHASE_LOGS[i];
    var key = it.name || "未知";
    if (!map[key]) map[key] = { count: 0, cost: 0 };
    map[key].count += it.count || 0;
    map[key].cost += it.cost || 0;
  }
  var parts = [];
  for (var k in map) {
    if (!map.hasOwnProperty(k)) continue;
    var item = map[k];
    var seg = k;
    if (item.count) seg += "×" + item.count;
    if (item.cost) seg += "(" + item.cost + ")";
    parts.push(seg);
  }
  return parts.join("；");
}

function hasMatureStatus(list) {
  if (!list || list.length === 0) return false;
  for (var i = 0; i < list.length; i++) {
    var st = list[i].status || "";
    if (/(成熟|可收获|待收)/.test(st)) return true;
  }
  return false;
}

function hasFishHarvestableStatus(list) {
  if (!list || list.length === 0) return false;
  for (var i = 0; i < list.length; i++) {
    var st = normalizeSpace((list[i] && list[i].status) || "");
    if (!st) continue;
    if (/至收获期/.test(st)) continue;
    if (/(鱼苗期|幼鱼期|成鱼期|成熟期)/.test(st)) continue;
    if (/(可收|待收|收获|已成熟)/.test(st)) return true;
  }
  return false;
}

function isFishFeedBlockedStatus(status) {
  var st = normalizeSpace(status || "");
  if (!st) return false;
  // 鱼苗/休眠/死亡/成熟阶段通常不可喂；仅在“全部都不可喂”时用于提前跳过。
  if (/(鱼苗期|鱼卵|孵化|休眠|死亡|已成熟|成熟期|可收获|待收获|收获期)/.test(st)) return true;
  return false;
}

function shouldSkipFishFeedByStatus(list) {
  if (!list || list.length === 0) return false;
  var blocked = 0;
  var unknown = 0;
  for (var i = 0; i < list.length; i++) {
    var st = normalizeSpace((list[i] && list[i].status) || "");
    if (!st) {
      unknown += 1;
      continue;
    }
    // 发现可能可喂阶段时，不提前跳过。
    if (/(幼鱼期|生长期|成长期|可喂|喂食)/.test(st)) return false;
    if (isFishFeedBlockedStatus(st)) blocked += 1;
    else unknown += 1;
  }
  return blocked > 0 && unknown === 0;
}

function hasWitheredStatus(list) {
  if (!list || list.length === 0) return false;
  for (var i = 0; i < list.length; i++) {
    var st = list[i].status || "";
    if (/枯萎/.test(st)) return true;
  }
  return false;
}

function countEmptyFarmLand(list) {
  if (!list || list.length === 0) return 0;
  var n = 0;
  for (var i = 0; i < list.length; i++) {
    var it = list[i] || {};
    var text = (it.name || "") + " " + (it.status || "");
    if (/空地|未播种|未种植/.test(text)) n += 1;
  }
  return n;
}

function hasEmptyFarmLand(list) {
  return countEmptyFarmLand(list) > 0;
}

function normalizeFarmPlace(idx) {
  var n = parseInt(idx, 10);
  if (!n || n < 1) return "";
  return String(n - 1);
}

function collectFarmPlacesByStatus(list, re) {
  if (!list || list.length === 0) return [];
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var it = list[i] || {};
    var st = it.status || "";
    if (!re.test(st)) continue;
    var place = normalizeFarmPlace(it.idx);
    if (place !== "") out.push(place);
  }
  return out;
}

function collectFarmPlacesFromHtml(html, re) {
  return collectFarmPlacesByStatus(parseFarmStatus(html), re);
}

function hasFishEmptyEnd() {
  if (LAST_FISH_EMPTY !== null && LAST_FISH_EMPTY !== undefined) return LAST_FISH_EMPTY > 0;
  return !!LAST_FISH_HAS_EMPTY;
}

function buildNoActionHint() {
  var hints = [];
  if (ACTION_STATS.harvest === 0 && STATUS_START.farm && STATUS_START.farm.length && !hasMatureStatus(STATUS_START.farm)) {
    hints.push("农场未成熟");
  }
  if (RANCH_STATS.harvest === 0 && RANCH_STATS.product === 0 && !hasMatureStatus(STATUS_START.ranch)) {
    hints.push("牧场未成熟");
  }
  if (FISH_STATS.harvest === 0 && !hasFishHarvestableStatus(STATUS_START.fish)) {
    hints.push("鱼塘未成熟");
  }
  if (CONFIG.ENABLE.plant && STATUS_END.farm && STATUS_END.farm.length && hasEmptyFarmLand(STATUS_END.farm)) {
    if (NO_MONEY.farmSeed || NO_MONEY.grassSeed) hints.push("农场空地未播种(金币不足)");
    else hints.push("农场空地未播种");
  }
  if (CONFIG.ENABLE.scarify && STATUS_END.farm && STATUS_END.farm.length && hasWitheredStatus(STATUS_END.farm)) {
    hints.push("农场枯萎待铲除");
  }
  if (CONFIG.FISH_AUTO_PLANT && hasFishEmptyEnd()) {
    if (NO_MONEY.fishSeed) hints.push("鱼塘空池塘未放养(金币不足)");
    else hints.push("鱼塘空池塘未放养");
  }
  return hints.length ? hints.join("；") : "";
}

function sortBagItems(items) {
  return items.sort(function (a, b) {
    if (b.count !== a.count) return b.count - a.count;
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  });
}

function buildBagTag(items, limit) {
  if (!items || items.length === 0) return "无";
  var list = items.slice(0, limit).map(function (it) {
    return it.name + "×" + it.count;
  });
  if (items.length > limit) list.push("…");
  return list.join("、");
}

function getBagItemCount(name) {
  if (!name || !BAG_STATS.seed || !BAG_STATS.seed.items) return 0;
  for (var i = 0; i < BAG_STATS.seed.items.length; i++) {
    var it = BAG_STATS.seed.items[i];
    if (it && it.name === name) return it.count || 0;
  }
  return 0;
}

function seedCidFromBagItem(it) {
  if (!it) return "";
  var raw =
    it.cid !== undefined && it.cid !== null && it.cid !== ""
      ? it.cid
      : it.cId !== undefined && it.cId !== null && it.cId !== ""
        ? it.cId
        : it.id !== undefined && it.id !== null && it.id !== ""
          ? it.id
          : "";
  if (raw !== "") {
    var n = Number(raw);
    if (!isNaN(n) && n > 0) return String(Math.floor(n));
  }
  var name = normalizeSpace(it.name || "");
  if (name) {
    var m = name.match(/cId\s*([0-9]+)/i);
    if (m) return String(m[1]);
  }
  return "";
}

function normalizeSeedPickName(name) {
  var nm = normalizeCropName(name || "");
  if (!nm) return "";
  nm = nm.replace(/种子$/i, "");
  return normalizeCropName(nm);
}

function isSeasonalSeedName(name) {
  var nm = normalizeSeedPickName(name);
  if (!nm) return false;
  if (nm.indexOf("节气") >= 0) return true;
  return !!cropNameHitPrefix(nm, CONFIG.FARM_SELL_PROTECT_PREFIXES);
}

function isSeasonalSeedCid(cid) {
  if (!cid) return false;
  var key = String(cid);
  var names = [];
  if (CROP_NAME_MAP[key]) names.push(CROP_NAME_MAP[key]);
  names.push(getCropNameByCid(key));
  for (var i = 0; i < names.length; i++) {
    if (isSeasonalSeedName(names[i])) return true;
  }
  return false;
}

function pickSeasonalSeedCidFromBag(excludeCid) {
  var items = (BAG_STATS.seed && BAG_STATS.seed.items) || [];
  var ex = excludeCid ? String(excludeCid) : "";
  for (var i = 0; i < items.length; i++) {
    var it = items[i] || {};
    var cnt = Number(it.count || it.amount || 0);
    if (!cnt || cnt <= 0) continue;
    var cid = seedCidFromBagItem(it);
    if (!cid) continue;
    if (ex && cid === ex) continue;
    var name = it.name || it.cName || "";
    if (isSeasonalSeedName(name) || isSeasonalSeedCid(cid)) return cid;
  }
  return "";
}

function pickPlantSeedCidFromBag(excludeCid) {
  var items = (BAG_STATS.seed && BAG_STATS.seed.items) || [];
  var ex = excludeCid ? String(excludeCid) : "";
  for (var i = 0; i < items.length; i++) {
    var it = items[i] || {};
    var cnt = Number(it.count || it.amount || 0);
    if (!cnt || cnt <= 0) continue;
    var cid = seedCidFromBagItem(it);
    if (!cid) continue;
    if (ex && cid === ex) continue;
    return cid;
  }
  return "";
}

function isGrassEnoughForDiversify(grassCount) {
  var n = Number(grassCount);
  if (isNaN(n)) return false;
  return n >= Number(CONFIG.GRASS_THRESHOLD || 0);
}

function pickPlantSeedCidByPolicy(grassCountHint) {
  var grassCid = String(CONFIG.FARM_GRASS_SEED_ID || "40");
  var preferNonGrass =
    isGrassEnoughForDiversify(grassCountHint) || isGrassEnoughForDiversify(LAST_GRASS_COUNT);
  if (preferNonGrass) {
    var seasonal = pickSeasonalSeedCidFromBag(grassCid);
    if (seasonal) return seasonal;
    var nonGrass = pickPlantSeedCidFromBag(grassCid);
    if (nonGrass) return nonGrass;
  }
  return pickPlantSeedCidFromBag("");
}

function isSeedLackMsg(msg) {
  var text = normalizeSpace(msg || "");
  if (!text) return false;
  return /(没有足够的种子|种子不足|没有种子|请先购买种子|可种植种子不足|种子数量不足)/.test(text);
}

function markGrassLow(grassCount, stage) {
  var threshold = CONFIG.GRASS_THRESHOLD;
  if (grassCount === null || grassCount === undefined) return false;
  if (grassCount >= threshold) return false;
  var prefix = stage ? stage + "后" : "";
  if (!GRASS_LOW_SEEN || stage) {
    log(
      "🌱 种植策略: " +
        prefix +
        "牧草果实不足(" +
        grassCount +
        "<" +
        threshold +
        ")，优先种牧草"
    );
  }
  GRASS_LOW_SEEN = true;
  PLANT_SEED_LOCKED = true;
  CONFIG.PLANT_CID = CONFIG.FARM_GRASS_SEED_ID;
  return true;
}

function refreshFinalStats(cookie) {
  var base = CONFIG.FARM_WAP_BASE;
  var sid = CONFIG.RANCH_SID;
  var farmGut = getFarmGut();
  var ranchGut = CONFIG.RANCH_G_UT;
  var farmUrl = base + "/nc/cgi-bin/wap_farm_index?sid=" + sid + "&g_ut=" + farmGut;
  var ranchUrl = CONFIG.RANCH_BASE + "/mc/cgi-bin/wap_pasture_index?sid=" + sid + "&g_ut=" + ranchGut;
  return getHtmlFollow(farmUrl, cookie, null, "农场统计", 0)
    .then(function (ret) {
      var farmHtml = ret.body || "";
      var stats = parseCommonStats(ret.body || "");
      setEndStats("farm", stats);
      function fallbackWap() {
        var fallback = parseFarmStatus(farmHtml);
        if (fallback && fallback.length) {
          STATUS_END.farm = fallback;
          if (CONFIG.DEBUG) logDebug("🌾 农场状态: JSON结束态缺失，展示兜底为 WAP(" + fallback.length + "块)");
        } else if (CONFIG.DEBUG) {
          logDebug("🌾 农场状态: JSON结束态缺失，WAP兜底也为空");
        }
      }
      if (!CONFIG.FARM_JSON_ENABLE) {
        STATUS_END.farm = parseFarmStatus(farmHtml);
      } else if (!FARM_STATUS_JSON_END || FARM_STATUS_JSON_END.length === 0) {
        var uin = getFarmUin(cookie);
        return fetchFarmJson(CONFIG.FARM_JSON_BASE || "https://nc.qzone.qq.com", ret.cookie || cookie, uin)
          .then(function (farm) {
            if (isFarmJson(farm)) {
              if (!setFarmStatusFromJson(farm, false)) fallbackWap();
            } else fallbackWap();
          })
          .catch(function () {
            fallbackWap();
          })
          .then(function () {
            return getHtmlFollow(ranchUrl, ret.cookie || cookie, null, "牧场统计", 0);
          });
      }
      return getHtmlFollow(ranchUrl, ret.cookie || cookie, null, "牧场统计", 0);
    })
    .then(function (html2) {
      var ranchHtml = html2.body || "";
      var stats2 = parseCommonStats(ranchHtml);
      setEndStats("ranch", stats2);
      STATUS_END.ranch = parseRanchStatus(ranchHtml);
      updateRanchFeedState("end", parseFeedPreInfo(ranchHtml));
      var ctx = extractRanchContext(ranchHtml);
      ctx.sid = ctx.sid || CONFIG.RANCH_SID;
      ctx.g_ut = ctx.g_ut || CONFIG.RANCH_G_UT;
      ctx.food = CONFIG.RANCH_FOOD || extractFoodId(ranchHtml) || "";
      if (!ctx.sid || !ctx.g_ut) return;
      return probeGrassFruitFromFeedPre(CONFIG.RANCH_BASE, html2.cookie || cookie, ctx, "结束", "end").then(function () {
        return;
      });
    })
    .catch(function (e) {
      log("📊 统计刷新失败: " + e);
    });
}

function captureFarmStartStats(cookie) {
  if (STATS_START.farm) return Promise.resolve();
  var base = CONFIG.FARM_WAP_BASE;
  var sid = CONFIG.RANCH_SID;
  var g_ut = getFarmGut();
  var farmUrl = base + "/nc/cgi-bin/wap_farm_index?sid=" + sid + "&g_ut=" + g_ut;
  return getHtmlFollow(farmUrl, cookie, null, "农场统计", 0)
    .then(function (ret) {
      var farmHtml = ret.body || "";
      setStartStats("farm", parseCommonStats(ret.body || ""));
      function fallbackWap() {
        var fallback = parseFarmStatus(farmHtml);
        STATUS_START.farm = fallback;
        setFarmPlaceNameFromStatus(STATUS_START.farm);
        if (CONFIG.FARM_JSON_ENABLE && CONFIG.DEBUG) {
          logDebug("🌾 农场状态: JSON开始态待刷新，先用 WAP 基线(" + fallback.length + "块)");
        }
      }
      if (!CONFIG.FARM_JSON_ENABLE) {
        fallbackWap();
        return;
      }
      var uin = getFarmUin(cookie);
      return fetchFarmJson(CONFIG.FARM_JSON_BASE || "https://nc.qzone.qq.com", ret.cookie || cookie, uin)
        .then(function (farm) {
          if (isFarmJson(farm)) {
            if (!setFarmStatusFromJson(farm, true)) fallbackWap();
          } else fallbackWap();
        })
        .catch(function () {
          fallbackWap();
        });
    })
    .catch(function (e) {
      log("📊 农场统计读取失败: " + e);
    });
}

function captureStartRanchStatus(cookie) {
  if (STATS_START.ranch && STATUS_START.ranch && STATUS_START.ranch.length) return Promise.resolve();
  var sid = CONFIG.RANCH_SID;
  var g_ut = CONFIG.RANCH_G_UT;
  var ranchUrl = CONFIG.RANCH_BASE + "/mc/cgi-bin/wap_pasture_index?sid=" + sid + "&g_ut=" + g_ut;
  return getHtmlFollow(ranchUrl, cookie, null, "牧场统计", 0)
    .then(function (ret) {
      var html = ret.body || "";
      setStartStats("ranch", parseCommonStats(html));
      STATUS_START.ranch = parseRanchStatus(html);
      updateRanchFeedState("start", parseFeedPreInfo(html));
      var ctx = extractRanchContext(html);
      ctx.sid = ctx.sid || sid;
      ctx.g_ut = ctx.g_ut || g_ut;
      ctx.food = CONFIG.RANCH_FOOD || extractFoodId(html) || "";
      if (!ctx.sid || !ctx.g_ut) return;
      return probeGrassFruitFromFeedPre(CONFIG.RANCH_BASE, ret.cookie || cookie, ctx, "开始", "start").then(function () {
        return;
      });
    })
    .catch(function (e) {
      log("📊 牧场统计读取失败: " + e);
    });
}

function captureStartFishStatus(cookie) {
  var sid = CONFIG.RANCH_SID;
  var g_ut = getFishGut();
  var fishUrl = CONFIG.FISH_BASE + "/nc/cgi-bin/wap_farm_fish_index?sid=" + sid + "&g_ut=" + g_ut;
  return getHtmlFollow(fishUrl, cookie, null, "鱼塘统计", 0)
    .then(function (ret) {
      STATUS_START.fish = parseFishStatus(ret.body || "");
      return fetchFishIndexJsonState(cookie, "开始统计");
    })
    .catch(function (e) {
      log("📊 鱼塘统计读取失败: " + e);
    });
}

function refreshEndFishStatus(cookie) {
  var sid = CONFIG.RANCH_SID;
  var g_ut = getFishGut();
  var fishUrl = CONFIG.FISH_BASE + "/nc/cgi-bin/wap_farm_fish_index?sid=" + sid + "&g_ut=" + g_ut;
  return getHtmlFollow(fishUrl, cookie, null, "鱼塘统计", 0)
    .then(function (ret) {
      var html = ret.body || "";
      STATUS_END.fish = parseFishStatus(html);
      var emptyByWap = extractFishEmptyPonds(html);
      LAST_FISH_EMPTY = emptyByWap;
      LAST_FISH_HAS_EMPTY =
        (emptyByWap !== null && emptyByWap !== undefined && emptyByWap > 0) ||
        (html.indexOf("一键养殖") >= 0 || html.indexOf("空池塘") >= 0);
      return fetchFishIndexJsonState(cookie, "结束统计").then(function (jState) {
        if (!jState) return;
        LAST_FISH_EMPTY = jState.empty;
        LAST_FISH_HAS_EMPTY = jState.empty > 0;
      });
    })
    .catch(function (e) {
      log("📊 鱼塘统计读取失败: " + e);
    });
}

function parseBagPageInfo(html) {
  var h = stripTags(html || "");
  var m = h.match(/第\s*(\d+)\s*\/\s*(\d+)\s*页/);
  if (!m) return { page: 1, total: 1 };
  var page = parseInt(m[1], 10);
  var total = parseInt(m[2], 10);
  if (!page || !total || total < 1) return { page: 1, total: 1 };
  return { page: page, total: total };
}

function mergeBagItems(map, items) {
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    map[it.name] = (map[it.name] || 0) + it.count;
  }
}

function fetchBagItems(cookie, type) {
  var base = CONFIG.FARM_WAP_BASE;
  var sid = CONFIG.RANCH_SID;
  var g_ut = getFarmGut();
  var baseUrl = base + "/nc/cgi-bin/wap_farm_user_bag?sid=" + sid + "&g_ut=" + g_ut;
  if (type) baseUrl += "&type=" + type;
  var curCookie = cookie;
  var map = {};
  function buildUrl(page) {
    if (!page || page <= 1) return baseUrl;
    return baseUrl + "&page=" + page;
  }
  function fetchPage(page) {
    return getHtmlFollow(buildUrl(page), curCookie, null, "背包", 0).then(function (ret) {
      if (ret.cookie) curCookie = ret.cookie;
      var html = ret.body || "";
      var items = parseBagItems(html);
      mergeBagItems(map, items);
      var info = parseBagPageInfo(html);
      return { items: items, info: info };
    });
  }
  return fetchPage(1)
    .then(function (ret) {
      var totalPage = ret.info.total || 1;
      var cur = ret.info.page || 1;
      if (totalPage <= 1) return;
      var p = Promise.resolve();
      var max = totalPage;
      for (var page = cur + 1; page <= max; page++) {
        (function (pno) {
          p = p.then(function () {
            return fetchPage(pno).then(function (ret2) {
              if (!ret2.items || ret2.items.length === 0) {
                max = pno - 1;
              }
            });
          }).then(function () {
            return sleep(CONFIG.WAIT_MS);
          });
        })(page);
      }
      return p;
    })
    .then(function () {
      var items = [];
      var total = 0;
      for (var name in map) {
        if (!map.hasOwnProperty(name)) continue;
        items.push({ name: name, count: map[name] });
        total += map[name];
      }
      return { items: sortBagItems(items), total: total };
    })
    .catch(function (e) {
      if (CONFIG.LOG_BAG_STATS) log("🎒 背包读取失败: " + e);
      return { items: [], total: 0 };
    });
}

function refreshBagStats(cookie) {
  return fetchFarmSeedJson(cookie)
    .then(function (seedJson) {
      if (seedJson && seedJson.ok) {
        BAG_STATS.seed = seedJson;
        if (CONFIG.LOG_BAG_STATS) {
          log("🎒 背包·种子(JSON): " + buildBagTag(seedJson.items, 4));
          if (seedJson.locked > 0 && CONFIG.DEBUG) logDebug("🔒 锁定种子: " + seedJson.locked);
          var grassSeed = getBagItemCount("牧草");
          if (grassSeed !== null && grassSeed !== undefined) {
            log("🌱 牧草种子: " + grassSeed);
          }
        }
        return null;
      }
      return fetchBagItems(cookie, "");
    })
    .then(function (seed) {
      if (seed) {
        BAG_STATS.seed = seed;
        if (CONFIG.LOG_BAG_STATS) {
          log("🎒 背包·种子: " + buildBagTag(seed.items, 4));
          var grassSeed = getBagItemCount("牧草");
          if (grassSeed !== null && grassSeed !== undefined) {
            log("🌱 牧草种子: " + grassSeed);
          }
        }
      }
      if (!CONFIG.ENABLE.fish_feed) return null;
      return fetchBagItems(cookie, "24");
    })
    .then(function (feed) {
      if (feed) {
        feed.loaded = true;
        BAG_STATS.fishFeed = feed;
        if (CONFIG.LOG_BAG_STATS) {
          log("🎒 背包·鱼食: " + buildBagTag(feed.items, 4));
        }
        FISH_FEED_EMPTY_SEEN = feed.total <= 0;
      }
      return fetchBagItems(cookie, "23");
    })
    .then(function (fish) {
      BAG_STATS.fish = fish;
      if (CONFIG.LOG_BAG_STATS) {
        log("🎒 背包·鱼苗: " + buildBagTag(fish.items, 4));
      }
    })
    .catch(function (e) {
      log("⚠️ 背包统计异常: " + errText(e));
      return;
    });
}

function ensureFishSeedTotal(cookie) {
  if (BAG_STATS.fish && BAG_STATS.fish.items && BAG_STATS.fish.items.length > 0) {
    return Promise.resolve(BAG_STATS.fish.total || 0);
  }
  return fetchBagItems(cookie, "23").then(function (fish) {
    BAG_STATS.fish = fish;
    return fish.total || 0;
  });
}

function ensureFishFeedTotal(cookie) {
  if (BAG_STATS.fishFeed && BAG_STATS.fishFeed.loaded) {
    return Promise.resolve(BAG_STATS.fishFeed.total || 0);
  }
  return fetchBagItems(cookie, "24").then(function (feed) {
    feed.loaded = true;
    BAG_STATS.fishFeed = feed;
    return feed.total || 0;
  });
}

function ensureFishFeedAvailable(cookie) {
  if (CONFIG.FISH_FEED_ALLOW_SPEND) return Promise.resolve(true);
  return ensureFishFeedTotal(cookie)
    .then(function (total) {
      if (total > 0) {
        FISH_FEED_EMPTY_SEEN = false;
        return true;
      }
      log("🐟 喂鱼: 背包无鱼食，跳过");
      FISH_FEED_EMPTY_SEEN = true;
      return false;
    })
    .catch(function () {
      log("🐟 喂鱼: 背包鱼食未知，跳过");
      FISH_FEED_EMPTY_SEEN = true;
      return false;
    });
}

function extractFishSaleIds(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var ids = {};
  var re = /fId[s]?=([0-9]+)/g;
  var m;
  while ((m = re.exec(h))) {
    ids[m[1]] = true;
  }
  return Object.keys(ids);
}

function parsePageInfoFromText(html) {
  var text = normalizeSpace(stripTags(html || ""));
  if (!text) return null;
  var m = text.match(/第\s*([0-9]+)\s*\/\s*([0-9]+)\s*页/);
  if (!m) return null;
  var page = Number(m[1] || 0);
  var total = Number(m[2] || 0);
  if (isNaN(page) || isNaN(total) || page <= 0 || total <= 0) return null;
  return { page: page, total: total };
}

function parseFarmSeedBag(html) {
  var text = (html || "").replace(/&amp;/g, "&");
  text = text.replace(/\s+/g, " ");
  var list = [];
  var seen = {};
  var re = /cId=([0-9]+)[^:：]{0,80}[:：]\s*([0-9]+)个/g;
  var m;
  while ((m = re.exec(text))) {
    var id = m[1];
    var count = parseInt(m[2], 10);
    if (isNaN(count) || count <= 0) continue;
    if (seen[id]) continue;
    seen[id] = true;
    list.push({ id: id, count: count });
  }
  if (list.length > 0) return list;
  // 回退：仅 cId 列表（无数量）
  var re2 = /cId=([0-9]+)/g;
  while ((m = re2.exec(text))) {
    var cid = m[1];
    if (seen[cid]) continue;
    seen[cid] = true;
    list.push({ id: cid, count: 1 });
  }
  return list;
}

function legacyFarmKey(farmTime) {
  // APK/Flash 兼容 farmKey 逻辑：优先用 encodeKey，其次回退历史 seed
  var key = CONFIG.FARM_JSON_ENCODE_KEY || "";
  if (key) {
    var start = farmTime % 10;
    var sub = key.substring(start);
    return md5(String(farmTime) + sub);
  }
  var seed = "sdoit78sdopig7w34057";
  var start2 = (farmTime % 10) + 1;
  var sub2 = seed.substr(start2, 20);
  return md5(String(farmTime) + sub2);
}

// 旧版 farmKey 的最小 MD5（仅 ASCII），需要时可替换。
function md5(input) {
  var str = input === null || input === undefined ? "" : String(input);
  if (IS_NODE) {
    try {
      var crypto = require("crypto");
      return crypto.createHash("md5").update(str).digest("hex");
    } catch (e) {
      // fallback to pure JS
    }
  }
  return md5Browser(str);
}

function md5Browser(str) {
  return rstr2hex(rstrMD5(str2rstrUTF8(str)));
}

function rstrMD5(s) {
  return binl2rstr(binlMD5(rstr2binl(s), s.length * 8));
}

function rstr2hex(input) {
  var hexTab = "0123456789abcdef";
  var output = "";
  var x;
  for (var i = 0; i < input.length; i++) {
    x = input.charCodeAt(i);
    output += hexTab.charAt((x >>> 4) & 0x0f) + hexTab.charAt(x & 0x0f);
  }
  return output;
}

function str2rstrUTF8(input) {
  return unescape(encodeURIComponent(input));
}

function rstr2binl(input) {
  var output = Array((input.length + 3) >> 2);
  for (var i = 0; i < output.length; i++) output[i] = 0;
  for (var j = 0; j < input.length; j++) {
    output[j >> 2] |= input.charCodeAt(j) << ((j % 4) * 8);
  }
  return output;
}

function binl2rstr(input) {
  var output = "";
  for (var i = 0; i < input.length * 32; i += 8) {
    output += String.fromCharCode((input[i >> 5] >>> (i % 32)) & 0xff);
  }
  return output;
}

function binlMD5(x, len) {
  x[len >> 5] |= 0x80 << len % 32;
  x[(((len + 64) >>> 9) << 4) + 14] = len;

  var a = 1732584193;
  var b = -271733879;
  var c = -1732584194;
  var d = 271733878;

  for (var i = 0; i < x.length; i += 16) {
    var olda = a;
    var oldb = b;
    var oldc = c;
    var oldd = d;

    a = md5ff(a, b, c, d, x[i + 0], 7, -680876936);
    d = md5ff(d, a, b, c, x[i + 1], 12, -389564586);
    c = md5ff(c, d, a, b, x[i + 2], 17, 606105819);
    b = md5ff(b, c, d, a, x[i + 3], 22, -1044525330);
    a = md5ff(a, b, c, d, x[i + 4], 7, -176418897);
    d = md5ff(d, a, b, c, x[i + 5], 12, 1200080426);
    c = md5ff(c, d, a, b, x[i + 6], 17, -1473231341);
    b = md5ff(b, c, d, a, x[i + 7], 22, -45705983);
    a = md5ff(a, b, c, d, x[i + 8], 7, 1770035416);
    d = md5ff(d, a, b, c, x[i + 9], 12, -1958414417);
    c = md5ff(c, d, a, b, x[i + 10], 17, -42063);
    b = md5ff(b, c, d, a, x[i + 11], 22, -1990404162);
    a = md5ff(a, b, c, d, x[i + 12], 7, 1804603682);
    d = md5ff(d, a, b, c, x[i + 13], 12, -40341101);
    c = md5ff(c, d, a, b, x[i + 14], 17, -1502002290);
    b = md5ff(b, c, d, a, x[i + 15], 22, 1236535329);

    a = md5gg(a, b, c, d, x[i + 1], 5, -165796510);
    d = md5gg(d, a, b, c, x[i + 6], 9, -1069501632);
    c = md5gg(c, d, a, b, x[i + 11], 14, 643717713);
    b = md5gg(b, c, d, a, x[i + 0], 20, -373897302);
    a = md5gg(a, b, c, d, x[i + 5], 5, -701558691);
    d = md5gg(d, a, b, c, x[i + 10], 9, 38016083);
    c = md5gg(c, d, a, b, x[i + 15], 14, -660478335);
    b = md5gg(b, c, d, a, x[i + 4], 20, -405537848);
    a = md5gg(a, b, c, d, x[i + 9], 5, 568446438);
    d = md5gg(d, a, b, c, x[i + 14], 9, -1019803690);
    c = md5gg(c, d, a, b, x[i + 3], 14, -187363961);
    b = md5gg(b, c, d, a, x[i + 8], 20, 1163531501);
    a = md5gg(a, b, c, d, x[i + 13], 5, -1444681467);
    d = md5gg(d, a, b, c, x[i + 2], 9, -51403784);
    c = md5gg(c, d, a, b, x[i + 7], 14, 1735328473);
    b = md5gg(b, c, d, a, x[i + 12], 20, -1926607734);

    a = md5hh(a, b, c, d, x[i + 5], 4, -378558);
    d = md5hh(d, a, b, c, x[i + 8], 11, -2022574463);
    c = md5hh(c, d, a, b, x[i + 11], 16, 1839030562);
    b = md5hh(b, c, d, a, x[i + 14], 23, -35309556);
    a = md5hh(a, b, c, d, x[i + 1], 4, -1530992060);
    d = md5hh(d, a, b, c, x[i + 4], 11, 1272893353);
    c = md5hh(c, d, a, b, x[i + 7], 16, -155497632);
    b = md5hh(b, c, d, a, x[i + 10], 23, -1094730640);
    a = md5hh(a, b, c, d, x[i + 13], 4, 681279174);
    d = md5hh(d, a, b, c, x[i + 0], 11, -358537222);
    c = md5hh(c, d, a, b, x[i + 3], 16, -722521979);
    b = md5hh(b, c, d, a, x[i + 6], 23, 76029189);
    a = md5hh(a, b, c, d, x[i + 9], 4, -640364487);
    d = md5hh(d, a, b, c, x[i + 12], 11, -421815835);
    c = md5hh(c, d, a, b, x[i + 15], 16, 530742520);
    b = md5hh(b, c, d, a, x[i + 2], 23, -995338651);

    a = md5ii(a, b, c, d, x[i + 0], 6, -198630844);
    d = md5ii(d, a, b, c, x[i + 7], 10, 1126891415);
    c = md5ii(c, d, a, b, x[i + 14], 15, -1416354905);
    b = md5ii(b, c, d, a, x[i + 5], 21, -57434055);
    a = md5ii(a, b, c, d, x[i + 12], 6, 1700485571);
    d = md5ii(d, a, b, c, x[i + 3], 10, -1894986606);
    c = md5ii(c, d, a, b, x[i + 10], 15, -1051523);
    b = md5ii(b, c, d, a, x[i + 1], 21, -2054922799);
    a = md5ii(a, b, c, d, x[i + 8], 6, 1873313359);
    d = md5ii(d, a, b, c, x[i + 15], 10, -30611744);
    c = md5ii(c, d, a, b, x[i + 6], 15, -1560198380);
    b = md5ii(b, c, d, a, x[i + 13], 21, 1309151649);
    a = md5ii(a, b, c, d, x[i + 4], 6, -145523070);
    d = md5ii(d, a, b, c, x[i + 11], 10, -1120210379);
    c = md5ii(c, d, a, b, x[i + 2], 15, 718787259);
    b = md5ii(b, c, d, a, x[i + 9], 21, -343485551);

    a = safeAdd(a, olda);
    b = safeAdd(b, oldb);
    c = safeAdd(c, oldc);
    d = safeAdd(d, oldd);
  }

  return [a, b, c, d];
}

function md5cmn(q, a, b, x, s, t) {
  return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
}

function md5ff(a, b, c, d, x, s, t) {
  return md5cmn((b & c) | (~b & d), a, b, x, s, t);
}

function md5gg(a, b, c, d, x, s, t) {
  return md5cmn((b & d) | (c & ~d), a, b, x, s, t);
}

function md5hh(a, b, c, d, x, s, t) {
  return md5cmn(b ^ c ^ d, a, b, x, s, t);
}

function md5ii(a, b, c, d, x, s, t) {
  return md5cmn(c ^ (b | ~d), a, b, x, s, t);
}

function safeAdd(x, y) {
  var lsw = (x & 0xffff) + (y & 0xffff);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xffff);
}

function bitRotateLeft(num, cnt) {
  return (num << cnt) | (num >>> (32 - cnt));
}

function buildLegacyBody(params) {
  var arr = [];
  for (var k in params) {
    if (!params.hasOwnProperty(k)) continue;
    arr.push(encodeURIComponent(k) + "=" + encodeURIComponent(params[k]));
  }
  return arr.join("&");
}

function buildModernBody(params) {
  return buildLegacyBody(params);
}

function pickMode(cookie) {
  if (CONFIG.MODE === "modern" || CONFIG.MODE === "legacy") return CONFIG.MODE;
  // 自动：先尝试现代接口，再尝试旧接口
  return "auto";
}

function isFarmJson(json) {
  return json && json.farmlandStatus && json.user;
}

function toNumericKeyArray(v) {
  if (!v || typeof v !== "object") return null;
  if (Object.prototype.toString.call(v) === "[object Array]") return v;
  var keys = Object.keys(v);
  if (!keys.length) return [];
  var pairs = [];
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (k === "length") continue;
    if (!/^\d+$/.test(k)) return null;
    pairs.push({ idx: parseInt(k, 10), val: v[k] });
  }
  if (!pairs.length) return [];
  pairs.sort(function (a, b) {
    return a.idx - b.idx;
  });
  var out = [];
  for (var j = 0; j < pairs.length; j++) out.push(pairs[j].val);
  return out;
}

function ensureArray(v) {
  if (Object.prototype.toString.call(v) === "[object Array]") return v;
  var converted = toNumericKeyArray(v);
  return converted || [];
}

function uniqLinks(list) {
  var seen = {};
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var link = list[i];
    if (seen[link]) continue;
    seen[link] = true;
    out.push(link);
  }
  return out;
}

function collectDeadPlaces(farm) {
  var list = ensureArray(farm && farm.farmlandStatus);
  var places = [];
  for (var i = 0; i < list.length; i++) {
    var land = list[i];
    if (!land) continue;
    if (isLandLocked(land)) continue;
    var idx = i;
    if (isLandWithered(land)) places.push(idx);
  }
  return places;
}

function pushAction(list, action) {
  list.push(action);
}

function actionSummaryLine() {
  return (
    "收获=" +
    ACTION_STATS.harvest +
    " 翻地=" +
    ACTION_STATS.scarify +
    " 种植=" +
    PLANT_STATS.total +
    " 除草=" +
    ACTION_STATS.clearWeed +
    " 除虫=" +
    ACTION_STATS.spraying +
    " 浇水=" +
    ACTION_STATS.water +
    " 错误=" +
    ACTION_STATS.errors
  );
}

function formatActionTriplet(label, success, tried, noop) {
  var out = label + "=" + success;
  if (tried || noop) {
    out += " (尝试" + tried;
    if (noop) out += "，无动作" + noop;
    out += ")";
  }
  return out;
}

function formatCountWithUnknown(known, unknown) {
  var base = Number(known || 0);
  var extra = Number(unknown || 0);
  if (!extra) return String(base);
  return base + "(+未知" + extra + ")";
}

function farmActionDetailLine() {
  var line1 = [
    formatActionTriplet("收获果实", ACTION_STATS.harvest, ACTION_TRY.harvest, ACTION_NOOP.harvest),
    formatActionTriplet("翻地", ACTION_STATS.scarify, ACTION_TRY.scarify, ACTION_NOOP.scarify),
    formatActionTriplet("种植", PLANT_STATS.total, ACTION_TRY.plant, ACTION_NOOP.plant)
  ].join("；");
  var line2 = [
    formatActionTriplet("除草", ACTION_STATS.clearWeed, ACTION_TRY.clearWeed, ACTION_NOOP.clearWeed),
    formatActionTriplet("除虫", ACTION_STATS.spraying, ACTION_TRY.spraying, ACTION_NOOP.spraying),
    formatActionTriplet("浇水", ACTION_STATS.water, ACTION_TRY.water, ACTION_NOOP.water)
  ].join("；");
  return ["农场动作: " + line1, "维护动作: " + line2];
}

function ranchSummaryLine() {
  return (
    "收获=" +
    formatCountWithUnknown(RANCH_STATS.harvest, RANCH_STATS.harvestUnknown) +
    " 喂草=" +
    RANCH_STATS.feed +
    " 清理=" +
    RANCH_STATS.help +
    " 生产=" +
    RANCH_STATS.product +
    " 售卖=" +
    RANCH_STATS.sell +
    " 签到=" +
    RANCH_STATS.signin +
    " 错误=" +
    RANCH_STATS.errors
  );
}

function ranchFeedStateSummaryLine() {
  var start = RANCH_FEED_STATE.start;
  var end = RANCH_FEED_STATE.end || start;
  return "开始:" + formatRanchFeedInfoLine(start) + " | 结束:" + formatRanchFeedInfoLine(end);
}

function fishSummaryLine() {
  var line =
    "喂鱼=" +
    FISH_STATS.feed +
    " 收获=" +
    FISH_STATS.harvest +
    " 放养=" +
    FISH_STATS.plant +
    " 售卖=" +
    FISH_STATS.sell +
    " 购买=" +
    FISH_STATS.buy +
    " 错误=" +
    FISH_STATS.errors;
  line += " 合成=" + FISH_STATS.compose + " 抽奖=" + FISH_STATS.pearlDraw + " 扣珠=" + FISH_STATS.pearlSpend;
  return line;
}

function hiveSummaryLine() {
  return (
    "收蜜=" +
    HIVE_STATS.harvest +
    " 升级=" +
    HIVE_STATS.upgrade +
    " 喂粉=" +
    HIVE_STATS.pollen +
    " 放蜂=" +
    HIVE_STATS.work +
    " 蜂蜜=" +
    HIVE_STATS.honey +
    " 错误=" +
    HIVE_STATS.errors
  );
}

function timeFarmSummaryLine() {
  var line =
    "收获=" +
    TIME_FARM_STATS.harvest +
    " 铲地=" +
    TIME_FARM_STATS.dig +
    " 种植=" +
    TIME_FARM_STATS.plant +
    " 施肥=" +
    TIME_FARM_STATS.fertilize +
    " 领奖=" +
    TIME_FARM_STATS.taskClaim +
    " 错误=" +
    TIME_FARM_STATS.errors;
  if (TIME_FARM_STATS.taskReward) line += " 奖励[" + TIME_FARM_STATS.taskReward + "]";
  return line;
}

function moduleEmoji(name) {
  if (name === "农场作物+经验") return "🌾";
  if (name === "农场作物") return "🌾";
  if (name === "农场经验") return "📈";
  if (name === "牧场动物+经验") return "🐮";
  if (name === "牧场动物") return "🐮";
  if (name === "牧场经验") return "📈";
  if (name === "牧草果实") return "🌿";
  if (name === "持有金币") return "💰";
  if (name === "鱼塘养鱼") return "🐟";
  if (name === "时光农场") return "🕰️";
  if (name === "蜂巢采蜜") return "🐝";
  return "";
}

function moduleTag(name) {
  var em = moduleEmoji(name);
  return "【" + (em ? em + " " : "") + name + "】";
}

function moduleLine(name, text) {
  return moduleTag(name) + (text || "无");
}

function plainStatusText(items) {
  return formatStatusLine("", items).replace(/^:\s*/, "");
}

function timeFarmStateText(sum, stateText) {
  if (stateText) return stateText;
  if (sum && sum.total !== undefined) return formatTimeFarmState(sum);
  return "未知";
}

function formatLevelExpStatus(stats) {
  if (!stats) return "未知";
  var lv = stats.level != null ? String(stats.level) : "未知";
  var cur = stats.expCur != null ? String(stats.expCur) : "?";
  var total = stats.expTotal != null ? String(stats.expTotal) : "?";
  return "Lv" + lv + " " + cur + "/" + total;
}

function formatMoneyStatus(stats) {
  if (!stats || stats.money == null) return "未知";
  return String(stats.money);
}

function appendTextPart(base, addon, sep) {
  var b = normalizeSpace(base || "");
  var a = normalizeSpace(addon || "");
  if (!a) return b;
  if (!b) return a;
  return b + (sep || "；") + a;
}

function farmEventStatusLine() {
  var parts = [];
  if (FARM_EVENT_STATS.seedTerm > 0) {
    var seedLine =
      "节气 第" +
        FARM_EVENT_STATS.seedTerm +
        "节气 第" +
        FARM_EVENT_STATS.seedRound +
        "轮 可领" +
        FARM_EVENT_STATS.seedCanClaim;
    if (FARM_EVENT_STATS.seedTodayClaimed > 0) seedLine += " 今日已领";
    parts.push(seedLine);
  }
  if (FARM_EVENT_STATS.bulingCanClaim > 0 || FARM_EVENT_STATS.bulingClaim > 0) {
    parts.push("补领 可领" + FARM_EVENT_STATS.bulingCanClaim + " 已领" + FARM_EVENT_STATS.bulingClaim);
  }
  if (FARM_EVENT_STATS.wishStatus >= 0) {
    var selfStart = FARM_EVENT_STATS.wishSelfStart >= 0 ? FARM_EVENT_STATS.wishSelfStart : 0;
    var selfEnd = FARM_EVENT_STATS.wishSelfEnd >= 0 ? FARM_EVENT_STATS.wishSelfEnd : selfStart;
    var pStart = FARM_EVENT_STATS.wishProgressStart >= 0 ? FARM_EVENT_STATS.wishProgressStart : 0;
    var pEnd = FARM_EVENT_STATS.wishProgressEnd >= 0 ? FARM_EVENT_STATS.wishProgressEnd : pStart;
    var pMax = Number(FARM_EVENT_STATS.wishProgressMax || 0) || 0;
    parts.push(
      "许愿 状态" +
        FARM_EVENT_STATS.wishStatus +
        " 进度" +
        pStart +
        "→" +
        pEnd +
        (pMax > 0 ? "/" + pMax : "") +
        " 自助" +
        selfStart +
        "→" +
        selfEnd +
        " 待领奖" +
        FARM_EVENT_STATS.wishStarEnd
    );
  }
  if (FARM_EVENT_STATS.day7Days > 0 || FARM_EVENT_STATS.day7Flag > 0) {
    parts.push("七日 天数" + FARM_EVENT_STATS.day7Days + " 标记" + FARM_EVENT_STATS.day7Flag);
  }
  return parts.join("；");
}

function farmEventSummaryLine() {
  var parts = [];
  parts.push("节气领" + FARM_EVENT_STATS.seedClaim);
  parts.push("补领" + FARM_EVENT_STATS.bulingClaim);
  if (FARM_EVENT_STATS.wishStatus >= 0) {
    parts.push("许愿收星" + FARM_EVENT_STATS.wishCollect);
    parts.push("许愿抽星" + FARM_EVENT_STATS.wishRandom);
    parts.push("许愿领奖" + FARM_EVENT_STATS.wishStarClaim);
    parts.push("许愿收获" + FARM_EVENT_STATS.wishHarvest);
    parts.push("许愿种下" + FARM_EVENT_STATS.wishPlant);
    parts.push("许愿点星" + FARM_EVENT_STATS.wishUpgrade);
    parts.push("许愿助力" + FARM_EVENT_STATS.wishHelp);
  }
  if (FARM_EVENT_STATS.busy > 0) parts.push("活动忙" + FARM_EVENT_STATS.busy);
  if (FARM_EVENT_STATS.seedReward) parts.push("节气奖励[" + FARM_EVENT_STATS.seedReward + "]");
  if (FARM_EVENT_STATS.bulingReward) parts.push("补领奖励[" + FARM_EVENT_STATS.bulingReward + "]");
  if (FARM_EVENT_STATS.wishReward) parts.push("许愿奖励[" + FARM_EVENT_STATS.wishReward + "]");
  return parts.join(" ");
}

function farmEventChangeLine() {
  var parts = [];
  if (FARM_EVENT_STATS.seedClaim > 0) parts.push("节气领取+" + FARM_EVENT_STATS.seedClaim);
  if (FARM_EVENT_STATS.bulingClaim > 0) parts.push("补领+" + FARM_EVENT_STATS.bulingClaim);
  if (FARM_EVENT_STATS.wishCollect > 0) parts.push("许愿收星+" + FARM_EVENT_STATS.wishCollect);
  if (FARM_EVENT_STATS.wishRandom > 0) parts.push("许愿抽星+" + FARM_EVENT_STATS.wishRandom);
  if (FARM_EVENT_STATS.wishStarClaim > 0) parts.push("许愿领奖+" + FARM_EVENT_STATS.wishStarClaim);
  if (FARM_EVENT_STATS.wishHarvest > 0) parts.push("许愿收获+" + FARM_EVENT_STATS.wishHarvest);
  if (FARM_EVENT_STATS.wishPlant > 0) parts.push("许愿种下+" + FARM_EVENT_STATS.wishPlant);
  if (FARM_EVENT_STATS.wishUpgrade > 0) parts.push("许愿点星+" + FARM_EVENT_STATS.wishUpgrade);
  if (FARM_EVENT_STATS.wishHelp > 0) parts.push("许愿助力+" + FARM_EVENT_STATS.wishHelp);
  if (FARM_EVENT_STATS.busy > 0) parts.push("活动繁忙" + FARM_EVENT_STATS.busy + "次");
  if (FARM_EVENT_STATS.seedReward) parts.push("节气奖励[" + FARM_EVENT_STATS.seedReward + "]");
  if (FARM_EVENT_STATS.bulingReward) parts.push("补领奖励[" + FARM_EVENT_STATS.bulingReward + "]");
  if (FARM_EVENT_STATS.wishReward) parts.push("许愿奖励[" + FARM_EVENT_STATS.wishReward + "]");
  if (!parts.length) return "活动无领取";
  return parts.join("；");
}

function formatExpOnlyLine(label, start, end) {
  if (!end) return label + "：等级/经验 未知";
  var level = end.level != null ? String(end.level) : "未知";
  if (start && start.level != null && end.level != null) {
    var dl = end.level - start.level;
    if (dl > 0) level += "(↑" + dl + ")";
    else if (dl < 0) level += "(↓" + Math.abs(dl) + ")";
  }
  var expStr = "经验未知";
  var expDelta = "未知";
  if (end.expCur != null && end.expTotal != null) {
    expStr = end.expCur + "/" + end.expTotal;
    if (start && start.level === end.level && start.expCur != null) {
      expDelta = formatDelta(end.expCur - start.expCur);
    } else if (start && start.level != null && end.level != null && start.level !== end.level) {
      expDelta = "等级变化";
    }
  }
  return label + "：Lv" + level + " " + expStr + "(Δ" + expDelta + ")";
}

function grassHarvestCount() {
  var sum = 0;
  for (var k in HARVEST_DETAIL.byName) {
    if (!HARVEST_DETAIL.byName.hasOwnProperty(k)) continue;
    var display = harvestDisplayName(k);
    if (display !== "牧草") continue;
    sum += Number(HARVEST_DETAIL.byName[k] || 0) || 0;
  }
  return sum;
}

function statusModuleFarmLine() {
  var base = "开始:" + formatFarmStatusLine(STATUS_START.farm) + " | 结束:" + formatFarmStatusLine(STATUS_END.farm);
  return appendTextPart(base, farmEventStatusLine(), "；");
}

function statusModuleFarmExpLine() {
  return "开始:" + formatLevelExpStatus(STATS_START.farm) + " | 结束:" + formatLevelExpStatus(STATS_END.farm);
}

function statusModuleRanchLine() {
  return "开始:" + plainStatusText(STATUS_START.ranch) + " | 结束:" + plainStatusText(STATUS_END.ranch);
}

function statusModuleRanchExpLine() {
  return "开始:" + formatLevelExpStatus(STATS_START.ranch) + " | 结束:" + formatLevelExpStatus(STATS_END.ranch);
}

function statusModuleGrassLine() {
  return (
    "开始:" +
    formatRanchFeedInfoLine(RANCH_FEED_STATE.start) +
    " | 结束:" +
    formatRanchFeedInfoLine(RANCH_FEED_STATE.end || RANCH_FEED_STATE.start)
  );
}

function statusModuleMoneyLine() {
  return "开始:" + formatMoneyStatus(STATS_START.farm) + " | 结束:" + formatMoneyStatus(STATS_END.farm);
}

function statusModuleFishLine() {
  return "开始:" + plainStatusText(STATUS_START.fish) + " | 结束:" + plainStatusText(STATUS_END.fish);
}

function statusModuleTimeFarmLine() {
  if (!timeFarmEnabled()) return "未启用";
  var start = timeFarmStateText(TIME_FARM_STATS.startSum, TIME_FARM_STATS.start);
  var end = timeFarmStateText(TIME_FARM_STATS.endSum || TIME_FARM_STATS.startSum, TIME_FARM_STATS.end || TIME_FARM_STATS.start);
  var line = "开始:" + start + " | 结束:" + end;
  if (TIME_FARM_STATS.taskStart || TIME_FARM_STATS.taskEnd) {
    line +=
      "；任务 开始:" +
      (TIME_FARM_STATS.taskStart || "无") +
      " | 结束:" +
      (TIME_FARM_STATS.taskEnd || TIME_FARM_STATS.taskStart || "无");
  }
  return line;
}

function statusModuleHiveLine() {
  if (!hiveEnabled()) return "未启用";
  var start = HIVE_STATS.start || "未知";
  var end = HIVE_STATS.end || HIVE_STATS.start || "未知";
  return "开始:" + start + " | 结束:" + end;
}

function summaryModuleFarmLine() {
  var base =
    "收" +
    ACTION_STATS.harvest +
    " 翻" +
    ACTION_STATS.scarify +
    " 种" +
    PLANT_STATS.total +
    " 除" +
    ACTION_STATS.clearWeed +
    " 虫" +
    ACTION_STATS.spraying +
    " 水" +
    ACTION_STATS.water +
    " 售" +
    FARM_EXTRA.sell +
    " 签" +
    FARM_EXTRA.signin +
    " 错" +
    ACTION_STATS.errors;
  base = appendTextPart(base, farmEventSummaryLine(), " ");
  if (FARM_EVENT_STATS.errors > 0) base += " 活动错" + FARM_EVENT_STATS.errors;
  return base;
}

function summaryModuleFarmExpLine() {
  return formatExpOnlyLine("农场", STATS_START.farm, STATS_END.farm);
}

function summaryModuleRanchLine() {
  return (
    "收" +
    formatCountWithUnknown(RANCH_STATS.harvest, RANCH_STATS.harvestUnknown) +
    " 喂" +
    RANCH_STATS.feed +
    " 清" +
    RANCH_STATS.help +
    " 产" +
    RANCH_STATS.product +
    " 售" +
    RANCH_STATS.sell +
    " 签" +
    RANCH_STATS.signin +
    " 错" +
    RANCH_STATS.errors
  );
}

function summaryModuleRanchExpLine() {
  return formatExpOnlyLine("牧场", STATS_START.ranch, STATS_END.ranch);
}

function summaryModuleGrassLine() {
  var parts = ["喂草" + RANCH_STATS.feed];
  var grass = grassHarvestCount();
  if (grass > 0) parts.push("收牧草" + grass);
  if (MONEY_STATS.grassBuy > 0) parts.push("购牧草种子" + MONEY_STATS.grassBuy);
  parts.push("结束" + formatRanchFeedInfoLine(RANCH_FEED_STATE.end || RANCH_FEED_STATE.start));
  return parts.join(" ");
}

function summaryModuleMoneyLine() {
  var spendParts = [];
  var purchaseLine = summarizePurchases();
  if (MONEY_STATS.farmBuy > 0) spendParts.push("种子" + MONEY_STATS.farmBuy);
  if (MONEY_STATS.grassBuy > 0) spendParts.push("牧草种子" + MONEY_STATS.grassBuy);
  if (MONEY_STATS.fishBuy > 0) spendParts.push("鱼苗" + MONEY_STATS.fishBuy);
  if (MONEY_STATS.fishFeed > 0) spendParts.push("鱼食" + MONEY_STATS.fishFeed);
  var line =
    "持有" +
    formatMoneyStatus(STATS_END.farm) +
    " 卖出 农" +
    MONEY_STATS.farmSell +
    " 牧" +
    MONEY_STATS.ranchSell +
    " 鱼" +
    MONEY_STATS.fishSell;
  if (spendParts.length) line += " | 花费 " + spendParts.join(" ");
  if (purchaseLine) line += " | 购买[" + purchaseLine + "]";
  return line;
}

function summaryModuleFishLine() {
  var composeDetail = formatFishComposeItems(4);
  var line =
    "喂" +
    FISH_STATS.feed +
    " 收" +
    FISH_STATS.harvest +
    " 放" +
    FISH_STATS.plant +
    " 买" +
    FISH_STATS.buy +
    " 卖" +
    FISH_STATS.sell +
    " 合" +
    FISH_STATS.compose +
    " 抽" +
    FISH_STATS.pearlDraw +
    " 扣珠" +
    FISH_STATS.pearlSpend +
    " 错" +
    FISH_STATS.errors;
  if (composeDetail) line += " 合成[" + composeDetail + "]";
  if (FISH_STATS.pearlGain) line += " 奖励[" + FISH_STATS.pearlGain + "]";
  return line;
}

function summaryModuleTimeFarmLine() {
  if (!timeFarmEnabled()) return "未启用";
  var line =
    "收" +
    TIME_FARM_STATS.harvest +
    " 铲" +
    TIME_FARM_STATS.dig +
    " 种" +
    TIME_FARM_STATS.plant +
    " 肥" +
    TIME_FARM_STATS.fertilize +
    " 领奖" +
    TIME_FARM_STATS.taskClaim +
    " 错" +
    TIME_FARM_STATS.errors;
  if (TIME_FARM_STATS.taskReward) line += " 奖励[" + TIME_FARM_STATS.taskReward + "]";
  return line;
}

function summaryModuleHiveLine() {
  if (!hiveEnabled()) return "未启用";
  return (
    "收蜜" +
    HIVE_STATS.harvest +
    " 升级" +
    HIVE_STATS.upgrade +
    " 喂粉" +
    HIVE_STATS.pollen +
    " 放蜂" +
    HIVE_STATS.work +
    " 蜂蜜" +
    HIVE_STATS.honey +
    " 错" +
    HIVE_STATS.errors
  );
}

function countFishHarvestableStatus(list) {
  if (!list || !list.length) return 0;
  var n = 0;
  for (var i = 0; i < list.length; i++) {
    var st = normalizeSpace((list[i] && list[i].status) || "");
    if (!st) continue;
    if (/至收获期/.test(st)) continue;
    if (/(鱼苗期|幼鱼期|成鱼期|成熟期)/.test(st)) continue;
    if (/(可收|待收|收获|已成熟)/.test(st)) n += 1;
  }
  return n;
}

function formatRanchFeedChangeLine() {
  var start = RANCH_FEED_STATE.start || {};
  var end = RANCH_FEED_STATE.end || RANCH_FEED_STATE.start || {};
  var parts = [];
  var hasSlotInfo = start.n != null || end.n != null || start.cap != null || end.cap != null;
  var hasStoreInfo = start.total != null || end.total != null;
  if (hasSlotInfo) {
    var sCap = start.cap !== null && start.cap !== undefined ? start.cap : 1000;
    var eCap = end.cap !== null && end.cap !== undefined ? end.cap : sCap;
    var sSlot = start.n !== null && start.n !== undefined ? start.n + "/" + sCap : "?/" + sCap;
    var eSlot = end.n !== null && end.n !== undefined ? end.n + "/" + eCap : "?/" + eCap;
    if (
      start.n !== null &&
      start.n !== undefined &&
      end.n !== null &&
      end.n !== undefined &&
      start.n === end.n &&
      sCap === eCap
    ) {
      parts.push("饲料槽 " + eSlot + "（无变化）");
    } else {
      var slotDelta =
        start.n !== null && start.n !== undefined && end.n !== null && end.n !== undefined
          ? " (Δ" + formatDelta(end.n - start.n) + ")"
          : "";
      parts.push("饲料槽 " + sSlot + "→" + eSlot + slotDelta);
    }
  }
  if (hasStoreInfo) {
    var sStore = start.total !== null && start.total !== undefined ? String(start.total) : "?";
    var eStore = end.total !== null && end.total !== undefined ? String(end.total) : "?";
    if (
      start.total !== null &&
      start.total !== undefined &&
      end.total !== null &&
      end.total !== undefined &&
      start.total === end.total
    ) {
      parts.push("仓库牧草 " + eStore + "（无变化）");
    } else {
      var storeDelta =
        start.total !== null &&
        start.total !== undefined &&
        end.total !== null &&
        end.total !== undefined
          ? " (Δ" + formatDelta(end.total - start.total) + ")"
          : "";
      parts.push("仓库牧草 " + sStore + "→" + eStore + storeDelta);
    }
  }
  return parts.join("；");
}

function changeModuleFarmLine() {
  var parts = [];
  var farmDeltaLine = formatFarmStatusDelta(STATUS_START.farm, STATUS_END.farm, false);
  var harvestableDelta = formatHarvestableDelta(STATUS_START.farm, STATUS_END.farm);
  var witheredRecon = formatWitheredRecon(STATUS_START.farm, STATUS_END.farm);
  var emptyRecon = formatEmptyPlantRecon(STATUS_START.farm, STATUS_END.farm);
  var harvestDetail = buildHarvestDetailLine(6);
  var harvestTypeCount = getHarvestTypeCount();
  var harvestDetailLine = "";
  if (harvestDetail) {
    harvestDetailLine = (harvestTypeCount ? harvestTypeCount + "种 | " : "") + harvestDetail;
  }
  var plantFailLine = buildPlantFailLine();
  var plantSkipLine = buildPlantSkipLine();

  parts.push("状态Δ " + (farmDeltaLine || "无变化"));
  if (harvestableDelta) parts.push(harvestableDelta.replace(/^可收地块:\s*/, "可收 "));
  if (witheredRecon) parts.push("枯萎 " + witheredRecon);
  if (emptyRecon) parts.push("空地 " + emptyRecon);
  if (harvestDetailLine) parts.push("收获[" + harvestDetailLine + "]");
  if (plantSkipLine) parts.push("播种未执行[" + plantSkipLine + "]");
  if (plantFailLine) parts.push("播种失败[" + plantFailLine + "]");
  parts.push("活动[" + farmEventChangeLine() + "]");
  return parts.join("；");
}

function changeModuleFarmExpLine() {
  return formatExpOnlyLine("农场", STATS_START.farm, STATS_END.farm);
}

function changeModuleRanchLine() {
  var parts = [];
  var sHarvestable = summarizeRanchHarvestable(STATUS_START.ranch).total;
  var eHarvestable = summarizeRanchHarvestable(STATUS_END.ranch).total;
  parts.push("可收 开始" + sHarvestable + " 结束" + eHarvestable + " Δ" + formatDelta(eHarvestable - sHarvestable));
  return parts.join("；");
}

function changeModuleRanchExpLine() {
  return formatExpOnlyLine("牧场", STATS_START.ranch, STATS_END.ranch);
}

function changeModuleFishLine() {
  var parts = [];
  var startOcc = countStatusItems(STATUS_START.fish);
  var endOcc = countStatusItems(STATUS_END.fish);
  var startHarvestable = countFishHarvestableStatus(STATUS_START.fish);
  var endHarvestable = countFishHarvestableStatus(STATUS_END.fish);
  var composeDetail = formatFishComposeItems(6);
  parts.push("占用 开始" + startOcc + " 结束" + endOcc + " Δ" + formatDelta(endOcc - startOcc));
  parts.push("可收 开始" + startHarvestable + " 结束" + endHarvestable + " Δ" + formatDelta(endHarvestable - startHarvestable));
  if (composeDetail) parts.push("合成[" + composeDetail + "]");
  if (FISH_STATS.pearlGain) parts.push("珍珠奖励[" + FISH_STATS.pearlGain + "]");
  if (FISH_STATS.feedUsed > 0) parts.push("鱼食消耗 " + (FISH_STATS.feedItem || "鱼食") + "×" + FISH_STATS.feedUsed + "袋");
  return parts.join("；");
}

function changeModuleGrassLine() {
  var parts = [];
  var feedDelta = formatRanchFeedChangeLine();
  if (feedDelta) parts.push(feedDelta);
  else parts.push("无变化");
  var grass = grassHarvestCount();
  if (grass > 0) parts.push("收获牧草" + grass);
  if (MONEY_STATS.grassBuy > 0) parts.push("购买牧草种子" + MONEY_STATS.grassBuy);
  return parts.join("；");
}

function changeModuleMoneyLine() {
  var parts = [];
  var s = STATS_START.farm && STATS_START.farm.money != null ? Number(STATS_START.farm.money) : null;
  var e = STATS_END.farm && STATS_END.farm.money != null ? Number(STATS_END.farm.money) : null;
  var holdText = "";
  if (s !== null && !isNaN(s) && e !== null && !isNaN(e)) {
    holdText = s === e ? String(e) + "（无变化）" : s + "→" + e + " (Δ" + formatDelta(e - s) + ")";
  } else {
    var ss = formatMoneyStatus(STATS_START.farm);
    var ee = formatMoneyStatus(STATS_END.farm);
    holdText = ss === ee ? ee : ss + "→" + ee;
  }
  var spendParts = [];
  parts.push("持有 " + holdText);
  parts.push("卖出 农" + MONEY_STATS.farmSell + " 牧" + MONEY_STATS.ranchSell + " 鱼" + MONEY_STATS.fishSell);
  if (MONEY_STATS.farmBuy > 0) spendParts.push("种子" + MONEY_STATS.farmBuy);
  if (MONEY_STATS.grassBuy > 0) spendParts.push("牧草种子" + MONEY_STATS.grassBuy);
  if (MONEY_STATS.fishBuy > 0) spendParts.push("鱼苗" + MONEY_STATS.fishBuy);
  if (MONEY_STATS.fishFeed > 0) spendParts.push("鱼食" + MONEY_STATS.fishFeed);
  if (spendParts.length) parts.push("花费 " + spendParts.join(" "));
  var purchaseLine = summarizePurchases();
  if (purchaseLine) parts.push("购买[" + purchaseLine + "]");
  return parts.join("；");
}

function changeModuleTimeFarmLine() {
  if (!timeFarmEnabled()) return "未启用";
  var startSum = TIME_FARM_STATS.startSum;
  var endSum = TIME_FARM_STATS.endSum || TIME_FARM_STATS.startSum;
  var delta = formatTimeFarmDelta(startSum, endSum);
  var emptyHint = buildTimeFarmEmptyHint(startSum, endSum);
  var parts = ["状态Δ " + (delta || "无变化")];
  if (emptyHint) parts.push(emptyHint);
  if (TIME_FARM_STATS.plantSkipReason) parts.push("播种说明[" + TIME_FARM_STATS.plantSkipReason + "]");
  if (TIME_FARM_STATS.taskStart || TIME_FARM_STATS.taskEnd) {
    parts.push(
      "任务 开始:" +
        (TIME_FARM_STATS.taskStart || "无") +
        " 结束:" +
        (TIME_FARM_STATS.taskEnd || TIME_FARM_STATS.taskStart || "无")
    );
  }
  if (TIME_FARM_STATS.taskClaim > 0) parts.push("任务领奖+" + TIME_FARM_STATS.taskClaim);
  if (TIME_FARM_STATS.taskReward) parts.push("任务奖励[" + TIME_FARM_STATS.taskReward + "]");
  return parts.join("；");
}

function extractHiveHoneyFromStateText(text) {
  var t = String(text || "");
  var m = t.match(/蜂蜜\s*([0-9]+)/);
  if (!m) return null;
  var n = Number(m[1]);
  return isNaN(n) ? null : n;
}

function changeModuleHiveLine() {
  if (!hiveEnabled()) return "未启用";
  var parts = [];
  var startHoney = extractHiveHoneyFromStateText(HIVE_STATS.start);
  var endHoney = extractHiveHoneyFromStateText(HIVE_STATS.end || HIVE_STATS.start);
  if (startHoney !== null && endHoney !== null) {
    if (startHoney === endHoney) parts.push("蜂蜜 " + endHoney + "（无变化）");
    else parts.push("蜂蜜 " + startHoney + "→" + endHoney + " (Δ" + formatDelta(endHoney - startHoney) + ")");
  } else if (HIVE_STATS.start || HIVE_STATS.end) {
    parts.push("状态无可比蜂蜜字段");
  } else {
    parts.push("无变化");
  }
  return parts.join("；");
}

function buildModuleSections() {
  return {
    status: [
      moduleLine("农场作物", statusModuleFarmLine()),
      moduleLine("农场经验", statusModuleFarmExpLine()),
      moduleLine("牧草果实", statusModuleGrassLine()),
      moduleLine("牧场动物", statusModuleRanchLine()),
      moduleLine("牧场经验", statusModuleRanchExpLine()),
      moduleLine("持有金币", statusModuleMoneyLine()),
      moduleLine("鱼塘养鱼", statusModuleFishLine()),
      moduleLine("时光农场", statusModuleTimeFarmLine()),
      moduleLine("蜂巢采蜜", statusModuleHiveLine())
    ],
    summary: [
      moduleLine("农场作物", summaryModuleFarmLine()),
      moduleLine("农场经验", summaryModuleFarmExpLine()),
      moduleLine("牧草果实", summaryModuleGrassLine()),
      moduleLine("牧场动物", summaryModuleRanchLine()),
      moduleLine("牧场经验", summaryModuleRanchExpLine()),
      moduleLine("持有金币", summaryModuleMoneyLine()),
      moduleLine("鱼塘养鱼", summaryModuleFishLine()),
      moduleLine("时光农场", summaryModuleTimeFarmLine()),
      moduleLine("蜂巢采蜜", summaryModuleHiveLine())
    ],
    change: [
      moduleLine("农场作物", changeModuleFarmLine()),
      moduleLine("农场经验", changeModuleFarmExpLine()),
      moduleLine("牧草果实", changeModuleGrassLine()),
      moduleLine("牧场动物", changeModuleRanchLine()),
      moduleLine("牧场经验", changeModuleRanchExpLine()),
      moduleLine("持有金币", changeModuleMoneyLine()),
      moduleLine("鱼塘养鱼", changeModuleFishLine()),
      moduleLine("时光农场", changeModuleTimeFarmLine()),
      moduleLine("蜂巢采蜜", changeModuleHiveLine())
    ]
  };
}

function summaryLines() {
  var sec = buildModuleSections();
  var lines = [];
  lines.push("【📋 状态】");
  lines = lines.concat(sec.status);
  lines.push(SUBLINE);
  lines.push("【🧾 汇总】");
  lines = lines.concat(sec.summary);
  lines.push(SUBLINE);
  lines.push("【📈 变化】");
  lines = lines.concat(sec.change);
  return lines;
}

function buildNotifyBody() {
  var totalErr =
    ACTION_STATS.errors +
    RANCH_STATS.errors +
    FISH_STATS.errors +
    HIVE_STATS.errors +
    TIME_FARM_STATS.errors +
    FARM_EVENT_STATS.errors;
  var costMs = RUN_START ? Date.now() - RUN_START : 0;
  var costSec = costMs ? Math.round(costMs / 1000) : 0;
  var sec = buildModuleSections();
  var briefLines = [];
  var costTag = costSec ? costSec + "s" : "未知";
  briefLines.push("✨简报 | ⏱ 用时 " + costTag + " | ⚠️ 错误 " + totalErr);
  briefLines.push("🌾 农场作物 | " + summaryModuleFarmLine());
  briefLines.push("📈 农场经验 | " + summaryModuleFarmExpLine());
  briefLines.push("🌿 牧草果实 | " + summaryModuleGrassLine());
  briefLines.push("🐮 牧场动物 | " + summaryModuleRanchLine());
  briefLines.push("📈 牧场经验 | " + summaryModuleRanchExpLine());
  briefLines.push("💰 持有金币 | " + summaryModuleMoneyLine());
  briefLines.push("🐟 鱼塘养鱼 | " + summaryModuleFishLine());
  briefLines.push("🕰️ 时光农场 | " + summaryModuleTimeFarmLine());
  briefLines.push("🐝 蜂巢采蜜 | " + summaryModuleHiveLine());
  var brief = briefLines.join("\n");
  var detailLines = [];
  detailLines.push("【📋 状态】");
  detailLines = detailLines.concat(sec.status);
  detailLines.push(SUBLINE);
  detailLines.push("【🧾 汇总】");
  detailLines = detailLines.concat(sec.summary);
  detailLines.push(SUBLINE);
  detailLines.push("【📈 变化】");
  detailLines = detailLines.concat(sec.change);
  detailLines.push("⏱ 用时 | " + (costSec ? costSec + "s" : "未知"));
  return [brief, SUBLINE, detailLines.join("\n")].join("\n");
}

function actionLabel(type) {
  if (type === "harvest") return "收获";
  if (type === "scarify") return "翻地";
  if (type === "plant") return "种植";
  if (type === "clearWeed") return "除草";
  if (type === "spraying") return "除虫";
  if (type === "water") return "浇水";
  return type || "未知";
}

function base64Encode(str) {
  if (IS_NODE && typeof Buffer !== "undefined") return Buffer.from(str, "utf8").toString("base64");
  if (typeof $text !== "undefined" && $text.base64Encode) return $text.base64Encode(str);
  if (typeof btoa !== "undefined") {
    return btoa(unescape(encodeURIComponent(str)));
  }
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  var output = "";
  var i = 0;
  while (i < str.length) {
    var c1 = str.charCodeAt(i++);
    var c2 = str.charCodeAt(i++);
    var c3 = str.charCodeAt(i++);
    var e1 = c1 >> 2;
    var e2 = ((c1 & 3) << 4) | (c2 >> 4);
    var e3 = ((c2 & 15) << 2) | (c3 >> 6);
    var e4 = c3 & 63;
    if (isNaN(c2)) {
      e3 = e4 = 64;
    } else if (isNaN(c3)) {
      e4 = 64;
    }
    output +=
      chars.charAt(e1) + chars.charAt(e2) + chars.charAt(e3) + chars.charAt(e4);
  }
  return output;
}

function buildQQOpenUrl(url) {
  return "mqqapi://forward/url?version=1&src_type=web&url_prefix=" + base64Encode(url);
}

var LINE = "";
var SUBLINE = "";

function ranchEnabled() {
  return (
    CONFIG.ENABLE.ranch_harvest ||
    CONFIG.ENABLE.ranch_feed ||
    CONFIG.ENABLE.ranch_help ||
    CONFIG.ENABLE.ranch_product ||
    CONFIG.ENABLE.ranch_sell_all ||
    CONFIG.ENABLE.ranch_signin
  );
}

function fishEnabled() {
  return CONFIG.ENABLE.fish_feed || CONFIG.ENABLE.fish_sell_all || CONFIG.ENABLE.fish_harvest;
}

function hiveEnabled() {
  if (!CONFIG.HIVE_ENABLE) return false;
  return CONFIG.ENABLE.hive !== false;
}

function timeFarmEnabled() {
  if (!CONFIG.TIME_FARM_ENABLE) return false;
  return CONFIG.ENABLE.time_farm !== false;
}

/* =======================
 *  FARM JSON MODE (farmTime/farmKey)
 * ======================= */
function ensureFarmJsonContext(cookie) {
  if (FARM_CTX.uIdx && FARM_CTX.uinY) return Promise.resolve(FARM_CTX);
  var base = CONFIG.FARM_JSON_BASE || "https://nc.qzone.qq.com";
  var uin = getFarmUinFromCookie(cookie) || "";
  return fetchFarmJson(base, cookie, uin)
    .then(function (farm) {
      if (isFarmJson(farm)) return FARM_CTX;
      return null;
    })
    .catch(function (e) {
      if (CONFIG.DEBUG) logDebug("JSON 上下文获取失败: " + errText(e));
      return null;
    });
}

function parseSeedJsonItems(arr) {
  if (!arr || typeof arr.length !== "number") return null;
  var items = [];
  var total = 0;
  var locked = 0;
  for (var i = 0; i < arr.length; i++) {
    var it = arr[i] || {};
    var amount = Number(it.amount || it.num || it.count || 0);
    if (!amount) continue;
    var cid = it.cId != null ? String(it.cId) : "";
    var isLock = Number(it.isLock || it.locked || it.isLocked || it.is_lock || 0) === 1;
    if (isLock) {
      locked += amount;
      continue;
    }
    var name = it.cName || (cid ? "cId" + cid : "种子");
    if (cid) recordCropName(cid, name);
    items.push({ name: name, count: amount, cid: cid });
    total += amount;
  }
  return { items: sortBagItems(items), total: total, locked: locked };
}

function fetchFarmSeedJson(cookie) {
  if (!CONFIG.FARM_JSON_ENABLE || !CONFIG.FARM_JSON_SEED_ENABLE) return Promise.resolve(null);
  return ensureFarmJsonContext(cookie)
    .then(function () {
      var uIdx = getFarmUin(cookie);
      if (!uIdx) {
        log("⚠️ JSON 种子: 缺少 uIdx");
        return null;
      }
      var farmTime = getFarmTime();
      var farmKey = legacyFarmKey(farmTime);
      if (!farmKey) return null;
      var base = CONFIG.FARM_SEED_JSON_BASE || "https://farm.qzone.qq.com";
      var url = base + "/cgi-bin/cgi_farm_getuserseed?mod=repertory&act=getUserSeed";
      var headers = buildFarmSeedJsonHeaders(cookie);
      var body = buildLegacyBody({ uIdx: uIdx, farmTime: farmTime, farmKey: farmKey });
      return httpRequest({ method: "POST", url: url, headers: headers, body: body })
        .then(function (resp) {
          var json = tryJson(resp.body);
          var parsed = parseSeedJsonItems(json);
          if (!parsed) return null;
          parsed.ok = true;
          return parsed;
        })
        .catch(function (e) {
          if (CONFIG.LOG_BAG_STATS || CONFIG.DEBUG) log("🎒 JSON 种子读取失败: " + errText(e));
          return null;
        });
    })
    .catch(function (e) {
      if (CONFIG.LOG_BAG_STATS || CONFIG.DEBUG) log("🎒 JSON 种子上下文失败: " + errText(e));
      return null;
    });
}

function parseCropJsonItems(arr) {
  if (!arr || typeof arr.length !== "number") return null;
  var items = [];
  for (var i = 0; i < arr.length; i++) {
    var it = arr[i] || {};
    var amount = 0;
    var cid = "";
    var name = "";
    var isLock = false;
    if (Object.prototype.toString.call(it) === "[object Array]") {
      // 兼容 cgi_farm_getusercrop?f=1 的数组结构：
      // [cId, cName, amount, price, high_price, level, ext, type, isLock]
      cid = it[0] != null ? String(it[0]) : "";
      name = normalizeCropName(it[1] || "");
      amount = Number(it[2] || 0);
      isLock = Number(it[8] || 0) === 1;
    } else {
      amount = Number(it.amount || it.num || it.count || 0);
      cid = it.cId != null ? String(it.cId) : "";
      name = normalizeCropName(it.cName || "");
      isLock = Number(it.isLock || it.locked || it.isLocked || it.is_lock || 0) === 1;
    }
    if (!name) name = cid ? getCropNameByCid(cid) : "作物";
    if (cid) recordCropName(cid, name);
    items.push({ cid: cid, name: name, amount: amount, isLock: isLock });
  }
  return items;
}

function fetchFarmCropJson(cookie) {
  if (!CONFIG.FARM_JSON_ENABLE || !CONFIG.FARM_JSON_CROP_ENABLE) return Promise.resolve(null);
  return ensureFarmJsonContext(cookie).then(function () {
    var uIdx = getFarmUin(cookie);
    var uinX = FARM_CTX.uinY || getFarmUinFromCookie(cookie) || "";
    if (!uIdx || !uinX) {
      log("⚠️ JSON 仓库: 缺少 uIdx/uinX");
      return null;
    }
    var farmTime = getFarmTime();
    var farmKey = legacyFarmKey(farmTime);
    if (!farmKey) return null;
    var base = CONFIG.FARM_JSON_BASE || "https://nc.qzone.qq.com";
    var url = base + "/cgi-bin/cgi_farm_getusercrop?mod=repertory&act=getUserCrop";
    var headers = buildFarmJsonHeaders(cookie);
    var body = buildLegacyBody({ uIdx: uIdx, uinX: uinX, farmTime: farmTime, farmKey: farmKey });
    return httpRequest({ method: "POST", url: url, headers: headers, body: body })
      .then(function (resp) {
        var json = tryJson(resp.body);
        var items = parseCropJsonItems(json);
        if (!items) return null;
        return { ok: true, items: items };
      })
    .catch(function (e) {
      if (CONFIG.LOG_BAG_STATS || CONFIG.DEBUG) log("🎒 JSON 仓库读取失败: " + errText(e));
      return null;
    });
  }).catch(function (e) {
    if (CONFIG.LOG_BAG_STATS || CONFIG.DEBUG) log("🎒 JSON 仓库上下文失败: " + errText(e));
    return null;
  });
}

function parseSaleAllJsonResult(res) {
  var success = false;
  var money = 0;
  var msg = "";
  if (res && Object.prototype.toString.call(res) === "[object Array]") {
    for (var i = 0; i < res.length; i++) {
      var it = res[i] || {};
      if (!msg && it.direction) msg = String(it.direction);
      var code = it.ret != null ? it.ret : it.code != null ? it.code : it.errcode != null ? it.errcode : null;
      if (typeof code === "number") {
        if (it.ret != null) {
          if (code === 0) success = true;
        } else if (code === 0 || code === 1) {
          success = true;
        }
      }
      var m =
        Number(it.money || it.addmoney || it.addMoney || it.gold || it.coins || it.coin || it.price || 0) || 0;
      if (m > 0) money += m;
    }
  } else if (res && typeof res === "object") {
    var code2 =
      res.ret != null ? res.ret : res.code != null ? res.code : res.errcode != null ? res.errcode : null;
    if (typeof code2 === "number") {
      if (res.ret != null) success = code2 === 0;
      else success = code2 === 0 || code2 === 1;
    }
    msg = res.direction || res.msg || res.message || res.errmsg || "";
    money = Number(res.money || res.addmoney || res.addMoney || res.gold || res.coins || res.coin || 0) || 0;
  }
  if (!money && msg) money = parseMoneyFromMsg(msg);
  return { success: success, money: money, msg: msg };
}
function buildFarmJsonParams(farmTime, farmKey, uin) {
  var params = {};
  var extra = CONFIG.FARM_JSON_SWF_PARAMS;
  if (CONFIG.FARM_JSON_USE_SWF_PARAMS && extra) {
    for (var k in extra) {
      if (!extra.hasOwnProperty(k)) continue;
      params[k] = extra[k];
    }
  }
  var uIdx = uin || "";
  if (CONFIG.FARM_JSON_EMPTY_UIDX) uIdx = "";
  params.uIdx = uIdx;
  if (uIdx) params.ownerId = uIdx;
  params.farmTime = farmTime;
  params.farmKey = farmKey;
  return params;
}

function fetchFarmJson(base, cookie, uin) {
  var farmTime = getFarmTime();
  var farmKey = legacyFarmKey(farmTime);
  if (!farmKey) {
    log("⚠️ farmKey 为空，JSON 模式不可用");
    return Promise.resolve(null);
  }
  var url = base + "/cgi-bin/cgi_farm_index?mod=user&act=run&flag=1";
  var headers = buildFarmJsonHeaders(cookie);
  var body = buildLegacyBody(buildFarmJsonParams(farmTime, farmKey, uin));
  return httpRequest({
    method: "POST",
    url: url,
    headers: headers,
    body: body
  }).then(function (resp) {
    logDebug("JSON 模式 响应: " + resp.status + " 长度=" + (resp.body || "").length);
    var json = tryJson(resp.body);
    if (json && json.user) {
      LAST_FARM = json;
      FARM_CTX.uinY = json.user.uinLogin || FARM_CTX.uinY;
      FARM_CTX.uIdx = json.user.uId || FARM_CTX.uIdx;
      var st = extractServerTime(json);
      updateFarmTimeDelta(st);
      logFarmTimeSync(st);
    }
    return json;
  });
}

function callFarmJsonAction(base, cookie, action, params) {
  var headers = buildFarmJsonHeaders(cookie);
  var body = buildLegacyBody(params);
  return httpRequest({
    method: "POST",
    url: base + action,
    headers: headers,
    body: body
  }).then(function (resp) {
    logDebug("JSON 动作 " + action + " 状态=" + resp.status);
    return tryJson(resp.body) || resp.body;
  });
}

function fetchFarmJsonOutputStatus(base, cookie, uin, place) {
  if (!CONFIG.FARM_JSON_GET_OUTPUT_ON_FAIL) return Promise.resolve(null);
  if (!uin && uin !== 0) return Promise.resolve(null);
  if (place === null || place === undefined || place === "") return Promise.resolve(null);
  var farmTime = getFarmTime();
  var params = {
    v_client: 1,
    place: place,
    uinY: uin,
    uIdx: uin,
    ownerId: uin,
    farmTime: farmTime,
    platform: CONFIG.FARM_PLATFORM || "13",
    appid: CONFIG.FARM_APPID || "353",
    version: CONFIG.FARM_VERSION || "4.0.20.0"
  };
  var placeName = FARM_PLACE_NAME[place];
  if (placeName) {
    params.fName = placeName;
    params.tName = placeName;
  }
  return callFarmJsonAction(base, cookie, "/cgi-bin/cgi_farm_plant?mod=farmlandstatus&act=getOutput", params)
    .then(function (res) {
      var status = res && res.status ? res.status : null;
      if (!status || typeof status !== "object") return null;
      return status;
    })
    .catch(function () {
      return null;
    });
}

function logFarmOutputStatus(place, status) {
  if (!status || !CONFIG.DEBUG) return;
  var cid = status.cId != null ? status.cId : "-";
  var cropStatus = status.cropStatus != null ? status.cropStatus : "-";
  var output = status.output != null ? status.output : "-";
  var leavings = status.leavings != null ? status.leavings : "-";
  var humidity = status.humidity != null ? status.humidity : "-";
  logDebug(
    "🌾 收获后验 place=" +
      place +
      " cId=" +
      cid +
      " cropStatus=" +
      cropStatus +
      " output=" +
      output +
      " leavings=" +
      leavings +
      " humidity=" +
      humidity
  );
}

function planJsonActions(farm) {
  var actions = [];
  var list = ensureArray(farm.farmlandStatus);
  var stat = { total: 0, locked: 0, empty: 0, withered: 0, harvestable: 0 };
  var lockedList = [];
  FARM_PLACE_CID = {};
  for (var i = 0; i < list.length; i++) {
    var land = list[i];
    if (!land) continue;
    stat.total += 1;
    var lockReason = landLockReason(land);
    if (lockReason) {
      stat.locked += 1;
      if (CONFIG.DEBUG) lockedList.push(String(i + 1) + "(" + lockReason + ")");
      continue;
    }
    var idx = i;
    var b = land.b;
    var cid = landCropId(land);
    if (cid) {
      FARM_PLACE_CID[idx] = cid;
      FARM_PLACE_NAME[idx] = getCropNameByCid(cid);
    }
    // JSON 地块字段可直接判断维护需求：f=草、g=虫、h=是否已浇水。
    if (CONFIG.ENABLE.clearWeed && Number(land.f || 0) > 0) {
      pushAction(actions, { type: "clearWeed", place: idx });
    }
    if (CONFIG.ENABLE.spraying && Number(land.g || 0) > 0) {
      pushAction(actions, { type: "spraying", place: idx });
    }
    if (CONFIG.ENABLE.water && Number(land.h || 0) === 0) {
      pushAction(actions, { type: "water", place: idx });
    }
    var k = Number(land.k || 0);
    var harvestable = k > 0 && b !== 7;
    if (harvestable) stat.harvestable += 1;
    if (b === 7) stat.withered += 1;
    if (isLandEmpty(land)) stat.empty += 1;
    if (harvestable && CONFIG.ENABLE.harvest) {
      pushAction(actions, { type: "harvest", place: idx });
      if (CONFIG.ENABLE.scarify)
        pushAction(actions, { type: "scarify", place: idx, cropStatus: land.b });
      if (CONFIG.ENABLE.plant) pushAction(actions, { type: "plant", place: idx });
    } else if (b === 7 && CONFIG.ENABLE.scarify) {
      pushAction(actions, { type: "scarify", place: idx, cropStatus: land.b, withered: true });
      if (CONFIG.ENABLE.plant) pushAction(actions, { type: "plant", place: idx });
    } else if (isLandEmpty(land) && CONFIG.ENABLE.plant) {
      pushAction(actions, { type: "plant", place: idx });
    }
  }
  if (CONFIG.DEBUG) {
    log(
      "🧩 JSON判定: 总=" +
        stat.total +
        " 锁地=" +
        stat.locked +
        " 空地=" +
        stat.empty +
        " 枯萎=" +
        stat.withered +
        " 可收获=" +
        stat.harvestable
    );
    if (lockedList.length) {
      var show = lockedList.slice(0, 10);
      var more = lockedList.length > 10 ? " ... +" + (lockedList.length - 10) : "";
      logDebug("🔒 锁地明细: " + show.join(", ") + more);
    }
  }
  return actions;
}

function execFarmJsonActions(base, cookie, actions) {
  var actMap = {
    clearWeed: "/cgi-bin/cgi_farm_opt?mod=farmlandstatus&act=clearWeed",
    spraying: "/cgi-bin/cgi_farm_opt?mod=farmlandstatus&act=spraying",
    water: "/cgi-bin/cgi_farm_opt?mod=farmlandstatus&act=water",
    harvest: "/cgi-bin/cgi_farm_plant?mod=farmlandstatus&act=harvest",
    scarify: "/cgi-bin/cgi_farm_plant?mod=farmlandstatus&act=scarify",
    plant: "/cgi-bin/cgi_farm_plant?mod=farmlandstatus&act=planting"
  };
  var actionList = actions.slice(0);
  var uin = getFarmUin(cookie);
  if (!uin) log("⚠️ 未获取 uIdx，JSON 动作可能失败");
  var skipAfter = {};
  var plantBlocked = false;

  function runList(list) {
    var idx = 0;
    function next() {
      if (idx >= list.length) return Promise.resolve();
      var a = list[idx++];
      if (a.type === "plant" && plantBlocked) {
        if (CONFIG.DEBUG) logDebug("JSON 动作跳过(plant) 全局种子不足，place=" + a.place);
        recordActionNoop("plant", 1);
        return next();
      }
      if ((a.type === "scarify" || a.type === "plant") && skipAfter[a.place]) {
        logDebug("JSON 动作跳过(" + a.type + ") place=" + a.place);
        return next();
      }
      var farmTime = getFarmTime();
      var farmKey = legacyFarmKey(farmTime);
      if (!farmKey) {
        ACTION_STATS.errors += 1;
        log("⚠️ farmKey 为空，跳过动作: " + actionLabel(a.type));
        return Promise.resolve();
      }
      var params = {
        uIdx: uin,
        ownerId: uin,
        place: a.place,
        farmTime: farmTime,
        farmKey: farmKey
      };
      if (a.type === "plant") {
        var useCid = String(CONFIG.PLANT_CID || "");
        if (!useCid || Number(useCid) <= 0) {
          var pickedCid = pickPlantSeedCidByPolicy(LAST_GRASS_COUNT);
          if (pickedCid) {
            CONFIG.PLANT_CID = pickedCid;
            useCid = pickedCid;
            if (CONFIG.DEBUG) logDebug("🌱 JSON播种自动选种: cId=" + useCid);
          } else {
            plantBlocked = true;
            recordPlantFail("seedLack", 1);
            log("🌱 播种: 未找到可用种子(cId)，本轮停止空地播种");
            recordActionNoop("plant", 1);
            return next();
          }
        }
        params.cId = useCid;
      }
        if (a.type === "scarify" && a.cropStatus !== undefined) params.cropStatus = a.cropStatus;
        recordActionTry(a.type, 1);
        if (a.type === "scarify" && a.withered) recordWitheredTry(1);
        return callFarmJsonAction(base, cookie, actMap[a.type], params)
          .then(function (res) {
            var postHook = Promise.resolve();
            var ret = parseActionResult(res, a.type);
            if (ret.msg && CONFIG.DEBUG) log("ℹ️ 动作结果 " + actionLabel(a.type) + ": " + ret.msg);
            if (CONFIG.DEBUG && ret.count) logDebug("📊 计数 " + actionLabel(a.type) + ": " + ret.count);
            if (ret.success) {
              ACTION_STATS[a.type] += ret.count;
              if (a.type === "plant") recordPlant(CONFIG.PLANT_CID, ret.count);
              if (a.type === "harvest") recordHarvestDetail(ret, a.place);
              if (a.type === "scarify" && a.withered) {
                var winc = ret.count && ret.count > 0 ? ret.count : 1;
                recordWitheredClear(winc);
              }
            } else if (isNoActionMsg(ret.msg, a.type)) {
              recordActionNoop(a.type, 1);
            } else if (a.type === "plant" && isSeedLackMsg(ret.msg)) {
              recordPlantFail("seedLack", 1);
              plantBlocked = true;
              log("🌱 播种: " + (ret.msg || "种子不足") + "，已停止本轮重复尝试");
            } else if (a.type === "harvest") {
              skipAfter[a.place] = true;
              logDebug("JSON 动作: 收获失败，跳过翻地/播种 place=" + a.place);
              if (CONFIG.FARM_JSON_GET_OUTPUT_ON_FAIL) {
                postHook = fetchFarmJsonOutputStatus(base, cookie, uin, a.place).then(function (st) {
                  logFarmOutputStatus(a.place, st);
                });
              }
            } else if (a.type === "scarify") {
              skipAfter[a.place] = true;
              logDebug("JSON 动作: 翻地失败，跳过播种 place=" + a.place);
            } else if (a.type === "plant" && /符合种植条件|土地/.test(normalizeSpace(ret.msg || ""))) {
              recordPlantFail("landLimit", 1);
            }
            return postHook;
        })
        .catch(function (e) {
          ACTION_STATS.errors += 1;
          log("⚠️ 动作失败 " + actionLabel(a.type) + ": " + e);
        })
        .then(function () {
          return sleep(CONFIG.WAIT_MS);
        })
        .then(next);
    }
    return next();
  }

  if (!actionList.length) return Promise.resolve();
  return runList(actionList);
}

function runFarmJson(cookie) {
  var base = CONFIG.FARM_JSON_BASE || "https://nc.qzone.qq.com";
  log("🧩 模式: JSON @ " + base);
  var uin = getFarmUin(cookie);
  function runWithFarm(farm) {
    applyFarmLockHeuristicGuard(farm, "json-start");
    logFarmJsonStatus("开始", farm);
    if (CONFIG.DEBUG) logDebug("🧩 JSON核心地块(开始): " + formatJsonCoreTodoPlaceSample(farm, 10));
    setFarmStatusFromJson(farm, true);
    LAST_MODE = "json";
    LAST_BASE = base;
    var maxPass = Number(CONFIG.FARM_JSON_MAX_PASS || 1);
    if (!maxPass || isNaN(maxPass) || maxPass < 1) maxPass = 1;

    function runPass(curFarm, round) {
      var actions = planJsonActions(curFarm);
      log("🧩 任务数(第" + (round + 1) + "轮): " + actions.length);
      if (CONFIG.FARM_JSON_OBSERVE_ONLY) {
        log("👀 观察模式: 已跳过 JSON 动作执行（不收获/不铲除/不播种/不维护）");
        return Promise.resolve(curFarm);
      }
      if (!actions.length) return Promise.resolve(curFarm);
      return execFarmJsonActions(base, cookie, actions)
        .then(function () {
          return fetchFarmJson(base, cookie, uin).catch(function () {
            return curFarm;
          });
        })
        .then(function (farm2) {
          if (!isFarmJson(farm2)) return curFarm;
          applyFarmLockHeuristicGuard(farm2, "json-pass-" + (round + 1));
          var core = summarizeFarmJsonCore(farm2);
          logDebug(
            "🧪 新接口后验(第" +
              (round + 1) +
              "轮): 总=" +
              core.total +
              " 锁地=" +
              core.locked +
              " " +
              formatJsonCoreTodo(core)
          );
          if (CONFIG.DEBUG) logDebug("🧩 JSON核心地块(后验): " + formatJsonCoreTodoPlaceSample(farm2, 10));
          var onlyEmptyLeft = core.harvestable <= 0 && core.withered <= 0 && core.empty > 0;
          if (onlyEmptyLeft && PLANT_FAIL.seedLack > 0) {
            log("🌱 新接口后验: 空地仍有" + core.empty + "块，但检测到种子不足，停止本轮续跑");
            return farm2;
          }
          if (round + 1 < maxPass && hasJsonCoreTodo(core)) {
            log("🧪 新接口后验: 仍有可处理地块(" + formatJsonCoreTodo(core) + ")，继续下一轮");
            return runPass(farm2, round + 1);
          }
          return farm2;
        });
    }

    return runPass(farm, 0).then(function (finalFarm) {
      if (isFarmJson(finalFarm)) {
        applyFarmLockHeuristicGuard(finalFarm, "json-end");
        logFarmJsonStatus("结束", finalFarm);
        if (CONFIG.DEBUG) logDebug("🧩 JSON核心地块(结束): " + formatJsonCoreTodoPlaceSample(finalFarm, 10));
        setFarmStatusFromJson(finalFarm, false);
      }
      return { ok: true };
    });
  }

  function validFarmLandCount(farm) {
    if (!isFarmJson(farm)) return 0;
    return ensureArray(farm.farmlandStatus).length;
  }

  return fetchFarmJson(base, cookie, uin).then(function (farm) {
    if (!isFarmJson(farm)) return { ok: false, reason: "farm json missing" };
    var firstCount = validFarmLandCount(farm);
    if (firstCount > 0) return runWithFarm(farm);
    log("⚠️ JSON 地块列表为空，尝试重取一次");
    return fetchFarmJson(base, cookie, uin)
      .then(function (farm2) {
        if (!isFarmJson(farm2)) return { ok: false, reason: "farm json missing(retry)" };
        var retryCount = validFarmLandCount(farm2);
        if (retryCount <= 0) {
          ACTION_STATS.errors += 1;
          log("⚠️ JSON 地块列表仍为空：已跳过农场收获/铲除/播种");
          if (CONFIG.DEBUG) {
            var lv = Number((farm2.user && (farm2.user.level || farm2.user.lv || farm2.user.userLevel)) || 0);
            logDebug("🧪 空地块回包: lv=" + lv + " keys=" + Object.keys(farm2 || {}).join(","));
          }
          return { ok: false, reason: "farm json empty" };
        }
        return runWithFarm(farm2);
      })
      .catch(function (e) {
        ACTION_STATS.errors += 1;
        log("⚠️ JSON 重取失败: " + e);
        return { ok: false, reason: "farm json retry failed" };
      });
  });
}

/* =======================
 *  MODERN MODE
 * ======================= */
function fetchFarmModern(base, cookie, gtk, uin) {
  var url = base + "/cgi-bin/cgi_farm_index?mod=user&act=run&g_tk=" + gtk;
  var headers = buildHeaders(cookie);
  var body = buildModernBody({
    uIdx: uin,
    ownerId: uin,
    uinY: uin
  });
  return httpRequest({
    method: "POST",
    url: url,
    headers: headers,
    body: body
  }).then(function (resp) {
    logDebug("现代模式 响应: " + resp.status + " 长度=" + (resp.body || "").length);
    var json = tryJson(resp.body);
    if (json && json.user) {
      LAST_FARM = json;
      FARM_CTX.uinY = json.user.uinLogin || FARM_CTX.uinY;
      FARM_CTX.uIdx = json.user.uId || FARM_CTX.uIdx;
    }
    return json;
  });
}

function callModernAction(base, cookie, gtk, action, params) {
  var headers = buildHeaders(cookie);
  var url = base + action + "&g_tk=" + gtk;
  var body = buildModernBody(params);
  return httpRequest({
    method: "POST",
    url: url,
    headers: headers,
    body: body
  }).then(function (resp) {
    logDebug("现代动作 " + action + " 状态=" + resp.status);
    return tryJson(resp.body) || resp.body;
  });
}

function planModernActions(farm) {
  var actions = [];
  var list = ensureArray(farm.farmlandStatus);
  for (var i = 0; i < list.length; i++) {
    var land = list[i];
    if (!land) continue;
    var idx = i;
    if (CONFIG.ENABLE.clearWeed && land.f > 0) {
      pushAction(actions, { type: "clearWeed", place: idx });
    }
    if (CONFIG.ENABLE.spraying && land.g > 0) {
      pushAction(actions, { type: "spraying", place: idx });
    }
    if (CONFIG.ENABLE.water && land.h === 0) {
      pushAction(actions, { type: "water", place: idx });
    }
    if (land.b === 6 && CONFIG.ENABLE.harvest) {
      pushAction(actions, { type: "harvest", place: idx });
      if (CONFIG.ENABLE.scarify) pushAction(actions, { type: "scarify", place: idx });
      if (CONFIG.ENABLE.plant) pushAction(actions, { type: "plant", place: idx });
    } else if (isLandWithered(land) && CONFIG.ENABLE.scarify) {
      pushAction(actions, { type: "scarify", place: idx, withered: true });
      if (CONFIG.ENABLE.plant) pushAction(actions, { type: "plant", place: idx });
    }
  }
  return actions;
}

function runModern(base, cookie, gtk, uin) {
  log("🚀 模式: 现代 @ " + base);
  return fetchFarmModern(base, cookie, gtk, uin).then(function (farm) {
    if (!isFarmJson(farm)) return { ok: false, reason: "farm json missing" };
    applyFarmLockHeuristicGuard(farm, "modern");
    LAST_MODE = "modern";
    LAST_BASE = base;
    var actions = planModernActions(farm);
    var deadPlaces = collectDeadPlaces(farm);
    log("🧩 任务数: " + actions.length);
    return execModernActions(base, cookie, gtk, uin, actions, deadPlaces).then(function () {
      return { ok: true };
    });
  });
}

function execModernActions(base, cookie, gtk, uin, actions, deadPlaces) {
  var actMap = {
    clearWeed: "/cgi-bin/cgi_farm_opt?mod=farmlandstatus&act=clearWeed",
    spraying: "/cgi-bin/cgi_farm_opt?mod=farmlandstatus&act=spraying",
    water: "/cgi-bin/cgi_farm_opt?mod=farmlandstatus&act=water",
    harvest: "/cgi-bin/cgi_farm_plant?mod=farmlandstatus&act=harvest",
    scarify: "/cgi-bin/cgi_farm_plant?mod=farmlandstatus&act=scarify",
    plant: "/cgi-bin/cgi_farm_plant?mod=farmlandstatus&act=planting"
  };
  var deadSet = {};
  if (deadPlaces && deadPlaces.length) {
    for (var d = 0; d < deadPlaces.length; d++) {
      deadSet[deadPlaces[d]] = true;
    }
  }
  var actionList = actions.slice(0);

  function runList(list) {
    var idx = 0;
    function next() {
      if (idx >= list.length) return Promise.resolve();
      var a = list[idx++];
      var params = {
        uIdx: uin,
        ownerId: uin,
        uinY: uin,
        place: a.place
      };
      if (a.type === "plant") {
        var plantCid = String(CONFIG.PLANT_CID || pickPlantSeedCidByPolicy(LAST_GRASS_COUNT) || "");
        if (!plantCid || Number(plantCid) <= 0) {
          recordPlantFail("seedLack", 1);
          recordActionNoop("plant", 1);
          if (CONFIG.DEBUG) logDebug("现代动作跳过(plant): 未找到可用种子 cId");
          return next();
        }
        CONFIG.PLANT_CID = plantCid;
        params.cId = plantCid;
      }
      recordActionTry(a.type, 1);
      if (a.type === "scarify" && a.withered) recordWitheredTry(1);
      return callModernAction(base, cookie, gtk, actMap[a.type], params)
        .then(function (res) {
          var ret = parseActionResult(res, a.type);
          if (ret.msg && CONFIG.DEBUG) log("ℹ️ 动作结果 " + actionLabel(a.type) + ": " + ret.msg);
          if (CONFIG.DEBUG && ret.count) logDebug("📊 计数 " + actionLabel(a.type) + ": " + ret.count);
          if (ret.success) {
            ACTION_STATS[a.type] += ret.count;
            if (a.type === "plant") recordPlant(CONFIG.PLANT_CID, ret.count);
            if (a.type === "scarify" && a.withered) {
              var winc = ret.count && ret.count > 0 ? ret.count : 1;
              recordWitheredClear(winc);
            }
          } else if (isNoActionMsg(ret.msg, a.type)) {
            recordActionNoop(a.type, 1);
          }
        })
        .catch(function (e) {
          ACTION_STATS.errors += 1;
          log("⚠️ 动作失败 " + actionLabel(a.type) + ": " + e);
        })
        .then(function () {
          return sleep(CONFIG.WAIT_MS);
        })
        .then(next);
    }
    return next();
  }

  function splitActions(list) {
    var normal = [];
    var planting = [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].type === "plant") planting.push(list[i]);
      else normal.push(list[i]);
    }
    return { normal: normal, planting: planting };
  }

  return farmOneKeyDig(cookie, deadPlaces).then(function (didDig) {
    if (didDig && deadPlaces && deadPlaces.length) {
      actionList = actionList.filter(function (a) {
        return !(a.type === "scarify" && deadSet[a.place]);
      });
    }
    var parts = splitActions(actionList);
    return runList(parts.normal).then(function () {
      if (parts.planting.length === 0) return;
      return farmOneKeySow(cookie, CONFIG.PLANT_CID).then(function (ok) {
        if (ok) return;
        return runList(parts.planting);
      });
    });
  });
}

/* =======================
 *  LEGACY MODE
 * ======================= */
function fetchFarmLegacy(base, cookie, uin) {
  var url = base + "/api.php?mod=user&act=run";
  var headers = buildLegacyHeaders(cookie);
  return httpRequest({
    method: "GET",
    url: url,
    headers: headers
  }).then(function (resp) {
    logDebug("旧版模式 响应: " + resp.status + " 长度=" + (resp.body || "").length);
    var json = tryJson(resp.body);
    if (json && json.user) {
      LAST_FARM = json;
      FARM_CTX.uinY = json.user.uinLogin || FARM_CTX.uinY;
      FARM_CTX.uIdx = json.user.uId || FARM_CTX.uIdx;
    }
    return json;
  });
}

function callLegacyAction(base, cookie, path, params) {
  var headers = buildLegacyHeaders(cookie);
  var body = buildLegacyBody(params);
  return httpRequest({
    method: "POST",
    url: base + path,
    headers: headers,
    body: body
  }).then(function (resp) {
    logDebug("旧版动作 " + path + " 状态=" + resp.status);
    return tryJson(resp.body) || resp.body;
  });
}

function planLegacyActions(farm) {
  var actions = [];
  var list = ensureArray(farm.farmlandStatus);
  for (var i = 0; i < list.length; i++) {
    var land = list[i];
    if (!land) continue;
    if (isLandLocked(land)) continue;
    var idx = i;
    if (CONFIG.ENABLE.clearWeed && land.f > 0) {
      pushAction(actions, { type: "clearWeed", place: idx });
    }
    if (CONFIG.ENABLE.spraying && land.g > 0) {
      pushAction(actions, { type: "spraying", place: idx });
    }
    if (CONFIG.ENABLE.water && land.h === 0) {
      pushAction(actions, { type: "water", place: idx });
    }
    if (land.b === 6 && CONFIG.ENABLE.harvest) {
      pushAction(actions, { type: "harvest", place: idx });
      if (CONFIG.ENABLE.scarify) pushAction(actions, { type: "scarify", place: idx });
      if (CONFIG.ENABLE.plant) pushAction(actions, { type: "plant", place: idx });
    } else if (isLandWithered(land) && CONFIG.ENABLE.scarify) {
      pushAction(actions, { type: "scarify", place: idx });
      if (CONFIG.ENABLE.plant) pushAction(actions, { type: "plant", place: idx });
    }
  }
  return actions;
}

function runLegacy(base, cookie, uin) {
  log("🧩 模式: 旧版 @ " + base);
  return fetchFarmLegacy(base, cookie, uin).then(function (farm) {
    if (!isFarmJson(farm)) return { ok: false, reason: "farm json missing" };
    applyFarmLockHeuristicGuard(farm, "legacy");
    LAST_MODE = "legacy";
    LAST_BASE = base;
    var actions = planLegacyActions(farm);
    var deadPlaces = collectDeadPlaces(farm);
    log("🧩 任务数: " + actions.length);
    return execLegacyActions(base, cookie, uin, actions, deadPlaces).then(function () {
      return { ok: true };
    });
  });
}

function execLegacyActions(base, cookie, uin, actions, deadPlaces) {
  var deadSet = {};
  if (deadPlaces && deadPlaces.length) {
    for (var d = 0; d < deadPlaces.length; d++) {
      deadSet[deadPlaces[d]] = true;
    }
  }
  var actionList = actions.slice(0);

  function runList(list) {
    var idx = 0;
    function next() {
      if (idx >= list.length) return Promise.resolve();
      var a = list[idx++];
      var farmTime = getFarmTime();
      var farmKey = legacyFarmKey(farmTime);
      var params = {
        ownerId: uin,
        farmTime: farmTime,
        farmKey: farmKey,
        place: a.place
      };
      var path = "";
      if (a.type === "clearWeed") path = "/api.php?mod=farmlandstatus&act=clearWeed";
      if (a.type === "spraying") path = "/api.php?mod=farmlandstatus&act=spraying";
      if (a.type === "water") path = "/api.php?mod=farmlandstatus&act=water";
      if (a.type === "harvest") path = "/api.php?mod=farmlandstatus&act=harvest";
      if (a.type === "scarify") path = "/api.php?mod=farmlandstatus&act=scarify";
      if (a.type === "plant") {
        path = "/api.php?mod=farmlandstatus&act=planting";
        var plantCid = String(CONFIG.PLANT_CID || pickPlantSeedCidByPolicy(LAST_GRASS_COUNT) || "");
        if (!plantCid || Number(plantCid) <= 0) {
          recordPlantFail("seedLack", 1);
          recordActionNoop("plant", 1);
          if (CONFIG.DEBUG) logDebug("旧版动作跳过(plant): 未找到可用种子 cId");
          return next();
        }
        CONFIG.PLANT_CID = plantCid;
        params.cId = plantCid;
      }
      return callLegacyAction(base, cookie, path, params)
        .then(function (res) {
          var ret = parseActionResult(res, a.type);
          if (ret.msg && CONFIG.DEBUG) log("ℹ️ 动作结果 " + actionLabel(a.type) + ": " + ret.msg);
          if (CONFIG.DEBUG && ret.count) logDebug("📊 计数 " + actionLabel(a.type) + ": " + ret.count);
          if (ret.success) {
            ACTION_STATS[a.type] += ret.count;
            if (a.type === "plant") recordPlant(CONFIG.PLANT_CID, ret.count);
          }
        })
        .catch(function (e) {
          ACTION_STATS.errors += 1;
          log("⚠️ 动作失败 " + actionLabel(a.type) + ": " + e);
        })
        .then(function () {
          return sleep(CONFIG.WAIT_MS);
        })
        .then(next);
    }
    return next();
  }

  function splitActions(list) {
    var normal = [];
    var planting = [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].type === "plant") planting.push(list[i]);
      else normal.push(list[i]);
    }
    return { normal: normal, planting: planting };
  }

  return farmOneKeyDig(cookie, deadPlaces).then(function (didDig) {
    if (didDig && deadPlaces && deadPlaces.length) {
      actionList = actionList.filter(function (a) {
        return !(a.type === "scarify" && deadSet[a.place]);
      });
    }
    var parts = splitActions(actionList);
    return runList(parts.normal).then(function () {
      if (parts.planting.length === 0) return;
      return farmOneKeySow(cookie, CONFIG.PLANT_CID).then(function (ok) {
        if (ok) return;
        return runList(parts.planting);
      });
    });
  });
}

function parseBuySeedJsonResult(res, num) {
  var msg = res.direction || res.msg || res.message || res.errmsg || "";
  var code =
    res.ret != null ? res.ret : res.code != null ? res.code : res.errcode != null ? res.errcode : null;
  var success = false;
  if (typeof code === "number") {
    if (res.ret != null) success = code === 0;
    else success = code === 0 || code === 1;
  } else if (msg) {
    success = isSuccessMsg(msg);
  }
  var spend =
    Number(res.money || res.addmoney || res.addMoney || res.cost || res.price || res.total || 0) || 0;
  if (!spend && msg) spend = parseSpendFromMsg(msg);
  var count = num || 0;
  return { success: success, msg: msg, spend: spend, count: count };
}

function buySeedJson(cookie, cid, num, label, moneyKey, unitPrice) {
  if (!CONFIG.FARM_JSON_ENABLE || !CONFIG.FARM_JSON_SEED_ENABLE) return Promise.resolve(false);
  return ensureFarmJsonContext(cookie).then(function () {
    var uIdx = getFarmUin(cookie);
    if (!uIdx) {
      log("⚠️ JSON 买种子: 缺少 uIdx");
      return false;
    }
    var farmTime = getFarmTime();
    var farmKey = legacyFarmKey(farmTime);
    if (!farmKey) return false;
    var base = CONFIG.FARM_SEED_JSON_BASE || "https://farm.qzone.qq.com";
    var url = base + "/cgi-bin/cgi_farm_buyseed?mod=repertory&act=buySeed";
    var headers = buildFarmSeedJsonHeaders(cookie);
    var body = buildLegacyBody({
      uIdx: uIdx,
      cId: String(cid),
      number: num,
      farmTime: farmTime,
      farmKey: farmKey
    });
    return httpRequest({ method: "POST", url: url, headers: headers, body: body })
      .then(function (resp) {
        var json = tryJson(resp.body);
        if (!json || typeof json !== "object") {
          log("🧺 买种子(JSON): 响应非 JSON");
          return false;
        }
        var ret = parseBuySeedJsonResult(json, num);
        if (ret.msg) log("🧺 买种子(JSON): " + ret.msg);
        if (ret.success) {
          if (ret.spend <= 0 && unitPrice > 0) ret.spend = unitPrice * num;
          if (ret.spend > 0 && moneyKey) {
            MONEY_STATS[moneyKey] += ret.spend;
            PURCHASE_LOGS.push({ name: label || "种子", count: ret.count, cost: ret.spend });
          }
          return true;
        }
        if (isMoneyShortText(ret.msg || resp.body)) {
          if (moneyKey === "grassBuy") NO_MONEY.grassSeed = true;
          else NO_MONEY.farmSeed = true;
          if (!ret.msg || ret.msg.indexOf("金币") < 0) log("🧺 买种子(JSON): 金币不足");
        }
        return false;
      })
      .catch(function (e) {
        log("🧺 买种子(JSON): 请求失败 " + e);
        return false;
      });
  });
}

function buyGrassSeed(cookie) {
  return buySeedJson(
    cookie,
    CONFIG.FARM_GRASS_SEED_ID,
    CONFIG.FARM_GRASS_BUY_NUM,
    "牧草种子",
    "grassBuy"
  ).then(function (ok) {
    if (ok) return true;
    if (!CONFIG.FARM_JSON_FALLBACK_WAP) return false;
    return buyGrassSeedWap(cookie);
  });
}

function resolveFirstSeedInfo(cookie) {
  var base = CONFIG.FARM_WAP_BASE;
  var sid = CONFIG.RANCH_SID;
  var g_ut = getFarmGut();
  var lv = LAST_RANCH && LAST_RANCH.lv ? LAST_RANCH.lv : "";
  var listUrl =
    base +
    "/nc/cgi-bin/wap_farm_seed_list?sid=" +
    sid +
    "&g_ut=" +
    g_ut +
    "&buy=1" +
    (lv ? "&lv=" + lv : "");

  function doResolve(infoUrl) {
    var fullInfo = infoUrl.indexOf("http") === 0 ? infoUrl : base + "/nc/cgi-bin/" + infoUrl.replace(/^\.?\//, "");
    return ranchGet(fullInfo, cookie)
      .then(function (html) {
        var unitPrice = parseSeedUnitPrice(html);
        var form = parseSeedBuyForm(html);
        var cid = form.cid || "";
        if (!cid) {
          var m = fullInfo.match(/cid=([0-9]+)/);
          if (m) cid = m[1];
        }
        if (!cid) {
          log("🧺 买种子(JSON): 未找到种子ID");
          return { cid: "", unitPrice: 0 };
        }
        return { cid: cid, unitPrice: unitPrice };
      })
      .catch(function (e) {
        log("🧺 买种子(JSON): 详情页失败 " + e);
        return { cid: "", unitPrice: 0 };
      });
  }

  return ranchGet(listUrl, cookie)
    .then(function (html) {
      var info = extractSeedInfoLink(html, "");
      if (info) return doResolve(info);
      var pages = extractSeedListPages(html);
      if (pages.length > 0) {
        var first = pages[0];
        var full = first.indexOf("http") === 0 ? first : base + "/nc/cgi-bin/" + first.replace(/^\.?\//, "");
        return ranchGet(full, cookie).then(function (html2) {
          var info2 = extractSeedInfoLink(html2, "");
          if (info2) return doResolve(info2);
          return { cid: "", unitPrice: 0 };
        });
      }
      return { cid: "", unitPrice: 0 };
    })
    .catch(function (e) {
      log("🧺 买种子(JSON): 列表页失败 " + e);
      return { cid: "", unitPrice: 0 };
    });
}

function buyFirstSeedJson(cookie, num) {
  if (!CONFIG.FARM_JSON_ENABLE || !CONFIG.FARM_JSON_SEED_ENABLE) return Promise.resolve("");
  return resolveFirstSeedInfo(cookie).then(function (info) {
    if (!info || !info.cid) return "";
    return buySeedJson(cookie, info.cid, num, "种子", "farmBuy", info.unitPrice).then(function (ok) {
      return ok ? info.cid : "";
    });
  });
}

function buyFirstSeed(cookie, num) {
  return buyFirstSeedJson(cookie, num).then(function (cid) {
    if (cid) return cid;
    if (!CONFIG.FARM_JSON_FALLBACK_WAP) return "";
    return buyFirstSeedWap(cookie, num);
  });
}

function extractSeedInfoLink(html, cid) {
  var h = (html || "").replace(/&amp;/g, "&");
  var re = /wap_farm_seed_info\?[^"'\s>]+/g;
  var m;
  var targets = [];
  while ((m = re.exec(h))) {
    var link = m[0];
    if (String(cid) && link.indexOf("cid=" + cid) < 0) continue;
    targets.push(link);
  }
  return targets.length ? targets[0] : "";
}

function extractSeedListPages(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var re = /wap_farm_seed_list\?[^"'\s>]+/g;
  var m;
  var out = [];
  while ((m = re.exec(h))) out.push(m[0]);
  return uniqLinks(out);
}

function parseSeedBuyForm(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var actionMatch = h.match(/<form[^>]+action="([^"]+wap_farm_seed_buy[^"]*)"/i);
  var action = actionMatch ? actionMatch[1] : "";
  var cidMatch = h.match(/name="cid"[^>]*value="([0-9]+)"/i);
  var cid = cidMatch ? cidMatch[1] : "";
  return { action: action, cid: cid };
}

function buyGrassSeedWap(cookie) {
  var base = CONFIG.FARM_WAP_BASE;
  var sid = CONFIG.RANCH_SID;
  var g_ut = getFarmGut();
  var lv = LAST_RANCH && LAST_RANCH.lv ? LAST_RANCH.lv : "";
  var listUrl =
    base +
    "/nc/cgi-bin/wap_farm_seed_list?sid=" +
    sid +
    "&g_ut=" +
    g_ut +
    "&buy=1" +
    (lv ? "&lv=" + lv : "");

  function fetchPages(queue, visited) {
    if (queue.length === 0) return Promise.resolve("");
    var url = queue.shift();
    return ranchGet(url, cookie).then(function (html) {
      var info = extractSeedInfoLink(html, CONFIG.FARM_GRASS_SEED_ID);
      if (info) return info;
      var pages = extractSeedListPages(html);
      for (var i = 0; i < pages.length; i++) {
        var link = pages[i];
        var full = link.indexOf("http") === 0 ? link : base + "/nc/cgi-bin/" + link.replace(/^\.?\//, "");
        if (!visited[full]) {
          visited[full] = true;
          queue.push(full);
        }
      }
      return fetchPages(queue, visited);
    });
  }

  function doBuy(infoUrl) {
    var fullInfo = infoUrl.indexOf("http") === 0 ? infoUrl : base + "/nc/cgi-bin/" + infoUrl.replace(/^\.?\//, "");
    return ranchGet(fullInfo, cookie)
      .then(function (html) {
        var unitPrice = parseSeedUnitPrice(html);
        var form = parseSeedBuyForm(html);
        if (!form.action) {
          log("🌾 买牧草种子: 未找到购买表单");
          return false;
        }
        var cid = form.cid || String(CONFIG.FARM_GRASS_SEED_ID);
        var actionUrl =
          form.action.indexOf("http") === 0
            ? form.action
            : base + "/nc/cgi-bin/" + form.action.replace(/^\.?\//, "");
        var body = buildLegacyBody({
          num: CONFIG.FARM_GRASS_BUY_NUM,
          cid: cid,
          sb: "确定"
        });
        var headers = buildRanchHeaders(cookie, fullInfo);
        headers["Content-Type"] = "application/x-www-form-urlencoded";
        return httpRequest({ method: "POST", url: actionUrl, headers: headers, body: body })
          .then(function (resp) {
            var msg = extractWapHint(resp.body) || extractMessage(resp.body);
            if (msg && msg.indexOf("成功") >= 0) {
              log("🌾 买牧草种子: " + msg);
              var spend = parseSpendFromMsg(msg);
              if (!spend && unitPrice > 0) {
                spend = unitPrice * CONFIG.FARM_GRASS_BUY_NUM;
              }
              if (spend > 0) {
                MONEY_STATS.grassBuy += spend;
                PURCHASE_LOGS.push({ name: "牧草种子", count: CONFIG.FARM_GRASS_BUY_NUM, cost: spend });
              }
              return true;
            }
            if (msg) log("🌾 买牧草种子: " + msg);
            if (isMoneyShortText(msg || resp.body)) {
              NO_MONEY.grassSeed = true;
              if (!msg || msg.indexOf("金币") < 0) log("🌾 买牧草种子: 金币不足");
            }
            return false;
          })
          .catch(function (e) {
            log("🌾 买牧草种子: 购买失败 " + e);
            return false;
          });
      })
      .catch(function (e) {
        log("🌾 买牧草种子: 详情页失败 " + e);
        return false;
      });
  }

  var startQueue = [listUrl];
  var visited = {};
  visited[listUrl] = true;
  return fetchPages(startQueue, visited)
    .then(function (infoUrl) {
      if (!infoUrl) {
        log("🌾 买牧草种子: 未发现 WAP 购买入口");
        return false;
      }
      return doBuy(infoUrl);
    })
    .catch(function (e) {
      log("🌾 买牧草种子: WAP 获取失败 " + e);
      return false;
    });
}

function buyFirstSeedWap(cookie, num) {
  var base = CONFIG.FARM_WAP_BASE;
  var sid = CONFIG.RANCH_SID;
  var g_ut = getFarmGut();
  var lv = LAST_RANCH && LAST_RANCH.lv ? LAST_RANCH.lv : "";
  var listUrl =
    base +
    "/nc/cgi-bin/wap_farm_seed_list?sid=" +
    sid +
    "&g_ut=" +
    g_ut +
    "&buy=1" +
    (lv ? "&lv=" + lv : "");

  function doBuy(infoUrl) {
    var fullInfo = infoUrl.indexOf("http") === 0 ? infoUrl : base + "/nc/cgi-bin/" + infoUrl.replace(/^\.?\//, "");
    return ranchGet(fullInfo, cookie)
      .then(function (html) {
        var unitPrice = parseSeedUnitPrice(html);
        var form = parseSeedBuyForm(html);
        if (!form.action) {
          log("🧺 买种子: 未找到购买表单");
          return "";
        }
        var cid = form.cid || "";
        var actionUrl =
          form.action.indexOf("http") === 0
            ? form.action
            : base + "/nc/cgi-bin/" + form.action.replace(/^\.?\//, "");
        var body = buildLegacyBody({
          num: num,
          cid: cid,
          sb: "确定"
        });
        var headers = buildRanchHeaders(cookie, fullInfo);
        headers["Content-Type"] = "application/x-www-form-urlencoded";
        return httpRequest({ method: "POST", url: actionUrl, headers: headers, body: body })
          .then(function (resp) {
            var msg = extractWapHint(resp.body) || extractMessage(resp.body);
            if (msg) log("🧺 买种子: " + msg);
            if (isMoneyShortText(msg || resp.body)) {
              NO_MONEY.farmSeed = true;
              if (!msg || msg.indexOf("金币") < 0) log("🧺 买种子: 金币不足");
            }
            var spend = parseSpendFromMsg(msg);
            if (!spend && unitPrice > 0 && msg && msg.indexOf("成功") >= 0) {
              spend = unitPrice * num;
            }
            if (spend > 0) {
              MONEY_STATS.farmBuy += spend;
              PURCHASE_LOGS.push({ name: "种子", count: num, cost: spend });
            }
            return cid;
          })
          .catch(function (e) {
            log("🧺 买种子: 购买失败 " + e);
            return "";
          });
      })
      .catch(function (e) {
        log("🧺 买种子: 详情页失败 " + e);
        return "";
      });
  }

  return ranchGet(listUrl, cookie)
    .then(function (html) {
      var info = extractSeedInfoLink(html, "");
      if (info) return doBuy(info);
      var pages = extractSeedListPages(html);
      if (pages.length > 0) {
        var first = pages[0];
        var full = first.indexOf("http") === 0 ? first : base + "/nc/cgi-bin/" + first.replace(/^\.?\//, "");
        return ranchGet(full, cookie).then(function (html2) {
          var info2 = extractSeedInfoLink(html2, "");
          if (info2) return doBuy(info2);
          log("🧺 买种子: 未发现可购买入口");
          return "";
        });
      }
      log("🧺 买种子: 未发现可购买入口");
      return "";
    })
    .catch(function (e) {
      log("🧺 买种子: WAP 获取失败 " + e);
      return "";
    });
}

function plantGrassFromFarm(cookie) {
  return farmOneKeySow(cookie, CONFIG.FARM_GRASS_SEED_ID).then(function (ok) {
    if (ok) log("🌾 种牧草: WAP 播种完成");
    else log("🌾 种牧草: WAP 无可播种或失败");
    return ok;
  });
}

function farmSellAllWap(cookie) {
  if (!CONFIG.ENABLE.farm_sell_all) return Promise.resolve();
  var base = CONFIG.FARM_WAP_BASE;
  var sid = CONFIG.RANCH_SID;
  var g_ut = getFarmGut();
  var step1 = base + "/nc/cgi-bin/wap_farm_sale_all?step=1&sid=" + sid + "&g_ut=" + g_ut;
  return ranchGet(step1, cookie).then(function (html) {
    var h = html.replace(/&amp;/g, "&");
    var link = firstMatch(h, /(wap_farm_sale_all\?[^\"\s>]*step=2[^\"\s>]*)/);
    if (link && (!/sid=/.test(link) || !/g_ut=/.test(link))) {
      link = "";
    }
    if (!link) {
      link = "wap_farm_sale_all?step=2&sid=" + sid + "&g_ut=" + g_ut + "&buyway=0";
    }
    var step2 = link.indexOf("http") === 0 ? link : base + "/nc/cgi-bin/" + link.replace(/^\.?\//, "");
    return ranchGet(step2, cookie).then(function (html2) {
      var msg = extractMessage(html2);
      var text = normalizeSpace(msg || stripTags(html2 || ""));
      var money = parseMoneyFromMsg(msg || stripTags(html2));
      if (money > 0) MONEY_STATS.farmSell += money;
      if (msg) log("🧺 农场售卖: " + msg);
      if (isSellSuccess(msg, html2)) FARM_EXTRA.sell += 1;
      else if (isTransientFailText(text)) {
        ACTION_STATS.errors += 1;
        log("⚠️ 农场售卖未完成: " + (msg || "系统繁忙，请稍后重试"));
      }
    });
  });
}

function parseFarmRepLockRows(html) {
  var h = (html || "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ");
  var rows = [];
  var re =
    /(?:^|<br\s*\/?>)\s*(?:\d+\)\s*)?(【\s*锁\s*】\s*)?([^<\r\n]*?)\(([0-9]+)金币\/个\)\s*[:：]\s*([0-9]+)个[\s\S]{0,260}?<a[^>]+href="([^"]*wap_farm_rep_lock\?[^"]+)"[^>]*>([^<]*)<\/a>/gi;
  var m;
  while ((m = re.exec(h))) {
    var name = normalizeCropName(m[2] || "");
    var amount = Number(m[4] || 0);
    var link = (m[5] || "").replace(/&amp;/g, "&");
    var opText = normalizeSpace(m[6] || "");
    var cid = firstMatch(link, /[?&]cId=([0-9]+)/i);
    var status = Number(firstMatch(link, /[?&]status=([0-9]+)/i) || 0);
    var locked = status === 2 || /解锁/.test(opText || "");
    rows.push({
      cid: cid ? String(cid) : "",
      name: name,
      amount: amount > 0 ? amount : 0,
      status: status,
      locked: !!locked,
      opText: opText,
      lockUrl: status === 1 ? link : "",
      rawUrl: link
    });
  }
  if (rows.length > 0) return rows;

  // 兜底：仅解析锁链接（名称缺失时由 cId 映射补齐）
  var re2 = /href="([^"]*wap_farm_rep_lock\?[^"]+)"/gi;
  while ((m = re2.exec(h))) {
    var link2 = (m[1] || "").replace(/&amp;/g, "&");
    var cid2 = firstMatch(link2, /[?&]cId=([0-9]+)/i);
    var status2 = Number(firstMatch(link2, /[?&]status=([0-9]+)/i) || 0);
    if (!cid2) continue;
    rows.push({
      cid: String(cid2),
      name: normalizeCropName(getCropNameByCid(cid2)),
      amount: 0,
      status: status2,
      locked: status2 === 2,
      opText: "",
      lockUrl: status2 === 1 ? link2 : "",
      rawUrl: link2
    });
  }
  return rows;
}

function getFarmRepLockStateByCid(html, cid) {
  if (!html || !cid) return null;
  var h = (html || "").replace(/&amp;/g, "&");
  var re = new RegExp("wap_farm_rep_lock\\?[^\"'\\s<]*cId=" + String(cid) + "[^\"'\\s<]*status=([0-9]+)", "i");
  var m = h.match(re);
  if (!m) return null;
  var status = Number(m[1] || 0);
  if (status === 2) return true;
  if (status === 1) return false;
  return null;
}

function farmRepLockUrl(base, link) {
  var u = String(link || "").replace(/&amp;/g, "&");
  if (!u) return "";
  if (u.indexOf("http://") === 0 || u.indexOf("https://") === 0) return u;
  if (u.indexOf("/nc/cgi-bin/") === 0) return base + u;
  return base + "/nc/cgi-bin/" + u.replace(/^\.?\//, "");
}

function ensureFarmProtectedLocks(cookie) {
  if (!CONFIG.ENABLE.farm_sell_all) return Promise.resolve(cookie);
  if (!CONFIG.FARM_SELL_PROTECT_ENABLE || !CONFIG.FARM_SELL_PROTECT_LOCK_ENABLE) return Promise.resolve(cookie);
  var base = CONFIG.FARM_WAP_BASE || "https://mcapp.z.qq.com";
  var sid = CONFIG.RANCH_SID;
  var g_ut = getFarmGut();
  var listBase = base + "/nc/cgi-bin/wap_farm_rep_list?sid=" + sid + "&g_ut=" + g_ut + "&buyway=0";
  var curCookie = cookie;
  var protectedHits = 0;
  var alreadyLocked = 0;
  var lockDone = 0;
  var lockFail = 0;
  var transientRetries = Number(CONFIG.RETRY_TRANSIENT || 0);
  if (isNaN(transientRetries) || transientRetries < 0) transientRetries = 0;

  function lockOneCrop(row, attempt) {
    var cid = row && row.cid ? String(row.cid) : "";
    var name = normalizeCropName((row && row.name) || (cid ? getCropNameByCid(cid) : "")) || (cid ? "cId" + cid : "作物");
    var reason = normalizeSpace((row && row.reason) || "");
    var url = farmRepLockUrl(base, row && row.lockUrl);
    if (!url || !cid) return Promise.resolve(false);
    return getHtmlFollow(url, curCookie, defaultMcappReferer(), "仓库加锁", 0)
      .then(function (ret) {
        if (ret.cookie) curCookie = ret.cookie;
        var html = (ret && ret.body) || "";
        var lockState = getFarmRepLockStateByCid(html, cid);
        if (lockState === true) {
          lockDone += 1;
          log("🔒 农场保护锁定: " + name + "(cId=" + cid + ")" + (reason ? " [" + reason + "]" : ""));
          return true;
        }
        var text = normalizeSpace(stripTags(html || ""));
        if (isTransientFailText(text) && attempt < transientRetries) {
          if (CONFIG.DEBUG) logDebug("🔒 农场保护锁定繁忙(cId=" + cid + ")，第" + (attempt + 1) + "次重试");
          return sleep(CONFIG.RETRY_WAIT_MS || 600).then(function () {
            return lockOneCrop(row, attempt + 1);
          });
        }
        if (/锁定成功|加锁成功|设置成功|操作成功/.test(text)) {
          lockDone += 1;
          log("🔒 农场保护锁定: " + name + "(cId=" + cid + ")" + (reason ? " [" + reason + "]" : ""));
          return true;
        }
        lockFail += 1;
        log("⚠️ 农场保护锁定失败(cId=" + cid + "): " + (extractMessage(html) || text || "状态未变化"));
        return false;
      })
      .catch(function (e) {
        lockFail += 1;
        log("⚠️ 农场保护锁定异常(cId=" + cid + "): " + errText(e));
        return false;
      });
  }

  function processRows(rows) {
    var arr = ensureArray(rows);
    var targets = [];
    for (var i = 0; i < arr.length; i++) {
      var row = arr[i] || {};
      var cid = row.cid != null && row.cid !== "" ? String(row.cid) : "";
      var nm = normalizeCropName(row.name || (cid ? getCropNameByCid(cid) : ""));
      var reason = isFarmProtectedCropForSell(nm, cid);
      if (!reason) continue;
      row.cid = cid;
      row.name = nm;
      row.reason = reason;
      targets.push(row);
    }
    if (!targets.length) return Promise.resolve();
    protectedHits += targets.length;
    if (CONFIG.DEBUG) logDebug("🔒 农场保护命中: " + formatProtectedCropList(targets, 6));

    var chain = Promise.resolve();
    for (var j = 0; j < targets.length; j++) {
      (function (item) {
        chain = chain.then(function () {
          if (item.locked || item.status === 2) {
            alreadyLocked += 1;
            return;
          }
          if (item.status !== 1 || !item.lockUrl) {
            lockFail += 1;
            log("⚠️ 农场保护锁定跳过(cId=" + item.cid + "): 页面无加锁入口");
            return;
          }
          return lockOneCrop(item, 0);
        });
      })(targets[j]);
    }
    return chain;
  }

  function scanPage(pageNo) {
    var url = listBase + (pageNo > 1 ? "&page=" + pageNo : "");
    return getHtmlFollow(url, curCookie, defaultMcappReferer(), "仓库保护", 0)
      .then(function (ret) {
        if (ret.cookie) curCookie = ret.cookie;
        var html = (ret && ret.body) || "";
        var rows = parseFarmRepLockRows(html);
        var info = parseBagPageInfo(html) || {};
        var total = Number(info.total || 1);
        if (isNaN(total) || total < 1) total = 1;
        return processRows(rows).then(function () {
          return { total: total };
        });
      })
      .catch(function (e) {
        log("⚠️ 农场保护扫描失败(page=" + pageNo + "): " + errText(e));
        return { total: 1 };
      });
  }

  return scanPage(1).then(function (first) {
    var total = Number((first && first.total) || 1);
    if (isNaN(total) || total < 1) total = 1;
    var p = Promise.resolve();
    for (var page = 2; page <= total; page++) {
      (function (pno) {
        p = p.then(function () {
          return sleep(CONFIG.WAIT_MS || 0);
        }).then(function () {
          return scanPage(pno);
        });
      })(page);
    }
    return p.then(function () {
      if (protectedHits > 0 || lockDone > 0 || lockFail > 0) {
        log(
          "🔒 农场保护: 命中" +
            protectedHits +
            " 已锁" +
            alreadyLocked +
            " 新增锁定" +
            lockDone +
            (lockFail > 0 ? " 失败" + lockFail : "")
        );
      }
      return curCookie;
    });
  });
}

function farmSellAllJson(cookie) {
  if (!CONFIG.ENABLE.farm_sell_all) return Promise.resolve(false);
  if (!CONFIG.FARM_JSON_ENABLE || !CONFIG.FARM_JSON_SALE_ENABLE) return Promise.resolve(false);
  return fetchFarmCropJson(cookie).then(function (crop) {
    if (!crop || !crop.ok) return false;
    var list = crop.items || [];
    var ids = [];
    var protectedItems = [];
    for (var i = 0; i < list.length; i++) {
      var it = list[i] || {};
      if (!it.cid || !it.amount || it.amount <= 0) continue;
      var cid = String(it.cid);
      var name = normalizeCropName(it.name || getCropNameByCid(cid) || ("cId" + cid));
      var reason = isFarmProtectedCropForSell(name, cid);
      if (reason) {
        protectedItems.push({ cid: cid, name: name, reason: reason, amount: it.amount });
        continue;
      }
      var locked = !!it.isLock;
      if (!locked && !("isLock" in it) && cid === "40") locked = true;
      if (locked) continue;
      ids.push(cid);
    }
    if (protectedItems.length > 0) {
      log("🧺 农场售卖(JSON): 保护跳过" + protectedItems.length + "项[" + formatProtectedCropList(protectedItems, 4) + "]");
    }
    if (ids.length === 0) {
      log("🧺 农场售卖(JSON): 仓库无可卖作物");
      return true;
    }
    var uIdx = getFarmUin(cookie);
    var farmTime = getFarmTime();
    var farmKey = legacyFarmKey(farmTime);
    if (!uIdx || !farmKey) return false;
    var base = CONFIG.FARM_JSON_BASE || "https://nc.qzone.qq.com";
    var url = base + "/cgi-bin/cgi_farm_saleall?mod=repertory&act=saleAll";
    var headers = buildFarmJsonHeaders(cookie);
    var body = buildLegacyBody({
      cIds: ids.join(","),
      uIdx: uIdx,
      uId: uIdx,
      farmTime: farmTime,
      farmKey: farmKey
    });
    return httpRequest({ method: "POST", url: url, headers: headers, body: body })
      .then(function (resp) {
        var json = tryJson(resp.body);
        if (!json) {
          log("🧺 农场售卖(JSON): 响应非 JSON");
          return false;
        }
        var ret = parseSaleAllJsonResult(json);
        if (ret.msg) log("🧺 农场售卖(JSON): " + ret.msg);
        if (ret.money > 0) MONEY_STATS.farmSell += ret.money;
        if (ret.success) {
          FARM_EXTRA.sell += 1;
          return true;
        }
        return false;
      })
      .catch(function (e) {
        log("🧺 农场售卖(JSON): 请求失败 " + e);
        return false;
      });
  });
}

function farmSellAll(cookie) {
  if (!CONFIG.ENABLE.farm_sell_all) return Promise.resolve();
  return ensureFarmProtectedLocks(cookie).then(function (safeCookie) {
    var ck = safeCookie || cookie;
    return farmSellAllJson(ck).then(function (ok) {
      if (ok) return;
      if (!CONFIG.FARM_JSON_FALLBACK_WAP) return;
      if (CONFIG.FARM_SELL_PROTECT_ENABLE && CONFIG.FARM_SELL_PROTECT_STRICT) {
        log("🧺 农场售卖: 保护严格模式生效，JSON售卖失败时跳过WAP回退");
        return;
      }
      return farmSellAllWap(ck);
    });
  });
}

function farmSignIn(cookie) {
  if (!CONFIG.ENABLE.farm_signin) return Promise.resolve();
  var base = CONFIG.FARM_WAP_BASE;
  var sid = CONFIG.RANCH_SID;
  var g_ut = getFarmGut();
  var boardEnabled = CONFIG.FARM_SIGNIN_BOARD_ENABLE !== false;
  var boardMaxLoop = Number(CONFIG.FARM_SIGNIN_BOARD_MAX_LOOP || 12);
  if (isNaN(boardMaxLoop) || boardMaxLoop < 1) boardMaxLoop = 12;

  function parseMonthSignState(json) {
    if (!isFarmEventOk(json)) return null;
    return {
      canDraw: Number(json.can_draw || 0) || 0,
      todaySign: Number(json.today_signin || 0) || 0,
      nextDrawId: Number(json.signin_can_draw_id || 0) || 0,
      drawId: Number(json.signin_draw_id || 0) || 0,
      monthDays: Number(json.month_days || 0) || 0,
      nextSigninDraw: Number(json.next_signin_draw || 0) || 0
    };
  }

  function runMonthSignBoard() {
    if (!boardEnabled) return Promise.resolve({ probed: false, todaySign: -1, canDraw: 0, claimed: 0 });
    var ctx = null;

    function readHome(tag) {
      return callFarmEventApi(cookie, "/cgi-bin/cgi_farm_month_signin_home", farmEventParams(ctx)).then(function (json) {
        var state = parseMonthSignState(json);
        if (!state) {
          var msg = farmEventErrMsg(json);
          if (!isFarmEventNoop(json, msg)) {
            log("⚠️ 签到板状态读取失败(" + tag + "): " + msg);
          } else if (CONFIG.DEBUG) {
            logDebug("📅 签到板状态(" + tag + "): 无需执行(" + msg + ")");
          }
          return null;
        }
        return state;
      });
    }

    function drawOne(id) {
      return callFarmEventApi(
        cookie,
        "/cgi-bin/cgi_farm_month_signin_draw",
        farmEventParams(ctx, {
          id: id
        })
      ).then(function (json) {
        if (!isFarmEventOk(json)) {
          var msg = farmEventErrMsg(json);
          if (isFarmEventNoop(json, msg) || /已领|无可领|不能领取|次数不足|不满足|今日已签/.test(msg || "")) {
            if (CONFIG.DEBUG) logDebug("📅 签到板领奖(id=" + id + "): 无需执行(" + msg + ")");
            return { ok: false, noop: true, state: null };
          }
          log("⚠️ 签到板领奖失败(id=" + id + "): " + msg);
          return { ok: false, noop: false, state: null };
        }
        var state = parseMonthSignState(json);
        if (!state) state = { canDraw: 0, todaySign: 0, nextDrawId: 0, drawId: id, monthDays: 0, nextSigninDraw: 0 };
        return { ok: true, noop: false, state: state };
      });
    }

    return ensureFarmEventContext(cookie).then(function (c) {
      if (!c) {
        if (CONFIG.DEBUG) logDebug("📅 签到板: 缺少 uIdx/uinY，跳过");
        return { probed: false, todaySign: -1, canDraw: 0, claimed: 0 };
      }
      ctx = c;
      return readHome("开始").then(function (state) {
        if (!state) return { probed: true, todaySign: -1, canDraw: 0, claimed: 0 };
        if (CONFIG.DEBUG) {
          logDebug(
            "📅 签到板状态: 今日" +
              (state.todaySign > 0 ? "已签" : "未签") +
              " 可领" +
              state.canDraw +
              (state.nextDrawId > 0 ? " 下一档#" + state.nextDrawId : "")
          );
        }
        if (state.canDraw <= 0) return { probed: true, todaySign: state.todaySign, canDraw: 0, claimed: 0 };

        var claimed = 0;
        var loopNo = 0;

        function pass(cur) {
          if (!cur || cur.canDraw <= 0) return Promise.resolve(cur);
          if (loopNo >= boardMaxLoop) {
            log("⚠️ 签到板领奖: 达到上限(" + boardMaxLoop + ")，剩余可领" + cur.canDraw);
            return Promise.resolve(cur);
          }
          var id = Number(cur.nextDrawId || 0) || 0;
          if (!id) id = Number(cur.drawId || 0) + 1;
          if (!id) id = claimed + 1;
          if (!id || isNaN(id) || id < 1) {
            log("⚠️ 签到板领奖: 无法确定领奖档位，停止");
            return Promise.resolve(cur);
          }
          loopNo += 1;
          return drawOne(id).then(function (ret) {
            if (!ret || !ret.ok) {
              if (!ret || !ret.noop) return cur;
              return readHome("领奖noop后").then(function (noopState) {
                return noopState || cur;
              });
            }
            claimed += 1;
            var next = ret.state || cur;
            log("🎁 签到板领奖: 第" + id + "档成功，剩余可领" + next.canDraw);
            if (next.canDraw <= 0) return next;
            return sleep(CONFIG.WAIT_MS).then(function () {
              return pass(next);
            });
          });
        }

        return pass(state).then(function (lastState) {
          return readHome("结束").then(function (endState) {
            var finalState = endState || lastState || state;
            if (claimed > 0) {
              FARM_EXTRA.signin += 1;
              log("📅 签到板: 共领取" + claimed + "档奖励");
            }
            return {
              probed: true,
              todaySign: Number(finalState.todaySign || 0) || 0,
              canDraw: Number(finalState.canDraw || 0) || 0,
              claimed: claimed
            };
          });
        });
      });
    });
  }

  function ensureHome() {
    if (LAST_FARM_HOME_HTML) return Promise.resolve({ html: LAST_FARM_HOME_HTML, cookie: cookie });
    var homeUrl = base + "/nc/cgi-bin/wap_farm_index?sid=" + sid + "&g_ut=" + g_ut;
    return getHtmlFollow(homeUrl, cookie, null, "农场签到探测", 0).then(function (resp) {
      LAST_FARM_HOME_HTML = resp.body || "";
      return { html: LAST_FARM_HOME_HTML, cookie: resp.cookie || cookie };
    });
  }

  return runMonthSignBoard()
    .catch(function (e) {
      log("⚠️ 签到板异常: " + errText(e));
      return { probed: false, todaySign: -1, canDraw: 0, claimed: 0 };
    })
    .then(function (board) {
      if (board && board.probed && Number(board.todaySign || 0) > 0) {
        if (CONFIG.DEBUG) logDebug("📅 农场签到: 签到板显示今日已签到，跳过WAP签到");
        return;
      }
      return ensureHome().then(function (res) {
        var html = (res && res.html) || "";
        var ck = (res && res.cookie) || cookie;
        if (!hasSignInEntry(html)) {
          log("📅 农场签到: 页面无入口，跳过");
          return;
        }
        var signUrl = base + "/nc/cgi-bin/wap_farm_index?sid=" + sid + "&g_ut=" + g_ut + "&signin=1";
        return getHtmlFollow(signUrl, ck, defaultMcappReferer(), "农场签到", 0).then(function (resp) {
          var html2 = resp.body || "";
          var msg = extractSignInReward(html2);
          if (
            msg &&
            msg.indexOf("除草") >= 0 &&
            msg.indexOf("杀虫") >= 0 &&
            msg.indexOf("浇水") >= 0
          ) {
            msg = "";
          }
          if (
            msg &&
            !/(成功|失败|已)/.test(msg) &&
            /(QQ提醒|黄钻|超Q|土地|施肥|收获)/.test(msg)
          ) {
            msg = "";
          }
          if (msg) log("📅 农场签到: " + msg);
          else log("📅 农场签到: 已尝试签到");
          if (resp.status === 200) FARM_EXTRA.signin += 1;
        });
      });
    });
}

function farmEventEnabled() {
  return !!CONFIG.FARM_EVENT_ENABLE;
}

function farmEventParams(ctx, extra) {
  var p = {
    uIdx: ctx.uIdx,
    uinY: ctx.uinY,
    farmTime: getFarmTime(),
    platform: CONFIG.FARM_PLATFORM || "13",
    appid: CONFIG.FARM_APPID || "353",
    version: CONFIG.FARM_VERSION || "4.0.20.0"
  };
  if (extra) {
    for (var k in extra) {
      if (!extra.hasOwnProperty(k)) continue;
      p[k] = extra[k];
    }
  }
  return p;
}

function ensureFarmEventContext(cookie) {
  return ensureFarmJsonContext(cookie)
    .catch(function () {
      return null;
    })
    .then(function () {
      var uIdx = FARM_CTX.uIdx || getFarmUin(cookie) || "";
      var uinY = FARM_CTX.uinY || getFarmUinFromCookie(cookie) || "";
      if (!uIdx || !uinY) return null;
      return { uIdx: String(uIdx), uinY: String(uinY) };
    });
}

function callFarmEventApi(cookie, path, params) {
  var base = CONFIG.FARM_EVENT_BASE || CONFIG.FARM_JSON_BASE || "https://nc.qzone.qq.com";
  var url = base + path;
  return httpRequest({
    method: "POST",
    url: url,
    headers: buildFishJsonHeaders(cookie),
    body: buildLegacyBody(params)
  }).then(function (resp) {
    return tryJson(resp.body);
  });
}

function isFarmEventOk(json) {
  if (!json || typeof json !== "object") return false;
  var ecode = Number(json.ecode || 0);
  if (!isNaN(ecode) && ecode !== 0) return false;
  if (json.code !== undefined && json.code !== null && json.code !== "") {
    var code = Number(json.code);
    if (!isNaN(code) && code !== 0 && code !== 1) return false;
  }
  return true;
}

function farmEventErrMsg(json) {
  if (!json || typeof json !== "object") return "非JSON";
  return json.direction || json.msg || json.message || ("ecode=" + (json.ecode != null ? json.ecode : "未知"));
}

function isFarmEventNoop(json, msg) {
  var ecode = Number(json && json.ecode);
  if (!isNaN(ecode) && (ecode === -32 || ecode === -16 || ecode === -30 || ecode === -31)) return true;
  var m = normalizeSpace(msg || farmEventErrMsg(json));
  if (!m) return false;
  var m2 = m.replace(/\s+/g, "");
  return /(已领|已领取|领取过|今天.*领取|今日.*领取|无需|不能|未开启|已完成|无可领|没有可领|没有可奖|可领奖励|次数不足|不满足|活动未开始|已经可以收获|可收获了|愿望已经.*收获)/.test(
    m2
  );
}

function mergeRewardText(origin, add) {
  var a = normalizeSpace(origin || "");
  var b = normalizeSpace(add || "");
  if (!b) return a;
  if (!a) return b;
  if (a.indexOf(b) >= 0) return a;
  return a + "；" + b;
}

function normalizeRewardNameByType(rawName, type, id) {
  var name = normalizeSpace(rawName || "");
  if (name) return name;
  var sid = id != null && id !== "" ? String(id) : "";
  var tp = Number(type || 0);
  if (tp === 1) {
    var crop = sid ? getCropNameByCid(sid) : "";
    if (crop && !/^cId\d+$/i.test(crop)) return crop;
    return "节气种子";
  }
  if (tp === 37) return "营养液";
  if (tp === 89) return "碎片";
  return "奖励";
}

function formatFarmEventPkg(pkg) {
  var arr = ensureArray(pkg);
  if (!arr.length) return "";
  var byName = {};
  var order = [];
  for (var i = 0; i < arr.length; i++) {
    var it = arr[i] || {};
    var id = it.id != null ? it.id : it.itemid != null ? it.itemid : "";
    var name = normalizeRewardNameByType(
      it.name || it.itemName || it.item_name || it.tName || it.title || "",
      it.type,
      id
    );
    var num = Number(it.num || 0);
    if (isNaN(num) || num <= 0) num = 1;
    if (!byName[name]) {
      byName[name] = 0;
      order.push(name);
    }
    byName[name] += num;
  }
  var parts = [];
  for (var j = 0; j < order.length; j++) {
    var nm = order[j];
    parts.push(nm + "×" + byName[nm]);
  }
  return parts.join("，");
}

function formatSeedHbPool(seedList, maxShow) {
  var arr = ensureArray(seedList);
  if (!arr.length) return "";
  var limit = Number(maxShow || 4);
  if (isNaN(limit) || limit <= 0) limit = 4;
  var parts = [];
  for (var i = 0; i < arr.length; i++) {
    var it = arr[i] || {};
    var sid = it.id != null ? String(it.id) : it.cId != null ? String(it.cId) : "";
    if (!sid) continue;
    var name = normalizeRewardNameByType(it.name || it.cName || "", 1, sid);
    var cnt = Number(it.count || it.num || it.amount || 0);
    if (isNaN(cnt) || cnt <= 0) cnt = 1;
    parts.push(name + "×" + cnt);
    if (parts.length >= limit) break;
  }
  return parts.join("；");
}

function parseBulingGiftSlots(gift) {
  var arr = ensureArray(gift);
  var slots = [];
  for (var i = 0; i < arr.length; i++) {
    var row = arr[i];
    if (!row || typeof row !== "object") continue;
    for (var k in row) {
      if (!row.hasOwnProperty(k)) continue;
      var raw = row[k];
      var isArr = Object.prototype.toString.call(raw) === "[object Array]";
      var items = isArr ? raw : ensureArray(raw);
      if (!items.length && !isArr && raw && typeof raw === "object") {
        var hasOwn = false;
        for (var rk in raw) {
          if (raw.hasOwnProperty(rk)) {
            hasOwn = true;
            break;
          }
        }
        if (hasOwn) items = [raw];
      }
      if (!items.length) continue;
      slots.push({ id: String(k), items: items });
    }
  }
  slots.sort(function (a, b) {
    var an = Number(a.id);
    var bn = Number(b.id);
    if (!isNaN(an) && !isNaN(bn)) return an - bn;
    return String(a.id).localeCompare(String(b.id));
  });
  return slots;
}

function formatBulingSlotPreview(slot) {
  if (!slot) return "";
  var id = String(slot.id || "");
  var arr = ensureArray(slot.items);
  if (id === "2") {
    var total = 0;
    for (var i = 0; i < arr.length; i++) {
      total += Number((arr[i] || {}).num || 0) || 0;
    }
    if (total > 0) return "晶石×" + total;
    return "晶石";
  }
  if (id === "3") return "礼包(" + arr.length + "项)";
  return "ID" + id + "(" + arr.length + "项)";
}

function formatBulingReward(json, id) {
  var pkg = formatFarmEventPkg(json && json.pkg);
  if (pkg) return pkg;
  var jingshi = Number((json && json.jingshi) || 0) || 0;
  if (jingshi > 0) return "晶石×" + jingshi;
  var gain = Number((json && (json.num || json.count || json.amount || json.add)) || 0) || 0;
  if (gain > 0) return "补领奖励(ID" + String(id || "?") + ")×" + gain;
  return "";
}

function wishRemainingSec(ts) {
  var n = Number(ts || 0);
  if (!n || isNaN(n) || n < 1000000000) return 0;
  var wait = n - getFarmTime();
  return wait > 0 ? wait : 0;
}

function formatWishCooldown(state) {
  if (!state) return "";
  var parts = [];
  if (state.freeWaitSec > 0) parts.push("免费星" + formatWaitSec(state.freeWaitSec));
  if (state.selfWaitSec > 0) parts.push("自助" + formatWaitSec(state.selfWaitSec));
  if (state.starWaitSec > 0) parts.push("点星" + formatWaitSec(state.starWaitSec));
  if (!parts.length) return "冷却无";
  return "冷却[" + parts.join("；") + "]";
}

function formatWishReward(json) {
  if (!json || typeof json !== "object") return "";
  var pkg = formatFarmEventPkg(json.pkg);
  if (pkg) return pkg;
  var giftList = formatFarmEventPkg(json.gift_list);
  if (giftList) return giftList;
  var giftNew = formatFarmEventPkg(json.gift_new);
  if (giftNew) return giftNew;
  if (json.gift && typeof json.gift === "object") return formatFarmEventPkg([json.gift]);
  return "";
}

function parseWishOptions(json) {
  var out = [];
  var seen = {};
  var arr = ensureArray(json && json.gift_list);
  for (var i = 0; i < arr.length; i++) {
    var it = arr[i] || {};
    var id = Number(it.id != null ? it.id : it.w_id != null ? it.w_id : it.wid);
    if (!id || isNaN(id) || id <= 0) continue;
    if (seen[id]) continue;
    seen[id] = 1;
    var title = formatFarmEventPkg([it]) || "愿望#" + id;
    out.push({ id: id, title: title });
  }
  return out;
}

function pickWishOption(state) {
  if (!state) return null;
  var wid = Number(state.wId || 0);
  if (wid > 0) {
    var opts = ensureArray(state.options);
    for (var i = 0; i < opts.length; i++) {
      if (Number((opts[i] || {}).id || 0) === wid) return opts[i];
    }
    return { id: wid, title: "愿望#" + wid };
  }
  var first = ensureArray(state.options)[0];
  if (!first) return null;
  return first;
}

function parseWishState(json) {
  if (!isFarmEventOk(json)) return null;
  var starlist = ensureArray(json.starlist);
  var options = parseWishOptions(json);
  var freeStarTime = Number(json.freeStarTime || json.free_star_time || 0) || 0;
  var selfLastTime = Number(json.self_lasttime || json.selfLastTime || 0) || 0;
  var starTs = Number(json.star_ts || json.starTs || 0) || 0;
  var wId = Number(json.w_id || json.wId || 0) || 0;
  if (!wId && options.length === 1) wId = Number(options[0].id || 0) || 0;
  return {
    open: Number(json.open || 0) || 0,
    status: Number(json.status || 0) || 0,
    self: Number(json.self || 0) || 0,
    vstar: Number(json.vstar || 0) || 0,
    costStar: Number(json.cost_star || json.costStar || 0) || 0,
    allStarsTimes: Number(json.allStarsTimes || 0) || 0,
    tool: Number(json.tool || 0) || 0,
    starLimit: Number(json.star_limit || json.starLimit || 0) || 0,
    wId: wId,
    wNum: Number(json.w_num || 0) || 0,
    wTime: Number(json.w_time || json.wTime || 0) || 0,
    maxWish: Number(json.max_wish || json.maxWish || 0) || 0,
    grow: Number(json.grow || 0) || 0,
    options: options,
    freeStarTime: freeStarTime,
    selfLastTime: selfLastTime,
    starTs: starTs,
    freeWaitSec: wishRemainingSec(freeStarTime),
    selfWaitSec: wishRemainingSec(selfLastTime),
    starWaitSec: wishRemainingSec(starTs),
    starlist: starlist
  };
}

function runFarmEvents(cookie) {
  if (!farmEventEnabled()) return Promise.resolve();
  log("🎐 节气活动: 启动");
  var ctx = null;

  function runSeedHb() {
    if (!CONFIG.FARM_EVENT_SEEDHB_ENABLE) return Promise.resolve();
    var statusPath = "/cgi-bin/cgi_farm_seedhb?act=9";
    var claimPath = "/cgi-bin/cgi_farm_seedhb?act=10";
    var transientRetries = Number(CONFIG.FARM_EVENT_RETRY_TRANSIENT);
    if (isNaN(transientRetries) || transientRetries < 0) transientRetries = Number(CONFIG.RETRY_TRANSIENT || 0);
    if (isNaN(transientRetries) || transientRetries < 1) transientRetries = 1;

    function readStatus(tag) {
      return callFarmEventApi(cookie, statusPath, farmEventParams(ctx)).then(function (json) {
        if (!isFarmEventOk(json)) {
          var msg = farmEventErrMsg(json);
          if (!isFarmEventNoop(json, msg)) {
            FARM_EVENT_STATS.errors += 1;
            log("⚠️ 节气状态读取失败(" + tag + "): " + msg);
          } else if (CONFIG.DEBUG) {
            logDebug("🎐 节气状态(" + tag + "): 无需执行(" + msg + ")");
          }
          return null;
        }
        FARM_EVENT_STATS.seedTerm = Number(json.currentTerm || 0) || 0;
        FARM_EVENT_STATS.seedRound = Number(json.round || 0) || 0;
        FARM_EVENT_STATS.seedCanClaim = Number(json.l_seed_ex || 0) || 0;
        FARM_EVENT_STATS.seedTodayClaimed =
          json && json.isGet !== undefined && json.isGet !== null ? Number(json.isGet || 0) || 0 : -1;
        var pool = formatSeedHbPool(json.seedList, 4);
        var statusLine =
          "第" +
          FARM_EVENT_STATS.seedTerm +
          "节气 第" +
          FARM_EVENT_STATS.seedRound +
          "轮 可领" +
          FARM_EVENT_STATS.seedCanClaim;
        if (FARM_EVENT_STATS.seedTodayClaimed > 0) statusLine += " 今日已领";
        if (pool) statusLine += " 奖励池[" + pool + "]";
        log("🎐 节气状态: " + statusLine);
        return json;
      });
    }

    function claimOnce(attempt) {
      return callFarmEventApi(cookie, claimPath, farmEventParams(ctx)).then(function (json) {
        if (!isFarmEventOk(json)) {
          var msg = farmEventErrMsg(json);
          if (isTransientFailText(msg || "") && attempt < transientRetries) {
            log("⚠️ 节气领取繁忙，第" + (attempt + 1) + "次重试");
            return sleep(CONFIG.RETRY_WAIT_MS || 800).then(function () {
              return claimOnce(attempt + 1);
            });
          }
          if (isTransientFailText(msg || "")) {
            FARM_EVENT_STATS.busy += 1;
            log("⚠️ 节气领取繁忙: 已重试" + transientRetries + "次，留待下轮");
            return "busy";
          }
          if (!isFarmEventNoop(json, msg)) {
            FARM_EVENT_STATS.errors += 1;
            log("⚠️ 节气领取失败: " + msg);
            return "stop";
          }
          if (/已\s*领|已\s*领取|领取\s*过|今\s*天.*领\s*取|今\s*日.*领\s*取/.test(msg || "")) {
            FARM_EVENT_STATS.seedTodayClaimed = 1;
            if (FARM_EVENT_STATS.seedCanClaim > 0) {
              log("🎁 节气领取: 今日已达上限，剩余可领" + FARM_EVENT_STATS.seedCanClaim + "，留待次日");
            } else {
              log("🎁 节气领取: 今日已领，跳过");
            }
            return "day-limit";
          }
          if (CONFIG.DEBUG) logDebug("🎁 节气领取: 无需执行(" + msg + ")");
          return "stop";
        }
        FARM_EVENT_STATS.seedClaim += 1;
        FARM_EXTRA.signin += 1;
        var reward = formatFarmEventPkg(json.pkg);
        if (reward) {
          FARM_EVENT_STATS.seedReward = mergeRewardText(FARM_EVENT_STATS.seedReward, reward);
          log("🎁 节气领取: " + reward);
        } else {
          log("🎁 节气领取: 成功");
        }
        return readStatus("领取后").then(function () {
          return "continue";
        });
      });
    }

    return readStatus("开始").then(function (st) {
      if (!st) return;
      if (!CONFIG.FARM_EVENT_SEEDHB_AUTO_CLAIM) return;
      var loops = 0;
      var maxLoops = 5;
      var claimed = 0;
      function nextClaim() {
        if (loops >= maxLoops) {
          if (CONFIG.DEBUG) logDebug("🎁 节气领取: 达到单轮上限" + maxLoops + "次，停止本轮");
          return Promise.resolve();
        }
        loops += 1;
        if (loops === 1 && FARM_EVENT_STATS.seedCanClaim <= 0 && CONFIG.DEBUG) {
          logDebug("🎁 节气领取: 状态可领=0，执行一次探测领取");
        }
        return claimOnce(0).then(function (flag) {
          if (flag === "continue") {
            claimed += 1;
            return nextClaim();
          }
          if (flag === "busy") return;
          if (flag === "day-limit") return;
          if (flag === "stop" && claimed <= 0 && FARM_EVENT_STATS.seedCanClaim > 0 && CONFIG.DEBUG) {
            logDebug("🎁 节气领取: 状态提示可领，但领取返回无变化");
          }
          return;
        });
      }
      return nextClaim();
    });
  }

  function runBuling() {
    if (!CONFIG.FARM_EVENT_BULING_ENABLE) return Promise.resolve();
    var statusPath = "/cgi-bin/cgi_farm_buling?act=index";
    var claimPath = "/cgi-bin/cgi_farm_buling?act=get";
    var transientRetries = Number(CONFIG.FARM_EVENT_RETRY_TRANSIENT);
    if (isNaN(transientRetries) || transientRetries < 0) transientRetries = Number(CONFIG.RETRY_TRANSIENT || 0);
    if (isNaN(transientRetries) || transientRetries < 1) transientRetries = 1;
    var maxLoops = Number(CONFIG.FARM_EVENT_BULING_MAX_LOOP || 5);
    if (isNaN(maxLoops) || maxLoops < 1) maxLoops = 5;
    var doneIds = {};
    var noopIds = {};
    var busyIds = {};

    function isSlotLikelyClaimable(slot) {
      if (!slot) return false;
      var arr = ensureArray(slot.items);
      if (!arr.length) return false;
      for (var i = 0; i < arr.length; i++) {
        var it = arr[i] || {};
        var n = Number(it.num || it.count || it.amount || 0);
        if (!isNaN(n) && n > 0) return true;
      }
      return false;
    }

    function readIndex(tag) {
      return callFarmEventApi(cookie, statusPath, farmEventParams(ctx)).then(function (json) {
        if (!isFarmEventOk(json)) {
          var msg = farmEventErrMsg(json);
          if (!isFarmEventNoop(json, msg)) {
            FARM_EVENT_STATS.errors += 1;
            log("⚠️ 奖励补领状态读取失败(" + tag + "): " + msg);
          } else if (CONFIG.DEBUG) {
            logDebug("🎁 奖励补领状态(" + tag + "): 无需执行(" + msg + ")");
          }
          return null;
        }
        var rawSlots = parseBulingGiftSlots(json.gift);
        var slots = [];
        var detail = [];
        var ids = [];
        for (var i = 0; i < rawSlots.length; i++) {
          var s = rawSlots[i];
          ids.push(s.id);
          detail.push(formatBulingSlotPreview(s));
          if (doneIds[s.id] || noopIds[s.id] || busyIds[s.id]) continue;
          if (!isSlotLikelyClaimable(s)) {
            if (CONFIG.DEBUG) logDebug("🎁 奖励补领预判跳过(id=" + s.id + "): 列表状态不可领");
            continue;
          }
          slots.push(s);
        }
        FARM_EVENT_STATS.bulingCanClaim = slots.length;
        var line = "可领" + slots.length;
        if (CONFIG.DEBUG && rawSlots.length !== slots.length) line += "（槽位" + rawSlots.length + "）";
        if (ids.length) line += " id[" + ids.join(",") + "]";
        if (detail.length) line += " 奖励[" + detail.join("；") + "]";
        log("🎁 奖励补领状态(" + tag + "): " + line);
        return slots;
      });
    }

    function claimById(id, attempt) {
      return callFarmEventApi(cookie, claimPath, farmEventParams(ctx, { id: id })).then(function (json) {
        if (!isFarmEventOk(json)) {
          var msg = farmEventErrMsg(json);
          if (isTransientFailText(msg || "") && attempt < transientRetries) {
            log("⚠️ 奖励补领繁忙(id=" + id + ")，第" + (attempt + 1) + "次重试");
            return sleep(CONFIG.RETRY_WAIT_MS || 800).then(function () {
              return claimById(id, attempt + 1);
            });
          }
          if (isTransientFailText(msg || "")) {
            FARM_EVENT_STATS.busy += 1;
            busyIds[id] = true;
            log("⚠️ 奖励补领繁忙(id=" + id + "): 已重试" + transientRetries + "次，留待下轮");
            return false;
          }
          if (!isFarmEventNoop(json, msg)) {
            FARM_EVENT_STATS.errors += 1;
            log("⚠️ 奖励补领失败(id=" + id + "): " + msg);
          } else {
            noopIds[id] = true;
            if (CONFIG.DEBUG) logDebug("🎁 奖励补领无变化(id=" + id + "): " + msg);
          }
          return false;
        }
        FARM_EVENT_STATS.bulingClaim += 1;
        FARM_EXTRA.signin += 1;
        doneIds[id] = true;
        var reward = formatBulingReward(json, id);
        if (reward) {
          FARM_EVENT_STATS.bulingReward = mergeRewardText(FARM_EVENT_STATS.bulingReward, reward);
          log("🎁 奖励补领领取(id=" + id + "): " + reward);
        } else {
          log("🎁 奖励补领领取(id=" + id + "): 成功");
        }
        return true;
      });
    }

    if (!CONFIG.FARM_EVENT_BULING_AUTO_CLAIM) {
      return readIndex("开始").then(function () {
        return;
      });
    }

    function pass(loopNo) {
      if (loopNo > maxLoops) {
        if (CONFIG.DEBUG) logDebug("🎁 奖励补领: 达到复查上限" + maxLoops + "，停止本轮");
        return Promise.resolve();
      }
      var tag = loopNo === 1 ? "开始" : "复查" + (loopNo - 1);
      return readIndex(tag).then(function (slots) {
        if (!slots || !slots.length) return;
        var p = Promise.resolve();
        var gained = 0;
        for (var i = 0; i < slots.length; i++) {
          (function (sid) {
            p = p.then(function () {
              return claimById(sid, 0).then(function (ok) {
                if (ok) gained += 1;
              });
            });
          })(slots[i].id);
        }
        return p.then(function () {
          if (gained <= 0) {
            if (CONFIG.DEBUG) logDebug("🎁 奖励补领: 本轮无新增领取，停止复查");
            return;
          }
          return pass(loopNo + 1);
        });
      });
    }

    return pass(1);
  }

  function runWish() {
    if (!CONFIG.FARM_EVENT_WISH_ENABLE) return Promise.resolve();
    var maxPass = Number(CONFIG.FARM_EVENT_WISH_MAX_PASS || 8);
    if (isNaN(maxPass) || maxPass < 1) maxPass = 8;
    var wishRandomDailyLimitHit = false;
    var wishCollectBusyBlocked = false;
    var wishCollectBusyVersion = 0;

    function wishActionCount() {
      return (
        Number(FARM_EVENT_STATS.wishCollect || 0) +
        Number(FARM_EVENT_STATS.wishRandom || 0) +
        Number(FARM_EVENT_STATS.wishStarClaim || 0) +
        Number(FARM_EVENT_STATS.wishHarvest || 0) +
        Number(FARM_EVENT_STATS.wishPlant || 0) +
        Number(FARM_EVENT_STATS.wishUpgrade || 0) +
        Number(FARM_EVENT_STATS.wishHelp || 0) +
        Number(wishCollectBusyVersion || 0)
      );
    }

    function wishStateSig(state) {
      if (!state) return "";
      return [
        Number(state.status || 0),
        Number(state.self || 0),
        Number(state.wNum || 0),
        Number(state.wId || 0),
        Number(state.vstar || 0),
        Number(state.tool || 0),
        ensureArray(state.starlist).length,
        Number(state.selfWaitSec || 0),
        Number(state.starWaitSec || 0)
      ].join("|");
    }

    function wishTransientRetries() {
      var transientRetries = Number(CONFIG.FARM_EVENT_RETRY_TRANSIENT);
      if (isNaN(transientRetries) || transientRetries < 0) transientRetries = Number(CONFIG.RETRY_TRANSIENT || 0);
      if (isNaN(transientRetries) || transientRetries < 1) transientRetries = 1;
      return transientRetries;
    }

    function fetchIndex(tag) {
      return callFarmEventApi(
        cookie,
        "/cgi-bin/cgi_farm_wish_index",
        farmEventParams(ctx, {
          ownerId: ctx.uIdx,
          queryData: 1
        })
      ).then(function (json) {
        var state = parseWishState(json);
        if (!state) {
          var msg = farmEventErrMsg(json);
          if (!isFarmEventNoop(json, msg)) {
            FARM_EVENT_STATS.errors += 1;
            log("⚠️ 许愿状态读取失败(" + tag + "): " + msg);
          } else if (CONFIG.DEBUG) {
            logDebug("🌠 许愿状态(" + tag + "): 无需执行(" + msg + ")");
          }
          return null;
        }
        if (Number(state.tool || 0) <= 0 && wishCollectBusyBlocked) {
          wishCollectBusyBlocked = false;
          if (CONFIG.DEBUG) logDebug("🌠 许愿收星: 摘星不可用，解除繁忙屏蔽");
        }
        if (tag === "开始") {
          FARM_EVENT_STATS.wishOpen = state.open;
          FARM_EVENT_STATS.wishStatus = state.status;
          FARM_EVENT_STATS.wishSelfStart = state.self;
          FARM_EVENT_STATS.wishSelfEnd = state.self;
          FARM_EVENT_STATS.wishProgressStart = state.wNum;
          FARM_EVENT_STATS.wishProgressEnd = state.wNum;
          FARM_EVENT_STATS.wishProgressMax = state.maxWish;
          FARM_EVENT_STATS.wishStarStart = state.starlist.length;
          FARM_EVENT_STATS.wishStarEnd = state.starlist.length;
          log(
            "🌠 许愿状态: 状态" +
              state.status +
              " 进度" +
              state.wNum +
              (state.maxWish > 0 ? "/" + state.maxWish : "") +
              " 自助" +
              state.self +
              " 星值" +
              state.vstar +
              " 单次耗星" +
              state.costStar +
              " 摘星" +
              (state.tool > 0 ? "可点" : "无") +
              " 待领奖" +
              state.starlist.length +
              " " +
              formatWishCooldown(state)
          );
        } else {
          FARM_EVENT_STATS.wishStatus = state.status;
          FARM_EVENT_STATS.wishSelfEnd = state.self;
          FARM_EVENT_STATS.wishProgressEnd = state.wNum;
          if (state.maxWish > 0) FARM_EVENT_STATS.wishProgressMax = state.maxWish;
          FARM_EVENT_STATS.wishStarEnd = state.starlist.length;
          if (CONFIG.DEBUG) {
            logDebug(
              "🌠 许愿状态(" +
                tag +
                "): 状态" +
                state.status +
                " 进度" +
                state.wNum +
                (state.maxWish > 0 ? "/" + state.maxWish : "") +
                " 自助" +
                state.self +
                " 星值" +
                state.vstar +
                " 单次耗星" +
                state.costStar +
                " 摘星" +
                (state.tool > 0 ? "可点" : "无") +
                " 待领奖" +
                state.starlist.length +
                " " +
                formatWishCooldown(state)
            );
          }
        }
        return state;
      });
    }

    function appendWishReward(json, prefix) {
      var reward = formatWishReward(json);
      if (!reward) return false;
      FARM_EVENT_STATS.wishReward = mergeRewardText(FARM_EVENT_STATS.wishReward, reward);
      log(prefix + reward);
      return true;
    }

    function wishActionOk(json) {
      if (!isFarmEventOk(json)) return false;
      var msg = normalizeSpace(farmEventErrMsg(json));
      if (!msg) return true;
      if (msg === "ecode=0") return true;
      if (/成功|完成|ok|已领取|已收取/i.test(msg) && !/不足|失败|不能|未开启|未满足|冷却|无可/.test(msg)) return true;
      return false;
    }

    function collectWishStars(state) {
      if (!state || !CONFIG.FARM_EVENT_WISH_AUTO_COLLECT) return Promise.resolve(state);
      if (Number(state.tool || 0) <= 0) return Promise.resolve(state);
      var transientRetries = wishTransientRetries();
      function run(attempt) {
        return callFarmEventApi(
          cookie,
          "/cgi-bin/cgi_farm_wish_star",
          farmEventParams(ctx, {
            type: 1
          })
        ).then(function (json) {
          if (!wishActionOk(json)) {
            var msg = farmEventErrMsg(json);
            if (isFarmEventNoop(json, msg)) {
              if (CONFIG.DEBUG) logDebug("🌠 许愿收星: 无需执行(" + msg + ")");
              return state;
            }
            var transient = isTransientFailText(msg || "");
            if (transient && attempt < transientRetries) {
              log("⚠️ 许愿收星繁忙，第" + (attempt + 1) + "次重试");
              return sleep(CONFIG.RETRY_WAIT_MS || 800).then(function () {
                return run(attempt + 1);
              });
            }
            if (transient) {
              FARM_EVENT_STATS.busy += 1;
              wishCollectBusyBlocked = true;
              wishCollectBusyVersion += 1;
              log("⚠️ 许愿收星繁忙: 已重试" + transientRetries + "次，留待下轮");
              return fetchIndex("收星繁忙后").then(function (nextState) {
                return nextState || state;
              });
            }
            FARM_EVENT_STATS.errors += 1;
            log("⚠️ 许愿收星失败: " + msg);
            return state;
          }
          wishCollectBusyBlocked = false;
          FARM_EVENT_STATS.wishCollect += 1;
          if (!appendWishReward(json, "🌠 许愿收星: ")) {
            log("🌠 许愿收星: 成功");
          }
          return fetchIndex("收星后");
        });
      }
      return run(0).then(function (nextState) {
        return nextState || state;
      });
    }

    function randomWish(state) {
      if (!state || !CONFIG.FARM_EVENT_WISH_AUTO_RANDOM) return Promise.resolve(state);
      if (wishRandomDailyLimitHit) {
        if (CONFIG.DEBUG) logDebug("🌠 许愿抽星: 今日次数已用完，跳过");
        return Promise.resolve(state);
      }
      var status = Number(state.status || 0) || 0;
      if (status !== 3 && status !== 4) return Promise.resolve(state);
      if (Number(state.starWaitSec || 0) > 0) {
        if (CONFIG.DEBUG) logDebug("🌠 许愿抽星: 冷却中(" + formatWaitSec(state.starWaitSec) + ")，跳过");
        return Promise.resolve(state);
      }
      var cost = Number(state.costStar || 0) || 0;
      var star = Number(state.vstar || 0) || 0;
      if (cost <= 0 || star < cost) return Promise.resolve(state);
      var maxTry = Math.floor(star / cost);
      var cap = Number(CONFIG.FARM_EVENT_WISH_RANDOM_MAX || 0);
      if (!isNaN(cap) && cap > 0 && maxTry > cap) maxTry = cap;
      if (maxTry <= 0) return Promise.resolve(state);
      var done = 0;
      var transientRetries = wishTransientRetries();

      function one(loopNo, retryNo) {
        return callFarmEventApi(cookie, "/cgi-bin/cgi_farm_wish_star?act=random", farmEventParams(ctx)).then(
          function (json) {
            if (!wishActionOk(json)) {
              var msg = farmEventErrMsg(json);
              if (/今天.*许愿次数|今日.*许愿次数|许愿次数.*已用完|次数.*已用完/.test(msg || "")) {
                wishRandomDailyLimitHit = true;
                if (CONFIG.DEBUG) logDebug("🌠 许愿抽星: 今日次数已用完，停止本轮");
                return false;
              }
              if (isFarmEventNoop(json, msg) || /星不足|冷却|不能|未开启|次数不足|不足/.test(msg || "")) {
                if (CONFIG.DEBUG) logDebug("🌠 许愿抽星: 无需执行(" + msg + ")");
                return false;
              }
              var transient = isTransientFailText(msg || "");
              if (transient && retryNo < transientRetries) {
                log("⚠️ 许愿抽星繁忙，第" + (retryNo + 1) + "次重试");
                return sleep(CONFIG.RETRY_WAIT_MS || 800).then(function () {
                  return one(loopNo, retryNo + 1);
                });
              }
              if (transient) {
                FARM_EVENT_STATS.busy += 1;
                log("⚠️ 许愿抽星繁忙: 已重试" + transientRetries + "次，留待下轮");
                return false;
              }
              FARM_EVENT_STATS.errors += 1;
              log("⚠️ 许愿抽星失败: " + msg);
              return false;
            }
            done += 1;
            FARM_EVENT_STATS.wishRandom += 1;
            if (!appendWishReward(json, "🌠 许愿抽星: ")) {
              log("🌠 许愿抽星: 成功(" + done + "/" + maxTry + ")");
            }
            if (loopNo + 1 >= maxTry) return true;
            return sleep(CONFIG.WAIT_MS).then(function () {
              return one(loopNo + 1, 0);
            });
          }
        );
      }

      return one(0, 0).then(function () {
        if (done <= 0) return state;
        return fetchIndex("抽星后");
      });
    }

    function claimStars(state) {
      if (!state || !CONFIG.FARM_EVENT_WISH_AUTO_STAR) return Promise.resolve(state);
      var ids = ensureArray(state.starlist);
      if (!ids.length) return Promise.resolve(state);
      var transientRetries = wishTransientRetries();
      var idx = 0;
      var gained = 0;
      function claimOne(sid, attempt) {
        return callFarmEventApi(
          cookie,
          "/cgi-bin/cgi_farm_wish_star",
          farmEventParams(ctx, {
            id: sid,
            type: 0
          })
        ).then(function (json) {
          if (!wishActionOk(json)) {
            var msg = farmEventErrMsg(json);
            if (isFarmEventNoop(json, msg)) {
              if (CONFIG.DEBUG) logDebug("🌠 许愿领奖(id=" + sid + "): 无需执行(" + msg + ")");
              return;
            }
            var transient = isTransientFailText(msg || "");
            if (transient && attempt < transientRetries) {
              log("⚠️ 许愿领奖繁忙(id=" + sid + ")，第" + (attempt + 1) + "次重试");
              return sleep(CONFIG.RETRY_WAIT_MS || 800).then(function () {
                return claimOne(sid, attempt + 1);
              });
            }
            if (transient) {
              FARM_EVENT_STATS.busy += 1;
              log("⚠️ 许愿领奖繁忙(id=" + sid + "): 已重试" + transientRetries + "次，留待下轮");
              return;
            }
            FARM_EVENT_STATS.errors += 1;
            log("⚠️ 许愿领奖失败(id=" + sid + "): " + msg);
            return;
          }
          FARM_EVENT_STATS.wishStarClaim += 1;
          gained += 1;
          if (!appendWishReward(json, "🌠 许愿领奖: ")) {
            log("🌠 许愿领奖: 成功");
          }
        });
      }
      function next() {
        if (idx >= ids.length) return Promise.resolve();
        var sid = Number(ids[idx++] || 0) || 0;
        if (!sid) return next();
        return claimOne(sid, 0)
          .then(function () {
            return sleep(CONFIG.WAIT_MS);
          })
          .then(next);
      }
      return next().then(function () {
        if (gained <= 0) return state;
        return fetchIndex("领奖后");
      });
    }

    function harvestWish(state) {
      if (!state || !CONFIG.FARM_EVENT_WISH_AUTO_HARVEST) return Promise.resolve(state);
      if (Number(state.status || 0) !== 4) return Promise.resolve(state);
      return callFarmEventApi(cookie, "/cgi-bin/cgi_farm_wish_harvest", farmEventParams(ctx)).then(function (json) {
        if (!wishActionOk(json)) {
          var msg = farmEventErrMsg(json);
          if (!isFarmEventNoop(json, msg)) {
            FARM_EVENT_STATS.errors += 1;
            log("⚠️ 许愿收获失败: " + msg);
          } else if (CONFIG.DEBUG) {
            logDebug("🌠 许愿收获: 无需执行(" + msg + ")");
          }
          return state;
        }
        FARM_EVENT_STATS.wishHarvest += 1;
        if (!appendWishReward(json, "🌠 许愿收获: ")) {
          log("🌠 许愿收获: 成功");
        }
        return fetchIndex("收获后");
      });
    }

    function plantWish(state) {
      if (!state || !CONFIG.FARM_EVENT_WISH_AUTO_PLANT) return Promise.resolve(state);
      if (Number(state.status || 0) !== 0) return Promise.resolve(state);
      var opt = pickWishOption(state);
      if (!opt || !opt.id) {
        if (CONFIG.DEBUG) logDebug("🌠 许愿种下: 状态0但暂无可选愿望，跳过");
        return Promise.resolve(state);
      }
      var wid = Number(opt.id || 0) || 0;
      if (!wid) return Promise.resolve(state);
      return callFarmEventApi(
        cookie,
        "/cgi-bin/cgi_farm_wish_plant",
        farmEventParams(ctx, {
          idlist: String(wid),
          id: wid
        })
      ).then(function (json) {
        if (!wishActionOk(json)) {
          var msg = farmEventErrMsg(json);
          if (!isFarmEventNoop(json, msg)) {
            FARM_EVENT_STATS.errors += 1;
            log("⚠️ 许愿种下失败(id=" + wid + "): " + msg);
          } else if (CONFIG.DEBUG) {
            logDebug("🌠 许愿种下: 无需执行(" + msg + ")");
          }
          return state;
        }
        FARM_EVENT_STATS.wishPlant += 1;
        log("🌠 许愿种下: " + (opt.title || ("愿望#" + wid)));
        return fetchIndex("许愿后");
      });
    }

    function upgradeWish(state) {
      if (!state || !CONFIG.FARM_EVENT_WISH_AUTO_UPGRADE) return Promise.resolve(state);
      var status = Number(state.status || 0) || 0;
      if (status !== 0 && status !== 3 && status !== 4) return Promise.resolve(state);
      var star = Number(state.vstar || 0) || 0;
      if (star <= 0) return Promise.resolve(state);
      var use = star;
      var maxLoop = Number(CONFIG.FARM_EVENT_WISH_UPGRADE_MAX || 20);
      if (!isNaN(maxLoop) && maxLoop > 0 && use > maxLoop) use = maxLoop;
      if (use <= 0) return Promise.resolve(state);
      var transientRetries = wishTransientRetries();
      function run(attempt) {
        return callFarmEventApi(
          cookie,
          "/cgi-bin/cgi_farm_wish_star?act=upgrade",
          farmEventParams(ctx, {
            num: use
          })
        ).then(function (json) {
          if (!wishActionOk(json)) {
            var msg = farmEventErrMsg(json);
            if (isFarmEventNoop(json, msg) || /不足|不能|未满足|未开启|冷却/.test(msg || "")) {
              if (CONFIG.DEBUG) logDebug("🌠 许愿点星: 无需执行(" + msg + ")");
              return state;
            }
            var transient = isTransientFailText(msg || "");
            if (transient && attempt < transientRetries) {
              log("⚠️ 许愿点星繁忙，第" + (attempt + 1) + "次重试");
              return sleep(CONFIG.RETRY_WAIT_MS || 800).then(function () {
                return run(attempt + 1);
              });
            }
            if (transient) {
              FARM_EVENT_STATS.busy += 1;
              log("⚠️ 许愿点星繁忙: 已重试" + transientRetries + "次，留待下轮");
              return state;
            }
            FARM_EVENT_STATS.errors += 1;
            log("⚠️ 许愿点星失败: " + msg);
            return state;
          }
          FARM_EVENT_STATS.wishUpgrade += 1;
          if (!appendWishReward(json, "🌠 许愿点星: ")) {
            log("🌠 许愿点星: 成功(消耗" + use + ")");
          }
          return fetchIndex("点星后");
        });
      }

      return run(0).then(function (nextState) {
        return nextState || state;
      });
    }

    function wishHelp(state) {
      if (!state || !CONFIG.FARM_EVENT_WISH_AUTO_HELP) return Promise.resolve(state);
      var status = Number(state.status || 0) || 0;
      if (status !== 2 && status !== 3) {
        if (CONFIG.DEBUG) logDebug("🌠 许愿助力: 当前状态" + status + "，跳过");
        return Promise.resolve(state);
      }
      if (Number(state.selfWaitSec || 0) > 0) {
        if (CONFIG.DEBUG) logDebug("🌠 许愿助力: 冷却中(" + formatWaitSec(state.selfWaitSec) + ")，跳过");
        return Promise.resolve(state);
      }
      return callFarmEventApi(
        cookie,
        "/cgi-bin/cgi_farm_wish_help",
        farmEventParams(ctx, {
          ownerId: ctx.uIdx
        })
      ).then(function (json) {
        if (!wishActionOk(json)) {
          var msg = farmEventErrMsg(json);
          if (!isFarmEventNoop(json, msg)) {
            FARM_EVENT_STATS.errors += 1;
            log("⚠️ 许愿助力失败: " + msg);
          } else if (CONFIG.DEBUG) {
            logDebug("🌠 许愿助力: 无需执行(" + msg + ")");
          }
          return state;
        }
        FARM_EVENT_STATS.wishHelp += 1;
        FARM_EXTRA.signin += 1;
        log("🌠 许愿助力: 成功");
        return fetchIndex("助力后");
      });
    }

    function decideWishAction(state) {
      if (!state) return "";
      var status = Number(state.status || 0) || 0;
      if (CONFIG.FARM_EVENT_WISH_AUTO_COLLECT && Number(state.tool || 0) > 0 && !wishCollectBusyBlocked) return "collect";
      if (CONFIG.FARM_EVENT_WISH_AUTO_RANDOM) {
        var cost = Number(state.costStar || 0) || 0;
        var star = Number(state.vstar || 0) || 0;
        if (
          !wishRandomDailyLimitHit &&
          (status === 3 || status === 4) &&
          cost > 0 &&
          star >= cost &&
          Number(state.starWaitSec || 0) <= 0
        )
          return "random";
      }
      if (CONFIG.FARM_EVENT_WISH_AUTO_HELP && (status === 2 || status === 3) && Number(state.selfWaitSec || 0) <= 0)
        return "help";
      if (CONFIG.FARM_EVENT_WISH_AUTO_UPGRADE && Number(state.vstar || 0) > 0 && (status === 0 || status === 3 || status === 4))
        return "upgrade";
      if (CONFIG.FARM_EVENT_WISH_AUTO_HARVEST && status === 4) return "harvest";
      if (CONFIG.FARM_EVENT_WISH_AUTO_PLANT && status === 0) {
        var opt = pickWishOption(state);
        if (opt && Number(opt.id || 0) > 0) return "plant";
      }
      if (CONFIG.FARM_EVENT_WISH_AUTO_STAR && ensureArray(state.starlist).length > 0) return "claimStars";
      return "";
    }

    function executeWishAction(state, action) {
      if (!action) return Promise.resolve(state);
      if (action === "harvest") return harvestWish(state);
      if (action === "collect") return collectWishStars(state);
      if (action === "random") return randomWish(state);
      if (action === "claimStars") return claimStars(state);
      if (action === "plant") return plantWish(state);
      if (action === "upgrade") return upgradeWish(state);
      if (action === "help") return wishHelp(state);
      return Promise.resolve(state);
    }

    function pass(state, loopNo) {
      if (!state) return Promise.resolve(state);
      if (loopNo > maxPass) return Promise.resolve(state);
      if (Number(state.tool || 0) <= 0) wishCollectBusyBlocked = false;
      var action = decideWishAction(state);
      if (!action) return Promise.resolve(state);
      if (CONFIG.DEBUG) logDebug("🌠 许愿决策(第" + loopNo + "轮): " + action);
      var beforeSig = wishStateSig(state);
      var beforeCount = wishActionCount();
      return executeWishAction(state, action).then(function (nextState) {
        var now = nextState || state;
        var afterSig = wishStateSig(now);
        var afterCount = wishActionCount();
        if (loopNo < maxPass && (afterSig !== beforeSig || afterCount > beforeCount)) {
          return pass(now, loopNo + 1);
        }
        return now;
      });
    }

    return fetchIndex("开始")
      .then(function (startState) {
        if (!startState || startState.open !== 1) return null;
        return pass(startState, 1);
      })
      .then(function () {
        return fetchIndex("结束");
      });
  }

  function runDay7Probe() {
    if (!CONFIG.FARM_EVENT_DAY7_PROBE) return Promise.resolve();
    return callFarmEventApi(
      cookie,
      "/cgi-bin/cgi_common_activity?",
      farmEventParams(ctx, {
        act: "day7Login_index"
      })
    ).then(function (json) {
      if (!isFarmEventOk(json)) {
        var msg = farmEventErrMsg(json);
        if (!isFarmEventNoop(json, msg)) {
          FARM_EVENT_STATS.errors += 1;
          log("⚠️ 七日活动状态读取失败: " + msg);
        } else if (CONFIG.DEBUG) {
          logDebug("📆 七日活动状态: 无需执行(" + msg + ")");
        }
        return;
      }
      FARM_EVENT_STATS.day7Days = Number(json.days || 0) || 0;
      FARM_EVENT_STATS.day7Flag = Number(json.flag || 0) || 0;
      if (CONFIG.DEBUG) {
        logDebug("📆 七日活动状态: 天数" + FARM_EVENT_STATS.day7Days + " 标记" + FARM_EVENT_STATS.day7Flag);
      }
    });
  }

  return ensureFarmEventContext(cookie)
    .then(function (c) {
      ctx = c;
      if (!ctx) {
        FARM_EVENT_STATS.errors += 1;
        log("⚠️ 节气活动: 缺少 uIdx/uinY，跳过");
        return;
      }
      return runSeedHb()
        .then(function () {
          return runBuling();
        })
        .then(function () {
          return runWish();
        })
        .then(function () {
          return runDay7Probe();
        });
    })
    .catch(function (e) {
      FARM_EVENT_STATS.errors += 1;
      log("⚠️ 节气活动异常: " + e);
    });
}

function farmOneKeyDig(cookie, deadPlaces) {
  if (!CONFIG.FARM_TRY_ONEKEY_DIG) return Promise.resolve(false);
  if (!deadPlaces || deadPlaces.length === 0) return Promise.resolve(false);
  recordActionTry("scarify", deadPlaces.length);
  recordWitheredTry(deadPlaces.length);
  var base = CONFIG.FARM_WAP_BASE;
  var sid = CONFIG.RANCH_SID;
  var g_ut = getFarmGut();
  var url =
    base +
    "/nc/cgi-bin/wap_farm_dig?sid=" +
    sid +
    "&g_ut=" +
    g_ut +
    "&place=" +
    deadPlaces.join(",") +
    "&cropStatus=7";
  return ranchGet(url, cookie)
    .then(function (html) {
      var msg = extractMessage(html);
      if (msg) log("🪓 一键铲除: " + msg);
      if (isNoActionMsg(msg, "scarify")) recordActionNoop("scarify", deadPlaces.length);
      var ok = msg && msg.indexOf("成功") >= 0;
      if (ok) recordWitheredClear(deadPlaces.length);
      return ok;
    })
    .catch(function (e) {
      log("🪓 一键铲除失败: " + e);
      return false;
    });
}

function farmOneKeySow(cookie, seedCid) {
  if (!CONFIG.FARM_TRY_ONEKEY_SOW) return Promise.resolve(false);
  var base = CONFIG.FARM_WAP_BASE;
  var sid = CONFIG.RANCH_SID;
  var g_ut = getFarmGut();
  var listUrl = base + "/nc/cgi-bin/wap_farm_seed_plant_list?sid=" + sid + "&g_ut=" + g_ut;
  var maxRepeat = CONFIG.MAX_REPEAT || 0;
  var didAny = false;
  var preferNonGrass =
    LAST_GRASS_COUNT !== null && LAST_GRASS_COUNT >= CONFIG.GRASS_THRESHOLD;

  function cleanLink(link) {
    return link.replace(/^\.?\//, "");
  }

  function extractParam(link, key) {
    var re = new RegExp("[?&]" + key + "=([^&]+)");
    var m = re.exec(link || "");
    return m ? m[1] : "";
  }

  function normalizePlantLink(link) {
    if (!link) return "";
    var out = link.replace(/^\.?\//, "");
    if (out.indexOf("?") < 0) out += "?";
    if (!/sid=/.test(out)) out += (out.slice(-1) === "?" ? "" : "&") + "sid=" + sid;
    if (!/g_ut=/.test(out)) out += "&g_ut=" + g_ut;
    return out;
  }

  function isUselessPlantLink(link) {
    if (!link) return true;
    if (link === "wap_farm_plant?" || link === "wap_farm_plant") return true;
    return !/cid=/.test(link) && !/landid=/.test(link);
  }

  function extractEmptyLandSeeds(html) {
    if (!html) return [];
    var h = html.replace(/&amp;/g, "&");
    var re = /wap_farm_seed_plant_list\?[^"'\s>]+/g;
    var list = [];
    var m;
    var seen = {};
    while ((m = re.exec(h))) {
      var link = m[0];
      var landid = extractParam(link, "landid");
      if (!landid) continue;
      if (seen[landid]) continue;
      seen[landid] = true;
      list.push({
        landid: landid,
        land_bitmap: extractParam(link, "land_bitmap") || ""
      });
    }
    return list;
  }

  function buildPlantLink(seed, land) {
    var link =
      "wap_farm_plant?sid=" +
      sid +
      "&g_ut=" +
      g_ut +
      "&v=0&cid=" +
      seed;
    if (land && land.landid) link += "&landid=" + land.landid;
    if (land && land.land_bitmap) link += "&land_bitmap=" + land.land_bitmap;
    return link;
  }

  function parseCid(link) {
    var m = /cid=([0-9]+)/.exec(link);
    return m ? m[1] : "";
  }

  function reorderCandidates(links) {
    var ordered = [];
    var seen = {};
    if (seedCid) {
      for (var i = 0; i < links.length; i++) {
        if (links[i].indexOf("cid=" + seedCid) >= 0 && !seen[links[i]]) {
          seen[links[i]] = true;
          ordered.push(links[i]);
        }
      }
    }
    for (var j = 0; j < links.length; j++) {
      if (!seen[links[j]]) {
        seen[links[j]] = true;
        ordered.push(links[j]);
      }
    }
    if (preferNonGrass) {
      var grass = String(CONFIG.FARM_GRASS_SEED_ID);
      var filtered = [];
      for (var k = 0; k < ordered.length; k++) {
        if (parseCid(ordered[k]) !== grass) filtered.push(ordered[k]);
      }
      if (filtered.length > 0) ordered = filtered;
      var seasonal = [];
      var other = [];
      for (var s = 0; s < ordered.length; s++) {
        var cid = parseCid(ordered[s]);
        if (cid && isSeasonalSeedCid(cid)) seasonal.push(ordered[s]);
        else other.push(ordered[s]);
      }
      if (seasonal.length > 0) ordered = seasonal.concat(other);
    }
    return ordered;
  }

  function requestPlant(link) {
    var url = link.indexOf("http") === 0 ? link : base + "/nc/cgi-bin/" + cleanLink(link);
    recordActionTry("plant", 1);
    return ranchGet(url, cookie)
      .then(function (html2) {
        var text = stripTags(html2);
        var msg = extractWapHint(html2) || extractMessage(html2);
        if (msg) log("🌱 一键播种: " + msg);
        else if (text.indexOf("没有空") >= 0 || text.indexOf("空地") >= 0) {
          var hint = extractWapHint(html2) || text.substring(0, 30);
          log("🌱 一键播种: " + hint);
        }
        var noLand =
          text.indexOf("没有空地") >= 0 ||
          text.indexOf("没有空闲") >= 0 ||
          text.indexOf("没有可播种") >= 0 ||
          text.indexOf("地块已满") >= 0;
        var seedLack =
          text.indexOf("种子") >= 0 &&
          (text.indexOf("不足") >= 0 ||
            text.indexOf("不够") >= 0 ||
            text.indexOf("缺少") >= 0);
        if (text.indexOf("没有符合种植条件") >= 0) seedLack = true;
        var landLimit =
          text.indexOf("红土地") >= 0 ||
          text.indexOf("黑土地") >= 0 ||
          text.indexOf("金土地") >= 0 ||
          text.indexOf("土地等级") >= 0 ||
          text.indexOf("土地类型") >= 0 ||
          text.indexOf("土地不符") >= 0 ||
          text.indexOf("只能种在") >= 0;
        var success = text.indexOf("成功") >= 0 || text.indexOf("已播种") >= 0;
        var count = parsePlantCountFromMsg(msg || text);
        if (success && count <= 0) count = 1;
        if (noLand) recordPlantFail("noLand", 1);
        if (seedLack) recordPlantFail("seedLack", 1);
        if (landLimit) recordPlantFail("landLimit", 1);
        if (!success && noLand) recordActionNoop("plant", 1);
        return { success: success, count: count, noLand: noLand, seedLack: seedLack, landLimit: landLimit };
      })
      .catch(function (e) {
        log("🌱 一键播种失败: " + e);
        return { success: false, noLand: false, seedLack: false, landLimit: false };
      });
  }

  function tryCandidates(candidates, idx) {
    if (idx >= candidates.length) return Promise.resolve({ did: false, cont: false, count: 0 });
    var link = candidates[idx];
    return requestPlant(link).then(function (res) {
      if (res.noLand) return { did: res.success, cont: false, count: res.success ? res.count || 1 : 0 };
      if (res.seedLack || res.landLimit) return tryCandidates(candidates, idx + 1);
      if (res.success) return { did: true, cont: true, count: res.count || 1 };
      return { did: res.success, cont: false, count: 0 };
    });
  }

  function tryPlantOnEmptyLand() {
    if (!seedCid || !LAST_FARM_HOME_HTML) return Promise.resolve({ did: false, cont: false, count: 0 });
    var lands = extractEmptyLandSeeds(LAST_FARM_HOME_HTML);
    if (!lands.length) return Promise.resolve({ did: false, cont: false, count: 0 });
    var idx = 0;
    var planted = 0;
    function next() {
      if (idx >= lands.length) return Promise.resolve({ did: planted > 0, cont: false, count: planted });
      var link = buildPlantLink(seedCid, lands[idx++]);
      return requestPlant(link).then(function (res) {
        if (res.success) planted += 1;
        return next();
      });
    }
    return next();
  }

  function doOnce() {
    var directFirst = seedCid ? tryPlantOnEmptyLand() : Promise.resolve({ did: false, cont: false, count: 0 });
    return directFirst.then(function (directRes) {
      if (directRes && directRes.did) return directRes;
      return ranchGet(listUrl, cookie)
        .then(function (html) {
          var h = (html || "").replace(/&amp;/g, "&");
          var links = [];
          var re = /wap_farm_plant\?[^\"\s>]+/g;
          var m;
          while ((m = re.exec(h))) links.push(m[0]);
          var normalized = links
            .map(normalizePlantLink)
            .filter(function (it) {
              return !isUselessPlantLink(it);
            });
          var candidates = reorderCandidates(normalized);
          if (candidates.length === 0 && seedCid) {
            candidates.push(buildPlantLink(seedCid, { landid: "-1", land_bitmap: "" }));
          }
          if (candidates.length === 0) {
            var indexUrl = base + "/nc/cgi-bin/wap_farm_index?sid=" + sid + "&g_ut=" + g_ut;
            return ranchGet(indexUrl, cookie).then(function (html2) {
              var h2 = html2.replace(/&amp;/g, "&");
              var re2 = /<a[^>]+href="([^"]+)"[^>]*>[^<]*(播种|一键)[^<]*<\/a>/i;
              var m2 = re2.exec(h2);
              if (m2) candidates.push(normalizePlantLink(m2[1]));
              candidates = reorderCandidates(candidates.filter(function (it) {
                return !isUselessPlantLink(it);
              }));
              if (candidates.length === 0) {
                log("🌱 一键播种: 未发现入口");
                return { did: false, cont: false, count: 0 };
              }
              return tryCandidates(candidates, 0);
            });
          }
          return tryCandidates(candidates, 0);
        })
        .catch(function (e) {
          log("🌱 一键播种失败: " + e);
          return { did: false, cont: false, count: 0 };
        });
    });
  }

  function loop(round) {
    if (maxRepeat > 0 && round >= maxRepeat) return Promise.resolve(didAny);
    return doOnce().then(function (res) {
      var inc = res && res.count ? res.count : res && res.did ? 1 : 0;
      if (inc > 0) {
        didAny = true;
        recordPlant(seedCid, inc);
      }
      if (res.cont) return loop(round + 1);
      return didAny;
    });
  }

  return loop(0);
}

function extractFarmWapLinks(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var links = {
    harvest: [],
    clearWeed: [],
    spraying: [],
    water: [],
    dig: []
  };
  var re = /wap_farm_(harvest|opt|dig)\?[^\"\s>]+/g;
  var m;
  while ((m = re.exec(h))) {
    var link = m[0];
    if (link.indexOf("wap_farm_harvest") >= 0) links.harvest.push(link);
    else if (link.indexOf("wap_farm_dig") >= 0) links.dig.push(link);
    else if (link.indexOf("wap_farm_opt") >= 0) {
      if (link.indexOf("act=clearWeed") >= 0) links.clearWeed.push(link);
      else if (link.indexOf("act=spraying") >= 0) links.spraying.push(link);
      else if (link.indexOf("act=water") >= 0) links.water.push(link);
    }
  }
  links.harvest = uniqLinks(links.harvest);
  links.harvest = links.harvest.filter(function (link) {
    return /place=/.test(link) || /landid=/.test(link);
  });
  links.clearWeed = uniqLinks(links.clearWeed);
  links.spraying = uniqLinks(links.spraying);
  links.water = uniqLinks(links.water);
  links.dig = uniqLinks(links.dig);
  return links;
}

function extractFarmOptParams(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var m = h.match(/wap_farm_index\?[^"\s>]*B_UID=([0-9]+)[^"\s>]*money=([0-9]+)[^"\s>]*time=([-0-9]+)/);
  var B_UID = m ? m[1] : "";
  var money = m ? m[2] : "";
  var time = m ? m[3] : "";
  var places = {};
  var re = /wap_farm_harvest\?[^"\s>]+/g;
  var mm;
  while ((mm = re.exec(h))) {
    var link = mm[0];
    var pm = link.match(/place=([0-9,]+)/);
    if (pm) {
      var parts = pm[1].split(",");
      for (var i = 0; i < parts.length; i++) {
        if (parts[i]) places[parts[i]] = true;
      }
    }
  }
  var list = [];
  for (var k in places) {
    if (places.hasOwnProperty(k)) list.push(k);
  }
  list.sort(function (a, b) {
    return Number(a) - Number(b);
  });
  return { B_UID: B_UID, money: money, time: time, places: list };
}

function buildFarmOptFallback(html) {
  var params = extractFarmOptParams(html);
  if (!params) return {};
  var B_UID = params.B_UID;
  if ((!B_UID || B_UID === "0") && LAST_RANCH && LAST_RANCH.B_UID) {
    B_UID = LAST_RANCH.B_UID;
  }
  if (!B_UID) return {};
  var money = params.money || "0";
  var time = params.time || "-2147483648";
  var places = (params.places || []).slice(0);
  if (!places.length) {
    var cnt = getFarmLandCount();
    if (cnt <= 0) cnt = 24;
    for (var i = 0; i < cnt; i++) places.push(String(i));
  }
  if (!places.length) return {};
  var placeStr = places.join(",");
  var sid = CONFIG.RANCH_SID;
  var g_ut = getFarmGut();
  return {
    clearWeed: [
      "wap_farm_opt?sid=" +
        sid +
        "&B_UID=" +
        B_UID +
        "&act=clearWeed&place=" +
        placeStr +
        "&g_ut=" +
        g_ut +
        "&money=" +
        money +
        "&name=&time=" +
        time
    ],
    spraying: [
      "wap_farm_opt?sid=" +
        sid +
        "&B_UID=" +
        B_UID +
        "&act=spraying&place=" +
        placeStr +
        "&g_ut=" +
        g_ut +
        "&money=" +
        money +
        "&name=&time=" +
        time
    ],
    water: [
      "wap_farm_opt?sid=" +
        sid +
        "&B_UID=" +
        B_UID +
        "&act=water&place=" +
        placeStr +
        "&g_ut=" +
        g_ut +
        "&money=" +
        money +
        "&name=&time=" +
        time
    ]
  };
}

function getFarmLandCount() {
  if (STATUS_START.farm && STATUS_START.farm.length) return STATUS_START.farm.length;
  if (STATUS_END.farm && STATUS_END.farm.length) return STATUS_END.farm.length;
  return 0;
}

function buildFarmHarvestFallback(html) {
  var params = extractFarmOptParams(html);
  if (!params) return {};
  var B_UID = params.B_UID;
  if ((!B_UID || B_UID === "0") && LAST_RANCH && LAST_RANCH.B_UID) {
    B_UID = LAST_RANCH.B_UID;
  }
  if (!B_UID) return {};
  var places = (params.places || []).slice(0);
  if (places.length === 0) {
    var cnt = getFarmLandCount();
    if (cnt <= 0) cnt = 24;
    for (var i = 0; i < cnt; i++) places.push(String(i));
  }
  if (!places.length) return {};
  var sid = CONFIG.RANCH_SID;
  var g_ut = getFarmGut();
  var time = params.time || "-2147483648";
  return {
    harvest: [
      "wap_farm_harvest?sid=" +
        sid +
        "&B_UID=" +
        B_UID +
        "&place=" +
        places.join(",") +
        "&g_ut=" +
        g_ut +
        "&time=" +
        time
    ]
  };
}

function mergeFarmLinks(a, b) {
  if (!a && !b) return { harvest: [], clearWeed: [], spraying: [], water: [], dig: [] };
  if (!a) return b;
  if (!b) return a;
  return {
    harvest: uniqLinks((a.harvest || []).concat(b.harvest || [])),
    clearWeed: uniqLinks((a.clearWeed || []).concat(b.clearWeed || [])),
    spraying: uniqLinks((a.spraying || []).concat(b.spraying || [])),
    water: uniqLinks((a.water || []).concat(b.water || [])),
    dig: uniqLinks((a.dig || []).concat(b.dig || []))
  };
}

function runFarmWap(cookie, opts) {
  log("🧩 模式: WAP @ " + CONFIG.FARM_WAP_BASE);
  opts = opts || {};
  var base = CONFIG.FARM_WAP_BASE;
  var sid = CONFIG.RANCH_SID;
  var g_ut = getFarmGut();
  var statusUrl = base + "/nc/cgi-bin/wap_farm_status_list?sid=" + sid + "&g_ut=" + g_ut + "&page=0";
  var indexUrl = base + "/nc/cgi-bin/wap_farm_index?sid=" + sid + "&g_ut=" + g_ut;
  var allowClearWeed = CONFIG.ENABLE.clearWeed && !opts.skipClearWeed;
  var allowSpraying = CONFIG.ENABLE.spraying && !opts.skipSpraying;
  var allowWater = CONFIG.ENABLE.water && !opts.skipWater;
  var allowHarvest = CONFIG.ENABLE.harvest && !opts.skipHarvest;
  var allowScarify = CONFIG.ENABLE.scarify && !opts.skipScarify;
  var allowPlant = CONFIG.ENABLE.plant && !opts.skipPlant;

  function buildFarmActionSignature(links, html, allow) {
    var empty = 0;
    if (html) {
      empty = countEmptyFarmLand(parseFarmStatus(html));
    }
    allow = allow || {};
    return [
      allow.harvest ? (links.harvest || []).length : 0,
      allow.clearWeed ? (links.clearWeed || []).length : 0,
      allow.spraying ? (links.spraying || []).length : 0,
      allow.water ? (links.water || []).length : 0,
      allow.scarify ? (links.dig || []).length : 0,
      empty
    ].join("-");
  }

  function fetchLinks() {
    return ranchGet(statusUrl, cookie)
      .then(function (html) {
        var links1 = extractFarmWapLinks(html);
        return ranchGet(indexUrl, cookie)
          .then(function (html2) {
            setStartStats("farm", parseCommonStats(html2));
            LAST_FARM_HOME_HTML = html2 || "";
            var fishEntry = extractFishEntryLink(html2);
            if (fishEntry && /sid=/.test(fishEntry) && /g_ut=/.test(fishEntry)) {
              LAST_FISH_ENTRY_URL = fishEntry;
              logDebug("鱼塘入口(农场页): " + fishEntry);
            }
            if (!isFarmHome(html2)) {
              log("⚠️ 农场页面异常(" + (extractTitle(html2) || "无标题") + ")");
            }
            var links2 = extractFarmWapLinks(html2);
            var merged = mergeFarmLinks(links1, links2);
            var fallback = buildFarmOptFallback(html2) || {};
            if (!merged.clearWeed.length && fallback.clearWeed) merged.clearWeed = fallback.clearWeed;
            if (!merged.spraying.length && fallback.spraying) merged.spraying = fallback.spraying;
            if (!merged.water.length && fallback.water) merged.water = fallback.water;
            var hFallback = buildFarmHarvestFallback(html2) || {};
            if (!merged.harvest.length && hFallback.harvest) merged.harvest = hFallback.harvest;
            return { links: merged, html: html2 };
          })
          .catch(function () {
            return { links: links1, html: "" };
          });
      })
      .catch(function () {
        return ranchGet(indexUrl, cookie).then(function (html2) {
          setStartStats("farm", parseCommonStats(html2));
          LAST_FARM_HOME_HTML = html2 || "";
          var fishEntry = extractFishEntryLink(html2);
          if (fishEntry && /sid=/.test(fishEntry) && /g_ut=/.test(fishEntry)) {
            LAST_FISH_ENTRY_URL = fishEntry;
            logDebug("鱼塘入口(农场页): " + fishEntry);
          }
          var links2 = extractFarmWapLinks(html2);
          var hFallback = buildFarmHarvestFallback(html2) || {};
          if (!links2.harvest.length && hFallback.harvest) links2.harvest = hFallback.harvest;
          return { links: links2, html: html2 };
        });
      });
  }

  function execLinks(list, label, statKey, opts) {
    var idx = 0;
    var did = false;
    function next() {
      if (idx >= list.length) return Promise.resolve(did);
      var link = list[idx++];
      var tryCount = countParamList(link, "place") || countParamList(link, "landid") || 1;
      recordActionTry(statKey, tryCount);
      if (opts && opts.withered) recordWitheredTry(tryCount);
      var url = link.indexOf("http") === 0 ? link : base + "/nc/cgi-bin/" + link.replace(/^\.?\//, "");
      return ranchGet(url, cookie)
        .then(function (html) {
          var msg = extractMessage(html);
          if (label.indexOf("除草") >= 0 || label.indexOf("除虫") >= 0 || label.indexOf("浇水") >= 0) {
            msg = extractWapHint(html) || msg;
          }
          msg = cleanActionMsg(msg);
          var noNeed = isNoActionMsg(msg, statKey);
          var ok = !noNeed && isSuccessMsg(msg);
          if (noNeed) recordActionNoop(statKey, tryCount);
          if (ok) did = true;
          if (msg) log(label + ": " + msg);
          else if (label.indexOf("除草") >= 0 || label.indexOf("除虫") >= 0 || label.indexOf("浇水") >= 0) {
            log(label + ": 已尝试");
          }
          if (ok && statKey && ACTION_STATS[statKey] !== undefined) {
            var inc = parseActionCountFromMsg(msg, statKey);
            var listCount = tryCount;
            if (statKey === "harvest") {
              if (inc <= 0 && CONFIG.DEBUG && listCount > 0) {
                logDebug(label + ": 未解析果实数量, 已请求地块=" + listCount);
              }
              if (inc > 0) {
                var details = parseHarvestDetailFromMsg(msg || "");
                if (details && details.length) {
                  for (var di = 0; di < details.length; di++) {
                    recordHarvestByName(details[di].name, details[di].count);
                  }
                }
              }
            } else if (inc <= 0) {
              if (!msg) inc = listCount;
              else if (/(成功|完成|获得)/.test(msg) && listCount > 0) inc = listCount;
              else if (listCount === 1) inc = 1;
              else inc = 0;
              if (inc <= 0 && CONFIG.DEBUG && listCount > 0) {
                logDebug(label + ": 未解析数量, 已请求地块=" + listCount);
              }
            }
            if (inc > 0) {
              ACTION_STATS[statKey] += inc;
              if (opts && opts.withered && statKey === "scarify") recordWitheredClear(inc);
            }
          }
        })
        .then(function () {
          return sleep(CONFIG.WAIT_MS);
        })
        .then(next);
    }
    return next();
  }

  function runOnce() {
    return fetchLinks().then(function (ret) {
      var links = ret && ret.links ? ret.links : ret || {};
      var html = (ret && ret.html) || LAST_FARM_HOME_HTML || "";
      var sig = buildFarmActionSignature(links, html, {
        harvest: allowHarvest,
        clearWeed: allowClearWeed,
        spraying: allowSpraying,
        water: allowWater,
        scarify: allowScarify
      });
      var empty = html ? countEmptyFarmLand(parseFarmStatus(html)) : 0;
      var witheredPlaces = html ? collectFarmPlacesFromHtml(html, /枯萎/) : [];
      var maturePlaces = html ? collectFarmPlacesFromHtml(html, /(成熟|可收获|待收)/) : [];
      var coreLinkCount =
        (allowHarvest ? (links.harvest || []).length : 0) +
        (allowScarify ? (links.dig || []).length : 0);
      // 仅在“可改变地块状态”的入口出现时强制复查，避免纯维护无动作时重复记尝试次数。
      var shouldRecheck = coreLinkCount > 0 || (allowPlant && empty > 0);
      var didAny = false;
      function harvestByPlaces(places) {
        if (!places || places.length === 0) return Promise.resolve(false);
        recordActionTry("harvest", places.length);
        var params = extractFarmOptParams(html || "");
        var B_UID = params.B_UID || (LAST_RANCH && LAST_RANCH.B_UID) || "0";
        var time = params.time || "-2147483648";
        var url =
          base +
          "/nc/cgi-bin/wap_farm_harvest?sid=" +
          sid +
          "&B_UID=" +
          B_UID +
          "&place=" +
          places.join(",") +
          "&g_ut=" +
          g_ut +
          "&time=" +
          time;
        return ranchGet(url, cookie)
          .then(function (html2) {
            var msg = extractMessage(html2);
            if (msg) log("🌾 兜底收获: " + msg);
            var noNeed = isNoActionMsg(msg, "harvest");
            var ok = !noNeed && isSuccessMsg(msg);
            if (noNeed) recordActionNoop("harvest", places.length);
            if (ok) {
              var inc = parseActionCountFromMsg(msg, "harvest");
              if (inc > 0) {
                ACTION_STATS.harvest += inc;
                var details = parseHarvestDetailFromMsg(msg || "");
                if (details && details.length) {
                  for (var di = 0; di < details.length; di++) {
                    recordHarvestByName(details[di].name, details[di].count);
                  }
                }
              } else if (CONFIG.DEBUG) {
                logDebug("🌾 兜底收获: 未解析果实数量, 地块=" + places.length);
              }
            }
            return ok;
          })
          .catch(function (e) {
            log("🌾 兜底收获失败: " + e);
            return false;
          });
      }
      return Promise.resolve()
        .then(function () {
          if (!allowClearWeed) return false;
          return execLinks(links.clearWeed, "🌿 除草", "clearWeed");
        })
        .then(function (d) {
          if (d) didAny = true;
          if (!allowSpraying) return false;
          return execLinks(links.spraying, "🐛 除虫", "spraying");
        })
        .then(function (d) {
          if (d) didAny = true;
          if (!allowWater) return false;
          return execLinks(links.water, "💧 浇水", "water");
        })
        .then(function (d) {
          if (d) didAny = true;
          if (!allowHarvest) return false;
          return execLinks(links.harvest, "🌾 收获", "harvest");
        })
        .then(function (d) {
          if (d) didAny = true;
          if (d) return false;
          if (!allowHarvest) return false;
          if (maturePlaces.length === 0) return false;
          log("🌾 兜底收获: 成熟地块=" + maturePlaces.length);
          return harvestByPlaces(maturePlaces);
        })
        .then(function (d2) {
          if (d2) didAny = true;
          return false;
        })
        .then(function (d) {
          if (d) didAny = true;
          if (!allowScarify) return false;
          return execLinks(links.dig, "🪓 铲除枯萎", "scarify", { withered: true });
        })
        .then(function (d) {
          if (d) didAny = true;
          if (d) return false;
          if (!allowScarify) return false;
          if (!witheredPlaces.length) return false;
          log("🪓 兜底铲除: 枯萎地块=" + witheredPlaces.length);
          return farmOneKeyDig(cookie, witheredPlaces).then(function (ok) {
            if (ok) {
              ACTION_STATS.scarify += witheredPlaces.length;
            }
            return ok;
          });
        })
        .then(function (d) {
          if (d) didAny = true;
          if (!allowPlant) return false;
          return farmOneKeySow(cookie, CONFIG.PLANT_CID);
        })
        .then(function (d) {
          if (d) didAny = true;
          // 维护动作(除草/除虫/浇水)不触发循环复查，避免重复“已尝试”记账。
          if (shouldRecheck) didAny = true;
          else didAny = false;
          return { didAny: didAny, sig: sig };
        });
    });
  }

  var maxPass = CONFIG.FARM_WAP_MAX_PASS || 0;
  var seenSig = {};
  function loop(round, lastSig) {
    return runOnce().then(function (res) {
      if (!res) return { ok: true };
      if (!res.didAny) return { ok: true };
      if (res.sig) {
        if (seenSig[res.sig]) {
          logDebug("农场复查: 状态重复，停止");
          return { ok: true };
        }
        seenSig[res.sig] = true;
      }
      if (lastSig && res.sig && res.sig === lastSig) {
        logDebug("农场复查: 状态未变化，停止");
        return { ok: true };
      }
      if (maxPass > 0 && round >= maxPass - 1) return { ok: true };
      return loop(round + 1, res.sig || lastSig);
    });
  }

  return loop(0, "");
}

function summarizeFarmJsonMaintTodo(farm) {
  var out = {
    total: 0,
    locked: 0,
    clearWeed: 0,
    spraying: 0,
    water: 0,
    places: { clearWeed: [], spraying: [], water: [] }
  };
  if (!isFarmJson(farm)) return out;
  var list = ensureArray(farm.farmlandStatus);
  for (var i = 0; i < list.length; i++) {
    var land = list[i];
    if (!land) continue;
    out.total += 1;
    var lockReason = landLockReason(land);
    if (lockReason) {
      out.locked += 1;
      continue;
    }
    var idx = String(i);
    if (CONFIG.ENABLE.clearWeed && Number(land.f || 0) > 0) {
      out.clearWeed += 1;
      out.places.clearWeed.push(idx);
    }
    if (CONFIG.ENABLE.spraying && Number(land.g || 0) > 0) {
      out.spraying += 1;
      out.places.spraying.push(idx);
    }
    if (CONFIG.ENABLE.water && Number(land.h || 0) === 0) {
      out.water += 1;
      out.places.water.push(idx);
    }
  }
  return out;
}

function countFarmWapMaintPlaces(links, key) {
  var list = (links && links[key]) || [];
  var total = 0;
  for (var i = 0; i < list.length; i++) {
    var n = countParamList(list[i], "place") || countParamList(list[i], "landid") || 1;
    total += n;
  }
  return total;
}

function fetchFarmWapMaintTodo(cookie) {
  var base = CONFIG.FARM_WAP_BASE;
  var sid = CONFIG.RANCH_SID;
  var g_ut = getFarmGut();
  var statusUrl = base + "/nc/cgi-bin/wap_farm_status_list?sid=" + sid + "&g_ut=" + g_ut + "&page=0";
  var indexUrl = base + "/nc/cgi-bin/wap_farm_index?sid=" + sid + "&g_ut=" + g_ut;
  var merged = { clearWeed: [], spraying: [], water: [] };
  var touched = false;

  function mergeFromHtml(html) {
    if (!html) return;
    touched = true;
    var links = extractFarmWapLinks(html);
    merged.clearWeed = uniqLinks(merged.clearWeed.concat(links.clearWeed || []));
    merged.spraying = uniqLinks(merged.spraying.concat(links.spraying || []));
    merged.water = uniqLinks(merged.water.concat(links.water || []));
  }

  return ranchGet(statusUrl, cookie)
    .then(function (html) {
      mergeFromHtml(html);
    })
    .catch(function () {})
    .then(function () {
      return ranchGet(indexUrl, cookie)
        .then(function (html2) {
          mergeFromHtml(html2);
        })
        .catch(function () {});
    })
    .then(function () {
      return {
        ok: touched,
        clearWeed: countFarmWapMaintPlaces(merged, "clearWeed"),
        spraying: countFarmWapMaintPlaces(merged, "spraying"),
        water: countFarmWapMaintPlaces(merged, "water"),
        links: merged
      };
    });
}

function formatFarmMaintTriplet(todo) {
  if (!todo) return "草? 虫? 水?";
  return "草" + Number(todo.clearWeed || 0) + " 虫" + Number(todo.spraying || 0) + " 水" + Number(todo.water || 0);
}

function formatFarmMaintPlaces(places) {
  if (!places || !places.length) return "-";
  var show = places.slice(0, 10).map(function (it) {
    return String(Number(it) + 1);
  });
  if (places.length > 10) show.push("...+" + (places.length - 10));
  return show.join(",");
}

function probeFarmMaintDual(cookie, tag) {
  var jsonBase = CONFIG.FARM_JSON_BASE || "https://nc.qzone.qq.com";
  var uin = getFarmUin(cookie);
  var jsonP = fetchFarmJson(jsonBase, cookie, uin)
    .then(function (farm) {
      if (!isFarmJson(farm)) return { ok: false, todo: null };
      applyFarmLockHeuristicGuard(farm, "maint-recheck-" + tag);
      return { ok: true, todo: summarizeFarmJsonMaintTodo(farm) };
    })
    .catch(function () {
      return { ok: false, todo: null };
    });
  var wapP = fetchFarmWapMaintTodo(cookie).catch(function () {
    return { ok: false, clearWeed: 0, spraying: 0, water: 0, links: { clearWeed: [], spraying: [], water: [] } };
  });
  return Promise.all([jsonP, wapP]).then(function (arr) {
    var jsonRet = arr[0] || { ok: false, todo: null };
    var wapRet = arr[1] || { ok: false, clearWeed: 0, spraying: 0, water: 0 };
    var jsonMsg = jsonRet.ok ? formatFarmMaintTriplet(jsonRet.todo) : "探测失败";
    var wapMsg = wapRet.ok ? formatFarmMaintTriplet(wapRet) : "探测失败";
    log("🧪 维护复查(" + tag + "): JSON " + jsonMsg + " | WAP " + wapMsg);
    if (CONFIG.DEBUG && jsonRet.ok && jsonRet.todo && jsonRet.todo.places) {
      logDebug(
        "🧪 维护复查(JSON地块): 草[" +
          formatFarmMaintPlaces(jsonRet.todo.places.clearWeed) +
          "] 虫[" +
          formatFarmMaintPlaces(jsonRet.todo.places.spraying) +
          "] 水[" +
          formatFarmMaintPlaces(jsonRet.todo.places.water) +
          "]"
      );
    }
    var jsonPending =
      !!(jsonRet.ok && jsonRet.todo && (jsonRet.todo.clearWeed > 0 || jsonRet.todo.spraying > 0 || jsonRet.todo.water > 0));
    var wapPending = !!(wapRet.ok && (wapRet.clearWeed > 0 || wapRet.spraying > 0 || wapRet.water > 0));
    return {
      jsonOk: !!jsonRet.ok,
      wapOk: !!wapRet.ok,
      jsonPending: jsonPending,
      wapPending: wapPending,
      pending: jsonPending || wapPending
    };
  });
}

function runFarmMaintPostcheck(cookie) {
  if (CONFIG.FARM_JSON_WAP_MAINT_POSTCHECK === false) return Promise.resolve();
  var maxRetry = Number(CONFIG.FARM_JSON_WAP_MAINT_POSTCHECK_RETRY || 0);
  if (isNaN(maxRetry) || maxRetry < 0) maxRetry = 0;

  function loop(round) {
    var tag = round === 0 ? "首轮" : "补打" + round;
    return probeFarmMaintDual(cookie, tag).then(function (probe) {
      if (!probe || !probe.pending) return;
      if (round >= maxRetry) {
        logDebug("🧪 维护复查: 达到补打上限" + maxRetry + "，停止");
        return;
      }
      log(
        "⚠️ 维护复查: 仍有待处理(JSON" +
          (probe.jsonPending ? "有" : "无") +
          "/WAP" +
          (probe.wapPending ? "有" : "无") +
          ")，执行WAP补打"
      );
      return runFarmWap(cookie, { skipHarvest: true, skipScarify: true, skipPlant: true })
        .catch(function (e) {
          log("⚠️ 维护复查补打失败: " + e);
        })
        .then(function () {
          return loop(round + 1);
        });
    });
  }

  return loop(0);
}

function runFarmAuto(cookie) {
  if (!CONFIG.FARM_JSON_ENABLE) return runFarmWap(cookie);
  return runFarmJson(cookie)
    .then(function (res) {
      var jsonOk = res && res.ok;
      if (jsonOk) {
        if (CONFIG.FARM_JSON_OBSERVE_ONLY) return res;
        var keepWapMaint = CONFIG.FARM_JSON_WAP_MAINT_RECHECK !== false;
        // JSON 与端游口径偶发不一致；默认保留一次 WAP 维护对账。
        return runFarmWap(
          cookie,
          keepWapMaint
            ? {
                skipHarvest: true,
                skipScarify: true,
                skipPlant: true
              }
            : {
                skipHarvest: true,
                skipScarify: true,
                skipPlant: true,
                skipClearWeed: true,
                skipSpraying: true,
                skipWater: true
              }
        ).then(
          function () {
            if (!keepWapMaint) return;
            return runFarmMaintPostcheck(cookie);
          }
        ).then(function () {
          return res;
        });
      }
      if (!CONFIG.FARM_JSON_FALLBACK_WAP) return res;
      log("⚠️ JSON 模式失败，仅回退 WAP 维护(除草/除虫/浇水)，跳过收获/铲除/播种");
      return runFarmWap(cookie, { skipHarvest: true, skipScarify: true, skipPlant: true })
        .then(function () {
          return runFarmMaintPostcheck(cookie);
        })
        .then(function () {
          return res;
        });
    })
    .catch(function (e) {
      if (!CONFIG.FARM_JSON_FALLBACK_WAP) return Promise.reject(e);
      log("⚠️ JSON 模式异常，仅回退 WAP 维护(除草/除虫/浇水)，跳过收获/铲除/播种");
      return runFarmWap(cookie, { skipHarvest: true, skipScarify: true, skipPlant: true })
        .then(function () {
          return runFarmMaintPostcheck(cookie);
        })
        .then(function () {
          return { ok: false, reason: "farm json exception", error: String(e || "") };
        });
    });
}

function fetchFarmSeedBag(cookie) {
  var base = CONFIG.FARM_WAP_BASE;
  var sid = CONFIG.RANCH_SID;
  var g_ut = getFarmGut();
  var urls = [
    base + "/nc/cgi-bin/wap_farm_user_bag?sid=" + sid + "&g_ut=" + g_ut,
    base + "/nc/cgi-bin/wap_farm_rep_list?sid=" + sid + "&g_ut=" + g_ut
  ];
  var idx = 0;
  function next() {
    if (idx >= urls.length) return Promise.resolve([]);
    var url = urls[idx++];
    return ranchGet(url, cookie)
      .then(function (html) {
        var list = parseFarmSeedBag(html);
        if (list.length > 0) return list;
        return next();
      })
      .catch(function () {
        return next();
      });
  }
  return next();
}

function decidePlantSeed(cookie, grassCount) {
  if (GRASS_LOW_SEEN) {
    PLANT_SEED_LOCKED = true;
    return Promise.resolve(CONFIG.FARM_GRASS_SEED_ID);
  }
  if (PLANT_SEED_LOCKED) {
    return Promise.resolve(CONFIG.PLANT_CID || null);
  }
  if (markGrassLow(grassCount, "")) return Promise.resolve(CONFIG.FARM_GRASS_SEED_ID);
  var seedTotal = BAG_STATS.seed ? BAG_STATS.seed.total : 0;
  if (seedTotal >= CONFIG.FARM_SEED_MIN_TOTAL) {
    var picked = pickPlantSeedCidByPolicy(grassCount);
    var pickedName = picked ? getCropNameByCid(picked) : "";
    var preferNonGrass = isGrassEnoughForDiversify(grassCount) || isGrassEnoughForDiversify(LAST_GRASS_COUNT);
    var seasonalPicked = !!(preferNonGrass && picked && isSeasonalSeedCid(picked));
    var prefix = seasonalPicked ? "优先使用节气种子" : preferNonGrass ? "优先使用非牧草" : "优先使用";
    if (picked) {
      if (pickedName && !/^cId\d+$/i.test(pickedName)) {
        log("🌱 种植策略: 背包种子充足(" + seedTotal + ")，" + prefix + " " + pickedName + "(cId=" + picked + ")");
      } else {
        log("🌱 种植策略: 背包种子充足(" + seedTotal + ")，" + prefix + " cId=" + picked);
      }
    } else {
      log("🌱 种植策略: 背包种子充足(" + seedTotal + ")，但未解析到可用 cId，保留当前播种配置");
    }
    PLANT_SEED_LOCKED = true;
    return Promise.resolve(picked || null);
  }
  log("🌱 种植策略: 背包种子偏少(" + seedTotal + "<" + CONFIG.FARM_SEED_MIN_TOTAL + ")，购买商店首个种子 x" + CONFIG.FARM_SEED_BUY_NUM);
  return buyFirstSeed(cookie, CONFIG.FARM_SEED_BUY_NUM)
    .then(function (cid) {
      if (cid) return cid;
      if (NO_MONEY.farmSeed && CONFIG.ENABLE.farm_sell_all) {
        log("🧺 买种子: 金币不足，尝试先售卖补金币");
        return farmSellAll(cookie)
          .then(function () {
            NO_MONEY.farmSeed = false;
            return buyFirstSeed(cookie, CONFIG.FARM_SEED_BUY_NUM);
          });
      }
      return "";
    })
    .then(function (cidFinal) {
      PLANT_SEED_LOCKED = true;
      return cidFinal || null;
    });
}

function feedRanchFromWarehouse(base, farmCookie, ranchCookie) {
  if (!CONFIG.ENABLE.ranch_feed) return Promise.resolve();
  if (!LAST_RANCH || !LAST_RANCH.sid || !LAST_RANCH.g_ut) {
    log("🌿 牧草果实: 无牧场上下文，跳过");
    return Promise.resolve();
  }
  var ctx = LAST_RANCH;
  var ck = ranchCookie || LAST_RANCH_COOKIE || farmCookie;
  return ranchFeedUntilFull(base, ck, ctx, true).then(function (fed) {
    if (!fed) return;
    return execRanchActions(base, ck, ctx, { skipFeed: true, feedDone: true });
  });
}

/* =======================
 *  FISH MODE (鱼塘)
 * ======================= */
function fishGet(url, cookie, referer) {
  var target = normalizeMcappUrl(url);
  var activeCookie = preferRicherCookie(cookie, LAST_RANCH_COOKIE);
  return getHtmlFollow(target, activeCookie, referer || defaultMcappReferer(), "鱼塘", 0).then(function (resp) {
    if (resp && resp.cookie) LAST_RANCH_COOKIE = preferRicherCookie(resp.cookie, LAST_RANCH_COOKIE);
    var body = resp && resp.body ? resp.body : "";
    logDebug("鱼塘响应 " + (body ? body.length : 0));
    return body || "";
  });
}

function runFish(base, cookie) {
  log("🐟 鱼塘模块: 启动");
  var sid = CONFIG.RANCH_SID;
  var g_ut = getFishGut();
  var indexUrl = base + "/nc/cgi-bin/wap_farm_fish_index?sid=" + sid + "&g_ut=" + g_ut;
  var entryUrl =
    LAST_FISH_ENTRY_URL && /sid=/.test(LAST_FISH_ENTRY_URL) && /g_ut=/.test(LAST_FISH_ENTRY_URL)
      ? buildMcappLink(base, LAST_FISH_ENTRY_URL)
      : "";
  var farmIndexUrl = base + "/nc/cgi-bin/wap_farm_index?sid=" + sid + "&g_ut=" + g_ut;

function buildCtx(html) {
    return {
      sid: sid,
      g_ut: g_ut,
      lv: extractFishLevel(html) || "",
      indices: extractFishFertilizeIndices(html),
      harvestLinks: extractFishHarvestLinks(html),
      fishStatus: parseFishStatus(html),
      emptyPonds: extractFishEmptyPonds(html),
      indexHtml: html,
      hasFeedEntry:
        (html || "").indexOf("fish_fertilize") >= 0 ||
        (html || "").indexOf("喂鱼食") >= 0
    };
  }

  function logEntryHint(html) {
    if (isContinuePage(html)) {
      log("🐟 鱼塘入口: 疑似继续访问页，暂无可操作入口");
      return;
    }
    if (isFishPage(html)) {
      log("🐟 鱼塘入口: 暂无可操作入口（可能未成熟/无鱼/无饲料）");
      return;
    }
    log("🐟 鱼塘入口: 未识别鱼塘页面，尝试切换入口/重试");
  }

  function fetchIndex(url, depth, referer) {
    return fishGet(url, cookie, referer).then(function (html) {
      var ctx = buildCtx(html);
      var noEntry =
        (!ctx.indices || ctx.indices.length === 0) &&
        (!ctx.harvestLinks || ctx.harvestLinks.length === 0) &&
        !ctx.hasFeedEntry;
      if (noEntry && depth < 2) {
        var next = extractMcappLink(html) || extractFishEntryLink(html);
        if (next) {
          var nextUrl = buildMcappLink(base, next);
          if (nextUrl && nextUrl !== url) {
            return fetchIndex(nextUrl, depth + 1, url);
          }
        }
    }
    return { html: html, ctx: ctx, noEntry: noEntry, url: url };
  });
  }

  function resolveEntry() {
    if (entryUrl) return Promise.resolve(entryUrl);
    return ranchGet(farmIndexUrl, cookie)
      .then(function (html) {
        var link = extractFishEntryLink(html);
        if (link && /sid=/.test(link) && /g_ut=/.test(link)) {
          LAST_FISH_ENTRY_URL = link;
          return buildMcappLink(base, link);
        }
        return indexUrl;
      })
      .catch(function () {
        return indexUrl;
      });
  }

  return resolveEntry()
    .then(function (url) {
      return fetchFishPearlNameMap(cookie).then(function () {
        return url;
      });
    })
    .then(function (url) {
      return runFishComposeFromPieces(cookie).then(function () {
        return url;
      });
    })
    .then(function (url) {
      return fetchIndex(url, 0, farmIndexUrl);
    })
    .then(function (ret) {
      var ctx = ret.ctx;
      var noEntry = ret.noEntry;
      if (noEntry) {
        logEntryHint(ret.html);
        if (ret.url !== indexUrl) {
          return fetchIndex(indexUrl, 0, ret.url).then(function (ret2) {
            if (ret2.noEntry) logEntryHint(ret2.html);
            return execFishActions(base, cookie, ret2.ctx).then(function () {
              return runFishPearlDrawDaily(cookie);
            });
          });
        }
      }
      return execFishActions(base, cookie, ctx).then(function () {
        return runFishPearlDrawDaily(cookie);
      });
    })
    .catch(function (e) {
      FISH_STATS.errors += 1;
      log("⚠️ 鱼塘模块异常: " + e);
    });
}

function autoPlantFishFromBag(base, cookie, ctx) {
  if (!CONFIG.FISH_AUTO_PLANT) return Promise.resolve(false);
  var sid = ctx.sid;
  var g_ut = ctx.g_ut;
  var indexUrl = base + "/nc/cgi-bin/wap_farm_fish_index?sid=" + sid + "&g_ut=" + g_ut;
  var didPlant = false;
  var startOcc = null;
  var startCap = null;
  var endOcc = null;
  var endCap = null;
  var fallbackConflictSeen = false;
  var jsonConflictSeen = false;
  var transientRetries = Math.max(0, Number(CONFIG.RETRY_TRANSIENT || 0));
  if (isNaN(transientRetries)) transientRetries = 0;

  function calcFishCapacityFromIndex(occ) {
    if (!occ) return CONFIG.FISH_MAX_POND || 8;
    var cap = Number(CONFIG.FISH_MAX_POND || 8) || 8;
    if (occ.maxNo && occ.maxNo > cap) cap = occ.maxNo;
    if (occ.occupied > cap) cap = occ.occupied;
    return cap;
  }

  function deriveEmptyFromIndex(html) {
    var occ = parseFishIndexOccupancy(html || "");
    var cap = calcFishCapacityFromIndex(occ);
    var empty = cap - (occ.occupied || 0);
    if (empty < 0) empty = 0;
    return { empty: empty, cap: cap, occ: occ };
  }

  function refreshIndexSnapshot(tag) {
    var jsonState = null;
    return fetchFishIndexJsonState(cookie, tag)
      .then(function (state) {
        jsonState = state;
        return fishGet(indexUrl, cookie);
      })
      .then(function (html) {
        ctx.indexHtml = html || ctx.indexHtml;
        var info = deriveEmptyFromIndex(html || "");
        var occupied = info.occ.occupied;
        var cap = info.cap;
        var empty = info.empty;
        var source = "fish_wap";

        if (jsonState) {
          if (
            !jsonConflictSeen &&
            (jsonState.occupied !== occupied || jsonState.cap !== cap || jsonState.empty !== empty)
          ) {
            jsonConflictSeen = true;
            log(
              "⚠️ 放养口径冲突: fish_json占用=" +
                jsonState.occupied +
                "/" +
                jsonState.cap +
                "，fish_wap占用=" +
                occupied +
                "/" +
                cap +
                "；优先 fish_json"
            );
          }
          occupied = jsonState.occupied;
          cap = jsonState.cap;
          empty = jsonState.empty;
          source = "fish_json";
        }

        if (CONFIG.DEBUG) {
          logDebug(
            "🐟 " +
              (tag || "鱼塘快照") +
              ": 占用" +
              occupied +
              "/" +
              cap +
              " (empty=" +
              empty +
              "，来源=" +
              source +
              (jsonState ? "，wap=" + info.occ.occupied + "/" + info.cap : "") +
              ")"
          );
        }
        return {
          html: html || "",
          empty: empty,
          cap: cap,
          occupied: occupied,
          occ: info.occ,
          source: source,
          json: jsonState
        };
    });
  }

  function fetchEmptyFromBuyPre() {
    if (!CONFIG.FISH_EMPTY_FALLBACK) return Promise.resolve(null);
    var listUrl = base + "/nc/cgi-bin/wap_fish_list_new?sid=" + sid + "&g_ut=" + g_ut + "&buyway=0";
    return fishGet(listUrl, cookie)
      .then(function (html) {
        var fid = "";
        var opts = extractFishBuyOptions(html);
        if (opts.length > 0 && opts[0].fid) fid = opts[0].fid;
        if (!fid) {
          var fids = extractFishBuyFids(html);
          if (fids.length > 0) fid = fids[0];
        }
        if (!fid) return null;
        var preUrl =
          base + "/nc/cgi-bin/wap_fish_buy_pre_new?sid=" + sid + "&g_ut=" + g_ut + "&fid=" + fid + "&buyway=0";
        return fishGet(preUrl, cookie).then(function (html2) {
          var empty = extractFishEmptyPonds(html2);
          if (CONFIG.DEBUG && empty !== null && empty !== undefined) {
            logDebug("🧪 buy_pre 空池塘: " + empty + " (fid=" + fid + ")");
          }
          return empty === null || empty === undefined ? null : empty;
        });
      })
      .catch(function () {
        return null;
      });
  }

  function plantByJson(fid, num, pre, seedName) {
    if (!CONFIG.FISH_PLANT_JSON_FIRST) return Promise.resolve({ ok: false, delta: 0, full: false });
    if (!fid || !num || num <= 0) return Promise.resolve({ ok: false, delta: 0, full: false });
    return ensureFishJsonContext(cookie)
      .then(function (jctx) {
        var uIdx = jctx && jctx.uIdx ? jctx.uIdx : "";
        var uinY = jctx && jctx.uinY ? jctx.uinY : "";
        if (!uIdx || !uinY) return { ok: false, delta: 0, full: false };
        var successHints = 0;
        var stoppedFull = false;

        function step(remain, busyRetry) {
          if (remain <= 0) return Promise.resolve();
          var params = {
            fid: fid,
            uIdx: uIdx,
            uinY: uinY,
            farmTime: getFarmTime(),
            platform: CONFIG.FARM_PLATFORM || "13",
            appid: CONFIG.FARM_APPID || "353",
            version: CONFIG.FARM_VERSION || "4.0.20.0"
          };
          var url = (CONFIG.FARM_JSON_BASE || "https://nc.qzone.qq.com") + "/cgi-bin/cgi_fish_plant";
          return httpRequest({
            method: "POST",
            url: url,
            headers: buildFishJsonHeaders(cookie),
            body: buildLegacyBody(params)
          })
            .then(function (resp) {
              var json = tryJson(resp.body);
              if (json && Number(json.code) === 1) {
                successHints += 1;
                if (CONFIG.DEBUG) {
                  logDebug(
                    "🪣 JSON放养: 成功 " +
                      (seedName || ("fid=" + fid)) +
                      " i=" +
                      (json.i != null ? json.i : "-") +
                      " 剩余尝试=" +
                      (remain - 1)
                  );
                }
                return sleep(CONFIG.WAIT_MS).then(function () {
                  return step(remain - 1, 0);
                });
              }
              var msg = "";
              if (json && (json.direction || json.msg || json.message)) {
                msg = normalizeSpace(json.direction || json.msg || json.message || "");
              }
              if (!msg && typeof resp.body === "string") msg = normalizeSpace(stripTags(resp.body || ""));
              if (msg) log("🪣 放养(JSON): " + msg);
              var transient = isTransientFailText(msg || "");
              if (transient && busyRetry < transientRetries) {
                log("⚠️ 放养(JSON): 系统繁忙，第" + (busyRetry + 1) + "次重试");
                return sleep(CONFIG.RETRY_WAIT_MS || 800).then(function () {
                  return step(remain, busyRetry + 1);
                });
              }
              if (/池塘已经满|空池塘=0|没有空池塘|已满/.test(msg || "")) stoppedFull = true;
              return;
            })
            .catch(function (e) {
              if (CONFIG.DEBUG) logDebug("🪣 JSON放养请求异常: " + e);
              return;
            });
        }

        return step(num, 0).then(function () {
          return refreshIndexSnapshot("JSON放养后复查").then(function (post) {
            var delta = post.occupied - pre.occupied;
            if (delta > 0) {
              log("🪣 放养(JSON): 实际新增 " + delta + " 条");
              return { ok: true, delta: delta, full: stoppedFull };
            }
            if (CONFIG.DEBUG && successHints > 0) {
              logDebug("🪣 JSON放养: 成功提示" + successHints + "次，但占用未变化");
            }
            return { ok: false, delta: 0, full: stoppedFull };
          });
        });
      })
      .catch(function (e) {
        if (CONFIG.DEBUG) logDebug("🪣 JSON放养失败: " + e);
        return { ok: false, delta: 0, full: false };
      });
  }

  function doPlant(targetEmpty) {
    if (!targetEmpty || targetEmpty <= 0) {
      log("🪣 放养: 空池塘=0");
      return Promise.resolve(false);
    }
    return refreshIndexSnapshot("放养前复查").then(function (pre) {
      var empty = pre.empty;
      if (empty <= 0) {
        if (CONFIG.DEBUG) logDebug("🪣 放养前复查: 空池塘=0，跳过本轮");
        return false;
      }
      return ensureFishSeedTotal(cookie).then(function (total) {
      if (!total || total <= 0) {
        log("🪣 放养: 背包无鱼苗");
        return false;
      }
      var seedUrl =
        base +
        "/nc/cgi-bin/wap_fish_seed_list?sid=" +
        sid +
        "&g_ut=" +
        g_ut +
        "&pnum=" +
        targetEmpty +
        "&flag=1&time=-2147483648";
      return fishGet(seedUrl, cookie).then(function (html2) {
        var link = extractFishPlantLink(html2);
        var seedOptions = extractFishSeedOptions(html2);
        for (var so = 0; so < seedOptions.length; so++) {
          var opt = seedOptions[so];
          var fidKey = String(opt.fid || "");
          var nm = normalizeSpace(opt.name || "");
          if (fidKey && nm && !FISH_PEARL_ID_NAME_MAP[fidKey]) FISH_PEARL_ID_NAME_MAP[fidKey] = nm;
        }
        var needNum = Math.min(targetEmpty, total);
        var fid = "";
        var seedName = "";
        var chosen = pickPreferredFishSeedOption(seedOptions);
        if (chosen && chosen.fid) {
          fid = String(chosen.fid);
          seedName = normalizeSpace(chosen.name || "");
          link = chosen.link || link;
          if (CONFIG.DEBUG) {
            logDebug(
              "🪣 放养选种: " +
                (seedName || ("鱼苗#" + fid)) +
                " fid=" +
                fid +
                " 背包=" +
                (chosen.count || 0) +
                (CONFIG.FISH_PREFER_RARE_SEED ? " (珍稀优先)" : "")
            );
          }
        }
        if (!fid && link) fid = firstMatch(link, /fid=([0-9]+)/);
        if (!fid) fid = firstMatch(html2, /fid=([0-9]+)/) || String(CONFIG.FISH_BUY_FID || "");
        if (!seedName && fid) seedName = getFishNameByFid(fid) || "";

        function runWapPlant(wantNum, baseline) {
          var num = Number(wantNum || 0);
          var basePre = baseline || pre;
          if (!num || num <= 0) return Promise.resolve(false);
          var workLink = link;
          if (!workLink && fid) {
            workLink =
              "wap_fish_plant?sid=" +
              sid +
              "&g_ut=" +
              g_ut +
              "&fid=" +
              fid +
              "&flag=1&step=2&num=" +
              num;
          }
          if (workLink && /num=\d+/.test(workLink)) workLink = workLink.replace(/num=\d+/, "num=" + num);
          else if (workLink) workLink += (workLink.indexOf("?") >= 0 ? "&" : "?") + "num=" + num;
          if (!workLink) {
            log("🪣 放养: 未发现可放养入口");
            return Promise.resolve(false);
          }
          var url = workLink.indexOf("http") === 0 ? workLink : base + "/nc/cgi-bin/" + workLink.replace(/^\.?\//, "");
          function tryPlant(attempt) {
            return fishGet(url, cookie).then(function (html3) {
              var msg = extractMessage(html3);
              var text = normalizeSpace(msg || stripTags(html3 || ""));
              var transient = isTransientFailText(text);
              if (msg) log("🪣 放养" + (seedName ? "(" + seedName + ")" : "") + ": " + msg);
              else log("🪣 放养: 已提交");
              if (transient && attempt < transientRetries) {
                log("⚠️ 放养: 系统繁忙，第" + (attempt + 1) + "次重试");
                return sleep(CONFIG.RETRY_WAIT_MS || 800).then(function () {
                  return tryPlant(attempt + 1);
                });
              }
              if (/(对不起|没有足够|无法|不足|失败|未满足|输入有误|系统繁忙|稍候)/.test(msg || "")) {
                return refreshIndexSnapshot("放养后复查").then(function (postBusy) {
                  var deltaBusy = postBusy.occupied - basePre.occupied;
                  if (deltaBusy > 0) {
                    log("🪣 放养: 回包失败提示，但占用已变化，按成功记 " + deltaBusy + " 条");
                    FISH_STATS.plant += deltaBusy;
                    didPlant = true;
                    return true;
                  }
                  return false;
                });
              }
              return refreshIndexSnapshot("放养后复查").then(function (post) {
                var delta = post.occupied - basePre.occupied;
                if (delta > 0) {
                  FISH_STATS.plant += delta;
                  didPlant = true;
                  if (CONFIG.DEBUG && delta !== num) {
                    logDebug("🪣 放养: 请求数量=" + num + "，实际占用变化=" + delta);
                  }
                  return true;
                }
                var cnt = parseFishPlantCountFromMsg(msg || html3) || 0;
                if (cnt > 0) {
                  FISH_STATS.plant += cnt;
                  didPlant = true;
                  log("🪣 放养: 已按回包数量记账 " + cnt + " 条（占用未变化）");
                  return true;
                }
                if (CONFIG.DEBUG) logDebug("🪣 放养: 回包成功但占用未变化，记为未成功");
                return false;
              });
            });
          }
          return tryPlant(0);
        }

        if (!needNum || needNum <= 0) return false;
        if (CONFIG.FISH_PLANT_JSON_FIRST && fid) {
          return plantByJson(fid, needNum, pre, seedName).then(function (jret) {
            if (jret && jret.ok && jret.delta > 0) {
              FISH_STATS.plant += jret.delta;
              didPlant = true;
              var remain = needNum - jret.delta;
              if (remain <= 0 || jret.full) return true;
              if (CONFIG.DEBUG) logDebug("🪣 JSON放养后仍需补投放 " + remain + " 条，转 WAP 兜底");
              return refreshIndexSnapshot("JSON后WAP前基线").then(function (pre2) {
                return runWapPlant(remain, pre2);
              });
            }
            if (jret && jret.full) return false;
            return runWapPlant(needNum, pre);
          });
        }
        return runWapPlant(needNum, pre);
      });
    });
    });
  }

  function fillByEmpty(empty, round) {
    var r = round || 0;
    if (empty === null || empty === undefined) return Promise.resolve();
    if (empty <= 0) {
      if (r === 0) log("🪣 放养: 空池塘=0");
      return Promise.resolve();
    }
    if (r > 0) {
      log("🪣 放养复查: 空池塘=" + empty + "，继续补投放");
    }
    return doPlant(empty).then(function () {
      return refreshIndexSnapshot("放养轮次复查").then(function (post) {
        var remainByIndex = post.empty;
        var mainSource = post.source === "fish_json" ? "fish_json" : "fish_wap";
        return fetchEmptyFromBuyPre().then(function (remainByPre) {
          if (remainByPre !== null && remainByPre !== undefined && remainByPre !== remainByIndex) {
            fallbackConflictSeen = true;
            log(
              "⚠️ 放养口径冲突: " + mainSource + "空位=" + remainByIndex + "，buy_pre空位=" + remainByPre + "；优先 " + mainSource
            );
          }
          if (remainByIndex <= 0) return;
          if (r >= 2) {
            log("🪣 放养复查: 剩余空池塘=" + remainByIndex + "，达到补投放上限");
            return;
          }
          return fillByEmpty(remainByIndex, r + 1);
        });
      });
    });
  }

  return refreshIndexSnapshot("放养开始")
    .then(function (start) {
      startOcc = start.occupied;
      startCap = start.cap;
      var emptyByIndex = start.empty;
      var startSource = start.source === "fish_json" ? "fish_json" : "fish_wap";
      if (emptyByIndex <= 0) return fillByEmpty(0, 0);
      return fetchEmptyFromBuyPre().then(function (fallback) {
        if (fallback !== null && fallback !== undefined && fallback !== emptyByIndex) {
          fallbackConflictSeen = true;
          log(
            "⚠️ 放养口径冲突: " + startSource + "空位=" + emptyByIndex + "，buy_pre空位=" + fallback + "；优先 " + startSource
          );
        }
        return fillByEmpty(emptyByIndex, 0);
      });
    })
    .then(function () {
      return refreshIndexSnapshot("放养结束").then(function (end) {
        endOcc = end.occupied;
        endCap = end.cap;
      });
    })
    .then(function () {
      if (startOcc !== null && endOcc !== null) {
        var delta = endOcc - startOcc;
        log(
          "🪣 放养占用: 开始" +
            startOcc +
            "/" +
            (startCap || "-") +
            " → 结束" +
            endOcc +
            "/" +
            (endCap || "-") +
            " (Δ" +
            formatDelta(delta) +
            ")"
        );
      }
      if (fallbackConflictSeen && CONFIG.DEBUG) {
        logDebug("🧪 已触发空位口径冲突告警（buy_pre 与主判定口径不一致）");
      }
      return didPlant;
    })
    .catch(function (e) {
      log("🪣 放养失败: " + e);
      return false;
    });
}

function refreshFishContext(base, cookie, ctx) {
  if (!ctx || !ctx.sid || !ctx.g_ut) return Promise.resolve();
  var url = base + "/nc/cgi-bin/wap_farm_fish_index?sid=" + ctx.sid + "&g_ut=" + ctx.g_ut;
  return fishGet(url, cookie).then(function (html) {
    ctx.indexHtml = html || ctx.indexHtml;
    ctx.indices = extractFishFertilizeIndices(html);
    ctx.harvestLinks = extractFishHarvestLinks(html);
    ctx.fishStatus = parseFishStatus(html);
    ctx.emptyPonds = extractFishEmptyPonds(html);
    ctx.hasFeedEntry =
      (html || "").indexOf("fish_fertilize") >= 0 ||
      (html || "").indexOf("喂鱼食") >= 0;
    return html;
  });
}

function sellFishAllOnce(base, cookie, ctx) {
  if (!CONFIG.ENABLE.fish_sell_all) return Promise.resolve(false);
  var repUrls = [
    base + "/nc/cgi-bin/wap_fish_rep_list?sid=" + ctx.sid + "&g_ut=" + ctx.g_ut,
    base +
      "/nc/cgi-bin/wap_fish_rep_list?sid=" +
      ctx.sid +
      "&g_ut=" +
      ctx.g_ut +
      "&page=1&buyway=0"
  ];
  function fetchIds(idx) {
    if (idx >= repUrls.length) return Promise.resolve([]);
    return fishGet(repUrls[idx], cookie)
      .then(function (html) {
        var ids = extractFishSaleIds(html);
        if (ids.length > 0) return ids;
        if (CONFIG.FISH_SELL_QUERY_FIRST && idx === 0) {
          var p = parsePageInfoFromText(html);
          if (p && p.total <= 1) {
            if (CONFIG.DEBUG) logDebug("🧺 鱼塘售卖: 仓库仅1页且无可售鱼，跳过翻页探测");
            return [];
          }
        }
        return fetchIds(idx + 1);
      })
      .catch(function () {
        return fetchIds(idx + 1);
      });
  }
  return fetchIds(0).then(function (ids) {
    if (ids.length === 0 && CONFIG.FISH_SELL_IDS) {
      ids = CONFIG.FISH_SELL_IDS.split(",")
        .map(function (s) {
          return s.trim();
        })
        .filter(Boolean);
    }
    if (ids.length === 0) {
      log("🧺 鱼塘售卖: 未发现可售鱼");
      return false;
    }
    var url =
      base +
      "/nc/cgi-bin/wap_fish_rep_sale?sid=" +
      ctx.sid +
      "&g_ut=" +
      ctx.g_ut +
      "&fIds=" +
      ids.join(",");
    return fishGet(url, cookie).then(function (html2) {
      var msg = extractMessage(html2);
      var money = parseMoneyFromMsg(msg);
      if (money > 0) MONEY_STATS.fishSell += money;
      if (msg) log("🧺 鱼塘售卖: " + msg);
      if (isSellSuccess(msg, html2)) {
        FISH_STATS.sell += 1;
        return true;
      }
      return false;
    });
  });
}

function execFishActions(base, cookie, ctx, opts) {
  opts = opts || {};
  var didFeed = false;
  var didBuy = false;
  var didPlant = false;
  var didHarvest = false;
  var didSell = false;
  var pass = opts.pass || 0;
  var fishJsonState = null;
  var fishJsonLoaded = false;

  function ensureFishJsonState(tag) {
    if (!CONFIG.FISH_JSON_INDEX_ENABLE) return Promise.resolve(null);
    if (fishJsonLoaded) return Promise.resolve(fishJsonState);
    fishJsonLoaded = true;
    return fetchFishIndexJsonState(cookie, tag).then(function (st) {
      fishJsonState = st || null;
      if (ctx) ctx.fishJsonState = fishJsonState;
      return fishJsonState;
    });
  }

  function invalidateFishJsonState() {
    fishJsonState = null;
    fishJsonLoaded = false;
    if (ctx) ctx.fishJsonState = null;
  }

  return Promise.resolve()
    .then(function () {
      if (!CONFIG.ENABLE.fish_feed) return;
      if (opts.skipFeed) return;
      return ensureFishFeedAvailable(cookie).then(function (allow) {
        if (!allow) return;
        return ensureFishJsonState("喂鱼预判").then(function (jsonState) {
          if (CONFIG.FISH_FEED_QUERY_FIRST && jsonState && Number(jsonState.feedable || 0) <= 0) {
            FISH_FEED_NOOP_SEEN = true;
            log("🐟 喂鱼: JSON预判无可喂鱼，跳过");
            return;
          }
        var hasFeedEntry =
          (ctx.indices && ctx.indices.length > 0) ||
          ctx.hasFeedEntry ||
          (ctx.indexHtml && ctx.indexHtml.indexOf("fish_fertilize") >= 0) ||
          (ctx.indexHtml && ctx.indexHtml.indexOf("喂鱼食") >= 0);
        if (!hasFeedEntry) {
          log("🐟 喂鱼: 未发现可喂入口(可能无鱼食/无鱼)");
          return;
        }
        var fishStatusList =
          (ctx.fishStatus && ctx.fishStatus.length > 0 ? ctx.fishStatus : parseFishStatus(ctx.indexHtml || "")) || [];
        ctx.fishStatus = fishStatusList;
        if (CONFIG.FISH_FEED_QUERY_FIRST && !jsonState && shouldSkipFishFeedByStatus(fishStatusList)) {
          FISH_FEED_NOOP_SEEN = true;
          log("🐟 喂鱼: 状态预判当前阶段不可喂，跳过");
          return;
        }
        if (CONFIG.FISH_USE_ONEKEY_FEED) {
          var url =
            base +
            "/nc/cgi-bin/wap_farm_fish_fertilize?sid=" +
            ctx.sid +
            "&g_ut=" +
            ctx.g_ut +
            "&index=-1";
          return fishGet(url, cookie).then(function (html) {
            var msg = extractMessage(html);
            var noop = isFishFeedNoopText(msg, html);
            if (noop) log("🐟 喂鱼: 当前阶段不可喂，跳过(点券鱼苗/无可喂鱼)");
            else if (msg) log("🐟 喂鱼: " + msg);
            trackFishFeedUsage(html);
            var feedCount = parseFishFeedPondCount(msg || html) || 1;
            if (isFeedSuccess(msg, html)) {
              FISH_STATS.feed += feedCount;
              didFeed = true;
              FISH_FEED_NOOP_SEEN = false;
              invalidateFishJsonState();
              if (BAG_STATS.fishFeed) BAG_STATS.fishFeed.loaded = false;
            } else if (noop) {
              FISH_FEED_NOOP_SEEN = true;
              logDebug("🐟 喂鱼: 当前无可喂鱼，后续复查将跳过喂鱼");
            }
            var spend = parseSpendFromMsg(stripTags(html || ""));
            if (spend > 0 && !CONFIG.FISH_FEED_ALLOW_SPEND) {
              log("⚠️ 喂鱼触发花费(" + spend + "金币)，已记录为异常");
              FISH_STATS.errors += 1;
            }
          });
        }
        if (!ctx.indices || ctx.indices.length === 0) {
          log("🐟 喂鱼: 未发现可喂鱼位");
          return;
        }
        var i = 0;
        function next() {
          if (i >= ctx.indices.length) return Promise.resolve();
          var idx = ctx.indices[i++];
          var url =
            base +
            "/nc/cgi-bin/wap_farm_fish_fertilize?sid=" +
            ctx.sid +
            "&g_ut=" +
            ctx.g_ut +
            "&index=" +
            idx;
          return fishGet(url, cookie)
            .then(function (html) {
              var msg = extractMessage(html);
              var noop = isFishFeedNoopText(msg, html);
              if (noop) log("🐟 喂鱼: 当前阶段不可喂，跳过(点券鱼苗/无可喂鱼)");
              else if (msg) log("🐟 喂鱼: " + msg);
              trackFishFeedUsage(html);
              if (isFeedSuccess(msg, html)) {
                FISH_STATS.feed += 1;
                didFeed = true;
                FISH_FEED_NOOP_SEEN = false;
                invalidateFishJsonState();
                if (BAG_STATS.fishFeed) BAG_STATS.fishFeed.loaded = false;
              } else if (noop) {
                FISH_FEED_NOOP_SEEN = true;
                logDebug("🐟 喂鱼: 当前无可喂鱼，后续复查将跳过喂鱼");
              }
              var spend = parseSpendFromMsg(stripTags(html || ""));
              if (spend > 0 && !CONFIG.FISH_FEED_ALLOW_SPEND) {
                log("⚠️ 喂鱼触发花费(" + spend + "金币)，已记录为异常");
                FISH_STATS.errors += 1;
              }
            })
            .then(function () {
              return sleep(CONFIG.WAIT_MS);
            })
            .then(next);
        }
        return next();
        });
      });
    })
    .then(function () {
      if (!didFeed) return;
      return refreshFishContext(base, cookie, ctx);
    })
    .then(function () {
      if (!CONFIG.ENABLE.fish_harvest) return;
      if (opts.skipHarvest) return;
      return ensureFishJsonState("收获预判").then(function (jsonState) {
        if (
          CONFIG.FISH_HARVEST_QUERY_JSON_FIRST &&
          jsonState &&
          Number(jsonState.harvestable || 0) <= 0
        ) {
          if (CONFIG.DEBUG) logDebug("🎣 收获: JSON预判无可收，跳过");
          return;
        }
        var indexParam = extractFishHarvestIndex(ctx.indexHtml || "");
        var links = ctx.harvestLinks || [];
        if (!links || links.length === 0) links = extractFishHarvestLinks(ctx.indexHtml || "");
        if (
          (!indexParam || indexParam === "") &&
          jsonState &&
          jsonState.harvestIndices &&
          jsonState.harvestIndices.length > 0
        ) {
          indexParam = jsonState.harvestIndices.join(",");
          if (CONFIG.DEBUG) logDebug("🎣 收获: 使用JSON可收索引 " + indexParam);
        }

        function doHarvestByLinks(hlinks) {
          if (!hlinks || hlinks.length === 0) {
            log("🎣 收获: 未发现可收获入口");
            return Promise.resolve();
          }
          var i = 0;
          function next() {
            if (i >= hlinks.length) return Promise.resolve();
            var link = hlinks[i++];
            var url = link.indexOf("http") === 0 ? link : base + "/nc/cgi-bin/" + link.replace(/^\.?\//, "");
            return fishGet(url, cookie)
              .then(function (html) {
                var msg = extractMessage(html);
                if (msg) log("🎣 收获: " + msg);
                if (isSuccessMsg(msg)) {
                  var hc = parseFishHarvestCountFromMsg(msg || html) || 1;
                  FISH_STATS.harvest += hc;
                  didHarvest = true;
                  invalidateFishJsonState();
                }
              })
              .then(function () {
                return sleep(CONFIG.WAIT_MS);
              })
              .then(next);
          }
          return next();
        }

        function doHarvestNow() {
          if (indexParam) {
            var url =
              base +
              "/nc/cgi-bin/wap_farm_fish_harvest?sid=" +
              ctx.sid +
              "&g_ut=" +
              ctx.g_ut +
              "&index=" +
              indexParam +
              "&flag=2&time=-2147483648";
            return fishGet(url, cookie)
              .then(function (html) {
                var msg = extractMessage(html);
                if (msg) log("🎣 收获: " + msg);
                if (isSuccessMsg(msg)) {
                  var hc =
                    parseFishHarvestCountFromMsg(msg || html) ||
                    countCommaList(indexParam) ||
                    1;
                  FISH_STATS.harvest += hc;
                  didHarvest = true;
                  invalidateFishJsonState();
                  return true; // one-key harvest ok
                }
                return false;
              })
              .then(function (ok) {
                // One-key harvest succeeded => do not harvest again by per-pond links.
                if (ok) return;
                return doHarvestByLinks(links);
              });
          }
          return doHarvestByLinks(links);
        }

        if (!indexParam && (!links || links.length === 0)) {
          // 兜底再拉一次首页（避免旧页面缺入口）
          return fishGet(base + "/nc/cgi-bin/wap_farm_fish_index?sid=" + ctx.sid + "&g_ut=" + ctx.g_ut, cookie)
            .then(function (htmlRetry) {
              ctx.indexHtml = htmlRetry;
              indexParam = extractFishHarvestIndex(htmlRetry || "");
              links = extractFishHarvestLinks(htmlRetry || "");
              return doHarvestNow();
            });
        }
        return doHarvestNow();
      });
    })
    .then(function () {
      if (!CONFIG.FISH_AUTO_PLANT) return;
      if (opts.skipPlant) return;
      return autoPlantFishFromBag(base, cookie, ctx).then(function (planted) {
        if (planted) {
          didPlant = true;
          invalidateFishJsonState();
          BAG_STATS.fish = { total: 0, items: [] };
        }
      });
    })
    .then(function () {
      if (opts.skipSell) return;
      return sellFishAllOnce(base, cookie, ctx).then(function (ok) {
        if (ok) didSell = true;
      });
    })
    .then(function () {
      if (!CONFIG.FISH_AUTO_BUY) return;
      if (opts.skipBuy) return;
      var sid = ctx.sid;
      var g_ut = ctx.g_ut;
      var listUrl = base + "/nc/cgi-bin/wap_fish_list_new?sid=" + sid + "&g_ut=" + g_ut + "&buyway=0";
      var listUrl2 = listUrl;
      var needNum = 0;
      var seedTotal = 0;

      function pickTopChoice(html) {
        var opts = extractFishBuyOptions(html);
        if (opts.length > 0) return opts[0];
        var fids = extractFishBuyFids(html);
        if (fids.length > 0) return { fid: fids[0], name: "" };
        return null;
      }

      function pickFromList() {
        return fishGet(listUrl, cookie)
          .then(function (html) {
            var choice = pickTopChoice(html);
            if (choice) return choice;
            return fishGet(listUrl2, cookie).then(function (html2) {
              return pickTopChoice(html2);
            });
          })
          .catch(function () {
            return fishGet(listUrl2, cookie).then(function (html2) {
              return pickTopChoice(html2);
            });
          });
      }

      function doBuyOnce() {
        var moneyShort = false;
        var snapEmpty =
          ctx && ctx.emptyPonds !== null && ctx.emptyPonds !== undefined
            ? ctx.emptyPonds
            : ctx && ctx.indexHtml
              ? extractFishEmptyPonds(ctx.indexHtml)
              : null;
        return ensureFishJsonState("买鱼预判")
          .then(function (jsonState) {
            if (
              CONFIG.FISH_BUY_QUERY_FIRST &&
              jsonState &&
              jsonState.empty !== null &&
              jsonState.empty !== undefined
            ) {
              snapEmpty = Number(jsonState.empty);
              if (isNaN(snapEmpty) || snapEmpty < 0) snapEmpty = 0;
            }
            return ensureFishSeedTotal(cookie);
          })
          .then(function (total) {
            seedTotal = total || 0;
            var target = CONFIG.FISH_MIN_SEED || 0;
            if (target > 0 && seedTotal >= target && CONFIG.LOG_BAG_STATS) {
              log("🎒 鱼苗充足: " + seedTotal + " (目标≥" + target + ")");
            }
            if (target > 0) {
              needNum = Math.max(target - seedTotal, 0);
            } else {
              needNum = CONFIG.FISH_BUY_NUM || 0;
            }
            if (CONFIG.FISH_BUY_QUERY_FIRST) {
              var preNeed = calcFishBuyNeed(seedTotal, snapEmpty);
              if (preNeed <= 0) {
                if (snapEmpty !== null && snapEmpty !== undefined) {
                  if (snapEmpty > 0) {
                    log("🧾 买鱼: 空池塘=" + snapEmpty + "，背包鱼苗已覆盖，无需购买");
                  } else if (target > 0) {
                    log("🧾 买鱼: 空池塘=0，已达到目标 " + target);
                  } else {
                    log("🧾 买鱼: 空池塘=0，无需购买");
                  }
                } else if (target > 0 && needNum <= 0) {
                  log("🧾 买鱼: 已达到目标 " + target);
                } else {
                  log("🧾 买鱼: 无需购买");
                }
                return null;
              }
            }
            return pickFromList();
          })
          .then(function (choice) {
            if (!choice) return;
            var fid = choice.fid;
            if (!fid) {
              log("🧾 买鱼: 未发现可购买鱼苗入口");
              return;
            }
            var preUrl =
              base + "/nc/cgi-bin/wap_fish_buy_pre_new?sid=" + sid + "&g_ut=" + g_ut + "&fid=" + fid + "&buyway=0";
            return fishGet(preUrl, cookie).then(function (html) {
              var maxBuy = extractFishMaxBuy(html);
              var empty = extractFishEmptyPonds(html);
              if ((empty === null || empty === undefined) && snapEmpty !== null && snapEmpty !== undefined) {
                empty = snapEmpty;
              }
              var fishName = extractFishNameFromPre(html);
              var target = CONFIG.FISH_MIN_SEED || 0;
              if (maxBuy === 0 && isMoneyShortText(stripTags(html || ""))) {
                NO_MONEY.fishSeed = true;
                moneyShort = true;
                log("🧾 买鱼: 金币不足，无法购买");
                return;
              }
              var buyNum = calcFishBuyNeed(seedTotal, empty);
              if (empty !== null && empty !== undefined && buyNum > 0) {
                if (empty > 0) log("🧾 买鱼: 空池塘=" + empty + "，需补鱼苗 " + buyNum);
                else if (target > 0) log("🧾 买鱼: 空池塘=0，按库存目标补至 " + target);
              }
              if (buyNum <= 0) {
                if (empty !== null && empty !== undefined && empty > 0) {
                  log("🧾 买鱼: 空池塘=" + empty + "，背包鱼苗已覆盖，无需购买");
                } else if (target > 0) {
                  log("🧾 买鱼: 已达到目标 " + target);
                } else {
                  log("🧾 买鱼: 无需购买");
                }
                return;
              }
              if (maxBuy && buyNum > maxBuy) buyNum = maxBuy;
              if (buyNum <= 0) {
                log("🧾 买鱼: 无可购买数量");
                return;
              }
              if (empty === 0) {
                log("🧾 买鱼: 空池塘=0" + (target > 0 ? "，按库存目标补至 " + target : ""));
              }
              var url = base + "/nc/cgi-bin/wap_fish_buy_new?sid=" + sid + "&g_ut=" + g_ut + "&buyway=0";
              var body = "num=" + buyNum + "&fid=" + fid + "&sb=" + encodeURIComponent("确定");
              var headers = buildRanchHeaders(cookie, preUrl);
              headers["Content-Type"] = "application/x-www-form-urlencoded";
              return httpRequest({ method: "POST", url: url, headers: headers, body: body }).then(function (resp2) {
                var html2 = resp2.body || "";
                var msg = extractMessage(html2);
                if (msg) log("🧾 买鱼: " + msg + (target > 0 ? " (补足至 " + target + ")" : ""));
                else log("🧾 买鱼: 已提交 " + buyNum + " 条");
                if (isMoneyShortText(msg || html2)) {
                  NO_MONEY.fishSeed = true;
                  moneyShort = true;
                }
                if (!/(对不起|没有足够|无法|不足|失败|未满足|输入有误|系统繁忙|稍候)/.test(msg || "")) {
                  FISH_STATS.buy += buyNum;
                  didBuy = true;
                  BAG_STATS.fish = { total: 0, items: [] };
                  var spend = parseSpendFromMsg(msg);
                  if (spend > 0) {
                    MONEY_STATS.fishBuy += spend;
                    PURCHASE_LOGS.push({
                      name: fishName || ("鱼苗#" + fid),
                      count: buyNum,
                      cost: spend
                    });
                  }
                }
              });
            });
          })
          .catch(function (e) {
            log("🧾 买鱼失败: " + e);
          })
          .then(function () {
            return { moneyShort: moneyShort };
          });
      }

      return doBuyOnce().then(function (ret) {
        if (!ret || !ret.moneyShort) return;
        if (didSell || opts.skipSell) return;
        log("🧾 买鱼: 金币不足，尝试先售卖补金币");
        return sellFishAllOnce(base, cookie, ctx).then(function (ok) {
          if (!ok) return;
          didSell = true;
          NO_MONEY.fishSeed = false;
          return doBuyOnce();
        });
      });
    })
    .then(function () {
      if (!didBuy) return;
      if (!CONFIG.FISH_AUTO_PLANT || opts.skipPlant) return;
      return autoPlantFishFromBag(base, cookie, ctx).then(function (planted) {
        if (planted) {
          didPlant = true;
          invalidateFishJsonState();
          BAG_STATS.fish = { total: 0, items: [] };
        }
      });
    })
    .then(function () {
      if (opts.cleanup === false) return;
      invalidateFishJsonState();
      return refreshFishContext(base, cookie, ctx).then(function () {
        return ensureFishJsonState("复查预判");
      }).then(function (jsonState) {
        var html = ctx.indexHtml || "";
        var hasFeed =
          (ctx.indices && ctx.indices.length > 0) ||
          ctx.hasFeedEntry ||
          html.indexOf("fish_fertilize") >= 0 ||
          html.indexOf("喂鱼食") >= 0;
        var hasHarvest =
          !!extractFishHarvestIndex(html) ||
          (ctx.harvestLinks && ctx.harvestLinks.length > 0);
        var statusList =
          (ctx.fishStatus && ctx.fishStatus.length > 0 ? ctx.fishStatus : parseFishStatus(html)) || [];
        ctx.fishStatus = statusList;
        var feedBlockedByStatus =
          CONFIG.FISH_FEED_QUERY_FIRST && !jsonState && shouldSkipFishFeedByStatus(statusList);
        var empty = extractFishEmptyPonds(html);
        if (jsonState && jsonState.empty !== null && jsonState.empty !== undefined) {
          empty = Number(jsonState.empty);
          if (isNaN(empty) || empty < 0) empty = 0;
        }
        var hasEmpty = empty && empty > 0;
        if (!hasEmpty && html.indexOf("一键养殖") >= 0) hasEmpty = true;
        if (!hasEmpty && html.indexOf("空池塘") >= 0) hasEmpty = true;
        if (jsonState) hasEmpty = Number(jsonState.empty || 0) > 0;

        var feedPossible = false;
        if (jsonState && CONFIG.FISH_FEED_QUERY_FIRST) {
          feedPossible =
            hasFeed &&
            CONFIG.ENABLE.fish_feed &&
            Number(jsonState.feedable || 0) > 0 &&
            !FISH_FEED_NOOP_SEEN &&
            (CONFIG.FISH_FEED_ALLOW_SPEND || !FISH_FEED_EMPTY_SEEN);
        } else {
          feedPossible =
            hasFeed &&
            CONFIG.ENABLE.fish_feed &&
            !feedBlockedByStatus &&
            !FISH_FEED_NOOP_SEEN &&
            (CONFIG.FISH_FEED_ALLOW_SPEND || !FISH_FEED_EMPTY_SEEN);
        }
        var fishSeedTotal = BAG_STATS.fish ? BAG_STATS.fish.total || 0 : 0;
        var emptyPossible =
          hasEmpty &&
          CONFIG.FISH_AUTO_PLANT &&
          (fishSeedTotal > 0 || (CONFIG.FISH_AUTO_BUY && !NO_MONEY.fishSeed));
        var harvestPossible = false;
        if (jsonState && CONFIG.FISH_HARVEST_QUERY_JSON_FIRST) {
          harvestPossible = CONFIG.ENABLE.fish_harvest && Number(jsonState.harvestable || 0) > 0;
        } else {
          harvestPossible = hasHarvest && CONFIG.ENABLE.fish_harvest;
        }
        if (!feedPossible && !harvestPossible && !emptyPossible) return;

        var stateKey = [
          feedPossible ? 1 : 0,
          harvestPossible ? 1 : 0,
          emptyPossible ? 1 : 0,
          empty === null || empty === undefined ? "n" : empty,
          jsonState ? Number(jsonState.feedable || 0) : "n",
          jsonState ? Number(jsonState.harvestable || 0) : "n",
          extractFishHarvestIndex(html) || "",
          (ctx.indices || []).join(","),
          (ctx.harvestLinks || []).length
        ].join("|");
        var lastKey = opts._stateKey || "";
        var seenKeys = opts._seenKeys || {};
        if (lastKey && stateKey === lastKey) {
          log("🐟 复查: 状态未变化，停止复查");
          return;
        }
        if (stateKey && seenKeys[stateKey]) {
          log("🐟 复查: 状态重复，停止复查");
          return;
        }
        if (stateKey) seenKeys[stateKey] = true;
        var maxPass = CONFIG.FISH_CLEANUP_MAX_PASS || 0;
        if (maxPass > 0 && pass >= maxPass) {
          log("🐟 复查: 已达安全上限，停止复查");
          return;
        }
        log("🐟 复查: 仍有可操作入口，继续处理");
        return execFishActions(base, cookie, ctx, {
          skipFeed: !feedPossible,
          skipHarvest: !harvestPossible,
          skipPlant: !emptyPossible,
          skipBuy: !emptyPossible,
          pass: pass + 1,
          _stateKey: stateKey,
          _seenKeys: seenKeys
        });
      });
    })
    .catch(function (e) {
      FISH_STATS.errors += 1;
      log("⚠️ 鱼塘任务失败: " + e);
    });
}

/* =======================
 *  RANCH MODE (牧场)
 * ======================= */
function inferSceneLabel(url) {
  var u = String(url || "").toLowerCase();
  if (u.indexOf("/nc/cgi-bin/wap_fish_") >= 0) return "鱼塘";
  if (u.indexOf("/nc/cgi-bin/wap_farm_fish_") >= 0) return "鱼塘";
  if (u.indexOf("/mc/cgi-bin/wap_pasture_") >= 0) return "牧场";
  if (u.indexOf("/nc/cgi-bin/wap_farm_") >= 0) return "农场";
  if (u.indexOf("/mc/cgi-bin/") >= 0) return "牧场";
  if (u.indexOf("/nc/cgi-bin/") >= 0) return "农场";
  return "请求";
}

function ranchGet(url, cookie, label) {
  var target = normalizeMcappUrl(url);
  var scene = label || inferSceneLabel(target);
  var activeCookie = preferRicherCookie(cookie, LAST_RANCH_COOKIE);
  return getHtmlFollow(target, activeCookie, null, scene, 0).then(function (resp) {
    if (resp && resp.cookie) LAST_RANCH_COOKIE = preferRicherCookie(resp.cookie, LAST_RANCH_COOKIE);
    logDebug(scene + "响应 " + (resp && resp.body ? resp.body.length : 0));
    return (resp && resp.body) || "";
  });
}

function probeGrassFruitFromFeedPre(base, cookie, ctx, label, stage) {
  if (!ctx || !ctx.sid || !ctx.g_ut) return Promise.resolve(null);
  var food = ctx.food || (ctx.foods && ctx.foods[0]) || "0";
  var random = Math.floor(Math.random() * 900000 + 100000);
  var url =
    base +
    "/mc/cgi-bin/wap_pasture_feed_pre?sid=" +
    ctx.sid +
    "&food=" +
    food +
    "&B_UID=" +
    (ctx.B_UID || "") +
    "&g_ut=" +
    ctx.g_ut +
    "&lv=" +
    (ctx.lv || "") +
    "&money=" +
    (ctx.money || "") +
    "&random=" +
    random;
  return ranchGet(url, cookie)
    .then(function (html) {
      var info = parseFeedPreInfo(html || "");
      if (ctx) {
        ctx._feedInfo = {
          total: info.total !== null && !isNaN(info.total) ? info.total : null,
          n: info.n !== null && !isNaN(info.n) ? info.n : null,
          cap: info.cap && !isNaN(info.cap) ? info.cap : null
        };
      }
      if (stage) updateRanchFeedState(stage, ctx && ctx._feedInfo ? ctx._feedInfo : info);
      var tag = label ? "(" + label + ")" : "";
      if (info.n !== null && info.n !== undefined && info.cap) {
        log("🌿 饲料槽" + tag + ": " + info.n + "/" + info.cap);
      }
      if (info.total === null || isNaN(info.total)) return null;
      LAST_GRASS_COUNT = info.total;
      log("🌿 牧草果实" + tag + ": " + info.total);
      return info.total;
    })
    .catch(function (e) {
      log("🌿 牧草果实探测失败: " + e);
      return null;
    });
}

function probeRanchGrassFromBag(base, cookie, ctx, label) {
  var sid = (ctx && ctx.sid) || CONFIG.RANCH_SID;
  var g_ut = (ctx && ctx.g_ut) || CONFIG.RANCH_G_UT;
  var bagUrl = base + "/mc/cgi-bin/wap_pasture_bag_list?sid=" + sid + "&g_ut=" + g_ut;
  return ranchGet(bagUrl, cookie)
    .then(function (bagHtml) {
      var count = parseGrassCount(bagHtml);
      LAST_GRASS_COUNT = count;
      var tag = label ? "(" + label + ")" : "";
      if (count === null) log("🌿 牧草果实" + tag + ": 未知");
      else log("🌿 牧草果实" + tag + ": " + count);
      return count;
    })
    .catch(function (e) {
      LAST_GRASS_COUNT = null;
      log("🌿 牧草预判失败: " + e);
      return null;
    });
}

function pickGrassFromCropItems(items) {
  if (!items || items.length === 0) return null;
  var cid = String(CONFIG.FARM_GRASS_SEED_ID || "40");
  for (var i = 0; i < items.length; i++) {
    var it = items[i] || {};
    var icid = it.cid != null ? String(it.cid) : it.cId != null ? String(it.cId) : "";
    if (icid && icid === cid) {
      var a = Number(it.amount || it.num || it.count || 0);
      if (isNaN(a)) a = 0;
      return { amount: a, isLock: !!it.isLock };
    }
  }
  // 兜底：名称包含“牧草”
  for (var j = 0; j < items.length; j++) {
    var it2 = items[j] || {};
    var name = normalizeSpace(it2.name || it2.cName || "");
    if (name && name.indexOf("牧草") >= 0) {
      var a2 = Number(it2.amount || it2.num || it2.count || 0);
      if (isNaN(a2)) a2 = 0;
      return { amount: a2, isLock: !!it2.isLock };
    }
  }
  return null;
}

function probeGrassFruitFromFarmWarehouseJson(cookie, label) {
  return fetchFarmCropJson(cookie).then(function (res) {
    if (!res || !res.ok || !res.items) return null;
    var hit = pickGrassFromCropItems(res.items);
    if (!hit) return null;
    var amt = Number(hit.amount || 0);
    if (isNaN(amt)) return null;
    LAST_GRASS_COUNT = amt;
    var tag = label ? "(" + label + ")" : "";
    log("🌿 牧草果实" + tag + ": " + amt);
    return amt;
  }).catch(function () {
    return null;
  });
}

function probeGrassFruitFromFarmWarehouseWap(cookie, label) {
  return fetchFarmWarehouseGrass(cookie).then(function (count) {
    if (count === null || count === undefined) return null;
    var n = Number(count);
    if (isNaN(n)) return null;
    LAST_GRASS_COUNT = n;
    var tag = label ? "(" + label + ")" : "";
    log("🌿 牧草果实" + tag + ": " + n);
    return n;
  });
}

function probeGrassFruitFromFarmWarehouse(cookie) {
  // 优先 JSON 仓库（无需翻页）；失败再回退 WAP 仓库（可能翻页）
  return probeGrassFruitFromFarmWarehouseJson(cookie, "农场仓库JSON").then(function (count) {
    if (count !== null && count !== undefined) return count;
    return probeGrassFruitFromFarmWarehouseWap(cookie, "农场仓库WAP");
  });
}

function probeRanchGrass(cookie) {
  var base = CONFIG.RANCH_BASE;
  if (LAST_RANCH && LAST_RANCH.sid && LAST_RANCH.g_ut) {
    return probeGrassFruitFromFeedPre(base, cookie, LAST_RANCH, "预判").then(function (count) {
      if (count !== null && count !== undefined) return count;
      return probeGrassFruitFromFarmWarehouse(cookie).then(function (count2) {
        if (count2 !== null && count2 !== undefined) return count2;
        return probeRanchGrassFromBag(base, cookie, LAST_RANCH, "页面预判");
      });
    });
  }
  var sid = CONFIG.RANCH_SID;
  var g_ut = CONFIG.RANCH_G_UT;
  var indexUrl = base + "/mc/cgi-bin/wap_pasture_index?sid=" + sid + "&g_ut=" + g_ut;
  return ranchGet(indexUrl, cookie)
    .then(function (html) {
      var ctx = extractRanchContext(html);
      ctx.sid = ctx.sid || sid;
      ctx.g_ut = ctx.g_ut || g_ut;
      ctx.food = CONFIG.RANCH_FOOD || extractFoodId(html) || "";
      return probeGrassFruitFromFeedPre(base, cookie, ctx, "预判").then(function (count) {
        if (count !== null && count !== undefined) return count;
        return probeGrassFruitFromFarmWarehouse(cookie).then(function (count2) {
          if (count2 !== null && count2 !== undefined) return count2;
          return probeRanchGrassFromBag(base, cookie, ctx, "页面预判");
        });
      });
    })
    .catch(function (e) {
      LAST_GRASS_COUNT = null;
      log("🌿 牧草预判失败: " + e);
      return null;
    });
}

function recheckGrassAfterFeed(cookie) {
  return probeRanchGrass(cookie).then(function (count) {
    markGrassLow(count, "喂草");
    return count;
  });
}

function ranchSignIn(base, cookie, ctx) {
  if (!CONFIG.ENABLE.ranch_signin) return Promise.resolve();

  function ensureHome() {
    if (LAST_RANCH_HOME_HTML) return Promise.resolve({ html: LAST_RANCH_HOME_HTML, cookie: cookie });
    var homeUrl = base + "/mc/cgi-bin/wap_pasture_index?sid=" + ctx.sid + "&g_ut=" + ctx.g_ut;
    return getHtmlFollow(homeUrl, cookie, null, "牧场签到探测", 0).then(function (resp) {
      LAST_RANCH_HOME_HTML = resp.body || "";
      return { html: LAST_RANCH_HOME_HTML, cookie: resp.cookie || cookie };
    });
  }

  return ensureHome().then(function (res) {
    var html = (res && res.html) || "";
    var ck = (res && res.cookie) || cookie;
    if (!hasSignInEntry(html)) {
      log("📅 牧场签到: 页面无入口，跳过");
      return;
    }
    var url =
      base +
      "/mc/cgi-bin/wap_pasture_index?sid=" +
      ctx.sid +
      "&g_ut=" +
      ctx.g_ut +
      "&signin=1&optflag=2&pid=0&v=1";
    return getHtmlFollow(url, ck, defaultMcappReferer(), "牧场签到", 0).then(function (resp) {
      var html2 = resp.body || "";
      var msg = extractSignInReward(html2);
      if (msg) log("📅 牧场签到: " + msg);
      if (resp.status === 200) RANCH_STATS.signin += 1;
    });
  });
}

function ranchSellAll(base, cookie, ctx) {
  if (!CONFIG.ENABLE.ranch_sell_all) return Promise.resolve();
  var maxRetry = Math.max(0, Number(CONFIG.RETRY_502 || 0));
  var verifyRep = !!CONFIG.RANCH_SELL_VERIFY_REP;
  var step1 =
    base +
    "/mc/cgi-bin/wap_pasture_rep_sale?&saleAll=1&step=1&sid=" +
    ctx.sid +
    "&g_ut=" +
    ctx.g_ut;
  var step2Direct =
    base +
    "/mc/cgi-bin/wap_pasture_rep_sale?saleAll=1&step=2&sid=" +
    ctx.sid +
    "&g_ut=" +
    ctx.g_ut;

  function loadStep1(attempt) {
    return ranchGet(step1, cookie).then(function (html) {
      var text = normalizeSpace(extractMessage(html) || stripTags(html || ""));
      var transient = isTransientFailText(text);
      if (transient && attempt < maxRetry) {
        log("⚠️ 牧场售卖(step1): 系统繁忙，第" + (attempt + 1) + "次重试");
        return sleep(CONFIG.RETRY_WAIT_MS || 800).then(function () {
          return loadStep1(attempt + 1);
        });
      }
      return { html: html, transient: transient, retries: attempt };
    });
  }

  function loadStep2(url, attempt) {
    return ranchGet(url, cookie).then(function (html2) {
      var msg2 = extractMessage(html2);
      var text2 = normalizeSpace(msg2 || stripTags(html2 || ""));
      var transient2 = isTransientFailText(text2);
      if (transient2 && attempt < maxRetry) {
        log("⚠️ 牧场售卖(step2): 系统繁忙，第" + (attempt + 1) + "次重试");
        return sleep(CONFIG.RETRY_WAIT_MS || 800).then(function () {
          return loadStep2(url, attempt + 1);
        });
      }
      return { html: html2, msg: msg2, text: text2, transient: transient2, retries: attempt };
    });
  }

  function parseStep2Result(ret2, source) {
    var html2 = (ret2 && ret2.html) || "";
    var msg = (ret2 && ret2.msg) || extractMessage(html2) || "";
    var text = (ret2 && ret2.text) || normalizeSpace(msg || stripTags(html2 || ""));
    var transient = !!(ret2 && ret2.transient);
    var money = parseMoneyFromMsg(msg || text);
    if (money <= 0) money = parseSellMoneyFromText(text);
    var success = isSellSuccess(msg, html2);
    var noop = /你共有0个|总价0金币|单价0金币/.test(text);
    return {
      source: source || "",
      html: html2,
      msg: msg,
      text: text,
      transient: transient,
      money: money > 0 ? money : 0,
      success: success,
      noop: noop
    };
  }

  function attemptDirectStep2() {
    return loadStep2(step2Direct, 0).then(function (ret2) {
      return parseStep2Result(ret2, "step2");
    });
  }

  function attemptByStep1() {
    return loadStep1(0).then(function (ret1) {
      var html = (ret1 && ret1.html) || "";
      var step1Transient = ret1 && ret1.transient;
      if (step1Transient) {
        log("⚠️ 牧场售卖(step1): 系统繁忙，继续尝试 step2");
      }
      var h = html.replace(/&amp;/g, "&");
      var link = firstMatch(h, /(wap_pasture_rep_sale[^\"\s>]*step=2[^\"\s>]*)/);
      if (!link) {
        link = "wap_pasture_rep_sale?saleAll=1&step=2&sid=" + ctx.sid + "&g_ut=" + ctx.g_ut;
      }
      var url = link.indexOf("http") === 0 ? link : base + "/mc/cgi-bin/" + link.replace(/^\.?\//, "");
      return loadStep2(url, 0).then(function (ret2) {
        return parseStep2Result(ret2, "step1->step2");
      });
    });
  }

  function finalizeSell(ret, preVal, postVal) {
    var out = ret || {};
    var soldByDiff = 0;
    if (verifyRep && preVal !== null && preVal !== undefined && postVal !== null && postVal !== undefined) {
      soldByDiff = Number(preVal) - Number(postVal);
      if (isNaN(soldByDiff) || soldByDiff < 0) soldByDiff = 0;
      if (CONFIG.DEBUG) {
        logDebug(
          "🧮 牧场售卖核对: 售前=" +
            preVal +
            " 售后=" +
            postVal +
            " Δ" +
            formatDelta(Number(postVal) - Number(preVal))
        );
      }
    }
    var money = Number(out.money || 0);
    if ((!money || money <= 0) && soldByDiff > 0) money = soldByDiff;
    if (money > 0) MONEY_STATS.ranchSell += money;

    var success = !!out.success;
    if (!success && soldByDiff > 0) success = true;
    if (
      verifyRep &&
      preVal !== null &&
      preVal !== undefined &&
      postVal !== null &&
      postVal !== undefined &&
      soldByDiff <= 0 &&
      money <= 0
    ) {
      success = false;
    }

    if (out.msg) log("🧺 牧场售卖: " + out.msg + (out.source ? " [" + out.source + "]" : ""));
    else if (success && money > 0) log("🧺 牧场售卖: 成功卖出，获得" + money + "金币");
    else if (out.noop || (preVal === 0 && postVal === 0)) log("🧺 牧场售卖: 仓库无可售产品");

    if (success) {
      RANCH_STATS.sell += 1;
      return;
    }
    if (out.transient) {
      RANCH_STATS.errors += 1;
      log("⚠️ 牧场售卖未完成: " + (out.msg || "系统繁忙，请稍后重试"));
    } else if (CONFIG.DEBUG && out.source) {
      logDebug("🧺 牧场售卖: 无成交 [" + out.source + "]");
    }
  }

  var preRepValue = null;
  var postRepValue = null;
  return Promise.resolve()
    .then(function () {
      if (!verifyRep) return null;
      return fetchRanchRepTotalValue(base, cookie, ctx, "售前");
    })
    .then(function (v) {
      preRepValue = v;
      if (verifyRep && preRepValue !== null && preRepValue !== undefined && preRepValue <= 0) {
        if (CONFIG.DEBUG) logDebug("🧺 牧场售卖: 售前总价值为0，跳过售卖请求");
        return { source: "precheck", success: false, noop: true, money: 0, msg: "", text: "", transient: false };
      }
      if (CONFIG.RANCH_SELL_STEP2_FIRST) return attemptDirectStep2();
      return attemptByStep1();
    })
    .then(function (directRet) {
      if (!CONFIG.RANCH_SELL_STEP2_FIRST) return directRet;
      if (directRet && directRet.success) return directRet;
      if (directRet && directRet.noop && preRepValue !== null && preRepValue !== undefined && preRepValue <= 0) {
        return directRet;
      }
      // step2 无法确认成交时，回退到传统 step1->step2 流程。
      return attemptByStep1().then(function (stepRet) {
        if (stepRet && stepRet.success) return stepRet;
        if (stepRet && stepRet.transient && directRet && !directRet.transient) return directRet;
        return stepRet || directRet;
      });
    })
    .then(function (finalRet) {
      if (!verifyRep) return { ret: finalRet, post: null };
      if (finalRet && finalRet.source === "precheck") {
        return { ret: finalRet, post: preRepValue };
      }
      return fetchRanchRepTotalValue(base, cookie, ctx, "售后").then(function (v2) {
        return { ret: finalRet, post: v2 };
      });
    })
    .then(function (pack) {
      postRepValue = pack && pack.post !== undefined ? pack.post : null;
      finalizeSell(pack && pack.ret, preRepValue, postRepValue);
    });
}

function refreshRanchContext(base, cookie, ctx) {
  if (!ctx || !ctx.sid || !ctx.g_ut) return Promise.resolve();
  var url = base + "/mc/cgi-bin/wap_pasture_index?sid=" + ctx.sid + "&g_ut=" + ctx.g_ut;
  return ranchGet(url, cookie).then(function (html) {
    updateRanchSlotState(ctx, html);
    ctx.harvestAllLink = extractRanchHarvestAllLink(html) || ctx.harvestAllLink || "";
    ctx.statusList = parseRanchStatus(html);
    ctx.helpLinks = extractHelpLinks(html);
    var food = extractFoodId(html);
    if (food) ctx.food = food;
    var pmeta = extractProductionMeta(html);
    ctx.productSerials = pmeta.serials || [];
    ctx.productBySerial = pmeta.bySerial || {};
    ctx.productOneKeyLink = pmeta.oneKeyLink || "";
    ctx._help = extractHelpParams(html) || ctx._help;
    return html;
  });
}

function runRanch(base, cookie) {
  log("🐮 牧场模块: 启动");
  var sid = CONFIG.RANCH_SID;
  var g_ut = CONFIG.RANCH_G_UT;
  var indexUrl = base + "/mc/cgi-bin/wap_pasture_index?sid=" + sid + "&g_ut=" + g_ut;
  return ranchGet(indexUrl, cookie)
    .then(function (html) {
      LAST_RANCH_HOME_HTML = html || "";
      if (!isRanchHome(html)) {
        log("⚠️ 牧场页面异常(" + (extractTitle(html) || "无标题") + ")");
      }
      var ctx = extractRanchContext(html);
      updateRanchSlotState(ctx, html);
      ctx.harvestAllLink = extractRanchHarvestAllLink(html) || "";
      ctx.statusList = parseRanchStatus(html);
      ctx.helpLinks = extractHelpLinks(html);
      ctx.sid = ctx.sid || sid;
      ctx.g_ut = ctx.g_ut || g_ut;
      ctx.food = CONFIG.RANCH_FOOD || extractFoodId(html) || "";
      var pmeta = extractProductionMeta(html);
      ctx.productSerials = pmeta.serials || [];
      ctx.productBySerial = pmeta.bySerial || {};
      ctx.productOneKeyLink = pmeta.oneKeyLink || "";
      if (!ctx.sid || !ctx.g_ut) {
        log("⚠️ 牧场参数缺失，可能未登录或 Cookie 失效");
        return { ok: false };
      }
      log(
        "🐮 牧场参数: sid=" +
          ctx.sid +
          " g_ut=" +
          ctx.g_ut +
          " B_UID=" +
          (ctx.B_UID || "-") +
          " lv=" +
          (ctx.lv || "-") +
          " money=" +
          (ctx.money || "-")
      );
      return probeGrassFruitFromFeedPre(base, cookie, ctx, "仓库", "start")
        .then(function (fruit) {
          if (fruit !== null && fruit !== undefined) {
            ctx.grassCount = fruit;
            LAST_GRASS_COUNT = fruit;
            return;
          }
          return probeGrassFruitFromFarmWarehouse(cookie).then(function (cnt2) {
            if (cnt2 !== null && cnt2 !== undefined) {
              ctx.grassCount = cnt2;
              return;
            }
          });
        })
        .then(function () {
          if (ctx.grassCount !== null && ctx.grassCount !== undefined) return;
          var bagUrl =
            base + "/mc/cgi-bin/wap_pasture_bag_list?sid=" + ctx.sid + "&g_ut=" + ctx.g_ut;
          return ranchGet(bagUrl, cookie).then(function (bagHtml) {
            updateRanchSlotState(ctx, bagHtml);
            ctx.grassCount = parseGrassCount(bagHtml);
            LAST_GRASS_COUNT = ctx.grassCount;
            if (ctx.grassCount === null) {
              log("🌿 牧草果实(页面预判): 未知");
            } else {
              log("🌿 牧草果实(页面预判): " + ctx.grassCount);
            }
          });
        })
        .then(function () {
          LAST_RANCH = ctx;
          return decidePlantSeed(cookie, ctx.grassCount)
            .then(function (seedId) {
              if (seedId) CONFIG.PLANT_CID = seedId;
            })
            .then(function () {
              return ranchSignIn(base, cookie, ctx);
            })
            .then(function () {
              if (
                CONFIG.FARM_BUY_GRASS_ON_EMPTY &&
                ctx.grassCount !== null &&
                ctx.grassCount < CONFIG.GRASS_THRESHOLD
              ) {
                var grassSeedCount = getBagItemCount("牧草");
                if (grassSeedCount > 0) {
                  if (ctx.grassCount <= 0) {
                    log("🌿 牧草果实为 0，但背包已有牧草种子×" + grassSeedCount + "，优先播种");
                    return plantGrassFromFarm(cookie);
                  }
                  return;
                }
                log(
                  "🌿 牧草果实不足(" +
                    ctx.grassCount +
                    "<" +
                    CONFIG.GRASS_THRESHOLD +
                    ")且无牧草种子，准备购买牧草种子"
                );
                return buyGrassSeed(cookie)
                  .then(function (ok) {
                    if (ok) return true;
                    if (NO_MONEY.grassSeed && CONFIG.ENABLE.farm_sell_all) {
                      log("🌿 买牧草种子: 金币不足，尝试先售卖补金币");
                      return farmSellAll(cookie)
                        .then(function () {
                          NO_MONEY.grassSeed = false;
                          return buyGrassSeed(cookie);
                        })
                        .then(function (ok2) {
                          return ok2;
                        });
                    }
                    return false;
                  })
                  .then(function (ok) {
                    if (ok && ctx.grassCount <= 0) return plantGrassFromFarm(cookie);
                  });
              }
            })
            .then(function () {
              return execRanchActions(base, cookie, ctx);
            })
            .then(function () {
              return ranchSellAll(base, cookie, ctx);
            });
        });
    })
    .then(function () {
      return { ok: true };
    })
    .catch(function (e) {
      RANCH_STATS.errors += 1;
      log("⚠️ 牧场模块异常: " + e);
      return { ok: false };
    });
}

function ranchFeedOnce(base, cookie, ctx, force) {
  if (!CONFIG.ENABLE.ranch_feed) return Promise.resolve(false);
  var food = ctx.food || (ctx.foods && ctx.foods[0]) || "0";
  var random = Math.floor(Math.random() * 900000 + 100000);
  var url =
    base +
    "/mc/cgi-bin/wap_pasture_feed_pre?sid=" +
    ctx.sid +
    "&food=" +
    food +
    "&B_UID=" +
    (ctx.B_UID || "") +
    "&g_ut=" +
    ctx.g_ut +
    "&lv=" +
    (ctx.lv || "") +
    "&money=" +
    (ctx.money || "") +
    "&random=" +
    random;
  return ranchGet(url, cookie)
    .then(function (html) {
      var info = parseFeedPreInfo(html || "");
      if (!info.B_UID) info.B_UID = ctx.B_UID || "";
      if (info.total !== null && !isNaN(info.total)) {
        ctx.grassCount = info.total;
        LAST_GRASS_COUNT = info.total;
      }
      if (info.total === null || isNaN(info.total)) info.total = ctx.grassCount || 0;
      if (info.n === null || isNaN(info.n)) info.n = 0;
      if (!info.cap || isNaN(info.cap)) info.cap = 1000;
      ctx._feedInfo = { total: info.total, n: info.n, cap: info.cap };
      updateRanchFeedState("end", ctx._feedInfo);
      var need = info.cap - info.n;
      if (need <= 0) {
        log("🌿 喂草: 饲料已满(" + info.n + "/" + info.cap + ")");
        return { ok: false, info: info };
      }
      if (!force && ctx.grassCount !== null && ctx.grassCount <= 0 && info.total <= 0) {
        log("🌿 喂草: 牧草果实为 0，跳过");
        return { ok: false, info: info };
      }
      if (info.total <= 0) {
        log("🌿 喂草: 仓库牧草果实为 0，跳过");
        return { ok: false, info: info };
      }
      var num = Math.min(info.total, need);
      log("🌿 喂草计算: 槽=" + info.n + "/" + info.cap + " 仓库=" + info.total + " 本次=" + num);
      if (num <= 0) return { ok: false, info: info };
      var action = extractFeedFormAction(html || "");
      var url2 = "";
      if (action && action.length) {
        if (action.indexOf("http") === 0) {
          url2 = action;
        } else {
          var cleanAction = action.replace(/^\.?\//, "");
          if (cleanAction.indexOf("mc/cgi-bin/") === 0 || cleanAction.indexOf("nc/cgi-bin/") === 0) {
            url2 = base + "/" + cleanAction;
          } else {
            url2 = base + "/mc/cgi-bin/" + cleanAction;
          }
        }
      } else {
        url2 =
          base +
          "/mc/cgi-bin/wap_pasture_feed_food?sid=" +
          ctx.sid +
          "&g_ut=" +
          ctx.g_ut +
          "&food=" +
          food;
      }
      var body =
        "B_UID=" +
        encodeURIComponent(info.B_UID || "") +
        "&total=" +
        encodeURIComponent(info.total) +
        "&n=" +
        encodeURIComponent(info.n) +
        "&num=" +
        encodeURIComponent(num);
      var headers = buildRanchHeaders(cookie, url);
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      return httpRequest({ method: "POST", url: url2, headers: headers, body: body }).then(function (resp) {
        var html2 = resp.body || "";
        var merged = mergeSetCookie(cookie, getHeader(resp.headers || {}, "set-cookie"));
        var loc = getHeader(resp.headers || {}, "location") || getHeader(resp.headers || {}, "Location");
        if (resp.status >= 300 && resp.status < 400 && loc) {
          var next = resolveUrl(url2, loc);
          return getHtmlFollow(next, merged, url2, "喂草跳转", 0).then(function (ret) {
            html2 = (ret && ret.body) || "";
            return { html: html2 };
          });
        }
        return { html: html2 };
      }).then(function (ret) {
        var html2 = ret && ret.html ? ret.html : "";
        var msg = extractMessage(html2);
        if (msg) log("🌿 喂草: " + msg);
        if (isFeedSuccess(msg, html2)) {
          var fc = parseRanchFeedCountFromMsg(msg || html2) || num || 1;
          RANCH_STATS.feed += fc;
          if (info && info.n !== null && !isNaN(info.n)) {
            var nextN = info.n + fc;
            if (info.cap && !isNaN(info.cap) && nextN > info.cap) nextN = info.cap;
            if (nextN < 0) nextN = 0;
            info.n = nextN;
            ctx.food = String(nextN);
          }
          if (info && info.total !== null && !isNaN(info.total)) {
            var left = info.total - fc;
            if (left < 0) left = 0;
            info.total = left;
          }
          ctx._feedInfo = { total: info.total, n: info.n, cap: info.cap };
          updateRanchFeedState("end", ctx._feedInfo);
          return { ok: true, info: info };
        }
        return { ok: false, info: info };
      });
    })
    .then(function (ret) {
      return ret && ret.ok === true;
    });
}

function ranchFeedUntilFull(base, cookie, ctx, force) {
  var seen = {};
  function loop() {
    return ranchFeedOnce(base, cookie, ctx, force).then(function (ok) {
      var info = ctx && ctx._feedInfo ? ctx._feedInfo : null;
      var key = info ? [info.total, info.n, info.cap].join("/") : "";
      if (key) {
        if (seen[key]) {
          log("🌿 喂草: 状态未变化，停止复查");
          return ok;
        }
        seen[key] = true;
      }
      if (!ok) return ok;
      return loop();
    });
  }
  return loop();
}

function execRanchActions(base, cookie, ctx, opts) {
  opts = opts || {};
  var didFeed = !!opts.feedDone;
  var didHarvestAfterProduct = false;

  function doFeed() {
    if (opts.skipFeed) return Promise.resolve();
    return ranchFeedUntilFull(base, cookie, ctx, false).then(function (ok) {
      if (ok) didFeed = true;
    });
  }

  function doProductList() {
    if (!CONFIG.ENABLE.ranch_product) return Promise.resolve();
    var list = ctx.productSerials && ctx.productSerials.length > 0 ? ctx.productSerials : [];
    var bySerial = ctx.productBySerial || {};
    var oneKeyLink = ctx.productOneKeyLink || "";
    if (!oneKeyLink && list.length === 0) {
      log("🥚 生产: 未发现可生产动物");
      return Promise.resolve();
    }
    var max = Math.min(CONFIG.RANCH_MAX_SERIAL || 6, list.length || 0);
    var produced = 0;
    var producedAny = false;

    function harvestAllAfterProduct() {
      if (!producedAny) return Promise.resolve();
      return sleep(16000).then(function () {
        var preRepSnap = null;
        return Promise.resolve()
          .then(function () {
            if (!CONFIG.RANCH_HARVEST_REP_INFER) return;
            return fetchRanchRepSnapshot(base, cookie, ctx, "收获前").then(function (snap) {
              preRepSnap = snap;
            });
          })
          .then(function () {
            var hurl = buildPastureUrl(base, ctx.harvestAllLink || "");
            if (!hurl) {
              hurl =
                base +
                "/mc/cgi-bin/wap_pasture_harvest?sid=" +
                ctx.sid +
                "&g_ut=" +
                ctx.g_ut +
                "&serial=-1&htype=3";
            }
            return ranchGet(hurl, cookie).then(function (html2) {
              updateRanchSlotState(ctx, html2);
              ctx.harvestAllLink = extractRanchHarvestAllLink(html2) || ctx.harvestAllLink || "";
              var beforeHarvest = ctx.statusList || [];
              var afterHarvest = parseRanchStatus(html2);
              if (afterHarvest.length > 0) ctx.statusList = afterHarvest;
              var msg2 = extractMessage(html2);
              if (msg2) log("🐮 收获: " + msg2);
              var inferPromise = Promise.resolve();
              if (isSuccessMsg(msg2)) {
                var hc2 = parseRanchHarvestCountFromMsg(msg2 || html2);
                if (hc2 > 0) RANCH_STATS.harvest += hc2;
                else {
                  var infer2 = inferRanchHarvestFromStatus(beforeHarvest, afterHarvest);
                  if (infer2.count > 0) {
                    RANCH_STATS.harvest += infer2.count;
                    log(
                      "🐮 收获(列表兜底): 推断" +
                        infer2.count +
                        "只" +
                        (infer2.detail ? " | " + infer2.detail : "")
                    );
                  } else if (CONFIG.RANCH_HARVEST_REP_INFER && preRepSnap) {
                    inferPromise = inferRanchHarvestFromRep(base, cookie, ctx, preRepSnap)
                      .then(function (repInfer) {
                        if (repInfer && repInfer.count > 0) {
                          RANCH_STATS.harvest += repInfer.count;
                          log(
                            "🐮 收获(仓库兜底): 推断" +
                              repInfer.count +
                              "项" +
                              (repInfer.detail ? " | " + repInfer.detail : "")
                          );
                          return;
                        }
                        RANCH_STATS.harvestUnknown += 1;
                        log("🐮 收获: 成功，但本次数量未知");
                      })
                      .catch(function () {
                        RANCH_STATS.harvestUnknown += 1;
                        log("🐮 收获: 成功，但本次数量未知");
                      });
                  } else {
                    RANCH_STATS.harvestUnknown += 1;
                    log("🐮 收获: 成功，但本次数量未知");
                  }
                }
                didHarvestAfterProduct = true;
              }
              ctx._help = extractHelpParams(html2) || ctx._help;
              var hlinks = extractHelpLinks(html2);
              if (hlinks.length) ctx.helpLinks = hlinks;
              return inferPromise;
            });
          });
      });
    }

    function runSerialBatch() {
      if (max <= 0) return Promise.resolve();
      var i = 0;
      function next() {
        if (i >= max) return Promise.resolve();
        var serial = list[i++];
        var url =
          base +
          "/mc/cgi-bin/wap_pasture_product?sid=" +
          ctx.sid +
          "&g_ut=" +
          ctx.g_ut +
          "&serial=" +
          serial +
          "&B_UID=" +
          (ctx.B_UID || "");
        return ranchGet(url, cookie)
          .then(function (html) {
            var rawMsg = extractMessage(html);
            var animal = bySerial[serial] || "";
            var msg = formatRanchProductMsg(rawMsg, animal);
            if (msg) {
              log("🥚 生产" + (animal ? "[" + animal + "#" + serial + "]" : "[#" + serial + "]") + ": " + msg);
            }
            var ok = isSuccessMsg(rawMsg || msg);
            if (ok) {
              producedAny = true;
              produced += 1;
              RANCH_STATS.product += 1;
            }
          })
          .then(function () {
            return sleep(CONFIG.WAIT_MS);
          })
          .then(next);
      }
      return next();
    }

    function tryOneKey() {
      if (!CONFIG.RANCH_TRY_ONEKEY_PRODUCT || !oneKeyLink) return Promise.resolve(false);
      var url = oneKeyLink.indexOf("http") === 0 ? oneKeyLink : base + "/mc/cgi-bin/" + oneKeyLink.replace(/^\.?\//, "");
      return ranchGet(url, cookie)
        .then(function (html) {
          var msg = extractMessage(html);
          if (msg && /成功将\s*赶去生产/.test(msg)) {
            msg = msg.replace(/成功将\s*赶去生产/, "成功将可生产动物赶去生产");
          }
          if (msg) log("🥚 一键生产: " + msg);
          var ok = isSuccessMsg(msg);
          if (!ok) return false;
          var cnt = parseRanchProductCountFromMsg(msg);
          if (cnt <= 0 && max > 0) cnt = max;
          if (cnt < 0) cnt = 0;
          producedAny = true;
          produced += cnt;
          if (cnt > 0) RANCH_STATS.product += cnt;
          else if (CONFIG.DEBUG) logDebug("🥚 一键生产: 成功但未解析到数量");
          return true;
        })
        .catch(function (e) {
          log("🥚 一键生产失败: " + e);
          return false;
        });
    }

    return tryOneKey()
      .then(function (ok) {
        if (ok) return;
        return runSerialBatch();
      })
      .then(harvestAllAfterProduct);
  }

  function doHarvestAllIfNeeded() {
    if (!CONFIG.ENABLE.ranch_harvest) return Promise.resolve();
    if (didHarvestAfterProduct) return Promise.resolve();
    var hasHarvestEntry = !!String((ctx && ctx.harvestAllLink) || "");
    if (ctx && ctx.statusList && ctx.statusList.length > 0) {
      var hs = summarizeRanchHarvestable(ctx.statusList);
      if (hs.total <= 0) {
        if (hasHarvestEntry) {
          if (CONFIG.DEBUG) logDebug("🐮 收获: 状态可收=0，但检测到一键收获入口，执行一次探测收获");
        } else if (CONFIG.DEBUG) {
          logDebug("🐮 收获: 状态预判无可收，执行一次探测收获");
        }
      }
    }
    var preRepSnap = null;
    return Promise.resolve()
      .then(function () {
        if (!CONFIG.RANCH_HARVEST_REP_INFER) return;
        return fetchRanchRepSnapshot(base, cookie, ctx, "收获前").then(function (snap) {
          preRepSnap = snap;
        });
      })
      .then(function () {
        var url = buildPastureUrl(base, ctx.harvestAllLink || "");
        if (!url) {
          url =
            base +
            "/mc/cgi-bin/wap_pasture_harvest?sid=" +
            ctx.sid +
            "&g_ut=" +
            ctx.g_ut +
            "&serial=-1&htype=3";
        }
        return ranchGet(url, cookie).then(function (html) {
          updateRanchSlotState(ctx, html);
          ctx.harvestAllLink = extractRanchHarvestAllLink(html) || ctx.harvestAllLink || "";
          var beforeHarvest = ctx.statusList || [];
          var afterHarvest = parseRanchStatus(html);
          if (afterHarvest.length > 0) ctx.statusList = afterHarvest;
          var msg = extractMessage(html);
          if (msg) log("🐮 收获: " + msg);
          var inferPromise = Promise.resolve();
          if (isSuccessMsg(msg)) {
            var hc = parseRanchHarvestCountFromMsg(msg || html);
            if (hc > 0) RANCH_STATS.harvest += hc;
            else {
              var infer = inferRanchHarvestFromStatus(beforeHarvest, afterHarvest);
              if (infer.count > 0) {
                RANCH_STATS.harvest += infer.count;
                log(
                  "🐮 收获(列表兜底): 推断" +
                    infer.count +
                    "只" +
                    (infer.detail ? " | " + infer.detail : "")
                );
              } else if (CONFIG.RANCH_HARVEST_REP_INFER && preRepSnap) {
                inferPromise = inferRanchHarvestFromRep(base, cookie, ctx, preRepSnap)
                  .then(function (repInfer) {
                    if (repInfer && repInfer.count > 0) {
                      RANCH_STATS.harvest += repInfer.count;
                      log(
                        "🐮 收获(仓库兜底): 推断" +
                          repInfer.count +
                          "项" +
                          (repInfer.detail ? " | " + repInfer.detail : "")
                      );
                      return;
                    }
                    RANCH_STATS.harvestUnknown += 1;
                    log("🐮 收获: 成功，但本次数量未知");
                  })
                  .catch(function () {
                    RANCH_STATS.harvestUnknown += 1;
                    log("🐮 收获: 成功，但本次数量未知");
                  });
              } else {
                RANCH_STATS.harvestUnknown += 1;
                log("🐮 收获: 成功，但本次数量未知");
              }
            }
          }
          ctx._help = extractHelpParams(html);
          var hlinks = extractHelpLinks(html);
          if (hlinks.length) ctx.helpLinks = hlinks;
          return inferPromise;
        });
      });
  }

  function doHelp() {
    if (!CONFIG.ENABLE.ranch_help) return Promise.resolve();
    var links = ctx.helpLinks || [];
    if (links.length > 0) {
      var i = 0;
      function next() {
        if (i >= links.length) return Promise.resolve();
        var link = links[i++];
        var url = link.indexOf("http") === 0 ? link : base + "/mc/cgi-bin/" + link.replace(/^\.?\//, "");
        return ranchGet(url, cookie)
          .then(function (html) {
            updateRanchSlotState(ctx, html);
            var msg = extractMessage(html);
            if (msg) log("🧹 清理: " + msg);
            var cnt = parseRanchHelpCount(msg || html) || 1;
            RANCH_STATS.help += cnt;
          })
          .then(function () {
            return sleep(CONFIG.WAIT_MS);
          })
          .then(next);
      }
      return next();
    }
    if (!ctx._help || !ctx.B_UID || Number(ctx._help.num || 0) <= 0) {
      log("🧹 清理: 未发现可清理参数，跳过");
      return Promise.resolve();
    }
    var url =
      base +
      "/mc/cgi-bin/wap_pasture_help?sid=" +
      ctx.sid +
      "&g_ut=" +
      ctx.g_ut +
      "&B_UID=" +
      ctx.B_UID +
      "&num=" +
      ctx._help.num +
      "&type=" +
      ctx._help.type +
      "&pos=" +
      ctx._help.pos;
    return ranchGet(url, cookie).then(function (html) {
      updateRanchSlotState(ctx, html);
      var msg = extractMessage(html);
      if (msg) log("🧹 清理: " + msg);
      var cnt = parseRanchHelpCount(msg || html) || 1;
      RANCH_STATS.help += cnt;
    });
  }

  function doRefill() {
    if (!CONFIG.RANCH_AUTO_REFILL) return Promise.resolve();
    return refillRanchAnimals(base, cookie, ctx).then(function (ret) {
      if (!ret || ret.skipped) return;
      if ((ret.bag || 0) <= 0 && (ret.buy || 0) <= 0 && CONFIG.DEBUG) {
        logDebug("🐮 补栏: 本轮无新增");
      }
    });
  }

  return Promise.resolve()
    .then(doFeed)
    .then(function () {
      return sleep(CONFIG.WAIT_MS);
    })
    .then(function () {
      if (!didFeed) return;
      return refreshRanchContext(base, cookie, ctx);
    })
    .then(doProductList)
    .then(function () {
      return sleep(CONFIG.WAIT_MS);
    })
    .then(doHarvestAllIfNeeded)
    .then(function () {
      return sleep(CONFIG.WAIT_MS);
    })
    .then(doHelp)
    .then(function () {
      return sleep(CONFIG.WAIT_MS);
    })
    .then(doRefill)
    .catch(function (e) {
      RANCH_STATS.errors += 1;
      log("⚠️ 牧场任务失败: " + e);
    });
}

/* =======================
 *  HIVE (蜂巢)
 * ======================= */
function hiveParams(ctx, extra) {
  var p = {
    uIdx: ctx.uIdx,
    uinY: ctx.uinY,
    farmTime: getFarmTime(),
    platform: CONFIG.FARM_PLATFORM || "13",
    appid: CONFIG.FARM_APPID || "353",
    version: CONFIG.FARM_VERSION || "4.0.20.0"
  };
  if (extra) {
    for (var k in extra) {
      if (!extra.hasOwnProperty(k)) continue;
      p[k] = extra[k];
    }
  }
  return p;
}

function isHiveOk(json) {
  return !!(json && Number(json.code) === 1 && Number(json.ecode || 0) === 0);
}

function hiveErrMsg(json) {
  if (!json) return "非JSON";
  return json.direction || json.msg || json.message || ("ecode=" + (json.ecode != null ? json.ecode : "未知"));
}

function isHiveNoop(json, msg) {
  var ecode = Number(json && json.ecode);
  if (!isNaN(ecode) && (ecode === -32 || ecode === -16 || ecode === -30 || ecode === -31)) return true;
  var m = normalizeSpace(msg || hiveErrMsg(json));
  if (!m) return false;
  return /(状态不对|无需|不能|已在工作|冷却|免费次数|花粉不足|蜜蜂不足|无可收|未达到|未满足|蜂蜜不足|余额不足|满级|最高级|不可升级|无法升级|无需升级|条件不足|没有可升级)/.test(
    m
  );
}

function parseHiveHarvestGain(json, fallback) {
  var gain = Number((json && (json.addHoney || json.add || 0)) || 0) || 0;
  if (gain > 0) return gain;
  var fb = Number(fallback || 0) || 0;
  return fb > 0 ? fb : 0;
}

function hiveNum(v, dft) {
  var n = Number(v);
  if (isNaN(n)) return Number(dft || 0) || 0;
  return n;
}

function parseHiveUpgradeIdsFromConfig(raw) {
  var arr = String(raw || "")
    .split(",")
    .map(function (v) {
      return Number(String(v || "").trim()) || 0;
    })
    .filter(function (n) {
      return n > 0;
    });
  if (!arr.length) arr = [2, 1];
  var out = [];
  var seen = {};
  for (var i = 0; i < arr.length; i++) {
    var id = Number(arr[i] || 0) || 0;
    if (!id || seen[id]) continue;
    seen[id] = 1;
    out.push(id);
  }
  return out;
}

function hiveUpgradeNeedHoney(id) {
  var map = (CONFIG && CONFIG.HIVE_UPGRADE_COST_HINTS) || {};
  if (!map || typeof map !== "object") return 0;
  var k = String(Number(id || 0) || 0);
  if (!k || k === "0") return 0;
  var need = Number(map[k] || 0) || 0;
  return need > 0 ? need : 0;
}

function hiveFindUpgradeableIdByHoney(honey, ids) {
  var h = Number(honey || 0) || 0;
  var list = ids && ids.length ? ids : parseHiveUpgradeIdsFromConfig(CONFIG.HIVE_UPGRADE_IDS);
  var minNeed = 0;
  var minId = 0;
  var hasHint = false;
  for (var i = 0; i < list.length; i++) {
    var id = Number(list[i] || 0) || 0;
    if (!id) continue;
    var need = hiveUpgradeNeedHoney(id);
    if (need <= 0) return { can: h > 0, id: id, need: 0, hasHint: hasHint };
    hasHint = true;
    if (!minNeed || need < minNeed) {
      minNeed = need;
      minId = id;
    }
    if (h >= need) return { can: true, id: id, need: need, hasHint: hasHint };
  }
  return { can: false, id: minId, need: minNeed, hasHint: hasHint };
}

function loadHiveUpgradeBusyMap() {
  if (HIVE_UPGRADE_BUSY_MAP && typeof HIVE_UPGRADE_BUSY_MAP === "object") return HIVE_UPGRADE_BUSY_MAP;
  var out = {};
  var raw = $.read(STORE_KEY_HIVE_UPGRADE_BUSY_UNTIL) || "";
  if (raw) {
    var obj = tryJson(raw);
    if (obj && typeof obj === "object") out = obj;
  }
  var now = getFarmTime();
  var map = {};
  var changed = false;
  for (var k in out) {
    if (!out.hasOwnProperty(k)) continue;
    if (!/^\d+$/.test(String(k))) {
      changed = true;
      continue;
    }
    var until = Number(out[k] || 0);
    if (isNaN(until) || until <= now) {
      changed = true;
      continue;
    }
    map[String(k)] = Math.floor(until);
  }
  HIVE_UPGRADE_BUSY_MAP = map;
  if (changed) {
    try {
      $.write(JSON.stringify(map || {}), STORE_KEY_HIVE_UPGRADE_BUSY_UNTIL);
    } catch (e) {
      if (CONFIG.DEBUG) logDebug("🐝 升级繁忙缓存清理失败: " + e);
    }
  }
  return HIVE_UPGRADE_BUSY_MAP;
}

function saveHiveUpgradeBusyMap() {
  var map = loadHiveUpgradeBusyMap();
  try {
    $.write(JSON.stringify(map || {}), STORE_KEY_HIVE_UPGRADE_BUSY_UNTIL);
  } catch (e) {
    if (CONFIG.DEBUG) logDebug("🐝 升级繁忙缓存写入失败: " + e);
  }
}

function hiveUpgradeBusyUntil(id) {
  var key = String(Number(id || 0) || 0);
  if (!key || key === "0") return 0;
  var map = loadHiveUpgradeBusyMap();
  if (!Object.prototype.hasOwnProperty.call(map, key)) return 0;
  var until = Number(map[key] || 0);
  if (isNaN(until) || until <= getFarmTime()) {
    delete map[key];
    saveHiveUpgradeBusyMap();
    return 0;
  }
  return Math.floor(until);
}

function setHiveUpgradeBusyUntil(id, untilTs) {
  var key = String(Number(id || 0) || 0);
  if (!key || key === "0") return false;
  var map = loadHiveUpgradeBusyMap();
  var until = Number(untilTs || 0) || 0;
  if (until <= getFarmTime()) {
    if (Object.prototype.hasOwnProperty.call(map, key)) {
      delete map[key];
      saveHiveUpgradeBusyMap();
    }
    return false;
  }
  map[key] = Math.floor(until);
  saveHiveUpgradeBusyMap();
  return true;
}

function clearHiveUpgradeBusyUntil(id) {
  var key = String(Number(id || 0) || 0);
  if (!key || key === "0") return;
  var map = loadHiveUpgradeBusyMap();
  if (!Object.prototype.hasOwnProperty.call(map, key)) return;
  delete map[key];
  saveHiveUpgradeBusyMap();
}

function buildHiveActionPlan(state, opts) {
  var plan = {
    canUpgrade: false,
    canPollen: false,
    canHarvest: false,
    harvestProbe: false,
    canWork: false,
    upgradeReason: "",
    pollenReason: "",
    harvestReason: "",
    workReason: "",
    status: 0,
    honey: 0,
    freeCD: 0,
    payCD: 0,
    remainCd: 0,
    summary: "状态未知"
  };
  if (!state) {
    plan.pollenReason = "状态缺失";
    plan.harvestReason = "状态缺失";
    plan.workReason = "状态缺失";
    return plan;
  }

  var status = hiveNum(state.status, 0);
  var honey = hiveNum(state.honey, 0);
  var freeCD = hiveNum(state.freeCD, 0);
  var payCD = hiveNum(state.payCD, 0);
  var stamp = hiveNum(state.stamp, 0);
  var nowTs = hiveNum(getFarmTime(), 0);
  var remainCd = 0;
  if (nowTs > 0 && stamp > 0 && payCD > 0) {
    var pass = nowTs - stamp;
    if (pass < payCD) remainCd = payCD - pass;
  }

  plan.status = status;
  plan.honey = honey;
  plan.freeCD = freeCD;
  plan.payCD = payCD;
  plan.remainCd = remainCd;
  var skipHarvest = !!(opts && opts.skipHarvest);
  var forceWorkAfterPollen = !!(opts && opts.forceWorkAfterPollen);
  // 收蜜优先按蜂蜜值判断，状态仅用于控制是否允许“状态1补探测”。
  if (!CONFIG.HIVE_AUTO_HARVEST) {
    plan.harvestReason = "配置关闭";
  } else if (honey <= 0) {
    plan.harvestReason = "状态显示无可收蜂蜜";
  } else if (skipHarvest) {
    plan.harvestReason = "本轮已判定不可收";
  } else if (status === 2) {
    plan.harvestReason = "状态2(采蜜中/冷却)，先跳过收蜜";
  } else if (status === 1) {
    if (CONFIG.HIVE_TRY_HARVEST_ON_STATUS1 && freeCD > 0) {
      plan.canHarvest = true;
      plan.harvestProbe = true;
      plan.harvestReason = "状态1且蜂蜜>0，补探测收蜜";
    } else if (CONFIG.HIVE_TRY_HARVEST_ON_STATUS1) {
      plan.harvestReason = "状态1且花粉可用值不足(" + freeCD + ")";
    } else {
      plan.harvestReason = "状态1且蜂蜜>0(已关闭补探测)";
    }
  } else {
    plan.canHarvest = true;
  }

  if (!CONFIG.HIVE_AUTO_UPGRADE) {
    plan.upgradeReason = "配置关闭";
  } else if (plan.canHarvest) {
    plan.upgradeReason = "当前有蜂蜜可收，先收后升";
  } else if (honey <= 0) {
    plan.upgradeReason = "蜂蜜不足(" + honey + ")";
  } else {
    var upgradeHint = hiveFindUpgradeableIdByHoney(honey, parseHiveUpgradeIdsFromConfig(CONFIG.HIVE_UPGRADE_IDS));
    if (upgradeHint.can) {
      plan.canUpgrade = true;
    } else if (upgradeHint.hasHint && upgradeHint.need > 0) {
      plan.upgradeReason = "蜂蜜不足(当前" + honey + "，最低需" + upgradeHint.need + ")";
    } else {
      plan.canUpgrade = true;
    }
  }

  if (!CONFIG.HIVE_AUTO_POLLEN) {
    plan.pollenReason = "配置关闭";
  } else if (plan.canHarvest) {
    plan.pollenReason = "当前有蜂蜜可收，先收后喂";
  } else if (freeCD > 0) {
    plan.canPollen = true;
  } else {
    plan.pollenReason = "花粉可用值不足(" + freeCD + ")";
  }

  // 放蜂只做一轮探测：有可收先收，其余交由接口判定是否冷却/状态不对。
  if (!CONFIG.HIVE_AUTO_WORK) {
    plan.workReason = "配置关闭";
  } else if (plan.canHarvest) {
    plan.workReason = "当前有蜂蜜可收，先收后放";
  } else if (status === 0) {
    plan.workReason = "状态0(疑似无可放蜜蜂)";
  } else if (CONFIG.HIVE_WORK_REQUIRE_FREECD !== false && freeCD <= 0 && !forceWorkAfterPollen) {
    plan.workReason = "免费花粉为0，暂不放蜂";
  } else {
    plan.canWork = true;
    if (forceWorkAfterPollen && freeCD <= 0) {
      plan.workReason = "本轮已喂花粉，放蜂放行";
    } else if (remainCd > 0) {
      plan.workReason = "冷却提示" + remainCd + "s(仍尝试一次，以接口为准)";
    }
  }

  plan.summary =
    "状态" +
    status +
    " 蜂蜜" +
    honey +
    " 花粉" +
    freeCD +
    " | 升级" +
    (plan.canUpgrade ? "是" : "否") +
    " | 喂粉" +
    (plan.canPollen ? "是" : "否") +
    " 收蜜" +
    (plan.canHarvest ? "是" : "否") +
    " 放蜂" +
    (plan.canWork ? "是" : "否");
  return plan;
}

function formatHiveState(state) {
  if (!state) return "未知";
  var freeCd = state.freeCD != null ? Number(state.freeCD) || 0 : 0;
  return "状态" + state.status + " 蜂蜜" + state.honey + " 等级" + state.level + " 花粉" + freeCd;
}

function hiveActionStateChanged(before, after, action) {
  if (!before || !after) return false;
  var keys = [];
  if (action === "pollen") {
    keys = ["freeCD", "status", "payCD", "stamp", "step"];
  } else if (action === "work") {
    keys = ["status", "payCD", "stamp", "step", "freeCD"];
  } else {
    keys = ["status", "honey", "freeCD", "payCD", "stamp", "step"];
  }
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var a = hiveNum(before[k], 0);
    var b = hiveNum(after[k], 0);
    if (a !== b) return true;
  }
  return false;
}

function callHiveApi(cookie, path, params) {
  var base = CONFIG.HIVE_BASE || CONFIG.FARM_JSON_BASE || "https://nc.qzone.qq.com";
  var url = base + path;
  return httpRequest({
    method: "POST",
    url: url,
    headers: buildFishJsonHeaders(cookie),
    body: buildLegacyBody(params)
  }).then(function (resp) {
    return tryJson(resp.body);
  });
}

function fetchHiveIndex(cookie, ctx) {
  return callHiveApi(
    cookie,
    "/cgi-bin/cgi_farm_hive_index",
    hiveParams(ctx, {
      ownerId: ctx.uIdx
    })
  ).then(function (json) {
    if (!isHiveOk(json)) return null;
    return {
      honey: Number(json.honey || 0) || 0,
      status: Number(json.status || 0) || 0,
      level: Number(json.level || 0) || 0,
      freeCD: Number(json.freeCD || 0) || 0,
      payCD: Number(json.payCD || 0) || 0,
      step: Number(json.step || 0) || 0,
      stamp: Number(json.stamp || 0) || 0,
      raw: json
    };
  });
}

function runHive(cookie) {
  if (!hiveEnabled()) return Promise.resolve();
  log("🐝 蜂巢模块: 启动");
  log("🐝 蜂巢流程: 状态检测→收蜂蜜(可收才收)→升级蜜蜂(可升才升)→喂花粉(可用才喂)→放蜂(可放才放)→复查（禁用卖蜂蜜）");
  HIVE_STATS.start = "";
  HIVE_STATS.end = "";
  var ctx = null;
  var current = null;
  var harvested = 0;
  var harvestBlockedThisRound = false;
  var pollenDoneThisRound = false;

  function refresh(tag) {
    return fetchHiveIndex(cookie, ctx).then(function (state) {
      if (!state) {
        HIVE_STATS.errors += 1;
        log("⚠️ 蜂巢读取失败(" + tag + ")");
        return null;
      }
      if (CONFIG.DEBUG) logDebug("🐝 蜂巢状态(" + tag + "): " + formatHiveState(state));
      return state;
    });
  }

  function doPollen() {
    var plan = buildHiveActionPlan(current, { skipHarvest: harvestBlockedThisRound });
    if (!plan.canPollen) {
      if (CONFIG.DEBUG) logDebug("🌸 喂花粉: " + (plan.pollenReason || "无需执行"));
      return Promise.resolve();
    }
    if (CONFIG.DEBUG) logDebug("🌸 喂花粉: 状态预判通过，执行");
    return callHiveApi(
      cookie,
      "/cgi-bin/cgi_farm_hive_restend",
      hiveParams(ctx, {
        free: 1
      })
    ).then(function (json) {
      if (!isHiveOk(json)) {
        var msg = hiveErrMsg(json);
        if (isHiveNoop(json, msg)) {
          if (CONFIG.DEBUG) logDebug("🌸 喂花粉: 无需执行(" + msg + ")");
          return refresh("喂粉noop后").then(function (st) {
            if (st) current = st;
          });
        }
        HIVE_STATS.errors += 1;
        log("⚠️ 喂花粉失败: " + msg);
        return;
      }
      var before = current;
      return refresh("喂粉后").then(function (st) {
        if (st) current = st;
        var after = st || current;
        if (hiveActionStateChanged(before, after, "pollen")) {
          HIVE_STATS.pollen += 1;
          pollenDoneThisRound = true;
          log("🌸 喂花粉: 成功");
        } else {
          log("ℹ️ 喂花粉: 接口成功但状态未变化，按未生效处理");
        }
      });
    });
  }

  function doHarvest() {
    var plan = buildHiveActionPlan(current, { skipHarvest: harvestBlockedThisRound });
    if (!plan.canHarvest) {
      if (CONFIG.DEBUG) logDebug("🍯 收蜂蜜: " + (plan.harvestReason || "无需执行"));
      return Promise.resolve();
    }
    if (CONFIG.DEBUG) {
      logDebug("🍯 收蜂蜜: " + (plan.harvestProbe ? "状态1补探测，执行" : "状态预判通过，执行"));
    }
    var fallbackHoney = Number(current.honey || 0) || 0;
    return callHiveApi(cookie, "/cgi-bin/cgi_farm_hive_harvest", hiveParams(ctx)).then(function (json) {
      if (!isHiveOk(json)) {
        var msg = hiveErrMsg(json);
        if (isHiveNoop(json, msg)) {
          if (/状态不对|无可收|未达到|不能|无需/.test(msg || "")) harvestBlockedThisRound = true;
          if (CONFIG.DEBUG) logDebug("🍯 收蜂蜜: 无需执行(" + msg + ")");
          return refresh("收蜜noop后").then(function (st) {
            if (st) current = st;
          });
        }
        HIVE_STATS.errors += 1;
        log("⚠️ 收蜂蜜失败: " + msg);
        return;
      }
      var gain = parseHiveHarvestGain(json, fallbackHoney);
      harvestBlockedThisRound = false;
      if (gain > 0) {
        HIVE_STATS.harvest += gain;
        harvested += gain;
        log("🍯 收蜂蜜: +" + gain);
      } else {
        log("🍯 收蜂蜜: 已执行(本次+0)");
      }
      return refresh("收蜜后").then(function (st) {
        if (st) current = st;
      });
    });
  }

  function doUpgrade() {
    if (!CONFIG.HIVE_AUTO_UPGRADE) {
      if (CONFIG.DEBUG) logDebug("🐝 蜜蜂升级: 配置关闭");
      return Promise.resolve();
    }
    var ids = parseHiveUpgradeIdsFromConfig(CONFIG.HIVE_UPGRADE_IDS);
    if (!ids.length) return Promise.resolve();
    var maxUpgrade = Number(CONFIG.HIVE_UPGRADE_MAX || 0);
    if (isNaN(maxUpgrade) || maxUpgrade < 0) maxUpgrade = 0;
    var transientRetries = Number(CONFIG.RETRY_TRANSIENT || 0);
    if (isNaN(transientRetries) || transientRetries < 1) transientRetries = 1;
    var busyCooldownSec = Number(CONFIG.HIVE_UPGRADE_BUSY_COOLDOWN_SEC || 0);
    if (isNaN(busyCooldownSec) || busyCooldownSec < 0) busyCooldownSec = 0;
    busyCooldownSec = Math.floor(busyCooldownSec);
    var done = 0;
    var idx = 0;

    function next() {
      if (idx >= ids.length) return Promise.resolve();
      if (maxUpgrade > 0 && done >= maxUpgrade) return Promise.resolve();
      var bid = Number(ids[idx++] || 0) || 0;
      if (!bid) return next();
      var busyUntil = hiveUpgradeBusyUntil(bid);
      if (busyUntil > 0) {
        if (CONFIG.DEBUG) {
          var leftWait = busyUntil - getFarmTime();
          if (leftWait < 0) leftWait = 0;
          logDebug("🐝 蜜蜂升级(id=" + bid + "): 繁忙冷却中(" + formatWaitSec(leftWait) + ")，跳过");
        }
        return next();
      }
      var honeyNow = Number((current && current.honey) || 0) || 0;
      if (honeyNow <= 0) {
        if (CONFIG.DEBUG) logDebug("🐝 蜜蜂升级(id=" + bid + "): 蜂蜜不足(" + honeyNow + ")，跳过");
        return Promise.resolve();
      }
      var needHoney = hiveUpgradeNeedHoney(bid);
      if (needHoney > 0 && honeyNow < needHoney) {
        if (CONFIG.DEBUG) {
          logDebug("🐝 蜜蜂升级(id=" + bid + "): 蜂蜜不足(当前" + honeyNow + "，需" + needHoney + ")，跳过");
        }
        return next();
      }
      if (CONFIG.DEBUG) logDebug("🐝 蜜蜂升级: 尝试 id=" + bid + "（当前蜂蜜" + honeyNow + "）");
      function tryOneUpgrade(attempt) {
        return callHiveApi(
          cookie,
          "/cgi-bin/cgi_farm_hive_upgrade?act=bee",
          hiveParams(ctx, {
            id: bid
          })
        )
          .then(function (json) {
            if (!isHiveOk(json)) {
              var msg = hiveErrMsg(json);
              var transient = isTransientFailText(msg || "");
              if (transient && attempt < transientRetries) {
                log("⚠️ 蜜蜂升级繁忙(id=" + bid + ")，第" + (attempt + 1) + "次重试");
                return sleep(CONFIG.RETRY_WAIT_MS || 800).then(function () {
                  return tryOneUpgrade(attempt + 1);
                });
              }
              if (transient) {
                if (busyCooldownSec > 0) {
                  setHiveUpgradeBusyUntil(bid, getFarmTime() + busyCooldownSec);
                  log(
                    "⚠️ 蜜蜂升级繁忙(id=" +
                      bid +
                      "): 已重试" +
                      transientRetries +
                      "次，冷却" +
                      formatWaitSec(busyCooldownSec) +
                      "后再试"
                  );
                } else {
                  log("⚠️ 蜜蜂升级繁忙(id=" + bid + "): 已重试" + transientRetries + "次，留待下轮");
                }
                return refresh("升级繁忙后").then(function (st) {
                  if (st) current = st;
                });
              }
              if (isHiveNoop(json, msg)) {
                if (CONFIG.DEBUG) logDebug("🐝 蜜蜂升级(id=" + bid + "): 无需执行(" + msg + ")");
                return refresh("升级noop后").then(function (st) {
                  if (st) current = st;
                });
              }
              HIVE_STATS.errors += 1;
              log("⚠️ 蜜蜂升级失败(id=" + bid + "): " + msg);
              return;
            }
            done += 1;
            HIVE_STATS.upgrade += 1;
            clearHiveUpgradeBusyUntil(bid);
            var left = Number(json.honey);
            if (isNaN(left) || left < 0) {
              log("🐝 蜜蜂升级: id=" + bid + " 成功");
            } else {
              log("🐝 蜜蜂升级: id=" + bid + " 成功，剩余蜂蜜" + left);
            }
            return refresh("升级后").then(function (st) {
              if (st) current = st;
            });
          })
          .then(function () {
            if (idx >= ids.length) return;
            if (maxUpgrade > 0 && done >= maxUpgrade) return;
            return sleep(CONFIG.WAIT_MS).then(next);
          });
      }
      return tryOneUpgrade(0);
    }

    return next().then(function () {
      if (done <= 0 && CONFIG.DEBUG) logDebug("🐝 蜜蜂升级: 本轮无新增");
    });
  }

  function doWork() {
    var plan = buildHiveActionPlan(current, {
      skipHarvest: harvestBlockedThisRound,
      forceWorkAfterPollen: pollenDoneThisRound
    });
    if (!plan.canWork) {
      if (CONFIG.DEBUG) logDebug("🐝 放养蜜蜂: " + (plan.workReason || "无需执行"));
      return Promise.resolve();
    }
    if (CONFIG.DEBUG) logDebug("🐝 放养蜜蜂: 状态预判通过，执行");
    return callHiveApi(cookie, "/cgi-bin/cgi_farm_hive_work", hiveParams(ctx)).then(function (json) {
      if (!isHiveOk(json)) {
        var msg = hiveErrMsg(json);
        if (/状态不对|无需|不能|已在工作|冷却/.test(msg)) {
          if (CONFIG.DEBUG) logDebug("🐝 放养蜜蜂: 无需执行(" + msg + ")");
          return refresh("放蜂noop后").then(function (st) {
            if (st) current = st;
          });
        }
        HIVE_STATS.errors += 1;
        log("⚠️ 放养蜜蜂失败: " + msg);
        return;
      }
      var before = current;
      return refresh("放蜂后").then(function (st) {
        if (st) current = st;
        var after = st || current;
        if (hiveActionStateChanged(before, after, "work")) {
          HIVE_STATS.work += 1;
          log("🐝 放养蜜蜂: 成功");
        } else {
          log("ℹ️ 放养蜜蜂: 接口成功但状态未变化，按未生效处理");
        }
      });
    });
  }

  return ensureFarmJsonContext(cookie)
    .then(function () {
      var uIdx = FARM_CTX.uIdx || getFarmUin(cookie) || "";
      var uinY = FARM_CTX.uinY || getFarmUinFromCookie(cookie) || "";
      if (!uIdx || !uinY) {
        HIVE_STATS.errors += 1;
        log("⚠️ 蜂巢: 缺少 uIdx/uinY，跳过");
        return null;
      }
      ctx = { uIdx: String(uIdx), uinY: String(uinY) };
      return refresh("开始");
    })
    .then(function (state) {
      if (!state) return;
      current = state;
      HIVE_STATS.start = formatHiveState(state);
      log("🐝 蜂巢预判(开始): " + buildHiveActionPlan(current).summary);
      return doHarvest()
        .then(function () {
          return sleep(CONFIG.WAIT_MS);
        })
        .then(doUpgrade)
        .then(function () {
          return sleep(CONFIG.WAIT_MS);
        })
        .then(doPollen)
        .then(function () {
          return sleep(CONFIG.WAIT_MS);
        })
        .then(doWork);
    })
    .then(function () {
      if (!ctx) return;
      return refresh("结束").then(function (state) {
        if (state) current = state;
      });
    })
    .then(function () {
      if (current) {
        HIVE_STATS.end = formatHiveState(current);
        HIVE_STATS.honey = current.honey;
      }
      if (!HIVE_STATS.end && HIVE_STATS.start) HIVE_STATS.end = HIVE_STATS.start;
      if (harvested > 0 && HIVE_STATS.honey < 0) HIVE_STATS.honey = 0;
      if (HIVE_STATS.start) log("🐝 蜂巢状态(模块开始): " + HIVE_STATS.start);
      if (HIVE_STATS.end) log("🐝 蜂巢状态(模块结束): " + HIVE_STATS.end);
    })
    .catch(function (e) {
      HIVE_STATS.errors += 1;
      log("⚠️ 蜂巢模块异常: " + e);
    });
}

/* =======================
 *  TIME FARM (时光农场)
 * ======================= */
function timeFarmParams(ctx, extra) {
  var p = {
    uIdx: ctx.uIdx,
    uinY: ctx.uinY,
    farmTime: getFarmTime(),
    platform: CONFIG.FARM_PLATFORM || "13",
    appid: CONFIG.FARM_APPID || "353",
    version: CONFIG.FARM_VERSION || "4.0.20.0"
  };
  if (extra) {
    for (var k in extra) {
      if (!extra.hasOwnProperty(k)) continue;
      p[k] = extra[k];
    }
  }
  return p;
}

function isTimeFarmOk(json) {
  return !!(json && Number(json.code) === 1 && Number(json.ecode || 0) === 0);
}

function timeFarmErrMsg(json) {
  if (!json) return "非JSON";
  return json.direction || json.msg || json.message || ("ecode=" + (json.ecode != null ? json.ecode : "未知"));
}

function isTimeFarmNoop(json) {
  var ecode = Number(json && json.ecode);
  if (isNaN(ecode)) return false;
  return ecode === -32 || ecode === -16 || ecode === -30 || ecode === -31;
}

function parseTimeFarmLandList(json) {
  return ensureArray(json && json.res && json.res.farmlandstatus);
}

function timeFarmLandCropId(land) {
  if (!land) return "";
  var keys = ["cId", "cropid", "cropId", "c", "a"];
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (land[key] === undefined || land[key] === null || land[key] === "") continue;
    var n = Number(land[key]);
    if (!isNaN(n) && n > 0) return String(Math.floor(n));
  }
  // k/m 在部分返回里并非作物ID，仅在本地有名称映射时才作为兜底。
  var fallbackKeys = ["k", "m"];
  for (var j = 0; j < fallbackKeys.length; j++) {
    var fk = fallbackKeys[j];
    if (land[fk] === undefined || land[fk] === null || land[fk] === "") continue;
    var fn = Number(land[fk]);
    if (isNaN(fn) || fn <= 0) continue;
    var key2 = String(Math.floor(fn));
    var mapped = normalizeSpace(CROP_NAME_MAP[key2] || TIME_FARM_SPECIAL_SEED_MAP[key2] || "");
    if (mapped && !/^cId\d+$/i.test(mapped)) return key2;
  }
  return "";
}

function getTimeFarmCropName(cid) {
  if (!cid) return "";
  var key = String(cid);
  var name = CROP_NAME_MAP[key] || TIME_FARM_SPECIAL_SEED_MAP[key] || "";
  name = normalizeSpace(name);
  if (!name || /^cId\d+$/i.test(name) || /^作物#?\d+$/i.test(name)) return "";
  return name;
}

function formatTimeFarmCropMap(crops) {
  if (!crops) return "";
  var arr = [];
  for (var k in crops) {
    if (!crops.hasOwnProperty(k)) continue;
    var n = Number(crops[k] || 0) || 0;
    if (n <= 0) continue;
    arr.push({ name: k, count: n });
  }
  if (!arr.length) return "";
  arr.sort(function (a, b) {
    if (b.count !== a.count) return b.count - a.count;
    return a.name > b.name ? 1 : a.name < b.name ? -1 : 0;
  });
  var parts = [];
  for (var i = 0; i < arr.length; i++) {
    parts.push(arr[i].name + "×" + arr[i].count);
  }
  return parts.join("；");
}

function timeFarmStageText(b) {
  var v = Number(b || 0);
  if (v === 0) return "空地";
  if (v === 1) return "种子";
  if (v === 2) return "发芽";
  if (v === 3) return "成株";
  if (v === 4) return "开花";
  if (v === 5) return "初熟";
  if (v === 6) return "成熟";
  if (v === 7) return "枯萎";
  return "状态" + v;
}

function timeFarmLandName(land, cid) {
  var direct = normalizeSpace(
    (land && (land.cName || land.cropName || land.crop_name || land.name || land.tName || land.title)) || ""
  );
  if (direct && !/^作物#?\d+$/i.test(direct)) return direct;
  var byCid = getTimeFarmCropName(cid);
  if (byCid) return byCid;
  if (cid) return "cId" + String(cid);
  return "未知作物";
}

function summarizeTimeFarmLand(list) {
  var out = { total: 0, empty: 0, withered: 0, mature: 0, growing: 0, crops: {}, cropStages: {}, cropText: "" };
  for (var i = 0; i < list.length; i++) {
    var land = list[i] || {};
    out.total += 1;
    var b = Number(land.b || 0);
    if (b === 0) out.empty += 1;
    else if (b === 6) out.mature += 1;
    else if (b === 7) out.withered += 1;
    else out.growing += 1;
    if (b !== 0) {
      var cid = timeFarmLandCropId(land);
      var baseName = timeFarmLandName(land, cid);
      var stageName = timeFarmStageText(b);
      if (baseName) {
        out.crops[baseName] = (out.crops[baseName] || 0) + 1;
        var key = baseName + "(" + stageName + ")";
        out.cropStages[key] = (out.cropStages[key] || 0) + 1;
      }
    }
  }
  out.cropText = formatTimeFarmCropMap(out.cropStages) || formatTimeFarmCropMap(out.crops);
  return out;
}

function parseTimeFarmTasks(json) {
  var arr = ensureArray(json && json.res && json.res.tasks);
  var out = [];
  for (var i = 0; i < arr.length; i++) {
    var it = arr[i] || {};
    var id = Number(it.id != null ? it.id : it.taskid);
    if (!id || isNaN(id) || id <= 0) continue;
    var count = Number(it.count != null ? it.count : it.num);
    if (isNaN(count) || count < 0) count = 0;
    var status = Number(it.status);
    if (isNaN(status) || status < 0) status = 0;
    var name = normalizeSpace(it.name || it.task_name || it.taskName || it.title || it.desc || "");
    out.push({ id: id, count: Math.floor(count), status: Math.floor(status), name: name });
  }
  out.sort(function (a, b) {
    return a.id - b.id;
  });
  return out;
}

function timeFarmTaskNeedHint(taskId) {
  var key = String(Number(taskId || 0) || 0);
  if (!key || key === "0") return 0;
  var hints = (CONFIG && CONFIG.TIME_FARM_TASK_TARGET_HINTS) || {};
  var n = Number(hints[key] != null ? hints[key] : hints[Number(key)] || 0);
  if (isNaN(n) || n <= 0) return 0;
  return Math.floor(n);
}

function timeFarmTaskStatusText(status) {
  var s = Number(status || 0);
  if (s === 1) return "进行中";
  if (s === 2) return "可领";
  if (s === 3) return "已领";
  return "状态" + s;
}

function getTimeFarmTaskName(taskOrId) {
  var id = 0;
  var rawName = "";
  if (taskOrId && typeof taskOrId === "object") {
    id = Number(taskOrId.id || taskOrId.taskid || 0);
    rawName = normalizeSpace(taskOrId.name || taskOrId.task_name || taskOrId.taskName || taskOrId.title || "");
  } else {
    id = Number(taskOrId || 0);
  }
  if (rawName) return rawName;
  var hints = (CONFIG && CONFIG.TIME_FARM_TASK_NAME_MAP) || {};
  var key = String(id || 0);
  var mapped = normalizeSpace(hints[key] != null ? hints[key] : hints[id]);
  if (mapped) return mapped;
  return id > 0 ? "任务#" + id : "任务";
}

function formatTimeFarmTaskItem(task) {
  var it = task || {};
  var id = Number(it.id || it.taskid || 0);
  if (!id || isNaN(id) || id <= 0) return "";
  var count = Number(it.count || it.num || 0);
  if (isNaN(count) || count < 0) count = 0;
  var need = timeFarmTaskNeedHint(id);
  var status = Number(it.status || 0);
  var progress = need > 0 ? count + "/" + need : String(count);
  return getTimeFarmTaskName(it) + "(T" + id + ") " + progress + " " + timeFarmTaskStatusText(status);
}

function formatTimeFarmTasks(tasks) {
  var arr = ensureArray(tasks);
  if (!arr.length) return "";
  var parts = [];
  for (var i = 0; i < arr.length; i++) {
    var text = formatTimeFarmTaskItem(arr[i]);
    if (text) parts.push(text);
  }
  return parts.join("；");
}

function isTimeFarmTaskClaimable(task) {
  if (!task) return false;
  var status = Number(task.status || 0);
  // 仅按接口“可领态”判断，等价于按钮可点击（亮）才领。
  return status === 2;
}

function formatTimeFarmState(sum) {
  if (!sum || !sum.total) return "总0";
  var prefix = sum.cropText ? "作物 " + sum.cropText + "；" : "";
  return prefix + "总" + sum.total + " 空" + sum.empty + " 枯" + sum.withered + " 熟" + sum.mature + " 长" + sum.growing;
}

function cloneTimeFarmSum(sum) {
  if (!sum) return null;
  var crops = {};
  var src = sum.crops || {};
  for (var k in src) {
    if (!src.hasOwnProperty(k)) continue;
    var n = Number(src[k] || 0) || 0;
    if (n > 0) crops[k] = n;
  }
  return {
    total: Number(sum.total || 0) || 0,
    empty: Number(sum.empty || 0) || 0,
    withered: Number(sum.withered || 0) || 0,
    mature: Number(sum.mature || 0) || 0,
    growing: Number(sum.growing || 0) || 0,
    crops: crops,
    cropText: sum.cropText || formatTimeFarmCropMap(crops)
  };
}

function formatTimeFarmDelta(startSum, endSum) {
  var s = cloneTimeFarmSum(startSum);
  var e = cloneTimeFarmSum(endSum);
  if (!s || !e || (!s.total && !e.total)) return "";
  var parts = [];
  var dMature = e.mature - s.mature;
  var dWithered = e.withered - s.withered;
  var dEmpty = e.empty - s.empty;
  var dGrowing = e.growing - s.growing;
  if (dMature) parts.push("熟" + formatDelta(dMature));
  if (dWithered) parts.push("枯" + formatDelta(dWithered));
  if (dEmpty) parts.push("空" + formatDelta(dEmpty));
  if (dGrowing) parts.push("长" + formatDelta(dGrowing));
  if (!parts.length) return "无变化";
  return parts.join(" ");
}

function buildTimeFarmEmptyHint(startSum, endSum) {
  var s = cloneTimeFarmSum(startSum);
  if (!s || s.empty <= 0) return "";
  var e = cloneTimeFarmSum(endSum) || s;
  var prefix = "模块开始空地" + s.empty;
  if (TIME_FARM_STATS.plant > 0) return prefix + "，本轮已补种" + TIME_FARM_STATS.plant;
  if (!CONFIG.TIME_FARM_PLANT_ENABLE) return prefix + "（自动种植已关闭）";
  if (TIME_FARM_STATS.plantSkipReason) return prefix + "（" + TIME_FARM_STATS.plantSkipReason + "）";
  if (e.empty === s.empty) return prefix + "（本轮未变化）";
  return prefix + "，模块结束空地" + e.empty;
}

function fetchTimeFarmContext(cookie) {
  return ensureFarmJsonContext(cookie)
    .catch(function () {
      return null;
    })
    .then(function () {
      var uIdx = FARM_CTX.uIdx || getFarmUin(cookie);
      var uinY = FARM_CTX.uinY || getFarmUinFromCookie(cookie) || "";
      if (!uIdx || !uinY) return null;
      return { uIdx: String(uIdx), uinY: String(uinY) };
    });
}

function callTimeFarmApi(cookie, act, params, seedBase) {
  var base = seedBase ? CONFIG.TIME_FARM_SEED_BASE || "https://farm.qzone.qq.com" : CONFIG.TIME_FARM_BASE || "https://nc.qzone.qq.com";
  var url = base + (seedBase ? "/cgi-bin/cgi_farm_seed_list" : "/cgi-bin/cgi_farm_time_space?act=" + act);
  return httpRequest({
    method: "POST",
    url: url,
    headers: buildFishJsonHeaders(cookie),
    body: buildLegacyBody(params)
  }).then(function (resp) {
    return tryJson(resp.body);
  });
}

function fetchTimeFarmIndex(cookie, ctx) {
  return callTimeFarmApi(cookie, "index", timeFarmParams(ctx)).then(function (json) {
    if (!isTimeFarmOk(json)) return null;
    return {
      raw: json,
      list: parseTimeFarmLandList(json),
      sum: summarizeTimeFarmLand(parseTimeFarmLandList(json))
    };
  });
}

function fetchTimeFarmSpecialSeedMap(cookie) {
  return ensureFarmJsonContext(cookie)
    .then(function () {
      var uIdx = FARM_CTX.uIdx || getFarmUin(cookie) || "";
      var uinY = FARM_CTX.uinY || getFarmUinFromCookie(cookie) || "";
      if (!uIdx || !uinY) return 0;
      var params = {
        uIdx: uIdx,
        uinY: uinY,
        shopid: 1,
        farmTime: getFarmTime(),
        platform: CONFIG.FARM_PLATFORM || "13",
        appid: CONFIG.FARM_APPID || "353",
        version: CONFIG.FARM_VERSION || "4.0.20.0"
      };
      var url = (CONFIG.FARM_JSON_BASE || "https://nc.qzone.qq.com") + "/cgi-bin/query?act=2280001";
      return httpRequest({
        method: "POST",
        url: url,
        headers: buildFishJsonHeaders(cookie),
        body: buildLegacyBody(params)
      })
        .then(function (resp) {
          var json = tryJson(resp.body);
          if (!json || Number(json.code) !== 1 || Number(json.ecode || 0) !== 0) return 0;
          var arr = ensureArray(json.shop);
          var added = 0;
          for (var i = 0; i < arr.length; i++) {
            var it = arr[i] || {};
            var id = Number(it.itemid || it.id || 0);
            var name = normalizeSpace(it.name || "");
            if (!id || isNaN(id) || id <= 0) continue;
            if (!TIME_FARM_SPECIAL_SEED_MAP[id] || (name && TIME_FARM_SPECIAL_SEED_MAP[id] !== name)) {
              TIME_FARM_SPECIAL_SEED_MAP[id] = name || ("种子" + id);
              added += 1;
            }
          }
          return added;
        })
        .catch(function () {
          return 0;
        });
    })
    .catch(function () {
      return 0;
    });
}

function preloadTimeFarmSeedNames(cookie, ctx) {
  if (!ctx) return Promise.resolve(0);
  return callTimeFarmApi(cookie, "", timeFarmParams(ctx), true)
    .then(function (seedJson) {
      var list = ensureArray(seedJson);
      var added = 0;
      for (var i = 0; i < list.length; i++) {
        var it = list[i] || {};
        var cid = String(it.cId || it.cropid || it.id || "");
        var name = normalizeSpace(it.cName || it.name || it.cropName || "");
        if (!cid || !name) continue;
        var prev = CROP_NAME_MAP[cid];
        recordCropName(cid, name);
        if (!prev || prev !== CROP_NAME_MAP[cid]) added += 1;
      }
      return added;
    })
    .catch(function () {
      return 0;
    });
}

function isTimeFarmSpecialSeedItem(it) {
  if (!it) return false;
  var cid = Number(it.cId || it.cropid || 0);
  var name = normalizeSpace(it.cName || it.name || "");
  if (cid > 0 && TIME_FARM_SPECIAL_SEED_MAP[cid]) return true;
  if (cid >= 5000) return true;
  if (/时光|占城|吴中|关陇|滇西|南蛮|龟兹|南阳/.test(name)) return true;
  return false;
}

function pickTimeFarmCrop(seedList) {
  var list = ensureArray(seedList);
  if (!list.length) return null;
  var target = String(CONFIG.TIME_FARM_PLANT_CROPID || "");
  var first = null;
  var special = null;
  for (var i = 0; i < list.length; i++) {
    var it = list[i] || {};
    var amount = Number(it.amount || 0);
    var cid = String(it.cId || "");
    var name = it.cName || (cid ? "cId" + cid : "");
    if (cid && name) recordCropName(cid, name);
    if (amount <= 0 || !cid) continue;
    if (!first) first = it;
    if (target && cid === target) return it;
    if (CONFIG.TIME_FARM_PREFER_SPECIAL_SEED && !special && isTimeFarmSpecialSeedItem(it)) special = it;
  }
  if (special) return special;
  return first;
}

function runTimeFarm(cookie) {
  if (!timeFarmEnabled()) return Promise.resolve();
  log("🕰️ 时光农场模块: 启动");
  TIME_FARM_STATS.harvest = 0;
  TIME_FARM_STATS.dig = 0;
  TIME_FARM_STATS.plant = 0;
  TIME_FARM_STATS.fertilize = 0;
  TIME_FARM_STATS.taskClaim = 0;
  TIME_FARM_STATS.taskReward = "";
  TIME_FARM_STATS.taskStart = "";
  TIME_FARM_STATS.taskEnd = "";
  TIME_FARM_STATS.errors = 0;
  TIME_FARM_STATS.start = "";
  TIME_FARM_STATS.end = "";
  TIME_FARM_STATS.startSum = null;
  TIME_FARM_STATS.endSum = null;
  var ctx = null;
  var crop = null;
  var maxPass = Number(CONFIG.TIME_FARM_MAX_PASS || 1);
  if (!maxPass || isNaN(maxPass) || maxPass < 1) maxPass = 1;
  var transientRetries = Math.max(0, Number(CONFIG.RETRY_TRANSIENT || 0));
  if (isNaN(transientRetries)) transientRetries = 0;
  var claimedTaskIds = {};
  var didFertilize = false;
  TIME_FARM_STATS.plantSkipReason = CONFIG.TIME_FARM_PLANT_ENABLE ? "" : "自动种植已关闭";

  function doBatch(act, label) {
    return callTimeFarmApi(cookie, act, timeFarmParams(ctx)).then(function (json) {
      if (isTimeFarmOk(json)) return { ok: true, json: json };
      var msg = timeFarmErrMsg(json);
      if (isTimeFarmNoop(json)) {
        if (CONFIG.DEBUG) logDebug("🕰️ 时光" + label + ": 无需执行(" + msg + ")");
        return { ok: false, noop: true, json: json };
      }
      TIME_FARM_STATS.errors += 1;
      log("⚠️ 时光" + label + "失败: " + msg);
      return { ok: false, noop: false, json: json };
    });
  }

  function updateTimeFarmTaskSnapshot(tag, state) {
    var tasks = parseTimeFarmTasks(state && state.raw);
    var text = formatTimeFarmTasks(tasks);
    if (!text) return "";
    if (tag === "开始") {
      TIME_FARM_STATS.taskStart = text;
      log("🕰️ 时光任务(模块开始): " + text);
    } else if (tag === "结束") {
      TIME_FARM_STATS.taskEnd = text;
      log("🕰️ 时光任务(模块结束): " + text);
    } else if (CONFIG.DEBUG) {
      logDebug("🕰️ 时光任务(" + tag + "): " + text);
    }
    return text;
  }

  function claimTimeFarmTaskRewards(state) {
    if (!CONFIG.TIME_FARM_TASK_AUTO_CLAIM) return Promise.resolve(false);
    var tasks = parseTimeFarmTasks(state && state.raw);
    if (!tasks.length) return Promise.resolve(false);
    var candidates = [];
    for (var i = 0; i < tasks.length; i++) {
      var task = tasks[i] || {};
      var id = Number(task.id || 0);
      if (!id || isNaN(id) || id <= 0) continue;
      if (claimedTaskIds[id]) continue;
      if (!isTimeFarmTaskClaimable(task)) continue;
      candidates.push({
        id: id,
        count: Number(task.count || 0),
        status: Number(task.status || 0),
        name: normalizeSpace(task.name || "")
      });
    }
    if (!candidates.length) return Promise.resolve(false);
    if (CONFIG.DEBUG) {
      var parts = [];
      for (var p = 0; p < candidates.length; p++) {
        var task0 = candidates[p];
        parts.push(formatTimeFarmTaskItem(task0));
      }
      logDebug("🕰️ 时光任务待领奖: " + parts.join("；"));
    }
    var claimedAny = false;

    function claimOne(task, retry) {
      return callTimeFarmApi(
        cookie,
        "gettaskaward",
        timeFarmParams(ctx, {
          taskid: task.id
        })
      ).then(function (json) {
        if (isTimeFarmOk(json)) {
          claimedTaskIds[task.id] = true;
          claimedAny = true;
          TIME_FARM_STATS.taskClaim += 1;
          var reward = formatFarmEventPkg(json.pkg);
          var taskTag = getTimeFarmTaskName(task) + "(T" + task.id + ")";
          if (reward) {
            TIME_FARM_STATS.taskReward = mergeRewardText(TIME_FARM_STATS.taskReward, reward);
            log("🕰️ 时光任务领奖(" + taskTag + "): " + reward);
          } else {
            log("🕰️ 时光任务领奖(" + taskTag + "): 成功");
          }
          return;
        }
        var msg = timeFarmErrMsg(json);
        if (isTransientFailText(msg) && retry < transientRetries) {
          log("⚠️ 时光任务领奖繁忙(" + getTimeFarmTaskName(task) + "/T" + task.id + ")，第" + (retry + 1) + "次重试");
          return sleep(CONFIG.RETRY_WAIT_MS || 800).then(function () {
            return claimOne(task, retry + 1);
          });
        }
        if (isTimeFarmNoop(json) || /已领|已领取|领取过|未完成|条件不足|无可领|不可领取|不能领取/.test(msg)) {
          if (/已领|已领取|领取过/.test(msg)) claimedTaskIds[task.id] = true;
          if (CONFIG.DEBUG) logDebug("🕰️ 时光任务领奖(" + getTimeFarmTaskName(task) + "/T" + task.id + "): 无需执行(" + msg + ")");
          return;
        }
        TIME_FARM_STATS.errors += 1;
        log("⚠️ 时光任务领奖失败(" + getTimeFarmTaskName(task) + "/T" + task.id + "): " + msg);
      });
    }

    function runAt(idx) {
      if (idx >= candidates.length) return Promise.resolve(claimedAny);
      return claimOne(candidates[idx], 0)
        .then(function () {
          return sleep(CONFIG.WAIT_MS);
        })
        .then(function () {
          return runAt(idx + 1);
        });
    }
    return runAt(0);
  }

  function plantOne(landid, cropid) {
    return callTimeFarmApi(
      cookie,
      "plant",
      timeFarmParams(ctx, {
        landid: landid,
        cropid: cropid
      })
    ).then(function (json) {
      if (isTimeFarmOk(json)) return { ok: true, json: json };
      var msg = timeFarmErrMsg(json);
      if (isTimeFarmNoop(json)) {
        if (CONFIG.DEBUG) logDebug("🕰️ 时光种植 land=" + landid + " 无需执行(" + msg + ")");
        return { ok: false, noop: true, json: json };
      }
      TIME_FARM_STATS.errors += 1;
      log("⚠️ 时光种植失败 land=" + landid + ": " + msg);
      return { ok: false, noop: false, json: json };
    });
  }

  function maybeFertilize(list) {
    if (!CONFIG.TIME_FARM_FERTILIZE_ENABLE || didFertilize) return Promise.resolve(false);
    var toolid = Number(CONFIG.TIME_FARM_FERT_TOOLID || 0);
    if (!toolid || isNaN(toolid) || toolid < 1) return Promise.resolve(false);
    var target = null;
    for (var i = 0; i < list.length; i++) {
      var land = list[i] || {};
      var b = Number(land.b || 0);
      if (b > 0 && b < 6 && Number(land.landid || 0) > 0) {
        target = land;
        break;
      }
    }
    if (!target) return Promise.resolve(false);
    return callTimeFarmApi(
      cookie,
      "fertilize",
      timeFarmParams(ctx, {
        toolid: toolid,
        landid: Number(target.landid)
      })
    ).then(function (json) {
      if (!isTimeFarmOk(json)) {
        var msg = timeFarmErrMsg(json);
        if (isTimeFarmNoop(json)) {
          if (CONFIG.DEBUG) logDebug("🕰️ 时光施肥: 无需执行(" + msg + ")");
          return false;
        }
        TIME_FARM_STATS.errors += 1;
        log("⚠️ 时光施肥失败: " + msg);
        return false;
      }
      TIME_FARM_STATS.fertilize += 1;
      didFertilize = true;
      log("🕰️ 时光施肥: land=" + target.landid + " tool=" + toolid + " 成功");
      return true;
    });
  }

  function plantEmptyLands(list) {
    if (!CONFIG.TIME_FARM_PLANT_ENABLE) return Promise.resolve(0);
    var empties = [];
    for (var i = 0; i < list.length; i++) {
      var land = list[i] || {};
      if (Number(land.b || 0) === 0 && Number(land.landid || 0) > 0) empties.push(Number(land.landid));
    }
    if (!empties.length) return Promise.resolve(0);
    if (crop && Number(crop.amount || 0) <= 0) {
      crop = null;
      TIME_FARM_STATS.plantSkipReason = "时光种子数量不足";
    }
    if (!crop) {
      return callTimeFarmApi(cookie, "", timeFarmParams(ctx), true).then(function (seedJson) {
        crop = pickTimeFarmCrop(seedJson);
        if (!crop) {
          TIME_FARM_STATS.plantSkipReason = "未找到可用时光种子";
          log("⚠️ 时光种植: 未找到可用种子");
          return 0;
        }
        TIME_FARM_STATS.plantSkipReason = "";
        if (CONFIG.DEBUG) logDebug("🕰️ 时光种植选种: " + (crop.cName || ("cId" + crop.cId)) + " (cId=" + crop.cId + ")");
        return plantLoop();
      });
    }
    return plantLoop();

    function plantLoop() {
      var idx = 0;
      var succ = 0;
      function next() {
        if (idx >= empties.length) return Promise.resolve({ success: succ, tried: empties.length });
        if (crop && crop.amount != null && Number(crop.amount || 0) <= 0) {
          if (!succ) TIME_FARM_STATS.plantSkipReason = "时光种子数量不足";
          return Promise.resolve({ success: succ, tried: idx });
        }
        var landid = empties[idx++];
        return plantOne(landid, crop.cId)
          .then(function (ret) {
            if (ret && ret.ok) {
              succ += 1;
              if (crop.amount != null) crop.amount = Number(crop.amount || 0) - 1;
            } else if (ret && !ret.noop) {
              return { stop: true };
            }
          })
          .then(function (ret2) {
            if (ret2 && ret2.stop) return { success: succ, tried: idx };
            return null;
          })
          .then(function () {
            return sleep(CONFIG.WAIT_MS);
          })
          .then(next)
          .then(function (x) {
            return x || { success: succ, tried: idx };
          });
      }
      return next();
    }
  }

  function pass(round) {
    return fetchTimeFarmIndex(cookie, ctx).then(function (state) {
      if (!state) {
        TIME_FARM_STATS.errors += 1;
        log("⚠️ 时光农场: 读取状态失败");
        return;
      }
      if (round === 0) {
        TIME_FARM_STATS.startSum = cloneTimeFarmSum(state.sum);
        TIME_FARM_STATS.start = formatTimeFarmState(TIME_FARM_STATS.startSum);
        log("🕰️ 时光状态(模块开始): " + TIME_FARM_STATS.start);
        updateTimeFarmTaskSnapshot("开始", state);
      }
      var curState = state;
      var hasAction = false;
      var p = Promise.resolve();
      if (CONFIG.TIME_FARM_HARVEST_ENABLE && curState.sum.mature > 0) {
        p = p.then(function () {
          var before = curState.sum.mature;
          return doBatch("batchharvest", "收获").then(function (ret) {
            if (!ret || !ret.ok) return;
            return fetchTimeFarmIndex(cookie, ctx).then(function (afterState) {
              if (!afterState) return;
              curState = afterState;
              var delta = before - curState.sum.mature;
              if (delta < 0) delta = 0;
              if (delta > 0) {
                TIME_FARM_STATS.harvest += delta;
                hasAction = true;
                log("🕰️ 时光收获: +" + delta);
              } else if (CONFIG.DEBUG) {
                logDebug("🕰️ 时光收获: 接口成功但成熟地块未减少");
              }
            });
          });
        });
      }
      if (CONFIG.TIME_FARM_DIG_ENABLE && curState.sum.withered > 0) {
        p = p.then(function () {
          var before = curState.sum.withered;
          return doBatch("batchdig", "铲地").then(function (ret) {
            if (!ret || !ret.ok) return;
            return fetchTimeFarmIndex(cookie, ctx).then(function (afterState) {
              if (!afterState) return;
              curState = afterState;
              var delta = before - curState.sum.withered;
              if (delta < 0) delta = 0;
              if (delta > 0) {
                TIME_FARM_STATS.dig += delta;
                hasAction = true;
                log("🕰️ 时光铲地: +" + delta);
              } else if (CONFIG.DEBUG) {
                logDebug("🕰️ 时光铲地: 接口成功但枯萎地块未减少");
              }
            });
          });
        });
      }
      return p
        .then(function () {
          return fetchTimeFarmIndex(cookie, ctx);
        })
        .then(function (state2) {
          if (!state2) return null;
          curState = state2;
          if (
            !CONFIG.TIME_FARM_PLANT_ENABLE &&
            !CONFIG.TIME_FARM_FERTILIZE_ENABLE &&
            curState.sum.mature <= 0 &&
            curState.sum.withered <= 0
          ) {
            return curState;
          }
          return plantEmptyLands(curState.list).then(function (resPlant) {
            var n = 0;
            if (typeof resPlant === "number") n = resPlant;
            else if (resPlant && typeof resPlant.success === "number") n = resPlant.success;
            if (n > 0) {
              TIME_FARM_STATS.plant += n;
              TIME_FARM_STATS.plantSkipReason = "";
              hasAction = true;
              log("🕰️ 时光种植: +" + n);
            }
            return fetchTimeFarmIndex(cookie, ctx).then(function (state3) {
              if (state3) curState = state3;
              return curState;
            });
          });
        })
        .then(function (stateFinalBase) {
          if (!stateFinalBase) return null;
          return maybeFertilize(stateFinalBase.list).then(function (ferted) {
            if (ferted) hasAction = true;
            return fetchTimeFarmIndex(cookie, ctx).then(function (state4) {
              var cur = state4 || stateFinalBase;
              return claimTimeFarmTaskRewards(cur)
                .then(function (claimed) {
                  if (!claimed) return cur;
                  hasAction = true;
                  return fetchTimeFarmIndex(cookie, ctx).then(function (state5) {
                    return state5 || cur;
                  });
                })
                .then(function (lastState) {
                  if (lastState) {
                    TIME_FARM_STATS.endSum = cloneTimeFarmSum(lastState.sum);
                    TIME_FARM_STATS.end = formatTimeFarmState(TIME_FARM_STATS.endSum);
                    TIME_FARM_STATS.taskEnd = formatTimeFarmTasks(parseTimeFarmTasks(lastState.raw));
                  }
                  return { hasAction: hasAction, sum: lastState ? lastState.sum : null };
                });
            });
          });
        })
        .then(function (res) {
          if (!res) return;
          if (!TIME_FARM_STATS.end && res.sum) {
            TIME_FARM_STATS.endSum = cloneTimeFarmSum(res.sum);
            TIME_FARM_STATS.end = formatTimeFarmState(TIME_FARM_STATS.endSum);
          }
          if (!res.hasAction || round + 1 >= maxPass) return;
          return pass(round + 1);
        });
    });
  }

  return fetchTimeFarmContext(cookie)
    .then(function (c) {
      ctx = c;
      if (!ctx) {
        TIME_FARM_STATS.errors += 1;
        log("⚠️ 时光农场: 缺少 uIdx/uinY，跳过");
        return;
      }
      return fetchTimeFarmSpecialSeedMap(cookie)
        .then(function (added) {
          if (CONFIG.DEBUG && added > 0) {
            var keys = Object.keys(TIME_FARM_SPECIAL_SEED_MAP || {}).sort(function (a, b) {
              return Number(a) - Number(b);
            });
            logDebug("🕰️ 时光专用种子映射: 新增" + added + "，累计" + keys.length);
          }
        })
        .then(function () {
          return preloadTimeFarmSeedNames(cookie, ctx).then(function (addedName) {
            if (CONFIG.DEBUG && addedName > 0) {
              logDebug("🕰️ 时光种子名称映射: 新增" + addedName);
            }
          });
        })
        .then(function () {
          return pass(0);
        })
        .then(function () {
          return fetchTimeFarmIndex(cookie, ctx)
            .then(function (finalState) {
              if (finalState && finalState.sum) {
                TIME_FARM_STATS.endSum = cloneTimeFarmSum(finalState.sum);
                TIME_FARM_STATS.end = formatTimeFarmState(TIME_FARM_STATS.endSum);
                updateTimeFarmTaskSnapshot("结束", finalState);
              }
            })
            .catch(function () {
              return;
            })
            .then(function () {
              if (!TIME_FARM_STATS.end && TIME_FARM_STATS.start) {
                TIME_FARM_STATS.end = TIME_FARM_STATS.start;
                TIME_FARM_STATS.endSum = cloneTimeFarmSum(TIME_FARM_STATS.startSum);
              }
              if (!TIME_FARM_STATS.taskEnd && TIME_FARM_STATS.taskStart) {
                TIME_FARM_STATS.taskEnd = TIME_FARM_STATS.taskStart;
              }
              if (TIME_FARM_STATS.end) log("🕰️ 时光状态(模块结束): " + TIME_FARM_STATS.end);
            });
        });
    })
    .catch(function (e) {
      TIME_FARM_STATS.errors += 1;
      log("⚠️ 时光农场异常: " + e);
    });
}

/* =======================
 *  MAIN
 * ======================= */
function main() {
  bannerStart();
  var STOP_SIGNAL = "__STOP__";

  var cookie = buildCookie();
  var ranchCookie = cookie;
  if (!cookie) {
    log("❌ Cookie 缺失，请填写 INLINE_COOKIE 或环境变量 QQFARM_COOKIE");
    var openUrl = buildQQOpenUrl("https://mcapp.z.qq.com/mc/cgi-bin/wap_pasture_index");
    notify("🌾 QQ 农牧场助手", "Cookie 缺失", "请先设置 Cookie", { "open-url": openUrl });
    bannerEnd();
    return Promise.resolve();
  }
  log("🍪 Cookie来源: " + (COOKIE_SOURCE || "未知"));
  logCookieHealth(cookie);

  return ensureMcappAccess(cookie)
    .then(function (res) {
      if (!res || !res.ok) {
        var openUrl2 = buildQQOpenUrl("https://mcapp.z.qq.com/mc/cgi-bin/wap_pasture_index");
        notify("🌾 QQ 农牧场助手", "Cookie 失效", "点击进入牧场重新登录", {
          "open-url": openUrl2
        });
        bannerEnd();
        return Promise.reject(STOP_SIGNAL);
      }
      cookie = res.cookie || cookie;
      ranchCookie = res.ranchCookie || cookie;
      LAST_RANCH_COOKIE = ranchCookie;
      return ensureFarmAccess(cookie).then(function (farmRes) {
        if (farmRes && farmRes.cookie) cookie = farmRes.cookie;
        return probeRanchGrass(ranchCookie);
      });
    })
    .then(function (grassCount) {
      return refreshBagStats(cookie).then(function () {
        return captureFarmStartStats(cookie)
          .then(function () {
            return captureStartRanchStatus(cookie);
          })
          .then(function () {
            return captureStartFishStatus(cookie);
          })
          .then(function () {
            return decidePlantSeed(cookie, grassCount).then(function (seedId) {
              if (seedId !== null && seedId !== undefined) CONFIG.PLANT_CID = seedId;
            });
          })
          .catch(function (e) {
            log("⚠️ 启动阶段种植策略失败: " + errText(e));
            return;
          });
      });
    })
    .then(function () {
      if (!ranchEnabled()) return;
      return runRanch(CONFIG.RANCH_BASE, ranchCookie).then(function () {
        return recheckGrassAfterFeed(ranchCookie).then(function (grassCount) {
          if (grassCount === null || grassCount === undefined) return;
          return decidePlantSeed(cookie, grassCount).then(function (seedId) {
            if (seedId !== null && seedId !== undefined) CONFIG.PLANT_CID = seedId;
          });
        }).catch(function (e) {
          log("⚠️ 牧场后复查种植策略失败: " + errText(e));
          return;
        });
      });
    })
    .then(function () {
      return runFarmAuto(cookie).then(function () {
        return runTimeFarm(cookie).then(function () {
          return runFarmEvents(cookie).then(function () {
            return farmSignIn(cookie).then(function () {
              return feedRanchFromWarehouse(CONFIG.RANCH_BASE, cookie, ranchCookie).then(function () {
                return farmSellAll(cookie);
              });
            });
          });
        });
      });
    })
    .then(function () {
      return refreshBagStats(cookie);
    })
    .then(function () {
      if (!fishEnabled()) return;
      return runFish(CONFIG.FISH_BASE, cookie);
    })
    .then(function () {
      if (!hiveEnabled()) return;
      return runHive(cookie);
    })
    .then(function () {
      return refreshFinalStats(cookie);
    })
    .then(function () {
      return refreshEndFishStatus(cookie);
    })
    .then(function () {
      log(SUBLINE);
      log("【🧭 开始状态】");
      log(moduleTag("农场作物") + formatFarmStatusLine(STATUS_START.farm));
      log(moduleTag("农场经验") + formatLevelExpStatus(STATS_START.farm));
      log(moduleTag("牧草果实") + formatRanchFeedInfoLine(RANCH_FEED_STATE.start));
      log(moduleTag("牧场动物") + plainStatusText(STATUS_START.ranch));
      log(moduleTag("牧场经验") + formatLevelExpStatus(STATS_START.ranch));
      log(moduleTag("持有金币") + formatMoneyStatus(STATS_START.farm));
      log(moduleTag("鱼塘养鱼") + plainStatusText(STATUS_START.fish));
      log(moduleTag("时光农场") + (timeFarmEnabled() ? timeFarmStateText(TIME_FARM_STATS.startSum, TIME_FARM_STATS.start) : "未启用"));
      log(moduleTag("蜂巢采蜜") + (hiveEnabled() ? HIVE_STATS.start || "未知" : "未启用"));
      log(SUBLINE);
      log("【🧭 结束状态】");
      log(moduleTag("农场作物") + formatFarmStatusLine(STATUS_END.farm));
      log(moduleTag("农场经验") + formatLevelExpStatus(STATS_END.farm));
      log(moduleTag("牧草果实") + formatRanchFeedInfoLine(RANCH_FEED_STATE.end || RANCH_FEED_STATE.start));
      log(moduleTag("牧场动物") + plainStatusText(STATUS_END.ranch));
      log(moduleTag("牧场经验") + formatLevelExpStatus(STATS_END.ranch));
      log(moduleTag("持有金币") + formatMoneyStatus(STATS_END.farm));
      log(moduleTag("鱼塘养鱼") + plainStatusText(STATUS_END.fish));
      log(
        moduleTag("时光农场") +
          (timeFarmEnabled()
            ? timeFarmStateText(TIME_FARM_STATS.endSum || TIME_FARM_STATS.startSum, TIME_FARM_STATS.end || TIME_FARM_STATS.start)
            : "未启用")
      );
      log(moduleTag("蜂巢采蜜") + (hiveEnabled() ? HIVE_STATS.end || HIVE_STATS.start || "未知" : "未启用"));
      log(SUBLINE);
      var logBody = summaryLines().join("\n");
      var notifyBody = buildNotifyBody();
      log("✅ 任务汇总:\n" + logBody);
      notify("🌾 QQ 农牧场助手", "✅ 运行完成", notifyBody);
      bannerEnd();
    })
    .catch(function (e) {
      if (e === STOP_SIGNAL) return;
      var msg = errText(e);
      log("❌ 异常: " + msg);
      notify("🌾 QQ 农牧场助手", "❌ 运行失败", msg);
      bannerEnd();
    });
}

main().then(function () {
  $.done();
});




