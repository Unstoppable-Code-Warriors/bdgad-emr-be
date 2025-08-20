import { Injectable, Logger } from '@nestjs/common';
import { createSystemMessages } from './constants/prompt';
import { DEFAULT_MODEL } from './constants/models';
import { ChatReqDto } from './dto/chat-req.dto';
import {
  convertToModelMessages,
  dynamicTool,
  LanguageModel,
  streamText,
} from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { UserInfo } from 'src/auth';
import { ConfigService } from '@nestjs/config';
import z from 'zod';
import { excelExploreCode } from 'src/ai-chat/constants/python-code';
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
        exploreExcel: dynamicTool({
          description:
            'Explore and analyze the Excel file in detail - shows sheet information, column details, data types, statistics, and sample data',
          inputSchema: z.object({}),
          execute: async () => {
            const result = await this.daytonaService.executePythonCode(
              excelExploreCode(excelFilePath),
            );
            return { result };
          },
        }),
        getExcelData: dynamicTool({
          description:
            'Get the data from the Excel file by using python code, you must include the excel file path that need to be analyzed in the python code',
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
      toolChoice: 'required',
    });

    return result;
  }
}
