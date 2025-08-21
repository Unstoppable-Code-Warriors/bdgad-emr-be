import { UIMessage } from 'ai';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class DoctorChatReqDto {
  @IsString()
  id: string;

  @IsArray()
  messages: UIMessage[];

  @IsOptional()
  @IsString()
  trigger: string;
}
