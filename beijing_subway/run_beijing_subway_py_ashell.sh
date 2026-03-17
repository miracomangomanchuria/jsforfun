#!/bin/sh
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
#   LON=116.3198 LAT=39.9288 sh run_beijing_subway_py_ashell.sh
#   FORCE_PULL=1 sh run_beijing_subway_py_ashell.sh
#   AUTO_PULL_DAYS=7 sh run_beijing_subway_py_ashell.sh

set -eu

# ===== User editable vars =====
LON="${LON:-116.3198}"
LAT="${LAT:-39.9288}"

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

# Positional override (optional): sh run_beijing_subway_py_ashell.sh <lon> <lat>
if [ "${1:-}" != "" ] && [ "${2:-}" != "" ]; then
  LON="$1"
  LAT="$2"
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

exec python3 "$PY_PATH" \
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
  --stdout-mode text
