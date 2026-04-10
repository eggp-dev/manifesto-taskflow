'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTaskFlowSemanticHoverTarget } from '@/hooks/useTaskFlowSemanticHoverTarget';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import type { Task } from '@/types/taskflow';
import { formatDistanceToNow, parseISO } from 'date-fns';

const priorityColors = {
  low: 'bg-secondary text-secondary-foreground',
  medium: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  high: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

interface TrashViewProps {
  tasks: Task[];
  hoveredTaskId?: string | null;
  onRestore?: (id: string) => void;
  onPermanentlyDelete?: (id: string) => void;
  onEmptyTrash?: () => void;
}

export function TrashView({
  tasks,
  hoveredTaskId = null,
  onRestore,
  onPermanentlyDelete,
  onEmptyTrash,
}: TrashViewProps) {
  const deletedTasks = tasks.filter((task) => task.deletedAt !== null);

  if (deletedTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Trash2 className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">Trash is empty</p>
        <p className="text-sm">Deleted tasks will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Empty Trash button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Trash2 className="h-5 w-5" />
          <span className="font-medium">{deletedTasks.length} deleted tasks</span>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="h-4 w-4 mr-2" />
              Empty Trash
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Empty Trash
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all {deletedTasks.length} tasks in the trash.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onEmptyTrash?.()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete All
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Deleted tasks list */}
      <div className="space-y-2">
        {deletedTasks.map((task) => (
          <TrashTaskRow
            key={task.id}
            task={task}
            isSemanticHovered={hoveredTaskId === task.id}
            onRestore={onRestore}
            onPermanentlyDelete={onPermanentlyDelete}
          />
        ))}
      </div>
    </div>
  );
}

function TrashTaskRow({
  task,
  isSemanticHovered,
  onRestore,
  onPermanentlyDelete,
}: {
  task: Task;
  isSemanticHovered: boolean;
  onRestore?: (id: string) => void;
  onPermanentlyDelete?: (id: string) => void;
}) {
  const hoverProps = useTaskFlowSemanticHoverTarget(() => ({
    kind: 'task-card',
    taskId: task.id,
    label: task.title,
    capturedAt: Date.now(),
    availableActions: [
      'inspect_hovered_target',
      'restore_task',
      'activate_hovered_target',
      'search_lineage',
    ],
  }));

  return (
    <motion.div
      animate={
        isSemanticHovered
          ? { opacity: 1, scale: 0.95 }
          : { opacity: 1, scale: 1 }
      }
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="relative"
    >
      <AnimatePresence>
        {isSemanticHovered ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute -inset-1 rounded-[1rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),rgba(56,189,248,0.08)_42%,transparent_72%)] blur-lg"
          />
        ) : null}
      </AnimatePresence>
      <div
        className={cn(
          'relative flex items-center justify-between rounded-lg border bg-card p-4 transition-colors',
          isSemanticHovered && 'border-white/14 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_18px_34px_rgba(15,23,42,0.16)] backdrop-blur-xl'
        )}
        tabIndex={0}
        {...hoverProps}
      >
        <AnimatePresence>
          {isSemanticHovered ? (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent"
              />
              <motion.span
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                className="pointer-events-none absolute top-2.5 right-2.5 h-2.5 w-2.5 rounded-full border border-white/30 bg-sky-300/75 shadow-[0_0_10px_rgba(125,211,252,0.5)]"
              />
            </>
          ) : null}
        </AnimatePresence>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{task.title}</span>
            <Badge variant="outline" className={cn('text-xs', priorityColors[task.priority])}>
              {task.priority}
            </Badge>
          </div>
          {task.deletedAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              Deleted {formatDistanceToNow(parseISO(task.deletedAt), { addSuffix: true })}
            </p>
          )}
        </div>
        <div className="ml-4 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRestore?.(task.id)}
          >
            <RotateCcw className="mr-1 h-4 w-4" />
            Restore
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Permanently</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to permanently delete {task.title}?
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onPermanentlyDelete?.(task.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </motion.div>
  );
}
