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
import { ASSISTANT_SHELL_MESSAGES } from '@/lib/taskflow-fixtures';
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
  viewMode: ViewMode;
  onDateFilterChange: (filter: DateFilter | null) => void;
  onOpenCreate: () => void;
  onOpenHistory: () => void;
  onViewModeChange: (viewMode: ViewMode) => void;
}) {
  const isMobile = useIsMobile();

  return (
    <header className="border-b bg-muted/30">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-4">
          <div>
            <h1 className="text-base font-semibold sm:text-lg">TaskFlow</h1>
            <p className="text-xs text-muted-foreground">
              Lineage-backed TaskFlow runtime on the SDK 3.8 baseline
            </p>
          </div>
          <div className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex">
            <Badge variant="secondary" className="font-normal">
              {activeCount} active
            </Badge>
            <Badge variant="secondary" className="bg-primary/10 font-normal text-primary">
              {inProgressCount} in progress
            </Badge>
            <Badge
              variant="secondary"
              className="bg-green-500/10 font-normal text-green-600 dark:text-green-400"
            >
              {doneCount} done
            </Badge>
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
              placeholder="Filter by date"
            />
          )}
          <Button variant="outline" size={isMobile ? 'icon' : 'sm'} onClick={onOpenHistory}>
            <Clock3 className="h-4 w-4" />
            {isMobile ? null : (
              <span className="ml-2">
                History {historyCount > 0 ? `(${historyCount})` : ''}
              </span>
            )}
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
      {!isMobile && activeBranchName ? (
        <div className="border-t px-4 py-2 text-xs text-muted-foreground sm:px-6">
          Active branch: {activeBranchName}
        </div>
      ) : null}
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
      className="fixed bottom-[calc(var(--mobile-nav-height)+1rem)] right-4 z-50 sm:bottom-6 sm:right-6"
    >
      <Button onClick={onOpen} size="lg" className="h-14 w-14 rounded-full shadow-lg">
        <MessageSquare className="h-6 w-6" />
      </Button>
    </motion.div>
  );
}

export default function Home() {
  const { state, ready, actions } = useTaskFlow();
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
  } = state;

  const filteredActiveTasks = filterTasksByDate(activeTasks, dateFilter);
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
                  disabled
                  onClose={() => actions.toggleAssistant(false)}
                  messages={ASSISTANT_SHELL_MESSAGES}
                  onSubmit={() => {}}
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
              <SheetDescription>UI shell assistant panel.</SheetDescription>
            </span>
            <AssistantPanel
              disabled
              onClose={() => actions.toggleAssistant(false)}
              messages={ASSISTANT_SHELL_MESSAGES}
              onSubmit={() => {}}
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
