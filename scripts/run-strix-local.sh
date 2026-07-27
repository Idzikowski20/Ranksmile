#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"

REPO="/mnt/c/Users/patry/Desktop/Ranksmile"
ENVF="$REPO/.env.local"
LOGDIR="$REPO/strix_runs"
mkdir -p "$LOGDIR"

while IFS= read -r line || [ -n "$line" ]; do
  line="${line%$'\r'}"
  case "$line" in
    ANTHROPIC_API_KEY=*) export ANTHROPIC_API_KEY="${line#ANTHROPIC_API_KEY=}" ;;
    DEEPSEEK_API_KEY=*) export DEEPSEEK_API_KEY="${line#DEEPSEEK_API_KEY=}" ;;
  esac
done < "$ENVF"

if [ -n "${DEEPSEEK_API_KEY:-}" ]; then
  export STRIX_LLM="${STRIX_LLM:-deepseek/deepseek-v4-flash}"
  export LLM_API_KEY="$DEEPSEEK_API_KEY"
  echo "LLM=$STRIX_LLM"
elif [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  export STRIX_LLM="${STRIX_LLM:-anthropic/claude-sonnet-4-6}"
  export LLM_API_KEY="$ANTHROPIC_API_KEY"
  echo "LLM=$STRIX_LLM"
else
  echo "NO_LLM_KEY"
  exit 1
fi

SCAN_MODE="${STRIX_SCAN_MODE:-standard}"
MAX_BUDGET="${STRIX_MAX_BUDGET:-20}"
MAX_TURNS="${STRIX_MAX_TURNS:-200}"

INSTRUCTION_FILE="$REPO/docs/strix-instruction.md"
if [ -n "${STRIX_TEST_EMAIL:-}" ] && [ -n "${STRIX_TEST_PASSWORD:-}" ]; then
  AUTH_FILE=$(mktemp)
  {
    cat "$INSTRUCTION_FILE"
    echo
    echo "## Authenticated testing"
    echo "Sign-in URL: https://ranksmile.pl/auth/sign-in"
    echo "Use these credentials for authenticated grey-box testing:"
    echo "Email: $STRIX_TEST_EMAIL"
    echo "Password: $STRIX_TEST_PASSWORD"
    echo "After login, verify tenant isolation on /api/notify and /api/cron; probe IDOR across domains/articles."
  } > "$AUTH_FILE"
  INSTRUCTION_FILE="$AUTH_FILE"
  trap 'rm -f "$AUTH_FILE"' EXIT
fi

cd "$REPO"
echo "Starting Strix ($SCAN_MODE, max-budget ${MAX_BUDGET} USD)..."
exec strix -n \
  -t "https://ranksmile.pl" \
  --mount "$REPO" \
  --instruction-file "$INSTRUCTION_FILE" \
  -m "$SCAN_MODE" \
  --max-budget "$MAX_BUDGET" \
  --max-turns "$MAX_TURNS" \
  2>&1 | tee "$LOGDIR/local-launch.log"
