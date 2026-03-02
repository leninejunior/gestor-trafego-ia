#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"

if [ ! -f "$ENV_FILE" ]; then
  echo "[ssl-issue] erro: arquivo ${ENV_FILE} nao encontrado." >&2
  exit 1
fi

SSL_DOMAIN="$(grep -E '^SSL_DOMAIN=' "$ENV_FILE" | head -n 1 | cut -d= -f2-)"
SSL_EMAIL="$(grep -E '^SSL_EMAIL=' "$ENV_FILE" | head -n 1 | cut -d= -f2-)"

if [ -z "${SSL_DOMAIN:-}" ]; then
  echo "[ssl-issue] erro: defina SSL_DOMAIN em ${ENV_FILE}." >&2
  exit 1
fi

if [ -z "${SSL_EMAIL:-}" ]; then
  echo "[ssl-issue] erro: defina SSL_EMAIL em ${ENV_FILE}." >&2
  exit 1
fi

mkdir -p certbot/conf certbot/www

echo "[ssl-issue] subindo app/proxy em modo HTTP para desafio ACME..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d app proxy

echo "[ssl-issue] emitindo certificado Let\\'s Encrypt para ${SSL_DOMAIN}..."
docker run --rm \
  -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/certbot/www:/var/www/certbot" \
  certbot/certbot:latest certonly \
    --webroot -w /var/www/certbot \
    -d "$SSL_DOMAIN" \
    --email "$SSL_EMAIL" \
    --agree-tos \
    --no-eff-email \
    --rsa-key-size 4096

echo "[ssl-issue] reiniciando proxy para carregar certificado..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" restart proxy

echo "[ssl-issue] concluido. Teste: https://${SSL_DOMAIN}/api/health"
