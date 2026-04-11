import type { WebMcpModelContext, WebMcpToolDescriptor } from '@/types/webmcp';

export type WebMcpHostKind = 'none' | 'chrome-preview';

export interface WebMcpHostAdapter {
  readonly supported: boolean;
  readonly kind: WebMcpHostKind;
  syncTools(tools: WebMcpToolDescriptor[]): Promise<void>;
  clear(): Promise<void>;
}

class NoopWebMcpHostAdapter implements WebMcpHostAdapter {
  readonly supported = false;
  readonly kind = 'none' as const;

  async syncTools(): Promise<void> {}

  async clear(): Promise<void> {}
}

class ChromePreviewWebMcpHostAdapter implements WebMcpHostAdapter {
  readonly supported = true;
  readonly kind = 'chrome-preview' as const;

  private readonly registrations = new Map<
    string,
    {
      signature: string;
      abortController: AbortController;
    }
  >();

  constructor(private readonly modelContext: WebMcpModelContext) {}

  async syncTools(tools: WebMcpToolDescriptor[]): Promise<void> {
    if (!this.modelContext.registerTool) {
      return;
    }

    const nextTools = new Map(tools.map((tool) => [tool.name, tool]));

    for (const [toolName] of this.registrations) {
      if (!nextTools.has(toolName)) {
        await this.unregisterOwnedTool(toolName);
      }
    }

    for (const tool of tools) {
      const signature = serializeToolSignature(tool);
      const currentRegistration = this.registrations.get(tool.name);

      if (currentRegistration?.signature === signature) {
        continue;
      }

      if (currentRegistration) {
        await this.unregisterOwnedTool(tool.name);
      }

      const abortController = new AbortController();
      await this.modelContext.registerTool(tool, {
        signal: abortController.signal,
      });
      this.registrations.set(tool.name, {
        signature,
        abortController,
      });
    }
  }

  async clear(): Promise<void> {
    for (const [toolName] of this.registrations) {
      await this.unregisterOwnedTool(toolName);
    }
  }

  private async unregisterOwnedTool(toolName: string): Promise<void> {
    const registration = this.registrations.get(toolName);

    if (!registration) {
      return;
    }

    registration.abortController.abort();
    await this.modelContext.unregisterTool?.(toolName);
    this.registrations.delete(toolName);
  }
}

function serializeToolSignature(tool: WebMcpToolDescriptor): string {
  return JSON.stringify({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  });
}

export function getWebMcpModelContext(): WebMcpModelContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.navigator.modelContext ?? null;
}

export function createWebMcpHostAdapter(
  modelContext: WebMcpModelContext | null = getWebMcpModelContext(),
): WebMcpHostAdapter {
  if (modelContext?.registerTool) {
    return new ChromePreviewWebMcpHostAdapter(modelContext);
  }

  return new NoopWebMcpHostAdapter();
}

