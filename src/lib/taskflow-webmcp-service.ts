import type { TaskFlowRuntimeController } from '@/lib/taskflow-runtime-controller';
import { createTaskFlowWebMcpCatalog } from '@/lib/taskflow-webmcp-catalog';
import {
  createWebMcpHostAdapter,
  type WebMcpHostAdapter,
  type WebMcpHostKind,
} from '@/lib/webmcp-host-adapter';
import type {
  TaskFlowWebMcpNotification,
  TaskFlowWebMcpToolName,
  TaskFlowWebMcpToolResponse,
  TaskFlowWebMcpToolResult,
} from '@/types/taskflow-webmcp';
import type {
  TaskFlowWebMcpDebugApi,
  WebMcpAgent,
} from '@/types/webmcp';

type TaskFlowWebMcpController = Pick<
  TaskFlowRuntimeController,
  'start' | 'buildWebMcpContext' | 'buildWebMcpNotification' | 'executeWebMcpTool'
>;

function toTextSummary(result: TaskFlowWebMcpToolResult): string {
  switch (result.state) {
    case 'success':
      return result.summary;
    case 'error':
      return result.errorText;
    case 'requires_confirmation':
      return result.summary;
  }
}

function toToolResponse(result: TaskFlowWebMcpToolResult): TaskFlowWebMcpToolResponse {
  return {
    content: [
      {
        type: 'text',
        text: toTextSummary(result),
      },
    ],
    structuredContent: result,
  };
}

export class TaskFlowWebMcpService {
  private hostAdapter: WebMcpHostAdapter;
  private startPromise: Promise<void> | null = null;
  private stopPromise: Promise<void> | null = null;
  private active = false;
  private readonly lifecycleLog: string[] = [];
  private currentToolNames: string[] = [];

  constructor(
    private readonly controller: TaskFlowWebMcpController,
    hostAdapter?: WebMcpHostAdapter,
  ) {
    this.hostAdapter = hostAdapter ?? createWebMcpHostAdapter();
  }

  get supported(): boolean {
    return this.hostAdapter.supported;
  }

  get kind(): WebMcpHostKind {
    return this.hostAdapter.kind;
  }

  get status() {
    return {
      supported: this.supported,
      kind: this.kind,
      active: this.active,
      toolNames: [...this.currentToolNames],
      lastLifecycleEvents: [...this.lifecycleLog],
    };
  }

  async start(): Promise<void> {
    if (this.stopPromise) {
      await this.stopPromise;
    }

    if (this.active) {
      return;
    }

    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPromise = this.ensureStarted().finally(() => {
      this.startPromise = null;
    });

    return this.startPromise;
  }

  async stop(): Promise<void> {
    if (this.stopPromise) {
      return this.stopPromise;
    }

    if (!this.active && !this.startPromise) {
      return;
    }

    const ownedAdapter = this.hostAdapter;
    this.active = false;
    this.startPromise = null;
    this.currentToolNames = [];
    this.logLifecycle('bridge stopped');
    this.hostAdapter = createWebMcpHostAdapter();

    this.stopPromise = ownedAdapter.clear().finally(() => {
      this.stopPromise = null;
    });

    return this.stopPromise;
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  createDebugApi(): TaskFlowWebMcpDebugApi {
    return {
      status: () => this.status,
      listTools: () => [...this.currentToolNames],
      restart: async () => {
        await this.restart();
      },
      lastLifecycleEvents: () => [...this.lifecycleLog],
    };
  }

  private async ensureStarted(): Promise<void> {
    await this.controller.start();

    if (!this.hostAdapter.supported) {
      this.logLifecycle('modelContext unavailable; retrying with fresh adapter');
      this.hostAdapter = createWebMcpHostAdapter();
    }

    if (!this.hostAdapter.supported || this.active) {
      return;
    }

    const toolCatalog = createTaskFlowWebMcpCatalog({
      executeTool: async (toolName, input, agent) => this.executeTool(toolName, input, agent),
    });

    this.currentToolNames = toolCatalog.map((tool) => tool.name);
    this.logLifecycle(
      `registering ${toolCatalog.length} tool${toolCatalog.length === 1 ? '' : 's'} via ${this.kind}`,
    );
    await this.hostAdapter.syncTools(toolCatalog);
    this.active = true;
    this.logLifecycle('bridge active');
  }

  private async executeTool(
    toolName: TaskFlowWebMcpToolName,
    input: Record<string, unknown>,
    agent: WebMcpAgent | undefined,
  ): Promise<TaskFlowWebMcpToolResponse> {
    const result = await this.controller.executeWebMcpTool(toolName, input, agent);
    return toToolResponse(result);
  }

  private logLifecycle(message: string): void {
    this.lifecycleLog.push(`[${new Date().toISOString()}] ${message}`);
    if (this.lifecycleLog.length > 40) {
      this.lifecycleLog.splice(0, this.lifecycleLog.length - 40);
    }
  }
}

let webMcpServiceSingleton: TaskFlowWebMcpService | null = null;

export function createTaskFlowWebMcpService(
  controller: TaskFlowRuntimeController,
  hostAdapter?: WebMcpHostAdapter,
): TaskFlowWebMcpService {
  return new TaskFlowWebMcpService(controller, hostAdapter);
}

export function getTaskFlowWebMcpService(
  controller: TaskFlowRuntimeController,
): TaskFlowWebMcpService {
  webMcpServiceSingleton ??= new TaskFlowWebMcpService(controller);
  return webMcpServiceSingleton;
}

export function createTaskFlowWebMcpNotificationSummary(
  notification: TaskFlowWebMcpNotification,
): string {
  return `Context v${notification.contextVersion}. Selected ${notification.selectedTaskId ?? 'none'}. Counts active ${notification.counts.active}, deleted ${notification.counts.deleted}.`;
}

