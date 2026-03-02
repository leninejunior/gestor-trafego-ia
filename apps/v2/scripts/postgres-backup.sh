#!/usr/bin/env sh
set -eu

normalize_database_url() {
  input_url="$1"
  normalized_url="$(printf '%s' "$input_url" | sed -E 's/([?&])schema=[^&]*&?/\1/g')"
  normalized_url="$(printf '%s' "$normalized_url" | sed -E 's/\?&/\?/g; s/[?&]$//')"
  printf '%s' "$normalized_url"
}

now_utc() {
  date -u +"%Y%m%dT%H%M%SZ"
}

BACKUP_DATABASE_URL="${BACKUP_DATABASE_URL:-${DATABASE_URL:-}}"
if [ -z "$BACKUP_DATABASE_URL" ]; then
  echo "[backup] erro: defina BACKUP_DATABASE_URL ou DATABASE_URL" >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-$(pwd)/backups/postgres}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
BACKUP_DB_NAME="${BACKUP_DB_NAME:-flying_fox_v2}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(now_utc)"
BACKUP_FILE="$BACKUP_DIR/${BACKUP_DB_NAME}_${TIMESTAMP}.dump"
TMP_BACKUP_FILE="${BACKUP_FILE}.tmp"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
LATEST_POINTER_FILE="$BACKUP_DIR/latest_backup_path.txt"

NORMALIZED_URL="$(normalize_database_url "$BACKUP_DATABASE_URL")"

cleanup_partial_backup() {
  rm -f "$TMP_BACKUP_FILE"
}

trap cleanup_partial_backup INT TERM HUP EXIT

echo "[backup] iniciando backup para ${BACKUP_FILE}"
PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-10}" pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --dbname="$NORMALIZED_URL" \
  --file="$TMP_BACKUP_FILE"

mv "$TMP_BACKUP_FILE" "$BACKUP_FILE"
trap - INT TERM HUP EXIT

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$BACKUP_FILE" | awk '{print $1}' >"$CHECKSUM_FILE"
elif command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$BACKUP_FILE" | awk '{print $1}' >"$CHECKSUM_FILE"
else
  echo "[backup] aviso: nenhuma ferramenta de SHA256 encontrada (sha256sum/shasum)." >&2
fi

printf '%s\n' "$BACKUP_FILE" >"$LATEST_POINTER_FILE"

case "$BACKUP_RETENTION_DAYS" in
  ''|*[!0-9]*)
    echo "[backup] aviso: BACKUP_RETENTION_DAYS invalido (${BACKUP_RETENTION_DAYS}), pulando limpeza." >&2
    ;;
  *)
    if [ "$BACKUP_RETENTION_DAYS" -gt 0 ]; then
      THRESHOLD_DAYS=$((BACKUP_RETENTION_DAYS - 1))
      find "$BACKUP_DIR" -maxdepth 1 -type f -name "*.dump" -mtime +"$THRESHOLD_DAYS" -print | while IFS= read -r old_backup; do
        rm -f "$old_backup" "${old_backup}.sha256"
      done
    fi
    ;;
esac

echo "[backup] concluido com sucesso: ${BACKUP_FILE}"
