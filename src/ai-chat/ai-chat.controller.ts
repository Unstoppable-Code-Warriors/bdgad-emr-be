import {
  Controller,
  Post,
  Body,
  Res,
  Sse,
  MessageEvent,
  HttpCode,
  ValidationPipe,
  UsePipes,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { AiChatService } from './ai-chat.service';
import {
  ChatCompletionRequest,
  ChatCompletionResponse,
} from './dto/chat-completion.dto';
import { AuthGuard, User, UserInfo } from '../auth';
import { ChatReqDto } from './dto/chat-req.dto';

@Controller('chat')
@UseGuards(AuthGuard)
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Post('completions')
  @HttpCode(200)
  async createChatCompletion(
    @User() user: UserInfo,
    @Body(new ValidationPipe({ transform: true }))
    request: ChatCompletionRequest,
    @Res() res: Response,
  ): Promise<void> {
    if (request.stream) {
      // For streaming, redirect to SSE endpoint
      // This maintains OpenAI compatibility while using NestJS SSE properly
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Transfer-Encoding', 'chunked');

      const streamObservable = this.aiChatService.createStreamingCompletionRaw(
        request,
        user.id,
      );

      streamObservable.subscribe({
        next: (chunk) => {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        },
        error: (error) => {
          res.write(`data: {"error": "${error.message}"}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        },
        complete: () => {
          res.write('data: [DONE]\n\n');
          res.end();
        },
      });
    } else {
      // Handle non-streaming response
      try {
        const completion = await this.aiChatService.createCompletion(
          request,
          user.id,
        );
        res.json(completion);
      } catch (error) {
        res.status(500).json({
          error: {
            message: error.message,
            type: 'internal_server_error',
          },
        });
      }
    }
  }

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
