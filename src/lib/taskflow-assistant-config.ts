export function getTaskFlowAssistantAvailability(
  env: Record<string, string | undefined> = process.env,
): { configured: boolean; message?: string } {
  const hasApiKey = Boolean(env.OPENAI_API_KEY);
  const hasModel = Boolean(env.OPENAI_MODEL);

  if (hasApiKey && hasModel) {
    return { configured: true };
  }

  const missing = [
    !hasApiKey ? 'OPENAI_API_KEY' : null,
    !hasModel ? 'OPENAI_MODEL' : null,
  ].filter(Boolean);

  return {
    configured: false,
    message: `Assistant is disabled. Set ${missing.join(' and ')} to enable live task automation.`,
  };
}
