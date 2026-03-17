#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations
import argparse, datetime as dt, gzip, json, math, os, re, shlex, sys, time
import urllib.parse, urllib.request

# Acknowledgment:
# Schedule integration in this script references open data ideas from:
# - https://github.com/BoyInTheSun/beijing-subway-schedule
# - https://bjsubway.boyinthesun.cn/
# Thanks to the project and site maintainers for their open-source contribution.

MAP_APP_URL = "https://dtdata.bjsubway.com/stations/map-app.json"
ACC_URL = "https://dtdata.bjsubway.com/stations/acclocation.json"
AMAP_IP_URL = "https://restapi.amap.com/v3/ip"
PIS_BASE_DEFAULT = "https://app2.bjsubway.com"
PIS_APP2_BASE_DEFAULT = "https://app2.bjsubway.com"
BOYIN_SCHEDULE_URL = "https://bjsubway.boyinthesun.cn/data/schedule.json"
GITHUB_SCHEDULE_WEEKDAY_URL = "https://raw.githubusercontent.com/BoyInTheSun/beijing-subway-schedule/main/train_schedule_all/schedule_weekday.json"
GITHUB_SCHEDULE_WEEKEND_URL = "https://raw.githubusercontent.com/BoyInTheSun/beijing-subway-schedule/main/train_schedule_all/schedule_weekend.json"
HOLIDAY_CN_URL = "https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/{year}.json"
CROSSLINE_LOOKBACK = 5
CROSSLINE_MIN_OTHER = 3
SUNRISE_EMOJI = "\U0001F305"  # U+1F305
NIGHT_EMOJI = "\U0001F303"    # U+1F303


def get_json(url, timeout=18, headers=None):
    hdrs = {"User-Agent":"Mozilla/5.0","Accept":"application/json,text/plain,*/*"}
    if isinstance(headers, dict):
        hdrs.update(headers)
    req = urllib.request.Request(url, headers=hdrs)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
        enc = str(r.headers.get("content-encoding") or "").lower()
        if enc == "gzip" or raw[:2] == b"\x1f\x8b":
            raw = gzip.decompress(raw)
        return json.loads(raw.decode("utf-8", "replace"))


def post_json(url, payload, timeout=18):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST", headers={"Content-Type":"application/json;charset=UTF-8","Accept":"application/json,text/plain,*/*","User-Agent":"Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
        enc = str(r.headers.get("content-encoding") or "").lower()
        if enc == "gzip" or raw[:2] == b"\x1f\x8b":
            raw = gzip.decompress(raw)
        return json.loads(raw.decode("utf-8", "replace"))


def haversine_m(lat1, lon1, lat2, lon2):
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def out_of_china(lat, lon):
    return not (72.004 <= lon <= 137.8347 and 0.8293 <= lat <= 55.8271)


def _gcj_transform_lat(x, y):
    ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * math.sqrt(abs(x))
    ret += (20.0 * math.sin(6.0 * x * math.pi) + 20.0 * math.sin(2.0 * x * math.pi)) * 2.0 / 3.0
    ret += (20.0 * math.sin(y * math.pi) + 40.0 * math.sin(y / 3.0 * math.pi)) * 2.0 / 3.0
    ret += (160.0 * math.sin(y / 12.0 * math.pi) + 320.0 * math.sin(y * math.pi / 30.0)) * 2.0 / 3.0
    return ret


def _gcj_transform_lon(x, y):
    ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * math.sqrt(abs(x))
    ret += (20.0 * math.sin(6.0 * x * math.pi) + 20.0 * math.sin(2.0 * x * math.pi)) * 2.0 / 3.0
    ret += (20.0 * math.sin(x * math.pi) + 40.0 * math.sin(x / 3.0 * math.pi)) * 2.0 / 3.0
    ret += (150.0 * math.sin(x / 12.0 * math.pi) + 300.0 * math.sin(x / 30.0 * math.pi)) * 2.0 / 3.0
    return ret


def wgs84_to_gcj02(lat, lon):
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


def nearest_distance_m(catalog, lat, lon):
    stations = (catalog or {}).get("stations") or []
    if not stations:
        return None
    best = None
    for st in stations:
        try:
            d = haversine_m(lat, lon, float(st["lat"]), float(st["lon"]))
        except Exception:
            continue
        if best is None or d < best:
            best = d
    return best


def auto_align_coord_for_catalog(catalog, lat, lon, prefer_gcj=False):
    raw_best = nearest_distance_m(catalog, lat, lon)
    if raw_best is None:
        return lat, lon, "raw"
    gcj_lat, gcj_lon = wgs84_to_gcj02(lat, lon)
    gcj_best = nearest_distance_m(catalog, gcj_lat, gcj_lon)
    if gcj_best is None:
        return lat, lon, "raw"
    # In iOS flow, prefer GCJ02 unless it is clearly worse.
    if prefer_gcj and gcj_best <= raw_best + 50.0:
        return gcj_lat, gcj_lon, "wgs84_to_gcj02"
    # Generic auto mode: only switch when conversion clearly improves match.
    if gcj_best + 120.0 < raw_best:
        return gcj_lat, gcj_lon, "wgs84_to_gcj02"
    return lat, lon, "raw"


def bearing_deg(lat1, lon1, lat2, lon2):
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dl = math.radians(lon2 - lon1)
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    br = math.degrees(math.atan2(y, x))
    return (br + 360.0) % 360.0


def bearing_to_arrow8(bearing):
    arrows = [
        "\u2B06\uFE0F",  # up
        "\u2197\uFE0F",  # up-right
        "\u27A1\uFE0F",  # right
        "\u2198\uFE0F",  # down-right
        "\u2B07\uFE0F",  # down
        "\u2199\uFE0F",  # down-left
        "\u2B05\uFE0F",  # left
        "\u2196\uFE0F",  # up-left
    ]
    idx = int((bearing + 22.5) // 45) % 8
    return arrows[idx]


def text_to_arrow8(s):
    t = str(s or "")
    pairs = [
        ("东北", "\u2197\uFE0F"),
        ("东南", "\u2198\uFE0F"),
        ("西南", "\u2199\uFE0F"),
        ("西北", "\u2196\uFE0F"),
        ("正东", "\u27A1\uFE0F"),
        ("正西", "\u2B05\uFE0F"),
        ("正南", "\u2B07\uFE0F"),
        ("正北", "\u2B06\uFE0F"),
        ("东", "\u27A1\uFE0F"),
        ("西", "\u2B05\uFE0F"),
        ("南", "\u2B07\uFE0F"),
        ("北", "\u2B06\uFE0F"),
    ]
    for k, a in pairs:
        if k in t:
            return a
    return ""


def arrow8_to_bearing(arrow):
    s = str(arrow or "").replace("\uFE0F", "").strip()
    mapping = {
        "\u2B06": 0,    # ⬆
        "\u2197": 45,   # ↗
        "\u27A1": 90,   # ➡
        "\u2198": 135,  # ↘
        "\u2B07": 180,  # ⬇
        "\u2199": 225,  # ↙
        "\u2B05": 270,  # ⬅
        "\u2196": 315,  # ↖
        "\u2191": 0,    # ↑
        "\u2192": 90,   # →
        "\u2193": 180,  # ↓
        "\u2190": 270,  # ←
    }
    if s in mapping:
        return mapping[s]
    if s and s[0] in mapping:
        return mapping[s[0]]
    return None


def direction_bearing_deg(direction_obj):
    if not isinstance(direction_obj, dict):
        return 9999
    b = arrow8_to_bearing(direction_obj.get("arrow"))
    if b is None:
        a = (
            text_to_arrow8(direction_obj.get("direction"))
            or text_to_arrow8(direction_obj.get("to"))
            or text_to_arrow8(direction_obj.get("key"))
        )
        b = arrow8_to_bearing(a)
    return 9999 if b is None else int(b)


def sort_runtime_directions_clockwise(directions):
    dirs = [d for d in (directions or []) if isinstance(d, dict)]
    if not dirs:
        return dirs
    line_order = {}
    for d in dirs:
        ln = str(d.get("line_name_display") or d.get("line_name") or "")
        if ln not in line_order:
            line_order[ln] = len(line_order)

    def k(d):
        ln = str(d.get("line_name_display") or d.get("line_name") or "")
        return (
            line_order.get(ln, 9999),
            direction_bearing_deg(d),  # 0°(北) 起，顺时针
            str(d.get("to") or ""),
            str(d.get("key") or ""),
        )

    return sorted(dirs, key=k)


def sort_fallback_directions_clockwise(rows):
    items = [r for r in (rows or []) if isinstance(r, dict)]
    if not items:
        return items
    line_order = {}
    for r in items:
        ln = str(r.get("line") or "")
        if ln not in line_order:
            line_order[ln] = len(line_order)

    def k(r):
        b = arrow8_to_bearing(text_to_arrow8(r.get("direction")))
        if b is None:
            b = 9999
        ln = str(r.get("line") or "")
        return (line_order.get(ln, 9999), b, str(r.get("direction") or ""))

    return sorted(items, key=k)


def norm_name(s):
    s = re.sub(r"\s+", "", str(s or "").strip())
    s = re.sub(r"[（(][^）)]*[）)]", "", s)
    s = re.sub(r"地铁站$", "", s)
    s = re.sub(r"站$", "", s)
    s = re.sub(r"[-－—].*$", "", s)
    return s


def parse_hhmm(s):
    m = re.match(r"^\s*(\d{1,2}):(\d{2})\s*$", str(s or ""))
    if not m:
        return None
    hh, mm = int(m.group(1)), int(m.group(2))
    if hh < 0 or hh > 29 or mm < 0 or mm > 59:
        return None
    return hh, mm


def parse_hhmm_loose(s):
    m = re.search(r"(\d{1,2}):(\d{2})", str(s or ""))
    if not m:
        return None
    hh, mm = int(m.group(1)), int(m.group(2))
    if hh < 0 or hh > 29 or mm < 0 or mm > 59:
        return None
    return hh, mm


def hhmm_str(hh, mm):
    return f"{int(hh):02d}:{int(mm):02d}"


def moments_to_datetimes(day, moments):
    out, prev, d_off = [], -1, 0
    for s in moments:
        t = parse_hhmm(s)
        if not t:
            continue
        h, m = t
        cur = h * 60 + m
        if prev >= 0 and cur < prev:
            d_off += 1
        prev = cur
        d = day + dt.timedelta(days=d_off)
        out.append(dt.datetime(d.year, d.month, d.day, h % 24, m))
    return out


def service_day_for(now, cutoff_hour=4):
    if now.hour < cutoff_hour:
        return now.date() - dt.timedelta(days=1), True
    return now.date(), False


def load_holiday_cn(cache_dir, year, ttl=2592000, timeout=20):
    os.makedirs(cache_dir, exist_ok=True)
    p = os.path.join(cache_dir, f"holiday_cn_{year}.json")
    now = time.time()
    if os.path.exists(p) and now - os.path.getmtime(p) <= ttl:
        obj = load_cached_json(p)
        if obj is not None:
            return obj
    url = HOLIDAY_CN_URL.format(year=year)
    obj = get_json(url, timeout=timeout)
    save_cached_json(p, obj)
    return obj


def holiday_cn_is_workday(cache_dir, day, ttl=2592000, timeout=20):
    try:
        obj = load_holiday_cn(cache_dir, day.year, ttl=ttl, timeout=timeout)
    except Exception:
        return None, None
    if not isinstance(obj, dict) or not isinstance(obj.get("days"), list):
        return None, None
    day_str = day.isoformat()
    for r in obj["days"]:
        if isinstance(r, dict) and r.get("date") == day_str:
            is_off = r.get("isOffDay")
            if is_off is True:
                return False, r.get("name") or "holiday-cn"
            if is_off is False:
                return True, r.get("name") or "holiday-cn"
    return None, None


def flatten_moments(schedule_list):
    out = []
    if not isinstance(schedule_list, list):
        return out
    for blk in schedule_list:
        if isinstance(blk, dict) and isinstance(blk.get("moments"), list):
            for x in blk["moments"]:
                s = str(x or "").strip()
                if parse_hhmm(s):
                    out.append(s)
    return out


def is_pythonista():
    return "Pythonista" in sys.executable or "Pythonista" in sys.version


def is_pyto():
    if "Pyto" in sys.executable or "Pyto" in sys.version:
        return True
    try:
        import pyto_ui  # type: ignore
        return True
    except Exception:
        return False


def ensure_utf8_stdout():
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


def normalize_notify(v, default="auto"):
    if v is None:
        return default
    if isinstance(v, bool):
        return "yes" if v else "no"
    s = str(v).strip().lower()
    if s in ("1", "true", "yes", "y", "on"):
        return "yes"
    if s in ("0", "false", "no", "n", "off"):
        return "no"
    if s in ("auto",):
        return "auto"
    return default


def send_notification(title, body, url=None):
    title = str(title or "").strip()
    body = str(body or "").strip()
    message = f"{title}\n{body}".strip() if title else body
    if not message:
        return
    if is_pythonista():
        try:
            import notification  # type: ignore
            notification.schedule(message, 0, "", url)
            return
        except Exception:
            pass
    if is_pyto():
        try:
            import notifications  # type: ignore
            n = notifications.Notification(message=message, url=url)
            notifications.send_notification(n)
        except Exception:
            pass


def truncate_text(s, max_chars):
    if not s:
        return s
    try:
        max_chars = int(max_chars)
    except Exception:
        return s
    if max_chars <= 0:
        return s
    if len(s) > max_chars:
        if max_chars <= 3:
            return s[:max_chars]
        return s[: max_chars - 3] + "..."
    return s


def pythonista_location(timeout_sec=8, desired_accuracy_m=120):
    if not (is_pythonista() or is_pyto()):
        return None
    try:
        import location  # type: ignore
    except Exception:
        return None
    try:
        start_fn = getattr(location, "start_updates", None) or getattr(location, "start_updating", None)
        stop_fn = getattr(location, "stop_updates", None) or getattr(location, "stop_updating", None)
        if start_fn:
            start_fn()
        end = time.time() + max(1, timeout_sec)
        last = None
        best = None
        best_acc = float("inf")
        good_hits = 0
        while time.time() < end:
            p = location.get_location()
            lat = lon = None
            acc = float("inf")
            if isinstance(p, dict) and "latitude" in p and "longitude" in p:
                lat, lon = float(p["latitude"]), float(p["longitude"])
                try:
                    acc = float(p.get("horizontal_accuracy"))
                except Exception:
                    acc = float("inf")
            elif isinstance(p, (list, tuple)) and len(p) >= 2:
                a, b = float(p[0]), float(p[1])
                if -180 <= a <= 180 and -90 <= b <= 90:
                    lat, lon = (b, a)
                elif -90 <= a <= 90 and -180 <= b <= 180:
                    lat, lon = (a, b)
            if lat is not None and lon is not None and -90 <= lat <= 90 and -180 <= lon <= 180:
                last = (lat, lon)
                if acc < best_acc:
                    best_acc = acc
                    best = (lat, lon)
                if acc <= float(desired_accuracy_m):
                    good_hits += 1
                    if good_hits >= 2:
                        break
            time.sleep(0.25)
        return best or last
    except Exception:
        return None
    finally:
        try:
            if stop_fn:
                stop_fn()
        except Exception:
            pass


def amap_ip_location(key, timeout=18):
    q = urllib.parse.urlencode({"key": key})
    obj = get_json(f"{AMAP_IP_URL}?{q}", timeout=timeout)
    if not isinstance(obj, dict) or str(obj.get("status")) != "1":
        return None
    rect = str(obj.get("rectangle") or "")
    if ";" not in rect:
        return None
    try:
        a, b = rect.split(";", 1)
        lon1, lat1 = [float(x) for x in a.split(",", 1)]
        lon2, lat2 = [float(x) for x in b.split(",", 1)]
        return ((lat1 + lat2) / 2, (lon1 + lon2) / 2)
    except Exception:
        return None


def load_cached_json(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def save_cached_json(path, obj):
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False)
    except Exception:
        pass


def load_catalog(cache_dir, ttl=86400, timeout=18):
    os.makedirs(cache_dir, exist_ok=True)
    p_map, p_acc = os.path.join(cache_dir, "map-app.json"), os.path.join(cache_dir, "acclocation.json")
    now = time.time()

    def load_or_fetch(path, url):
        if os.path.exists(path) and now - os.path.getmtime(path) <= ttl:
            obj = load_cached_json(path)
            if obj is not None:
                return obj
        obj = get_json(url, timeout=timeout)
        save_cached_json(path, obj)
        return obj

    map_obj = load_or_fetch(p_map, MAP_APP_URL)
    acc_obj = load_or_fetch(p_acc, ACC_URL)
    if not isinstance(map_obj, dict) or not isinstance(map_obj.get("stations_data"), list):
        raise RuntimeError("map-app.json format unexpected")
    if not isinstance(acc_obj, list):
        raise RuntimeError("acclocation.json format unexpected")

    line_name = {}
    for ln in map_obj.get("lines_data", []):
        try:
            line_name[int(ln.get("id"))] = str(ln.get("cn_name") or "")
        except Exception:
            pass

    st_devs, st_lids = {}, {}
    for r in acc_obj:
        if not isinstance(r, dict):
            continue
        sid = r.get("station_id")
        did = r.get("device_location")
        lid = r.get("line_id")
        try:
            sid = int(sid)
        except Exception:
            continue
        st_devs.setdefault(sid, set())
        st_lids.setdefault(sid, set())
        try:
            st_devs[sid].add(int(did))
        except Exception:
            pass
        try:
            st_lids[sid].add(int(lid))
        except Exception:
            pass

    merged = {}
    for st in map_obj.get("stations_data", []):
        try:
            sid = int(st.get("id"))
            name = str(st.get("cn_name") or "").strip()
            lat, lon = float(st.get("latitude")), float(st.get("longitude"))
        except Exception:
            continue
        if not name:
            continue
        lids = set(st_lids.get(sid, set()))
        for x in st.get("lines", []) or []:
            try:
                lids.add(int((x or {}).get("id") if isinstance(x, dict) else x))
            except Exception:
                pass
        lines = sorted({line_name.get(i, str(i)) for i in lids if i is not None})
        key = norm_name(name)
        if key not in merged:
            merged[key] = {
                "name": name,
                "norm": key,
                "lat": lat,
                "lon": lon,
                "station_ids": set([sid]),
                "device_locations": set(st_devs.get(sid, set())),
                "line_names": set(lines),
                "aliases": set([name]),
            }
        else:
            m = merged[key]
            m["station_ids"].add(sid)
            m["device_locations"].update(st_devs.get(sid, set()))
            m["line_names"].update(lines)
            m["aliases"].add(name)

    stations, idx = [], {}
    for m in merged.values():
        o = {
            "name": m["name"], "norm": m["norm"], "lat": m["lat"], "lon": m["lon"],
            "station_ids": sorted(m["station_ids"]), "device_locations": sorted(m["device_locations"]),
            "line_names": sorted(m["line_names"]), "aliases": sorted(m["aliases"]),
        }
        stations.append(o)
        idx.setdefault(o["norm"], []).append(o)
        for a in o["aliases"]:
            idx.setdefault(norm_name(a), []).append(o)
    return {"stations": stations, "name_index": idx}


def load_github_schedule(cache_dir, ttl=604800, timeout=25):
    os.makedirs(cache_dir, exist_ok=True)
    p_wd = os.path.join(cache_dir, "github_schedule_weekday.json")
    p_we = os.path.join(cache_dir, "github_schedule_weekend.json")
    now = time.time()

    def load_or_fetch(path, url):
        if os.path.exists(path) and now - os.path.getmtime(path) <= ttl:
            obj = load_cached_json(path)
            if obj is not None:
                return obj
        obj = get_json(url, timeout=timeout)
        save_cached_json(path, obj)
        return obj

    wd = load_or_fetch(p_wd, GITHUB_SCHEDULE_WEEKDAY_URL)
    we = load_or_fetch(p_we, GITHUB_SCHEDULE_WEEKEND_URL)
    if not isinstance(wd, dict) or not isinstance(we, dict):
        raise RuntimeError("GitHub schedule format unexpected")
    return {"weekday": wd, "weekend": we}


def load_boyin_schedule(cache_dir, url=BOYIN_SCHEDULE_URL, ttl=604800, timeout=25):
    os.makedirs(cache_dir, exist_ok=True)
    p = os.path.join(cache_dir, "boyin_schedule.json")
    now = time.time()
    if os.path.exists(p) and now - os.path.getmtime(p) <= ttl:
        obj = load_cached_json(p)
        if obj is not None:
            return obj
    obj = get_json(url, timeout=timeout, headers={"Referer": "https://bjsubway.boyinthesun.cn/"})
    save_cached_json(p, obj)
    return obj


def pick_schedule_day(schedule_obj, is_workday):
    if not isinstance(schedule_obj, dict):
        return None
    if "工作日" in schedule_obj or "双休日" in schedule_obj:
        return schedule_obj.get("工作日") if is_workday else schedule_obj.get("双休日")
    if "weekday" in schedule_obj or "weekend" in schedule_obj:
        return schedule_obj.get("weekday") if is_workday else schedule_obj.get("weekend")
    if "wd" in schedule_obj or "we" in schedule_obj:
        return schedule_obj.get("wd") if is_workday else schedule_obj.get("we")
    return schedule_obj


def collect_schedule_for_stations(schedule, station_norms):
    out = {n: {} for n in station_norms}
    if not isinstance(schedule, dict):
        return out
    for line_name, dirs in schedule.items():
        if not isinstance(dirs, dict):
            continue
        for direction, trains in dirs.items():
            if not isinstance(trains, dict):
                continue
            for _train_id, stops in trains.items():
                if not isinstance(stops, list):
                    continue
                parsed = []
                prev_min = None
                day_off = 0
                for stop in stops:
                    if not isinstance(stop, list) or len(stop) < 2:
                        continue
                    st_name = str(stop[0] or "").strip()
                    t = parse_hhmm_loose(stop[1])
                    if not t:
                        continue
                    cur = t[0] * 60 + t[1]
                    if prev_min is not None and cur < prev_min:
                        day_off += 1440
                    prev_min = cur
                    parsed.append((st_name, cur + day_off))
                if not parsed:
                    continue

                terminal = parsed[-1][0]
                terminal_min = parsed[-1][1]
                tail = [x[0] for x in list(reversed(parsed))[:CROSSLINE_LOOKBACK]]

                for st_name, cur_min in parsed:
                    n = norm_name(st_name)
                    if n in out:
                        key = (str(line_name or ""), str(direction or ""))
                        cell = out[n].setdefault(key, {"minutes": [], "terminals": {}})
                        cell["minutes"].append(cur_min)
                        if terminal:
                            cell["terminals"][terminal] = int(cell["terminals"].get(terminal, 0)) + 1
                        remain_min = None
                        try:
                            remain_min = int(terminal_min - cur_min)
                        except Exception:
                            remain_min = None
                        cell.setdefault("trips", []).append({
                            "minute": cur_min,
                            "terminal": terminal,
                            "tail": tail,
                            "remain_min": remain_min,
                        })
                        # Do not break here: one train should contribute to every
                        # selected station it passes (important when multiple nearby
                        # stations are requested together).
    return out


def build_line_station_set(schedule, target_line):
    out = set()
    if not isinstance(schedule, dict):
        return out
    line = schedule.get(target_line)
    if not isinstance(line, dict):
        return out
    for _dirn, trains in line.items():
        if not isinstance(trains, dict):
            continue
        for _tid, stops in trains.items():
            if not isinstance(stops, list):
                continue
            for stop in stops:
                if isinstance(stop, list) and stop:
                    n = norm_name(stop[0])
                    if n:
                        out.add(n)
    return out


def build_station_line_index(catalog):
    idx = {}
    if not isinstance(catalog, dict):
        return idx
    for st in catalog.get("stations") or []:
        n = norm_name(st.get("name"))
        if not n:
            continue
        for ln in st.get("line_names") or []:
            idx.setdefault(n, set()).add(str(ln))
    return idx


def build_station_coord_index(catalog):
    idx = {}
    if not isinstance(catalog, dict):
        return idx
    for st in catalog.get("stations") or []:
        try:
            lat = float(st.get("lat"))
            lon = float(st.get("lon"))
        except Exception:
            continue
        names = []
        n = norm_name(st.get("name"))
        if n:
            names.append(n)
        for a in st.get("aliases") or []:
            x = norm_name(a)
            if x:
                names.append(x)
        for x in names:
            if x not in idx:
                idx[x] = (lat, lon)
    return idx


def pick_direction_arrow8(direction_text, to_text, from_lat, from_lon, terminal_names, station_coord_index):
    a = text_to_arrow8(direction_text)
    if a:
        return a
    a = text_to_arrow8(to_text)
    if a:
        return a
    if from_lat is None or from_lon is None or not terminal_names:
        return ""
    vec_x = 0.0
    vec_y = 0.0
    for name in terminal_names:
        key = norm_name(name)
        tgt = station_coord_index.get(key) if key else None
        if not tgt:
            continue
        br = bearing_deg(float(from_lat), float(from_lon), float(tgt[0]), float(tgt[1]))
        rad = math.radians(br)
        vec_x += math.sin(rad)
        vec_y += math.cos(rad)
    if abs(vec_x) < 1e-9 and abs(vec_y) < 1e-9:
        return ""
    br = (math.degrees(math.atan2(vec_x, vec_y)) + 360.0) % 360.0
    return bearing_to_arrow8(br)


def detect_crossline_display(cur_line, tail_stops, station_lines_index):
    if not cur_line or not tail_stops or not station_lines_index:
        return None
    cur_line = str(cur_line)
    counts = {}
    for s in tail_stops:
        if not s:
            continue
        for ln in station_lines_index.get(norm_name(s), []):
            counts[ln] = counts.get(ln, 0) + 1
    if not counts:
        return None
    cur_cnt = counts.get(cur_line, 0)
    # pick the best other line
    best_line, best_cnt = None, 0
    for ln, cnt in counts.items():
        if ln == cur_line:
            continue
        if cnt > best_cnt or (cnt == best_cnt and best_line and ln < best_line):
            best_line, best_cnt = ln, cnt
    if best_line and best_cnt >= CROSSLINE_MIN_OTHER and best_cnt > cur_cnt:
        cur = str(cur_line)
        other = str(best_line)
        if other and other in cur:
            return cur
        return f"{cur}-{other}"
    return None


def resolve_stations(catalog, names):
    idx, out, errs, seen = catalog["name_index"], [], [], set()
    for raw in names:
        n = norm_name(raw)
        cands = list(idx.get(n, []))
        if not cands:
            for k, vals in idx.items():
                if n and (n in k or k in n):
                    cands.extend(vals)
            tmp = {}
            for c in cands:
                tmp[c["norm"]] = c
            cands = list(tmp.values())
        if not cands:
            errs.append(f"未找到站点: {raw}")
            continue
        cands.sort(key=lambda x: (x["norm"] != n, x["name"]))
        c = cands[0]
        if c["norm"] in seen:
            continue
        seen.add(c["norm"])
        out.append(c)
    return out, errs


def nearest_stations(catalog, lat, lon, threshold=300.0, max_n=8):
    ranked = []
    for st in catalog["stations"]:
        ranked.append((haversine_m(lat, lon, st["lat"], st["lon"]), st))
    ranked.sort(key=lambda x: x[0])
    if not ranked:
        return []
    min_d = ranked[0][0]
    out = []
    for d, st in ranked:
        if d <= min_d + threshold or not out:
            x = dict(st)
            x["distance_m"] = round(d, 1)
            out.append(x)
            if len(out) >= max_n:
                break
        else:
            break
    return out


def day_type(now, override="auto", cache_dir=None, holiday_source="auto", ttl=2592000, timeout=20):
    if override == "yes":
        return True, "override"
    if override == "no":
        return False, "override"
    src = str(holiday_source or "auto").lower()
    if src in ("auto", "holiday-cn"):
        if cache_dir:
            is_wd, name = holiday_cn_is_workday(cache_dir, now.date(), ttl=ttl, timeout=timeout)
            if is_wd is not None:
                return is_wd, f"holiday-cn:{name}"
    return (now.weekday() < 5), ("weekday_heuristic" if now.weekday() < 5 else "weekend_heuristic")


def pis_url(base, endpoint):
    b = str(base or "").rstrip("/")
    if b.lower().endswith("/pis"):
        return f"{b}/{endpoint}"
    return f"{b}/PIS/{endpoint}"


def call_pis(base, endpoint, payload, timeout):
    obj = post_json(pis_url(base, endpoint), payload, timeout=timeout)
    code, msg = str(obj.get("resCode", "")), str(obj.get("resMessage", ""))
    ok = code in ("0000", "00000000")
    return ok, obj.get("resData"), code, msg


def parse_train_schedules(train_schedules, is_workday):
    out = []
    if not isinstance(train_schedules, list):
        return out
    for item in train_schedules:
        if not isinstance(item, dict):
            continue
        url = str(item.get("imagePath") or "").strip()
        if not url:
            continue
        u = urllib.parse.unquote(url)
        day_label = "未知"
        if "工作日" in u:
            day_label = "工作日"
        elif "双休日" in u or "周末" in u or "节假" in u:
            day_label = "非工作日"
        m = re.search(r"-([^/\\-]+?)站方向-", u)
        direction = m.group(1) if m else ""
        matches_today = ((is_workday and day_label == "工作日") or ((not is_workday) and day_label == "非工作日"))
        out.append({
            "id": str(item.get("id") or ""),
            "line_code": str(item.get("lineCode") or ""),
            "direction": direction,
            "day_label": day_label,
            "matches_today": bool(matches_today),
            "url": url,
        })
    return out


def pick_row(rows, is_workday):
    if not isinstance(rows, list):
        return None
    def k(lbl):
        s = str(lbl or "")
        if "工作" in s: return "w"
        if "节假" in s or "周末" in s or "双休" in s: return "h"
        if "全日" in s: return "a"
        return "o"
    for r in rows:
        if isinstance(r, dict) and ((is_workday and k(r.get("day_label")) == "w") or ((not is_workday) and k(r.get("day_label")) == "h")):
            return r
    for r in rows:
        if isinstance(r, dict) and k(r.get("day_label")) == "a":
            return r
    for r in rows:
        if isinstance(r, dict):
            return r
    return None


def load_firstlast(path):
    obj = load_cached_json(path) if path and os.path.exists(path) else None
    if not isinstance(obj, dict) or not isinstance(obj.get("stations"), list):
        return {}
    out = {}
    for s in obj["stations"]:
        if isinstance(s, dict):
            n = norm_name(s.get("name"))
            if n:
                out[n] = s
    return out


def boundary_status(now, first_hhmm, last_hhmm, cutoff_hour=4):
    t1, t2 = parse_hhmm(first_hhmm), parse_hhmm(last_hhmm)
    if not t1 or not t2:
        return "unknown"
    service_day, _ = service_day_for(now, cutoff_hour=cutoff_hour)
    f = dt.datetime(service_day.year, service_day.month, service_day.day, t1[0] % 24, t1[1])
    l = dt.datetime(service_day.year, service_day.month, service_day.day, t2[0] % 24, t2[1])
    if l < f:
        l += dt.timedelta(days=1)
    if now < f:
        return "not_started"
    if now > l:
        return "ended"
    return "running"


def terminal_medals(term_counts, max_items=3):
    if not isinstance(term_counts, dict) or not term_counts:
        return []
    items = sorted(term_counts.items(), key=lambda x: (-int(x[1]), str(x[0])))
    medals = ["🥇", "🥈", "🥉"]
    out = []
    for i, (name, cnt) in enumerate(items[:max_items]):
        out.append({"name": str(name), "count": int(cnt), "medal": medals[i] if i < len(medals) else ""})
    return out


def terminal_label(terminals):
    if not terminals:
        return ""
    if len(terminals) == 1:
        name = terminals[0].get("name") or ""
        return f"{name}方向" if name else ""
    parts = [f"{t.get('medal', '')}{t.get('name', '')}".strip() for t in terminals]
    return " ".join([p for p in parts if p]) + " 方向"


def terminal_order_by_remain(trips, terminal_names):
    names = [str(x).strip() for x in terminal_names if str(x).strip()]
    if not names:
        return []
    seen = set()
    uniq = []
    for n in names:
        if n not in seen:
            seen.add(n)
            uniq.append(n)
    dist = {}
    for t in trips or []:
        if not isinstance(t, dict):
            continue
        term = str(t.get("terminal") or "").strip()
        if term not in seen:
            continue
        try:
            rv = float(t.get("remain_min"))
        except Exception:
            continue
        cur = dist.get(term)
        if cur is None or rv < cur:
            dist[term] = rv
    pos = {n: i for i, n in enumerate(uniq)}
    return sorted(uniq, key=lambda n: (dist.get(n, float("inf")), pos.get(n, 9999), n))


def build_terminals_for_next(nxt_trips, trips_all):
    next_terms = []
    for t in nxt_trips or []:
        if not isinstance(t, dict):
            continue
        nm = str(t.get("terminal") or "").strip()
        if nm and nm not in next_terms:
            next_terms.append(nm)
    # If near 4 trains all go to one terminal, skip medals.
    if len(next_terms) <= 1:
        return [], False

    ordered = terminal_order_by_remain(trips_all, next_terms)
    medals = ["🥇", "🥈", "🥉"]
    out = []
    for i, name in enumerate(ordered):
        md = medals[i] if i < len(medals) else "🏅"
        out.append({"name": name, "count": 0, "medal": md})
    return out, True


def apply_medals_to_times(trips, medals, enable=True, other_medal=""):
    if not enable or not medals:
        for t in trips:
            t["medal"] = ""
        return trips
    mm = {str(m.get("name")): str(m.get("medal") or "") for m in medals if m.get("name")}
    for t in trips:
        term = str(t.get("terminal") or "")
        if term in mm:
            t["medal"] = mm.get(term, "")
        else:
            t["medal"] = (other_medal if (other_medal and term) else "")
    return trips


def format_time_tokens(trips):
    out = []
    prev_hour = None
    for t in trips:
        medal = str(t.get("medal") or "")
        time_s = str(t.get("time") or "")
        in_min = t.get("in_min")
        if in_min is None or time_s == "":
            continue
        show_time = time_s
        m = re.match(r"^(\d{1,2}):(\d{2})$", time_s)
        if m:
            h = int(m.group(1))
            mm = m.group(2)
            if prev_hour is not None and h == prev_hour:
                show_time = mm
            else:
                show_time = f"{h:02d}:{mm}"
            prev_hour = h
        token = f"{medal}{show_time}({int(in_min)}分)"
        out.append(token)
    return " ".join(out)


def hhmm_to_service_min(hhmm, cutoff_hour=4):
    t = parse_hhmm(hhmm)
    if not t:
        return None
    h, m = t
    v = h * 60 + m
    if h < cutoff_hour:
        v += 24 * 60
    return v


def service_min_to_hhmm(v):
    if v is None:
        return None
    x = int(v) % (24 * 60)
    return f"{x // 60:02d}:{x % 60:02d}"


def summarize_station_first_last(dirs, cutoff_hour=4):
    firsts = []
    lasts = []
    for d in dirs:
        if not isinstance(d, dict):
            continue
        f = hhmm_to_service_min(d.get("first"), cutoff_hour=cutoff_hour)
        l = hhmm_to_service_min(d.get("last"), cutoff_hour=cutoff_hour)
        if f is not None:
            firsts.append(f)
        if l is not None:
            lasts.append(l)
    first = service_min_to_hhmm(min(firsts)) if firsts else None
    last = service_min_to_hhmm(max(lasts)) if lasts else None
    return first, last


def text_station(st):
    dirs = ((st.get("runtime") or {}).get("directions") or [])
    fb = st.get("fallback_first_last") or []
    first_sum, last_sum = summarize_station_first_last(dirs, cutoff_hour=4)
    if (not first_sum and not last_sum) and fb:
        tmp = []
        for r in fb:
            if not isinstance(r, dict):
                continue
            tmp.append({"first": r.get("first"), "last": r.get("last")})
        first_sum, last_sum = summarize_station_first_last(tmp, cutoff_hour=4)
    head = f"\U0001F4CD{st['name']}" + (f" \U0001F4CF{st.get('distance_m', 0):.0f}米" if st.get("distance_m") is not None else "")
    if first_sum:
        head += f" {SUNRISE_EMOJI}{first_sum}"
    if last_sum:
        head += f" {NIGHT_EMOJI}{last_sum}"
    lines = [head]
    if dirs:
        for d in dirs:
            status = str(d.get("status") or "")
            line_tag = str(d.get("line_name_display") or d.get("line_name") or "").strip()
            if status == "ended":
                to_tag = str(d.get("last_terminal") or "").strip() or str(d.get("to") or d.get("key") or "").strip()
            else:
                to_tag = str(d.get("to") or d.get("key") or "").strip()
            if to_tag.endswith("方向"):
                to_tag = to_tag[:-2].strip()
            arrow = str(d.get("arrow") or "").strip()

            row = f" 🚇{line_tag}"
            if to_tag:
                row += f" {arrow or '👉'} {to_tag}"
            p = [row]
            if d.get("full_load_rate") not in (None, "", "-"):
                p.insert(1, f"满载率:{d['full_load_rate']}")
            lines.append("；".join(p))
            if status == "ended" and d.get("last"):
                lines.append(f"  错过末班: {d.get('last')}")
            if d.get("next"):
                token_line = format_time_tokens(d["next"])
                if token_line:
                    lines.append(f"  {token_line}")
            else:
                if status == "not_started":
                    lines.append("  未到首班")
                elif status == "ended":
                    # already appended on head line
                    pass
                else:
                    lines.append("  无可用班次")
    else:
        lines.append("无可用实时时刻（可能触发 MAC 签名限制）")

    if fb:
        lines.append("本地首末班参考:")
        for r in fb:
            status = str(r.get("status") or "")
            line_name = str(r.get("line") or "?")
            direction = str(r.get("direction") or "").strip()
            if direction.endswith("方向"):
                direction = direction[:-2].strip()
            row = f" 🚇{line_name}"
            if direction:
                row += f" 👉 {direction}"
            if status == "ended":
                lines.append(row)
                lines.append(f"  错过末班: {r.get('last','?')}")
                continue
            if status == "not_started":
                lines.append(row)
                lines.append("  未到首班")
                continue
            lines.append(row)
    return "\n".join(lines)


def build_station_text_blocks(stations):
    out = []
    flat_pair_elements = []
    for st in (stations or []):
        if not isinstance(st, dict):
            continue
        full = text_station(st)
        parts = full.splitlines()
        head = parts[0] if parts else ""
        body = "\n".join(parts[1:]) if len(parts) > 1 else ""
        out.append({
            "station": str(st.get("name") or ""),
            "head": head,
            "body": body,
            "text": full,
        })
        flat_pair_elements.append(head)
        flat_pair_elements.append(body)
    return out, flat_pair_elements


def parse_args(argv):
    argv = normalize_cli_argv(argv)
    p = argparse.ArgumentParser(description="Beijing subway nearest + next departures (Shortcut/Pythonista)")
    p.add_argument("--input-json")
    p.add_argument("--input-file")
    p.add_argument("--lat", type=float)
    p.add_argument("--lon", type=float)
    p.add_argument("--station", action="append")
    p.add_argument("--threshold-m", type=float, default=300.0)
    p.add_argument("--max-stations", type=int, default=8)
    p.add_argument("--amap-key")
    p.add_argument("--allow-ip-location", action="store_true")
    p.add_argument("--pis-base", default=PIS_BASE_DEFAULT)
    p.add_argument("--pis-app2-base", default=PIS_APP2_BASE_DEFAULT)
    p.add_argument("--pis-proxy-base")
    p.add_argument("--schedule-source", choices=["auto", "boyin", "github", "none"], default="auto")
    p.add_argument("--boyin-schedule-url", default=BOYIN_SCHEDULE_URL)
    p.add_argument("--no-github-schedule", action="store_true")
    p.add_argument("--schedule-ttl-sec", type=int, default=604800)
    p.add_argument("--github-schedule-ttl-sec", type=int, default=604800)
    p.add_argument("--service-day-cutoff-hour", type=int, default=4)
    p.add_argument("--holiday-source", choices=["auto", "none", "holiday-cn"], default="auto")
    p.add_argument("--holiday-ttl-sec", type=int, default=2592000)
    p.add_argument("--cache-dir", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), ".cache"))
    p.add_argument("--cache-ttl-sec", type=int, default=86400)
    p.add_argument("--timeout", type=int, default=18)
    p.add_argument("--workday", choices=["auto","yes","no"], default="auto")
    p.add_argument("--now")
    p.add_argument("--notify", choices=["auto", "yes", "no"], default="auto")
    p.add_argument("--notify-title", default="地铁出发时刻测算")
    p.add_argument("--notify-max-chars", type=int, default=0)
    p.add_argument("--stdout-mode", choices=["text", "stations-json"], default="text")
    p.add_argument("--print-json", action="store_true")
    p.add_argument("--local-firstlast-cache", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "beijing_subway_cache.json"))
    p.add_argument("--json-only", action="store_true")
    p.add_argument("--output-json-file")
    return p.parse_args(argv)


def normalize_cli_argv(argv):
    if not isinstance(argv, list):
        return argv
    if len(argv) == 1 and isinstance(argv[0], str):
        s = argv[0].strip()
        # Shortcuts may pass all args as one string item.
        if s.startswith("-") and (" " in s or "\n" in s or "\t" in s):
            try:
                return shlex.split(s)
            except Exception:
                return [x for x in re.split(r"\s+", s) if x]
    return argv


def read_input(args):
    if args.input_json:
        try: return json.loads(args.input_json)
        except Exception: return {}
    if args.input_file:
        try:
            with open(args.input_file, "r", encoding="utf-8") as f: return json.load(f)
        except Exception: return {}
    if not sys.stdin.isatty():
        try:
            raw = sys.stdin.read().strip()
            if raw: return json.loads(raw)
        except Exception:
            pass
    return {}


def merge(args, j):
    j = j if isinstance(j, dict) else {}
    loc = j.get("location") if isinstance(j.get("location"), dict) else {}
    out = {
        "lat": args.lat if args.lat is not None else (j.get("lat") if j.get("lat") is not None else loc.get("lat")),
        "lon": args.lon if args.lon is not None else (j.get("lon") if j.get("lon") is not None else loc.get("lon")),
        "stations": [],
        "threshold_m": j.get("threshold_m", args.threshold_m),
        "max_stations": j.get("max_stations", args.max_stations),
        "amap_key": j.get("amap_key") or args.amap_key or os.getenv("AMAP_KEY") or os.getenv("AMAP_WEB_KEY"),
        "allow_ip_location": bool(j.get("allow_ip_location", args.allow_ip_location)),
        "pis_base": j.get("pis_base") or args.pis_base or os.getenv("BJ_SUBWAY_PIS_BASE") or PIS_BASE_DEFAULT,
        "pis_app2_base": j.get("pis_app2_base") or args.pis_app2_base or os.getenv("BJ_SUBWAY_PIS_APP2_BASE") or PIS_APP2_BASE_DEFAULT,
        "pis_proxy_base": j.get("pis_proxy_base") or args.pis_proxy_base or os.getenv("BJ_SUBWAY_PIS_PROXY_BASE"),
        "schedule_source": j.get("schedule_source") or args.schedule_source or os.getenv("BJ_SUBWAY_SCHEDULE_SOURCE") or "auto",
        "boyin_schedule_url": j.get("boyin_schedule_url") or args.boyin_schedule_url or os.getenv("BJ_SUBWAY_BOYIN_SCHEDULE_URL") or BOYIN_SCHEDULE_URL,
        "use_github_schedule": bool(j.get("use_github_schedule", not args.no_github_schedule)),
        "schedule_ttl_sec": int(j.get("schedule_ttl_sec", args.schedule_ttl_sec)),
        "github_schedule_ttl_sec": int(j.get("github_schedule_ttl_sec", args.github_schedule_ttl_sec)),
        "service_day_cutoff_hour": int(j.get("service_day_cutoff_hour", args.service_day_cutoff_hour)),
        "holiday_source": j.get("holiday_source") or args.holiday_source or os.getenv("BJ_SUBWAY_HOLIDAY_SOURCE") or "auto",
        "holiday_ttl_sec": int(j.get("holiday_ttl_sec", args.holiday_ttl_sec)),
        "workday": j.get("workday", args.workday),
        "notify": j.get("notify", args.notify),
        "notify_title": j.get("notify_title", args.notify_title),
        "notify_max_chars": int(j.get("notify_max_chars", args.notify_max_chars)),
        "stdout_mode": j.get("stdout_mode", args.stdout_mode),
    }
    if args.station: out["stations"].extend(args.station)
    if isinstance(j.get("station"), str): out["stations"].append(j["station"])
    if isinstance(j.get("stations"), list): out["stations"].extend([x for x in j["stations"] if isinstance(x, str)])
    out["stations"] = [x for x in out["stations"] if str(x).strip()]
    if args.now:
        try: out["now"] = dt.datetime.fromisoformat(args.now.replace("T", " "))
        except Exception: out["now"] = dt.datetime.now()
    elif j.get("now"):
        try: out["now"] = dt.datetime.fromisoformat(str(j["now"]).replace("T", " "))
        except Exception: out["now"] = dt.datetime.now()
    else:
        out["now"] = dt.datetime.now()
    return out


def main(argv):
    ensure_utf8_stdout()
    args = parse_args(argv)
    req = merge(args, read_input(args))
    now = req["now"]
    is_workday, day_src = day_type(
        now,
        req.get("workday", "auto"),
        cache_dir=args.cache_dir,
        holiday_source=req.get("holiday_source", "auto"),
        ttl=int(req.get("holiday_ttl_sec", 2592000)),
        timeout=args.timeout,
    )
    service_day, shifted = service_day_for(now, cutoff_hour=req.get("service_day_cutoff_hour", 4))
    result = {
        "ok": True,
        "generated_at": dt.datetime.now().isoformat(timespec="seconds"),
        "day_type": {"date": now.date().isoformat(), "is_workday": is_workday, "label": ("工作日" if is_workday else "非工作日"), "source": day_src, "service_day": service_day.isoformat(), "service_day_shifted": shifted},
        "input": {"lat": req.get("lat"), "lon": req.get("lon"), "stations": req.get("stations", []), "threshold_m": req.get("threshold_m"), "max_stations": req.get("max_stations"), "now": now.isoformat(sep=" ", timespec="minutes")},
        "stations": [],
        "line_congestion": None,
        "notes": [],
        "errors": [],
    }

    try:
        catalog = load_catalog(args.cache_dir, ttl=args.cache_ttl_sec, timeout=args.timeout)
        station_lines_index = build_station_line_index(catalog)
        station_coord_index = build_station_coord_index(catalog)
    except Exception as e:
        result["ok"] = False
        result["errors"].append(f"加载站点基础数据失败: {e}")
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 1

    firstlast = load_firstlast(args.local_firstlast_cache)
    schedule_by_station = {}
    sch = None
    sch_source = None
    schedule_source = str(req.get("schedule_source") or "auto").lower()
    ttl = int(req.get("schedule_ttl_sec", 604800))
    if schedule_source in ("auto", "boyin"):
        try:
            raw = load_boyin_schedule(args.cache_dir, url=req.get("boyin_schedule_url"), ttl=ttl, timeout=args.timeout)
            sch = pick_schedule_day(raw, is_workday)
            if isinstance(sch, dict):
                sch_source = "boyin_site"
        except Exception as e:
            result["notes"].append(f"BoyInTheSun 站点时刻表加载失败: {e}")
    if sch is None and schedule_source in ("auto", "github") and req.get("use_github_schedule"):
        try:
            sch_all = load_github_schedule(args.cache_dir, ttl=req.get("github_schedule_ttl_sec", 604800), timeout=args.timeout)
            sch = sch_all["weekday"] if is_workday else sch_all["weekend"]
            if isinstance(sch, dict):
                sch_source = "github_schedule"
        except Exception as e:
            result["notes"].append(f"GitHub 时刻表加载失败: {e}")

    lat, lon = req.get("lat"), req.get("lon")
    try:
        lat = float(lat) if lat is not None else None
        lon = float(lon) if lon is not None else None
    except Exception:
        lat, lon = None, None

    chosen = []
    location_source = "input"
    if req.get("stations"):
        found, errs = resolve_stations(catalog, req["stations"])
        chosen.extend(found)
        result["errors"].extend(errs)

    if not chosen:
        if lat is None or lon is None:
            p = pythonista_location()
            if p:
                lat, lon = p
                location_source = "ios"
                result["notes"].append("未提供经纬度，已使用 iOS 实时定位。")
        if (lat is None or lon is None) and req.get("allow_ip_location") and req.get("amap_key"):
            p = amap_ip_location(req.get("amap_key"), timeout=args.timeout)
            if p:
                lat, lon = p
                location_source = "amap_ip"
                result["notes"].append("未提供经纬度，已使用高德 IP 定位。")
        if lat is None or lon is None:
            result["ok"] = False
            result["errors"].append("未提供经纬度或站点名称")
        else:
            adj_lat, adj_lon, coord_mode = auto_align_coord_for_catalog(
                catalog,
                lat,
                lon,
                prefer_gcj=(location_source == "ios"),
            )
            if coord_mode != "raw":
                lat, lon = adj_lat, adj_lon
                result["notes"].append("定位坐标已自动从 WGS84 校正为 GCJ02，以匹配地铁站坐标系。")
            chosen = nearest_stations(catalog, lat, lon, threshold=req.get("threshold_m", 300.0), max_n=req.get("max_stations", 8))
            if not chosen:
                result["ok"] = False
                result["errors"].append("未找到附近站点")
    elif lat is not None and lon is not None:
        # Station-specified path: still compute distance to keep output consistent.
        for st in chosen:
            try:
                if st.get("distance_m") is None:
                    st["distance_m"] = round(haversine_m(lat, lon, float(st["lat"]), float(st["lon"])), 1)
            except Exception:
                pass

    if chosen and isinstance(sch, dict):
        schedule_by_station = collect_schedule_for_stations(sch, [s["norm"] for s in chosen])

    for st in chosen:
        item = {
            "name": st["name"],
            "norm": st["norm"],
            "lat": st.get("lat"),
            "lon": st.get("lon"),
            "distance_m": st.get("distance_m"),
            "line_names": st.get("line_names", []),
            "station_ids": st.get("station_ids", []),
            "device_locations": st.get("device_locations", []),
            "runtime": {"directions": []},
            "fallback_first_last": [],
        }

        sch_rows = schedule_by_station.get(st["norm"]) if schedule_by_station else None
        if isinstance(sch_rows, dict):
            for (line_name, direction), cell in sch_rows.items():
                minutes = [int(m) for m in (cell.get("minutes") or []) if isinstance(m, (int, float)) or str(m).isdigit()]
                minutes.sort()
                trips = cell.get("trips") or []
                first = last = None
                if minutes:
                    first = hhmm_str((minutes[0] // 60) % 24, minutes[0] % 60)
                    last = hhmm_str((minutes[-1] // 60) % 24, minutes[-1] % 60)
                status = boundary_status(now, first, last, cutoff_hour=req.get("service_day_cutoff_hour", 4)) if (first and last) else "unknown"

                nxt_trips = []
                tails = []
                trips_sorted = sorted([t for t in trips if isinstance(t, dict) and t.get("minute") is not None], key=lambda x: x.get("minute", 0))
                last_terminal = ""
                for t in reversed(trips_sorted):
                    term = str(t.get("terminal") or "").strip()
                    if term:
                        last_terminal = term
                        break
                for t in trips_sorted:
                    try:
                        minute = int(t.get("minute"))
                    except Exception:
                        continue
                    dtv = dt.datetime(service_day.year, service_day.month, service_day.day) + dt.timedelta(minutes=minute)
                    if dtv >= now:
                        nxt_trips.append({"time": dtv.strftime("%H:%M"), "in_min": int(round((dtv - now).total_seconds() / 60.0)), "terminal": t.get("terminal")})
                        if not tails and t.get("tail"):
                            tails = t.get("tail") or []
                        if len(nxt_trips) >= 4:
                            break
                if not nxt_trips and minutes:
                    for m in minutes:
                        dtv = dt.datetime(service_day.year, service_day.month, service_day.day) + dt.timedelta(minutes=int(m))
                        if dtv >= now:
                            nxt_trips.append({"time": dtv.strftime("%H:%M"), "in_min": int(round((dtv - now).total_seconds() / 60.0)), "terminal": ""})
                            if len(nxt_trips) >= 4:
                                break

                terms, enable_medals = build_terminals_for_next(nxt_trips, trips_sorted)
                apply_medals_to_times(nxt_trips, terms, enable=enable_medals, other_medal=("🏅" if enable_medals else ""))
                if enable_medals:
                    to_label = terminal_label(terms)
                else:
                    single_next_terminal = ""
                    for tt in nxt_trips:
                        nm = str(tt.get("terminal") or "").strip()
                        if nm:
                            single_next_terminal = nm
                            break
                    to_label = (f"{single_next_terminal}方向" if single_next_terminal else str(direction or "unknown"))
                tail_stops = tails or (trips_sorted[0].get("tail") if trips_sorted else []) or []
                line_name_display = detect_crossline_display(line_name, tail_stops, station_lines_index) or line_name
                term_names = [str(x.get("name") or "").strip() for x in terms if isinstance(x, dict) and x.get("name")]
                arrow = pick_direction_arrow8(
                    direction,
                    to_label,
                    st.get("lat"),
                    st.get("lon"),
                    term_names,
                    station_coord_index,
                )

                item["runtime"]["directions"].append({
                    "line_name": str(line_name or ""),
                    "line_name_display": str(line_name_display or line_name or ""),
                    "direction": str(direction or ""),
                    "key": str(direction or "unknown"),
                    "to": to_label,
                    "next": nxt_trips,
                    "status": status,
                    "first": first,
                    "last": last,
                    "full_load_rate": None,
                    "timetable_images": [],
                    "source": sch_source or "schedule",
                    "terminals": terms,
                    "last_terminal": last_terminal,
                    "arrow": arrow,
                })

        if item["runtime"]["directions"]:
            item["runtime"]["directions"] = sort_runtime_directions_clockwise(item["runtime"]["directions"])

        if not item["runtime"]["directions"]:
            fb = firstlast.get(st["norm"]) if isinstance(firstlast, dict) else None
            if isinstance(fb, dict):
                for s in fb.get("schedules") or []:
                    if not isinstance(s, dict):
                        continue
                    row = pick_row(s.get("rows"), is_workday)
                    if not row:
                        continue
                    first = str(row.get("first") or "").strip()
                    last = str(row.get("last") or "").strip()
                    if first or last:
                        item["fallback_first_last"].append({
                            "line": str(s.get("line") or ""),
                            "direction": str(s.get("direction") or ""),
                            "day_label": str(row.get("day_label") or ""),
                            "first": first or None,
                            "last": last or None,
                            "status": boundary_status(now, first, last, cutoff_hour=req.get("service_day_cutoff_hour", 4)),
                        })
                if item["fallback_first_last"]:
                    item["fallback_first_last"] = sort_fallback_directions_clockwise(item["fallback_first_last"])

        result["stations"].append(item)

    station_elements, station_pair_elements = build_station_text_blocks(result["stations"])
    result["station_text_elements"] = station_elements
    result["station_pair_elements"] = station_pair_elements

    if args.output_json_file:
        try:
            with open(args.output_json_file, "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
        except Exception as e:
            result["errors"].append(f"写出 JSON 文件失败: {e}")

    if args.json_only:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if result.get("ok") else 1

    lines = [x.get("text", "") for x in station_elements if isinstance(x, dict) and x.get("text")]
    if result["errors"]:
        lines.append("\n错误/警告:")
        lines.extend([f"- {x}" for x in result["errors"]])
    text_out = "\n".join(lines).strip()

    stdout_mode = str(req.get("stdout_mode") or "text").strip().lower()
    if stdout_mode == "stations-json":
        print(json.dumps(station_pair_elements, ensure_ascii=False, indent=2))
    else:
        print(text_out)
    notify = normalize_notify(req.get("notify"), default="auto")
    should_notify = (notify == "yes") or (notify == "auto" and (is_pythonista() or is_pyto()))
    if args.json_only:
        should_notify = False
    if should_notify:
        title = req.get("notify_title") or "地铁出发时刻测算"
        if not re.search(r"\b\d{1,2}:\d{2}\b", str(title)):
            title = f"{title} \u23F0{now.strftime('%H:%M')}"
        max_chars = req.get("notify_max_chars")
        body = truncate_text(text_out, max_chars) if max_chars is not None else text_out
        send_notification(title, body)
    if args.print_json:
        print("\n--- JSON ---")
        print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

