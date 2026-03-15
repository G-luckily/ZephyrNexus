#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RUNTIME_DIR="${AETHERSTACK_RUNTIME_DIR:-${ROOT_DIR}/runtime}"

log() {
  echo "[stop-all] $*"
}

stop_service() {
  local service_name="$1"
  local pid_file="${RUNTIME_DIR}/${service_name}.pid"

  if [[ ! -f "$pid_file" ]]; then
    log "服务 ${service_name} 无 pid 文件，可能未由 AetherStack 启动，跳过。"
    return 0
  fi

  local pid
  pid="$(cat "$pid_file" || true)"

  if [[ -z "$pid" ]]; then
    log "服务 ${service_name} pid 文件为空，删除并跳过。"
    rm -f "$pid_file"
    return 0
  fi

  if ! kill -0 "$pid" 2>/dev/null; then
    log "服务 ${service_name} pid=${pid} 已不在运行，删除 pid 文件。"
    rm -f "$pid_file"
    return 0
  fi

  log "准备停止服务 ${service_name} (pid=${pid})"
  kill "$pid" || true

  sleep 3

  if kill -0 "$pid" 2>/dev/null; then
    log "服务 ${service_name} (pid=${pid}) 未正常退出，尝试 SIGKILL"
    kill -9 "$pid" || true
  fi

  if kill -0 "$pid" 2>/dev/null; then
    log "WARN: 无法杀死服务 ${service_name} (pid=${pid})，请手工检查。"
  else
    log "服务 ${service_name} 已停止。"
    rm -f "$pid_file"
  fi
}

main() {
  log "runtime 目录：${RUNTIME_DIR}"

  stop_service "paperclip"
  stop_service "openclaw"
  stop_service "browser-use"

  log "stop-all 执行完毕。"
}

main "$@"

