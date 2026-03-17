#!/bin/sh
# iOS a-Shell script: Beijing subway next departures by lon/lat.
#
# Usage:
# 1) Edit LON/LAT below.
# 2) Run: sh beijing_subway_ashell.sh
#
# Data acknowledgment:
# - https://github.com/BoyInTheSun/beijing-subway-schedule
# - https://bjsubway.boyinthesun.cn/
# - https://dtdata.bjsubway.com/stations/map-app.json

set -eu

# ===== User variables (edit these two) =====
LON="${LON:-116.3198}"
LAT="${LAT:-39.9288}"

# ===== Optional knobs =====
THRESHOLD_M="${THRESHOLD_M:-300}"           # Include multiple nearest stations within +300m
MAX_STATIONS="${MAX_STATIONS:-8}"           # Hard cap for tie candidates
TIMEOUT_SEC="${TIMEOUT_SEC:-20}"            # HTTP timeout
SERVICE_CUTOFF_HOUR="${SERVICE_CUTOFF_HOUR:-4}"  # 04:00 boundary for service day
PREFER_GCJ="${PREFER_GCJ:-1}"               # 1: prefer WGS84->GCJ02 alignment
CACHE_DIR="${CACHE_DIR:-$HOME/Documents/beijing_subway_cache}"

# Positional override (optional): sh beijing_subway_ashell.sh <lon> <lat>
if [ "${1:-}" != "" ] && [ "${2:-}" != "" ]; then
  LON="$1"
  LAT="$2"
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 not found in a-Shell."
  exit 1
fi

mkdir -p "$CACHE_DIR"

python3 - "$LON" "$LAT" "$THRESHOLD_M" "$MAX_STATIONS" "$TIMEOUT_SEC" "$SERVICE_CUTOFF_HOUR" "$PREFER_GCJ" "$CACHE_DIR" <<'PY'
from __future__ import annotations
import datetime as dt
import gzip
import json
import math
import os
import re
import sys
import urllib.request

MAP_APP_URL = "https://dtdata.bjsubway.com/stations/map-app.json"
SCHEDULE_WEEKDAY_URLS = [
    "https://raw.githubusercontent.com/BoyInTheSun/beijing-subway-schedule/main/train_schedule_all/schedule_weekday.json",
    "https://cdn.jsdelivr.net/gh/BoyInTheSun/beijing-subway-schedule@main/train_schedule_all/schedule_weekday.json",
]
SCHEDULE_WEEKEND_URLS = [
    "https://raw.githubusercontent.com/BoyInTheSun/beijing-subway-schedule/main/train_schedule_all/schedule_weekend.json",
    "https://cdn.jsdelivr.net/gh/BoyInTheSun/beijing-subway-schedule@main/train_schedule_all/schedule_weekend.json",
]
HOLIDAY_CN_URL = "https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/{year}.json"

CROSSLINE_LOOKBACK = 5
CROSSLINE_MIN_OTHER = 3
STATION_PART_SPLIT = "-----PART-----"


def get_json(url: str, timeout: int):
    req = urllib.request.Request(url, headers={
        "User-Agent": "aShell-BeijingSubway/1.0",
        "Accept": "application/json,text/plain,*/*",
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
        enc = str(r.headers.get("content-encoding") or "").lower()
        if enc == "gzip" or raw[:2] == b"\x1f\x8b":
            raw = gzip.decompress(raw)
    return json.loads(raw.decode("utf-8", "replace"))


def load_json(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: str, obj):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False)
    os.replace(tmp, path)


def cache_get(path: str):
    try:
        return load_json(path)
    except Exception:
        return None


def cache_put(path: str, obj):
    try:
        save_json(path, obj)
    except Exception:
        pass


def service_day_for(now: dt.datetime, cutoff: int):
    d = now
    shifted = False
    if now.hour < cutoff:
        d = now - dt.timedelta(days=1)
        shifted = True
    return d.date(), shifted


def iso_week_key(d: dt.date):
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"


def ymd(d: dt.date):
    return d.isoformat()


def norm_name(s: str):
    s = re.sub(r"\s+", "", str(s or ""))
    s = re.sub(r"[（(][^）)]*[）)]", "", s)
    s = re.sub(r"地铁站$", "", s)
    s = re.sub(r"站$", "", s)
    s = re.sub(r"[-－—].*$", "", s)
    return s


def out_of_china(lat: float, lon: float):
    return not (72.004 <= lon <= 137.8347 and 0.8293 <= lat <= 55.8271)


def _gcj_transform_lat(x: float, y: float):
    ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * math.sqrt(abs(x))
    ret += (20.0 * math.sin(6.0 * x * math.pi) + 20.0 * math.sin(2.0 * x * math.pi)) * 2.0 / 3.0
    ret += (20.0 * math.sin(y * math.pi) + 40.0 * math.sin(y / 3.0 * math.pi)) * 2.0 / 3.0
    ret += (160.0 * math.sin(y / 12.0 * math.pi) + 320.0 * math.sin(y * math.pi / 30.0)) * 2.0 / 3.0
    return ret


def _gcj_transform_lon(x: float, y: float):
    ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * math.sqrt(abs(x))
    ret += (20.0 * math.sin(6.0 * x * math.pi) + 20.0 * math.sin(2.0 * x * math.pi)) * 2.0 / 3.0
    ret += (20.0 * math.sin(x * math.pi) + 40.0 * math.sin(x / 3.0 * math.pi)) * 2.0 / 3.0
    ret += (150.0 * math.sin(x / 12.0 * math.pi) + 300.0 * math.sin(x / 30.0 * math.pi)) * 2.0 / 3.0
    return ret


def wgs84_to_gcj02(lat: float, lon: float):
    if out_of_china(lat, lon):
        return lat, lon
    a = 6378245.0
    ee = 0.00669342162296594323
    dlat = _gcj_transform_lat(lon - 105.0, lat - 35.0)
    dlon = _gcj_transform_lon(lon - 105.0, lat - 35.0)
    radlat = lat / 180.0 * math.pi
    magic = math.sin(radlat)
    magic = 1 - ee * magic * magic
    sqrtmagic = math.sqrt(magic)
    dlat = (dlat * 180.0) / ((a * (1 - ee)) / (magic * sqrtmagic) * math.pi)
    dlon = (dlon * 180.0) / (a / sqrtmagic * math.cos(radlat) * math.pi)
    return lat + dlat, lon + dlon


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float):
    r = 6371000.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def nearest_distance_m(catalog, lat, lon):
    best = None
    for st in catalog["stations"]:
        d = haversine_m(lat, lon, st["lat"], st["lon"])
        if best is None or d < best:
            best = d
    return best


def auto_align_coord(catalog, lat, lon, prefer_gcj: bool):
    raw_best = nearest_distance_m(catalog, lat, lon)
    glat, glon = wgs84_to_gcj02(lat, lon)
    gcj_best = nearest_distance_m(catalog, glat, glon)
    if prefer_gcj and gcj_best <= raw_best + 50:
        return glat, glon
    if gcj_best + 120 < raw_best:
        return glat, glon
    return lat, lon


def parse_hhmm_loose(s: str):
    m = re.search(r"(\d{1,2}):(\d{2})", str(s or ""))
    if not m:
        return None
    hh = int(m.group(1))
    mm = int(m.group(2))
    if hh < 0 or hh > 29 or mm < 0 or mm > 59:
        return None
    return hh, mm


def hhmm_of_minute(v: int):
    v = int(v) % 1440
    return f"{v//60:02d}:{v%60:02d}"


def service_min_from_hhmm(hhmm: str, cutoff: int):
    m = re.match(r"^(\d{1,2}):(\d{2})$", str(hhmm or "").strip())
    if not m:
        return None
    hh = int(m.group(1))
    mm = int(m.group(2))
    val = hh * 60 + mm
    if hh < cutoff:
        val += 1440
    return val


def text_to_arrow8(s: str):
    t = str(s or "")
    pairs = [
        ("东北", "↗️"), ("东南", "↘️"), ("西南", "↙️"), ("西北", "↖️"),
        ("正东", "➡️"), ("正西", "⬅️"), ("正南", "⬇️"), ("正北", "⬆️"),
        ("东", "➡️"), ("西", "⬅️"), ("南", "⬇️"), ("北", "⬆️"),
    ]
    for k, a in pairs:
        if k in t:
            return a
    return ""


def arrow_to_bearing(a: str):
    s = str(a or "").replace("\ufe0f", "").strip()
    mp = {"⬆":0, "↗":45, "➡":90, "↘":135, "⬇":180, "↙":225, "⬅":270, "↖":315, "↑":0, "→":90, "↓":180, "←":270}
    if s in mp:
        return mp[s]
    if s and s[0] in mp:
        return mp[s[0]]
    return None


def bearing_deg(lat1, lon1, lat2, lon2):
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dl = math.radians(lon2 - lon1)
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360.0) % 360.0


def bearing_to_arrow8(b):
    arr = ["⬆️", "↗️", "➡️", "↘️", "⬇️", "↙️", "⬅️", "↖️"]
    idx = int((b + 22.5) // 45) % 8
    return arr[idx]


def build_catalog(map_obj):
    if not isinstance(map_obj, dict) or not isinstance(map_obj.get("stations_data"), list) or not isinstance(map_obj.get("lines_data"), list):
        raise RuntimeError("map-app.json format unexpected")
    line_name = {}
    for ln in map_obj["lines_data"]:
        try:
            lid = int(ln.get("id"))
            line_name[lid] = str(ln.get("cn_name") or lid)
        except Exception:
            pass
    merged = {}
    for st in map_obj["stations_data"]:
        try:
            sid = int(st.get("id"))
            name = str(st.get("cn_name") or "").strip()
            lat = float(st.get("latitude"))
            lon = float(st.get("longitude"))
            if not name:
                continue
        except Exception:
            continue
        lids = set()
        for x in st.get("lines") or []:
            try:
                lid = int(x["id"] if isinstance(x, dict) else x)
                lids.add(lid)
            except Exception:
                pass
        lines = sorted([line_name.get(x, str(x)) for x in lids])
        key = norm_name(name)
        if key not in merged:
            merged[key] = {
                "name": name,
                "norm": key,
                "lat": lat,
                "lon": lon,
                "station_ids": {sid},
                "line_names": set(lines),
                "aliases": {name},
            }
        else:
            m = merged[key]
            m["station_ids"].add(sid)
            m["line_names"].update(lines)
            m["aliases"].add(name)
    stations = []
    station_lines_index = {}
    station_coord_index = {}
    for m in merged.values():
        o = {
            "name": m["name"],
            "norm": m["norm"],
            "lat": m["lat"],
            "lon": m["lon"],
            "station_ids": sorted(m["station_ids"]),
            "line_names": sorted(m["line_names"]),
            "aliases": sorted(m["aliases"]),
        }
        stations.append(o)
        n = o["norm"]
        station_lines_index.setdefault(n, set()).update(o["line_names"])
        station_coord_index.setdefault(n, (o["lat"], o["lon"]))
        for a in o["aliases"]:
            na = norm_name(a)
            station_lines_index.setdefault(na, set()).update(o["line_names"])
            station_coord_index.setdefault(na, (o["lat"], o["lon"]))
    return {
        "stations": stations,
        "station_lines_index": station_lines_index,
        "station_coord_index": station_coord_index,
    }


def nearest_stations(catalog, lat, lon, threshold, max_n):
    ranked = [(haversine_m(lat, lon, s["lat"], s["lon"]), s) for s in catalog["stations"]]
    ranked.sort(key=lambda x: x[0])
    if not ranked:
        return []
    min_d = ranked[0][0]
    out = []
    for d, s in ranked:
        if d <= min_d + threshold or not out:
            x = dict(s)
            x["distance_m"] = round(d, 1)
            out.append(x)
            if len(out) >= max_n:
                break
        else:
            break
    return out


def pick_schedule_day(schedule_obj, is_workday):
    if not isinstance(schedule_obj, dict):
        return None
    if "工作日" in schedule_obj or "双休日" in schedule_obj:
        return schedule_obj.get("工作日") if is_workday else schedule_obj.get("双休日")
    if "weekday" in schedule_obj or "weekend" in schedule_obj:
        return schedule_obj.get("weekday") if is_workday else schedule_obj.get("weekend")
    return schedule_obj


def collect_schedule_for_stations(schedule, station_norms):
    out = {n: {} for n in station_norms}
    if not isinstance(schedule, dict):
        return out
    target = set(station_norms)
    for line_name, dirs in schedule.items():
        if not isinstance(dirs, dict):
            continue
        for direction, trains in dirs.items():
            if not isinstance(trains, dict):
                continue
            for stops in trains.values():
                if not isinstance(stops, list):
                    continue
                parsed = []
                prev = None
                dayoff = 0
                for stop in stops:
                    if not isinstance(stop, list) or len(stop) < 2:
                        continue
                    st_name = str(stop[0] or "").strip()
                    t = parse_hhmm_loose(stop[1])
                    if not t:
                        continue
                    cur = t[0] * 60 + t[1]
                    if prev is not None and cur < prev:
                        dayoff += 1440
                    prev = cur
                    parsed.append((st_name, cur + dayoff))
                if not parsed:
                    continue
                terminal = parsed[-1][0]
                terminal_min = parsed[-1][1]
                tail = [x[0] for x in list(reversed(parsed))[:CROSSLINE_LOOKBACK]]
                for st_name, cur_min in parsed:
                    n = norm_name(st_name)
                    if n not in target:
                        continue
                    key = (str(line_name or ""), str(direction or ""))
                    out[n].setdefault(key, {"minutes": [], "terminals": {}, "trips": []})
                    cell = out[n][key]
                    cell["minutes"].append(cur_min)
                    if terminal:
                        cell["terminals"][terminal] = int(cell["terminals"].get(terminal, 0)) + 1
                    remain = terminal_min - cur_min
                    cell["trips"].append({
                        "minute": cur_min,
                        "terminal": terminal,
                        "tail": tail,
                        "remain_min": remain,
                    })
    return out


def detect_crossline_display(cur_line, tail_stops, station_lines_index):
    if not cur_line or not tail_stops:
        return None
    cnt = {}
    for s in tail_stops:
        for ln in station_lines_index.get(norm_name(s), set()):
            cnt[ln] = int(cnt.get(ln, 0)) + 1
    cur_cnt = int(cnt.get(cur_line, 0))
    best_line = None
    best_cnt = 0
    for ln, c in cnt.items():
        if ln == cur_line:
            continue
        if c > best_cnt or (c == best_cnt and best_line and ln < best_line):
            best_line, best_cnt = ln, c
    if best_line and best_cnt >= CROSSLINE_MIN_OTHER and best_cnt > cur_cnt:
        if best_line in str(cur_line):
            return str(cur_line)
        return f"{cur_line}-{best_line}"
    return None


def direction_arrow(direction_text, to_text, from_lat, from_lon, terminal_names, station_coord_index):
    a = text_to_arrow8(direction_text)
    if a:
        return a
    a = text_to_arrow8(to_text)
    if a:
        return a
    vx, vy = 0.0, 0.0
    used = 0
    for name in terminal_names or []:
        tgt = station_coord_index.get(norm_name(name))
        if not tgt:
            continue
        br = bearing_deg(from_lat, from_lon, tgt[0], tgt[1])
        rad = math.radians(br)
        vx += math.sin(rad)
        vy += math.cos(rad)
        used += 1
    if used == 0:
        return ""
    br = (math.degrees(math.atan2(vx, vy)) + 360.0) % 360.0
    return bearing_to_arrow8(br)


def format_time_tokens(trips):
    out = []
    prev_hour = None
    for t in trips:
        ts = str(t.get("time") or "")
        in_min = int(round(float(t.get("in_min"))))
        medal = str(t.get("medal") or "")
        m = re.match(r"^(\d{1,2}):(\d{2})$", ts)
        show = ts
        if m:
            hh = int(m.group(1))
            mm = m.group(2)
            if prev_hour is not None and hh == prev_hour:
                show = mm
            else:
                show = f"{hh:02d}:{mm}"
            prev_hour = hh
        out.append(f"{medal}{show}({in_min}分)")
    return " ".join(out)


def summarize_first_last(dirs, cutoff):
    firsts, lasts = [], []
    for d in dirs:
        f = service_min_from_hhmm(d.get("first"), cutoff)
        l = service_min_from_hhmm(d.get("last"), cutoff)
        if f is not None:
            firsts.append(f)
        if l is not None:
            lasts.append(l)
    first = hhmm_of_minute(min(firsts)) if firsts else None
    last = hhmm_of_minute(max(lasts)) if lasts else None
    return first, last


def sort_directions_clockwise(directions):
    line_order = {}
    for d in directions:
        ln = str(d.get("line_name_display") or d.get("line_name") or "")
        if ln not in line_order:
            line_order[ln] = len(line_order)
    def key(d):
        ln = str(d.get("line_name_display") or d.get("line_name") or "")
        b = arrow_to_bearing(d.get("arrow")) if d.get("arrow") else None
        if b is None:
            b = 9999
        return (line_order.get(ln, 9999), b, str(d.get("to") or ""), str(d.get("key") or ""))
    return sorted(directions, key=key)


def main():
    lon = float(sys.argv[1])
    lat = float(sys.argv[2])
    threshold_m = float(sys.argv[3])
    max_stations = int(sys.argv[4])
    timeout_sec = int(sys.argv[5])
    cutoff_hour = int(sys.argv[6])
    prefer_gcj = str(sys.argv[7]).strip() not in ("0", "false", "False", "")
    cache_dir = sys.argv[8]

    now = dt.datetime.now()
    service_day, _shifted = service_day_for(now, cutoff_hour)
    week_key = iso_week_key(service_day)

    os.makedirs(cache_dir, exist_ok=True)

    map_cache = os.path.join(cache_dir, "map-app.json")
    map_obj = cache_get(map_cache)
    if not map_obj:
        map_obj = get_json(MAP_APP_URL, timeout_sec)
        cache_put(map_cache, map_obj)

    holiday_cache = os.path.join(cache_dir, f"holiday-{service_day.year}.json")
    holiday_obj = cache_get(holiday_cache)
    if not holiday_obj:
        try:
            holiday_obj = get_json(HOLIDAY_CN_URL.format(year=service_day.year), min(timeout_sec, 8))
            cache_put(holiday_cache, holiday_obj)
        except Exception:
            holiday_obj = {}

    is_workday = 1 <= service_day.weekday() <= 5
    for r in holiday_obj.get("days") or []:
        if isinstance(r, dict) and str(r.get("date") or "") == ymd(service_day):
            if r.get("isOffDay") is True:
                is_workday = False
            elif r.get("isOffDay") is False:
                is_workday = True
            break

    sched_key = "weekday" if is_workday else "weekend"
    sched_cache = os.path.join(cache_dir, f"schedule-{sched_key}.json")
    sched_obj = cache_get(sched_cache)
    use_cache = bool(isinstance(sched_obj, dict) and sched_obj.get("week_key") == week_key and isinstance(sched_obj.get("data"), dict))
    if not use_cache:
        urls = SCHEDULE_WEEKDAY_URLS if is_workday else SCHEDULE_WEEKEND_URLS
        loaded = None
        for u in urls:
            try:
                loaded = get_json(u, timeout_sec)
                break
            except Exception:
                continue
        if loaded is None:
            if isinstance(sched_obj, dict) and isinstance(sched_obj.get("data"), dict):
                loaded = sched_obj["data"]
            else:
                raise RuntimeError("schedule download failed")
        sched_obj = {"week_key": week_key, "data": loaded}
        cache_put(sched_cache, sched_obj)

    schedule_raw = sched_obj["data"]
    schedule = pick_schedule_day(schedule_raw, is_workday) or schedule_raw

    catalog = build_catalog(map_obj)
    qlat, qlon = auto_align_coord(catalog, lat, lon, prefer_gcj)
    stations = nearest_stations(catalog, qlat, qlon, threshold_m, max_stations)
    if not stations:
        print("未找到附近站点")
        return

    station_norms = [s["norm"] for s in stations]
    sch_by_station = collect_schedule_for_stations(schedule, station_norms)

    service_day_start = dt.datetime.combine(service_day, dt.time(0, 0, 0))
    minute_now = int((now - service_day_start).total_seconds() // 60)

    for si, st in enumerate(stations):
        item_dirs = []
        rows = sch_by_station.get(st["norm"], {})
        for (line_name, direction), cell in rows.items():
            mins = sorted(int(x) for x in (cell.get("minutes") or []))
            trips = sorted((cell.get("trips") or []), key=lambda x: int(x.get("minute", 0)))
            if not mins:
                continue
            first = hhmm_of_minute(mins[0])
            last = hhmm_of_minute(mins[-1])
            if minute_now < mins[0]:
                status = "not_started"
            elif minute_now > mins[-1]:
                status = "ended"
            else:
                status = "running"

            next_trips = []
            tails = []
            for t in trips:
                tm = int(t.get("minute", -1))
                if tm >= minute_now:
                    next_trips.append({
                        "time": hhmm_of_minute(tm),
                        "in_min": tm - minute_now,
                        "terminal": str(t.get("terminal") or ""),
                    })
                    if not tails and isinstance(t.get("tail"), list):
                        tails = list(t.get("tail"))
                    if len(next_trips) >= 4:
                        break

            next_terms = []
            for t in next_trips:
                z = str(t.get("terminal") or "").strip()
                if z and z not in next_terms:
                    next_terms.append(z)

            enable_medals = len(next_terms) > 1
            medals = []
            if enable_medals:
                dist = {}
                for t in trips:
                    nm = str(t.get("terminal") or "").strip()
                    if nm in next_terms:
                        rv = t.get("remain_min")
                        if isinstance(rv, (int, float)):
                            dist[nm] = min(dist.get(nm, 10**9), float(rv))
                next_terms.sort(key=lambda x: (dist.get(x, 10**9), next_terms.index(x)))
                ems = ["🥇", "🥈", "🥉"]
                medals = [{"name": n, "medal": (ems[i] if i < len(ems) else "🏅")} for i, n in enumerate(next_terms)]
                mm = {m["name"]: m["medal"] for m in medals}
                for t in next_trips:
                    t["medal"] = mm.get(str(t.get("terminal") or ""), "")
                to_label = " ".join(f'{m["medal"]}{m["name"]}' for m in medals) + " 方向"
            else:
                for t in next_trips:
                    t["medal"] = ""
                if next_trips and str(next_trips[0].get("terminal") or "").strip():
                    to_label = f'{next_trips[0]["terminal"]}方向'
                else:
                    to_label = str(direction or "unknown")

            tail_stops = tails if tails else (trips[0].get("tail") if trips else [])
            line_display = detect_crossline_display(line_name, tail_stops or [], catalog["station_lines_index"]) or line_name
            term_names = [m["name"] for m in medals]
            arrow = direction_arrow(direction, to_label, st["lat"], st["lon"], term_names, catalog["station_coord_index"])

            last_terminal = ""
            for t in reversed(trips):
                nm = str(t.get("terminal") or "").strip()
                if nm:
                    last_terminal = nm
                    break

            item_dirs.append({
                "line_name": line_name,
                "line_name_display": line_display,
                "direction": direction,
                "key": direction or "unknown",
                "to": to_label,
                "next": next_trips,
                "status": status,
                "first": first,
                "last": last,
                "last_terminal": last_terminal,
                "arrow": arrow,
            })

        item_dirs = sort_directions_clockwise(item_dirs)
        first_all, last_all = summarize_first_last(item_dirs, cutoff_hour)

        head = f'📍{st["name"]} 📏{int(round(float(st["distance_m"])))}米'
        if first_all:
            head += f" 🌅{first_all}"
        if last_all:
            head += f" 🌃{last_all}"
        print(head)
        print(STATION_PART_SPLIT)

        for d in item_dirs:
            to_tag = str(d.get("to") or "").strip()
            if to_tag.endswith("方向"):
                to_tag = to_tag[:-2].strip()
            row = f' 🚇{d.get("line_name_display")}'
            if to_tag:
                row += f' {d.get("arrow") or "👉"} {to_tag}'
            print(row)

            status = d.get("status")
            if status == "ended" and d.get("last"):
                print(f'  错过末班: {d.get("last")}')
            elif d.get("next"):
                print("  " + format_time_tokens(d["next"]))
            elif status == "not_started":
                print("  未到首班")
            else:
                print("  无可用班次")

        if si != len(stations) - 1:
            print("")


if __name__ == "__main__":
    main()
PY
