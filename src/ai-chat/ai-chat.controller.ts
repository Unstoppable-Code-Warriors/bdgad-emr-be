import { Controller, Post, Body, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AiChatService } from './ai-chat.service';
import { AuthGuard, User, UserInfo } from '../auth';
import { ChatReqDto } from './dto/chat-req.dto';

@Controller('ai-chat')
@UseGuards(AuthGuard)
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Post('completion')
  async chat(
    @Body() request: ChatReqDto,
    @Res() res: Response,
    @User() user: UserInfo,
  ) {
    const stream = await this.aiChatService.handleChat(request, user);

    stream.pipeTextStreamToResponse(res);
  }
}
