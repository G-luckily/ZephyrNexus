export interface Actor {
  type: "board" | "agent" | "none";
  userId?: string;
  agentId?: string;
  keyId?: string;
  companyId?: string;
  companyIds?: string[];
  memberships?: Array<{ companyId: string; role: string }>;
  isInstanceAdmin?: boolean;
  runId?: string;
  source: "local_implicit" | "jwt" | "session" | "none" | "agent_jwt" | "agent_key";
}

declare global {
  namespace Express {
    interface Request {
      actor: Actor;
    }
  }
}

export {};
