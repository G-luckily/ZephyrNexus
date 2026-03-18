#!/usr/bin/env bash
# openclaw-auth-inject.sh
# 用途：向 OpenClaw 容器注入 API Key（支持 openrouter 和 openai），写入 auth-profiles.json
# 执行方式：./scripts/openclaw-auth-inject.sh
# 前提：容器已启动，API Key 已设置在环境变量或 ~/.secrets

set -euo pipefail

CONTAINER_NAME="${OPENCLAW_CONTAINER_NAME:-openclaw-docker-openclaw-gateway-1}"

log() { echo "[auth-inject] $*"; }

# 1. 自动从 ~/.secrets 载入（如果存在）
if [[ -f "$HOME/.secrets" ]]; then
  set +u
  # shellcheck source=/dev/null
  source "$HOME/.secrets"
  set -u
fi

# 2. 检查容器是否在跑
if ! docker inspect "$CONTAINER_NAME" > /dev/null 2>&1; then
  log "❌ 容器 $CONTAINER_NAME 未找到，请先启动 OpenClaw："
  log "   pnpm smoke:openclaw-docker-ui"
  exit 1
fi
if [[ "$(docker inspect "$CONTAINER_NAME" --format '{{.State.Status}}')" != "running" ]]; then
  log "❌ 容器 $CONTAINER_NAME 未在运行状态。"
  exit 1
fi

INJECTED=0

# 3. 注入 OPENROUTER_API_KEY（优先）
if [[ -n "${OPENROUTER_API_KEY:-}" ]]; then
  log "注入 OPENROUTER_API_KEY (${#OPENROUTER_API_KEY} 字符) → provider: openrouter"
  echo "$OPENROUTER_API_KEY" | docker exec -i "$CONTAINER_NAME" \
    openclaw models auth paste-token \
    --provider openrouter \
    --profile-id "openrouter:api-key"
  INJECTED=1
fi

# 4. 注入 OPENAI_API_KEY（如果存在，作为备用）
if [[ -n "${OPENAI_API_KEY:-}" ]]; then
  log "注入 OPENAI_API_KEY (${#OPENAI_API_KEY} 字符) → provider: openai"
  echo "$OPENAI_API_KEY" | docker exec -i "$CONTAINER_NAME" \
    openclaw models auth paste-token \
    --provider openai \
    --profile-id "openai:api-key"
  INJECTED=1
fi

if [[ "$INJECTED" -eq 0 ]]; then
  echo ""
  echo "❌ 未找到任何 API Key。请通过以下方式之一提供："
  echo ""
  echo "  推荐（写入 ~/.secrets，持久化）："
  echo "    echo 'OPENROUTER_API_KEY=sk-or-v1-你的key' >> ~/.secrets"
  echo "    ./scripts/openclaw-auth-inject.sh"
  echo ""
  echo "  或临时环境变量："
  echo "    OPENROUTER_API_KEY=sk-or-v1-你的key ./scripts/openclaw-auth-inject.sh"
  echo ""
  echo "  获取 OpenRouter key：https://openrouter.ai/keys"
  exit 1
fi

# 5. 验证
log ""
log "✅ 注入完成，验证中..."
sleep 1
AUTH_STATUS=$(docker exec "$CONTAINER_NAME" openclaw models status 2>&1)
echo "$AUTH_STATUS"

if echo "$AUTH_STATUS" | grep -q "Missing auth"; then
  log ""
  log "⚠️  仍有 Missing auth，provider 名称可能不匹配。请确认："
  log "   docker exec $CONTAINER_NAME openclaw models list --all | grep openrouter"
  exit 1
else
  log ""
  log "✅ Auth 验证通过！"
  log "   现在请在 OpenClaw Dashboard 的聊天框发一条消息验证真实调用。"
fi
