import type {
  TaskFlowAgentContext,
  TaskFlowAgentToolResult,
  TaskFlowAssistantToolMap,
  TaskFlowHoveredTarget,
  TaskFlowToolOutput,
} from '@/types/taskflow-assistant';

export interface TaskFlowWebMcpUiState {
  historyOpen: boolean;
  createDialogOpen: boolean;
  datePickerOpen: boolean;
}

export interface TaskFlowWebMcpContext extends TaskFlowAgentContext {
  contextVersion: number;
  uiState: TaskFlowWebMcpUiState;
}

export interface TaskFlowWebMcpNotification {
  contextVersion: number;
  branchName: string | null;
  visibleWorldId: string | null;
  selectedTaskId: string | null;
  hoveredTarget: TaskFlowHoveredTarget | null;
  counts: TaskFlowAgentContext['counts'];
  uiState: TaskFlowWebMcpUiState;
}

export interface TaskFlowWebMcpGetContextInput {
  detail?: 'full' | 'summary';
}

export interface TaskFlowWebMcpDeleteInput {
  taskId: string;
  confirmed?: boolean;
}

export type TaskFlowWebMcpToolMap = Omit<TaskFlowAssistantToolMap, 'delete_task'> & {
  get_taskflow_context: {
    input: TaskFlowWebMcpGetContextInput;
    output: TaskFlowWebMcpSuccessResult;
  };
  delete_task: {
    input: TaskFlowWebMcpDeleteInput;
    output: TaskFlowWebMcpToolResult;
  };
};

export type TaskFlowWebMcpToolName = keyof TaskFlowWebMcpToolMap;

export interface TaskFlowWebMcpSuccessResult {
  state: 'success';
  summary: string;
  output?: TaskFlowToolOutput;
  context?: TaskFlowWebMcpContext;
}

export interface TaskFlowWebMcpErrorResult {
  state: 'error';
  errorText: string;
}

export interface TaskFlowWebMcpRequiresConfirmationResult {
  state: 'requires_confirmation';
  summary: string;
  confirmation: {
    toolName: 'delete_task';
    input: TaskFlowWebMcpDeleteInput;
  };
}

export type TaskFlowWebMcpToolResult =
  | TaskFlowWebMcpSuccessResult
  | TaskFlowWebMcpErrorResult
  | TaskFlowWebMcpRequiresConfirmationResult;

export interface TaskFlowWebMcpTextContent {
  type: 'text';
  text: string;
}

export interface TaskFlowWebMcpToolResponse {
  content: TaskFlowWebMcpTextContent[];
  structuredContent: TaskFlowWebMcpToolResult;
}

export type TaskFlowWebMcpAgentResult = TaskFlowAgentToolResult;
