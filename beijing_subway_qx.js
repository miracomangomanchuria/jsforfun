/*
Quantumult X - Beijing Subway Departure Script

Thanks to:
- https://github.com/BoyInTheSun/beijing-subway-schedule
- https://bjsubway.boyinthesun.cn/

Args (exactly 2 params, lon then lat):
1) "$argument" = "116.3198,39.9288"
2) "$argument" = "116.3198 39.9288"
3) "$argument" = "lon=116.3198&lat=39.9288"

Output:
- Log only (no notification)
- Each station is split into 2 log parts with separators
*/

const MAP_APP_URL = "https://dtdata.bjsubway.com/stations/map-app.json";
const SCHEDULE_WEEKDAY_URL = "https://raw.githubusercontent.com/BoyInTheSun/beijing-subway-schedule/main/train_schedule_all/schedule_weekday.json";
const SCHEDULE_WEEKEND_URL = "https://raw.githubusercontent.com/BoyInTheSun/beijing-subway-schedule/main/train_schedule_all/schedule_weekend.json";
const HOLIDAY_CN_URL = "https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/{year}.json";

const SCRIPT_VERSION = "1.0.1";
const CROSSLINE_LOOKBACK = 5;
const CROSSLINE_MIN_OTHER = 3;
const STATION_THRESHOLD_M = 300;
const MAX_STATIONS = 8;
const SERVICE_DAY_CUTOFF_HOUR = 4;
const HTTP_TIMEOUT_MS = 60000;
const HOLIDAY_HTTP_TIMEOUT_MS = 5000;

function doneOk(extra = "") {
  if (typeof $done === "function") {
    $done(extra);
  }
}

function doneErr(err) {
  const msg = err && err.stack ? err.stack : String(err);
  console.log("[ERROR] " + msg);
  if (typeof $done === "function") {
    $done("ERROR: " + msg);
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
    return JSON.parse(resp.body || "{}");
  });
}

function pad2(n) {
  return String(n).padStart(2, "0");
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

async function isWorkdayByHolidayCN(nowDate) {
  const year = nowDate.getFullYear();
  const url = HOLIDAY_CN_URL.replace("{year}", String(year));
  let obj = null;
  try {
    obj = await fetchJson(url, {}, HOLIDAY_HTTP_TIMEOUT_MS);
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

function parseArgument(arg) {
  const s = String(arg || "").trim();
  if (!s) return null;

  if (s.includes("=") && (s.includes("&") || s.includes("lat") || s.includes("lon"))) {
    const params = new URLSearchParams(s);
    const lon = Number(params.get("lon") || params.get("lng"));
    const lat = Number(params.get("lat"));
    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      return { lon, lat };
    }
  }

  const parts = s.split(/[\s,;]+/).filter(Boolean);
  if (parts.length >= 2) {
    const lon = Number(parts[0]);
    const lat = Number(parts[1]);
    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      return { lon, lat };
    }
  }

  // Fallback: extract first two float-like numbers from any mixed argument text.
  const nums = s.match(/-?\d+(?:\.\d+)?/g) || [];
  if (nums.length >= 2) {
    const lon = Number(nums[0]);
    const lat = Number(nums[1]);
    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      return { lon, lat };
    }
  }
  return null;
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
  const ranked = catalog.stations.map((st) => [haversineM(lat, lon, st.lat, st.lon), st]);
  ranked.sort((a, b) => a[0] - b[0]);
  if (!ranked.length) return [];
  const minD = ranked[0][0];
  const out = [];
  for (const [d, st] of ranked) {
    if (d <= minD + threshold || out.length === 0) {
      out.push(Object.assign({}, st, { distance_m: Math.round(d * 10) / 10 }));
      if (out.length >= maxN) break;
    } else {
      break;
    }
  }
  return out;
}

function pickScheduleDay(scheduleObj, isWorkday) {
  if (!scheduleObj || typeof scheduleObj !== "object") return null;
  if ("工作日" in scheduleObj || "双休日" in scheduleObj) {
    return isWorkday ? scheduleObj["工作日"] : scheduleObj["双休日"];
  }
  if ("weekday" in scheduleObj || "weekend" in scheduleObj) {
    return isWorkday ? scheduleObj.weekday : scheduleObj.weekend;
  }
  return scheduleObj;
}

function collectScheduleForStations(schedule, stationNorms) {
  const out = {};
  for (const n of stationNorms) out[n] = {};
  if (!schedule || typeof schedule !== "object") return out;
  const target = new Set(stationNorms);

  for (const [lineName, dirs] of Object.entries(schedule)) {
    if (!dirs || typeof dirs !== "object") continue;
    for (const [direction, trains] of Object.entries(dirs)) {
      if (!trains || typeof trains !== "object") continue;
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

        const terminal = parsed[parsed.length - 1][0];
        const terminalMin = parsed[parsed.length - 1][1];
        const tail = [...parsed].reverse().slice(0, CROSSLINE_LOOKBACK).map((x) => x[0]);

        for (const [stName, curMin] of parsed) {
          const n = normName(stName);
          if (!target.has(n)) continue;
          const key = `${lineName}|||${direction}`;
          if (!out[n][key]) out[n][key] = { minutes: [], terminals: {}, trips: [] };
          const cell = out[n][key];
          cell.minutes.push(curMin);
          if (terminal) {
            cell.terminals[terminal] = (cell.terminals[terminal] || 0) + 1;
          }
          let remain = null;
          if (Number.isFinite(terminalMin - curMin)) remain = terminalMin - curMin;
          cell.trips.push({ minute: curMin, terminal, tail, remain_min: remain });
        }
      }
    }
  }
  return out;
}

function textToArrow8(s) {
  const t = String(s || "");
  const pairs = [
    ["东北", "↗️"], ["东南", "↘️"], ["西南", "↙️"], ["西北", "↖️"],
    ["正东", "➡️"], ["正西", "⬅️"], ["正南", "⬇️"], ["正北", "⬆️"],
    ["东", "➡️"], ["西", "⬅️"], ["南", "⬇️"], ["北", "⬆️"]
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
  const arrows = ["⬆️", "↗️", "➡️", "↘️", "⬇️", "↙️", "⬅️", "↖️"];
  const idx = Math.floor((bearing + 22.5) / 45) % 8;
  return arrows[idx];
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

function formatTimeTokens(trips) {
  const out = [];
  let prevHour = null;
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
      if (prevHour != null && h === prevHour) showTime = mm;
      else showTime = `${pad2(h)}:${mm}`;
      prevHour = h;
    }
    out.push(`${medal}${showTime}(${Math.round(inMin)}分)`);
  }
  return out.join(" ");
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
    const ka = [lineOrder[la] ?? 9999, directionBearingDeg(a), String(a.to || ""), String(a.key || "")];
    const kb = [lineOrder[lb] ?? 9999, directionBearingDeg(b), String(b.to || ""), String(b.key || "")];
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] < kb[i]) return -1;
      if (ka[i] > kb[i]) return 1;
    }
    return 0;
  });
  return dirs;
}

function formatStationText(st) {
  const dirs = (st.runtime && st.runtime.directions) || [];
  const firstLast = summarizeStationFirstLast(dirs, SERVICE_DAY_CUTOFF_HOUR);
  let head = `📍${st.name}`;
  if (Number.isFinite(st.distance_m)) head += ` 📏${Math.round(st.distance_m)}米`;
  if (firstLast.first) head += ` 🌅${firstLast.first}`;
  if (firstLast.last) head += ` 🌃${firstLast.last}`;

  const lines = [head];
  for (const d of dirs) {
    const status = String(d.status || "");
    const lineTag = String(d.line_name_display || d.line_name || "").trim();
    let toTag = "";
    if (status === "ended") toTag = String(d.last_terminal || d.to || d.key || "").trim();
    else toTag = String(d.to || d.key || "").trim();
    if (toTag.endsWith("方向")) toTag = toTag.slice(0, -2).trim();

    const row = ` 🚇${lineTag}${toTag ? ` ${d.arrow || "👉"} ${toTag}` : ""}`;
    lines.push(row);

    if (status === "ended" && d.last) {
      lines.push(`  错过末班: ${d.last}`);
      continue;
    }
    if (Array.isArray(d.next) && d.next.length) {
      const tokenLine = formatTimeTokens(d.next);
      if (tokenLine) lines.push(`  ${tokenLine}`);
    } else {
      if (status === "not_started") lines.push("  未到首班");
      else if (status !== "ended") lines.push("  无可用班次");
    }
  }
  return lines.join("\n");
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

function logStationParts(parts) {
  const outLines = [];
  outLines.push("===QX_SUBWAY_RESULT_BEGIN===");
  console.log("===QX_SUBWAY_RESULT_BEGIN===");
  parts.forEach((p, i) => {
    const n = i + 1;
    outLines.push(`---STATION#${n}---PART1---`);
    outLines.push(p.head || "");
    outLines.push(`---STATION#${n}---PART2---`);
    outLines.push(p.body || "");
    outLines.push(`---STATION#${n}---END---`);

    console.log(`---STATION#${n}---PART1---`);
    console.log(p.head || "");
    console.log(`---STATION#${n}---PART2---`);
    console.log(p.body || "");
    console.log(`---STATION#${n}---END---`);
  });
  console.log("===QX_SUBWAY_RESULT_END===");
  outLines.push("===QX_SUBWAY_RESULT_END===");
  return outLines.join("\n");
}

async function main() {
  if (typeof $task === "undefined") {
    throw new Error("This script must run in Quantumult X.");
  }

  const parsed = parseArgument(typeof $argument !== "undefined" ? $argument : "");
  if (!parsed) {
    throw new Error("参数错误：请传 2 个参数（lon,lat），如 116.3198,39.9288");
  }
  const inputLon = parsed.lon;
  const inputLat = parsed.lat;

  const now = new Date();
  const dayType = await isWorkdayByHolidayCN(now);
  const isWorkday = !!dayType.isWorkday;
  const scheduleUrl = isWorkday ? SCHEDULE_WEEKDAY_URL : SCHEDULE_WEEKEND_URL;

  const [mapObj, scheduleObj] = await Promise.all([
    fetchJson(MAP_APP_URL),
    fetchJson(scheduleUrl)
  ]);

  const catalog = buildCatalog(mapObj);
  const stationLinesIndex = buildStationLineIndex(catalog);
  const stationCoordIndex = buildStationCoordIndex(catalog);

  const aligned = autoAlignCoordForCatalog(catalog, inputLat, inputLon, true);
  const nearStations = nearestStations(catalog, aligned.lat, aligned.lon, STATION_THRESHOLD_M, MAX_STATIONS);
  if (!nearStations.length) {
    console.log("===QX_SUBWAY_RESULT_BEGIN===");
    console.log("---STATION#1---PART1---");
    console.log("未找到附近站点");
    console.log("---STATION#1---PART2---");
    console.log("");
    console.log("---STATION#1---END---");
    console.log("===QX_SUBWAY_RESULT_END===");
    doneOk("");
    return;
  }

  const serviceDay = serviceDayFor(now, SERVICE_DAY_CUTOFF_HOUR).date;
  const schedule = pickScheduleDay(scheduleObj, isWorkday) || scheduleObj;

  const stationNorms = nearStations.map((s) => s.norm);
  const schByStation = collectScheduleForStations(schedule, stationNorms);

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
  const outputText = logStationParts(parts);

  doneOk(outputText);
}

main().catch(doneErr);
