import type {
  TaskFlowWebMcpToolName,
  TaskFlowWebMcpToolResponse,
} from '@/types/taskflow-webmcp';
import type { WebMcpAgent, WebMcpToolDescriptor } from '@/types/webmcp';

const EMPTY_INPUT_SCHEMA = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const;

const TASK_STATUS_SCHEMA = {
  type: 'string',
  enum: ['todo', 'in-progress', 'review', 'done'],
} as const;

const TASK_PRIORITY_SCHEMA = {
  type: 'string',
  enum: ['low', 'medium', 'high'],
} as const;

const LINEAGE_KIND_SCHEMA = {
  type: 'string',
  enum: ['genesis', 'seed', 'ui', 'mutation'],
} as const;

interface TaskFlowWebMcpCatalogOptions {
  executeTool: (
    toolName: TaskFlowWebMcpToolName,
    input: Record<string, unknown>,
    agent: WebMcpAgent | undefined,
  ) => Promise<TaskFlowWebMcpToolResponse>;
}

function createTaskInputSchema() {
  return {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Task title.' },
      description: { type: 'string', description: 'Optional task description.' },
      status: { ...TASK_STATUS_SCHEMA, description: 'Initial task status.' },
      priority: { ...TASK_PRIORITY_SCHEMA, description: 'Task priority.' },
      assignee: { type: 'string', description: 'Task assignee.' },
      dueDate: { type: 'string', description: 'ISO due date string.' },
      tags: {
        type: 'array',
        description: 'Optional tag list.',
        items: { type: 'string' },
      },
    },
    required: ['title'],
    additionalProperties: false,
  } as const;
}

function updateTaskInputSchema() {
  return {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: 'Task identifier.' },
      title: { type: 'string', description: 'Updated task title.' },
      description: { type: 'string', description: 'Updated task description.' },
      status: { ...TASK_STATUS_SCHEMA, description: 'Updated task status.' },
      priority: { ...TASK_PRIORITY_SCHEMA, description: 'Updated task priority.' },
      assignee: { type: 'string', description: 'Updated assignee.' },
      dueDate: { type: 'string', description: 'Updated ISO due date string.' },
      tags: {
        type: 'array',
        description: 'Updated tag list.',
        items: { type: 'string' },
      },
    },
    required: ['taskId'],
    additionalProperties: false,
  } as const;
}

function moveTaskInputSchema() {
  return {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: 'Task identifier.' },
      newStatus: { ...TASK_STATUS_SCHEMA, description: 'Target status.' },
    },
    required: ['taskId', 'newStatus'],
    additionalProperties: false,
  } as const;
}

function deleteTaskInputSchema() {
  return {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: 'Task identifier.' },
      confirmed: {
        type: 'boolean',
        description: 'Set to true on the second call to confirm deletion.',
      },
    },
    required: ['taskId'],
    additionalProperties: false,
  } as const;
}

function selectTaskInputSchema() {
  return {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: 'Task identifier.' },
    },
    required: ['taskId'],
    additionalProperties: false,
  } as const;
}

function searchLineageInputSchema() {
  return {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Free-text lineage query.' },
      actionNames: {
        type: 'array',
        description: 'Action names to match.',
        items: { type: 'string' },
      },
      kinds: {
        type: 'array',
        description: 'Lineage kinds to match.',
        items: LINEAGE_KIND_SCHEMA,
      },
      branchName: { type: 'string', description: 'Optional branch filter.' },
      onlyHeads: { type: 'boolean', description: 'Restrict to lineage heads.' },
      limit: {
        type: 'number',
        description: 'Maximum number of matches to return.',
        minimum: 1,
        maximum: 20,
      },
    },
    additionalProperties: false,
  } as const;
}

function taskBriefListInputSchema() {
  return {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Free-text task search.' },
      assignee: { type: 'string', description: 'Assignee filter.' },
      status: { ...TASK_STATUS_SCHEMA, description: 'Status filter.' },
      priority: { ...TASK_PRIORITY_SCHEMA, description: 'Priority filter.' },
      tag: { type: 'string', description: 'Tag filter.' },
      includeDeleted: { type: 'boolean', description: 'Include trashed tasks.' },
      limit: {
        type: 'number',
        description: 'Maximum number of tasks to return.',
        minimum: 1,
        maximum: 20,
      },
    },
    additionalProperties: false,
  } as const;
}

function getTaskflowContextInputSchema() {
  return {
    type: 'object',
    properties: {
      detail: {
        type: 'string',
        enum: ['full', 'summary'],
        description: 'Use full to return the complete context payload.',
      },
    },
    additionalProperties: false,
  } as const;
}

export function createTaskFlowWebMcpCatalog({
  executeTool,
}: TaskFlowWebMcpCatalogOptions): WebMcpToolDescriptor[] {
  const defineTool = (
    name: TaskFlowWebMcpToolName,
    description: string,
    inputSchema: Record<string, unknown>,
  ): WebMcpToolDescriptor => ({
    name,
    description,
    inputSchema,
    execute: (input, agent) => executeTool(name, input, agent),
  });

  return [
    defineTool(
      'get_taskflow_context',
      'Read the current TaskFlow runtime context, including snapshot, lineage, selection, hover grounding, and UI session state.',
      getTaskflowContextInputSchema(),
    ),
    defineTool('create_task', 'Create a new task in TaskFlow.', createTaskInputSchema()),
    defineTool('update_task', 'Update an existing task in TaskFlow.', updateTaskInputSchema()),
    defineTool('move_task', 'Move a task to a different status.', moveTaskInputSchema()),
    defineTool(
      'delete_task',
      'Soft-delete a task. First call returns a confirmation requirement; call again with confirmed=true to proceed.',
      deleteTaskInputSchema(),
    ),
    defineTool('restore_task', 'Restore a task from trash.', selectTaskInputSchema()),
    defineTool('select_task', 'Select and open a task in the TaskFlow UI.', selectTaskInputSchema()),
    defineTool(
      'search_lineage',
      'Search lineage history by text, action name, branch, or lineage kind.',
      searchLineageInputSchema(),
    ),
    defineTool(
      'task_brief_list',
      'Return matching task briefs by assignee, status, priority, tag, or free-text query.',
      taskBriefListInputSchema(),
    ),
    defineTool(
      'inspect_hovered_target',
      'Inspect the currently hovered semantic UI target.',
      EMPTY_INPUT_SCHEMA,
    ),
    defineTool(
      'activate_hovered_target',
      'Activate the currently hovered semantic UI target when it is actionable.',
      EMPTY_INPUT_SCHEMA,
    ),
  ];
}

