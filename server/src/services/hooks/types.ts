// server/src/services/hooks/types.ts
export type HookEventName =
  | 'onIssueCreated'
  | 'beforeAgentRun'
  | 'beforeToolExecution'
  | 'onApprovalResolved'
  | 'beforeHeartbeatTick';

export interface HookEventPayload {
  onIssueCreated: {
    db: any;
    issue: any;
    actor: any;
  };
  beforeAgentRun: {
    agentId: string;
    issueId?: string | null;
    currentConfig: any;
  };
  beforeToolExecution: {
    agentId: string;
    toolName: string;
    toolArgs: any;
  };
  onApprovalResolved: {
    approvalId: string;
    status: 'approved' | 'rejected';
  };
  beforeHeartbeatTick: {
    timestamp: Date;
  };
}

export interface HookResponse<T = any> {
  action: 'continue' | 'abort' | 'suspend' | 'modify';
  payload?: T;
  reason?: string;
}

export type HookHandler<E extends HookEventName> = (
  payload: HookEventPayload[E]
) => void | Promise<void | HookResponse>;

export interface HookPlugin {
  name: string;
  description: string;
  initialize: (manager: IHookManager) => void;
}

export interface IHookManager {
  register<E extends HookEventName>(eventName: E, handler: HookHandler<E>): void;
  dispatch<E extends HookEventName>(eventName: E, payload: HookEventPayload[E]): Promise<HookResponse[]>;
  use(plugin: HookPlugin): void;
}
