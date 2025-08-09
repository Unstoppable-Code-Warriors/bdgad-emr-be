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
} from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { AiChatService } from './ai-chat.service';
import {
  ChatCompletionRequest,
  ChatCompletionResponse,
} from './dto/chat-completion.dto';

@Controller('chat')
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Post('completions')
  @HttpCode(200)
  async createChatCompletion(
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

      const streamObservable =
        this.aiChatService.createStreamingCompletionRaw(request);

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
        const completion = await this.aiChatService.createCompletion(request);
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

  // Alternative SSE endpoint for clients that prefer the NestJS SSE pattern
  @Sse('stream')
  @UsePipes(new ValidationPipe({ transform: true }))
  streamChat(@Query() query: any): Observable<MessageEvent> {
    // For this endpoint, you'd pass the request as query parameters
    // This is more "NestJS-like" but less OpenAI-compatible
    const request: ChatCompletionRequest = {
      messages: JSON.parse(query.messages || '[]'),
      model: query.model || 'gpt-4o-mini',
      stream: true,
    };

    return this.aiChatService.createStreamingCompletion(request);
  }
}
