import { Injectable, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { MessageEvent } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AiService } from '../ai/ai.service';
import { SYSTEM_PROMPT } from './constants/prompt';
import { DEFAULT_MODEL } from './constants/models';
import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionStreamResponse,
  ChatMessage,
  MessageRole,
} from './dto/chat-completion.dto';

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);

  constructor(private readonly aiService: AiService) {}

  async createCompletion(
    request: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse> {
    const startTime = Date.now();
    const completionId = `chatcmpl-${uuidv4()}`;

    try {
      const agent = await this.aiService.getAgent();

      // Convert messages to LangChain format and add system prompt if not present
      const messages = this.convertMessagesToLangChain(request.messages);

      // Invoke the agent
      const result = await agent.invoke({
        messages,
      });

      // Extract the response content
      const rawContent =
        result.messages[result.messages.length - 1]?.content || '';
      const responseContent =
        typeof rawContent === 'string'
          ? rawContent
          : JSON.stringify(rawContent);

      // Create usage stats (mock for now - real implementation would need token counting)
      const usage = {
        prompt_tokens: this.estimateTokens(
          request.messages.map((m) => m.content).join(' '),
        ),
        completion_tokens: this.estimateTokens(responseContent),
        total_tokens: 0,
      };
      usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;

      const response: ChatCompletionResponse = {
        id: completionId,
        object: 'chat.completion',
        created: Math.floor(startTime / 1000),
        model: request.model || 'gpt-4o-mini', // Keep request model for API compatibility
        choices: [
          {
            index: 0,
            message: {
              role: MessageRole.ASSISTANT,
              content: responseContent,
            },
            finish_reason: 'stop',
          },
        ],
        usage,
        system_fingerprint: `fp_${Date.now()}`,
      };

      this.logger.log(
        `Completion created with ID: ${completionId}, using internal model: ${DEFAULT_MODEL}, response model: ${response.model}`,
      );
      return response;
    } catch (error) {
      this.logger.error('Error creating completion:', error);
      throw new Error(`Failed to create completion: ${error.message}`);
    }
  }

  createStreamingCompletion(
    request: ChatCompletionRequest,
  ): Observable<MessageEvent> {
    return this.createStreamingCompletionRaw(request).pipe(
      map(
        (chunk: ChatCompletionStreamResponse): MessageEvent => ({
          data: chunk,
          type: 'message',
        }),
      ),
    );
  }

  createStreamingCompletionRaw(
    request: ChatCompletionRequest,
  ): Observable<ChatCompletionStreamResponse> {
    return new Observable<ChatCompletionStreamResponse>((subscriber) => {
      const startTime = Date.now();
      const completionId = `chatcmpl-${uuidv4()}`;
      const responseModel = request.model || 'gpt-4o-mini'; // Keep request model for API compatibility

      this.logger.log(
        `Starting streaming completion with ID: ${completionId}, using internal model: ${DEFAULT_MODEL}, response model: ${responseModel}`,
      );

      (async () => {
        try {
          const agent = await this.aiService.getAgent();

          // Convert messages to LangChain format
          const messages = this.convertMessagesToLangChain(request.messages);

          // For streaming, we'll need to handle the agent's streaming response
          // Since LangGraph doesn't directly support streaming in the same way as OpenAI,
          // we'll simulate streaming by chunking the response
          const result = await agent.invoke({
            messages,
          });

          const rawContent =
            result.messages[result.messages.length - 1]?.content || '';
          const responseContent =
            typeof rawContent === 'string'
              ? rawContent
              : JSON.stringify(rawContent);

          // Simulate streaming by breaking the response into chunks
          this.streamResponse(
            subscriber,
            responseContent,
            completionId,
            startTime,
            responseModel,
          );
        } catch (error) {
          this.logger.error('Error creating streaming completion:', error);
          subscriber.error(error);
        }
      })();
    });
  }

  private streamResponse(
    subscriber: any,
    content: string,
    completionId: string,
    startTime: number,
    responseModel: string,
  ) {
    const words = content.split(' ');
    const chunkSize = 2; // Words per chunk
    let currentChunk = '';

    // Send initial chunk
    const initialChunk: ChatCompletionStreamResponse = {
      id: completionId,
      object: 'chat.completion.chunk',
      created: Math.floor(startTime / 1000),
      model: responseModel, // Use response model for API compatibility
      choices: [
        {
          index: 0,
          delta: {
            role: MessageRole.ASSISTANT,
            content: '',
          },
          finish_reason: null,
        },
      ],
      system_fingerprint: `fp_${Date.now()}`,
    };
    subscriber.next(initialChunk);

    // Stream content in chunks
    let wordIndex = 0;
    const streamInterval = setInterval(() => {
      if (wordIndex >= words.length) {
        // Send final chunk
        const finalChunk: ChatCompletionStreamResponse = {
          id: completionId,
          object: 'chat.completion.chunk',
          created: Math.floor(startTime / 1000),
          model: responseModel, // Use response model for API compatibility
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: 'stop',
            },
          ],
          system_fingerprint: `fp_${Date.now()}`,
        };
        subscriber.next(finalChunk);
        subscriber.complete();
        clearInterval(streamInterval);
        return;
      }

      // Build current chunk
      const wordsInChunk = words.slice(
        wordIndex,
        Math.min(wordIndex + chunkSize, words.length),
      );
      currentChunk = wordsInChunk.join(' ');
      if (wordIndex + chunkSize < words.length) {
        currentChunk += ' ';
      }

      const chunk: ChatCompletionStreamResponse = {
        id: completionId,
        object: 'chat.completion.chunk',
        created: Math.floor(startTime / 1000),
        model: responseModel, // Use response model for API compatibility
        choices: [
          {
            index: 0,
            delta: {
              content: currentChunk,
            },
            finish_reason: null,
          },
        ],
        system_fingerprint: `fp_${Date.now()}`,
      };

      subscriber.next(chunk);
      wordIndex += chunkSize;
    }, 100); // 100ms delay between chunks for realistic streaming feel
  }

  private convertMessagesToLangChain(messages: ChatMessage[]) {
    // Add system prompt if not present
    const hasSystemMessage = messages.some(
      (m) => m.role === MessageRole.SYSTEM,
    );
    const langChainMessages: any[] = [];

    if (!hasSystemMessage) {
      langChainMessages.push({
        role: 'system',
        content: SYSTEM_PROMPT,
      });
    }

    // Convert OpenAI format to LangChain format
    langChainMessages.push(
      ...messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        ...(msg.name && { name: msg.name }),
      })),
    );

    // Note: We always use DEFAULT_MODEL internally, regardless of request.model
    this.logger.debug(`Using internal model: ${DEFAULT_MODEL} for processing`);

    return langChainMessages;
  }

  private estimateTokens(text: string): number {
    // Simple token estimation (rough approximation: ~4 characters per token)
    return Math.ceil(text.length / 4);
  }
}
