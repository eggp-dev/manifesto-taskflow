declare global {
  interface Navigator {
    modelContext?: WebMcpModelContext;
  }

  interface Window {
    __taskflowWebMcp?: TaskFlowWebMcpDebugApi;
  }
}

export interface WebMcpToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (
    input: Record<string, unknown>,
    agent: WebMcpAgent | undefined,
  ) => unknown | Promise<unknown>;
}

export interface WebMcpRegisterToolOptions {
  signal?: AbortSignal;
}

export interface WebMcpModelContext {
  registerTool?: (
    tool: WebMcpToolDescriptor,
    options?: WebMcpRegisterToolOptions,
  ) => void | Promise<void>;
  unregisterTool?: (name: string) => void | Promise<void>;
}

export interface WebMcpAgent {
  requestUserInteraction?<T>(callback: () => T | Promise<T>): Promise<T>;
}

export interface TaskFlowWebMcpDebugApi {
  status: () => {
    supported: boolean;
    kind: 'none' | 'chrome-preview';
    active: boolean;
    toolNames: string[];
    lastLifecycleEvents: string[];
  };
  listTools: () => string[];
  restart: () => Promise<void>;
  lastLifecycleEvents: () => string[];
}

export {};
