export const STATUS_ZH: Record<string, string> = {
  // Issue statuses
  backlog: "待处理",
  todo: "待办",
  in_progress: "进行中",
  in_review: "待审核",
  blocked: "已阻塞",
  done: "已完成",
  cancelled: "已取消",
  // Agent / run statuses
  active: "进行中",
  pending: "待处理",
  paused: "已暂停",
  failed: "失败",
  succeeded: "成功",
  idle: "空闲",
  timed_out: "已超时",
  pending_approval: "待审批",
  completed: "已完成",
  terminated: "已终止",
  error: "异常",
  running: "执行中",
  // Goal statuses
  planned: "已规划",
  // Goal levels
  company: "公司级",
  team: "团队级",
  individual: "个人级",
  // Approval types
  action: "操作审批",
  budget: "预算审批",
  content: "内容审批",
  // Priority labels
  critical: "重点",
  high: "高优",
  medium: "中优",
  low: "低优",
  // General
  all: "全部",
};

export function tStatus(status: string): string {
  return STATUS_ZH[status] ?? status;
}

export const UI_ZH = {
  dashboard: "总览",
  inbox: "消息中心",
  issues: "任务",
  goals: "目标",
  projects: "项目",
  agents: "智能体",
  configuration: "配置",
  latestRun: "最近执行",
  runActivity: "执行统计",
  successRate: "成功率",
  recentIssues: "最近任务",
  costs: "成本信息",
  assignTask: "分配任务",
  resume: "继续执行",
  viewDetails: "查看详情",
  createIssue: "创建任务",
  discardDraft: "丢弃草稿",
  backToOverview: "返回总览",
  flowDetails: "任务流程详情",
  missionQueue: "任务队列",
  statusLabel: "状态",
  all: "全部",
  active: "活跃",
  blocked: "阻塞",
  inReview: "审核中",
  noFlowTasks: "当前筛选下暂无流程任务。",
};
