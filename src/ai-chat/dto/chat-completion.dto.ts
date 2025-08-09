import {
  IsString,
  IsArray,
  IsOptional,
  IsNumber,
  IsBoolean,
  ValidateNested,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum MessageRole {
  SYSTEM = 'system',
  USER = 'user',
  ASSISTANT = 'assistant',
  TOOL = 'tool',
}

export class ChatMessage {
  @IsEnum(MessageRole)
  role: MessageRole;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  tool_call_id?: string;
}

export class ChatCompletionRequest {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessage)
  messages: ChatMessage[];

  // Model field is kept for OpenAI API compatibility only
  // Internally, the service always uses the DEFAULT_MODEL constant (gpt-5)
  @IsOptional()
  @IsString()
  model?: string = 'gpt-4o-mini';

  @IsOptional()
  @IsBoolean()
  stream?: boolean = false;

  @IsOptional()
  @IsNumber()
  @Min(1)
  max_tokens?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  top_p?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  n?: number = 1;

  @IsOptional()
  stop?: string | string[];

  @IsOptional()
  @IsNumber()
  @Min(-2)
  @Max(2)
  frequency_penalty?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(-2)
  @Max(2)
  presence_penalty?: number = 0;

  @IsOptional()
  @IsString()
  user?: string;
}

export class ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
}

export class ChatCompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export class ChatCompletionResponse {
  id: string;
  object: string = 'chat.completion';
  created: number;
  model: string; // Echoes the request model for API compatibility
  choices: ChatCompletionChoice[];
  usage: ChatCompletionUsage;
  system_fingerprint?: string;
}

// Streaming response types
export class ChatCompletionStreamChoice {
  index: number;
  delta: Partial<ChatMessage>;
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
}

export class ChatCompletionStreamResponse {
  id: string;
  object: string = 'chat.completion.chunk';
  created: number;
  model: string; // Echoes the request model for API compatibility
  choices: ChatCompletionStreamChoice[];
  system_fingerprint?: string;
}
