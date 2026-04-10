import { tool } from 'ai';
import { z } from 'zod';

const taskStatusSchema = z.enum(['todo', 'in-progress', 'review', 'done']);
const taskPrioritySchema = z.enum(['low', 'medium', 'high']);
const taskHistoryKindSchema = z.enum(['genesis', 'seed', 'ui', 'mutation']);
const lineageMatchSchema = z.object({
  worldId: z.string(),
  branchName: z.string(),
  actionName: z.string(),
  summary: z.string(),
  kind: taskHistoryKindSchema,
  createdAt: z.number(),
  isHead: z.boolean(),
  isVisible: z.boolean(),
});

export const taskFlowToolOutputSchema = z.object({
  ok: z.boolean(),
  summary: z.string(),
  taskId: z.string().optional(),
  title: z.string().optional(),
  status: taskStatusSchema.optional(),
  skipped: z.boolean().optional(),
  snapshotDiff: z.array(z.string()).optional(),
  matches: z.array(lineageMatchSchema).optional(),
});

export const taskFlowCreateTaskInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  assignee: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

export const taskFlowUpdateTaskInputSchema = z.object({
  taskId: z.string().min(1),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  assignee: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

export const taskFlowMoveTaskInputSchema = z.object({
  taskId: z.string().min(1),
  newStatus: taskStatusSchema,
});

export const taskFlowDeleteTaskInputSchema = z.object({
  taskId: z.string().min(1),
});

export const taskFlowRestoreTaskInputSchema = z.object({
  taskId: z.string().min(1),
});

export const taskFlowSelectTaskInputSchema = z.object({
  taskId: z.string().min(1),
});

export const taskFlowSearchLineageInputSchema = z.object({
  query: z.string().trim().min(1).optional(),
  actionNames: z.array(z.string().min(1)).optional(),
  kinds: z.array(taskHistoryKindSchema).optional(),
  branchName: z.string().trim().min(1).optional(),
  onlyHeads: z.boolean().optional(),
  limit: z.number().int().positive().max(20).optional(),
});

export const taskFlowAgentContextSchema = z.object({
  branchName: z.string().nullable(),
  visibleWorldId: z.string().nullable(),
  selectedTaskId: z.string().nullable(),
  selectedTask: z
    .object({
      id: z.string(),
      title: z.string(),
      description: z.string().nullable(),
      status: taskStatusSchema,
      priority: taskPrioritySchema,
      assignee: z.string().nullable(),
      dueDate: z.string().nullable(),
      tags: z.array(z.string()),
      deletedAt: z.string().nullable(),
    })
    .nullable(),
  snapshot: z.object({
    data: z.record(z.string(), z.unknown()),
    computed: z.record(z.string(), z.unknown()),
    system: z.record(z.string(), z.unknown()).nullable(),
  }),
  causalGraph: z.object({
    activeBranchId: z.string().nullable(),
    activeBranchName: z.string().nullable(),
    visibleWorldId: z.string().nullable(),
    headWorldIds: z.array(z.string()),
    nodes: z.array(
      z.object({
        worldId: z.string(),
        attemptId: z.string(),
        branchId: z.string(),
        branchName: z.string(),
        parentWorldId: z.string().nullable(),
        baseWorldId: z.string().nullable(),
        actionName: z.string(),
        summary: z.string(),
        kind: z.enum(['genesis', 'seed', 'ui', 'mutation']),
        createdAt: z.number(),
        isHead: z.boolean(),
        isVisible: z.boolean(),
      }),
    ),
    edges: z.array(
      z.object({
        edgeId: z.string(),
        from: z.string(),
        to: z.string(),
      }),
    ),
  }),
  counts: z.object({
    active: z.number().int().nonnegative(),
    deleted: z.number().int().nonnegative(),
    todo: z.number().int().nonnegative(),
    inProgress: z.number().int().nonnegative(),
    review: z.number().int().nonnegative(),
    done: z.number().int().nonnegative(),
  }),
  activeTasks: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string().nullable(),
      status: taskStatusSchema,
      priority: taskPrioritySchema,
      assignee: z.string().nullable(),
      dueDate: z.string().nullable(),
      tags: z.array(z.string()),
      deletedAt: z.string().nullable(),
    }),
  ),
  deletedTasks: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string().nullable(),
      status: taskStatusSchema,
      priority: taskPrioritySchema,
      assignee: z.string().nullable(),
      dueDate: z.string().nullable(),
      tags: z.array(z.string()),
      deletedAt: z.string().nullable(),
    }),
  ),
  recentHistory: z.array(
    z.object({
      worldId: z.string(),
      actionName: z.string(),
      summary: z.string(),
      kind: z.enum(['genesis', 'seed', 'ui', 'mutation']),
      createdAt: z.number(),
    }),
  ),
});

export function createTaskFlowAssistantTools() {
  return {
    create_task: tool({
      description:
        'Create a new task in TaskFlow. Use when the user asks to add, create, or capture work.',
      inputSchema: taskFlowCreateTaskInputSchema,
      outputSchema: taskFlowToolOutputSchema,
    }),
    update_task: tool({
      description:
        'Update an existing task by id. Use for title, description, priority, assignee, due date, tags, or status edits.',
      inputSchema: taskFlowUpdateTaskInputSchema,
      outputSchema: taskFlowToolOutputSchema,
    }),
    move_task: tool({
      description:
        'Move an existing task to another status when the user asks to advance or change task state.',
      inputSchema: taskFlowMoveTaskInputSchema,
      outputSchema: taskFlowToolOutputSchema,
    }),
    delete_task: tool({
      description:
        'Soft-delete an existing task by id. This requires explicit client confirmation before it is committed.',
      inputSchema: taskFlowDeleteTaskInputSchema,
      outputSchema: taskFlowToolOutputSchema,
    }),
    restore_task: tool({
      description: 'Restore a soft-deleted task from trash by id.',
      inputSchema: taskFlowRestoreTaskInputSchema,
      outputSchema: taskFlowToolOutputSchema,
    }),
    select_task: tool({
      description:
        'Select or open an existing task by id. Use when the user asks to open, select, focus, inspect, or show a task.',
      inputSchema: taskFlowSelectTaskInputSchema,
      outputSchema: taskFlowToolOutputSchema,
    }),
    search_lineage: tool({
      description:
        'Search TaskFlow lineage history by keyword or filters. Use when the user asks what changed, what happened before, recent history, lineage, branch history, or prior task actions.',
      inputSchema: taskFlowSearchLineageInputSchema,
      outputSchema: taskFlowToolOutputSchema,
    }),
  };
}
