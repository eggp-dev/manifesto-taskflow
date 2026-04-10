'use client';

import { motion } from 'framer-motion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useTaskFlowSemanticHoverTarget } from '@/hooks/useTaskFlowSemanticHoverTarget';
import { cn } from '@/lib/utils';
import type { Task } from '@/types/taskflow';
import { format, parseISO } from 'date-fns';

// Notion-style subtle colors
const priorityColors = {
  low: 'bg-secondary text-secondary-foreground',
  medium: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  high: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

const statusColors = {
  todo: 'bg-secondary text-secondary-foreground',
  'in-progress': 'bg-primary/10 text-primary',
  review: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  done: 'bg-green-500/10 text-green-600 dark:text-green-400',
};

const statusLabels = {
  todo: 'To Do',
  'in-progress': 'In Progress',
  review: 'Review',
  done: 'Done',
};

interface TableViewProps {
  tasks: Task[];
  selectedTaskId: string | null;
  hoveredTaskId?: string | null;
  onSelectTask: (taskId: string) => void;
}

export function TableView({
  tasks,
  selectedTaskId,
  hoveredTaskId = null,
  onSelectTask,
}: TableViewProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No visible tasks in this shell view.
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table className="min-w-[500px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]"></TableHead>
            <TableHead>Title</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
            <TableHead className="w-[80px] hidden sm:table-cell">Priority</TableHead>
            <TableHead className="w-[100px] hidden md:table-cell">Due Date</TableHead>
            <TableHead className="w-[100px] hidden lg:table-cell">Assignee</TableHead>
            <TableHead className="w-[120px] hidden lg:table-cell">Tags</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TaskTableRow
              key={task.id}
              task={task}
              isSelected={selectedTaskId === task.id}
              isSemanticHovered={hoveredTaskId === task.id}
              onSelectTask={onSelectTask}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TaskTableRow({
  task,
  isSelected,
  isSemanticHovered,
  onSelectTask,
}: {
  task: Task;
  isSelected: boolean;
  isSemanticHovered: boolean;
  onSelectTask: (taskId: string) => void;
}) {
  const hoverProps = useTaskFlowSemanticHoverTarget(() => ({
    kind: 'task-card',
    taskId: task.id,
    label: task.title,
    capturedAt: Date.now(),
    availableActions: [
      'inspect_hovered_target',
      'activate_hovered_target',
      'select_task',
      'update_task',
      'move_task',
      'delete_task',
    ],
  }));
  const isActiveVisual = isSemanticHovered || isSelected;

  return (
    <motion.tr
      animate={
        isActiveVisual
          ? { opacity: 1, scale: 0.95 }
          : { opacity: 1, scale: 1 }
      }
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={cn(
        'cursor-pointer touch-manipulation border-b transition-colors',
        isSelected && 'bg-muted/70',
        isActiveVisual && 'bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl'
      )}
      onClick={() => onSelectTask(task.id)}
      tabIndex={0}
      {...hoverProps}
    >
      <TableCell className="py-3">
        <Checkbox
          checked={task.status === 'done'}
          disabled
          onClick={(e) => e.stopPropagation()}
          className="h-5 w-5"
        />
      </TableCell>
      <TableCell className="py-3">
        <div>
          <div
            className={cn(
              'font-medium',
              task.status === 'done' && 'line-through text-muted-foreground'
            )}
          >
            {task.title}
          </div>
          {task.description && (
            <div className="text-xs text-muted-foreground line-clamp-1">
              {task.description}
            </div>
          )}
          <div className="mt-1 flex items-center gap-2 sm:hidden">
            <Badge variant="outline" className={cn('text-xs', priorityColors[task.priority])}>
              {task.priority}
            </Badge>
            {task.dueDate && (
              <span className="text-xs text-muted-foreground">
                {format(parseISO(task.dueDate), 'MMM d')}
              </span>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="py-3">
        <Badge variant="outline" className={cn('text-xs', statusColors[task.status])}>
          {statusLabels[task.status]}
        </Badge>
      </TableCell>
      <TableCell className="hidden py-3 sm:table-cell">
        <Badge variant="outline" className={cn('text-xs', priorityColors[task.priority])}>
          {task.priority}
        </Badge>
      </TableCell>
      <TableCell className="hidden py-3 text-sm text-muted-foreground md:table-cell">
        {task.dueDate ? format(parseISO(task.dueDate), 'MMM d, yyyy') : '-'}
      </TableCell>
      <TableCell className="hidden py-3 text-sm text-muted-foreground lg:table-cell">
        {task.assignee || '-'}
      </TableCell>
      <TableCell className="hidden py-3 lg:table-cell">
        <div className="flex flex-wrap gap-1">
          {task.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {task.tags.length > 2 && (
            <Badge variant="secondary" className="text-xs">
              +{task.tags.length - 2}
            </Badge>
          )}
        </div>
      </TableCell>
    </motion.tr>
  );
}
