import { Injectable, Logger } from '@nestjs/common';
import { createSystemMessages } from './constants/prompt';
import { DEFAULT_MODEL } from './constants/models';
import { ChatReqDto } from './dto/chat-req.dto';
import {
  convertToModelMessages,
  LanguageModel,
  stepCountIs,
  streamText,
  tool,
} from 'ai';
import { createOpenAI, openai } from '@ai-sdk/openai';
import { UserInfo } from 'src/auth';
import { ConfigService } from '@nestjs/config';
import z from 'zod';
import { DaytonaService } from 'src/daytona/daytona.service';

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);
  private model: LanguageModel;

  constructor(
    private readonly configService: ConfigService,
    private readonly daytonaService: DaytonaService,
  ) {
    const yescaleOpenAI = createOpenAI({
      // baseURL: this.configService.get('OPENAI_API_URL'),
      apiKey: this.configService.get('OPENAI_API_KEY_2'),
    });
    this.model = yescaleOpenAI(DEFAULT_MODEL);
  }

  public async handleChat(request: ChatReqDto, user: UserInfo) {
    const { messages: uiMessages, excelFilePath } = request;
    // Convert messages to AI SDK format
    const messages = convertToModelMessages(uiMessages);

    const result = streamText({
      tools: {
        web_search_preview: openai.tools.webSearchPreview({}),
        exploreExcel: tool({
          description:
            'Explore and analyze the Excel file in detail by input Python code - shows sheet information, column details, data types, statistics, and sample data. You must include the excel file path that need to be analyzed in the python code. You must use print() to print the result',
          inputSchema: z.object({
            pythonCode: z.string(),
          }),
          execute: async ({ pythonCode }) => {
            const result =
              await this.daytonaService.executePythonCode(pythonCode);
            return { result };
          },
        }),
      },
      model: this.model,
      messages: [...createSystemMessages(excelFilePath), ...messages],
      temperature: 0.7,
      maxOutputTokens: 1000,
      stopWhen: stepCountIs(5),
    });

    return result;
  }
}
