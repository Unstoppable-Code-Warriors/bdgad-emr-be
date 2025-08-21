// Model constants for AI Chat service
export const DEFAULT_MODEL = 'gpt-5-mini';

// The model in request body is kept only for OpenAI API compatibility
// but internally we always use DEFAULT_MODEL
export const SUPPORTED_MODELS = [
  'gpt-4o-mini',
  'gpt-4o',
  'gpt-4',
  'gpt-3.5-turbo',
  'gpt-5',
] as const;

export type SupportedModel = (typeof SUPPORTED_MODELS)[number];
