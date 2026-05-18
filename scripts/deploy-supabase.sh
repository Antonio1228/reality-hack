#!/usr/bin/env bash
set -euo pipefail

SUPABASE_ENV_PATH="${SUPABASE_ENV_PATH:-./.env}"
OPENAI_ENV_PATH="${OPENAI_ENV_PATH:-../child/.env}"

get_env_value() {
  local file="$1"
  local name="$2"
  if [[ ! -f "$file" ]]; then
    echo ""
    return
  fi
  grep -E "^[[:space:]]*${name}[[:space:]]*=" "$file" | head -n 1 | sed -E "s/^[^=]+=//; s/^['\"]//; s/['\"]$//"
}

supabase_url="$(get_env_value "$SUPABASE_ENV_PATH" "EXPO_PUBLIC_SUPABASE_URL")"
if [[ -z "$supabase_url" ]]; then
  function_url="$(get_env_value "$SUPABASE_ENV_PATH" "EXPO_PUBLIC_SUPABASE_FUNCTION_URL")"
  if [[ -n "$function_url" ]]; then
    supabase_url="$(python - <<PY
from urllib.parse import urlparse
print("https://" + urlparse("$function_url").hostname)
PY
)"
  fi
fi

openai_key="$(get_env_value "$OPENAI_ENV_PATH" "OPENAI_API_KEY")"
openai_model="$(get_env_value "$OPENAI_ENV_PATH" "OPENAI_MODEL")"
openai_model="${openai_model:-gpt-5-mini}"

if [[ -z "$supabase_url" ]]; then
  echo "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_FUNCTION_URL in $SUPABASE_ENV_PATH" >&2
  exit 1
fi

if [[ -z "$openai_key" ]]; then
  echo "Missing OPENAI_API_KEY in $OPENAI_ENV_PATH" >&2
  exit 1
fi

project_ref="$(python - <<PY
from urllib.parse import urlparse
print(urlparse("$supabase_url").hostname.split(".")[0])
PY
)"

secret_file="$(mktemp)"
trap 'rm -f "$secret_file"' EXIT
printf 'OPENAI_API_KEY=%s\nOPENAI_MODEL=%s\n' "$openai_key" "$openai_model" > "$secret_file"

echo "Using Supabase project ref: $project_ref"
echo "Setting Supabase function secrets without printing secret values..."
npx supabase secrets set --env-file "$secret_file" --project-ref "$project_ref"

echo "Deploying generate-reality-mission function..."
npx supabase functions deploy generate-reality-mission --project-ref "$project_ref"
echo "Done."
