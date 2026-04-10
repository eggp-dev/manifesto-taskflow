'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, Clock3, MessageSquare, Plus } from 'lucide-react';
import { AssistantPanel } from '@/components/assistant';
import { LineagePanel } from '@/components/history/LineagePanel';
import { MobileNavigation } from '@/components/shared/MobileNavigation';
import {
  TaskEditorFields,
  createTaskEditorValues,
  toTaskDraft,
} from '@/components/shared/TaskEditorFields';
import { ViewSwitcher } from '@/components/shared/ViewSwitcher';
import { TaskDetailPanel } from '@/components/sidebar/TaskDetailPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { KanbanView } from '@/components/views/KanbanView';
import { TableView } from '@/components/views/TableView';
import { TodoView } from '@/components/views/TodoView';
import { TrashView } from '@/components/views/TrashView';
import { useIsDesktop, useIsMobile } from '@/hooks/useMediaQuery';
import { useTaskFlow } from '@/hooks/useTaskFlow';
import { useTaskFlowAssistant } from '@/hooks/useTaskFlowAssistant';
import { filterTasksByDate } from '@/lib/date-filter';
import type { DateFilter, ViewMode } from '@/types/taskflow';

function TasksHeader({
  activeCount,
  activeBranchName,
  inProgressCount,
  doneCount,
  dateFilter,
  deletedCount,
  historyCount,
  referenceNow,
  viewMode,
  onDateFilterChange,
  onOpenCreate,
  onOpenHistory,
  onViewModeChange,
}: {
  activeCount: number;
  activeBranchName: string | null;
  inProgressCount: number;
  doneCount: number;
  dateFilter: DateFilter | null;
  deletedCount: number;
  historyCount: number;
  referenceNow: string | null;
  viewMode: ViewMode;
  onDateFilterChange: (filter: DateFilter | null) => void;
  onOpenCreate: () => void;
  onOpenHistory: () => void;
  onViewModeChange: (viewMode: ViewMode) => void;
}) {
  const isMobile = useIsMobile();

  return (
    <header className="border-b bg-muted/20">
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
              TaskFlow
            </h1>
            {!isMobile && activeBranchName ? (
              <Badge
                variant="outline"
                className="hidden border-border/60 bg-background/65 px-2 py-0.5 text-[11px] text-muted-foreground md:inline-flex"
              >
                {activeBranchName}
              </Badge>
            ) : null}
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs text-muted-foreground lg:flex">
            <span className="font-medium text-foreground/90">{activeCount}</span>
            <span>active</span>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span className="font-medium text-primary">{inProgressCount}</span>
            <span>in progress</span>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span className="font-medium text-green-600 dark:text-green-400">{doneCount}</span>
            <span>done</span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button size={isMobile ? 'icon' : 'sm'} onClick={onOpenCreate}>
            <Plus className="h-4 w-4" />
            {isMobile ? null : <span>New task</span>}
          </Button>
          {isMobile ? (
            <Button variant="outline" size="icon" className="h-9 w-9" disabled>
              <Calendar className="h-4 w-4" />
            </Button>
          ) : (
            <DateRangePicker
              value={dateFilter}
              onChange={onDateFilterChange}
              placeholder="Date"
              referenceNow={referenceNow}
              className="w-[8.75rem] justify-start overflow-hidden [&>span:first-of-type]:truncate"
            />
          )}
          <Button
            variant="outline"
            size="icon"
            className="relative h-9 w-9"
            onClick={onOpenHistory}
            aria-label="Open history"
          >
            <Clock3 className="h-4 w-4" />
            {historyCount > 0 ? (
              <span className="absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                {historyCount > 99 ? '99+' : historyCount}
              </span>
            ) : null}
            <span className="sr-only">
              History {historyCount > 0 ? `(${historyCount})` : ''}
            </span>
          </Button>
          <div className="hidden sm:block">
            <ViewSwitcher
              viewMode={viewMode}
              deletedCount={deletedCount}
              onChange={onViewModeChange}
            />
          </div>
        </div>
      </div>
    </header>
  );
}

function AssistantToggle({
  assistantOpen,
  onOpen,
}: {
  assistantOpen: boolean;
  onOpen: () => void;
}) {
  if (assistantOpen) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      className="fixed bottom-[calc(var(--mobile-nav-height)+1rem)] right-4 z-50 sm:bottom-6 sm:right-6"
    >
      <div className="relative">
        <div className="pointer-events-none absolute inset-0 rounded-full bg-sky-400/18 blur-2xl" />
        <Button
          onClick={onOpen}
          size="lg"
          className="group relative h-[3.75rem] w-[3.75rem] overflow-hidden rounded-[22px] border border-sky-300/18 bg-[#171717]/96 text-[#eef7ff] shadow-[0_18px_42px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl transition-all duration-200 hover:border-sky-300/28 hover:bg-[#1a1a1a] hover:shadow-[0_22px_48px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.1)]"
        >
          <span className="pointer-events-none absolute inset-x-1 top-1 h-1/2 rounded-[18px]" />
          <span className="pointer-events-none absolute -right-3 -bottom-3 h-10 w-10 rounded-full bg-sky-400/20 blur-xl transition-transform duration-200 group-hover:scale-110" />
          <span className="pointer-events-none absolute top-2 right-2 h-2.5 w-2.5 rounded-full border border-sky-200/40 bg-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.7)]" />
          <MessageSquare className="relative z-10 h-6 w-6 drop-shadow-[0_1px_6px_rgba(56,189,248,0.28)]" />
          <span className="sr-only">Open assistant</span>
        </Button>
      </div>
    </motion.div>
  );
}

export interface TaskFlowPageClientProps {
  assistantConfigured: boolean;
  assistantDisabledMessage?: string;
}

export function TaskFlowPageClient({
  assistantConfigured,
  assistantDisabledMessage,
}: TaskFlowPageClientProps) {
  const { state, ready, actions } = useTaskFlow();
  const assistant = useTaskFlowAssistant({
    configured: assistantConfigured,
    disabledMessage: assistantDisabledMessage,
  });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createValues, setCreateValues] = useState(() => createTaskEditorValues());

  const isMobile = useIsMobile();
  const isDesktop = useIsDesktop();

  if (!ready || !state) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading lineage runtime...</p>
      </div>
    );
  }

  const {
    activeTasks,
    activeBranchName,
    deletedTasks,
    historyEntries,
    selectedTask,
    selectedTaskId,
    viewMode,
    assistantOpen,
    dateFilter,
    totalCount,
    inProgressCount,
    doneCount,
    deletedCount,
    clock,
  } = state;

  const filteredActiveTasks = filterTasksByDate(activeTasks, dateFilter, clock?.now ?? null);
  const canCreateTask = createValues.title.trim().length > 0;

  return (
    <div className="flex h-screen bg-background">
      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);

          if (!open) {
            setCreateValues(createTaskEditorValues());
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create task</DialogTitle>
            <DialogDescription>
              New tasks are committed through MEL and appear in lineage history immediately.
            </DialogDescription>
          </DialogHeader>

          <form
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            onSubmit={(event) => {
              event.preventDefault();
              if (!canCreateTask) {
                return;
              }

              actions.createTask(toTaskDraft(createValues));
              setCreateDialogOpen(false);
              setCreateValues(createTaskEditorValues());
            }}
          >
            <div className="flex-1 overflow-auto pr-1">
              <TaskEditorFields
                idPrefix="create-task"
                value={createValues}
                onChange={setCreateValues}
              />
            </div>
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setCreateDialogOpen(false);
                  setCreateValues(createTaskEditorValues());
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canCreateTask}>
                Create task
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {isDesktop ? (
        <AnimatePresence mode="wait">
          {selectedTask ? (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 400, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="flex-shrink-0 overflow-hidden border-r"
            >
              <div className="h-full w-[400px]">
                <TaskDetailPanel
                  task={selectedTask}
                  onClose={() => actions.selectTask(null)}
                  onDelete={actions.softDeleteTask}
                  onSave={actions.updateTask}
                />
              </div>
            </motion.aside>
          ) : null}
        </AnimatePresence>
      ) : (
        <Sheet
          open={selectedTask !== null}
          onOpenChange={(open) => {
            if (!open) {
              actions.selectTask(null);
            }
          }}
        >
          <SheetContent
            side={isMobile ? 'bottom' : 'right'}
            className={isMobile ? 'h-[90vh] rounded-t-xl p-0' : 'w-[400px] max-w-full p-0'}
            hideCloseButton
          >
            <span className="sr-only">
              <SheetTitle>Task details</SheetTitle>
              <SheetDescription>View and manage task details.</SheetDescription>
            </span>
            <TaskDetailPanel
              task={selectedTask}
              onClose={() => actions.selectTask(null)}
              onDelete={actions.softDeleteTask}
              onSave={actions.updateTask}
            />
          </SheetContent>
        </Sheet>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TasksHeader
          activeCount={totalCount}
          activeBranchName={activeBranchName}
          inProgressCount={inProgressCount}
          doneCount={doneCount}
          dateFilter={dateFilter}
          deletedCount={deletedCount}
          historyCount={historyEntries.length}
          referenceNow={clock?.now ?? null}
          viewMode={viewMode}
          onDateFilterChange={actions.setDateFilter}
          onOpenCreate={() => setCreateDialogOpen(true)}
          onOpenHistory={() => setHistoryOpen(true)}
          onViewModeChange={actions.changeView}
        />

        <AnimatePresence mode="wait">
          {viewMode === 'kanban' ? (
            <motion.main
              key="kanban"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="flex-1 overflow-hidden px-4 py-4 sm:px-6 sm:py-6"
            >
              <KanbanView
                tasks={filteredActiveTasks}
                selectedTaskId={selectedTaskId}
                onSelectTask={(taskId) => actions.selectTask(taskId)}
                onMoveTask={actions.moveTask}
              />
            </motion.main>
          ) : null}

          {viewMode === 'todo' ? (
            <motion.div
              key="todo"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="flex-1 overflow-hidden"
            >
              <ScrollArea className="h-full">
                <main className="px-4 py-4 sm:px-6 sm:py-6">
                  <TodoView
                    tasks={filteredActiveTasks}
                    selectedTaskId={selectedTaskId}
                    onSelectTask={(taskId) => actions.selectTask(taskId)}
                  />
                </main>
              </ScrollArea>
            </motion.div>
          ) : null}

          {viewMode === 'table' ? (
            <motion.div
              key="table"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="flex-1 overflow-hidden"
            >
              <ScrollArea className="h-full">
                <main className="px-4 py-4 sm:px-6 sm:py-6">
                  <TableView
                    tasks={filteredActiveTasks}
                    selectedTaskId={selectedTaskId}
                    onSelectTask={(taskId) => actions.selectTask(taskId)}
                  />
                </main>
              </ScrollArea>
            </motion.div>
          ) : null}

          {viewMode === 'trash' ? (
            <motion.div
              key="trash"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="flex-1 overflow-hidden"
            >
              <ScrollArea className="h-full">
                <main className="px-4 py-4 sm:px-6 sm:py-6">
                  <TrashView
                    tasks={deletedTasks}
                    onRestore={actions.restoreTask}
                    onPermanentlyDelete={actions.permanentlyDeleteTask}
                    onEmptyTrash={actions.emptyTrash}
                  />
                </main>
              </ScrollArea>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {isDesktop ? (
        <AnimatePresence mode="wait">
          {historyOpen ? (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 360, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="flex-shrink-0 overflow-hidden border-l"
            >
              <div className="h-full w-[360px] overflow-hidden">
                <LineagePanel
                  activeBranchName={activeBranchName}
                  entries={historyEntries}
                  onClose={() => setHistoryOpen(false)}
                />
              </div>
            </motion.aside>
          ) : null}
        </AnimatePresence>
      ) : (
        <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
          <SheetContent
            side={isMobile ? 'bottom' : 'right'}
            className={isMobile ? 'h-[85vh] rounded-t-xl p-0' : 'w-[360px] max-w-full p-0'}
            hideCloseButton
          >
            <span className="sr-only">
              <SheetTitle>Lineage history</SheetTitle>
              <SheetDescription>Manifesto lineage history panel.</SheetDescription>
            </span>
            <LineagePanel
              activeBranchName={activeBranchName}
              entries={historyEntries}
              onClose={() => setHistoryOpen(false)}
            />
          </SheetContent>
        </Sheet>
      )}

      {isDesktop ? (
        <AnimatePresence mode="wait">
          {assistantOpen ? (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 360, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="flex-shrink-0 overflow-hidden border-l"
            >
              <div className="h-full w-[360px] overflow-hidden">
                <AssistantPanel
                  onClose={() => actions.toggleAssistant(false)}
                  messages={assistant.messages}
                  onSubmit={assistant.sendMessage}
                  isLoading={assistant.isLoading}
                  disabled={assistant.disabled}
                  disabledMessage={assistant.disabledMessage}
                  onApproveDelete={assistant.approveDelete}
                  onDenyDelete={assistant.denyDelete}
                />
              </div>
            </motion.aside>
          ) : null}
        </AnimatePresence>
      ) : (
        <Sheet open={assistantOpen} onOpenChange={(open) => actions.toggleAssistant(open)}>
          <SheetContent
            side={isMobile ? 'bottom' : 'right'}
            className={isMobile ? 'h-[85vh] rounded-t-xl p-0' : 'w-[360px] max-w-full p-0'}
            hideCloseButton
          >
            <span className="sr-only">
              <SheetTitle>Assistant</SheetTitle>
              <SheetDescription>TaskFlow assistant panel.</SheetDescription>
            </span>
            <AssistantPanel
              onClose={() => actions.toggleAssistant(false)}
              messages={assistant.messages}
              onSubmit={assistant.sendMessage}
              isLoading={assistant.isLoading}
              disabled={assistant.disabled}
              disabledMessage={assistant.disabledMessage}
              onApproveDelete={assistant.approveDelete}
              onDenyDelete={assistant.denyDelete}
            />
          </SheetContent>
        </Sheet>
      )}

      <MobileNavigation
        viewMode={viewMode}
        deletedCount={deletedCount}
        onChange={actions.changeView}
      />

      <AnimatePresence>
        <AssistantToggle
          assistantOpen={assistantOpen}
          onOpen={() => actions.toggleAssistant(true)}
        />
      </AnimatePresence>
    </div>
  );
}
