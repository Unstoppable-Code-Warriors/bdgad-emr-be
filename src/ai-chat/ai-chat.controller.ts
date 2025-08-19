import { Controller, Post, Body, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AiChatService } from './ai-chat.service';
import { AuthGuard, User, UserInfo } from '../auth';
import { ChatReqDto } from './dto/chat-req.dto';

@Controller('chat')
@UseGuards(AuthGuard)
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Post()
  async chat(
    @Body() request: ChatReqDto,
    @Res() res: Response,
    @User() user: UserInfo,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Transfer-Encoding', 'chunked');

    const stream = await this.aiChatService.handleChat(request, user);

    stream.pipeTextStreamToResponse(res);
  }
}
