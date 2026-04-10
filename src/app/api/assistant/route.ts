import { openai } from '@ai-sdk/openai';
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  validateUIMessages,
} from 'ai';
import { z } from 'zod';
import { getTaskFlowAssistantAvailability } from '@/lib/taskflow-assistant-config';
import { buildTaskFlowAssistantSystemPrompt } from '@/lib/taskflow-assistant-prompt';
import {
  createTaskFlowAssistantTools,
  taskFlowAgentContextSchema,
} from '@/lib/taskflow-assistant-tools';
import type { TaskFlowAssistantUIMessage } from '@/types/taskflow-assistant';

const assistantRequestSchema = z.object({
  messages: z.array(z.unknown()),
  context: taskFlowAgentContextSchema,
});

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const availability = getTaskFlowAssistantAvailability();
  if (!availability.configured) {
    return Response.json(
      {
        error: availability.message,
      },
      { status: 503 },
    );
  }

  const requestBody = assistantRequestSchema.safeParse(await request.json());
  if (!requestBody.success) {
    return Response.json(
      {
        error: 'Invalid assistant request body.',
      },
      { status: 400 },
    );
  }

  const tools = createTaskFlowAssistantTools();
  const validatedMessages = await validateUIMessages<TaskFlowAssistantUIMessage>({
    messages: [
      ...requestBody.data.messages
    ],
    tools: tools as never,
  });

  const modelMessages = await convertToModelMessages(validatedMessages, {
    tools: tools as never,
  });

  const result = streamText({
    model: openai(process.env.OPENAI_MODEL!),
    system: await buildTaskFlowAssistantSystemPrompt(requestBody.data.context),
    messages: modelMessages,
    tools: tools as never,
    stopWhen: stepCountIs(5) as never,
  });

  return result.toUIMessageStreamResponse({
    originalMessages: validatedMessages,
  });
}
