import type {
  TaskFlowAgentContext,
  TaskFlowAgentToolResult,
  TaskFlowAssistantToolName,
  TaskFlowAssistantUITools,
  TaskFlowHoveredInspection,
  TaskFlowHoveredTarget,
} from '@/types/taskflow-assistant';
import type {
  TaskFlowWebMcpContext,
  TaskFlowWebMcpNotification,
  TaskFlowWebMcpToolName,
  TaskFlowWebMcpToolResult,
} from '@/types/taskflow-webmcp';
import type { WebMcpAgent } from '@/types/webmcp';

export interface TaskFlowToolGatewayContext {
  getAgentContext(): TaskFlowAgentContext;
  getWebMcpUiState(): TaskFlowWebMcpContext['uiState'];
  getWebMcpContextVersion(): number;
  executeAgentTool<T extends TaskFlowAssistantToolName>(
    toolName: T,
    input: TaskFlowAssistantUITools[T]['input'],
  ): Promise<TaskFlowAgentToolResult>;
  findTaskTitle(taskId: string): string | null;
}

export class TaskFlowToolGateway {
  constructor(private readonly context: TaskFlowToolGatewayContext) {}

  buildWebMcpContext(): TaskFlowWebMcpContext {
    return {
      ...this.context.getAgentContext(),
      contextVersion: this.context.getWebMcpContextVersion(),
      uiState: this.context.getWebMcpUiState(),
    };
  }

  buildWebMcpNotification(): TaskFlowWebMcpNotification {
    const context = this.buildWebMcpContext();

    return {
      contextVersion: context.contextVersion,
      branchName: context.branchName,
      visibleWorldId: context.visibleWorldId,
      selectedTaskId: context.selectedTaskId,
      hoveredTarget: context.hoveredTarget,
      counts: context.counts,
      uiState: context.uiState,
    };
  }

  async executeAssistantTool<T extends TaskFlowAssistantToolName>(
    toolName: T,
    input: TaskFlowAssistantUITools[T]['input'],
  ): Promise<TaskFlowAgentToolResult> {
    return this.context.executeAgentTool(toolName, input);
  }

  async executeWebMcpTool(
    toolName: TaskFlowWebMcpToolName,
    input: Record<string, unknown>,
    agent?: WebMcpAgent,
  ): Promise<TaskFlowWebMcpToolResult> {
    void agent;

    if (toolName === 'get_taskflow_context') {
      const context = this.buildWebMcpContext();

      return {
        state: 'success',
        summary: `Returned TaskFlow context v${context.contextVersion}.`,
        context,
      };
    }

    if (toolName === 'delete_task') {
      const deleteInput = input as unknown as TaskFlowAssistantUITools['delete_task']['input'] & {
        confirmed?: boolean;
      };
      const taskTitle = this.context.findTaskTitle(deleteInput.taskId);

      if (!taskTitle) {
        return {
          state: 'error',
          errorText: 'The requested task could not be found in the current TaskFlow context.',
        };
      }

      if (!deleteInput.confirmed) {
        return {
          state: 'requires_confirmation',
          summary: `Delete "${taskTitle}"? Call delete_task again with confirmed=true to proceed.`,
          confirmation: {
            toolName: 'delete_task',
            input: {
              taskId: deleteInput.taskId,
              confirmed: true,
            },
          },
        };
      }
    }

    const result = await this.context.executeAgentTool(
      toolName as TaskFlowAssistantToolName,
      input as TaskFlowAssistantUITools[TaskFlowAssistantToolName]['input'],
    );

    if (result.state === 'output-error') {
      return {
        state: 'error',
        errorText: result.errorText,
      };
    }

    return {
      state: 'success',
      summary: result.output.summary,
      output: result.output,
    };
  }
}

export interface TaskFlowToolGatewayDebugSnapshot {
  contextVersion: number;
  selectedTaskId: string | null;
  hoveredTarget: TaskFlowHoveredTarget | null;
  inspection?: TaskFlowHoveredInspection;
}
