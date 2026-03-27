#!/usr/bin/env bash
set -euo pipefail

TARGET_PATH="${1:-.}"
ACCESS_LOG="${2:-}"
OUT_DIR="${3:-./security-artifacts}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p "$OUT_DIR"

echo "[1/4] Scanning for exposed secrets"
python3 "$SCRIPT_DIR/scan_exposed_secrets.py" \
  --path "$TARGET_PATH" \
  --format text \
  --output "$OUT_DIR/secrets-report.json"

if [[ -n "$ACCESS_LOG" && -f "$ACCESS_LOG" ]]; then
  echo "[2/4] Analyzing access log patterns"
  python3 "$SCRIPT_DIR/analyze_access_patterns.py" \
    --log-file "$ACCESS_LOG" \
    --format text \
    --output "$OUT_DIR/access-report.json"
else
  echo "[2/4] Skipping access log analysis (file not provided)"
fi

echo "[3/4] Applying security gate"
GATE_ARGS=(
  --report "$OUT_DIR/secrets-report.json"
)
if [[ -f "$OUT_DIR/access-report.json" ]]; then
  GATE_ARGS+=(--report "$OUT_DIR/access-report.json")
fi

set +e
python3 "$SCRIPT_DIR/security_gate.py" \
  "${GATE_ARGS[@]}" \
  --max-critical 0 \
  --max-high 0 \
  --max-medium 3 \
  --output "$OUT_DIR/gate-report.json"
GATE_EXIT=$?
set -e

echo "[4/4] Finished. Artifacts at: $OUT_DIR"
exit "$GATE_EXIT"
