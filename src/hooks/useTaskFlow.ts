'use client';

import { useEffect, useSyncExternalStore } from 'react';
import {
  getTaskFlowRuntimeController,
  type TaskFlowActions,
  type TaskFlowViewState,
} from '@/lib/taskflow-runtime-controller';

export type UseTaskFlowResult = {
  ready: boolean;
  state: TaskFlowViewState | null;
  actions: TaskFlowActions;
};

export function useTaskFlow(): UseTaskFlowResult {
  const controller = getTaskFlowRuntimeController();
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );

  useEffect(() => {
    void controller.start();
  }, [controller]);

  return {
    ready: snapshot.ready,
    state: snapshot.state,
    actions: controller.actions,
  };
}
