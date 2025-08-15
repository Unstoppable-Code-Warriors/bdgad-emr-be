import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ChatRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

export class MessageReqDto {
  @IsEnum(ChatRole)
  role: ChatRole;

  @IsString()
  content: string;
}

export class ChatReqDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageReqDto)
  messages: MessageReqDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxTokens?: number;
}
