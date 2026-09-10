#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:-2pbox.com.br}"
WWW_DOMAIN="www.${DOMAIN}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
NETWORK="2pbox-net"
WEB_PORT="${WEB_PORT:-5710}"
RABBIT_PORT="${RABBIT_PORT:-5712}"
RABBIT_UI_PORT="${RABBIT_UI_PORT:-5713}"
REDIS_PORT="${REDIS_PORT:-5714}"
RABBITMQ_USER="${RABBITMQ_USER:-2pbox}"
RABBITMQ_PASS="${RABBITMQ_PASS:?RABBITMQ_PASS é obrigatório}"
REDIS_PASS="${REDIS_PASS:?REDIS_PASS é obrigatório}"

log() { printf '\n\033[1;33m[2pbox]\033[0m %s\n' "$1"; }

log "Rede dedicada ${NETWORK}"
docker network inspect "$NETWORK" >/dev/null 2>&1 || docker network create "$NETWORK"

log "Volumes dedicados"
docker volume inspect 2pbox-rabbitmq-data >/dev/null 2>&1 || docker volume create 2pbox-rabbitmq-data
docker volume inspect 2pbox-redis-data >/dev/null 2>&1 || docker volume create 2pbox-redis-data

ensure_container() {
  local name="$1"
  shift
  if docker ps -a --format '{{.Names}}' | grep -qx "$name"; then
    if docker ps --format '{{.Names}}' | grep -qx "$name"; then
      log "${name} já em execução"
      return
    fi
    log "Reiniciando ${name}"
    docker start "$name"
    return
  fi
  log "Criando ${name}"
  docker run -d --name "$name" "$@"
}

ensure_container 2pbox-rabbitmq \
  --network "$NETWORK" \
  --restart unless-stopped \
  -p "127.0.0.1:${RABBIT_PORT}:5672" \
  -p "127.0.0.1:${RABBIT_UI_PORT}:15672" \
  -e RABBITMQ_DEFAULT_USER="$RABBITMQ_USER" \
  -e RABBITMQ_DEFAULT_PASS="$RABBITMQ_PASS" \
  -e RABBITMQ_DEFAULT_VHOST=/ \
  -v 2pbox-rabbitmq-data:/var/lib/rabbitmq \
  --health-cmd="rabbitmq-diagnostics -q ping" \
  --health-interval=30s \
  --health-timeout=10s \
  --health-retries=5 \
  rabbitmq:3.13-management-alpine

ensure_container 2pbox-redis \
  --network "$NETWORK" \
  --restart unless-stopped \
  -p "127.0.0.1:${REDIS_PORT}:6379" \
  -v 2pbox-redis-data:/data \
  --health-cmd="redis-cli -a ${REDIS_PASS} ping | grep -q PONG" \
  --health-interval=30s \
  --health-timeout=10s \
  --health-retries=5 \
  redis:7-alpine \
  redis-server --requirepass "$REDIS_PASS" --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru

log "Aguardando RabbitMQ ficar saudável"
for _ in $(seq 1 30); do
  if docker exec 2pbox-rabbitmq rabbitmq-diagnostics -q ping >/dev/null 2>&1; then
    log "RabbitMQ pronto"
    break
  fi
  sleep 3
done

setup_https() {
  if ! command -v nginx >/dev/null 2>&1; then
    if ss -ltnp 2>/dev/null | grep -qE ':(80|443)\s'; then
      log "AVISO: portas 80/443 já estão em uso por outro serviço. Configure o proxy manualmente para 127.0.0.1:${WEB_PORT}."
      return
    fi
    log "Instalando nginx e certbot"
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq nginx certbot python3-certbot-nginx
  elif ! command -v certbot >/dev/null 2>&1; then
    log "Instalando certbot"
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq certbot python3-certbot-nginx
  fi

  local available="/etc/nginx/sites-available/${DOMAIN}"
  local enabled="/etc/nginx/sites-enabled/${DOMAIN}"
  local changed=0

  if [ ! -f "$available" ]; then
    changed=1
    log "Criando vhost nginx para ${DOMAIN}"
    cat > "$available" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} ${WWW_DOMAIN};

    client_max_body_size 25m;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        proxy_pass http://127.0.0.1:${WEB_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 90s;
    }
}
NGINX
    ln -sf "$available" "$enabled"
  fi

  mkdir -p /var/www/html

  if ! nginx -t 2>/dev/null; then
    log "AVISO: nginx -t falhou. Nada foi recarregado."
    nginx -t || true
    return
  fi

  if [ "$changed" = "1" ]; then
    systemctl reload nginx || log "AVISO: reload do nginx falhou."
  fi

  if grep -q "listen 443" "$available" 2>/dev/null; then
    log "HTTPS ja configurado para ${DOMAIN}"
    return
  fi

  if [ -z "$CERTBOT_EMAIL" ]; then
    log "AVISO: CERTBOT_EMAIL nao informado, pulando o certificado."
    return
  fi

  log "Configurando HTTPS apenas para ${DOMAIN}"
  if timeout 240 certbot --nginx \
      --cert-name "$DOMAIN" \
      -d "$DOMAIN" -d "$WWW_DOMAIN" \
      --keep-until-expiring \
      --non-interactive --agree-tos --redirect \
      -m "$CERTBOT_EMAIL" </dev/null; then
    log "HTTPS ativo em ${DOMAIN}"
  else
    log "AVISO: certbot nao concluiu (timeout ou falha). O site segue no HTTP; rode manualmente:"
    log "  certbot --nginx --cert-name ${DOMAIN} -d ${DOMAIN} -d ${WWW_DOMAIN} --keep-until-expiring --redirect -m ${CERTBOT_EMAIL}"
  fi
}

setup_https

log "Infraestrutura 2P Box pronta (rede ${NETWORK}, sem tocar em outros containers)"
