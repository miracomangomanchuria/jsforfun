/*
用途说明：
- Quantumult X 北京地铁出发时刻测算脚本。
- 输入经纬度（lon/lat），输出最近站点及各方向后续班次信息。
- backend/重写模式返回扁平列表；主动运行模式会发送 QX 通知（正文为该扁平列表文本化结果）。
- 若经纬度超出京冀边界，仅返回/通知一行提示，不盲目计算。

数据源致敬（感谢提供者）：
- BoyInTheSun（北京地铁开源时刻表与查询站点）：
  https://github.com/BoyInTheSun/beijing-subway-schedule
  https://bjsubway.boyinthesun.cn/
- 北京地铁公开站点地图接口提供方：
  https://dtdata.bjsubway.com/stations/map-app.json
- NateScarlet（holiday-cn 中国节假日数据）：
  https://github.com/NateScarlet/holiday-cn

参数格式：
- backend/重写调用建议传 lon + lat。
- 支持 "lon,lat"、"lon lat"、"lon=<value>&lat=<value>"。
- 可选附加 amap_key 覆盖内置 key：lon=<value>&lat=<value>&amap_key=<YOUR_WEB_KEY>
- 主动运行/定时任务若未传参数，将自动走 IP 反查定位。

QX backend 配置示例：
- 在 Quantumult X 配置文件中添加（按你的 host/path 修改）：
  [http_backend]
  https://raw.githubusercontent.com/miracomangomanchuria/jsforfun/main/beijing_subway/beijing_subway_qx.js, host=127.0.0.1:9999, tag=北京地铁出发时刻测算, path=/beijing_subway, img-url=https://raw.githubusercontent.com/miracomangomanchuria/jsforfun/main/icons/beijing_subway_logo.png, enabled=true
- 如果你仓库目录名是 icon 或 incons，请把上面 img-url 的 /icons/ 改成实际目录名。
- 调用方式（POST body 任一格式均可）：
  lon,lat
  lon=<value>&lat=<value>
  {"lon":116.3198,"lat":39.9288}
- 返回体：扁平数组，每站 2 段平铺
  [站点头, 站点线路详情, 站点头, 站点线路详情, ...]

QX 重写模式示例（类似 BoxJs 的域名访问，不走 http_backend）：
- 远程重写 conf 推荐使用“纯规则行”格式（与 BoxJs 一致，不写 [rewrite_local]/[mitm] 分段头）：
  hostname = beijing.ditie
  ^https?:\/\/beijing\.ditie\/beijing_subway(\?.*)?$ url script-analyze-echo-response https://raw.githubusercontent.com/miracomangomanchuria/jsforfun/main/beijing_subway/beijing_subway_qx.js
- 访问示例：
  http://beijing.ditie/beijing_subway?lon=116.3198123&lat=39.9288123

日志协议：
- 每个站点拆为两段：PART1（站点头）和 PART2（线路详情）。
- 分隔符固定，便于下游脚本按段解析。

缓存策略：
- 时刻表按“服务日所在半月”更新（1-15/16-月末），每半月首跑同时刷新工作日+非工作日两份。
- 时刻表紧凑索引按半月缓存，命中后无需每次全量扫描线路。
- 站点地图按“服务日所在月份”更新（每月首跑自动刷新）。
- 节假日按“年份”更新（当年首次请求后复用本地缓存）。
- 若刷新失败，自动回退到旧缓存，避免脚本不可用。
*/

const MAP_APP_URL = "https://dtdata.bjsubway.com/stations/map-app.json";
const SCHEDULE_WEEKDAY_URLS = [
  "https://raw.githubusercontent.com/BoyInTheSun/beijing-subway-schedule/main/train_schedule_all/schedule_weekday.json",
  "https://cdn.jsdelivr.net/gh/BoyInTheSun/beijing-subway-schedule@main/train_schedule_all/schedule_weekday.json"
];
const SCHEDULE_WEEKEND_URLS = [
  "https://raw.githubusercontent.com/BoyInTheSun/beijing-subway-schedule/main/train_schedule_all/schedule_weekend.json",
  "https://cdn.jsdelivr.net/gh/BoyInTheSun/beijing-subway-schedule@main/train_schedule_all/schedule_weekend.json"
];
const HOLIDAY_CN_URL = "https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/{year}.json";
const AMAP_WEB_KEY = "50ebc729a87ba59663ef08b377ec24d0";
const AMAP_ENABLE_EXIT_ETA = true;
const AMAP_TIMEOUT_MS = 7000;
const AMAP_EXIT_SEARCH_RADIUS_M = 1500;
const AMAP_EXIT_TYPECODE = "150501";

const SCRIPT_VERSION = "1.5.0";
const CROSSLINE_LOOKBACK = 5;
const CROSSLINE_MIN_OTHER = 3;
const STATION_THRESHOLD_M = 300;
const MAX_STATIONS = 8;
const SERVICE_DAY_CUTOFF_HOUR = 4;
const HTTP_TIMEOUT_MS = 60000;
const HOLIDAY_HTTP_TIMEOUT_MS = 5000;
const CACHE_KEY_PREFIX = "bjsubway_qx_v1";
const CACHE_CHUNK_SIZE = 180000;
const CACHE_MAX_CHUNKS = 120;
const SCHEDULE_COMPACT_INDEX_VERSION = 1;
const LEGACY_CLEANUP_ONCE_KEY = `${CACHE_KEY_PREFIX}:cleanup_once:v140`;
const AMAP_EXIT_CACHE_KEY = `${CACHE_KEY_PREFIX}:amap:station_exits:v1`;
const AMAP_EXIT_CACHE_MAX_PER_STATION = 96;
const AMAP_KEY_CHECK_CACHE_KEY = `${CACHE_KEY_PREFIX}:amap:key_check:v1`;
const AMAP_KEY_CHECK_TTL_MS = 24 * 3600 * 1000;
const IP_LOC_CACHE_KEY = `${CACHE_KEY_PREFIX}:ip_loc:v1`;
const IP_LOC_TTL_MS = 20 * 60 * 1000;
const IP_GEO_TIMEOUT_MS = 5000;
// 服务区边界（北京+河北并集，来源: OpenStreetMap/Nominatim 行政区 bounding box，2026-03-20）
const SERVICE_REGION_MIN_LAT = 36.0483981;
const SERVICE_REGION_MAX_LAT = 42.6176407;
const SERVICE_REGION_MIN_LON = 113.4564701;
const SERVICE_REGION_MAX_LON = 119.9528500;

const __MEMORY_STORE__ = {};
const __AMAP_KEY_CHECK_CACHE__ = {};

function isBackendContext() {
  return typeof $request !== "undefined" && $request && typeof $request.url === "string";
}

function redactSensitiveText(v) {
  let s = String(v == null ? "" : v);
  s = s.replace(/((?:amap_key|amapkey|web_key)\s*=\s*)([0-9a-zA-Z]+)/ig, "$1***");
  s = s.replace(/(\"(?:amap_key|amapkey|web_key)\"\s*:\s*\")([^\"]+)(\")/ig, "$1***$3");
  return s;
}

function storeRead(key) {
  try {
    if (typeof $prefs !== "undefined" && $prefs && typeof $prefs.valueForKey === "function") {
      const v = $prefs.valueForKey(key);
      return v == null ? null : String(v);
    }
    if (typeof $persistentStore !== "undefined" && $persistentStore && typeof $persistentStore.read === "function") {
      const v = $persistentStore.read(key);
      return v == null ? null : String(v);
    }
  } catch (e) {
    // ignore
  }
  if (Object.prototype.hasOwnProperty.call(__MEMORY_STORE__, key)) {
    return __MEMORY_STORE__[key];
  }
  return null;
}

function storeWrite(key, value) {
  const s = value == null ? "" : String(value);
  let ok = false;
  let hasPersistentApi = false;
  try {
    if (typeof $prefs !== "undefined" && $prefs && typeof $prefs.setValueForKey === "function") {
      hasPersistentApi = true;
      ok = !!$prefs.setValueForKey(s, key);
    } else if (typeof $persistentStore !== "undefined" && $persistentStore && typeof $persistentStore.write === "function") {
      hasPersistentApi = true;
      ok = !!$persistentStore.write(s, key);
    }
  } catch (e) {
    ok = false;
  }
  if (!ok && !hasPersistentApi) {
    __MEMORY_STORE__[key] = s;
  }
  return ok;
}

function readJsonCache(key) {
  const raw = storeRead(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function writeJsonCache(key, obj) {
  try {
    return storeWrite(key, JSON.stringify(obj));
  } catch (e) {
    return false;
  }
}

function readLargeTextCache(baseKey) {
  const meta = readJsonCache(baseKey + ":meta");
  if (!meta || typeof meta !== "object") return null;
  const chunks = Number(meta.chunks);
  if (!Number.isFinite(chunks) || chunks <= 0 || chunks > CACHE_MAX_CHUNKS) return null;

  let all = "";
  for (let i = 0; i < chunks; i++) {
    const part = storeRead(`${baseKey}:part:${i}`);
    if (part == null) return null;
    all += String(part);
  }
  return all;
}

function writeLargeTextCache(baseKey, text) {
  const s = String(text == null ? "" : text);
  const chunks = Math.max(1, Math.ceil(s.length / CACHE_CHUNK_SIZE));
  if (chunks > CACHE_MAX_CHUNKS) return false;

  const oldMeta = readJsonCache(baseKey + ":meta");
  const oldChunks = oldMeta && Number.isFinite(Number(oldMeta.chunks)) ? Number(oldMeta.chunks) : 0;

  for (let i = 0; i < chunks; i++) {
    const seg = s.slice(i * CACHE_CHUNK_SIZE, (i + 1) * CACHE_CHUNK_SIZE);
    if (!storeWrite(`${baseKey}:part:${i}`, seg)) return false;
  }
  for (let i = chunks; i < oldChunks; i++) {
    storeWrite(`${baseKey}:part:${i}`, "");
  }

  return writeJsonCache(baseKey + ":meta", {
    chunks,
    len: s.length,
    updated_at: new Date().toISOString()
  });
}

function clearLargeTextCache(baseKey) {
  const meta = readJsonCache(baseKey + ":meta");
  const chunks = meta && Number.isFinite(Number(meta.chunks)) ? Number(meta.chunks) : 0;
  for (let i = 0; i < chunks; i++) {
    storeWrite(`${baseKey}:part:${i}`, "");
  }
  storeWrite(baseKey + ":meta", "");
}

function readLargeJsonCache(baseKey) {
  const raw = readLargeTextCache(baseKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function writeLargeJsonCache(baseKey, obj) {
  try {
    return writeLargeTextCache(baseKey, JSON.stringify(obj));
  } catch (e) {
    return false;
  }
}

function doneOk(extra = "") {
  if (typeof $done === "function") {
    if (isBackendContext()) {
      $done({
        status: "HTTP/1.1 200 OK",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ ok: true, output: String(extra == null ? "" : extra) })
      });
      return;
    }
    $done(extra);
  }
}

function doneBackendJson(obj, statusCode = 200) {
  if (typeof $done !== "function") return;
  if (!isBackendContext()) {
    $done(typeof obj === "string" ? obj : JSON.stringify(obj));
    return;
  }
  const code = Number(statusCode) || 200;
  const reason = code >= 200 && code < 300 ? "OK" : "Bad Request";
  $done({
    status: `HTTP/1.1 ${code} ${reason}`,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(obj, null, 2)
  });
}

function flattenStationParts(parts) {
  const flat = [];
  for (const p of parts || []) {
    flat.push(String((p && p.head) || ""));
    flat.push(String((p && p.body) || ""));
  }
  return flat;
}

function flatListToNotifyText(flat) {
  const out = [];
  for (let i = 0; i < (flat || []).length; i += 2) {
    const head = String(flat[i] == null ? "" : flat[i]).trim();
    const body = String(flat[i + 1] == null ? "" : flat[i + 1]).trim();
    if (head) out.push(head);
    if (body) out.push(body);
    if (i + 2 < flat.length) out.push("");
  }
  return out.join("\n").trim();
}

function notifyByBackendFlatList(flat, title = "北京地铁出发时刻测算") {
  if (typeof $notify !== "function") return;
  const text = flatListToNotifyText(flat);
  if (!text) return;
  try {
    $notify(title, "", text);
  } catch (e) {
    // ignore
  }
}

function doneErr(err) {
  const eMsg = err && err.message ? String(err.message) : String(err);
  const eStack = err && err.stack ? String(err.stack) : "";
  const msg = eStack && eStack.indexOf(eMsg) === -1 ? `${eMsg}\n${eStack}` : (eStack || eMsg);
  const tagged = `[v${SCRIPT_VERSION}] ${msg}`;
  console.log("[ERROR] " + tagged);
  if (typeof $done === "function") {
    if (isBackendContext()) {
      $done({
        status: "HTTP/1.1 400 Bad Request",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify([`ERROR: ${tagged}`])
      });
      return;
    }
    $done("ERROR: " + tagged);
  }
}

function fetchJson(url, headers = {}, timeoutMs = HTTP_TIMEOUT_MS) {
  const req = {
    url,
    method: "GET",
    headers: Object.assign(
      {
        "User-Agent": "QuantumultX",
        "Accept": "application/json,text/plain,*/*"
      },
      headers || {}
    ),
    timeout: timeoutMs
  };
  return $task.fetch(req).then((resp) => {
    const status = Number(resp.statusCode || 0);
    if (status < 200 || status >= 300) {
      throw new Error(`HTTP ${status} for ${url}`);
    }
    try {
      return JSON.parse(resp.body || "{}");
    } catch (e) {
      const em = e && e.message ? e.message : String(e);
      throw new Error(`JSON 解析失败: ${url} | ${em}`);
    }
  }).catch((e) => {
    const em = e && e.message ? e.message : String(e);
    throw new Error(`请求失败: ${url} | ${em}`);
  });
}

async function fetchJsonWithFallback(urls, headers = {}, timeoutMs = HTTP_TIMEOUT_MS) {
  const list = Array.isArray(urls) ? urls : [urls];
  const errs = [];
  for (const u of list) {
    try {
      return await fetchJson(u, headers, timeoutMs);
    } catch (e) {
      const em = e && e.message ? e.message : String(e);
      errs.push(em);
    }
  }
  throw new Error("全部数据源请求失败:\n" + errs.join("\n"));
}

function buildQueryString(params) {
  const arr = [];
  for (const [k, v] of Object.entries(params || {})) {
    if (v == null || v === "") continue;
    arr.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return arr.join("&");
}

function parseLonLat(s) {
  const m = String(s || "").trim().match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lon = Number(m[1]);
  const lat = Number(m[2]);
  if (!isValidLonLat(lon, lat)) return null;
  return { lon, lat };
}

function isValidLonLat(lon, lat) {
  if (!Number.isFinite(Number(lon)) || !Number.isFinite(Number(lat))) return false;
  const xLon = Number(lon);
  const xLat = Number(lat);
  if (xLon < -180 || xLon > 180) return false;
  if (xLat < -90 || xLat > 90) return false;
  return true;
}

function isInServiceRegionBJHebei(lon, lat) {
  if (!isValidLonLat(lon, lat)) return false;
  const xLon = Number(lon);
  const xLat = Number(lat);
  return !(
    xLon < SERVICE_REGION_MIN_LON ||
    xLon > SERVICE_REGION_MAX_LON ||
    xLat < SERVICE_REGION_MIN_LAT ||
    xLat > SERVICE_REGION_MAX_LAT
  );
}

function extractAmapKeyOverride(arg) {
  if (arg && typeof arg === "object") {
    const ks = ["amap_key", "amapkey", "web_key"];
    for (const k of ks) {
      if (Object.prototype.hasOwnProperty.call(arg, k)) {
        const v = String(arg[k] == null ? "" : arg[k]).trim();
        if (v) return v;
      }
    }
  }
  const s = String(arg == null ? "" : arg).trim();
  if (!s) return "";
  let x = s;
  if (x.includes("%")) {
    try { x = decodeURIComponent(x); } catch (e) { /* ignore */ }
  }
  const m = x.match(/(?:^|[?&;,\s])(?:amap_key|amapkey|web_key)\s*=\s*([0-9a-zA-Z]+)/i);
  return m ? String(m[1] || "").trim() : "";
}

function amapOkay(obj) {
  return String(obj && obj.status) === "1";
}

function readAmapKeyCheckCacheObj() {
  const obj = readJsonCache(AMAP_KEY_CHECK_CACHE_KEY);
  if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj;
  return {};
}

function writeAmapKeyCheckCacheObj(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return;
  writeJsonCache(AMAP_KEY_CHECK_CACHE_KEY, obj);
}

async function ensureAmapWebKeyUsable(amapKey) {
  const k = String(amapKey || "").trim();
  if (!k) return false;
  if (Object.prototype.hasOwnProperty.call(__AMAP_KEY_CHECK_CACHE__, k)) {
    return !!__AMAP_KEY_CHECK_CACHE__[k];
  }
  const nowTs = Date.now();
  const persisted = readAmapKeyCheckCacheObj();
  const pe = persisted[k];
  if (pe && typeof pe === "object") {
    const ts = Number(pe.ts);
    const ok = !!pe.ok;
    if (Number.isFinite(ts) && nowTs - ts >= 0 && nowTs - ts <= AMAP_KEY_CHECK_TTL_MS) {
      __AMAP_KEY_CHECK_CACHE__[k] = ok;
      return ok;
    }
  }

  const url = `https://restapi.amap.com/v3/ip?${buildQueryString({ key: k })}`;
  try {
    const obj = await fetchJson(url, {}, AMAP_TIMEOUT_MS);
    const ok = amapOkay(obj);
    __AMAP_KEY_CHECK_CACHE__[k] = ok;
    persisted[k] = { ok, ts: nowTs };
    writeAmapKeyCheckCacheObj(persisted);
    return ok;
  } catch (e) {
    __AMAP_KEY_CHECK_CACHE__[k] = false;
    persisted[k] = { ok: false, ts: nowTs };
    writeAmapKeyCheckCacheObj(persisted);
    return false;
  }
}

function parseAmapRectangleCenter(rectangle) {
  const s = String(rectangle || "").trim();
  if (!s) return null;
  const m = s.match(
    /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*;\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/
  );
  if (!m) return null;
  const lon1 = Number(m[1]);
  const lat1 = Number(m[2]);
  const lon2 = Number(m[3]);
  const lat2 = Number(m[4]);
  const lon = (lon1 + lon2) / 2;
  const lat = (lat1 + lat2) / 2;
  if (!isValidLonLat(lon, lat)) return null;
  return { lon, lat };
}

function loadIpLocateCacheObj() {
  const obj = readJsonCache(IP_LOC_CACHE_KEY);
  if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj;
  return null;
}

function saveIpLocateCacheObj(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;
  writeJsonCache(IP_LOC_CACHE_KEY, entry);
}

async function locateByIpViaAmap(amapKey) {
  const k = String(amapKey || "").trim();
  if (!k) return null;
  const url = `https://restapi.amap.com/v3/ip?${buildQueryString({ key: k })}`;
  const obj = await fetchJson(url, {}, AMAP_TIMEOUT_MS);
  if (!amapOkay(obj)) return null;

  const center = parseAmapRectangleCenter(obj.rectangle);
  if (center) {
    return {
      lon: center.lon,
      lat: center.lat,
      source: "amap_ip",
      coord_hint: "gcj02"
    };
  }

  const direct = parseLonLat(String(obj.location || ""));
  if (direct && isValidLonLat(direct.lon, direct.lat)) {
    return {
      lon: direct.lon,
      lat: direct.lat,
      source: "amap_ip",
      coord_hint: "gcj02"
    };
  }
  return null;
}

async function locateByIpViaIpApiCom() {
  // ip-api 免费层仅支持 HTTP。
  const obj = await fetchJson("http://ip-api.com/json/?fields=status,message,lat,lon", {}, IP_GEO_TIMEOUT_MS);
  if (!obj || String(obj.status || "") !== "success") return null;
  const lon = Number(obj.lon);
  const lat = Number(obj.lat);
  if (!isValidLonLat(lon, lat)) return null;
  return {
    lon,
    lat,
    source: "ip_api_com",
    coord_hint: "wgs84"
  };
}

async function locateByIpViaIpInfoIo() {
  const obj = await fetchJson("https://ipinfo.io/json", {}, IP_GEO_TIMEOUT_MS);
  if (!obj || typeof obj !== "object") return null;
  const loc = String(obj.loc || "").trim();
  const m = loc.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (!isValidLonLat(lon, lat)) return null;
  return {
    lon,
    lat,
    source: "ipinfo_io",
    coord_hint: "wgs84"
  };
}

async function resolveLonLatByIp(amapKey) {
  const nowTs = Date.now();
  const cached = loadIpLocateCacheObj();
  if (
    cached &&
    isValidLonLat(cached.lon, cached.lat) &&
    Number.isFinite(Number(cached.ts)) &&
    nowTs - Number(cached.ts) >= 0 &&
    nowTs - Number(cached.ts) <= IP_LOC_TTL_MS
  ) {
    return {
      lon: Number(cached.lon),
      lat: Number(cached.lat),
      source: String(cached.source || "cache"),
      coord_hint: String(cached.coord_hint || "unknown"),
      from_cache: true
    };
  }

  const tries = [
    () => locateByIpViaAmap(amapKey),
    () => locateByIpViaIpApiCom(),
    () => locateByIpViaIpInfoIo()
  ];
  for (const fn of tries) {
    try {
      const got = await fn();
      if (!got || !isValidLonLat(got.lon, got.lat)) continue;
      saveIpLocateCacheObj({
        ts: nowTs,
        lon: Number(got.lon),
        lat: Number(got.lat),
        source: String(got.source || "ip"),
        coord_hint: String(got.coord_hint || "unknown")
      });
      return Object.assign({}, got, { from_cache: false });
    } catch (e) {
      // ignore and continue fallback chain
    }
  }
  return null;
}

function parseAmapExitLabel(name) {
  const s = String(name || "").trim();
  // 例如: 国家图书馆地铁站-A口 / A口 / B2口
  const m = s.match(/([A-Za-z]\d{0,2})\s*口/);
  if (!m) return "";
  return String(m[1] || "").toUpperCase();
}

function pickAmapDurationSeconds(obj) {
  const cands = [
    obj && obj.route && Array.isArray(obj.route.paths) && obj.route.paths[0] && obj.route.paths[0].duration,
    obj && obj.data && Array.isArray(obj.data.paths) && obj.data.paths[0] && obj.data.paths[0].duration
  ];
  for (const x of cands) {
    const v = Number(x);
    if (Number.isFinite(v) && v >= 0) return v;
  }
  return null;
}

function secToRoundedMin(sec) {
  const v = Number(sec);
  if (!Number.isFinite(v) || v < 0) return null;
  if (v === 0) return 0;
  return Math.max(1, Math.round(v / 60));
}

function loadAmapExitCache() {
  const raw = readLargeJsonCache(AMAP_EXIT_CACHE_KEY);
  if (
    raw &&
    typeof raw === "object" &&
    raw.stations &&
    typeof raw.stations === "object" &&
    !Array.isArray(raw.stations)
  ) {
    return raw;
  }
  return {
    version: 1,
    updated_at: new Date().toISOString(),
    stations: {}
  };
}

function saveAmapExitCache(cacheObj) {
  const obj = cacheObj && typeof cacheObj === "object" ? cacheObj : { version: 1, stations: {} };
  if (!obj.stations || typeof obj.stations !== "object" || Array.isArray(obj.stations)) obj.stations = {};
  obj.updated_at = new Date().toISOString();
  writeLargeJsonCache(AMAP_EXIT_CACHE_KEY, obj);
}

function sanitizeAmapExitRows(rows) {
  const map = {};
  const out = [];
  for (const r of rows || []) {
    if (!r || typeof r !== "object") continue;
    const lon = Number(r.lon);
    const lat = Number(r.lat);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const name = String(r.name || "").trim();
    const label = String(r.label || "").trim().toUpperCase();
    const key = `${label}|${lon.toFixed(6)},${lat.toFixed(6)}`;
    if (map[key]) continue;
    map[key] = 1;
    out.push({ name, label, lon, lat });
    if (out.length >= AMAP_EXIT_CACHE_MAX_PER_STATION) break;
  }
  return out;
}

function pickNearestExitFromRows(stationName, stationLon, stationLat, userLon, userLat, exits) {
  const nStation = normName(stationName);
  const rows = [];
  for (const e of exits || []) {
    if (!e || typeof e !== "object") continue;
    const lon = Number(e.lon);
    const lat = Number(e.lat);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const name = String(e.name || "");
    const label = String(e.label || "").trim().toUpperCase();
    rows.push({
      name,
      label,
      lon,
      lat,
      d_user: haversineM(userLat, userLon, lat, lon),
      d_station: haversineM(stationLat, stationLon, lat, lon),
      name_match: !!(nStation && normName(name).includes(nStation))
    });
  }
  if (!rows.length) return null;
  rows.sort((a, b) => {
    const ma = Number(a.name_match);
    const mb = Number(b.name_match);
    if (ma !== mb) return mb - ma;
    if (Math.abs(a.d_user - b.d_user) > 1e-6) return a.d_user - b.d_user;
    return a.d_station - b.d_station;
  });
  return rows[0];
}

async function fetchAmapStationExitsFromWeb(stationName, stationLon, stationLat, amapKey) {
  const allRows = [];
  const baseParams = {
    key: amapKey,
    location: `${stationLon},${stationLat}`,
    radius: AMAP_EXIT_SEARCH_RADIUS_M,
    types: AMAP_EXIT_TYPECODE,
    sortrule: "distance",
    offset: 30,
    page: 1,
    extensions: "base"
  };

  const tries = [
    Object.assign({}, baseParams, { keywords: `${stationName}地铁站` }),
    Object.assign({}, baseParams, { keywords: stationName }),
    Object.assign({}, baseParams)
  ];

  for (const params of tries) {
    const url = `https://restapi.amap.com/v3/place/around?${buildQueryString(params)}`;
    let obj = null;
    try {
      obj = await fetchJson(url, {}, AMAP_TIMEOUT_MS);
    } catch (e) {
      continue;
    }
    if (!amapOkay(obj) || !Array.isArray(obj.pois) || !obj.pois.length) continue;

    const thisRows = [];
    for (const p of obj.pois) {
      if (!p || typeof p !== "object") continue;
      const ll = parseLonLat(p.location);
      if (!ll) continue;
      const name = String(p.name || "");
      const label = parseAmapExitLabel(name);
      thisRows.push({
        name,
        label,
        lon: ll.lon,
        lat: ll.lat
      });
    }
    if (thisRows.length) {
      for (const r of thisRows) allRows.push(r);
      // 性能优先：首个有效结果且已带出口字母时停止继续回退请求
      if (thisRows.some((r) => String(r.label || "").trim() !== "")) break;
    }
  }
  return sanitizeAmapExitRows(allRows);
}

async function fetchAmapWalkRideMinutes(originLon, originLat, destLon, destLat, amapKey) {
  const origin = `${originLon},${originLat}`;
  const destination = `${destLon},${destLat}`;
  const walkUrl = `https://restapi.amap.com/v3/direction/walking?${buildQueryString({
    key: amapKey, origin, destination
  })}`;
  const rideUrl = `https://restapi.amap.com/v4/direction/bicycling?${buildQueryString({
    key: amapKey, origin, destination
  })}`;

  const [walkObj, rideObj] = await Promise.all([
    fetchJson(walkUrl, {}, AMAP_TIMEOUT_MS).catch(() => null),
    fetchJson(rideUrl, {}, AMAP_TIMEOUT_MS).catch(() => null)
  ]);

  const walkSec = pickAmapDurationSeconds(walkObj);
  const rideSec = pickAmapDurationSeconds(rideObj);
  return {
    walk_min: secToRoundedMin(walkSec),
    ride_min: secToRoundedMin(rideSec)
  };
}

async function fetchStationExitEta(station, userLon, userLat, amapKey, exitCacheCtx) {
  if (!AMAP_ENABLE_EXIT_ETA || !amapKey) return null;
  if (!station || !Number.isFinite(station.lon) || !Number.isFinite(station.lat)) return null;
  const stationNorm = normName(station.name);
  let exits = [];

  if (
    exitCacheCtx &&
    exitCacheCtx.data &&
    exitCacheCtx.data.stations &&
    typeof exitCacheCtx.data.stations === "object"
  ) {
    const ent = exitCacheCtx.data.stations[stationNorm];
    if (ent && Array.isArray(ent.exits) && ent.exits.length) {
      exits = sanitizeAmapExitRows(ent.exits);
    }
  }

  if (!exits.length) {
    exits = await fetchAmapStationExitsFromWeb(station.name, station.lon, station.lat, amapKey);
    if (
      exits.length &&
      exitCacheCtx &&
      exitCacheCtx.data &&
      exitCacheCtx.data.stations &&
      typeof exitCacheCtx.data.stations === "object"
    ) {
      exitCacheCtx.data.stations[stationNorm] = {
        station_name: station.name,
        fetched_at: new Date().toISOString(),
        exits
      };
      exitCacheCtx.dirty = true;
    }
  }

  const exit = pickNearestExitFromRows(station.name, station.lon, station.lat, userLon, userLat, exits);
  // 若未匹配到出口，回退到站点中心估算，避免多站时只有一站有路途用时。
  const destLon = exit && Number.isFinite(exit.lon) ? Number(exit.lon) : Number(station.lon);
  const destLat = exit && Number.isFinite(exit.lat) ? Number(exit.lat) : Number(station.lat);
  const directDist =
    exit && Number.isFinite(Number(exit.d_user))
      ? Number(exit.d_user)
      : haversineM(userLat, userLon, destLat, destLon);
  const eta = await fetchAmapWalkRideMinutes(userLon, userLat, destLon, destLat, amapKey);
  if (!Number.isFinite(Number(eta.walk_min)) && !Number.isFinite(Number(eta.ride_min))) return null;
  return {
    exit_label: String((exit && exit.label) || ""),
    distance_m: Number.isFinite(directDist) ? directDist : null,
    walk_min: eta.walk_min,
    ride_min: eta.ride_min
  };
}

function pad2(n) {
  const v = Math.trunc(Number(n));
  if (v >= 0 && v < 10) return "0" + String(v);
  return String(v);
}

function hhmmStr(h, m) {
  return `${pad2(h)}:${pad2(m)}`;
}

function parseHHMMLoose(s) {
  const m = String(s || "").match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (Number.isNaN(hh) || Number.isNaN(mm) || hh < 0 || hh > 29 || mm < 0 || mm > 59) return null;
  return [hh, mm];
}

function parseHHMM(s) {
  const m = String(s || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (Number.isNaN(hh) || Number.isNaN(mm) || hh < 0 || hh > 29 || mm < 0 || mm > 59) return null;
  return [hh, mm];
}

function normName(s) {
  return String(s || "")
    .replace(/\s+/g, "")
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/地铁站$/, "")
    .replace(/站$/, "")
    .replace(/[-－—].*$/, "");
}

function serviceDayFor(now, cutoffHour = 4) {
  const d = new Date(now.getTime());
  if (d.getHours() < cutoffHour) {
    d.setDate(d.getDate() - 1);
    return { date: d, shifted: true };
  }
  return { date: d, shifted: false };
}

function ymd(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function monthKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function halfMonthKey(d) {
  const part = d.getDate() <= 15 ? "H1" : "H2";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${part}`;
}

async function loadHolidayYearData(year) {
  const key = `${CACHE_KEY_PREFIX}:holiday:${year}`;
  const cached = readJsonCache(key);
  if (cached && typeof cached === "object" && Array.isArray(cached.days)) {
    return { data: cached, source: `holiday-cn-cache:${year}` };
  }

  const url = HOLIDAY_CN_URL.replace("{year}", String(year));
  const remote = await fetchJson(url, {}, HOLIDAY_HTTP_TIMEOUT_MS);
  if (remote && typeof remote === "object" && Array.isArray(remote.days)) {
    writeJsonCache(key, remote);
  }
  return { data: remote, source: `holiday-cn:${year}` };
}

async function loadMapWithMonthlyCache(periodKey) {
  const cacheKey = `${CACHE_KEY_PREFIX}:map:monthly`;
  const cached = readLargeJsonCache(cacheKey);
  if (
    cached &&
    typeof cached === "object" &&
    cached.period_key === periodKey &&
    cached.data &&
    typeof cached.data === "object" &&
    Array.isArray(cached.data.stations_data) &&
    Array.isArray(cached.data.lines_data)
  ) {
    return cached.data;
  }
  try {
    const remote = await fetchJson(MAP_APP_URL);
    writeLargeJsonCache(cacheKey, {
      period_key: periodKey,
      updated_at: new Date().toISOString(),
      data: remote
    });
    return remote;
  } catch (e) {
    if (
      cached &&
      cached.data &&
      typeof cached.data === "object" &&
      Array.isArray(cached.data.stations_data) &&
      Array.isArray(cached.data.lines_data)
    ) {
      return cached.data;
    }
    throw e;
  }
}

function scheduleKindFromWorkday(isWorkday) {
  return isWorkday ? "weekday" : "weekend";
}

function getScheduleUrlsByKind(dayKind) {
  return dayKind === "weekend" ? SCHEDULE_WEEKEND_URLS : SCHEDULE_WEEKDAY_URLS;
}

function scheduleHalfMonthRawCacheKey() {
  return `${CACHE_KEY_PREFIX}:schedule:halfmonth_bundle`;
}

function scheduleHalfMonthIndexCacheKey() {
  return `${CACHE_KEY_PREFIX}:schedule_index:halfmonth_bundle`;
}

function isValidScheduleDayData(obj) {
  return !!(obj && typeof obj === "object" && !Array.isArray(obj));
}

function isValidScheduleRawBundle(bundle) {
  return !!(
    bundle &&
    typeof bundle === "object" &&
    isValidScheduleDayData(bundle.weekday) &&
    isValidScheduleDayData(bundle.weekend)
  );
}

function isValidCompactScheduleIndex(idx) {
  return !!(
    idx &&
    typeof idx === "object" &&
    Number(idx.version) === SCHEDULE_COMPACT_INDEX_VERSION &&
    Array.isArray(idx.line_dirs) &&
    Array.isArray(idx.terminals) &&
    Array.isArray(idx.tails) &&
    idx.stations &&
    typeof idx.stations === "object" &&
    !Array.isArray(idx.stations)
  );
}

function isValidCompactScheduleIndexBundle(bundle) {
  return !!(
    bundle &&
    typeof bundle === "object" &&
    isValidCompactScheduleIndex(bundle.weekday) &&
    isValidCompactScheduleIndex(bundle.weekend)
  );
}

function cleanupLegacyCachesOnce() {
  const mark = readJsonCache(LEGACY_CLEANUP_ONCE_KEY);
  if (mark && typeof mark === "object" && mark.done === true) return;
  try {
    // 旧版周缓存键与历史大包缓存键，改版后不再使用，清理可回收持久化空间。
    clearLargeTextCache(`${CACHE_KEY_PREFIX}:map:weekly`);
    clearLargeTextCache(`${CACHE_KEY_PREFIX}:schedule:weekly_bundle`);
    clearLargeTextCache(`${CACHE_KEY_PREFIX}:schedule:weekday:weekly`);
    clearLargeTextCache(`${CACHE_KEY_PREFIX}:schedule:weekend:weekly`);
    clearLargeTextCache(`${CACHE_KEY_PREFIX}:schedule_index:weekday:weekly`);
    clearLargeTextCache(`${CACHE_KEY_PREFIX}:schedule_index:weekend:weekly`);
  } catch (e) {
    // ignore
  }
  writeJsonCache(LEGACY_CLEANUP_ONCE_KEY, {
    done: true,
    at: new Date().toISOString()
  });
}

async function loadScheduleCompactIndexBundleWithHalfMonthCache(periodKey) {
  const rawKey = scheduleHalfMonthRawCacheKey();
  const idxKey = scheduleHalfMonthIndexCacheKey();

  const cachedRawWrap = readLargeJsonCache(rawKey);
  const cachedIdxWrap = readLargeJsonCache(idxKey);

  const cachedRawData = cachedRawWrap && typeof cachedRawWrap === "object" && isValidScheduleRawBundle(cachedRawWrap.data)
    ? cachedRawWrap.data
    : (isValidScheduleRawBundle(cachedRawWrap) ? cachedRawWrap : null);
  const cachedIdxData = cachedIdxWrap && typeof cachedIdxWrap === "object" && isValidCompactScheduleIndexBundle(cachedIdxWrap.data)
    ? cachedIdxWrap.data
    : (isValidCompactScheduleIndexBundle(cachedIdxWrap) ? cachedIdxWrap : null);

  if (cachedIdxData && cachedIdxWrap && cachedIdxWrap.period_key === periodKey) {
    return cachedIdxData;
  }

  try {
    // 半月首跑：不区分日期类型，同时拉取并存储 weekday + weekend。
    const [weekdayRemote, weekendRemote] = await Promise.all([
      fetchJsonWithFallback(getScheduleUrlsByKind("weekday")),
      fetchJsonWithFallback(getScheduleUrlsByKind("weekend"))
    ]);
    const rawBundle = { weekday: weekdayRemote, weekend: weekendRemote };
    const idxBundle = {
      weekday: buildCompactScheduleIndex(rawBundle.weekday),
      weekend: buildCompactScheduleIndex(rawBundle.weekend)
    };

    writeLargeJsonCache(rawKey, {
      period_key: periodKey,
      updated_at: new Date().toISOString(),
      data: rawBundle
    });
    writeLargeJsonCache(idxKey, {
      period_key: periodKey,
      updated_at: new Date().toISOString(),
      data: idxBundle
    });
    return idxBundle;
  } catch (e) {
    if (cachedIdxData) return cachedIdxData;
    if (cachedRawData) {
      return {
        weekday: buildCompactScheduleIndex(cachedRawData.weekday),
        weekend: buildCompactScheduleIndex(cachedRawData.weekend)
      };
    }
    throw e;
  }
}

async function isWorkdayByHolidayCN(nowDate) {
  const year = nowDate.getFullYear();
  let obj = null;
  try {
    const r = await loadHolidayYearData(year);
    obj = r && r.data ? r.data : null;
  } catch (e) {
    return { isWorkday: nowDate.getDay() >= 1 && nowDate.getDay() <= 5, source: "weekday_heuristic" };
  }
  const days = Array.isArray(obj && obj.days) ? obj.days : [];
  const today = ymd(nowDate);
  for (const r of days) {
    if (!r || typeof r !== "object") continue;
    if (r.date !== today) continue;
    if (r.isOffDay === true) {
      return { isWorkday: false, source: `holiday-cn:${r.name || "offday"}` };
    }
    if (r.isOffDay === false) {
      return { isWorkday: true, source: `holiday-cn:${r.name || "workday"}` };
    }
  }
  return { isWorkday: nowDate.getDay() >= 1 && nowDate.getDay() <= 5, source: "weekday_heuristic" };
}

function outOfChina(lat, lon) {
  return !(72.004 <= lon && lon <= 137.8347 && 0.8293 <= lat && lat <= 55.8271);
}

function gcjTransformLat(x, y) {
  let ret = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3;
  ret += ((20 * Math.sin(y * Math.PI) + 40 * Math.sin((y / 3) * Math.PI)) * 2) / 3;
  ret += ((160 * Math.sin((y / 12) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30)) * 2) / 3;
  return ret;
}

function gcjTransformLon(x, y) {
  let ret = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3;
  ret += ((20 * Math.sin(x * Math.PI) + 40 * Math.sin((x / 3) * Math.PI)) * 2) / 3;
  ret += ((150 * Math.sin((x / 12) * Math.PI) + 300 * Math.sin((x / 30) * Math.PI)) * 2) / 3;
  return ret;
}

function wgs84ToGcj02(lat, lon) {
  if (outOfChina(lat, lon)) return [lat, lon];
  const a = 6378245.0;
  const ee = 0.00669342162296594323;
  let dlat = gcjTransformLat(lon - 105, lat - 35);
  let dlon = gcjTransformLon(lon - 105, lat - 35);
  const radlat = (lat / 180) * Math.PI;
  let magic = Math.sin(radlat);
  magic = 1 - ee * magic * magic;
  const sqrtmagic = Math.sqrt(magic);
  dlat = (dlat * 180) / (((a * (1 - ee)) / (magic * sqrtmagic)) * Math.PI);
  dlon = (dlon * 180) / ((a / sqrtmagic) * Math.cos(radlat) * Math.PI);
  return [lat + dlat, lon + dlon];
}

function haversineM(lat1, lon1, lat2, lon2) {
  const r = 6371000.0;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestDistanceM(catalog, lat, lon) {
  let best = null;
  for (const st of catalog.stations) {
    const d = haversineM(lat, lon, st.lat, st.lon);
    if (best === null || d < best) best = d;
  }
  return best;
}

function autoAlignCoordForCatalog(catalog, lat, lon, preferGcj = true) {
  const rawBest = nearestDistanceM(catalog, lat, lon);
  if (rawBest == null) return { lat, lon, mode: "raw" };
  const [gLat, gLon] = wgs84ToGcj02(lat, lon);
  const gcjBest = nearestDistanceM(catalog, gLat, gLon);
  if (gcjBest == null) return { lat, lon, mode: "raw" };
  if (preferGcj && gcjBest <= rawBest + 50) {
    return { lat: gLat, lon: gLon, mode: "wgs84_to_gcj02" };
  }
  if (gcjBest + 120 < rawBest) {
    return { lat: gLat, lon: gLon, mode: "wgs84_to_gcj02" };
  }
  return { lat, lon, mode: "raw" };
}

function parseArgument(arg, trace) {
  const tr = Array.isArray(trace) ? trace : null;
  function add(msg) {
    if (tr) tr.push(String(msg));
  }
  function pv(v) {
    try {
      if (v == null) return "";
      if (typeof v === "object") return redactSensitiveText(JSON.stringify(v)).slice(0, 160);
      return redactSensitiveText(String(v)).replace(/\s+/g, " ").slice(0, 160);
    } catch (e) {
      return redactSensitiveText(String(v)).slice(0, 160);
    }
  }
  function fromObj(o) {
    if (!o || typeof o !== "object") return null;
    if (Array.isArray(o)) {
      add(`对象分支: array len=${o.length}, 预览=${pv(o)}`);
      if (o.length >= 2) {
        const lon = Number(o[0]);
        const lat = Number(o[1]);
        add(`对象分支(array): lon=${lon}, lat=${lat}`);
        if (Number.isFinite(lon) && Number.isFinite(lat)) return { lon, lat };
      }
      return null;
    }
    add(`对象分支: object keys=${Object.keys(o).slice(0, 10).join(",")}`);
    const lonKeys = ["lon", "lng", "longitude", "经度"];
    const latKeys = ["lat", "latitude", "纬度"];
    let lon = NaN;
    let lat = NaN;
    for (const k of lonKeys) {
      if (Object.prototype.hasOwnProperty.call(o, k)) {
        lon = Number(o[k]);
        break;
      }
    }
    for (const k of latKeys) {
      if (Object.prototype.hasOwnProperty.call(o, k)) {
        lat = Number(o[k]);
        break;
      }
    }
    add(`对象分支(object): lon=${lon}, lat=${lat}`);
    if (Number.isFinite(lon) && Number.isFinite(lat)) return { lon, lat };
    return null;
  }

  if (arg && typeof arg === "object") {
    add(`原始参数类型=object, 预览=${pv(arg)}`);
    const r = fromObj(arg);
    if (r) return r;
  }

  let s = String(arg == null ? "" : arg).trim();
  add(`原始参数字符串='${pv(s)}'`);
  if (!s) return null;

  // 兼容快捷指令里可能出现的全角符号与 URL 编码。
  s = s.replace(/，/g, ",").replace(/；/g, ";").replace(/＝/g, "=").replace(/＆/g, "&");
  if (s.includes("%")) {
    try {
      s = decodeURIComponent(s);
    } catch (e) {
      // ignore decode errors
    }
  }
  add(`归一化后='${pv(s)}'`);

  // 若是 JSON 字符串，优先按 JSON 解析 lon/lat。
  if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"))) {
    try {
      const j = JSON.parse(s);
      const r = fromObj(j);
      add(`JSON分支: parsed=${r ? "OK" : "FAIL"}`);
      if (r) return r;
    } catch (e) {
      add(`JSON分支: parse_fail=${e && e.message ? e.message : String(e)}`);
    }
  }

  // URL 且未包含 lon/lat 键，避免误把 URL 中数字（如端口）当经纬度。
  if (/^https?:\/\//i.test(s) && !/(?:^|[?&;,\s])(lon|lng|lat)\s*=/i.test(s)) {
    add("URL分支: 未发现 lon/lat 参数，直接失败");
    return null;
  }

  if (s.includes("=") && (s.includes("&") || s.includes("lat") || s.includes("lon"))) {
    const mLon = s.match(/(?:^|[?&;,\s])(?:lon|lng)\s*=\s*(-?\d+(?:\.\d+)?)/i);
    const mLat = s.match(/(?:^|[?&;,\s])lat\s*=\s*(-?\d+(?:\.\d+)?)/i);
    const lon = Number(mLon ? mLon[1] : NaN);
    const lat = Number(mLat ? mLat[1] : NaN);
    add(`键值分支: mLon=${mLon ? mLon[1] : "NA"}, mLat=${mLat ? mLat[1] : "NA"}, lon=${lon}, lat=${lat}`);
    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      return { lon, lat };
    }
  }

  const parts = s.split(/[\s,;|]+/).filter(Boolean);
  add(`分隔分支: parts_len=${parts.length}, p0=${pv(parts[0] || "")}, p1=${pv(parts[1] || "")}`);
  if (parts.length >= 2) {
    const lon = Number(parts[0]);
    const lat = Number(parts[1]);
    add(`分隔分支: lon=${lon}, lat=${lat}`);
    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      return { lon, lat };
    }
  }

  // 兜底：从混合文本中提取前两个浮点数作为 lon/lat。
  const nums = s.match(/[+-]?\d+(?:\.\d+)?(?:e[+-]?\d+)?/ig) || [];
  add(`数字提取分支: nums=${pv(nums.join(","))}`);
  if (nums.length >= 2) {
    const lon = Number(nums[0]);
    const lat = Number(nums[1]);
    add(`数字提取分支: lon=${lon}, lat=${lat}`);
    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      return { lon, lat };
    }
  }
  add("解析结果: FAIL");
  return null;
}

function pickInputArgument() {
  function envVal(k) {
    if (typeof $environment !== "undefined" && $environment && typeof $environment === "object") {
      return $environment[k];
    }
    return undefined;
  }

  if (typeof $argument !== "undefined" && $argument != null && String($argument).trim() !== "") {
    return $argument;
  }
  if (typeof $arguments !== "undefined" && $arguments != null) {
    if (Array.isArray($arguments)) {
      if ($arguments.length === 1) return $arguments[0];
      if ($arguments.length >= 2) return `${$arguments[0]},${$arguments[1]}`;
    }
    if (String($arguments).trim() !== "") return $arguments;
  }
  if (typeof $environment !== "undefined" && $environment && typeof $environment === "object") {
    if ($environment.params != null) {
      if (Array.isArray($environment.params)) {
        if ($environment.params.length === 1) return $environment.params[0];
        if ($environment.params.length >= 2) return `${$environment.params[0]},${$environment.params[1]}`;
      }
      if (typeof $environment.params === "object") return $environment.params;
      if (String($environment.params).trim() !== "") return $environment.params;
    }
  }
  const extraKeys = ["argument", "arguments", "arg", "args", "param", "query", "extra", "extraParams", "argv"];
  for (const k of extraKeys) {
    const v = envVal(k);
    if (v == null) continue;
    if (Array.isArray(v)) {
      if (v.length === 1 && String(v[0]).trim() !== "") return v[0];
      if (v.length >= 2) return `${v[0]},${v[1]}`;
      continue;
    }
    if (typeof v === "object") return v;
    if (String(v).trim() !== "") return v;
  }
  const sourcePath = envVal("sourcePath");
  if (sourcePath != null) {
    const sp = String(sourcePath);
    const idx = sp.indexOf("#");
    if (idx >= 0 && idx + 1 < sp.length) {
      const frag = sp.slice(idx + 1).trim();
      if (frag) return frag;
    }
  }
  if (typeof $request !== "undefined" && $request && typeof $request.url === "string" && $request.url.trim() !== "") {
    if ($request.body != null && String($request.body).trim() !== "") {
      return String($request.body);
    }
    const ctype = String(($request.headers && ($request.headers["Content-Type"] || $request.headers["content-type"])) || "");
    if (/application\/json/i.test(ctype) && $request.body != null && String($request.body).trim() !== "") {
      return String($request.body);
    }
    return $request.url;
  }

  // 兜底：扫描常见全局字段，兼容某些快捷指令动作不走 $argument/$environment 的情况。
  try {
    const g = typeof globalThis !== "undefined" ? globalThis : this;
    const topKeys = ["sourcePath", "scriptPath", "scriptURL", "scriptUrl", "path", "url", "param", "params", "argument", "arguments"];
    for (const k of topKeys) {
      if (!Object.prototype.hasOwnProperty.call(g, k)) continue;
      const v = g[k];
      if (v == null) continue;
      if (typeof v === "string" && v.trim() !== "") return v;
      if (Array.isArray(v) && v.length) return v.join(",");
      if (typeof v === "object") {
        const kk = ["sourcePath", "path", "url", "param", "params", "argument", "arguments"];
        for (const x of kk) {
          if (v[x] == null) continue;
          if (typeof v[x] === "string" && String(v[x]).trim() !== "") return v[x];
          if (Array.isArray(v[x]) && v[x].length) return v[x].join(",");
        }
      }
    }
    const objKeys = ["$script", "$resource", "$context", "$input", "$options"];
    for (const ok of objKeys) {
      const o = g[ok];
      if (!o || typeof o !== "object") continue;
      const kk = ["sourcePath", "path", "url", "param", "params", "argument", "arguments"];
      for (const x of kk) {
        if (o[x] == null) continue;
        if (typeof o[x] === "string" && String(o[x]).trim() !== "") return o[x];
        if (Array.isArray(o[x]) && o[x].length) return o[x].join(",");
      }
    }
  } catch (e) {
    // ignore
  }
  return "";
}

function argumentChannelDebug(rawArg) {
  function pv(v) {
    try {
      if (v == null) return "";
      if (typeof v === "object") return redactSensitiveText(JSON.stringify(v)).slice(0, 120);
      return redactSensitiveText(String(v)).replace(/\s+/g, " ").slice(0, 120);
    } catch (e) {
      return redactSensitiveText(String(v)).slice(0, 120);
    }
  }
  const out = [];
  out.push(`arg=${typeof $argument !== "undefined" ? typeof $argument : "undef"}:${pv(typeof $argument !== "undefined" ? $argument : "")}`);
  out.push(`args=${typeof $arguments !== "undefined" ? typeof $arguments : "undef"}:${pv(typeof $arguments !== "undefined" ? $arguments : "")}`);
  if (typeof $environment !== "undefined" && $environment && typeof $environment === "object") {
    const keys = Object.keys($environment).slice(0, 20);
    out.push(`env_keys=${keys.join(",")}`);
    if (Object.prototype.hasOwnProperty.call($environment, "params")) out.push(`env.params=${pv($environment.params)}`);
    if (Object.prototype.hasOwnProperty.call($environment, "sourcePath")) out.push(`env.sourcePath=${pv($environment.sourcePath)}`);
  } else {
    out.push("env=undef");
  }
  out.push(`picked=${typeof rawArg}:${pv(rawArg)}`);
  return out.join(" | ");
}

function discoverGlobalArgCandidates() {
  function pv(v) {
    try {
      if (v == null) return "";
      if (typeof v === "object") return redactSensitiveText(JSON.stringify(v)).slice(0, 100);
      return redactSensitiveText(String(v)).replace(/\s+/g, " ").slice(0, 100);
    } catch (e) {
      return redactSensitiveText(String(v)).slice(0, 100);
    }
  }
  try {
    const g = typeof globalThis !== "undefined" ? globalThis : this;
    const names = Object.getOwnPropertyNames(g || {});
    const picked = [];
    const re = /(arg|param|path|url|input|shortcut|script|source|env)/i;
    for (const k of names) {
      if (!re.test(k)) continue;
      let v = null;
      try {
        v = g[k];
      } catch (e) {
        v = "<unreadable>";
      }
      picked.push(`${k}:${typeof v}:${pv(v)}`);
      if (picked.length >= 20) break;
    }
    return picked.join(" || ");
  } catch (e) {
    return "scan_failed";
  }
}

function wantVerboseLog(arg) {
  try {
    if (arg && typeof arg === "object" && !Array.isArray(arg)) {
      const v = arg.debug;
      if (v === true || String(v).toLowerCase() === "true" || String(v) === "1") return true;
    }
  } catch (e) {
    // ignore
  }
  const s = String(arg == null ? "" : arg);
  return /(?:^|[?&;,\s])debug\s*=\s*(?:1|true|yes)(?:$|[?&;,\s])/i.test(s);
}

function buildCatalog(mapObj) {
  if (!mapObj || !Array.isArray(mapObj.stations_data) || !Array.isArray(mapObj.lines_data)) {
    throw new Error("map-app.json format unexpected");
  }

  const lineName = {};
  for (const ln of mapObj.lines_data) {
    if (!ln || typeof ln !== "object") continue;
    const id = Number(ln.id);
    if (!Number.isFinite(id)) continue;
    lineName[id] = String(ln.cn_name || id);
  }

  const merged = new Map();
  for (const st of mapObj.stations_data) {
    if (!st || typeof st !== "object") continue;
    const sid = Number(st.id);
    const name = String(st.cn_name || "").trim();
    const lat = Number(st.latitude);
    const lon = Number(st.longitude);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const lids = new Set();
    if (Array.isArray(st.lines)) {
      for (const x of st.lines) {
        if (!x) continue;
        const id = typeof x === "object" ? Number(x.id) : Number(x);
        if (Number.isFinite(id)) lids.add(id);
      }
    }

    const lines = [...lids].map((id) => lineName[id] || String(id)).sort();
    const key = normName(name);
    if (!merged.has(key)) {
      merged.set(key, {
        name,
        norm: key,
        lat,
        lon,
        station_ids: new Set([sid]),
        line_names: new Set(lines),
        aliases: new Set([name])
      });
    } else {
      const m = merged.get(key);
      m.station_ids.add(sid);
      lines.forEach((x) => m.line_names.add(x));
      m.aliases.add(name);
    }
  }

  const stations = [];
  const nameIndex = {};
  for (const m of merged.values()) {
    const o = {
      name: m.name,
      norm: m.norm,
      lat: m.lat,
      lon: m.lon,
      station_ids: [...m.station_ids].sort((a, b) => a - b),
      line_names: [...m.line_names].sort(),
      aliases: [...m.aliases].sort()
    };
    stations.push(o);
    if (!nameIndex[o.norm]) nameIndex[o.norm] = [];
    nameIndex[o.norm].push(o);
    for (const a of o.aliases) {
      const na = normName(a);
      if (!nameIndex[na]) nameIndex[na] = [];
      nameIndex[na].push(o);
    }
  }

  return { stations, nameIndex };
}

function buildStationLineIndex(catalog) {
  const idx = {};
  for (const st of catalog.stations) {
    const n = normName(st.name);
    if (!n) continue;
    if (!idx[n]) idx[n] = new Set();
    for (const ln of st.line_names || []) idx[n].add(String(ln));
  }
  return idx;
}

function buildStationCoordIndex(catalog) {
  const idx = {};
  for (const st of catalog.stations) {
    const names = [];
    const n = normName(st.name);
    if (n) names.push(n);
    for (const a of st.aliases || []) {
      const x = normName(a);
      if (x) names.push(x);
    }
    for (const x of names) {
      if (!idx[x]) idx[x] = [st.lat, st.lon];
    }
  }
  return idx;
}

function nearestStations(catalog, lat, lon, threshold = 300, maxN = 8) {
  const ranked = catalog.stations.map((st) => {
    const d = haversineM(lat, lon, st.lat, st.lon);
    const br = bearingDeg(lat, lon, st.lat, st.lon);
    return { d, br, st };
  });
  ranked.sort((a, b) => {
    const dd = a.d - b.d;
    if (Math.abs(dd) > 1e-6) return dd;
    return a.br - b.br;
  });
  if (!ranked.length) return [];
  const minD = ranked[0].d;
  const out = [];
  for (const it of ranked) {
    if (it.d <= minD + threshold || out.length === 0) {
      out.push(Object.assign({}, it.st, {
        distance_m: Math.round(it.d * 10) / 10,
        relative_bearing_deg: Math.round(it.br * 10) / 10
      }));
      if (out.length >= maxN) break;
    } else {
      break;
    }
  }
  return out;
}

function internCompactId(dict, list, val) {
  const key = String(val == null ? "" : val);
  if (Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
  const id = list.length;
  list.push(key);
  dict[key] = id;
  return id;
}

function buildCompactScheduleIndex(schedule) {
  const lineDirIds = {};
  const lineDirs = [];
  const terminalIds = {};
  const terminals = [];
  const tailIds = {};
  const tails = [];
  const stations = {};
  const normMemo = {};

  if (!schedule || typeof schedule !== "object") {
    return {
      version: SCHEDULE_COMPACT_INDEX_VERSION,
      line_dirs: [],
      terminals: [],
      tails: [],
      stations: {}
    };
  }

  for (const [lineName, dirs] of Object.entries(schedule)) {
    if (!dirs || typeof dirs !== "object") continue;
    for (const [direction, trains] of Object.entries(dirs)) {
      if (!trains || typeof trains !== "object") continue;
      const lineDirKey = `${lineName}|||${direction}`;
      const lineDirId = internCompactId(lineDirIds, lineDirs, lineDirKey);

      for (const stops of Object.values(trains)) {
        if (!Array.isArray(stops)) continue;
        const parsed = [];
        let prevMin = null;
        let dayOff = 0;

        for (const stop of stops) {
          if (!Array.isArray(stop) || stop.length < 2) continue;
          const stName = String(stop[0] || "").trim();
          const t = parseHHMMLoose(stop[1]);
          if (!t) continue;
          const cur = t[0] * 60 + t[1];
          if (prevMin != null && cur < prevMin) dayOff += 1440;
          prevMin = cur;
          parsed.push([stName, cur + dayOff]);
        }
        if (!parsed.length) continue;

        const terminal = String(parsed[parsed.length - 1][0] || "").trim();
        const terminalMin = Number(parsed[parsed.length - 1][1]);
        const terminalId = terminal ? internCompactId(terminalIds, terminals, terminal) : -1;
        const tailNames = parsed.slice().reverse().slice(0, CROSSLINE_LOOKBACK).map((x) => String(x[0] || ""));
        const tailSig = tailNames.join("|");
        const tailId = tailSig ? internCompactId(tailIds, tails, tailSig) : -1;

        for (const [stName, curMin] of parsed) {
          const rawName = String(stName || "");
          let stNorm = normMemo[rawName];
          if (stNorm == null) {
            stNorm = normName(rawName);
            normMemo[rawName] = stNorm;
          }
          if (!stNorm) continue;

          if (!Object.prototype.hasOwnProperty.call(stations, stNorm)) {
            stations[stNorm] = {};
          }
          if (!Object.prototype.hasOwnProperty.call(stations[stNorm], lineDirId)) {
            stations[stNorm][lineDirId] = { m: [], t: [], r: [], z: [] };
          }
          const cell = stations[stNorm][lineDirId];
          cell.m.push(curMin);
          cell.t.push(terminalId);
          const remain = terminalMin - curMin;
          cell.r.push(Number.isFinite(remain) ? remain : -1);
          cell.z.push(tailId);
        }
      }
    }
  }

  for (const stCells of Object.values(stations)) {
    for (const cell of Object.values(stCells)) {
      const size = Array.isArray(cell.m) ? cell.m.length : 0;
      if (size <= 1) continue;
      const order = [];
      for (let i = 0; i < size; i++) order.push(i);
      order.sort((a, b) => Number(cell.m[a]) - Number(cell.m[b]));
      cell.m = order.map((i) => Number(cell.m[i]));
      cell.t = order.map((i) => Number(cell.t[i]));
      cell.r = order.map((i) => Number(cell.r[i]));
      cell.z = order.map((i) => Number(cell.z[i]));
    }
  }

  const tailArray = tails.map((x) => String(x || "").split("|").filter(Boolean));
  return {
    version: SCHEDULE_COMPACT_INDEX_VERSION,
    line_dirs: lineDirs,
    terminals,
    tails: tailArray,
    stations
  };
}

function collectScheduleForStationsFromCompactIndex(indexObj, stationNorms) {
  const out = {};
  for (const n of stationNorms) out[n] = {};
  if (!isValidCompactScheduleIndex(indexObj)) return out;

  const lineDirs = indexObj.line_dirs || [];
  const terminals = indexObj.terminals || [];
  const tails = indexObj.tails || [];
  const stations = indexObj.stations || {};

  for (const n of stationNorms) {
    const row = stations[n];
    if (!row || typeof row !== "object") continue;
    for (const [lineDirIdRaw, cell] of Object.entries(row)) {
      const lineDirId = Number(lineDirIdRaw);
      const lineDirKey = lineDirs[lineDirId];
      if (!lineDirKey) continue;

      const mins = Array.isArray(cell && cell.m) ? cell.m : [];
      const tIds = Array.isArray(cell && cell.t) ? cell.t : [];
      const remains = Array.isArray(cell && cell.r) ? cell.r : [];
      const zIds = Array.isArray(cell && cell.z) ? cell.z : [];

      const restored = { minutes: [], terminals: {}, trips: [] };
      for (let i = 0; i < mins.length; i++) {
        const minute = Number(mins[i]);
        if (!Number.isFinite(minute)) continue;
        const tId = Number(tIds[i]);
        const terminal = Number.isFinite(tId) && tId >= 0 ? String(terminals[tId] || "") : "";
        const rv = Number(remains[i]);
        const remainMin = Number.isFinite(rv) && rv >= 0 ? rv : null;
        const tailId = Number(zIds[i]);
        const tail = Number.isFinite(tailId) && tailId >= 0 && Array.isArray(tails[tailId]) ? tails[tailId] : [];

        restored.minutes.push(minute);
        if (terminal) restored.terminals[terminal] = (restored.terminals[terminal] || 0) + 1;
        restored.trips.push({
          minute,
          terminal,
          tail,
          remain_min: remainMin
        });
      }
      out[n][lineDirKey] = restored;
    }
  }
  return out;
}

function textToArrow8(s) {
  const t = String(s || "");
  const pairs = [
    ["东北", "↗"], ["东南", "↘"], ["西南", "↙"], ["西北", "↖"],
    ["正东", "→"], ["正西", "←"], ["正南", "↓"], ["正北", "↑"],
    ["东", "→"], ["西", "←"], ["南", "↓"], ["北", "↑"]
  ];
  for (const [k, a] of pairs) {
    if (t.includes(k)) return a;
  }
  return "";
}

function arrow8ToBearing(arrow) {
  const s = String(arrow || "").replace(/\uFE0F/g, "").trim();
  const map = { "⬆": 0, "↗": 45, "➡": 90, "↘": 135, "⬇": 180, "↙": 225, "⬅": 270, "↖": 315, "↑": 0, "→": 90, "↓": 180, "←": 270 };
  if (map[s] != null) return map[s];
  if (s && map[s[0]] != null) return map[s[0]];
  return null;
}

function bearingDeg(lat1, lon1, lat2, lon2) {
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  const br = (Math.atan2(y, x) * 180) / Math.PI;
  return (br + 360) % 360;
}

function bearingToArrow8(bearing) {
  const idx = bearingToDirectionIndex8(bearing);
  const arrows = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];
  return arrows[idx];
}

function bearingToArrow8Emoji(bearing) {
  const idx = bearingToDirectionIndex8(bearing);
  const arrows = ["⬆️", "↗️", "➡️", "↘️", "⬇️", "↙️", "⬅️", "↖️"];
  return arrows[idx];
}

function bearingToDirectionIndex8(bearing) {
  const b = ((Number(bearing) % 360) + 360) % 360;
  const scaled = (b + 22.5) / 45;
  const nearestInt = Math.round(scaled);
  const EPS = 1e-10;

  // 恰好落在角平分线(22.5/67.5/...)时，优先取更“正”的方向(N/E/S/W)
  if (Math.abs(scaled - nearestInt) <= EPS) {
    const upper = ((nearestInt % 8) + 8) % 8;
    const lower = ((nearestInt - 1) % 8 + 8) % 8;
    if (upper % 2 === 0) return upper;
    return lower;
  }

  return ((Math.floor(scaled) % 8) + 8) % 8;
}

function pickDirectionArrow8(directionText, toText, fromLat, fromLon, terminalNames, stationCoordIndex) {
  const a1 = textToArrow8(directionText);
  if (a1) return a1;
  const a2 = textToArrow8(toText);
  if (a2) return a2;
  if (!Number.isFinite(fromLat) || !Number.isFinite(fromLon) || !Array.isArray(terminalNames) || !terminalNames.length) return "";

  let vecX = 0;
  let vecY = 0;
  for (const name of terminalNames) {
    const key = normName(name);
    const tgt = stationCoordIndex[key];
    if (!tgt) continue;
    const br = bearingDeg(fromLat, fromLon, tgt[0], tgt[1]);
    const rad = (br * Math.PI) / 180;
    vecX += Math.sin(rad);
    vecY += Math.cos(rad);
  }
  if (Math.abs(vecX) < 1e-9 && Math.abs(vecY) < 1e-9) return "";
  const br = ((Math.atan2(vecX, vecY) * 180) / Math.PI + 360) % 360;
  return bearingToArrow8(br);
}

function detectCrosslineDisplay(curLine, tailStops, stationLinesIndex) {
  if (!curLine || !Array.isArray(tailStops) || !tailStops.length) return null;
  const counts = {};
  for (const s of tailStops) {
    const ls = stationLinesIndex[normName(s)] || new Set();
    for (const ln of ls) {
      counts[ln] = (counts[ln] || 0) + 1;
    }
  }
  const curCnt = counts[curLine] || 0;
  let bestLine = null;
  let bestCnt = 0;
  for (const [ln, cnt] of Object.entries(counts)) {
    if (ln === curLine) continue;
    if (cnt > bestCnt || (cnt === bestCnt && bestLine && ln < bestLine)) {
      bestLine = ln;
      bestCnt = cnt;
    }
  }
  if (bestLine && bestCnt >= CROSSLINE_MIN_OTHER && bestCnt > curCnt) {
    if (String(curLine).includes(bestLine)) return String(curLine);
    return `${curLine}-${bestLine}`;
  }
  return null;
}

function boundaryStatus(now, firstHHMM, lastHHMM, cutoffHour = 4) {
  const t1 = parseHHMM(firstHHMM);
  const t2 = parseHHMM(lastHHMM);
  if (!t1 || !t2) return "unknown";
  const sd = serviceDayFor(now, cutoffHour).date;
  const f = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate(), t1[0] % 24, t1[1], 0, 0);
  const l = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate(), t2[0] % 24, t2[1], 0, 0);
  if (l < f) l.setDate(l.getDate() + 1);
  if (now < f) return "not_started";
  if (now > l) return "ended";
  return "running";
}

function terminalOrderByRemain(trips, terminalNames) {
  const uniq = [];
  const seen = new Set();
  for (const x of terminalNames) {
    const n = String(x || "").trim();
    if (!n || seen.has(n)) continue;
    seen.add(n);
    uniq.push(n);
  }
  const dist = {};
  for (const t of trips || []) {
    if (!t || typeof t !== "object") continue;
    const term = String(t.terminal || "").trim();
    if (!seen.has(term)) continue;
    const rv = Number(t.remain_min);
    if (!Number.isFinite(rv)) continue;
    if (dist[term] == null || rv < dist[term]) dist[term] = rv;
  }
  const pos = {};
  uniq.forEach((x, i) => (pos[x] = i));
  return uniq.sort((a, b) => {
    const da = dist[a] == null ? Number.POSITIVE_INFINITY : dist[a];
    const db = dist[b] == null ? Number.POSITIVE_INFINITY : dist[b];
    if (da !== db) return da - db;
    if (pos[a] !== pos[b]) return pos[a] - pos[b];
    return a.localeCompare(b, "zh-Hans-CN");
  });
}

function buildTerminalsForNext(nextTrips, tripsAll) {
  const nextTerms = [];
  for (const t of nextTrips || []) {
    const nm = String((t && t.terminal) || "").trim();
    if (nm && !nextTerms.includes(nm)) nextTerms.push(nm);
  }
  if (nextTerms.length <= 1) return { terms: [], enableMedals: false };
  const ordered = terminalOrderByRemain(tripsAll || [], nextTerms);
  const medals = ["🥇", "🥈", "🥉"];
  const out = ordered.map((name, i) => ({ name, medal: medals[i] || "🏅", count: 0 }));
  return { terms: out, enableMedals: true };
}

function applyMedalsToTimes(trips, medals, enable, otherMedal = "") {
  if (!enable || !Array.isArray(medals) || !medals.length) {
    for (const t of trips) t.medal = "";
    return;
  }
  const mm = {};
  for (const m of medals) {
    if (m && m.name) mm[String(m.name)] = String(m.medal || "");
  }
  for (const t of trips) {
    const term = String(t.terminal || "");
    t.medal = mm[term] || (otherMedal && term ? otherMedal : "");
  }
}

function terminalLabel(terminals) {
  if (!Array.isArray(terminals) || !terminals.length) return "";
  if (terminals.length === 1) {
    const n = terminals[0].name || "";
    return n ? `${n}方向` : "";
  }
  const parts = terminals.map((t) => `${t.medal || ""}${t.name || ""}`.trim()).filter(Boolean);
  return `${parts.join(" ")} 方向`;
}

function toSuperscriptNumber(v) {
  const map = {
    "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
    "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
    "-": "⁻"
  };
  const s = String(Math.trunc(Number(v)));
  let out = "";
  for (const ch of s) out += map[ch] || ch;
  return out;
}

function formatTimeTokens(trips) {
  const out = [];
  for (const t of trips || []) {
    const medal = String(t.medal || "");
    const timeS = String(t.time || "");
    const inMin = Number(t.in_min);
    if (!Number.isFinite(inMin) || !timeS) continue;
    let showTime = timeS;
    const m = timeS.match(/^(\d{1,2}):(\d{2})$/);
    if (m) {
      const h = Number(m[1]);
      const mm = m[2];
      showTime = `${pad2(h)}:${mm}`;
    }
    out.push(`${medal}${showTime}${toSuperscriptNumber(inMin)}`);
  }
  return out.join("  ");
}

function hhmmToServiceMin(hhmm, cutoff = 4) {
  const t = parseHHMM(hhmm);
  if (!t) return null;
  let v = t[0] * 60 + t[1];
  if (t[0] < cutoff) v += 1440;
  return v;
}

function serviceMinToHHMM(v) {
  if (!Number.isFinite(v)) return null;
  const x = ((Math.trunc(v) % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(x / 60))}:${pad2(x % 60)}`;
}

function summarizeStationFirstLast(dirs, cutoff = 4) {
  const firsts = [];
  const lasts = [];
  for (const d of dirs || []) {
    const f = hhmmToServiceMin(d.first, cutoff);
    const l = hhmmToServiceMin(d.last, cutoff);
    if (f != null) firsts.push(f);
    if (l != null) lasts.push(l);
  }
  return {
    first: firsts.length ? serviceMinToHHMM(Math.min(...firsts)) : null,
    last: lasts.length ? serviceMinToHHMM(Math.max(...lasts)) : null
  };
}

function directionBearingDeg(d) {
  let b = arrow8ToBearing(d.arrow);
  if (b == null) {
    const a = textToArrow8(d.direction) || textToArrow8(d.to) || textToArrow8(d.key);
    b = arrow8ToBearing(a);
  }
  return b == null ? 9999 : b;
}

function sortRuntimeDirectionsClockwise(directions) {
  const dirs = (directions || []).filter((x) => x && typeof x === "object");
  const lineOrder = {};
  for (const d of dirs) {
    const ln = String(d.line_name_display || d.line_name || "");
    if (!(ln in lineOrder)) lineOrder[ln] = Object.keys(lineOrder).length;
  }
  dirs.sort((a, b) => {
    const la = String(a.line_name_display || a.line_name || "");
    const lb = String(b.line_name_display || b.line_name || "");
    const oa = Object.prototype.hasOwnProperty.call(lineOrder, la) ? lineOrder[la] : 9999;
    const ob = Object.prototype.hasOwnProperty.call(lineOrder, lb) ? lineOrder[lb] : 9999;
    const ka = [oa, directionBearingDeg(a), String(a.to || ""), String(a.key || "")];
    const kb = [ob, directionBearingDeg(b), String(b.to || ""), String(b.key || "")];
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] < kb[i]) return -1;
      if (ka[i] > kb[i]) return 1;
    }
    return 0;
  });
  return dirs;
}

function groupDirectionsByLine(directions) {
  const out = [];
  const idx = {};
  for (const d of directions || []) {
    const line = String(d.line_name_display || d.line_name || "").trim() || "未知线路";
    if (!Object.prototype.hasOwnProperty.call(idx, line)) {
      idx[line] = out.length;
      out.push({ line, directions: [] });
    }
    out[idx[line]].directions.push(d);
  }
  return out;
}

function cleanLineText(s) {
  const raw = String(s == null ? "" : s).trim();
  // 时间行允许更宽的间隔，提升可读性。
  const supers = "⁰¹²³⁴⁵⁶⁷⁸⁹⁻";
  const token = `[🥇🥈🥉🏅]?\\d{2}:\\d{2}[${supers}]*`;
  const timeLineRe = new RegExp(`^(?:${token})(?:\\s{2,}${token})+$`);
  if (timeLineRe.test(raw)) {
    return raw.replace(/\t+/g, " ");
  }
  return raw.replace(/[ \t]{2,}/g, " ");
}

function formatStationText(st) {
  const dirs = (st.runtime && st.runtime.directions) || [];
  const stationArrow = String(bearingToArrow8Emoji(st.relative_bearing_deg) || "↗️");
  const access = st && st.access && typeof st.access === "object" ? st.access : null;
  const hasAccessDistance = !!(access && Number.isFinite(Number(access.distance_m)));
  const hasAccessEta = !!(
    access &&
    (Number.isFinite(Number(access.walk_min)) || Number.isFinite(Number(access.ride_min)))
  );
  const useApiStyle = !!(access && (hasAccessDistance || hasAccessEta || String(access.exit_label || "").trim() !== ""));

  let head = `${stationArrow}${st.name}`;
  if (useApiStyle) {
    if (access && access.exit_label) head += `${String(access.exit_label)}`;
    if (hasAccessDistance) head += ` ${Math.round(Number(access.distance_m))}米`;
    else if (Number.isFinite(st.distance_m)) head += ` ${Math.round(st.distance_m)}米`;
  } else {
    if (Number.isFinite(st.distance_m)) head += ` 📏${Math.round(st.distance_m)}米`;
  }
  if (access && Number.isFinite(Number(access.walk_min))) head += ` 🚶‍♀️${Math.round(Number(access.walk_min))}`;
  if (access && Number.isFinite(Number(access.ride_min))) head += ` 🚴‍♀️${Math.round(Number(access.ride_min))}`;

  const lines = [head];
  const grouped = groupDirectionsByLine(dirs);
  for (let gi = 0; gi < grouped.length; gi++) {
    const g = grouped[gi];
    lines.push(`🚇${g.line}`);
    for (const d of g.directions) {
      const status = String(d.status || "");
      let toTag = "";
      if (status === "ended") toTag = String(d.last_terminal || d.to || d.key || "").trim();
      else toTag = String(d.to || d.key || "").trim();
      if (toTag.endsWith("方向")) toTag = toTag.slice(0, -2).trim();

      let row = `${d.arrow || "↘"} ${toTag || "未知方向"}`;
      if (d.first) row += ` 🌅${d.first}`;
      if (d.last) row += ` 🌃${d.last}`;
      lines.push(row);

      if (status === "ended" && d.last) {
        lines.push(`错过末班: ${d.last}`);
        continue;
      }
      if (Array.isArray(d.next) && d.next.length) {
        const tokenLine = formatTimeTokens(d.next);
        if (tokenLine) lines.push(tokenLine);
      } else {
        if (status === "not_started") lines.push("未到首班");
        else if (status !== "ended") lines.push("无可用班次");
      }
    }
    if (gi < grouped.length - 1) lines.push("");
  }
  return lines.map(cleanLineText).join("\n");
}

function buildStationTwoParts(stations) {
  return stations.map((st) => {
    const full = formatStationText(st);
    const parts = full.split(/\n/);
    return {
      station: st.name,
      head: parts[0] || "",
      body: parts.slice(1).join("\n"),
      text: full
    };
  });
}

function logStationParts(parts, emitConsole = true) {
  const outLines = [];
  outLines.push("===QX_SUBWAY_RESULT_BEGIN===");
  if (emitConsole) console.log("===QX_SUBWAY_RESULT_BEGIN===");
  parts.forEach((p, i) => {
    const n = i + 1;
    outLines.push(`---STATION#${n}---PART1---`);
    outLines.push(p.head || "");
    outLines.push(`---STATION#${n}---PART2---`);
    outLines.push(p.body || "");
    outLines.push(`---STATION#${n}---END---`);

    if (emitConsole) {
      console.log(`---STATION#${n}---PART1---`);
      console.log(p.head || "");
      console.log(`---STATION#${n}---PART2---`);
      console.log(p.body || "");
      console.log(`---STATION#${n}---END---`);
    }
  });
  if (emitConsole) console.log("===QX_SUBWAY_RESULT_END===");
  outLines.push("===QX_SUBWAY_RESULT_END===");
  return outLines.join("\n");
}

async function main() {
  if (typeof $task === "undefined") {
    throw new Error("This script must run in Quantumult X.");
  }

  const backend = isBackendContext();
  const rawArg = pickInputArgument();
  const verboseActiveLog = !backend && wantVerboseLog(rawArg);
  const parseTrace = [];
  const parsed = parseArgument(rawArg, parseTrace);
  const amapKey = extractAmapKeyOverride(rawArg) || AMAP_WEB_KEY;
  if (!backend) {
    if (verboseActiveLog) {
      console.log(
        `[ARG_TRACE][v${SCRIPT_VERSION}] picked_type=${rawArg == null ? "null" : typeof rawArg}, picked='${redactSensitiveText(String(rawArg == null ? "" : rawArg)).replace(/\s+/g, " ").slice(0, 200)}'`
      );
      for (const t of parseTrace) {
        console.log(`[ARG_TRACE][v${SCRIPT_VERSION}] ${t}`);
      }
    } else {
      console.log(`[INFO][v${SCRIPT_VERSION}] 主动模式启动`);
    }
  }
  let resolvedCoord = parsed;
  if (!resolvedCoord) {
    if (!backend) {
      const ipLoc = await resolveLonLatByIp(amapKey);
      if (ipLoc && isValidLonLat(ipLoc.lon, ipLoc.lat)) {
        resolvedCoord = { lon: Number(ipLoc.lon), lat: Number(ipLoc.lat) };
        if (!backend) {
          console.log(
            `[INFO][v${SCRIPT_VERSION}] 无入参，IP定位成功 source=${ipLoc.source}${ipLoc.from_cache ? ":cache" : ""}`
          );
        }
      }
    }
  }
  if (!resolvedCoord) {
    const rawType = rawArg == null ? "null" : typeof rawArg;
    let preview = "";
    try {
      preview = rawType === "object" ? JSON.stringify(rawArg) : String(rawArg);
    } catch (e) {
      preview = String(rawArg);
    }
    preview = redactSensitiveText(preview).replace(/\s+/g, " ").slice(0, 200);
    const dbg = argumentChannelDebug(rawArg);
    const glb = discoverGlobalArgCandidates();
    const traceLine = parseTrace.join(" -> ").slice(0, 1200);
    if (backend) {
      throw new Error(`参数错误：请传 2 个参数（lon,lat），例如 lon,lat 或 lon=<value>&lat=<value> | 收到类型=${rawType} | 收到内容=${preview} | 通道=${dbg} | 全局候选=${glb} | 解析轨迹=${traceLine}`);
    }
    throw new Error(`参数错误且IP反查失败：请传 lon,lat 或配置可用 IP 定位网络 | 收到类型=${rawType} | 收到内容=${preview} | 通道=${dbg} | 全局候选=${glb} | 解析轨迹=${traceLine}`);
  }
  const inputLon = Number(resolvedCoord.lon);
  const inputLat = Number(resolvedCoord.lat);
  cleanupLegacyCachesOnce();
  if (!backend) {
    console.log(`[INFO][v${SCRIPT_VERSION}] 坐标已就绪 lon=${inputLon.toFixed(6)} lat=${inputLat.toFixed(6)}`);
  }

  if (!isInServiceRegionBJHebei(inputLon, inputLat)) {
    const msg = "📍所在区域超出北京地铁服务范围";
    if (backend) {
      doneBackendJson([msg], 200);
    } else {
      notifyByBackendFlatList([msg], "北京地铁出发时刻测算");
      doneOk(msg);
    }
    return;
  }

  const now = new Date();
  const serviceDayCtx = serviceDayFor(now, SERVICE_DAY_CUTOFF_HOUR);
  const serviceDay = serviceDayCtx.date;
  const dayType = await isWorkdayByHolidayCN(serviceDay);
  const isWorkday = !!dayType.isWorkday;
  const dayKind = scheduleKindFromWorkday(isWorkday);
  const mapPeriodKey = monthKey(serviceDay);
  const schedulePeriodKey = halfMonthKey(serviceDay);

  let mapObj = null;
  let scheduleIndexBundle = null;
  let scheduleIndex = null;
  [mapObj, scheduleIndexBundle] = await Promise.all([
    loadMapWithMonthlyCache(mapPeriodKey),
    loadScheduleCompactIndexBundleWithHalfMonthCache(schedulePeriodKey)
  ]);
  scheduleIndex = scheduleIndexBundle && typeof scheduleIndexBundle === "object"
    ? scheduleIndexBundle[dayKind]
    : null;
  scheduleIndexBundle = null;

  let catalog = buildCatalog(mapObj);
  mapObj = null;
  const stationLinesIndex = buildStationLineIndex(catalog);
  const stationCoordIndex = buildStationCoordIndex(catalog);

  const aligned = autoAlignCoordForCatalog(catalog, inputLat, inputLon, true);
  const nearStations = nearestStations(catalog, aligned.lat, aligned.lon, STATION_THRESHOLD_M, MAX_STATIONS);
  catalog = null;
  if (!nearStations.length) {
    if (backend) {
      doneBackendJson(["未找到附近站点", ""], 200);
    } else {
      console.log("===QX_SUBWAY_RESULT_BEGIN===");
      console.log("---STATION#1---PART1---");
      console.log("未找到附近站点");
      console.log("---STATION#1---PART2---");
      console.log("");
      console.log("---STATION#1---END---");
      console.log("===QX_SUBWAY_RESULT_END===");
      doneOk("");
    }
    return;
  }

  const stationNorms = nearStations.map((s) => s.norm);
  const schByStation = collectScheduleForStationsFromCompactIndex(scheduleIndex, stationNorms);
  scheduleIndex = null;
  const accessByNorm = {};
  const amapUsable = AMAP_ENABLE_EXIT_ETA && !!amapKey && await ensureAmapWebKeyUsable(amapKey);
  const exitCacheCtx = amapUsable ? { data: loadAmapExitCache(), dirty: false } : null;
  if (amapUsable) {
    const tasks = nearStations.map(async (st) => {
      try {
        const access = await fetchStationExitEta(st, aligned.lon, aligned.lat, amapKey, exitCacheCtx);
        return [st.norm, access];
      } catch (e) {
        return [st.norm, null];
      }
    });
    const pairs = await Promise.all(tasks);
    for (const [n, access] of pairs) {
      if (!access || typeof access !== "object") continue;
      accessByNorm[n] = access;
    }
    if (exitCacheCtx && exitCacheCtx.dirty) {
      saveAmapExitCache(exitCacheCtx.data);
    }
  }

  const stationsOut = [];
  for (const st of nearStations) {
    const item = {
      name: st.name,
      norm: st.norm,
      lat: st.lat,
      lon: st.lon,
      distance_m: st.distance_m,
      line_names: st.line_names,
      station_ids: st.station_ids,
      access: accessByNorm[st.norm] || null,
      runtime: { directions: [] }
    };

    const rows = schByStation[st.norm] || {};
    for (const [key, cell] of Object.entries(rows)) {
      const [lineName, direction] = key.split("|||");
      const minutes = (cell.minutes || []).map((x) => Number(x)).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
      const trips = (cell.trips || []).filter((x) => x && Number.isFinite(Number(x.minute)));
      const tripsSorted = trips.slice().sort((a, b) => Number(a.minute) - Number(b.minute));

      let first = null;
      let last = null;
      if (minutes.length) {
        first = hhmmStr(Math.floor(minutes[0] / 60) % 24, minutes[0] % 60);
        const mLast = minutes[minutes.length - 1];
        last = hhmmStr(Math.floor(mLast / 60) % 24, mLast % 60);
      }

      const status = first && last ? boundaryStatus(now, first, last, SERVICE_DAY_CUTOFF_HOUR) : "unknown";

      let lastTerminal = "";
      for (let i = tripsSorted.length - 1; i >= 0; i--) {
        const t = String(tripsSorted[i].terminal || "").trim();
        if (t) {
          lastTerminal = t;
          break;
        }
      }

      const nextTrips = [];
      let tails = [];
      const dayStart = new Date(serviceDay.getFullYear(), serviceDay.getMonth(), serviceDay.getDate(), 0, 0, 0, 0);
      for (const t of tripsSorted) {
        const minute = Number(t.minute);
        if (!Number.isFinite(minute)) continue;
        const dtv = new Date(dayStart.getTime() + minute * 60000);
        if (dtv >= now) {
          nextTrips.push({
            time: hhmmStr(dtv.getHours(), dtv.getMinutes()),
            in_min: Math.round((dtv.getTime() - now.getTime()) / 60000),
            terminal: t.terminal || ""
          });
          if (!tails.length && Array.isArray(t.tail) && t.tail.length) tails = t.tail.slice();
          if (nextTrips.length >= 4) break;
        }
      }

      const tm = buildTerminalsForNext(nextTrips, tripsSorted);
      applyMedalsToTimes(nextTrips, tm.terms, tm.enableMedals, tm.enableMedals ? "🏅" : "");

      let toLabel = "";
      if (tm.enableMedals) {
        toLabel = terminalLabel(tm.terms);
      } else {
        const one = nextTrips.find((x) => String(x.terminal || "").trim());
        toLabel = one ? `${one.terminal}方向` : String(direction || "unknown");
      }

      const tailStops = tails.length ? tails : (tripsSorted[0] && tripsSorted[0].tail) || [];
      const lineNameDisplay = detectCrosslineDisplay(lineName, tailStops, stationLinesIndex) || lineName;
      const termNames = tm.terms.map((x) => String(x.name || "").trim()).filter(Boolean);
      const arrow = pickDirectionArrow8(direction, toLabel, st.lat, st.lon, termNames, stationCoordIndex);

      item.runtime.directions.push({
        line_name: lineName,
        line_name_display: lineNameDisplay,
        direction,
        key: direction || "unknown",
        to: toLabel,
        next: nextTrips,
        status,
        first,
        last,
        terminals: tm.terms,
        last_terminal: lastTerminal,
        arrow
      });
    }

    item.runtime.directions = sortRuntimeDirectionsClockwise(item.runtime.directions);
    stationsOut.push(item);
  }

  const parts = buildStationTwoParts(stationsOut);
  const outputText = logStationParts(parts, !!verboseActiveLog);
  const flat = flattenStationParts(parts);

  if (backend) {
    doneBackendJson(flat, 200);
  } else {
    const dirCount = stationsOut.reduce((acc, st) => {
      const x = st && st.runtime && Array.isArray(st.runtime.directions) ? st.runtime.directions.length : 0;
      return acc + x;
    }, 0);
    console.log(`[INFO][v${SCRIPT_VERSION}] 结果站点=${stationsOut.length} 方向=${dirCount} 通知=1`);
    notifyByBackendFlatList(flat, "北京地铁出发时刻测算");
    doneOk(outputText);
  }
}

main().catch(doneErr);
