export type AIProvider = 'openai' | 'openrouter';

// Keep credentials server-side and pin queued jobs to their original provider.
export function aiConfig(selected?: AIProvider) {
  const legacyRouterKey = process.env.OPENAI_API_KEY?.startsWith('sk-or-')
    ? process.env.OPENAI_API_KEY
    : undefined;
  const provider =
    selected ||
    process.env.AI_PROVIDER ||
    (process.env.OPENROUTER_API_KEY || legacyRouterKey ? 'openrouter' : 'openai');
  if (provider !== 'openai' && provider !== 'openrouter')
    throw new Error('AI_PROVIDER openrouter yoki openai bo‘lishi kerak.');
  const key =
    provider === 'openrouter'
      ? process.env.OPENROUTER_API_KEY || legacyRouterKey
      : legacyRouterKey
        ? undefined
        : process.env.OPENAI_API_KEY;
  return {
    provider: provider as AIProvider,
    label: provider === 'openrouter' ? 'OpenRouter' : 'OpenAI',
    key,
    enabled: !!key,
    model:
      provider === 'openrouter'
        ? process.env.OPENROUTER_MODEL || 'openai/gpt-6-astra'
        : process.env.OPENAI_MODEL || 'gpt-6-astra',
    reasoning: process.env.AI_REASONING_EFFORT || process.env.OPENAI_REASONING_EFFORT || 'high',
  };
}
