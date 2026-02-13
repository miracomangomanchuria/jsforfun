/*
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
  RANCH_DIRECT_REFERER: "", // 直连牧场时的 Referer（空=使用农场首页）

  // 农场 WAP（售卖/签到等）
  FARM_WAP_BASE: "https://mcapp.z.qq.com",
  FARM_G_UT: "", // 可手动指定；空则自动探测/沿用牧场 g_ut

  // 农场 JSON（farmTime/farmKey）
  FARM_JSON_BASE: "https://nc.qzone.qq.com",
  FARM_JSON_ENABLE: true,
  FARM_JSON_FALLBACK_WAP: true,
  FARM_JSON_ENCODE_KEY: "@#$N*9Fi@KLJH#$dfghKLJHdfgh!$Fl12aOAISDs",
  FARM_JSON_USE_SWF_PARAMS: true,
  FARM_JSON_EMPTY_UIDX: true,
  FARM_JSON_LOCK_HEURISTIC: true,
  FARM_JSON_LOCK_GUARD: true,
  FARM_JSON_LOCK_GUARD_MIN_TOTAL: 18,
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
  FISH_MAX_POND: 6,
  // 鱼塘复查安全上限（0=不限制，达到条件即退出）
  FISH_CLEANUP_MAX_PASS: 0,
  // 空池塘未知时，尝试通过购买预览页补判空位
  FISH_EMPTY_FALLBACK: true,

  // 播种作物（兼容旧版/现代接口时使用）
  PLANT_CID: "40",
  GRASS_THRESHOLD: 10000, // 牧草果实库存低于此值，优先种牧草

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
    fish_harvest: true
  },

  // 调试开关
  DEBUG: true,
  // 诊断模式：输出请求/响应摘要（用于定位空页/跳转）
  DIAG: true,
  // 是否输出背包/仓库统计
  LOG_BAG_STATS: false
};

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

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function nowTs() {
  return Math.floor(Date.now() / 1000);
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
  return /农场|牧场|鱼塘|背包|大乐斗|会话/.test(key) ||
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
  var keys = cookieKeyList(cookie);
  var hash = simpleHash(cookie || "");
  log("🛰️ REQ[" + (label || "请求") + "] " + (url || ""));
  log("🧾 CookieKeys: " + (keys || "无") + " | Hash: " + hash);
  if (referer) log("↪️ Referer: " + referer);
}

function logDiagResponse(label, url, html, status) {
  if (!shouldDiag(label, url)) return;
  var sum = summarizeHtml(html || "");
  log("🛰️ RES[" + (label || "响应") + "] status=" + (status || "-") + " len=" + sum.len + " title=" + (sum.title || "无") + " flags=" + (sum.flags || "无"));
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
    log("⚠️ Cookie缺少 openid/token，6字段不完整，直连可能失败");
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
      if (err) return reject(err);
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
          logDebug((label || "请求") + " 异常重试 " + attempt + "/" + tries + " " + e);
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
  var m = h.match(/https?:\/\/mcapp\.z\.qq\.com[^"'\\s]*wap_pasture_index[^"'\\s]*/i);
  if (m) return m[0];
  m = h.match(/mcapp\.z\.qq\.com[^"'\\s]*wap_pasture_index[^"'\\s]*/i);
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
  var m = h.match(/(\/(?:nc|mc)\/cgi-bin\/wap_[^"'\\s>]+)/i);
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
  var meta = h.match(/http-equiv=["']?refresh["']?[^>]*content=["']?[^;]+;\\s*url=([^"'>\\s]+)/i);
  if (meta) return meta[1];
  var js = h.match(/location\\.href\\s*=\\s*['"]([^'"]+)['"]/i);
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
      var altUrl = base + "/mc/cgi-bin/wap_pasture_index?sid=" + sid + "&g_ut=" + gut + "&source=daledou";
      var referer = buildReferer(gut);
      return getHtmlFollow(indexUrl, cookieVal, referer, label || "牧场", 0).then(function (resp) {
        var ctx = extractRanchContext(resp.body);
        setStartStats("ranch", parseCommonStats(resp.body));
        if (ctx.sid && ctx.g_ut && isRanchHome(resp.body)) {
          CONFIG.RANCH_G_UT = ctx.g_ut || gut;
          LAST_RANCH_CONNECT = label || "直连";
          return { cookie: resp.cookie || cookieVal, ok: true, ranchCookie: resp.cookie || cookieVal };
        }
        if (ctx.sid && ctx.g_ut && !isRanchHome(resp.body)) {
          log("⚠️ 牧场直连返回非主页(" + (extractTitle(resp.body) || "无标题") + ")");
        }
        return getHtmlFollow(altUrl, resp.cookie || cookieVal, referer, (label || "牧场") + "-兼容", 0).then(function (alt) {
          var ctx2 = extractRanchContext(alt.body);
          if (ctx2.sid && ctx2.g_ut && isRanchHome(alt.body)) {
            CONFIG.RANCH_G_UT = ctx2.g_ut || gut;
            LAST_RANCH_CONNECT = (label || "直连") + "-兼容";
            setStartStats("ranch", parseCommonStats(alt.body));
            return { cookie: alt.cookie || resp.cookie || cookieVal, ok: true, ranchCookie: alt.cookie || resp.cookie || cookieVal };
          }
          if (ctx2.sid && ctx2.g_ut && !isRanchHome(alt.body)) {
            log("⚠️ 牧场兼容入口非主页(" + (extractTitle(alt.body) || "无标题") + ")");
          }
          return step(idx + 1);
        });
      });
    }
    return step(0);
  }

  if (liteCookie) {
    return tryDirect(liteCookie, "6字段直连")
      .then(function (ok) {
        if (ok) {
          log("✅ 6 字段直连牧场成功");
          return { cookie: cookie, ok: true, ranchCookie: ok.ranchCookie || liteCookie };
        }
        log("⚠️ 6 字段直连失败，改用原始 Cookie");
        return tryDirect(cookie, "原始Cookie直连");
      })
      .catch(function () {
        log("⚠️ 6 字段直连异常，改用原始 Cookie");
        return tryDirect(cookie, "原始Cookie直连");
      });
  }

  return tryDirect(cookie, "原始Cookie直连")
    .then(function (ok) {
      if (ok) return ok;
      log("⚠️ 牧场直连失败，尝试大乐斗跳转");
      return fetchFromDld(cookie);
    })
    .catch(function () {
      log("⚠️ 牧场直连异常，尝试大乐斗跳转");
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
  var hardLink = "http://mcapp.z.qq.com/mc/cgi-bin/wap_pasture_index?sid=&g_ut=1&source=daledou";
  function step(url, curCookie, referer, depth) {
    if (depth > 3) return Promise.resolve({ cookie: curCookie, link: "" });
    return getWithRetry(
      {
        method: "GET",
        url: url,
        headers: buildDldHeaders(curCookie)
      },
      "大乐斗"
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
        log("⚠️ 大乐斗页面未发现牧场入口，改用固定入口");
        link = hardLink;
      }
      return getHtmlFollow(link, merged, dldUrl, "牧场跳转", 0).then(function (resp2) {
        var merged2 = mergeSetCookie(merged, getHeader(resp2.headers || {}, "set-cookie"));
        var ctx = extractRanchContext(resp2.body);
        if (ctx.sid && ctx.g_ut) {
          log("✅ 大乐斗跳转成功进入牧场");
          LAST_RANCH_CONNECT = "大乐斗跳转";
          return { cookie: merged2, ok: true };
        }
        log("⚠️ 大乐斗跳转后仍未进入牧场");
        return { cookie: merged2, ok: false };
      });
    })
    .catch(function (e) {
      log("⚠️ 大乐斗跳转失败: " + e);
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
  errors: 0
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
var GRASS_LOW_SEEN = false;
var PLANT_SEED_LOCKED = false;
var LAST_RANCH_CONNECT = "";
var LAST_FISH_ENTRY_URL = "";
var PURCHASE_LOGS = [];
var LAST_FISH_EMPTY = null;
var LAST_FISH_HAS_EMPTY = false;
var NO_MONEY = { farmSeed: false, grassSeed: false, fishSeed: false };
var FISH_FEED_EMPTY_SEEN = false;
var FISH_FEED_NOOP_SEEN = false;

function bannerStart() {
  log(LINE);
  log("🌾 QQ 农牧场助手");
  var meta = "⏱ " + new Date().toLocaleString() + " | " + ENV_NAME;
  if (CONFIG.DEBUG) meta += " | DEBUG";
  log(meta);
  log(LINE);
  RUN_START = Date.now();
  FARM_CTX.lockHeuristicOff = false;
  FISH_FEED_NOOP_SEEN = false;
}

function bannerEnd() {
  log(LINE);
  log("✅ 结束 | 农场 " + actionSummaryLine());
  log("🐮 牧场 " + ranchSummaryLine() + " | 🐟 鱼塘 " + fishSummaryLine());
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

function buildRanchHeaders(cookie, referer) {
  return {
    "User-Agent":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Encoding": "identity",
    "Accept-Language": "zh-CN,zh;q=0.9",
    Cookie: cookie,
    Referer: referer || "https://mcapp.z.qq.com/"
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
  var m = msg.match(/花费\\s*([0-9]+)\\s*个?金币/);
  if (m) return Number(m[1] || 0);
  m = msg.match(/共花费\\s*([0-9]+)\\s*个?金币/);
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
  var m = text.match(/为\\s*([0-9]+)\\s*块?池塘.*?喂/);
  if (m) return Number(m[1] || 0);
  m = text.match(/喂鱼[^0-9]{0,6}([0-9]+)\\s*块?池塘/);
  if (m) return Number(m[1] || 0);
  return 0;
}

function parseRanchHelpCount(textOrHtml) {
  var text = stripTags(textOrHtml || "");
  if (!text) return 0;
  var m = text.match(/清理[^xX0-9]{0,8}[xX]([0-9]+)/);
  if (m) return Number(m[1] || 0);
  m = text.match(/清理[^0-9]{0,8}([0-9]+)\\s*个/);
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
  m = text.match(/成功在\\s*([0-9]+)\\s*块空地上种植/);
  if (m) return Number(m[1] || 0);
  m = text.match(/成功种植\\s*([0-9]+)\\s*块/);
  if (m) return Number(m[1] || 0);
  m = text.match(/种植[^0-9]{0,6}([0-9]+)\\s*块/);
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
  text = text.replace(/\\s+/g, " ");
  var re = /单价[:：]?\\s*([0-9]+)/g;
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
  var m = text.match(/使用\\s*([^\\d,，。！!]{0,12}?鱼食)\\s*([0-9]+)\\s*袋/);
  if (m) {
    return { name: normalizeSpace(m[1]), count: Number(m[2] || 0) };
  }
  m = text.match(/使用\\s*([0-9]+)\\s*袋/);
  if (m) {
    return { name: "鱼食", count: Number(m[1] || 0) };
  }
  return null;
}

function parseFishPlantCountFromMsg(msg) {
  if (!msg) return 0;
  var text = String(msg);
  var m = text.match(/放养[^0-9]{0,6}([0-9]+)\\s*条/);
  if (m) return Number(m[1] || 0);
  m = text.match(/养殖了\\s*([0-9]+)\\s*条/);
  if (m) return Number(m[1] || 0);
  m = text.match(/池塘养殖了\\s*([0-9]+)\\s*条/);
  if (m) return Number(m[1] || 0);
  m = text.match(/成功[^0-9]{0,6}([0-9]+)\\s*条/);
  if (m) return Number(m[1] || 0);
  return 0;
}

function parseFishHarvestCountFromMsg(msg) {
  if (!msg) return 0;
  var text = String(msg);
  var m = text.match(/收获了\\s*([0-9]+)\\s*条/);
  if (m) return Number(m[1] || 0);
  m = text.match(/成功收获[^0-9]{0,6}([0-9]+)\\s*条/);
  if (m) return Number(m[1] || 0);
  return 0;
}

function parseRanchFeedCountFromMsg(msg) {
  if (!msg) return 0;
  var text = String(msg);
  var m = text.match(/成功添加\\s*([0-9]+)\\s*[棵颗]/);
  if (m) return Number(m[1] || 0);
  return 0;
}

function parseRanchHarvestCountFromMsg(msg) {
  if (!msg) return 0;
  var text = stripTags(String(msg || "")).replace(/\\s+/g, " ").trim();
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
  if (/成功收获了\\s*获得经验/.test(text)) return true;
  if (/成功收获/.test(text) && /获得经验/.test(text) && !/[0-9]/.test(text) && !/[×xX]/.test(text)) {
    return true;
  }
  return false;
}

function parseRanchProductCountFromMsg(msg) {
  if (!msg) return 0;
  var text = stripTags(String(msg || "")).replace(/\\s+/g, " ").trim();
  if (!text) return 0;
  var m = text.match(/成功将\\s*([0-9]+)\\s*只/);
  if (m) return Number(m[1] || 0);
  m = text.match(/赶去生产[^0-9]{0,8}([0-9]+)\\s*只/);
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
  var max = CONFIG.FISH_MAX_POND || 6;
  var arr = [];
  for (var i = 0; i < max; i++) arr.push(i);
  return arr.join(",");
}

function firstMatch(html, reg) {
  var m = reg.exec(html);
  return m ? m[1] : "";
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
  var re = /wap_pasture_help\\?[^\"'>]*/g;
  var list = [];
  var m;
  while ((m = re.exec(h))) list.push(m[0].replace(/\\s+/g, ""));
  return uniqLinks(list);
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
    var nm = text.match(/^\s*\d+\)\s*([^:：\s]+)\s*[:：]/);
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
  var text = stripTags(html);
  var m =
    text.match(/牧草[^0-9]{0,8}([0-9]+)/) ||
    text.match(/([0-9]+)[^0-9]{0,8}牧草/) ||
    text.match(/牧草\\s*x\\s*([0-9]+)/i) ||
    text.match(/牧草\\s*\\((\\d+)\\)/);
  if (!m) return null;
  var v = parseInt(m[1], 10);
  return isNaN(v) ? null : v;
}

function parseFeedPreInfo(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var info = { B_UID: "", total: null, n: null, cap: 1000 };
  var m = h.match(/name=["']B_UID["']\\s+value=["']([^"']+)/i);
  if (m) info.B_UID = m[1];
  m = h.match(/name=["']total["']\\s+value=["']([^"']+)/i);
  if (m) info.total = parseInt(m[1], 10);
  m = h.match(/name=["']n["']\\s+value=["']([^"']+)/i);
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
    text.match(/剩余饲料[:：]?\\s*([0-9]+)/) ||
    text.match(/你目前剩余饲料\\s*([0-9]+)/);
  if (m) {
    var n2 = parseInt(m[1], 10);
    if (!isNaN(n2)) info.n = n2;
  }
  m = clean.match(/仓库里还剩([0-9]+)颗?牧草/) || text.match(/仓库里还剩\\s*([0-9]+)\\s*颗?牧草/);
  if (m) {
    var t2 = parseInt(m[1], 10);
    if (!isNaN(t2)) info.total = t2;
  }
  m = text.match(/最多可(?:喂|放|添加)\\s*([0-9]+)/);
  if (m) {
    var c2 = parseInt(m[1], 10);
    if (!isNaN(c2)) info.cap = c2;
  }
  return info;
}

function extractFeedFormAction(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var m = h.match(/<form[^>]+action=["']([^"']*wap_pasture_feed_food[^"']*)/i);
  return m ? m[1] : "";
}

function extractFishLevel(html) {
  var text = stripTags(html);
  var m = text.match(/等级[:：]?\\s*([0-9]+)/);
  return m ? m[1] : "";
}

function extractFishFertilizeIndices(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var idx = {};
  var re = /wap_farm_fish_fertilize\\?[^\"\\s>]*index=([0-9]+)/g;
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
    links.push(m[0].replace(/\\s+/g, ""));
  }
  return links;
}

function extractFishHarvestIndex(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var m = h.match(/wap_farm_fish_harvest\\?[^\"\\s>]*index=([0-9,]+)/);
  return m ? m[1] : "";
}

function extractFishPlantLink(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var m = h.match(/wap_fish_plant\\?[^\"'>]*/);
  return m ? m[0].replace(/\\s+/g, "") : "";
}

function extractFishBuyFids(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var ids = [];
  var seen = {};
  var re = /wap_fish_buy_(?:pre_)?new\\?[^\"'>]*fid=([0-9]+)/g;
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
  var re = /<p>\\s*\\d+\\.\\s*([^<(]+?)\\s*\\([^)]*\\)[\\s\\S]{0,200}?wap_fish_buy_(?:pre_)?new\\?[^\"'>]*fid=([0-9]+)/g;
  var m;
  while ((m = re.exec(h))) {
    var name = (m[1] || "").replace(/\\s+/g, " ").trim();
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
  var m = text.match(/最多可购买\\s*([0-9]+)/);
  if (!m) return null;
  var v = parseInt(m[1], 10);
  return isNaN(v) ? null : v;
}

function extractFishEmptyPonds(html) {
  var text = stripTags(html || "");
  var clean = text.replace(/\s+/g, "");
  var m = clean.match(/你有([0-9]+)块空池塘/);
  if (!m) m = text.match(/你有\\s*([0-9]+)\\s*块空池塘/);
  if (!m) m = clean.match(/你有([0-9]+)块空鱼塘/);
  if (!m) m = text.match(/你有\\s*([0-9]+)\\s*块空鱼塘/);
  if (!m) m = clean.match(/你有([0-9]+)块空鱼池/);
  if (!m) m = text.match(/你有\\s*([0-9]+)\\s*块空鱼池/);
  if (!m) m = clean.match(/空池塘[:：]?([0-9]+)/);
  if (!m) m = clean.match(/空鱼塘[:：]?([0-9]+)/);
  if (!m) m = clean.match(/空鱼池[:：]?([0-9]+)/);
  if (!m) return null;
  var v = parseInt(m[1], 10);
  return isNaN(v) ? null : v;
}

function extractFishEntryLink(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var m = h.match(/wap_(?:farm_)?fish_index\\?[^\"'>]*/);
  if (m) return m[0].replace(/\\s+/g, "");
  m = h.match(/fish_index\\?[^\"'>]*/);
  return m ? m[0].replace(/\\s+/g, "") : "";
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
  var re = new RegExp(name + "[^：]{0,80}：\\s*([0-9]+)\\s*个");
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
  if (!CROP_NAME_MAP[key] || /^cId\\d+/.test(CROP_NAME_MAP[key])) CROP_NAME_MAP[key] = nm;
}

function getCropNameByCid(cid) {
  if (!cid) return "";
  var key = String(cid);
  return CROP_NAME_MAP[key] || ("cId" + key);
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
  var re1 = /收获了?\\s*([0-9]+)\\s*个\\s*([^\\s，。,.]+)/g;
  while ((m = re1.exec(text))) {
    var n1 = Number(m[1] || 0);
    var name1 = normalizeSpace(m[2] || "");
    if (!n1 || !name1) continue;
    if (/^(金币|经验|点券|经验值|积分|贡献|人气)$/.test(name1)) continue;
    list.push({ name: name1, count: n1 });
  }
  var re2 = /([^\\s，。,.]+)\\s*[×xX]\\s*([0-9]+)/g;
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

function formatFishOpsSum() {
  var total =
    FISH_STATS.feed + FISH_STATS.harvest + FISH_STATS.plant + FISH_STATS.buy + FISH_STATS.sell;
  if (!total) return "";
  return (
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
    " 合计" +
    total
  );
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
  var map = {};
  for (var i = 0; i < list.length; i++) {
    var it = list[i];
    if (!it || !it.name) continue;
    var key = it.name + (it.status ? "(" + it.status + ")" : "");
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
  var mark = "牧场动物及产品";
  if (seg.indexOf(mark) >= 0) seg = seg.substring(seg.indexOf(mark) + mark.length);
  var endMarks = ["商店", "仓库", "背包", "客服", "去我的农场", "去我的餐厅", "大乐斗", "个人中心"];
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
  return /(待收|可收获|成熟)/.test(st);
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
  if (!list.length) return;
  if (isStart) {
    FARM_STATUS_JSON_START = list;
    STATUS_START.farm = list;
    setFarmPlaceNameFromStatus(list);
  } else {
    FARM_STATUS_JSON_END = list;
    STATUS_END.farm = list;
  }
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
  if (FISH_STATS.harvest === 0 && !hasMatureStatus(STATUS_START.fish)) {
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
      var stats = parseCommonStats(ret.body || "");
      setEndStats("farm", stats);
      if (!CONFIG.FARM_JSON_ENABLE) {
        STATUS_END.farm = parseFarmStatus(ret.body || "");
      } else if (!FARM_STATUS_JSON_END || FARM_STATUS_JSON_END.length === 0) {
        // JSON 优先，未获取到时不使用 WAP 状态
      }
      return getHtmlFollow(ranchUrl, ret.cookie || cookie, null, "牧场统计", 0);
    })
    .then(function (html2) {
      var stats2 = parseCommonStats(html2.body || "");
      setEndStats("ranch", stats2);
      STATUS_END.ranch = parseRanchStatus(html2.body || "");
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
      setStartStats("farm", parseCommonStats(ret.body || ""));
      if (!CONFIG.FARM_JSON_ENABLE) {
        STATUS_START.farm = parseFarmStatus(ret.body || "");
        setFarmPlaceNameFromStatus(STATUS_START.farm);
      }
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
      setStartStats("ranch", parseCommonStats(ret.body || ""));
      STATUS_START.ranch = parseRanchStatus(ret.body || "");
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
      LAST_FISH_EMPTY = extractFishEmptyPonds(html);
      LAST_FISH_HAS_EMPTY =
        (LAST_FISH_EMPTY !== null && LAST_FISH_EMPTY !== undefined && LAST_FISH_EMPTY > 0) ||
        (html.indexOf("一键养殖") >= 0 || html.indexOf("空池塘") >= 0);
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

function ensureArray(v) {
  return Object.prototype.toString.call(v) === "[object Array]" ? v : [];
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

function fishSummaryLine() {
  return (
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
    FISH_STATS.errors
  );
}

function summaryLines() {
  var farmLine =
    "【农场】收" +
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
    " 错" +
    ACTION_STATS.errors +
    " | 售" +
    FARM_EXTRA.sell +
    " 签" +
    FARM_EXTRA.signin;

  var ranchLine =
    "【牧场】收" +
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
    RANCH_STATS.errors;

  var fishLine =
    "【鱼塘】喂" +
    FISH_STATS.feed +
    " 收" +
    FISH_STATS.harvest +
    " 下" +
    FISH_STATS.plant +
    " 卖" +
    FISH_STATS.sell +
    " 买" +
    FISH_STATS.buy +
    " 错" +
    FISH_STATS.errors;

  var farmStatusStart = formatFarmStatusCountsNoLock("始:", STATUS_START.farm);
  var farmStatusEnd = formatFarmStatusCountsNoLock("终:", STATUS_END.farm);
  var farmDeltaLine = formatFarmStatusDelta(STATUS_START.farm, STATUS_END.farm, false);
  var harvestableDelta = formatHarvestableDelta(STATUS_START.farm, STATUS_END.farm);
  var actionDetails = farmActionDetailLine();
  var harvestDetail = buildHarvestDetailLine(6);
  var harvestTypeCount = getHarvestTypeCount();
  var harvestDetailLine = "";
  if (harvestDetail) {
    harvestDetailLine = (harvestTypeCount ? harvestTypeCount + "种 | " : "") + harvestDetail;
  }
  var harvestTypeLine = !harvestDetailLine && harvestTypeCount ? "【收获种类】" + harvestTypeCount : "";
  var plantFailLine = buildPlantFailLine();
  var plantSkipLine = buildPlantSkipLine();
  var witheredRecon = formatWitheredRecon(STATUS_START.farm, STATUS_END.farm);
  var emptyRecon = formatEmptyPlantRecon(STATUS_START.farm, STATUS_END.farm);
  var maintainSum = formatFarmMaintainSum();
  var ranchSum = formatRanchOpsSum();
  var fishSum = formatFishOpsSum();
  var lines = [
    farmLine,
    ranchLine,
    fishLine,
    "【🧾 农场状态】" + farmStatusStart + " | " + farmStatusEnd,
    farmDeltaLine ? "【📈 农场Δ】" + farmDeltaLine : "",
    harvestableDelta ? "【🍎 可收变化】" + harvestableDelta : "",
    witheredRecon ? "【🪓 枯萎变化】" + witheredRecon : "",
    emptyRecon ? "【🌱 空地变化】" + emptyRecon : "",
    maintainSum ? "【🧹 维护合计】" + maintainSum : "",
    harvestDetailLine ? "【🌾 收获明细】" + harvestDetailLine : "",
    harvestTypeLine,
    plantSkipLine ? "【ℹ️ 播种未执行】" + plantSkipLine : "",
    plantFailLine ? "【⚠️ 播种失败】" + plantFailLine : "",
    ranchSum ? "【🐮 牧场合计】" + ranchSum : "",
    fishSum ? "【🐟 鱼塘合计】" + fishSum : "",
    "【🧩 动作详情】" + actionDetails[0],
    "【🧩 动作详情】" + actionDetails[1],
    "【📊 等级】" + formatStatsLine("农场/鱼塘", STATS_START.farm, STATS_END.farm),
    "【📊 等级】" + formatStatsLine("牧场", STATS_START.ranch, STATS_END.ranch)
  ];
  if (CONFIG.LOG_BAG_STATS) {
    lines.push(
      "【背包】种子[" + buildBagTag(BAG_STATS.seed.items, 3) + "] 鱼苗[" + buildBagTag(BAG_STATS.fish.items, 3) + "]"
    );
  }
  return lines.filter(function (it) {
    return it;
  });
}

function buildNotifyBody() {
  var totalErr = ACTION_STATS.errors + RANCH_STATS.errors + FISH_STATS.errors;
  var tag = LAST_RANCH_CONNECT ? " · " + LAST_RANCH_CONNECT : "";
  var costMs = RUN_START ? Date.now() - RUN_START : 0;
  var costSec = costMs ? Math.round(costMs / 1000) : 0;
  var brief =
    "✨简报：🌾收" +
    ACTION_STATS.harvest +
    " 种" +
    PLANT_STATS.total +
    " 售" +
    FARM_EXTRA.sell +
    " 签" +
    FARM_EXTRA.signin +
    " | 🐮收" +
    formatCountWithUnknown(RANCH_STATS.harvest, RANCH_STATS.harvestUnknown) +
    " 产" +
    RANCH_STATS.product +
    " 售" +
    RANCH_STATS.sell +
    " | 🐟收" +
    FISH_STATS.harvest +
    " 下" +
    FISH_STATS.plant +
    " 买" +
    FISH_STATS.buy +
    " 售" +
    FISH_STATS.sell +
    " · ⚠️" +
    totalErr +
    tag;
  var sep = SUBLINE;

  var seedParts = [];
  for (var k in PLANT_STATS.byCid) {
    if (!PLANT_STATS.byCid.hasOwnProperty(k)) continue;
    seedParts.push("cId=" + k + " x" + PLANT_STATS.byCid[k]);
  }
  var seedLine = seedParts.length ? seedParts.join("，") : "无";
  var bagSeedTag = "";
  var bagFishTag = "";
  if (CONFIG.LOG_BAG_STATS) {
    bagSeedTag = buildBagTag(BAG_STATS.seed.items, 3);
    bagFishTag = buildBagTag(BAG_STATS.fish.items, 3);
  }

  var spendParts = [];
  var consumeParts = [];
  if (FISH_STATS.feedUsed > 0) {
    var feedName = FISH_STATS.feedItem || "鱼食";
    consumeParts.push(feedName + "×" + FISH_STATS.feedUsed + "袋");
  }
  var consumeLine = consumeParts.length ? consumeParts.join("；") : "";

  var spendSum =
    MONEY_STATS.farmBuy + MONEY_STATS.grassBuy + MONEY_STATS.fishBuy + MONEY_STATS.fishFeed;
  if (MONEY_STATS.farmBuy > 0) spendParts.push("种子" + MONEY_STATS.farmBuy);
  if (MONEY_STATS.grassBuy > 0) spendParts.push("牧草种子" + MONEY_STATS.grassBuy);
  if (MONEY_STATS.fishBuy > 0) spendParts.push("鱼苗" + MONEY_STATS.fishBuy);
  if (MONEY_STATS.fishFeed > 0) spendParts.push("鱼食" + MONEY_STATS.fishFeed);
  var moneyLine =
    "卖出：农场" +
    MONEY_STATS.farmSell +
    " 牧场" +
    MONEY_STATS.ranchSell +
    " 鱼塘" +
    MONEY_STATS.fishSell +
    (spendParts.length ? " | 花费：" + spendParts.join(" ") : "");
  var purchaseLine = summarizePurchases();
  if (!purchaseLine && !consumeLine) {
    var d =
      STATS_START.farm && STATS_END.farm && STATS_START.farm.money != null && STATS_END.farm.money != null
        ? STATS_END.farm.money - STATS_START.farm.money
        : 0;
    if (d < 0 && spendSum === 0) purchaseLine = "金币减少，原因未记录(可能购买/系统扣费)";
  }
  var noActionHint = buildNoActionHint();

  var farmLine =
    "农场：收" +
    ACTION_STATS.harvest +
    " 种" +
    PLANT_STATS.total +
    " 除" +
    ACTION_STATS.clearWeed +
    " 虫" +
    ACTION_STATS.spraying +
    " 水" +
    ACTION_STATS.water;

  var ranchLine =
    "牧场：收" +
    formatCountWithUnknown(RANCH_STATS.harvest, RANCH_STATS.harvestUnknown) +
    " 产" +
    RANCH_STATS.product +
    " 喂" +
    RANCH_STATS.feed +
    " 清" +
    RANCH_STATS.help;

  var fishLine =
    "鱼塘：喂" +
    FISH_STATS.feed +
    " 收" +
    FISH_STATS.harvest +
    " 下" +
    FISH_STATS.plant +
    " 买" +
    FISH_STATS.buy +
    " 卖" +
    FISH_STATS.sell;

  var farmStatusStart = formatFarmStatusCountsNoLock("开始:", STATUS_START.farm);
  var farmStatusEnd = formatFarmStatusCountsNoLock("结束:", STATUS_END.farm);
  var farmDelta = formatFarmStatusDelta(STATUS_START.farm, STATUS_END.farm, false);
  var harvestableDelta = formatHarvestableDelta(STATUS_START.farm, STATUS_END.farm);
  var harvestDetail = buildHarvestDetailLine(6);
  var harvestTypeCount = getHarvestTypeCount();
  var harvestDetailLine = "";
  if (harvestDetail) {
    harvestDetailLine = (harvestTypeCount ? harvestTypeCount + "种 | " : "") + harvestDetail;
  }
  var harvestTypeLine = !harvestDetailLine && harvestTypeCount ? "🌾 收获种类 | " + harvestTypeCount : "";
  var plantFailLine = buildPlantFailLine();
  var plantSkipLine = buildPlantSkipLine();
  var witheredRecon = formatWitheredRecon(STATUS_START.farm, STATUS_END.farm);
  var emptyRecon = formatEmptyPlantRecon(STATUS_START.farm, STATUS_END.farm);
  var maintainSum = formatFarmMaintainSum();
  var ranchSum = formatRanchOpsSum();
  var fishSum = formatFishOpsSum();
  var actionDetails = farmActionDetailLine();
  var detailLines = [
    "【🌅 开始状态】",
    "🌾 土地 | " + formatStatusLine("", STATUS_START.farm).replace(/^:\\s*/, ""),
    "🐟 鱼塘 | " + formatStatusLine("", STATUS_START.fish).replace(/^:\\s*/, ""),
    "🐮 动物 | " + formatStatusLine("", STATUS_START.ranch).replace(/^:\\s*/, ""),
    "🧮 农场状态 | " + farmStatusStart,
    SUBLINE,
    "【🌇 结束状态】",
    "🌾 土地 | " + formatStatusLine("", STATUS_END.farm).replace(/^:\\s*/, ""),
    "🐟 鱼塘 | " + formatStatusLine("", STATUS_END.fish).replace(/^:\\s*/, ""),
    "🐮 动物 | " + formatStatusLine("", STATUS_END.ranch).replace(/^:\\s*/, ""),
    "🧮 农场状态 | " + farmStatusEnd,
    farmDelta ? "🧮 农场Δ | " + farmDelta : "",
    harvestableDelta ? "🍎 可收变化 | " + harvestableDelta : "",
    witheredRecon ? "🪓 枯萎变化 | " + witheredRecon : "",
    emptyRecon ? "🌱 空地变化 | " + emptyRecon : "",
    maintainSum ? "🧹 维护合计 | " + maintainSum : "",
    harvestDetailLine ? "🌾 收获明细 | " + harvestDetailLine : "",
    harvestTypeLine,
    plantSkipLine ? "ℹ️ 播种未执行 | " + plantSkipLine : "",
    plantFailLine ? "⚠️ 播种失败 | " + plantFailLine : "",
    ranchSum ? "🐮 牧场合计 | " + ranchSum : "",
    fishSum ? "🐟 鱼塘合计 | " + fishSum : "",
    SUBLINE,
    "📊 等级 | " + formatStatsLine("农场/鱼塘", STATS_START.farm, STATS_END.farm),
    "📊 等级 | " + formatStatsLine("牧场", STATS_START.ranch, STATS_END.ranch),
    CONFIG.LOG_BAG_STATS ? "🎒 背包 | 种子[" + bagSeedTag + "] 鱼苗[" + bagFishTag + "]" : "",
    "🌱 种植 | " + seedLine,
    "💰 资金 | " + moneyLine,
    purchaseLine ? "🧾 购买 | " + purchaseLine : "",
    consumeLine ? "🧾 消耗 | " + consumeLine : "",
    noActionHint ? "⏳ 提示 | " + noActionHint : "",
    "🧮 动作详 | " + actionDetails[0],
    "🧮 动作详 | " + actionDetails[1],
    "🧩 动作 | " + farmLine + " / " + ranchLine + " / " + fishLine,
    "⏱ 用时 | " + (costSec ? costSec + "s" : "未知")
  ];
  detailLines = detailLines.filter(function (it) {
    return it;
  });
  var detail = detailLines.join("\n");

  return [brief, sep, detail].join("\n");
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

var LINE = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";
var SUBLINE = "────────────────────────────────────";

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

/* =======================
 *  FARM JSON MODE (farmTime/farmKey)
 * ======================= */
function ensureFarmJsonContext(cookie) {
  if (FARM_CTX.uIdx && FARM_CTX.uinY) return Promise.resolve(FARM_CTX);
  var base = CONFIG.FARM_JSON_BASE || "https://nc.qzone.qq.com";
  var uin = getFarmUinFromCookie(cookie) || "";
  return fetchFarmJson(base, cookie, uin).then(function (farm) {
    if (isFarmJson(farm)) return FARM_CTX;
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
    var isLock = Number(it.isLock || it.locked || it.isLocked || it.is_lock || 0) === 1;
    if (isLock) {
      locked += amount;
      continue;
    }
    var name = it.cName || (it.cId != null ? "cId" + it.cId : "种子");
    if (it.cId != null) recordCropName(String(it.cId), name);
    items.push({ name: name, count: amount });
    total += amount;
  }
  return { items: sortBagItems(items), total: total, locked: locked };
}

function fetchFarmSeedJson(cookie) {
  if (!CONFIG.FARM_JSON_ENABLE || !CONFIG.FARM_JSON_SEED_ENABLE) return Promise.resolve(null);
  return ensureFarmJsonContext(cookie).then(function () {
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
      if (CONFIG.LOG_BAG_STATS) log("🎒 JSON 种子读取失败: " + e);
      return null;
    });
  });
}

function parseCropJsonItems(arr) {
  if (!arr || typeof arr.length !== "number") return null;
  var items = [];
  for (var i = 0; i < arr.length; i++) {
    var it = arr[i] || {};
    var amount = Number(it.amount || it.num || it.count || 0);
    var cid = it.cId != null ? String(it.cId) : "";
    var name = it.cName || (cid ? "cId" + cid : "作物");
    if (cid) recordCropName(cid, name);
    var isLock = Number(it.isLock || it.locked || it.isLocked || it.is_lock || 0) === 1;
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
      if (CONFIG.LOG_BAG_STATS) log("🎒 JSON 仓库读取失败: " + e);
      return null;
    });
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

  function runList(list) {
    var idx = 0;
    function next() {
      if (idx >= list.length) return Promise.resolve();
      var a = list[idx++];
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
      if (a.type === "plant") params.cId = CONFIG.PLANT_CID;
        if (a.type === "scarify" && a.cropStatus !== undefined) params.cropStatus = a.cropStatus;
        recordActionTry(a.type, 1);
        if (a.type === "scarify" && a.withered) recordWitheredTry(1);
        return callFarmJsonAction(base, cookie, actMap[a.type], params)
          .then(function (res) {
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
            } else if (a.type === "harvest") {
            skipAfter[a.place] = true;
            logDebug("JSON 动作: 收获失败，跳过翻地/播种 place=" + a.place);
          } else if (a.type === "scarify") {
            skipAfter[a.place] = true;
            logDebug("JSON 动作: 翻地失败，跳过播种 place=" + a.place);
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

  if (!actionList.length) return Promise.resolve();
  return runList(actionList);
}

function runFarmJson(cookie) {
  var base = CONFIG.FARM_JSON_BASE || "https://nc.qzone.qq.com";
  log("🧩 模式: JSON @ " + base);
  var uin = getFarmUin(cookie);
  return fetchFarmJson(base, cookie, uin).then(function (farm) {
    if (!isFarmJson(farm)) return { ok: false, reason: "farm json missing" };
    applyFarmLockHeuristicGuard(farm, "json-start");
    logFarmJsonStatus("开始", farm);
    setFarmStatusFromJson(farm, true);
    LAST_MODE = "json";
    LAST_BASE = base;
    var actions = planJsonActions(farm);
    log("🧩 任务数: " + actions.length);
    return execFarmJsonActions(base, cookie, actions)
      .then(function () {
        return fetchFarmJson(base, cookie, uin)
          .then(function (farm2) {
            if (isFarmJson(farm2)) {
              applyFarmLockHeuristicGuard(farm2, "json-end");
              logFarmJsonStatus("结束", farm2);
              setFarmStatusFromJson(farm2, false);
            }
          })
          .catch(function () {});
      })
      .then(function () {
        return { ok: true };
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
      if (a.type === "plant") params.cId = CONFIG.PLANT_CID;
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
        params.cId = CONFIG.PLANT_CID;
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
    var link = firstMatch(h, /(wap_farm_sale_all\\?[^\"\\s>]*step=2[^\"\\s>]*)/);
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

function farmSellAllJson(cookie) {
  if (!CONFIG.ENABLE.farm_sell_all) return Promise.resolve(false);
  if (!CONFIG.FARM_JSON_ENABLE || !CONFIG.FARM_JSON_SALE_ENABLE) return Promise.resolve(false);
  return fetchFarmCropJson(cookie).then(function (crop) {
    if (!crop || !crop.ok) return false;
    var list = crop.items || [];
    var ids = [];
    for (var i = 0; i < list.length; i++) {
      var it = list[i] || {};
      if (!it.cid || !it.amount || it.amount <= 0) continue;
      var locked = !!it.isLock;
      if (!locked && !("isLock" in it) && String(it.cid) === "40") locked = true;
      if (locked) continue;
      ids.push(it.cid);
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
  return farmSellAllJson(cookie).then(function (ok) {
    if (ok) return;
    if (!CONFIG.FARM_JSON_FALLBACK_WAP) return;
    return farmSellAllWap(cookie);
  });
}

function farmSignIn(cookie) {
  if (!CONFIG.ENABLE.farm_signin) return Promise.resolve();
  var base = CONFIG.FARM_WAP_BASE;
  var sid = CONFIG.RANCH_SID;
  var g_ut = getFarmGut();

  function ensureHome() {
    if (LAST_FARM_HOME_HTML) return Promise.resolve({ html: LAST_FARM_HOME_HTML, cookie: cookie });
    var homeUrl = base + "/nc/cgi-bin/wap_farm_index?sid=" + sid + "&g_ut=" + g_ut;
    return getHtmlFollow(homeUrl, cookie, null, "农场签到探测", 0).then(function (resp) {
      LAST_FARM_HOME_HTML = resp.body || "";
      return { html: LAST_FARM_HOME_HTML, cookie: resp.cookie || cookie };
    });
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
    var re = /wap_farm_seed_plant_list\?[^"'\\s>]+/g;
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
          var re = /wap_farm_plant\\?[^\"\\s>]+/g;
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
  var re = /wap_farm_(harvest|opt|dig)\\?[^\"\\s>]+/g;
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
  if (!params || !params.places || params.places.length === 0) return {};
  var B_UID = params.B_UID;
  if ((!B_UID || B_UID === "0") && LAST_RANCH && LAST_RANCH.B_UID) {
    B_UID = LAST_RANCH.B_UID;
  }
  if (!B_UID) return {};
  var money = params.money || "0";
  var time = params.time || "-2147483648";
  var placeStr = params.places.join(",");
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
          if (shouldRecheck) didAny = true;
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

function runFarmAuto(cookie) {
  if (!CONFIG.FARM_JSON_ENABLE) return runFarmWap(cookie);
  return runFarmJson(cookie)
    .then(function (res) {
      var jsonOk = res && res.ok;
      if (jsonOk) {
        return runFarmWap(cookie, { skipHarvest: true, skipScarify: true, skipPlant: true }).then(
          function () {
            return res;
          }
        );
      }
      if (!CONFIG.FARM_JSON_FALLBACK_WAP) return res;
      log("⚠️ JSON 模式失败，回退 WAP");
      return runFarmWap(cookie);
    })
    .catch(function (e) {
      if (!CONFIG.FARM_JSON_FALLBACK_WAP) return Promise.reject(e);
      log("⚠️ JSON 模式异常，回退 WAP");
      return runFarmWap(cookie);
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
    return Promise.resolve(CONFIG.PLANT_CID);
  }
  if (markGrassLow(grassCount, "")) return Promise.resolve(CONFIG.FARM_GRASS_SEED_ID);
  var seedTotal = BAG_STATS.seed ? BAG_STATS.seed.total : 0;
  if (seedTotal >= CONFIG.FARM_SEED_MIN_TOTAL) {
    log("🌱 种植策略: 背包种子充足(" + seedTotal + ")，一键播种按背包顺序");
    PLANT_SEED_LOCKED = true;
    return Promise.resolve("");
  }
  log("🌱 种植策略: 背包种子偏少(" + seedTotal + "<" + CONFIG.FARM_SEED_MIN_TOTAL + ")，购买商店首个种子 x" + CONFIG.FARM_SEED_BUY_NUM);
  return buyFirstSeed(cookie, CONFIG.FARM_SEED_BUY_NUM)
    .then(function (cid) {
      if (cid) return true;
      if (NO_MONEY.farmSeed && CONFIG.ENABLE.farm_sell_all) {
        log("🧺 买种子: 金币不足，尝试先售卖补金币");
        return farmSellAll(cookie)
          .then(function () {
            NO_MONEY.farmSeed = false;
            return buyFirstSeed(cookie, CONFIG.FARM_SEED_BUY_NUM);
          })
          .then(function (cid2) {
            return !!cid2;
          });
      }
      return false;
    })
    .then(function () {
      PLANT_SEED_LOCKED = true;
      return "";
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
            return execFishActions(base, cookie, ret2.ctx);
          });
        }
      }
      return execFishActions(base, cookie, ctx);
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
          return empty === null || empty === undefined ? null : empty;
        });
      })
      .catch(function () {
        return null;
      });
  }

  function doPlant(empty) {
    if (empty === 0) {
      log("🪣 放养: 空池塘=0");
      return;
    }
    return ensureFishSeedTotal(cookie).then(function (total) {
      if (!total || total <= 0) {
        log("🪣 放养: 背包无鱼苗");
        return;
      }
      var seedUrl =
        base +
        "/nc/cgi-bin/wap_fish_seed_list?sid=" +
        sid +
        "&g_ut=" +
        g_ut +
        "&pnum=" +
        empty +
        "&flag=1&time=-2147483648";
      return fishGet(seedUrl, cookie).then(function (html2) {
        var link = extractFishPlantLink(html2);
        var needNum = Math.min(empty, total);
        if (!link) {
          var fid = firstMatch(html2, /fid=([0-9]+)/);
          if (fid) {
            link =
              "wap_fish_plant?sid=" +
              sid +
              "&g_ut=" +
              g_ut +
              "&fid=" +
              fid +
              "&flag=1&step=2&num=" +
              needNum;
          }
        }
        if (!link) {
          log("🪣 放养: 未发现可放养入口");
          return;
        }
        var url = link.indexOf("http") === 0 ? link : base + "/nc/cgi-bin/" + link.replace(/^\.?\//, "");
        return fishGet(url, cookie).then(function (html3) {
          var msg = extractMessage(html3);
          if (msg) log("🪣 放养: " + msg);
          else log("🪣 放养: 已提交");
          if (!/(对不起|没有足够|无法|不足|失败|未满足|输入有误|系统繁忙|稍候)/.test(msg || "")) {
            var cnt = parseFishPlantCountFromMsg(msg || html3) || needNum || 1;
            FISH_STATS.plant += cnt;
            didPlant = true;
          }
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
      return fetchEmptyFromBuyPre().then(function (remain) {
        if (remain === null || remain === undefined) return;
        if (remain <= 0) return;
        if (r >= 2) {
          log("🪣 放养复查: 剩余空池塘=" + remain + "，达到补投放上限");
          return;
        }
        return fillByEmpty(remain, r + 1);
      });
    });
  }

  return fishGet(indexUrl, cookie)
    .then(function (html) {
      ctx.indexHtml = html || ctx.indexHtml;
      var maxPond = CONFIG.FISH_MAX_POND || 6;
      var empty = extractFishEmptyPonds(html || "");
      if (empty === 0) return fillByEmpty(0, 0);
      if (empty === null || empty === undefined) {
        return fetchEmptyFromBuyPre().then(function (fallback) {
          if (fallback !== null && fallback !== undefined) return fillByEmpty(fallback, 0);
          if (
            (html || "").indexOf("一键养殖") >= 0 ||
            (html || "").indexOf("空池塘") >= 0 ||
            (html || "").indexOf("空鱼塘") >= 0 ||
            (html || "").indexOf("空鱼池") >= 0
          ) {
            return fillByEmpty(maxPond, 0);
          }
          log("🪣 放养: 空池塘未知，跳过");
        });
      }
      return fillByEmpty(empty, 0);
    })
    .then(function () {
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
  return Promise.resolve()
    .then(function () {
      if (!CONFIG.ENABLE.fish_feed) return;
      if (opts.skipFeed) return;
      return ensureFishFeedAvailable(cookie).then(function (allow) {
        if (!allow) return;
        var hasFeedEntry =
          (ctx.indices && ctx.indices.length > 0) ||
          ctx.hasFeedEntry ||
          (ctx.indexHtml && ctx.indexHtml.indexOf("fish_fertilize") >= 0) ||
          (ctx.indexHtml && ctx.indexHtml.indexOf("喂鱼食") >= 0);
        if (!hasFeedEntry) {
          log("🐟 喂鱼: 未发现可喂入口(可能无鱼食/无鱼)");
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
            if (msg) log("🐟 喂鱼: " + msg);
            trackFishFeedUsage(html);
            var feedCount = parseFishFeedPondCount(msg || html) || 1;
            if (isFeedSuccess(msg, html)) {
              FISH_STATS.feed += feedCount;
              didFeed = true;
              FISH_FEED_NOOP_SEEN = false;
              if (BAG_STATS.fishFeed) BAG_STATS.fishFeed.loaded = false;
            } else if (isFishFeedNoopText(msg, html)) {
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
              if (msg) log("🐟 喂鱼: " + msg);
              trackFishFeedUsage(html);
              if (isFeedSuccess(msg, html)) {
                FISH_STATS.feed += 1;
                didFeed = true;
                FISH_FEED_NOOP_SEEN = false;
                if (BAG_STATS.fishFeed) BAG_STATS.fishFeed.loaded = false;
              } else if (isFishFeedNoopText(msg, html)) {
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
    })
    .then(function () {
      if (!didFeed) return;
      return refreshFishContext(base, cookie, ctx);
    })
    .then(function () {
      if (!CONFIG.ENABLE.fish_harvest) return;
      if (opts.skipHarvest) return;
      var indexParam = extractFishHarvestIndex(ctx.indexHtml || "");
      var links = ctx.harvestLinks || [];
      if (!indexParam && links.length === 0) {
        // 兜底再拉一次首页
        return fishGet(base + "/nc/cgi-bin/wap_farm_fish_index?sid=" + ctx.sid + "&g_ut=" + ctx.g_ut, cookie)
          .then(function (htmlRetry) {
            ctx.indexHtml = htmlRetry;
            indexParam = extractFishHarvestIndex(htmlRetry || "");
            links = extractFishHarvestLinks(htmlRetry || "");
            return { indexParam: indexParam, links: links };
          })
          .then(function (ret) {
            var idxParam = ret.indexParam;
            var hlinks = ret.links || [];
            if (idxParam) {
              var url =
                base +
                "/nc/cgi-bin/wap_farm_fish_harvest?sid=" +
                ctx.sid +
                "&g_ut=" +
                ctx.g_ut +
                "&index=" +
                idxParam +
                "&flag=2&time=-2147483648";
              return fishGet(url, cookie).then(function (html) {
                var msg = extractMessage(html);
                if (msg) log("🎣 收获: " + msg);
                if (isSuccessMsg(msg)) {
                  var hc =
                    parseFishHarvestCountFromMsg(msg || html) ||
                    countCommaList(idxParam) ||
                    1;
                  FISH_STATS.harvest += hc;
                  didHarvest = true;
                }
              });
            }
            if (!hlinks || hlinks.length === 0) {
              log("🎣 收获: 未发现可收获入口");
              return;
            }
            var ii = 0;
            function next2() {
              if (ii >= hlinks.length) return Promise.resolve();
              var link = hlinks[ii++];
              var url2 = link.indexOf("http") === 0 ? link : base + "/nc/cgi-bin/" + link.replace(/^\.?\//, "");
              return fishGet(url2, cookie)
                .then(function (html) {
                  var msg = extractMessage(html);
                  if (msg) log("🎣 收获: " + msg);
                  if (isSuccessMsg(msg)) {
                    var hc = parseFishHarvestCountFromMsg(msg || html) || 1;
                    FISH_STATS.harvest += hc;
                    didHarvest = true;
                  }
                })
                .then(function () {
                  return sleep(CONFIG.WAIT_MS);
                })
                .then(next2);
            }
            return next2();
          });
      }
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
        return fishGet(url, cookie).then(function (html) {
          var msg = extractMessage(html);
          if (msg) log("🎣 收获: " + msg);
          if (isSuccessMsg(msg)) {
            var hc =
              parseFishHarvestCountFromMsg(msg || html) ||
              countCommaList(indexParam) ||
              1;
            FISH_STATS.harvest += hc;
            didHarvest = true;
          }
        });
      }
      if (!links || links.length === 0) {
        log("🎣 收获: 未发现可收获入口");
        return;
      }
      var i = 0;
      function next() {
        if (i >= links.length) return Promise.resolve();
        var link = links[i++];
        var url = link.indexOf("http") === 0 ? link : base + "/nc/cgi-bin/" + link.replace(/^\.?\//, "");
        return fishGet(url, cookie)
          .then(function (html) {
            var msg = extractMessage(html);
            if (msg) log("🎣 收获: " + msg);
            if (isSuccessMsg(msg)) {
              var hc = parseFishHarvestCountFromMsg(msg || html) || 1;
              FISH_STATS.harvest += hc;
              didHarvest = true;
            }
          })
          .then(function () {
            return sleep(CONFIG.WAIT_MS);
          })
          .then(next);
      }
      return next();
    })
    .then(function () {
      if (!CONFIG.FISH_AUTO_PLANT) return;
      if (opts.skipPlant) return;
      return autoPlantFishFromBag(base, cookie, ctx).then(function (planted) {
        if (planted) {
          didPlant = true;
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
        return pickFromList()
          .then(function (choice) {
            if (!choice) {
              log("🧾 买鱼: 未发现可购买鱼苗入口");
              return null;
            }
            return ensureFishSeedTotal(cookie).then(function (total) {
              return { choice: choice, total: total };
            });
          })
          .then(function (ret) {
            if (!ret) return null;
            var choice = ret.choice;
            var total = ret.total || 0;
            seedTotal = total;
            var target = CONFIG.FISH_MIN_SEED || 0;
            if (target > 0 && total >= target && CONFIG.LOG_BAG_STATS)
              log("🎒 鱼苗充足: " + total + " (目标≥" + target + ")");
            if (target > 0) {
              needNum = Math.max(target - total, 0);
            } else {
              needNum = CONFIG.FISH_BUY_NUM || 0;
            }
            return choice;
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
              var fishName = extractFishNameFromPre(html);
              var target = CONFIG.FISH_MIN_SEED || 0;
              if (maxBuy === 0 && isMoneyShortText(stripTags(html || ""))) {
                NO_MONEY.fishSeed = true;
                moneyShort = true;
                log("🧾 买鱼: 金币不足，无法购买");
                return;
              }
              var needForEmpty = 0;
              if (empty !== null && empty !== undefined) {
                needForEmpty = Math.max(empty - seedTotal, 0);
                if (needForEmpty > 0) log("🧾 买鱼: 空池塘=" + empty + "，需补鱼苗 " + needForEmpty);
              }
              var buyNum = 0;
              if (empty !== null && empty !== undefined) {
                // 空位已知时优先“按空位差额补苗”，避免只因库存目标触发大额购买。
                buyNum = needForEmpty;
                if (empty === 0 && target > 0 && needNum > 0) buyNum = needNum;
              } else {
                buyNum = needNum || 0;
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
          BAG_STATS.fish = { total: 0, items: [] };
        }
      });
    })
    .then(function () {
      if (opts.cleanup === false) return;
      return refreshFishContext(base, cookie, ctx).then(function () {
        var html = ctx.indexHtml || "";
        var hasFeed =
          (ctx.indices && ctx.indices.length > 0) ||
          ctx.hasFeedEntry ||
          html.indexOf("fish_fertilize") >= 0 ||
          html.indexOf("喂鱼食") >= 0;
        var hasHarvest =
          !!extractFishHarvestIndex(html) ||
          (ctx.harvestLinks && ctx.harvestLinks.length > 0);
        var empty = extractFishEmptyPonds(html);
        var hasEmpty = empty && empty > 0;
        if (!hasEmpty && html.indexOf("一键养殖") >= 0) hasEmpty = true;
        if (!hasEmpty && html.indexOf("空池塘") >= 0) hasEmpty = true;

        var feedPossible =
          hasFeed &&
          CONFIG.ENABLE.fish_feed &&
          !FISH_FEED_NOOP_SEEN &&
          (CONFIG.FISH_FEED_ALLOW_SPEND || !FISH_FEED_EMPTY_SEEN);
        var fishSeedTotal = BAG_STATS.fish ? BAG_STATS.fish.total || 0 : 0;
        var emptyPossible =
          hasEmpty &&
          CONFIG.FISH_AUTO_PLANT &&
          (fishSeedTotal > 0 || (CONFIG.FISH_AUTO_BUY && !NO_MONEY.fishSeed));
        var harvestPossible = hasHarvest && CONFIG.ENABLE.fish_harvest;
        if (!feedPossible && !harvestPossible && !emptyPossible) return;

        var stateKey = [
          feedPossible ? 1 : 0,
          harvestPossible ? 1 : 0,
          emptyPossible ? 1 : 0,
          empty === null || empty === undefined ? "n" : empty,
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

function probeGrassFruitFromFeedPre(base, cookie, ctx, label) {
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
      if (info.total === null || isNaN(info.total)) return null;
      LAST_GRASS_COUNT = info.total;
      var tag = label ? "(" + label + ")" : "";
      log("🌿 牧草果实" + tag + ": " + info.total);
      if (info.n !== null && info.n !== undefined && info.cap) {
        log("🌿 饲料槽" + tag + ": " + info.n + "/" + info.cap);
      }
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

function probeRanchGrass(cookie) {
  var base = CONFIG.RANCH_BASE;
  if (LAST_RANCH && LAST_RANCH.sid && LAST_RANCH.g_ut) {
    return probeGrassFruitFromFeedPre(base, cookie, LAST_RANCH, "预判").then(function (count) {
      if (count !== null && count !== undefined) return count;
      return probeRanchGrassFromBag(base, cookie, LAST_RANCH, "页面预判");
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
        return probeRanchGrassFromBag(base, cookie, ctx, "页面预判");
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
  var step1 =
    base +
    "/mc/cgi-bin/wap_pasture_rep_sale?&saleAll=1&step=1&sid=" +
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

  return loadStep1(0).then(function (ret1) {
    var html = (ret1 && ret1.html) || "";
    var step1Transient = ret1 && ret1.transient;
    if (step1Transient) {
      log("⚠️ 牧场售卖(step1): 系统繁忙，继续尝试 step2");
    }
    var h = html.replace(/&amp;/g, "&");
    var link = firstMatch(h, /(wap_pasture_rep_sale[^\"\\s>]*step=2[^\"\\s>]*)/);
    if (!link) {
      link = "wap_pasture_rep_sale?saleAll=1&step=2&sid=" + ctx.sid + "&g_ut=" + ctx.g_ut;
    }
    var url = link.indexOf("http") === 0 ? link : base + "/mc/cgi-bin/" + link.replace(/^\.?\//, "");
    return loadStep2(url, 0).then(function (ret2) {
      var html2 = (ret2 && ret2.html) || "";
      var msg = (ret2 && ret2.msg) || "";
      var text = (ret2 && ret2.text) || normalizeSpace(stripTags(html2 || ""));
      var money = parseMoneyFromMsg(msg || stripTags(html2));
      if (money > 0) MONEY_STATS.ranchSell += money;
      if (msg) log("🧺 牧场售卖: " + msg);
      if (isSellSuccess(msg, html2)) {
        RANCH_STATS.sell += 1;
        return;
      }
      if (ret2 && ret2.transient) {
        RANCH_STATS.errors += 1;
        log("⚠️ 牧场售卖未完成: " + (msg || "系统繁忙，请稍后重试"));
      }
    });
  });
}

function refreshRanchContext(base, cookie, ctx) {
  if (!ctx || !ctx.sid || !ctx.g_ut) return Promise.resolve();
  var url = base + "/mc/cgi-bin/wap_pasture_index?sid=" + ctx.sid + "&g_ut=" + ctx.g_ut;
  return ranchGet(url, cookie).then(function (html) {
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
      return probeGrassFruitFromFeedPre(base, cookie, ctx, "仓库")
        .then(function (fruit) {
          if (fruit !== null && fruit !== undefined) {
            ctx.grassCount = fruit;
            LAST_GRASS_COUNT = fruit;
            return;
          }
          var bagUrl =
            base + "/mc/cgi-bin/wap_pasture_bag_list?sid=" + ctx.sid + "&g_ut=" + ctx.g_ut;
          return ranchGet(bagUrl, cookie).then(function (bagHtml) {
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
        var hurl =
          base +
          "/mc/cgi-bin/wap_pasture_harvest?sid=" +
          ctx.sid +
          "&g_ut=" +
          ctx.g_ut +
          "&serial=-1&htype=3";
        return ranchGet(hurl, cookie).then(function (html2) {
          var beforeHarvest = ctx.statusList || [];
          var afterHarvest = parseRanchStatus(html2);
          if (afterHarvest.length > 0) ctx.statusList = afterHarvest;
          var msg2 = extractMessage(html2);
          if (msg2) log("🐮 收获: " + msg2);
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
              } else if (isRanchBlankHarvestMsg(msg2, html2)) {
                log("🐮 收获: 接口空结果，按无动作处理");
              } else {
                RANCH_STATS.harvestUnknown += 1;
                log("🐮 收获: 成功，但本次数量未返回");
              }
            }
            didHarvestAfterProduct = true;
          }
          ctx._help = extractHelpParams(html2) || ctx._help;
          var hlinks = extractHelpLinks(html2);
          if (hlinks.length) ctx.helpLinks = hlinks;
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
    var url =
      base +
      "/mc/cgi-bin/wap_pasture_harvest?sid=" +
      ctx.sid +
      "&g_ut=" +
      ctx.g_ut +
      "&serial=-1&htype=3";
    return ranchGet(url, cookie).then(function (html) {
      var beforeHarvest = ctx.statusList || [];
      var afterHarvest = parseRanchStatus(html);
      if (afterHarvest.length > 0) ctx.statusList = afterHarvest;
      var msg = extractMessage(html);
      if (msg) log("🐮 收获: " + msg);
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
          } else if (isRanchBlankHarvestMsg(msg, html)) {
            log("🐮 收获: 接口空结果，按无动作处理");
          } else {
            RANCH_STATS.harvestUnknown += 1;
            log("🐮 收获: 成功，但本次数量未返回");
          }
        }
      }
      ctx._help = extractHelpParams(html);
      var hlinks = extractHelpLinks(html);
      if (hlinks.length) ctx.helpLinks = hlinks;
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
        var url = link.indexOf("http") === 0 ? link : base + "/mc/cgi-bin/" + link.replace(/^\\.?\//, "");
        return ranchGet(url, cookie)
          .then(function (html) {
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
    if (!ctx._help || !ctx.B_UID) {
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
      var msg = extractMessage(html);
      if (msg) log("🧹 清理: " + msg);
      var cnt = parseRanchHelpCount(msg || html) || 1;
      RANCH_STATS.help += cnt;
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
    .catch(function (e) {
      RANCH_STATS.errors += 1;
      log("⚠️ 牧场任务失败: " + e);
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
        });
      });
    })
    .then(function () {
      return runFarmAuto(cookie).then(function () {
        return farmSignIn(cookie).then(function () {
          return feedRanchFromWarehouse(CONFIG.RANCH_BASE, cookie, ranchCookie).then(function () {
            return farmSellAll(cookie);
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
      return refreshFinalStats(cookie);
    })
    .then(function () {
      return refreshEndFishStatus(cookie);
    })
    .then(function () {
      log(SUBLINE);
      log("【开始状态】");
      log("🌾 土地: " + formatStatusLine("", STATUS_START.farm).replace(/^:\\s*/, ""));
      log("🐟 鱼塘: " + formatStatusLine("", STATUS_START.fish).replace(/^:\\s*/, ""));
      log("🐮 动物: " + formatStatusLine("", STATUS_START.ranch).replace(/^:\\s*/, ""));
      log(SUBLINE);
      log("【结束状态】");
      log("🌾 土地: " + formatStatusLine("", STATUS_END.farm).replace(/^:\\s*/, ""));
      log("🐟 鱼塘: " + formatStatusLine("", STATUS_END.fish).replace(/^:\\s*/, ""));
      log("🐮 动物: " + formatStatusLine("", STATUS_END.ranch).replace(/^:\\s*/, ""));
      log(SUBLINE);
      var logBody = summaryLines().join("\n");
      var notifyBody = buildNotifyBody();
      log("✅ 任务汇总:\n" + logBody);
      notify("🌾 QQ 农牧场助手", "✅ 运行完成", notifyBody);
      bannerEnd();
    })
    .catch(function (e) {
      if (e === STOP_SIGNAL) return;
      log("❌ 异常: " + e);
      notify("🌾 QQ 农牧场助手", "❌ 运行失败", String(e));
      bannerEnd();
    });
}

main().then(function () {
  $.done();
});
