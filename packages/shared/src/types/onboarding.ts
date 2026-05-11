export interface QuickstartRequest {
  companyName: string;
  taskTitle?: string;
  taskDescription?: string;
}

export interface QuickstartTask {
  title: string;
  description: string;
}

export interface QuickstartResponse {
  companyId: string;
  companyName: string;
  agentId: string;
  agentName: string;
  suggestedTasks: QuickstartTask[];
}
