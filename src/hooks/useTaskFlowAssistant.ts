'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  type ChatInit,
} from 'ai';
import {
  dropToolCallById,
  dropUnresolvedToolCalls,
} from '@/lib/taskflow-assistant-tool-resolution';
import { getTaskFlowRuntimeController } from '@/lib/taskflow-runtime-controller';
import type {
  TaskFlowAssistantUIMessage,
  TaskFlowAssistantUITools,
} from '@/types/taskflow-assistant';
import { isTaskFlowAssistantToolName } from '@/types/taskflow-assistant';

type TaskFlowAssistantToolCall = Parameters<
  NonNullable<ChatInit<TaskFlowAssistantUIMessage>['onToolCall']>
>[0]['toolCall'];

function createDisabledMessages(message: string): TaskFlowAssistantUIMessage[] {
  return [
    {
      id: 'assistant-disabled',
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: message,
        },
      ],
    },
  ];
}

export type UseTaskFlowAssistantResult = {
  messages: TaskFlowAssistantUIMessage[];
  isLoading: boolean;
  isResetting: boolean;
  disabled: boolean;
  disabledMessage?: string;
  sendMessage: (message: string) => Promise<void>;
  approveDelete: (toolCallId: string, input: TaskFlowAssistantUITools['delete_task']['input']) => Promise<void>;
  denyDelete: (toolCallId: string, input: TaskFlowAssistantUITools['delete_task']['input']) => Promise<void>;
  resetSession: () => Promise<void>;
};

export function useTaskFlowAssistant(options: {
  configured: boolean;
  disabledMessage?: string;
}): UseTaskFlowAssistantResult {
  const controller = useMemo(() => getTaskFlowRuntimeController(), []);
  const chatRef = useRef<ReturnType<typeof useChat<TaskFlowAssistantUIMessage>> | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const controllerSnapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const persistedMessages = useMemo(
    () => controller.loadAssistantMessages(),
    [controller],
  );
  const initialMessages = useMemo(
    () => dropUnresolvedToolCalls(persistedMessages),
    [persistedMessages],
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport<TaskFlowAssistantUIMessage>({
        api: '/api/assistant',
        prepareSendMessagesRequest: async ({
          api,
          body,
          headers,
          credentials,
          id,
          messageId,
          messages,
          trigger,
        }) => ({
          api,
          headers,
          credentials,
          body: {
            ...body,
            id,
            messageId,
            trigger,
            messages,
            context: controller.buildAgentContext(),
          },
        }),
      }),
    [controller],
  );

  const chat = useChat<TaskFlowAssistantUIMessage>({
    transport,
    messages: initialMessages,
    onToolCall: async ({ toolCall }) => {
      if (!isTaskFlowAssistantToolName(toolCall.toolName)) {
        return;
      }

      if (toolCall.toolName === 'delete_task') {
        return;
      }

      const result = await controller.executeAgentTool(
        toolCall.toolName,
        toolCall.input as never,
      );

      if (result.state === 'output-available') {
        void chatRef.current?.addToolOutput({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          output: result.output,
        });
        return;
      }

      void chatRef.current?.addToolOutput({
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
        state: 'output-error',
        errorText: result.errorText,
      });
    },
    onError: (error) => {
      console.error(error);
    },
    onFinish: ({ messages }) => {
      controller.saveAssistantMessages(messages);
    },
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });

  useEffect(() => {
    chatRef.current = chat;
  }, [chat]);

  useEffect(() => {
    if (initialMessages !== persistedMessages) {
      controller.saveAssistantMessages(initialMessages);
    }
  }, [controller, initialMessages, persistedMessages]);

  useEffect(() => {
    void controller.start();
  }, [controller]);

  useEffect(() => {
    controller.saveAssistantMessages(chat.messages);
  }, [chat.messages, controller]);

  const disabled =
    !options.configured ||
    !controllerSnapshot.ready ||
    isResetting;

  const disabledMessage =
    !options.configured
      ? options.disabledMessage
      : isResetting
        ? 'Resetting the local TaskFlow session...'
        : !controllerSnapshot.ready
        ? 'Assistant is preparing the local TaskFlow runtime...'
        : undefined;

  const visibleMessages = disabled && disabledMessage
    ? createDisabledMessages(disabledMessage)
    : chat.messages;

  return {
    messages: visibleMessages,
    isLoading: chat.status === 'submitted' || chat.status === 'streaming',
    isResetting,
    disabled,
    disabledMessage,
    sendMessage: async (message: string) => {
      if (disabled) {
        return;
      }

      if (chatRef.current) {
        const sanitizedMessages = dropUnresolvedToolCalls(chatRef.current.messages);

        if (sanitizedMessages !== chatRef.current.messages) {
          chatRef.current.setMessages(sanitizedMessages);
          controller.saveAssistantMessages(sanitizedMessages);
        }
      }

      await chat.sendMessage({ text: message });
    },
    approveDelete: async (toolCallId, input) => {
      const result = await controller.executeAgentTool('delete_task', input);

      if (result.state === 'output-available') {
        await chat.addToolOutput({
          tool: 'delete_task',
          toolCallId,
          output: result.output,
        });
        return;
      }

      await chat.addToolOutput({
        tool: 'delete_task',
        toolCallId,
        state: 'output-error',
        errorText: result.errorText,
      });
    },
    denyDelete: async (toolCallId) => {
      const nextMessages = dropToolCallById(chat.messages, toolCallId);
      chat.setMessages(nextMessages);
      controller.saveAssistantMessages(nextMessages);
    },
    resetSession: async () => {
      if (isResetting) {
        return;
      }

      setIsResetting(true);

      try {
        await chat.stop();
        chat.clearError();
        chat.setMessages([]);
        controller.clearAssistantMessages();
        await controller.resetSession();
      } finally {
        setIsResetting(false);
      }
    },
  };
}

export type { TaskFlowAssistantToolCall };
