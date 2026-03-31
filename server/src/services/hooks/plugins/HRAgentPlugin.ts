// server/src/services/hooks/plugins/HRAgentPlugin.ts
import { logger } from '../../../middleware/logger.js';
import type { HookPlugin, IHookManager, HookResponse } from '../types.js';

/**
 * HR Full-Process Agent Workflow Plugin
 * Demonstrates internal issue-triggered agent dispatch, context injection, and boss approval interception.
 */
export const hrAgentPlugin: HookPlugin = {
  name: 'HRAgentPlugin',
  description: 'Intercepts HR-related issues to mount context and isolate tools for the HR Agent workflow.',
  
  initialize: (manager: IHookManager) => {
    // 1. Triggered when a new Issue is created on the board
    manager.register('onIssueCreated', async (payload) => {
      const { issue, actor } = payload;
      
      // Only react if the issue title implies HR/Recruiting
      const title = String(issue?.title || '').toLowerCase();
      if (title.includes('hr') || title.includes('recruit') || title.includes('hire') || title.includes('招')) {
        logger.info({ issueId: issue.id, title: issue.title }, '[HRAgentPlugin] Detected HR requirement! Dispatching internal HR Agent workflow...');
        // Here we would normally trigger the underlying OpenClaw Adapter
        // For demonstration, we log the interception:
        logger.info('[HRAgentPlugin] Automatically assigning to HR Agent identity...');
      }
    });

    // 2. Triggered before the Agent executes its run (Injecting Context)
    manager.register('beforeAgentRun', async (payload) => {
      const { agentId, currentConfig } = payload;
      
      // Assuming agentId 'hr-agent' is the specialized HR worker
      if (agentId === 'hr-agent' || agentId.includes('hr')) {
        logger.info({ agentId }, '[HRAgentPlugin] HR Agent is waking up. Injecting Company Culture & Resume Formats into Context...');
        
        const injectedContext = [
          currentConfig?.systemPrompt || '',
          "---",
          "[Company Injected Context]: Core values involve rapid shipping. Use the 'Candidate_Filter_V2' criteria.",
        ].join('\n');

        return {
          action: 'modify',
          payload: {
            ...currentConfig,
            systemPrompt: injectedContext,
            // Enforce tool isolation - only allow reading and mailing
            allowedTools: ['read_resume_pdf', 'send_email']
          }
        } as HookResponse;
      }
    });

    // 3. Triggered before an Agent uses a tool (Boss Approval/Human-in-the-loop)
    manager.register('beforeToolExecution', async (payload) => {
      const { agentId, toolName } = payload;
      
      // If the HR agent tries to send an official offer/rejection email, SUSPEND it.
      if (toolName === 'send_email') {
        logger.warn({ agentId, toolName }, '[HRAgentPlugin] DANGEROUS TOOL CALLED. Suspending run for Boss Approval!');
        
        // Return a 'suspend' signal to the OpenClaw adapter/task runner
        return {
          action: 'suspend',
          reason: 'Boss approval required for sending candidate emails.',
          payload: {
            requireApproval: true,
            approvalType: 'boss_review'
          }
        } as HookResponse;
      }
    });

    logger.info('[HRAgentPlugin] Registered successfully');
  }
};
