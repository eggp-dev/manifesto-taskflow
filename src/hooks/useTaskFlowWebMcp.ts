'use client';

import { useEffect, useMemo } from 'react';
import { getTaskFlowRuntimeController } from '@/lib/taskflow-runtime-controller';
import { getTaskFlowWebMcpService } from '@/lib/taskflow-webmcp-service';

export function useTaskFlowWebMcp(): void {
  const controller = useMemo(() => getTaskFlowRuntimeController(), []);
  const service = useMemo(() => getTaskFlowWebMcpService(controller), [controller]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__taskflowWebMcp = service.createDebugApi();
    }

    void service.start();

    const retryStart = () => {
      void service.start();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', retryStart, { capture: true });
      window.addEventListener('keydown', retryStart, { capture: true });
      document.addEventListener('focusin', retryStart, { capture: true });
      document.addEventListener('visibilitychange', retryStart);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('pointerdown', retryStart, { capture: true });
        window.removeEventListener('keydown', retryStart, { capture: true });
        document.removeEventListener('focusin', retryStart, { capture: true });
        document.removeEventListener('visibilitychange', retryStart);
        delete window.__taskflowWebMcp;
      }
      void service.stop();
    };
  }, [service]);
}
