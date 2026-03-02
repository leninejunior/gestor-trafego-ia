#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"

if [ ! -f "$ENV_FILE" ]; then
  echo "[ssl-renew] erro: arquivo ${ENV_FILE} nao encontrado." >&2
  exit 1
fi

mkdir -p certbot/conf certbot/www

echo "[ssl-renew] renovando certificados..."
docker run --rm \
  -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/certbot/www:/var/www/certbot" \
  certbot/certbot:latest renew \
    --webroot -w /var/www/certbot \
    --quiet

echo "[ssl-renew] reiniciando proxy para carregar certificado renovado..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" restart proxy

echo "[ssl-renew] concluido."
