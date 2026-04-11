import { describe, expect, it, vi } from 'vitest';
import { createWebMcpHostAdapter } from '@/lib/webmcp-host-adapter';
import type { WebMcpRegisterToolOptions, WebMcpToolDescriptor } from '@/types/webmcp';

function createTool(name: string): WebMcpToolDescriptor {
  return {
    name,
    description: `${name} description`,
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    execute: async () => ({
      content: [{ type: 'text', text: name }],
      structuredContent: {
        state: 'success',
        summary: name,
      },
    }),
  };
}

describe('webmcp host adapter', () => {
  it('registers owned tools with AbortSignal and cleans them up', async () => {
    const registrations = new Map<string, AbortSignal | undefined>();
    const registerTool = vi.fn(
      async (tool: WebMcpToolDescriptor, options?: WebMcpRegisterToolOptions) => {
        registrations.set(tool.name, options?.signal);
      },
    );
    const unregisterTool = vi.fn(async (toolName: string) => {
      registrations.delete(toolName);
    });

    const hostAdapter = createWebMcpHostAdapter({
      registerTool,
      unregisterTool,
    });

    await hostAdapter.syncTools([createTool('alpha'), createTool('beta')]);

    expect(registerTool).toHaveBeenCalledTimes(2);
    expect(registrations.get('alpha')).toBeInstanceOf(AbortSignal);
    expect(registrations.get('beta')).toBeInstanceOf(AbortSignal);

    const alphaSignal = registrations.get('alpha');
    const betaSignal = registrations.get('beta');

    await hostAdapter.clear();

    expect(alphaSignal?.aborted).toBe(true);
    expect(betaSignal?.aborted).toBe(true);
    expect(unregisterTool).toHaveBeenCalledTimes(2);
    expect(registrations.size).toBe(0);
  });

  it('tolerates browsers without unregisterTool', async () => {
    const signals: AbortSignal[] = [];
    const registerTool = vi.fn(
      async (_tool: WebMcpToolDescriptor, options?: WebMcpRegisterToolOptions) => {
        if (options?.signal) {
          signals.push(options.signal);
        }
      },
    );

    const hostAdapter = createWebMcpHostAdapter({
      registerTool,
    });

    await hostAdapter.syncTools([createTool('alpha')]);
    await expect(hostAdapter.clear()).resolves.toBeUndefined();
    expect(signals).toHaveLength(1);
    expect(signals[0]?.aborted).toBe(true);
  });
});
