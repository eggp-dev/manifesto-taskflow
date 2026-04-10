'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Clock3, GitBranch, X } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTaskFlowSemanticHoverTarget } from '@/hooks/useTaskFlowSemanticHoverTarget';
import { cn } from '@/lib/utils';
import type { TaskFlowHistoryEntry } from '@/types/taskflow';

interface LineagePanelProps {
  activeBranchName: string | null;
  entries: TaskFlowHistoryEntry[];
  hoveredWorldId?: string | null;
  onClose: () => void;
}

export function LineagePanel({
  activeBranchName,
  entries,
  hoveredWorldId = null,
  onClose,
}: LineagePanelProps) {
  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-12 items-center justify-between border-b bg-muted/50 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Clock3 className="h-4 w-4 text-primary" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Lineage history</p>
            <p className="truncate text-[11px] text-muted-foreground">
              Active branch: {activeBranchName ?? 'main'}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="h-full">
        <div className="space-y-3 p-4">
          {entries.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No lineage commits yet.
            </div>
          ) : (
            entries.map((entry) => (
              <LineageEntryCard
                key={entry.attemptId}
                entry={entry}
                isSemanticHovered={hoveredWorldId === entry.worldId}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function LineageEntryCard({
  entry,
  isSemanticHovered,
}: {
  entry: TaskFlowHistoryEntry;
  isSemanticHovered: boolean;
}) {
  const hoverProps = useTaskFlowSemanticHoverTarget(() => ({
    kind: 'lineage-entry',
    label: entry.summary,
    capturedAt: Date.now(),
    availableActions: ['inspect_hovered_target', 'search_lineage'],
    worldId: entry.worldId,
    branchName: entry.branchName,
    actionName: entry.actionName,
    summary: entry.summary,
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
      <article
        className={cn(
          'relative rounded-xl border bg-card p-4 shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary',
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
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{entry.summary}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
              {entry.actionName}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {entry.isVisible ? (
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                visible
              </Badge>
            ) : null}
            {entry.isHead ? (
              <Badge variant="secondary">head</Badge>
            ) : null}
            <Badge variant="outline">{entry.kind}</Badge>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <GitBranch className="h-3.5 w-3.5" />
          <span>{entry.branchName}</span>
          <span>•</span>
          <span>{formatDistanceToNow(entry.createdAt, { addSuffix: true })}</span>
        </div>

        <div className="space-y-1 text-xs text-muted-foreground">
          <p>{format(entry.createdAt, 'MMM d, yyyy h:mm:ss a')}</p>
        </div>
      </article>
    </motion.div>
  );
}
