import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { compile } from '@manifesto-ai/compiler';
import { createClockStamp } from '@/lib/taskflow-clock';
import { createTaskFlowRuntimeController } from '@/lib/taskflow-runtime-controller';
import { createTaskFlowWebMcpBridge } from '@/lib/taskflow-webmcp';
import type { StorageLike } from '@/lib/taskflow-runtime-persistence';
import type { TaskFlowWebMcpToolResponse } from '@/types/taskflow-webmcp';
import type { WebMcpRegisterToolOptions, WebMcpToolDescriptor } from '@/types/webmcp';

vi.mock('@/domain/taskflow.schema', async () => {
  const source = await readFile(
    new URL('../domain/taskflow.mel', import.meta.url),
    'utf8',
  );
  const result = compile(source, { mode: 'domain' });

  if (!result.success || !result.schema) {
    throw new Error('Failed to compile taskflow.mel for WebMCP test.');
  }

  return {
    default: result.schema,
    taskflowSchema: result.schema,
  };
});

function createMemoryStorage(): StorageLike {
  const entries = new Map<string, string>();

  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
    removeItem: (key) => {
      entries.delete(key);
    },
  };
}

function setModelContextWindow(modelContext?: {
  registerTool?: (
    tool: WebMcpToolDescriptor,
    options?: WebMcpRegisterToolOptions,
  ) => void | Promise<void>;
  unregisterTool?: (toolName: string) => void | Promise<void>;
}) {
  const originalWindow = globalThis.window;
  const originalNavigator = globalThis.navigator;

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      navigator: {
        modelContext,
      },
    },
  });

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: globalThis.window.navigator,
  });

  return () => {
    if (originalWindow === undefined) {
      Reflect.deleteProperty(globalThis, 'window');
    } else {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      });
    }

    if (originalNavigator === undefined) {
      Reflect.deleteProperty(globalThis, 'navigator');
    } else {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: originalNavigator,
      });
    }
  };
}

describe('taskflow webmcp bridge', () => {
  it('stays dormant when WebMCP is unavailable', async () => {
    const controller = createTaskFlowRuntimeController({
      storage: createMemoryStorage(),
      clockFactory: () => createClockStamp(new Date('2026-04-10T09:00:00.000Z')),
    });
    const bridge = createTaskFlowWebMcpBridge(controller);

    expect(bridge.supported).toBe(false);
    await bridge.start();
    await bridge.stop();
    controller.dispose();
  });

  it('registers tools once and reads fresh context through get_taskflow_context', async () => {
    const registrations = new Map<
      string,
      {
        tool: WebMcpToolDescriptor;
        signal: AbortSignal | undefined;
      }
    >();
    const unregisterTool = vi.fn(async (toolName: string) => {
      registrations.delete(toolName);
    });
    const registerTool = vi.fn(
      async (tool: WebMcpToolDescriptor, options?: WebMcpRegisterToolOptions) => {
        registrations.set(tool.name, {
          tool,
          signal: options?.signal,
        });
      },
    );
    const restoreGlobals = setModelContextWindow({
      registerTool,
      unregisterTool,
    });

    try {
      const controller = createTaskFlowRuntimeController({
        storage: createMemoryStorage(),
        clockFactory: () => createClockStamp(new Date('2026-04-10T09:00:00.000Z')),
      });
      const bridge = createTaskFlowWebMcpBridge(controller);

      await bridge.start();

      expect(bridge.supported).toBe(true);
      expect(registerTool).toHaveBeenCalled();
      expect([...registrations.keys()].sort()).toEqual([
        'activate_hovered_target',
        'create_task',
        'delete_task',
        'get_taskflow_context',
        'inspect_hovered_target',
        'move_task',
        'restore_task',
        'search_lineage',
        'select_task',
        'task_brief_list',
        'update_task',
      ]);
      for (const registration of registrations.values()) {
        expect(registration.signal).toBeInstanceOf(AbortSignal);
      }

      const taskId = controller.getSnapshot().state?.activeTasks[0]?.id;

      if (!taskId) {
        throw new Error('Expected a seeded task to exist.');
      }

      const selectTool = registrations.get('select_task')?.tool;

      if (!selectTool) {
        throw new Error('Expected select_task to be registered.');
      }

      const selectResponse = await selectTool.execute({ taskId }, undefined) as TaskFlowWebMcpToolResponse;
      expect(selectResponse.structuredContent.state).toBe('success');

      await new Promise((resolve) => setTimeout(resolve, 0));

      const contextTool = registrations.get('get_taskflow_context')?.tool;

      if (!contextTool) {
        throw new Error('Expected get_taskflow_context to be registered.');
      }

      const contextResponse = await contextTool.execute({}, undefined) as TaskFlowWebMcpToolResponse;
      expect(contextResponse.structuredContent.state).toBe('success');
      if (contextResponse.structuredContent.state === 'success') {
        expect(contextResponse.structuredContent.context?.selectedTaskId).toBe(taskId);
      }

      const deleteTool = registrations.get('delete_task')?.tool;

      if (!deleteTool) {
        throw new Error('Expected delete_task to be registered.');
      }

      const pendingDelete = await deleteTool.execute({ taskId }, undefined) as TaskFlowWebMcpToolResponse;
      expect(pendingDelete.structuredContent.state).toBe('requires_confirmation');

      const confirmedDelete = await deleteTool.execute(
        { taskId, confirmed: true },
        undefined,
      ) as TaskFlowWebMcpToolResponse;
      expect(confirmedDelete.structuredContent.state).toBe('success');

      await bridge.stop();
      expect(unregisterTool).toHaveBeenCalled();
      expect(registrations.size).toBe(0);

      controller.dispose();
    } finally {
      restoreGlobals();
    }
  });

  it('retries bridge startup when modelContext appears after initial mount', async () => {
    const restoreGlobals = setModelContextWindow(undefined);

    try {
      const controller = createTaskFlowRuntimeController({
        storage: createMemoryStorage(),
        clockFactory: () => createClockStamp(new Date('2026-04-10T09:00:00.000Z')),
      });
      const bridge = createTaskFlowWebMcpBridge(controller);

      expect(bridge.supported).toBe(false);
      await bridge.start();

      const registrations = new Map<string, WebMcpToolDescriptor>();
      const registerTool = vi.fn(async (tool: WebMcpToolDescriptor) => {
        registrations.set(tool.name, tool);
      });

      Object.defineProperty(globalThis.window.navigator, 'modelContext', {
        configurable: true,
        value: {
          registerTool,
        },
      });
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: globalThis.window.navigator,
      });

      await bridge.start();

      expect(registerTool).toHaveBeenCalled();
      expect(registrations.has('get_taskflow_context')).toBe(true);

      await bridge.stop();
      controller.dispose();
    } finally {
      restoreGlobals();
    }
  });

  it('exposes a debug API for registered tools and lifecycle state', async () => {
    const registrations = new Map<string, WebMcpToolDescriptor>();
    const registerTool = vi.fn(async (tool: WebMcpToolDescriptor) => {
      registrations.set(tool.name, tool);
    });
    const unregisterTool = vi.fn(async (toolName: string) => {
      registrations.delete(toolName);
    });
    const restoreGlobals = setModelContextWindow({
      registerTool,
      unregisterTool,
    });

    try {
      const controller = createTaskFlowRuntimeController({
        storage: createMemoryStorage(),
        clockFactory: () => createClockStamp(new Date('2026-04-10T09:00:00.000Z')),
      });
      const bridge = createTaskFlowWebMcpBridge(controller);

      await bridge.start();

      const debugApi = bridge.createDebugApi();
      expect(debugApi.listTools()).toContain('get_taskflow_context');
      expect(debugApi.status().active).toBe(true);
      expect(debugApi.status().toolNames).toContain('create_task');
      expect(debugApi.lastLifecycleEvents().length).toBeGreaterThan(0);

      await debugApi.restart();

      expect(debugApi.status().active).toBe(true);
      expect(registerTool).toHaveBeenCalled();

      await bridge.stop();
      controller.dispose();
    } finally {
      restoreGlobals();
    }
  });
});
