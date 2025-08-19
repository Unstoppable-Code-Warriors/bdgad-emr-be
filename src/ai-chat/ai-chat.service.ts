import { Injectable, Logger } from '@nestjs/common';
import { createSystemMessages } from './constants/prompt';
import { DEFAULT_MODEL } from './constants/models';
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
    private readonly mcpClientService: AiMcpClientService,
    private readonly configService: ConfigService,
  ) {
    const yescaleOpenAI = createOpenAI({
      // baseURL: this.configService.get('OPENAI_API_URL'),
      apiKey: this.configService.get('OPENAI_API_KEY_2'),
    });
    this.model = yescaleOpenAI(DEFAULT_MODEL);
  }

  public async handleChat(request: ChatReqDto, user: UserInfo) {
    const { messages, temperature = 0.7, maxTokens = 1000 } = request;

    // Convert messages to AI SDK format
    const aiMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
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
