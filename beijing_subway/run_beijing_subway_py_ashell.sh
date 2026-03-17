#!/usr/bin/sh
# a-Shell launcher for beijing_subway_shortcut.py
#
# Behavior:
# - Default: do NOT pull from GitHub every run.
# - Pull only when local py file is missing.
# - Force pull when FORCE_PULL=1.
# - Optional periodic pull when AUTO_PULL_DAYS>0.
#
# Examples:
#   sh run_beijing_subway_py_ashell.sh
#   sh run_beijing_subway_py_ashell.sh YOUR_LON YOUR_LAT
#   export FORCE_PULL=1; sh run_beijing_subway_py_ashell.sh YOUR_LON YOUR_LAT
#   export AUTO_PULL_DAYS=7; sh run_beijing_subway_py_ashell.sh YOUR_LON YOUR_LAT

set -eu

# ===== User editable vars =====
LON="${LON:-}"
LAT="${LAT:-}"

# GitHub raw URL for Python main script:
SCRIPT_URL="${SCRIPT_URL:-https://raw.githubusercontent.com/miracomangomanchuria/jsforfun/main/beijing_subway/beijing_subway_shortcut.py}"

# Local persisted script path:
PY_PATH="${PY_PATH:-$HOME/Documents/beijing_subway_shortcut.py}"

# Pull strategy:
FORCE_PULL="${FORCE_PULL:-0}"        # 1 => always pull before run
AUTO_PULL_DAYS="${AUTO_PULL_DAYS:-0}"  # 0 => disabled

# Runtime params:
CACHE_DIR="${CACHE_DIR:-$HOME/Documents/beijing_subway_cache}"
THRESHOLD_M="${THRESHOLD_M:-300}"
MAX_STATIONS="${MAX_STATIONS:-8}"
TIMEOUT_SEC="${TIMEOUT_SEC:-18}"
SERVICE_CUTOFF_HOUR="${SERVICE_CUTOFF_HOUR:-4}"
AMAP_KEY="${AMAP_KEY:-}"
IP_GEO_FALLBACK="${IP_GEO_FALLBACK:-1}"   # 1 => when no lon/lat, try rough IP geolocation

# Positional override (optional): sh run_beijing_subway_py_ashell.sh <lon> <lat>
if [ "${1:-}" != "" ] && [ "${2:-}" != "" ]; then
  LON="$1"
  LAT="$2"
fi

resolve_ip_geo() {
  # output: "<lon> <lat>"
  if [ -n "$AMAP_KEY" ]; then
    amap_url="https://restapi.amap.com/v3/ip?key=$AMAP_KEY"
    body="$(curl -fsSL --connect-timeout 8 --max-time 12 "$amap_url" 2>/dev/null || true)"
    if [ -n "$body" ]; then
      out="$(JSON_BODY="$body" python3 - <<'PY'
import json, os
raw = os.environ.get("JSON_BODY", "")
try:
    obj = json.loads(raw)
except Exception:
    print("")
    raise SystemExit
if str(obj.get("status")) != "1":
    print("")
    raise SystemExit
rect = str(obj.get("rectangle") or "")
if ";" not in rect:
    print("")
    raise SystemExit
try:
    a, b = rect.split(";", 1)
    lon1, lat1 = [float(x) for x in a.split(",", 1)]
    lon2, lat2 = [float(x) for x in b.split(",", 1)]
    lon = (lon1 + lon2) / 2.0
    lat = (lat1 + lat2) / 2.0
    if -180 <= lon <= 180 and -90 <= lat <= 90:
        print(f"{lon} {lat}")
    else:
        print("")
except Exception:
    print("")
PY
)"
      if [ -n "$out" ]; then
        printf '%s\n' "$out"
        return 0
      fi
    fi
  fi

  for u in \
    "https://ipapi.co/json/" \
    "https://ipwho.is/" \
    "https://ipinfo.io/json"
  do
    body="$(curl -fsSL --connect-timeout 8 --max-time 12 "$u" 2>/dev/null || true)"
    [ -n "$body" ] || continue
    out="$(JSON_BODY="$body" python3 - <<'PY'
import json, os
raw = os.environ.get("JSON_BODY", "")
try:
    obj = json.loads(raw)
except Exception:
    print("")
    raise SystemExit

def emit(lon, lat):
    try:
        lon = float(lon); lat = float(lat)
    except Exception:
        return False
    if -180 <= lon <= 180 and -90 <= lat <= 90:
        print(f"{lon} {lat}")
        return True
    return False

if isinstance(obj, dict):
    if emit(obj.get("longitude"), obj.get("latitude")): raise SystemExit
    if emit(obj.get("lon"), obj.get("lat")): raise SystemExit
    loc = obj.get("loc")
    if isinstance(loc, str) and "," in loc:
        a, b = loc.split(",", 1)  # ipinfo: lat,lon
        if emit(b, a): raise SystemExit
print("")
PY
)"
    if [ -n "$out" ]; then
      printf '%s\n' "$out"
      return 0
    fi
  done
  return 1
}

geo_source="manual"
if [ -z "$LON" ] || [ -z "$LAT" ]; then
  if [ "$IP_GEO_FALLBACK" = "1" ]; then
    if ! command -v curl >/dev/null 2>&1; then
      echo "ERROR: 缺少经纬度，且 curl 不可用，无法做 IP 粗定位。"
      exit 1
    fi
    if ! command -v python3 >/dev/null 2>&1; then
      echo "ERROR: 缺少经纬度，且 python3 不可用，无法做 IP 粗定位。"
      exit 1
    fi
    loc="$(resolve_ip_geo || true)"
    if [ -n "$loc" ]; then
      LON="$(printf '%s' "$loc" | awk '{print $1}')"
      LAT="$(printf '%s' "$loc" | awk '{print $2}')"
      geo_source="ip"
      echo "INFO: 未传经纬度，已使用IP粗定位。lon=$LON lat=$LAT"
    fi
  fi
fi

if [ -z "$LON" ] || [ -z "$LAT" ]; then
  echo "ERROR: 缺少经纬度，且 IP 反查失败。"
  echo "示例: export LON=YOUR_LON; export LAT=YOUR_LAT; sh run_beijing_subway_py_ashell.sh"
  echo "示例: sh run_beijing_subway_py_ashell.sh YOUR_LON YOUR_LAT"
  echo "可选: 设置 AMAP_KEY 提升中国大陆 IP 定位可用性。"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 not found."
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl not found."
  exit 1
fi

mkdir -p "$(dirname "$PY_PATH")" "$CACHE_DIR"

need_pull=0
reason=""

if [ ! -f "$PY_PATH" ]; then
  need_pull=1
  reason="missing local py"
fi

if [ "$FORCE_PULL" = "1" ]; then
  need_pull=1
  reason="force pull"
fi

if [ "$need_pull" -eq 0 ] && [ "${AUTO_PULL_DAYS:-0}" -gt 0 ] 2>/dev/null; then
  if [ -f "$PY_PATH" ]; then
    age_days="$(python3 - "$PY_PATH" <<'PY'
import os, sys, time
p = sys.argv[1]
try:
    m = os.path.getmtime(p)
    print(int((time.time() - m) // 86400))
except Exception:
    print(999999)
PY
)"
    if [ "$age_days" -ge "$AUTO_PULL_DAYS" ] 2>/dev/null; then
      need_pull=1
      reason="age ${age_days}d >= ${AUTO_PULL_DAYS}d"
    fi
  fi
fi

if [ "$need_pull" -eq 1 ]; then
  echo "Pulling py script: $reason"
  tmp="${PY_PATH}.tmp.$$"
  if ! curl -fsSL --connect-timeout 10 --max-time 60 "$SCRIPT_URL" -o "$tmp"; then
    rm -f "$tmp" >/dev/null 2>&1 || true
    echo "ERROR: failed to download script from:"
    echo "  $SCRIPT_URL"
    exit 1
  fi
  mv "$tmp" "$PY_PATH"
  echo "Updated: $PY_PATH"
else
  echo "Using local py: $PY_PATH"
fi

set +e
output="$(
  python3 "$PY_PATH" \
    --lon "$LON" \
    --lat "$LAT" \
    --threshold-m "$THRESHOLD_M" \
    --max-stations "$MAX_STATIONS" \
    --service-day-cutoff-hour "$SERVICE_CUTOFF_HOUR" \
    --schedule-source github \
    --holiday-source auto \
    --cache-dir "$CACHE_DIR" \
    --schedule-ttl-sec 604800 \
    --github-schedule-ttl-sec 604800 \
    --holiday-ttl-sec 2592000 \
    --timeout "$TIMEOUT_SEC" \
    --notify no \
    --stdout-mode text 2>&1
)"
status=$?
set -e

if [ "$status" -ne 0 ]; then
  printf '%s\n' "$output"
  exit "$status"
fi

if [ "$geo_source" = "ip" ]; then
  output="$(INPUT_TEXT="$output" python3 - <<'PY'
import os, re
s = os.environ.get("INPUT_TEXT", "")
s = re.sub(r"📏(?!约)(\d+(?:\.\d+)?)米", r"📏约\1米", s)
print(s, end="")
PY
)"
fi

printf '%s\n' "$output"
