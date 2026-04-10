'use client';

import { Clock3, GitBranch, X } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { TaskFlowHistoryEntry } from '@/types/taskflow';

interface LineagePanelProps {
  activeBranchName: string | null;
  entries: TaskFlowHistoryEntry[];
  onClose: () => void;
}

function shortenId(value: string): string {
  return value.slice(0, 12);
}

export function LineagePanel({
  activeBranchName,
  entries,
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
              <article
                key={entry.attemptId}
                className="rounded-xl border bg-card p-4 shadow-sm"
              >
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

                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <p>World: {shortenId(entry.worldId)}</p>
                  <p>Attempt: {shortenId(entry.attemptId)}</p>
                  <p>{format(entry.createdAt, 'MMM d, yyyy h:mm:ss a')}</p>
                </div>
              </article>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
