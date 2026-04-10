'use client';

import { useMemo, useRef } from 'react';
import { getTaskFlowRuntimeController } from '@/lib/taskflow-runtime-controller';
import type { TaskFlowHoveredTarget } from '@/types/taskflow-assistant';

type HoverTargetInput =
  | TaskFlowHoveredTarget
  | null
  | (() => TaskFlowHoveredTarget | null);

function resolveHoverTarget(input: HoverTargetInput): TaskFlowHoveredTarget | null {
  return typeof input === 'function' ? input() : input;
}

export function useTaskFlowSemanticHoverTarget(input: HoverTargetInput) {
  const controller = useMemo(() => getTaskFlowRuntimeController(), []);
  const pendingTargetRef = useRef<TaskFlowHoveredTarget | null>(null);

  const flushPendingHover = () => {
    const pendingTarget = pendingTargetRef.current;

    if (!pendingTarget) {
      controller.cancelHoveredTargetSchedule();
      return;
    }

    pendingTargetRef.current = null;
    controller.setHoveredTarget(pendingTarget);
  };

  return {
    onMouseEnter: () => {
      const target = resolveHoverTarget(input);
      if (!target) {
        return;
      }

      pendingTargetRef.current = target;
      controller.scheduleHoveredTarget(target);
    },
    onMouseLeave: () => {
      flushPendingHover();
    },
    onFocus: () => {
      const target = resolveHoverTarget(input);
      if (!target) {
        return;
      }

      pendingTargetRef.current = null;
      controller.scheduleHoveredTarget(target, 0);
    },
    onBlur: () => {
      flushPendingHover();
    },
  };
}
