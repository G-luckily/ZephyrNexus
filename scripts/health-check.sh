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

OVERALL_STATUS="PASS"

log() {
  echo "[health-check] $*"
}

set_status() {
  local new="$1"
  case "$new" in
    FAIL)
      OVERALL_STATUS="FAIL"
      ;;
    WARN)
      [[ "$OVERALL_STATUS" == "PASS" ]] && OVERALL_STATUS="WARN"
      ;;
  esac
}

read_config() {
  local jq_query="$1"
  jq -r "$jq_query" "$CONFIG_FILE"
}

check_command() {
  local cmd="$1"
  if command -v "$cmd" >/dev/null 2>&1; then
    log "PASS: 命令可用：$cmd"
  else
    log "FAIL: 未找到命令：$cmd"
    set_status "FAIL"
  fi
}

check_service_path() {
  local service_name="$1"

  # 若服务在配置中标记为 disabled，则仅提示并跳过严格检查
  local enabled
  enabled="$(read_config ".services.\"${service_name}\".enabled // false")"
  if [[ "$enabled" != "true" ]]; then
    log "WARN: 服务 ${service_name} 在配置中为 disabled，跳过路径检查。"
    set_status "WARN"
    return 0
  fi

  local repo_name
  repo_name="$(read_config ".services.\"${service_name}\".repo")"

  local repo_path_var
  # 按服务名映射到对应 env 变量
  case "$service_name" in
    openclaw)
      repo_path_var="OPENCLAW_WORKSPACE_PATH"
      ;;
    *)
      # service_name 可能包含 '-'，环境变量名中用 '_' 代替
      repo_path_var="$(echo "${service_name^^}_PATH" | tr '-' '_')"
      ;;
  esac
  local repo_path="${!repo_path_var:-}"

  if [[ -z "$repo_path" ]]; then
    repo_path="$(read_config ".environmentProfiles.\"${ENV_PROFILE}\".pathMappings.\"${repo_name}\" // empty")"
  fi

  if [[ -z "$repo_path" ]]; then
    log "WARN: 服务 ${service_name} 无法解析到路径（env + config 未配置），若该服务暂不使用可忽略。"
    set_status "WARN"
  elif [[ ! -d "$repo_path" ]]; then
    log "FAIL: 服务 ${service_name} 路径不存在：${repo_path}"
    set_status "FAIL"
  else
    log "PASS: 服务 ${service_name} 路径存在：${repo_path}"
  fi
}

check_service_process() {
  local service_name="$1"
  local pid_file="${RUNTIME_DIR}/${service_name}.pid"
  if [[ ! -f "$pid_file" ]]; then
    log "WARN: 未找到服务 ${service_name} 的 pid 文件，可能未由 AetherStack 启动。"
    set_status "WARN"
    return 0
  fi

  local pid
  pid="$(cat "$pid_file" || true)"
  if [[ -z "$pid" ]]; then
    log "WARN: 服务 ${service_name} pid 文件为空。"
    set_status "WARN"
    return 0
  fi

  if kill -0 "$pid" 2>/dev/null; then
    log "PASS: 服务 ${service_name} 正在运行 (pid=${pid})"
  else
    log "FAIL: 服务 ${service_name} pid=${pid} 未在运行。"
    set_status "FAIL"
  fi
}

main() {
  log "使用配置文件：${CONFIG_FILE}"
  log "环境 profile：${ENV_PROFILE}"
  log "runtime 目录：${RUNTIME_DIR}"

  if ! command -v jq >/dev/null 2>&1; then
    log "FAIL: 未安装 jq，无法解析 workspace.config.json。"
    set_status "FAIL"
    echo "整体健康状态：${OVERALL_STATUS}"
    exit 1
  fi

  if [[ ! -f "$CONFIG_FILE" ]]; then
    log "FAIL: 未找到配置文件 ${CONFIG_FILE}。"
    set_status "FAIL"
    echo "整体健康状态：${OVERALL_STATUS}"
    exit 1
  fi

  echo "---- 基础命令检查 ----"
  check_command "git"
  check_command "bash"
  check_command "jq"

  echo
  echo "---- 路径与配置检查 ----"
  check_service_path "paperclip"
  check_service_path "openclaw"
  check_service_path "browser-use"

  echo
  echo "---- 服务进程检查（基于 pid 文件） ----"
  check_service_process "paperclip" || true
  check_service_process "openclaw" || true
  check_service_process "browser-use" || true
  # 整体状态输出与退出码在 main 函数结束后统一处理
}

main "$@"

echo
echo "整体健康状态：${OVERALL_STATUS}"

case "$OVERALL_STATUS" in
  PASS) exit 0 ;;
  WARN) exit 0 ;;
  FAIL) exit 1 ;;
esac

