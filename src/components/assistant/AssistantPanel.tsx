'use client';

import { AssistantHeader } from './AssistantHeader';
import { AssistantMessages } from './AssistantMessages';
import { AssistantInput } from './AssistantInput';
import type { AssistantMessage } from '@/types/taskflow';

interface AssistantPanelProps {
  onClose: () => void;
  messages: AssistantMessage[];
  onSubmit: (message: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function AssistantPanel({
  onClose,
  messages,
  onSubmit,
  isLoading = false,
  disabled = false,
}: AssistantPanelProps) {
  return (
    <div className="flex h-full flex-col bg-background">
      <AssistantHeader onClose={onClose} />
      <AssistantMessages messages={messages} />
      <AssistantInput
        onSubmit={onSubmit}
        isLoading={isLoading}
        disabled={disabled}
        disabledMessage={
          disabled
            ? 'Assistant execution is disabled in this preserved shell. Reconnect it during the SDK rebuild.'
            : undefined
        }
        placeholder={
          disabled
            ? 'Assistant is disabled in this UI shell'
            : 'Ask the assistant to manage tasks...'
        }
      />
    </div>
  );
}
