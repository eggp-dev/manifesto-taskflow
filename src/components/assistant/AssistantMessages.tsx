'use client';

import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  MessageSquare,
  Trash2,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ChatContainerContent,
  ChatContainerRoot,
} from '@/components/ui/chat-container';
import { ScrollButton } from '@/components/ui/scroll-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  TaskFlowAgentTaskSummary,
  TaskFlowLineageMatch,
  TaskFlowHoveredInspection,
  TaskFlowAssistantToolName,
  TaskFlowAssistantUIMessage,
  TaskFlowAssistantUITools,
} from '@/types/taskflow-assistant';

type AssistantPart = TaskFlowAssistantUIMessage['parts'][number];
type ToolPart = Extract<AssistantPart, { toolCallId: string }>;
type DeleteToolPart = ToolPart & {
  type: 'tool-delete_task';
  input: TaskFlowAssistantUITools['delete_task']['input'];
};

interface AssistantMessagesProps {
  messages: TaskFlowAssistantUIMessage[];
  isLoading?: boolean;
  onApproveDelete?: (
    toolCallId: string,
    input: TaskFlowAssistantUITools['delete_task']['input'],
  ) => Promise<void>;
  onDenyDelete?: (
    toolCallId: string,
    input: TaskFlowAssistantUITools['delete_task']['input'],
  ) => Promise<void>;
}

const TOOL_LABELS: Record<TaskFlowAssistantToolName, string> = {
  create_task: 'Create task',
  update_task: 'Update task',
  move_task: 'Move task',
  delete_task: 'Delete task',
  restore_task: 'Restore task',
  select_task: 'Select task',
  search_lineage: 'Search lineage',
  task_brief_list: 'Task brief list',
  inspect_hovered_target: 'Inspect hover',
  activate_hovered_target: 'Activate hover',
};

function isToolPart(part: AssistantPart): part is ToolPart {
  return 'toolCallId' in part;
}

function isDeleteToolPart(part: ToolPart): part is DeleteToolPart {
  return part.type === 'tool-delete_task';
}

function getToolName(part: ToolPart): TaskFlowAssistantToolName {
  return part.type.slice(5) as TaskFlowAssistantToolName;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function getStringField(value: unknown, key: string): string | null {
  const record = asRecord(value);
  const field = record?.[key];

  return typeof field === 'string' && field.length > 0 ? field : null;
}

function formatIdentifier(value: string): string {
  if (value.length <= 14) {
    return value;
  }

  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function getHoveredTargetLabel(value: unknown): string | null {
  const record = asRecord(value);
  const hoveredTarget = asRecord(record?.hoveredTarget);
  const label = hoveredTarget?.label;

  return typeof label === 'string' && label.length > 0 ? label : null;
}

function getToolPreview(
  toolName: TaskFlowAssistantToolName,
  input: unknown,
  output?: unknown,
): string {
  switch (toolName) {
    case 'create_task': {
      const title = getStringField(input, 'title') ?? getStringField(output, 'title');
      return title ? `Creating "${title}"` : 'Creating a task';
    }
    case 'update_task': {
      return 'Updating a task';
    }
    case 'move_task': {
      return 'Moving a task';
    }
    case 'delete_task': {
      return 'Delete a task';
    }
    case 'restore_task': {
      return 'Restore a task';
    }
    case 'select_task': {
      const taskId = getStringField(input, 'taskId') ?? getStringField(output, 'taskId');
      const title = getStringField(output, 'title');

      if (taskId && title) {
        return `Selecting ${formatIdentifier(taskId)} ("${title}")`;
      }

      if (taskId) {
        return `Selecting ${formatIdentifier(taskId)}`;
      }

      return 'Selecting a task';
    }
    case 'search_lineage': {
      const query = getStringField(input, 'query');
      const branchName = getStringField(input, 'branchName');
      const record = asRecord(input);
      const onlyHeads = record?.onlyHeads === true;

      if (query) {
        return `Searching lineage for "${query}"`;
      }

      if (branchName) {
        return `Searching lineage in branch "${branchName}"`;
      }

      if (onlyHeads) {
        return 'Searching lineage heads';
      }

      return 'Searching lineage history';
    }
    case 'task_brief_list': {
      const query = getStringField(input, 'query');
      const assignee = getStringField(input, 'assignee');
      const status = getStringField(input, 'status');

      if (assignee) {
        return `Listing tasks assigned to "${assignee}"`;
      }

      if (status) {
        return `Listing tasks in ${status}`;
      }

      if (query) {
        return `Listing tasks matching "${query}"`;
      }

      return 'Listing task briefs';
    }
    case 'inspect_hovered_target': {
      const label = getHoveredTargetLabel(output);
      return label ? `Inspecting "${label}"` : 'Inspecting the hovered target';
    }
    case 'activate_hovered_target': {
      const label = getHoveredTargetLabel(output);
      return label ? `Activating "${label}"` : 'Activating the hovered target';
    }
  }
}

function InspectionSection({ inspection }: { inspection: TaskFlowHoveredInspection }) {
  return (
    <div className="mt-3 rounded-[14px] border border-white/7 bg-[#121212] px-3 py-2.5">
      <p className="text-[10px] font-medium tracking-[0.16em] text-white/38 uppercase">
        Hover context
      </p>
      <div className="mt-2 space-y-2">
        <div>
          <p className="text-sm font-medium text-white/84">{inspection.title}</p>
          <p className="mt-1 text-sm leading-6 text-white/56">{inspection.description}</p>
        </div>
        {inspection.metadata.length > 0 ? (
          <div className="space-y-1.5 text-[12px] leading-5 text-white/54">
            {inspection.metadata.map((item) => (
              <div key={`${item.label}:${item.value}`} className="flex gap-2">
                <span className="min-w-[5rem] shrink-0 text-white/36">{item.label}</span>
                <span className="min-w-0 break-words text-white/68">{item.value}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TaskBriefListSection({ tasks }: { tasks: TaskFlowAgentTaskSummary[] }) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 rounded-[14px] border border-white/7 bg-[#121212] px-3 py-2.5">
      <p className="text-[10px] font-medium tracking-[0.16em] text-white/38 uppercase">
        Task briefs
      </p>
      <div className="mt-2.5 space-y-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="rounded-[12px] border border-white/7 bg-white/[0.02] px-2.5 py-2"
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-white/44">
              <span className="font-mono text-white/40" title={task.id}>
                {formatIdentifier(task.id)}
              </span>
              <span>{task.status}</span>
              <span>{task.priority}</span>
              {task.assignee ? <span>{task.assignee}</span> : null}
              {task.deletedAt ? <span className="text-amber-200/90">deleted</span> : null}
            </div>
            <p className="mt-1.5 text-sm leading-5 text-white/82">{task.title}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] text-white/42">
              {task.tags.map((tag) => (
                <span
                  key={`${task.id}:${tag}`}
                  className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-0.5"
                >
                  {tag}
                </span>
              ))}
              {task.tags.length === 0 ? <span>no tags</span> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getStateBadgeClass(state: ToolPart['state']): string {
  switch (state) {
    case 'output-available':
      return 'border-emerald-400/20 bg-emerald-400/12 text-emerald-200';
    case 'output-error':
      return 'border-red-400/20 bg-red-400/12 text-red-200';
    case 'output-denied':
      return 'border-amber-400/20 bg-amber-400/12 text-amber-200';
    default:
      return 'border-white/10 bg-white/[0.04] text-white/58';
  }
}

function MarkdownContent({
  text,
  tone = 'assistant',
}: {
  text: string;
  tone?: 'assistant' | 'user' | 'subtle';
}) {
  return (
    <div
      className={cn(
        'max-w-none min-w-0 text-[14px] leading-7',
        tone === 'assistant' && 'text-[#e7e7e7]',
        tone === 'user' && 'text-[#f3f3f3]',
        tone === 'subtle' && 'text-white/52',
        '[&_p]:m-0 [&_p+p]:mt-4',
        '[&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6',
        '[&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6',
        '[&_li]:my-1.5',
        '[&_strong]:font-semibold [&_strong]:text-inherit',
        '[&_blockquote]:my-4 [&_blockquote]:border-l [&_blockquote]:border-white/12 [&_blockquote]:pl-4 [&_blockquote]:text-white/62',
        '[&_hr]:my-5 [&_hr]:border-white/8',
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ className, ...props }) => (
            <a
              {...props}
              className={cn(
                'text-sky-300 underline decoration-sky-300/35 underline-offset-4 hover:text-sky-200',
                className,
              )}
              target="_blank"
              rel="noreferrer"
            />
          ),
          table: ({ className, children, ...props }) => (
            <div className="my-4 -mx-1 overflow-x-auto pb-1">
              <table
                {...props}
                className={cn(
                  'min-w-[40rem] border-separate border-spacing-0 text-sm leading-6 text-[#e8e8e8]',
                  className,
                )}
              >
                {children}
              </table>
            </div>
          ),
          thead: ({ className, ...props }) => (
            <thead {...props} className={cn('bg-[#171717]', className)} />
          ),
          th: ({ className, ...props }) => (
            <th
              {...props}
              className={cn(
                'border-y border-white/10 bg-[#171717] px-4 py-3 text-left text-[12px] font-medium whitespace-nowrap text-white/64',
                className,
              )}
            />
          ),
          td: ({ className, ...props }) => (
            <td
              {...props}
              className={cn(
                'border-b border-white/8 px-4 py-3 align-top text-white/86',
                className,
              )}
            />
          ),
          pre: ({ className, ...props }) => (
            <pre
              {...props}
              className={cn(
                'my-4 overflow-x-auto rounded-[22px] border border-white/8 bg-[#0d0d0d] px-4 py-4 text-[13px] leading-6 text-[#f4f4f4] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] [&_code]:bg-transparent [&_code]:p-0',
                className,
              )}
            />
          ),
          code: ({ className, ...props }) => (
            <code
              {...props}
              className={cn(
                'rounded-md bg-white/[0.08] px-1.5 py-0.5 font-mono text-[0.92em] text-inherit',
                className,
              )}
            />
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

function UserMessage({ text }: { text: string }) {
  if (text.trim().length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex justify-end"
    >
      <div className="max-w-[78%] rounded-[24px] border border-white/8 bg-[#2a2a2a] px-4 py-3.5 shadow-[0_12px_32px_rgba(0,0,0,0.24)]">
        <MarkdownContent text={text} tone="user" />
      </div>
    </motion.div>
  );
}

function AssistantDocument({
  text,
  subtle = false,
}: {
  text: string;
  subtle?: boolean;
}) {
  if (text.trim().length === 0) {
    return null;
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="w-full"
    >
      <MarkdownContent text={text} tone={subtle ? 'subtle' : 'assistant'} />
    </motion.article>
  );
}

function TraceSection({ lines }: { lines: string[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (lines.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 rounded-[14px] border border-white/7 bg-[#121212] px-3 py-2.5">
      <button
        type="button"
        onClick={() => setIsExpanded((current) => !current)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-2">
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 text-white/36 transition-transform duration-200',
              isExpanded && 'rotate-90',
            )}
          />
          <p className="text-[10px] font-medium tracking-[0.16em] text-white/38 uppercase">
            Snapshot diff
          </p>
        </div>
        <span className="text-[10px] text-white/34">{isExpanded ? 'Hide' : 'Show'}</span>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-1.5 text-[12px] leading-5 text-white/56">
              {lines.map((line, index) => (
                <div key={`${line}:${index}`} className="flex gap-2">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-white/28" />
                  <p className="min-w-0">{line}</p>
                </div>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function LineageMatchesSection({ matches }: { matches: TaskFlowLineageMatch[] }) {
  if (matches.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 rounded-[14px] border border-white/7 bg-[#121212] px-3 py-2.5">
      <p className="text-[10px] font-medium tracking-[0.16em] text-white/38 uppercase">
        Lineage matches
      </p>
      <div className="mt-2.5 space-y-2">
        {matches.map((match) => (
          <div
            key={match.worldId}
            className="rounded-[12px] border border-white/7 bg-white/[0.02] px-2.5 py-2"
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-white/44">
              <span className="font-medium text-white/68">{match.actionName}</span>
              <span>{match.branchName}</span>
              {match.isHead ? <span className="text-emerald-200/90">head</span> : null}
              {match.isVisible ? <span className="text-sky-200/90">visible</span> : null}
            </div>
            <p className="mt-1.5 text-sm leading-5 text-white/82">{match.summary}</p>
            <p
              className="mt-1 font-mono text-[11px] leading-5 text-white/40"
              title={match.worldId}
            >
              {formatIdentifier(match.worldId)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ToolCard({
  part,
  stepNumber,
  onApproveDelete,
  onDenyDelete,
}: {
  part: ToolPart;
  stepNumber: number;
  onApproveDelete?: AssistantMessagesProps['onApproveDelete'];
  onDenyDelete?: AssistantMessagesProps['onDenyDelete'];
}) {
  const toolName = getToolName(part);
  const output =
    part.state === 'output-available'
      ? (part.output as TaskFlowAssistantUITools[typeof toolName]['output'])
      : null;
  const preview = getToolPreview(toolName, part.input, output);

  if (isDeleteToolPart(part) && part.state === 'input-available') {
    return (
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="w-full rounded-[18px] border border-white/7 bg-[#171717]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/7 px-3.5 py-2.5">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-white/42">Step {stepNumber}</span>
            <span className="font-medium text-white/74">Delete task</span>
          </div>
          <span className="text-[11px] text-amber-200/88">confirmation</span>
        </div>

        <div className="space-y-3 px-3.5 py-3">
          <div className="flex items-start gap-2.5">
            <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
            <p className="text-sm leading-6 text-white/60">
              {preview}. This only moves the task to trash.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="destructive"
              className="h-8 rounded-full px-3"
              onClick={() => {
                void onApproveDelete?.(part.toolCallId, part.input);
              }}
            >
              Delete
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-full border-white/10 bg-white/[0.03] px-3 text-white/72 hover:bg-white/[0.07] hover:text-white"
              onClick={() => {
                void onDenyDelete?.(part.toolCallId, part.input);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </motion.section>
    );
  }

  const title = TOOL_LABELS[toolName];

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="w-full rounded-[18px] border border-white/7 bg-[#171717]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/7 px-3.5 py-2.5">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-white/42">Step {stepNumber}</span>
          <span className="font-medium text-white/74">{title}</span>
        </div>
        <Badge className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', getStateBadgeClass(part.state))}>
          {part.state}
        </Badge>
      </div>

      <div className="space-y-3 px-3.5 py-3">
        <p className="text-sm leading-6 text-white/58">{preview}</p>

        {part.state === 'input-streaming' || part.state === 'input-available' ? (
          <div className="flex items-center gap-2 rounded-[14px] border border-white/7 bg-[#121212] px-3 py-2.5 text-sm text-white/50">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Waiting for the local runtime to apply this step.</span>
          </div>
        ) : null}

        {part.state === 'output-available' ? (
          <>
            <div className="flex items-start gap-2 rounded-[14px] border border-emerald-400/14 bg-emerald-400/[0.07] px-3 py-2.5 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              <p className="text-emerald-100/92">
                {output?.summary ?? 'Tool step completed.'}
              </p>
            </div>
            {output?.inspection ? (
              <InspectionSection inspection={output.inspection} />
            ) : null}
            <LineageMatchesSection matches={output?.matches ?? []} />
            <TaskBriefListSection tasks={output?.taskBriefList ?? []} />
            <TraceSection lines={output?.snapshotDiff ?? []} />
          </>
        ) : null}

        {part.state === 'output-error' ? (
          <div className="flex items-start gap-2 rounded-[14px] border border-red-400/16 bg-red-400/[0.06] px-3 py-2.5 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
            <p className="text-red-100/90">{part.errorText}</p>
          </div>
        ) : null}

        {part.state === 'output-denied' ? (
          <div className="rounded-[14px] border border-amber-400/16 bg-amber-400/[0.06] px-3 py-2.5 text-sm text-amber-100/90">
            This tool call was denied.
          </div>
        ) : null}
      </div>
    </motion.section>
  );
}

export function AssistantMessages({
  messages,
  isLoading = false,
  onApproveDelete,
  onDenyDelete,
}: AssistantMessagesProps) {
  const visibleMessages = messages.filter((message) => message.role !== 'system');
  const renderedParts = visibleMessages.reduce<{
    items: ReactNode[];
    toolStep: number;
  }>(
    (accumulator, message) =>
      message.parts.reduce<{
        items: ReactNode[];
        toolStep: number;
      }>((partAccumulator, part, index) => {
        if (part.type === 'text') {
          return {
            ...partAccumulator,
            items: [
              ...partAccumulator.items,
              message.role === 'user' ? (
                <UserMessage key={`${message.id}:text:${index}`} text={part.text} />
              ) : (
                <AssistantDocument key={`${message.id}:text:${index}`} text={part.text} />
              ),
            ],
          };
        }

        if (part.type === 'reasoning') {
          return {
            ...partAccumulator,
            items: [
              ...partAccumulator.items,
              <AssistantDocument
                key={`${message.id}:reasoning:${index}`}
                text={part.text}
                subtle
              />,
            ],
          };
        }

        if (isToolPart(part)) {
          const nextStep = partAccumulator.toolStep + 1;

          return {
            toolStep: nextStep,
            items: [
              ...partAccumulator.items,
              (
                <ToolCard
                  key={`${message.id}:${part.toolCallId}`}
                  part={part}
                  stepNumber={nextStep}
                  onApproveDelete={onApproveDelete}
                  onDenyDelete={onDenyDelete}
                />
              ),
            ],
          };
        }

        return partAccumulator;
      }, accumulator),
    { items: [], toolStep: 0 },
  ).items;

  return (
    <ChatContainerRoot className="relative min-h-0 flex-1 bg-[#111111]">
      <ChatContainerContent className="mx-auto flex w-full max-w-[860px] flex-col gap-6 px-3 py-5 sm:px-4">
        {visibleMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[28px] border border-white/8 bg-[#171717] px-6 py-12 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/8 bg-white/[0.03] text-white/40">
              <MessageSquare className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-white/78">TaskFlow Assistant</p>
            <p className="mt-2 max-w-[28rem] text-sm leading-6 text-white/46">
              Talk to anything
            </p>
          </div>
        ) : null}

        {renderedParts}

        <AnimatePresence>
          {isLoading ? (
            <motion.div
              key="assistant-loading"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="w-full rounded-[22px] border border-white/8 bg-[#171717] px-4 py-3.5 text-sm text-white/54 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
            >
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Working on the next TaskFlow step...</span>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </ChatContainerContent>

      <div className="absolute right-3 bottom-4 sm:right-4">
        <ScrollButton className="border-white/10 bg-[#1c1c1c] text-white/66 hover:bg-[#232323] hover:text-white" />
      </div>
    </ChatContainerRoot>
  );
}
