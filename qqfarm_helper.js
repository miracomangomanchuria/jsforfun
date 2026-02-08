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
  RANCH_DIRECT_REFERER: "", // 直连牧场时的 Referer（空=使用农场首页）

  // 农场 WAP（售卖/签到等）
  FARM_WAP_BASE: "https://mcapp.z.qq.com",
  FARM_G_UT: "1", // 可手动指定，空则自动探测/沿用牧场 g_ut

  // 鱼塘
  FISH_BASE: "https://mcapp.z.qq.com",
  FISH_G_UT: "1", // 可手动指定，空则沿用农场 g_ut
  FISH_USE_ONEKEY_FEED: true,
  FISH_SELL_IDS: "",
  FISH_AUTO_BUY: false,
  FISH_BUY_FID: "35",
  FISH_MIN_SEED: 50, // 背包/仓库鱼苗目标数
  FISH_BUY_NUM: 50, // 单次购买量(默认与目标数一致)
  FISH_TRY_FALLBACK_HARVEST: false,
  FISH_FALLBACK_INDEX: "",
  FISH_MAX_POND: 6,

  // 播种作物（兼容旧版/现代接口时使用）
  PLANT_CID: "40",
  GRASS_THRESHOLD: 1000, // 牧草数量低于此值，优先种牧草

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
  // WAP 兜底轮次（0=不限制，默认 2）
  FARM_WAP_MAX_PASS: 2,

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
  DEBUG: false
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
  if (!map.skey || !map.uin) {
    log("⚠️ Cookie缺少 skey/uin，农场/背包/鱼塘可能为空");
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
  return getWithRetry(
    {
      method: "GET",
      url: target,
      headers: buildRanchHeaders(cookie, ref)
    },
    label || "会话"
  ).then(function (resp) {
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
        var link = extractContinueLink(resp.body) || extractMcappLink(resp.body) || extractFirstHref(resp.body);
        if (link) next = resolveUrl(url, link);
      }
    }
    if (next && next !== url && depth < 3) {
      return getHtmlFollow(next, merged, url, label, depth + 1);
    }
    return { body: resp.body || "", cookie: merged, url: url };
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

var FARM_EXTRA = {
  sell: 0,
  signin: 0
};

var RANCH_STATS = {
  harvest: 0,
  feed: 0,
  help: 0,
  product: 0,
  sell: 0,
  signin: 0,
  errors: 0
};

var FISH_STATS = {
  feed: 0,
  harvest: 0,
  sell: 0,
  buy: 0,
  errors: 0
};

var PLANT_STATS = {
  total: 0,
  byCid: {}
};

var MONEY_STATS = {
  farmSell: 0,
  ranchSell: 0,
  fishSell: 0
};

var BAG_STATS = {
  seed: { total: 0, items: [] },
  fish: { total: 0, items: [] }
};

var STATS_START = { farm: null, ranch: null };
var STATS_END = { farm: null, ranch: null };
var RUN_START = 0;
var STATUS_START = { farm: [], fish: [], ranch: [] };
var STATUS_END = { farm: [], fish: [], ranch: [] };

var LAST_FARM = null;
var LAST_FARM_HOME_HTML = "";
var FARM_CTX = { uinY: "", uIdx: "" };
var LAST_RANCH = null;
var LAST_RANCH_HOME_HTML = "";
var LAST_MODE = "";
var LAST_BASE = "";
var LAST_GRASS_COUNT = null;
var PLANT_SEED_LOCKED = false;
var LAST_RANCH_CONNECT = "";
var LAST_FISH_ENTRY_URL = "";

function bannerStart() {
  log(LINE);
  log("🌾 QQ 农牧场助手");
  var meta = "⏱ " + new Date().toLocaleString() + " | " + ENV_NAME;
  if (CONFIG.DEBUG) meta += " | DEBUG";
  log(meta);
  log(LINE);
  RUN_START = Date.now();
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
  var m = text.match(/(成功|失败|获得|收获|无法|不能)[^。！!]{0,40}/);
  return m ? m[0] : "";
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

function hasSignInEntry(html) {
  if (!html) return false;
  if (/signin=1/i.test(html)) return true;
  var text = stripTags(html || "");
  return /签到/.test(text);
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

function isSuccessMsg(msg) {
  if (!msg) return false;
  return msg.indexOf("成功") >= 0 || msg.indexOf("收获") >= 0 || msg.indexOf("获得") >= 0;
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
  var pos = firstMatch(h, /pos=([0-9]+)/);
  var num = firstMatch(h, /num=([0-9]+)/);
  var type = firstMatch(h, /type=([0-9]+)/);
  if (pos && num && type) {
    return { pos: pos, num: num, type: type };
  }
  return null;
}

function extractProductionSerials(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var serials = {};
  var re = /生产期[\s\S]{0,120}?wap_pasture_product[^\"'>]*serial=([0-9]+)/g;
  var m;
  while ((m = re.exec(h))) {
    serials[m[1]] = true;
  }
  return Object.keys(serials);
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
  var re = /wap_farm_fish_harvest[^\"\\s>]+/g;
  var m;
  while ((m = re.exec(h))) {
    links.push(m[0]);
  }
  return links;
}

function extractFishHarvestIndex(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var m = h.match(/wap_farm_fish_harvest\\?[^\"\\s>]*index=([0-9,]+)/);
  return m ? m[1] : "";
}

function extractFishBuyFids(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var ids = [];
  var seen = {};
  var re = /wap_fish_buy_pre_new\\?[^\"\\s>]*fid=([0-9]+)/g;
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
  var re = /<p>\\s*\\d+\\.\\s*([^<(]+?)\\s*\\([^)]*\\)[\\s\\S]{0,120}?wap_fish_buy_pre_new\\?[^\"'>]*fid=([0-9]+)/g;
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

function extractFishMaxBuy(html) {
  var text = stripTags(html || "");
  var m = text.match(/最多可购买\\s*([0-9]+)/);
  if (!m) return null;
  var v = parseInt(m[1], 10);
  return isNaN(v) ? null : v;
}

function extractFishEmptyPonds(html) {
  var text = stripTags(html || "");
  var m = text.match(/你有\\s*([0-9]+)\\s*块空池塘/);
  if (!m) return null;
  var v = parseInt(m[1], 10);
  return isNaN(v) ? null : v;
}

function extractFishEntryLink(html) {
  var h = (html || "").replace(/&amp;/g, "&");
  var m = h.match(/wap_(?:farm_)?fish_index\\?[^\"\\s>]+/);
  if (m) return m[0];
  m = h.match(/fish_index\\?[^\"\\s>]+/);
  return m ? m[0] : "";
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
  return text.indexOf("我的土地") >= 0 || text.indexOf("【我的土地】") >= 0;
}

function isRanchHome(html) {
  var text = stripTags(html || "");
  return text.indexOf("我的牧场") >= 0 || text.indexOf("牧场动物及产品") >= 0;
}

function isFishHome(html) {
  var text = stripTags(html || "");
  return /我的池塘|我的鱼塘|鱼塘|鱼池/.test(text);
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
    if (name) list.push({ name: normalizeSpace(name), status: normalizeSpace(status) });
  }
  if (list.length > 0) return list;
  var text = stripTags(html || "").replace(/（/g, "(").replace(/）/g, ")").replace(/\s+/g, " ");
  var re2 = /土地\d*\s*([^\s()]+)\s*\(([^)]+)\)/g;
  while ((m = re2.exec(text))) {
    list.push({ name: normalizeSpace(m[1]), status: normalizeSpace(m[2]) });
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
    if (name) list.push({ name: normalizeSpace(name), status: normalizeSpace(status) });
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
    list.push({ name: name, status: status });
  }
  return list;
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
      STATUS_END.farm = parseFarmStatus(ret.body || "");
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
      STATUS_START.farm = parseFarmStatus(ret.body || "");
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
      STATUS_END.fish = parseFishStatus(ret.body || "");
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
      log("🎒 背包读取失败: " + e);
      return { items: [], total: 0 };
    });
}

function refreshBagStats(cookie) {
  return fetchBagItems(cookie, "")
    .then(function (seed) {
      BAG_STATS.seed = seed;
      log("🎒 背包·种子: " + buildBagTag(seed.items, 4));
      return fetchBagItems(cookie, "23");
    })
    .then(function (fish) {
      BAG_STATS.fish = fish;
      log("🎒 背包·鱼苗: " + buildBagTag(fish.items, 4));
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
  // 旧版 Flash 时代 farmKey（历史逻辑）
  var seed = "sdoit78sdopig7w34057";
  var start = (farmTime % 10) + 1;
  var sub = seed.substr(start, 20);
  return md5(String(farmTime) + sub);
}

// 旧版 farmKey 的最小 MD5（仅 ASCII），需要时可替换。
function md5(input) {
  if (!IS_NODE) {
    // 代理环境下不计算 MD5，直接返回空
    return "";
  }
  var crypto = require("crypto");
  return crypto.createHash("md5").update(input).digest("hex");
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
    if (land.a === 0) continue;
    var idx = land.farmlandIndex != null ? land.farmlandIndex : i;
    if (land.b === 7) places.push(idx);
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
    ACTION_STATS.plant +
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

function ranchSummaryLine() {
  return (
    "收获=" +
    RANCH_STATS.harvest +
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
    ACTION_STATS.plant +
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
    RANCH_STATS.harvest +
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
    " 卖" +
    FISH_STATS.sell +
    " 买" +
    FISH_STATS.buy +
    " 错" +
    FISH_STATS.errors;

  return [
    farmLine,
    ranchLine,
    fishLine,
    "【等级】" + formatStatsLine("农场/鱼塘", STATS_START.farm, STATS_END.farm),
    "【等级】" + formatStatsLine("牧场", STATS_START.ranch, STATS_END.ranch),
    "【背包】种子[" + buildBagTag(BAG_STATS.seed.items, 3) + "] 鱼苗[" + buildBagTag(BAG_STATS.fish.items, 3) + "]"
  ];
}

function buildNotifyBody() {
  var totalErr = ACTION_STATS.errors + RANCH_STATS.errors + FISH_STATS.errors;
  var tag = LAST_RANCH_CONNECT ? " · " + LAST_RANCH_CONNECT : "";
  var costMs = RUN_START ? Date.now() - RUN_START : 0;
  var costSec = costMs ? Math.round(costMs / 1000) : 0;
  var brief =
    "简报：🌾收" +
    ACTION_STATS.harvest +
    " 种" +
    PLANT_STATS.total +
    " 售" +
    FARM_EXTRA.sell +
    " 签" +
    FARM_EXTRA.signin +
    " | 🐮收" +
    RANCH_STATS.harvest +
    " 产" +
    RANCH_STATS.product +
    " 售" +
    RANCH_STATS.sell +
    " | 🐟收" +
    FISH_STATS.harvest +
    " 售" +
    FISH_STATS.sell +
    " 买" +
    FISH_STATS.buy +
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
  var bagSeedTag = buildBagTag(BAG_STATS.seed.items, 3);
  var bagFishTag = buildBagTag(BAG_STATS.fish.items, 3);

  var moneyLine =
    "卖出：农场" +
    MONEY_STATS.farmSell +
    " 牧场" +
    MONEY_STATS.ranchSell +
    " 鱼塘" +
    MONEY_STATS.fishSell;

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
    RANCH_STATS.harvest +
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
    FISH_STATS.buy +
    " 卖" +
    FISH_STATS.sell;

  var detail = [
    "【开始状态】",
    "🌾 土地 | " + formatStatusLine("", STATUS_START.farm).replace(/^:\\s*/, ""),
    "🐟 鱼塘 | " + formatStatusLine("", STATUS_START.fish).replace(/^:\\s*/, ""),
    "🐮 动物 | " + formatStatusLine("", STATUS_START.ranch).replace(/^:\\s*/, ""),
    SUBLINE,
    "【结束状态】",
    "🌾 土地 | " + formatStatusLine("", STATUS_END.farm).replace(/^:\\s*/, ""),
    "🐟 鱼塘 | " + formatStatusLine("", STATUS_END.fish).replace(/^:\\s*/, ""),
    "🐮 动物 | " + formatStatusLine("", STATUS_END.ranch).replace(/^:\\s*/, ""),
    SUBLINE,
    "📊 等级 | " + formatStatsLine("农场/鱼塘", STATS_START.farm, STATS_END.farm),
    "📊 等级 | " + formatStatsLine("牧场", STATS_START.ranch, STATS_END.ranch),
    "🎒 背包 | 种子[" + bagSeedTag + "] 鱼苗[" + bagFishTag + "]",
    "🌱 种植 | " + seedLine,
    "💰 资金 | " + moneyLine,
    "🧩 动作 | " + farmLine + " / " + ranchLine + " / " + fishLine,
    "⏱ 用时 | " + (costSec ? costSec + "s" : "未知")
  ].join("\n");

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
    if (land.a === 0) continue;
    var idx = land.farmlandIndex != null ? land.farmlandIndex : i;
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
    } else if (land.b === 7 && CONFIG.ENABLE.scarify) {
      pushAction(actions, { type: "scarify", place: idx });
      if (CONFIG.ENABLE.plant) pushAction(actions, { type: "plant", place: idx });
    }
  }
  return actions;
}

function runModern(base, cookie, gtk, uin) {
  log("🚀 模式: 现代 @ " + base);
  return fetchFarmModern(base, cookie, gtk, uin).then(function (farm) {
    if (!isFarmJson(farm)) return { ok: false, reason: "farm json missing" };
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
      return callModernAction(base, cookie, gtk, actMap[a.type], params)
        .then(function () {
          ACTION_STATS[a.type] += 1;
          if (a.type === "plant") recordPlant(CONFIG.PLANT_CID, 1);
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
    if (land.a === 0) continue;
    var idx = land.farmlandIndex != null ? land.farmlandIndex : i;
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
    } else if (land.b === 7 && CONFIG.ENABLE.scarify) {
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
      var farmTime = nowTs();
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
        .then(function () {
          ACTION_STATS[a.type] += 1;
          if (a.type === "plant") recordPlant(CONFIG.PLANT_CID, 1);
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

function buyGrassSeed(cookie) {
  return buyGrassSeedWap(cookie);
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
        var form = parseSeedBuyForm(html);
        if (!form.action) {
          log("🌾 买牧草: 未找到购买表单");
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
              log("🌾 买牧草: " + msg);
              return true;
            }
            if (msg) log("🌾 买牧草: " + msg);
            return false;
          })
          .catch(function (e) {
            log("🌾 买牧草: 购买失败 " + e);
            return false;
          });
      })
      .catch(function (e) {
        log("🌾 买牧草: 详情页失败 " + e);
        return false;
      });
  }

  var startQueue = [listUrl];
  var visited = {};
  visited[listUrl] = true;
  return fetchPages(startQueue, visited)
    .then(function (infoUrl) {
      if (!infoUrl) {
        log("🌾 买牧草: 未发现 WAP 购买入口");
        return false;
      }
      return doBuy(infoUrl);
    })
    .catch(function (e) {
      log("🌾 买牧草: WAP 获取失败 " + e);
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

function farmSellAll(cookie) {
  if (!CONFIG.ENABLE.farm_sell_all) return Promise.resolve();
  var base = CONFIG.FARM_WAP_BASE;
  var sid = CONFIG.RANCH_SID;
  var g_ut = getFarmGut();
  var step1 = base + "/nc/cgi-bin/wap_farm_sale_all?step=1&sid=" + sid + "&g_ut=" + g_ut;
  return ranchGet(step1, cookie).then(function (html) {
    var link = firstMatch(html.replace(/&amp;/g, "&"), /(wap_farm_sale_all\\?[^\"\\s>]*step=2[^\"\\s>]*)/);
    if (!link) {
      link = "wap_farm_sale_all?step=2&sid=" + sid + "&g_ut=" + g_ut + "&buyway=0";
    }
    var step2 = link.indexOf("http") === 0 ? link : base + "/nc/cgi-bin/" + link.replace(/^\.?\//, "");
    return ranchGet(step2, cookie).then(function (html2) {
      var msg = extractMessage(html2);
      var money = parseMoneyFromMsg(msg);
      if (money > 0) MONEY_STATS.farmSell += money;
      if (msg) log("🧺 农场售卖: " + msg);
      FARM_EXTRA.sell += 1;
    });
  });
}

function farmSignIn(cookie) {
  if (!CONFIG.ENABLE.farm_signin) return Promise.resolve();
  if (LAST_FARM_HOME_HTML && !hasSignInEntry(LAST_FARM_HOME_HTML)) {
    log("📅 农场签到: 页面无入口(疑似已签到)");
    return Promise.resolve();
  }
  var base = CONFIG.FARM_WAP_BASE;
  var sid = CONFIG.RANCH_SID;
  var g_ut = getFarmGut();
  var signUrl = base + "/nc/cgi-bin/wap_farm_index?sid=" + sid + "&g_ut=" + g_ut + "&signin=1";
  return ranchGet(signUrl, cookie).then(function (html) {
    var msg = extractWapHint(html) || extractMessage(html);
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
    FARM_EXTRA.signin += 1;
  });
}

function farmOneKeyDig(cookie, deadPlaces) {
  if (!CONFIG.FARM_TRY_ONEKEY_DIG) return Promise.resolve(false);
  if (!deadPlaces || deadPlaces.length === 0) return Promise.resolve(false);
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
      return msg && msg.indexOf("成功") >= 0;
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

  function tryCandidates(candidates, idx) {
    if (idx >= candidates.length) return Promise.resolve({ did: false, cont: false });
    var link = candidates[idx];
    var url = link.indexOf("http") === 0 ? link : base + "/nc/cgi-bin/" + cleanLink(link);
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
        var landLimit =
          text.indexOf("红土地") >= 0 ||
          text.indexOf("黑土地") >= 0 ||
          text.indexOf("金土地") >= 0 ||
          text.indexOf("土地等级") >= 0 ||
          text.indexOf("土地类型") >= 0 ||
          text.indexOf("土地不符") >= 0 ||
          text.indexOf("只能种在") >= 0;
        var success = text.indexOf("成功") >= 0 || text.indexOf("已播种") >= 0;
        if (noLand) return { did: success, cont: false };
        if (seedLack || landLimit) return tryCandidates(candidates, idx + 1);
        if (success) return { did: true, cont: true };
        return { did: success, cont: false };
      })
      .catch(function (e) {
        log("🌱 一键播种失败: " + e);
        return { did: false, cont: false };
      });
  }

  function doOnce() {
    return ranchGet(listUrl, cookie)
      .then(function (html) {
        var h = (html || "").replace(/&amp;/g, "&");
        var links = [];
        var re = /wap_farm_plant\\?[^\"\\s>]+/g;
        var m;
        while ((m = re.exec(h))) links.push(m[0]);
        var candidates = reorderCandidates(links);
        if (candidates.length === 0 && seedCid) {
          candidates.push(
            "wap_farm_plant?sid=" +
              sid +
              "&g_ut=" +
              g_ut +
              "&v=0&cid=" +
              seedCid +
              "&landid=-1"
          );
        }
        if (candidates.length === 0) {
          var indexUrl = base + "/nc/cgi-bin/wap_farm_index?sid=" + sid + "&g_ut=" + g_ut;
          return ranchGet(indexUrl, cookie).then(function (html2) {
            var h2 = html2.replace(/&amp;/g, "&");
            var re2 = /<a[^>]+href="([^"]+)"[^>]*>[^<]*(播种|一键)[^<]*<\/a>/i;
            var m2 = re2.exec(h2);
            if (m2) candidates.push(m2[1]);
            if (candidates.length === 0) {
              log("🌱 一键播种: 未发现入口");
              return { did: false, cont: false };
            }
            return tryCandidates(reorderCandidates(candidates), 0);
          });
        }
        return tryCandidates(candidates, 0);
      })
      .catch(function (e) {
        log("🌱 一键播种失败: " + e);
        return { did: false, cont: false };
      });
  }

  function loop(round) {
    if (maxRepeat > 0 && round >= maxRepeat) return Promise.resolve(didAny);
    return doOnce().then(function (res) {
      if (res.did) {
        didAny = true;
        recordPlant(seedCid, 1);
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

function runFarmWap(cookie) {
  log("🧩 模式: WAP @ " + CONFIG.FARM_WAP_BASE);
  var base = CONFIG.FARM_WAP_BASE;
  var sid = CONFIG.RANCH_SID;
  var g_ut = getFarmGut();
  var statusUrl = base + "/nc/cgi-bin/wap_farm_status_list?sid=" + sid + "&g_ut=" + g_ut + "&page=0";
  var indexUrl = base + "/nc/cgi-bin/wap_farm_index?sid=" + sid + "&g_ut=" + g_ut;

  function fetchLinks() {
    return ranchGet(statusUrl, cookie)
      .then(function (html) {
        var links1 = extractFarmWapLinks(html);
        return ranchGet(indexUrl, cookie)
          .then(function (html2) {
            setStartStats("farm", parseCommonStats(html2));
            LAST_FARM_HOME_HTML = html2 || "";
            var fishEntry = extractFishEntryLink(html2);
            if (fishEntry) {
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
            return merged;
          })
          .catch(function () {
            return links1;
          });
      })
      .catch(function () {
        return ranchGet(indexUrl, cookie).then(function (html2) {
          setStartStats("farm", parseCommonStats(html2));
          LAST_FARM_HOME_HTML = html2 || "";
          var fishEntry = extractFishEntryLink(html2);
          if (fishEntry) {
            LAST_FISH_ENTRY_URL = fishEntry;
            logDebug("鱼塘入口(农场页): " + fishEntry);
          }
          return extractFarmWapLinks(html2);
        });
      });
  }

  function execLinks(list, label, statKey) {
    var idx = 0;
    var did = false;
    function next() {
      if (idx >= list.length) return Promise.resolve(did);
      var link = list[idx++];
      var url = link.indexOf("http") === 0 ? link : base + "/nc/cgi-bin/" + link.replace(/^\.?\//, "");
      return ranchGet(url, cookie)
        .then(function (html) {
          var msg = extractMessage(html);
          if (label.indexOf("除草") >= 0 || label.indexOf("除虫") >= 0 || label.indexOf("浇水") >= 0) {
            msg = extractWapHint(html) || msg;
          }
          msg = cleanActionMsg(msg);
          if (isSuccessMsg(msg)) did = true;
          if (msg) log(label + ": " + msg);
          else if (label.indexOf("除草") >= 0 || label.indexOf("除虫") >= 0 || label.indexOf("浇水") >= 0) {
            log(label + ": 已尝试");
          }
          if (statKey && ACTION_STATS[statKey] !== undefined) ACTION_STATS[statKey] += 1;
        })
        .then(function () {
          return sleep(CONFIG.WAIT_MS);
        })
        .then(next);
    }
    return next();
  }

  function runOnce() {
    return fetchLinks().then(function (links) {
      var didAny = false;
      var didForPass = false;
      return Promise.resolve()
        .then(function () {
          if (!CONFIG.ENABLE.clearWeed) return false;
          return execLinks(links.clearWeed, "🌿 除草", "clearWeed");
        })
        .then(function (d) {
          if (d) didAny = true;
          if (d) didForPass = true;
          if (!CONFIG.ENABLE.spraying) return false;
          return execLinks(links.spraying, "🐛 除虫", "spraying");
        })
        .then(function (d) {
          if (d) didAny = true;
          if (d) didForPass = true;
          if (!CONFIG.ENABLE.water) return false;
          return execLinks(links.water, "💧 浇水", "water");
        })
        .then(function (d) {
          if (d) didAny = true;
          if (d) didForPass = true;
          if (!CONFIG.ENABLE.harvest) return false;
          return execLinks(links.harvest, "🌾 收获", "harvest");
        })
        .then(function (d) {
          if (d) didAny = true;
          if (!CONFIG.ENABLE.scarify) return false;
          return execLinks(links.dig, "🪓 铲除枯萎", "scarify");
        })
        .then(function (d) {
          if (d) didAny = true;
          if (d) didForPass = true;
          if (!CONFIG.ENABLE.plant) return false;
          return farmOneKeySow(cookie, CONFIG.PLANT_CID);
        })
        .then(function (d) {
          if (d) didAny = true;
          return { didAny: didAny, didForPass: didForPass };
        });
    });
  }

  var maxPass = CONFIG.FARM_WAP_MAX_PASS || 0;
  function loop(round) {
    return runOnce().then(function (res) {
      if (!res || !res.didForPass) return { ok: true };
      if (maxPass > 0 && round >= maxPass - 1) return { ok: true };
      return loop(round + 1);
    });
  }

  return loop(0);
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
  if (PLANT_SEED_LOCKED) {
    return Promise.resolve(CONFIG.PLANT_CID);
  }
  var threshold = CONFIG.GRASS_THRESHOLD;
  if (grassCount !== null && grassCount < threshold) {
    log("🌱 种植策略: 牧草不足(" + grassCount + "<" + threshold + ")，优先种牧草");
    PLANT_SEED_LOCKED = true;
    return Promise.resolve(CONFIG.FARM_GRASS_SEED_ID);
  }
  var seedTotal = BAG_STATS.seed ? BAG_STATS.seed.total : 0;
  if (seedTotal >= CONFIG.FARM_SEED_MIN_TOTAL) {
    log("🌱 种植策略: 背包种子充足(" + seedTotal + ")，一键播种按背包顺序");
    PLANT_SEED_LOCKED = true;
    return Promise.resolve("");
  }
  log("🌱 种植策略: 背包种子偏少(" + seedTotal + "<" + CONFIG.FARM_SEED_MIN_TOTAL + ")，购买商店首个种子 x" + CONFIG.FARM_SEED_BUY_NUM);
  return buyFirstSeedWap(cookie, CONFIG.FARM_SEED_BUY_NUM).then(function () {
    PLANT_SEED_LOCKED = true;
    return "";
  });
}

/* =======================
 *  FISH MODE (鱼塘)
 * ======================= */
function fishGet(url, cookie, referer) {
  var target = normalizeMcappUrl(url);
  return getHtmlFollow(target, cookie, referer || defaultMcappReferer(), "鱼塘", 0).then(function (resp) {
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
  var entryUrl = LAST_FISH_ENTRY_URL ? buildMcappLink(base, LAST_FISH_ENTRY_URL) : "";
  var farmIndexUrl = base + "/nc/cgi-bin/wap_farm_index?sid=" + sid + "&g_ut=" + g_ut;

  function buildCtx(html) {
    return {
      sid: sid,
      g_ut: g_ut,
      lv: extractFishLevel(html) || "",
      indices: extractFishFertilizeIndices(html),
      harvestLinks: extractFishHarvestLinks(html),
      indexHtml: html
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
        (!ctx.harvestLinks || ctx.harvestLinks.length === 0);
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
        if (link) {
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

function execFishActions(base, cookie, ctx) {
  return Promise.resolve()
    .then(function () {
      if (!CONFIG.ENABLE.fish_feed) return;
      var hasFeedEntry =
        (ctx.indices && ctx.indices.length > 0) ||
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
          FISH_STATS.feed += 1;
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
            FISH_STATS.feed += 1;
          })
          .then(function () {
            return sleep(CONFIG.WAIT_MS);
          })
          .then(next);
      }
      return next();
    })
    .then(function () {
      if (!CONFIG.ENABLE.fish_harvest) return;
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
                FISH_STATS.harvest += 1;
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
                  FISH_STATS.harvest += 1;
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
          FISH_STATS.harvest += 1;
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
            FISH_STATS.harvest += 1;
          })
          .then(function () {
            return sleep(CONFIG.WAIT_MS);
          })
          .then(next);
      }
      return next();
    })
    .then(function () {
      if (!CONFIG.ENABLE.fish_sell_all) return;
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
          return;
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
          FISH_STATS.sell += 1;
        });
      });
    })
    .then(function () {
      if (!CONFIG.FISH_AUTO_BUY) return;
      var sid = ctx.sid;
      var g_ut = ctx.g_ut;
      var listUrl = base + "/nc/cgi-bin/wap_fish_buy_new?sid=" + sid + "&g_ut=" + g_ut + "&buyway=0";
      var listUrl2 = base + "/nc/cgi-bin/wap_fish_list_new?sid=" + sid + "&g_ut=" + g_ut + "&buyway=0";
      var needNum = 0;

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
          var total = ret.total;
          var target = CONFIG.FISH_MIN_SEED || 0;
          if (target > 0 && total >= target) {
            log("🎒 鱼苗充足: " + total + " (目标≥" + target + ")");
            return null;
          }
          if (target > 0) needNum = Math.max(target - total, 0);
          if (!needNum) needNum = CONFIG.FISH_BUY_NUM || 0;
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
            var target = CONFIG.FISH_MIN_SEED || 0;
            var buyNum = needNum || CONFIG.FISH_BUY_NUM || 0;
            if (target > 0 && buyNum <= 0) {
              log("🧾 买鱼: 已达到目标 " + target);
              return;
            }
            if (maxBuy && buyNum > maxBuy) buyNum = maxBuy;
            if (buyNum <= 0) {
              log("🧾 买鱼: 无可购买数量");
              return;
            }
            if (empty === 0) {
              log("🧾 买鱼: 空池塘=0，尝试补足鱼苗至 " + target);
            }
            var url =
              base +
              "/nc/cgi-bin/wap_fish_plant?sid=" +
              sid +
              "&g_ut=" +
              g_ut +
              "&fid=" +
              fid +
              "&flag=1&step=2&num=" +
              buyNum;
            return fishGet(url, cookie).then(function (html2) {
              var msg = extractMessage(html2);
              if (msg) log("🧾 买鱼: " + msg + (target > 0 ? " (补足至 " + target + ")" : ""));
              else log("🧾 买鱼: 已提交 " + buyNum + " 条");
              FISH_STATS.buy += 1;
            });
          });
        })
        .catch(function (e) {
          log("🧾 买鱼失败: " + e);
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
function ranchGet(url, cookie) {
  var target = normalizeMcappUrl(url);
  return getHtmlFollow(target, cookie, null, "牧场", 0).then(function (resp) {
    logDebug("牧场响应 " + (resp && resp.body ? resp.body.length : 0));
    return (resp && resp.body) || "";
  });
}

function probeRanchGrass(cookie) {
  var base = CONFIG.RANCH_BASE;
  var sid = CONFIG.RANCH_SID;
  var g_ut = CONFIG.RANCH_G_UT;
  var bagUrl = base + "/mc/cgi-bin/wap_pasture_bag_list?sid=" + sid + "&g_ut=" + g_ut;
  return ranchGet(bagUrl, cookie)
    .then(function (bagHtml) {
      var count = parseGrassCount(bagHtml);
      LAST_GRASS_COUNT = count;
      if (count === null) log("🌿 牧草数量(预判): 未知");
      else log("🌿 牧草数量(预判): " + count);
      return count;
    })
    .catch(function (e) {
      LAST_GRASS_COUNT = null;
      log("🌿 牧草预判失败: " + e);
      return null;
    });
}

function ranchSignIn(base, cookie, ctx) {
  if (!CONFIG.ENABLE.ranch_signin) return Promise.resolve();
  if (LAST_RANCH_HOME_HTML && !hasSignInEntry(LAST_RANCH_HOME_HTML)) {
    log("📅 牧场签到: 页面无入口(疑似已签到)");
    return Promise.resolve();
  }
  var url =
    base +
    "/mc/cgi-bin/wap_pasture_index?sid=" +
    ctx.sid +
    "&g_ut=" +
    ctx.g_ut +
    "&signin=1&optflag=2&pid=0&v=1";
  return ranchGet(url, cookie).then(function (html) {
    var msg = extractMessage(html);
    if (msg) log("📅 牧场签到: " + msg);
    RANCH_STATS.signin += 1;
  });
}

function ranchSellAll(base, cookie, ctx) {
  if (!CONFIG.ENABLE.ranch_sell_all) return Promise.resolve();
  var step1 =
    base +
    "/mc/cgi-bin/wap_pasture_rep_sale?&saleAll=1&step=1&sid=" +
    ctx.sid +
    "&g_ut=" +
    ctx.g_ut;
  return ranchGet(step1, cookie).then(function (html) {
    var h = html.replace(/&amp;/g, "&");
    var link = firstMatch(h, /(wap_pasture_rep_sale[^\"\\s>]*step=2[^\"\\s>]*)/);
    if (!link) {
      link = "wap_pasture_rep_sale?saleAll=1&step=2&sid=" + ctx.sid + "&g_ut=" + ctx.g_ut;
    }
    var url = link.indexOf("http") === 0 ? link : base + "/mc/cgi-bin/" + link.replace(/^\.?\//, "");
    return ranchGet(url, cookie).then(function (html2) {
      var msg = extractMessage(html2);
      var money = parseMoneyFromMsg(msg);
      if (money > 0) MONEY_STATS.ranchSell += money;
      if (msg) log("🧺 牧场售卖: " + msg);
      RANCH_STATS.sell += 1;
    });
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
      ctx.sid = ctx.sid || sid;
      ctx.g_ut = ctx.g_ut || g_ut;
      ctx.food = CONFIG.RANCH_FOOD || extractFoodId(html) || "";
      ctx.productSerials = extractProductionSerials(html);
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
      var bagUrl =
        base + "/mc/cgi-bin/wap_pasture_bag_list?sid=" + ctx.sid + "&g_ut=" + ctx.g_ut;
      return ranchGet(bagUrl, cookie).then(function (bagHtml) {
        ctx.grassCount = parseGrassCount(bagHtml);
        LAST_GRASS_COUNT = ctx.grassCount;
        if (ctx.grassCount === null) {
          log("🌿 牧草数量: 未知");
        } else {
          log("🌿 牧草数量: " + ctx.grassCount);
        }
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
              ctx.grassCount <= 0
            ) {
              log("🌿 牧草为 0，准备购买并种植");
              return buyGrassSeed(cookie).then(function () {
                return plantGrassFromFarm(cookie);
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

function execRanchActions(base, cookie, ctx) {
  var didHarvestAfterProduct = false;

  function doFeed() {
    if (!CONFIG.ENABLE.ranch_feed) return Promise.resolve();
    if (ctx.grassCount !== null && ctx.grassCount <= 0) {
      log("🌿 喂草: 牧草为 0，跳过");
      return Promise.resolve();
    }
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
      .then(function () {
        var url2 = base + "/mc/cgi-bin/wap_pasture_feed_food?sid=" + ctx.sid + "&g_ut=" + ctx.g_ut;
        return ranchGet(url2, cookie);
      })
      .then(function (html) {
        var msg = extractMessage(html);
        if (msg) log("🌿 喂草: " + msg);
        RANCH_STATS.feed += 1;
      });
  }

  function doProductList() {
    if (!CONFIG.ENABLE.ranch_product) return Promise.resolve();
    var list = ctx.productSerials && ctx.productSerials.length > 0 ? ctx.productSerials : [];
    if (list.length === 0) {
      log("🥚 生产: 未发现可生产动物");
      return Promise.resolve();
    }
    var max = Math.min(CONFIG.RANCH_MAX_SERIAL || 6, list.length);
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
          var msg = extractMessage(html);
          if (msg) log("🥚 生产: " + msg);
          RANCH_STATS.product += 1;
          if (msg && msg.indexOf("成功") >= 0) {
            didHarvestAfterProduct = true;
            return sleep(16000).then(function () {
              var hurl =
                base +
                "/mc/cgi-bin/wap_pasture_harvest?sid=" +
                ctx.sid +
                "&g_ut=" +
                ctx.g_ut +
                "&serial=" +
                serial +
                "&htype=3";
              return ranchGet(hurl, cookie).then(function (html2) {
                var msg2 = extractMessage(html2);
                if (msg2) log("🐮 收获: " + msg2);
                RANCH_STATS.harvest += 1;
                ctx._help = extractHelpParams(html2) || ctx._help;
              });
            });
          }
        })
        .then(function () {
          return sleep(CONFIG.WAIT_MS);
        })
        .then(next);
    }
    return next();
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
      var msg = extractMessage(html);
      if (msg) log("🐮 收获: " + msg);
      RANCH_STATS.harvest += 1;
      ctx._help = extractHelpParams(html);
    });
  }

  function doHelp() {
    if (!CONFIG.ENABLE.ranch_help) return Promise.resolve();
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
      RANCH_STATS.help += 1;
    });
  }

  return Promise.resolve()
    .then(doFeed)
    .then(function () {
      return sleep(CONFIG.WAIT_MS);
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
      return runRanch(CONFIG.RANCH_BASE, ranchCookie);
    })
    .then(function () {
      return runFarmWap(cookie).then(function () {
        return farmSignIn(cookie).then(function () {
          return farmSellAll(cookie);
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
