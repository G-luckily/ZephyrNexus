#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# 自动加载 .env（如果存在），并导出变量到子进程
if [[ -f "${ROOT_DIR}/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  . "${ROOT_DIR}/.env"
  set +a
fi

CONFIG_FILE="${ROOT_DIR}/workspace.config.json"

ENV_PROFILE="${AETHERSTACK_ENV_PROFILE:-wsl}"

RUNTIME_DIR="${AETHERSTACK_RUNTIME_DIR:-${ROOT_DIR}/runtime}"
LOG_DIR="${AETHERSTACK_LOG_DIR:-${ROOT_DIR}/logs}"

mkdir -p "$RUNTIME_DIR" "$LOG_DIR"

STATUS_SUMMARY=()

log() {
  echo "[start-all] $*"
}

read_config() {
  local jq_query="$1"
  jq -r "$jq_query" "$CONFIG_FILE"
}

start_service() {
  local service_name="$1"
  local enable_key=".services.\"${service_name}\".enabled"
  local enabled
  enabled="$(read_config "${enable_key} // false")"

  if [[ "$enabled" != "true" ]]; then
    log "服务 ${service_name} 在配置中标记为 disabled，跳过。"
    STATUS_SUMMARY+=("${service_name}: SKIPPED (disabled)")
    return 0
  fi

  local repo_name
  repo_name="$(read_config ".services.\"${service_name}\".repo")"
  local repo_path_var
  # service_name 可能包含 '-'，环境变量名中用 '_' 代替
  repo_path_var="$(echo "${service_name^^}_PATH" | tr '-' '_')"

  local repo_path="${!repo_path_var:-}"

  if [[ -z "$repo_path" ]]; then
    repo_path="$(read_config ".environmentProfiles.\"${ENV_PROFILE}\".pathMappings.\"${repo_name}\" // empty")"
  fi

  if [[ -z "$repo_path" ]]; then
    log "服务 ${service_name} 未能解析到有效路径（env + config 均缺失），跳过。"
    STATUS_SUMMARY+=("${service_name}: SKIPPED (no path)")
    return 0
  fi

  if [[ ! -d "$repo_path" ]]; then
    log "服务 ${service_name} 路径不存在: ${repo_path}，跳过。"
    STATUS_SUMMARY+=("${service_name}: SKIPPED (path not found)")
    return 0
  fi

  local start_cmd
  start_cmd="$(read_config ".services.\"${service_name}\".start.command // empty")"
  if [[ -z "$start_cmd" ]]; then
    log "服务 ${service_name} 未配置 start.command，跳过。"
    STATUS_SUMMARY+=("${service_name}: SKIPPED (no start command)")
    return 0
  fi

  local log_file="${LOG_DIR}/${service_name}.log"
  local pid_file="${RUNTIME_DIR}/${service_name}.pid"

  if [[ -f "$pid_file" ]]; then
    local existing_pid
    existing_pid="$(cat "$pid_file" || true)"
    if [[ -n "$existing_pid" ]] && kill -0 "$existing_pid" 2>/dev/null; then
      log "服务 ${service_name} 已在运行 (pid=${existing_pid})，跳过启动。"
      STATUS_SUMMARY+=("${service_name}: RUNNING (pid=${existing_pid})")
      return 0
    fi
  fi

  log "准备启动服务 ${service_name}，仓库路径：${repo_path}"
  log "启动命令：${start_cmd}"

  (
    cd "$repo_path"
    nohup bash -lc "$start_cmd" >>"$log_file" 2>&1 &
    echo $! >"$pid_file"
  )

  local pid
  pid="$(cat "$pid_file")"
  if kill -0 "$pid" 2>/dev/null; then
    log "服务 ${service_name} 启动成功，pid=${pid}，日志：${log_file}"
    STATUS_SUMMARY+=("${service_name}: STARTED (pid=${pid})")
  else
    log "服务 ${service_name} 启动命令已执行，但未检测到存活进程，请检查日志：${log_file}"
    STATUS_SUMMARY+=("${service_name}: WARN (start command executed, pid not alive)")
  fi
}

main() {
  if ! command -v jq >/dev/null 2>&1; then
    log "WARN: 未安装 jq，无法读取 workspace.config.json，脚本将失败。"
    exit 1
  fi

  if [[ ! -f "$CONFIG_FILE" ]]; then
    log "ERROR: 未找到配置文件 ${CONFIG_FILE}。"
    exit 1
  fi

  log "使用配置文件：${CONFIG_FILE}"
  log "环境 profile：${ENV_PROFILE}"
  log "runtime 目录：${RUNTIME_DIR}"
  log "log 目录：${LOG_DIR}"

  start_service "paperclip"
  start_service "openclaw"
  start_service "browser-use"

  echo
  echo "========== 启动总结 =========="
  for item in "${STATUS_SUMMARY[@]}"; do
    echo "- $item"
  done

  local paperclip_port
  paperclip_port="$(read_config ".services.\"paperclip\".port // 3000")"
  echo
  echo "如 paperclip 启动成功，可尝试访问："
  echo "  http://localhost:${paperclip_port}"
}

main "$@"

