import { Injectable, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { MessageEvent } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AiService } from '../ai/ai.service';
import { createSystemMessages } from './constants/prompt';
import { DEFAULT_MODEL } from './constants/models';
import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionStreamResponse,
  ChatMessage,
  MessageRole,
} from './dto/chat-completion.dto';
import { ChatReqDto } from './dto/chat-req.dto';
import { LanguageModel, streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { UserInfo } from 'src/auth';
import { AiMcpClientService } from 'src/ai-mcp-client/ai-mcp-client.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);
  private model: LanguageModel;

  constructor(
    private readonly aiService: AiService,
    private readonly mcpClientService: AiMcpClientService,
    private readonly configService: ConfigService,
  ) {
    const yescaleOpenAI = createOpenAI({
      // baseURL: this.configService.get('OPENAI_API_URL'),
      apiKey: this.configService.get('OPENAI_API_KEY_2'),
      // Override the default endpoint to use chat/completions instead of responses
      // fetch: async (url: string, options: RequestInit) => {
      // const modifiedUrl = url
      //   .toString()
      //   .replace('/v1/responses', '/v1/chat/completions');

      // const body = JSON.parse(options.body as string);
      // const newBody = {
      //   model: body.model,
      //   messages: body.input,
      //   messages: [
      //     {
      //       role: 'user',
      //       content: 'Hello',
      //     },
      //   ],
      //   temperature: body.temperature,
      //   max_tokens: body.max_tokens,
      //   stream: body.stream,
      //   tools: body.tools,
      //   tool_choice: body.tool_choice,
      // };

      // console.log(newBody);

      // const req = fetch(modifiedUrl, {
      //   ...options,
      //   body: JSON.stringify(newBody),
      // });
      // return req;
      // },
    });
    this.model = yescaleOpenAI(DEFAULT_MODEL);
  }

  async createCompletion(
    request: ChatCompletionRequest,
    doctorId: number,
  ): Promise<ChatCompletionResponse> {
    const startTime = Date.now();
    const completionId = `chatcmpl-${uuidv4()}`;

    try {
      const agent = await this.aiService.getAgent();

      // Convert messages to LangChain format and add system prompt if not present
      const messages = this.convertMessagesToLangChain(
        request.messages,
        doctorId,
      );

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
        `Completion created with ID: ${completionId}, using internal model: ${DEFAULT_MODEL}, response model: ${response.model}, doctor ID: ${doctorId}`,
      );
      return response;
    } catch (error) {
      this.logger.error('Error creating completion:', error);
      throw new Error(`Failed to create completion: ${error.message}`);
    }
  }

  createStreamingCompletion(
    request: ChatCompletionRequest,
    doctorId: number,
  ): Observable<MessageEvent> {
    return this.createStreamingCompletionRaw(request, doctorId).pipe(
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
    doctorId: number,
  ): Observable<ChatCompletionStreamResponse> {
    return new Observable<ChatCompletionStreamResponse>((subscriber) => {
      const startTime = Date.now();
      const completionId = `chatcmpl-${uuidv4()}`;
      const responseModel = request.model || 'gpt-4o-mini'; // Keep request model for API compatibility

      this.logger.log(
        `Starting streaming completion with ID: ${completionId}, using internal model: ${DEFAULT_MODEL}, response model: ${responseModel}, doctor ID: ${doctorId}`,
      );

      (async () => {
        try {
          const agent = await this.aiService.getAgent();

          // Convert messages to LangChain format
          const messages = this.convertMessagesToLangChain(
            request.messages,
            doctorId,
          );

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

  private convertMessagesToLangChain(
    messages: ChatMessage[],
    doctorId: number,
  ) {
    // Check if system messages are already present
    const hasSystemMessage = messages.some(
      (m) => m.role === MessageRole.SYSTEM,
    );
    const langChainMessages: any[] = [];

    if (!hasSystemMessage) {
      // Add both general and doctor-specific system messages
      const systemMessages = createSystemMessages(doctorId);
      langChainMessages.push(...systemMessages);
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
    this.logger.debug(
      `Using internal model: ${DEFAULT_MODEL} for processing with doctor ID: ${doctorId}`,
    );

    return langChainMessages;
  }

  private estimateTokens(text: string): number {
    // Simple token estimation (rough approximation: ~4 characters per token)
    return Math.ceil(text.length / 4);
  }

  public async handleChat(request: ChatReqDto, user: UserInfo) {
    const { messages, temperature = 0.7, maxTokens = 1000 } = request;

    // Convert messages to AI SDK format
    const aiMessages = messages.map((msg) => ({
      role: msg.role,
      // content: msg.content,
      content: 'Hello',
    }));

    const tools = await this.mcpClientService.getTools();

    const result = streamText({
      tools,
      model: this.model,
      messages: [...createSystemMessages(user.id), ...aiMessages],
      temperature,
      maxOutputTokens: maxTokens,
    });

    return result;
  }
}
