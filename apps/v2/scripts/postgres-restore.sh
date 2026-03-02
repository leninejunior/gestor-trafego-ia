#!/usr/bin/env sh
set -eu

normalize_database_url() {
  input_url="$1"
  normalized_url="$(printf '%s' "$input_url" | sed -E 's/([?&])schema=[^&]*&?/\1/g')"
  normalized_url="$(printf '%s' "$normalized_url" | sed -E 's/\?&/\?/g; s/[?&]$//')"
  printf '%s' "$normalized_url"
}

BACKUP_FILE="${BACKUP_FILE:-${1:-}}"
TARGET_DATABASE_URL="${TARGET_DATABASE_URL:-${DATABASE_URL:-}}"
RESTORE_DROP_SCHEMA="${RESTORE_DROP_SCHEMA:-false}"

if [ -z "$BACKUP_FILE" ]; then
  echo "[restore] erro: informe o arquivo de backup via argumento ou BACKUP_FILE." >&2
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "[restore] erro: arquivo de backup nao encontrado: $BACKUP_FILE" >&2
  exit 1
fi

if [ -z "$TARGET_DATABASE_URL" ]; then
  echo "[restore] erro: defina TARGET_DATABASE_URL ou DATABASE_URL." >&2
  exit 1
fi

NORMALIZED_TARGET_URL="$(normalize_database_url "$TARGET_DATABASE_URL")"

echo "[restore] iniciando restore de ${BACKUP_FILE}"
echo "[restore] destino: ${NORMALIZED_TARGET_URL}"

if [ "$RESTORE_DROP_SCHEMA" = "true" ]; then
  echo "[restore] removendo schema public antes da restauracao..."
  PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-10}" psql \
    "$NORMALIZED_TARGET_URL" \
    -v ON_ERROR_STOP=1 \
    -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
fi

PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-10}" pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname="$NORMALIZED_TARGET_URL" \
  "$BACKUP_FILE"

echo "[restore] restauracao concluida com sucesso."
