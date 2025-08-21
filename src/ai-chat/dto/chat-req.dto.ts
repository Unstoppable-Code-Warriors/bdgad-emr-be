import { IsArray, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { UIMessage } from 'ai';

export enum ChatRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}
export class ChatReqDto {
  @IsString()
  id: string;

  @IsArray()
  messages: UIMessage[];

  @IsOptional()
  @IsString()
  trigger: string;

  @IsOptional()
  @IsString()
  excelFilePath: string;
}
