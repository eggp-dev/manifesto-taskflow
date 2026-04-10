'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useTaskFlowSemanticHoverTarget } from '@/hooks/useTaskFlowSemanticHoverTarget';
import { cn } from '@/lib/utils';
import type { Task } from '@/types/taskflow';

interface TaskCardProps {
  task: Task;
  isSelected?: boolean;
  showCheckbox?: boolean;
  onSelect?: () => void;
  onToggleComplete?: () => void;
  className?: string;
  enableSemanticHover?: boolean;
  isSemanticHovered?: boolean;
}

const priorityColors = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800',
};

export function TaskCard({
  task,
  isSelected,
  showCheckbox,
  onSelect,
  onToggleComplete,
  className,
  enableSemanticHover = true,
  isSemanticHovered = false,
}: TaskCardProps) {
  const hoverProps = useTaskFlowSemanticHoverTarget(
    enableSemanticHover
      ? () => ({
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
        })
      : null,
  );
  const isActiveVisual = isSemanticHovered || isSelected;

  return (
    <motion.div
      animate={
        isActiveVisual
          ? { opacity: 1, scale: 0.95 }
          : { opacity: 1, scale: 1 }
      }
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="relative"
    >
      <AnimatePresence>
        {isActiveVisual ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="pointer-events-none absolute -inset-1 rounded-[1.15rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),rgba(56,189,248,0.08)_38%,transparent_72%)] blur-lg"
          />
        ) : null}
      </AnimatePresence>

      <Card
        className={cn(
          'relative cursor-pointer overflow-hidden transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          'touch-manipulation active:scale-[0.98] active:shadow-sm',
          isSelected && 'ring-2 ring-primary/70',
          isActiveVisual && 'border-white/14 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_18px_38px_rgba(15,23,42,0.18)] backdrop-blur-xl',
          task.status === 'done' && 'opacity-75',
          className
        )}
        tabIndex={enableSemanticHover ? 0 : undefined}
        onClick={onSelect}
        {...hoverProps}
      >
        <AnimatePresence>
          {isActiveVisual ? (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
              />
              <motion.span
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                className="pointer-events-none absolute top-2.5 right-2.5 h-2.5 w-2.5 rounded-full border border-white/30 bg-sky-300/75 shadow-[0_0_10px_rgba(125,211,252,0.55)]"
              />
            </>
          ) : null}
        </AnimatePresence>

        <CardHeader className="p-3 pb-2 sm:p-3">
          <div className="flex items-start gap-2 sm:gap-2">
            {showCheckbox && (
              <Checkbox
                checked={task.status === 'done'}
                disabled={!onToggleComplete}
                onCheckedChange={() => {
                  if (onToggleComplete) {
                    onToggleComplete();
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="mt-0.5 h-5 w-5 sm:h-4 sm:w-4"
              />
            )}
            <CardTitle
              className={cn(
                'text-sm font-medium leading-tight',
                task.status === 'done' && 'line-through text-muted-foreground'
              )}
            >
              {task.title}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-3 sm:pt-0">
          {task.description && (
            <p className="mb-2 line-clamp-2 text-xs text-muted-foreground">
              {task.description}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5 sm:gap-1">
            <Badge variant="outline" className={cn('text-xs', priorityColors[task.priority])}>
              {task.priority}
            </Badge>
            {task.assignee && (
              <Badge variant="outline" className="text-xs">
                {task.assignee}
              </Badge>
            )}
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
        </CardContent>
      </Card>
    </motion.div>
  );
}
