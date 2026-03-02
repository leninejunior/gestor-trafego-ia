#!/usr/bin/env sh
set -eu

SSL_DOMAIN="${SSL_DOMAIN:-edith.engrene.com}"
CERT_PATH="/etc/letsencrypt/live/${SSL_DOMAIN}/fullchain.pem"
KEY_PATH="/etc/letsencrypt/live/${SSL_DOMAIN}/privkey.pem"
OUTPUT_CONF="/etc/nginx/conf.d/default.conf"

if [ -f "$CERT_PATH" ] && [ -f "$KEY_PATH" ]; then
  TEMPLATE="/etc/nginx/conf-templates/production.ssl.conf"
  echo "[nginx-entrypoint] SSL certificate found for ${SSL_DOMAIN}. Starting with HTTPS."
else
  TEMPLATE="/etc/nginx/conf-templates/production.http.conf"
  echo "[nginx-entrypoint] SSL certificate not found for ${SSL_DOMAIN}. Starting with HTTP only."
fi

sed "s|__SERVER_NAME__|${SSL_DOMAIN}|g" "$TEMPLATE" >"$OUTPUT_CONF"

exec nginx -g "daemon off;"
