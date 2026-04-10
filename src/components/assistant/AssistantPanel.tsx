'use client';

import { AssistantHeader } from './AssistantHeader';
import { AssistantMessages } from './AssistantMessages';
import { AssistantInput } from './AssistantInput';
import type {
  TaskFlowAssistantUIMessage,
  TaskFlowAssistantUITools,
} from '@/types/taskflow-assistant';

interface AssistantPanelProps {
  onClose: () => void;
  onResetSession?: () => Promise<void> | void;
  messages: TaskFlowAssistantUIMessage[];
  onSubmit: (message: string) => Promise<void> | void;
  isLoading?: boolean;
  isResetting?: boolean;
  disabled?: boolean;
  disabledMessage?: string;
  onApproveDelete?: (
    toolCallId: string,
    input: TaskFlowAssistantUITools['delete_task']['input'],
  ) => Promise<void>;
  onDenyDelete?: (
    toolCallId: string,
    input: TaskFlowAssistantUITools['delete_task']['input'],
  ) => Promise<void>;
}

export function AssistantPanel({
  onClose,
  onResetSession,
  messages,
  onSubmit,
  isLoading = false,
  isResetting = false,
  disabled = false,
  disabledMessage,
  onApproveDelete,
  onDenyDelete,
}: AssistantPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#111111] text-[#ededed]">
      <AssistantHeader
        onClose={onClose}
        onResetSession={onResetSession}
        isResetting={isResetting}
      />
      <AssistantMessages
        messages={messages}
        isLoading={isLoading}
        onApproveDelete={onApproveDelete}
        onDenyDelete={onDenyDelete}
      />
      <AssistantInput
        onSubmit={onSubmit}
        isLoading={isLoading || isResetting}
        disabled={disabled}
        disabledMessage={
          disabled ? (disabledMessage ?? 'Assistant is currently unavailable.') : undefined
        }
        placeholder={
          disabled
            ? 'Assistant is unavailable'
            : 'Ask the assistant to manage tasks...'
        }
      />
    </div>
  );
}
