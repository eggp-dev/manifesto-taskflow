import { TaskFlowPageClient } from '@/components/taskflow/TaskFlowPageClient';
import { getTaskFlowAssistantAvailability } from '@/lib/taskflow-assistant-config';

export default function Home() {
  const assistantAvailability = getTaskFlowAssistantAvailability();

  return (
    <TaskFlowPageClient
      assistantConfigured={assistantAvailability.configured}
      assistantDisabledMessage={
        assistantAvailability.configured ? undefined : assistantAvailability.message
      }
    />
  );
}
