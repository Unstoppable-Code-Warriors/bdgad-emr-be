import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { McpClientModule } from '../mcp-client/mcp-client.module';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';

@Module({
  imports: [
    McpClientModule.register({
      throwOnLoadError: true,
      prefixToolNameWithServerName: false,
      additionalToolNamePrefix: '',
      mcpServers: {
        myServer: {
          transport: 'sse',
          url: 'http://localhost:3000/sse',
          reconnect: {
            enabled: true,
            maxAttempts: 5,
            delayMs: 2000,
          },
        },
      },
    }),
  ],
  providers: [
    AiService,
    {
      provide: 'LLM',
      useFactory: (config: ConfigService) =>
        new ChatOpenAI({
          model: config.get('OPENAI_MODEL') ?? 'gpt-4o-mini',
          configuration: {
            baseURL: config.get('OPENAI_API_URL'),
            apiKey: config.get('OPENAI_API_KEY'),
          },
        }),
      inject: [ConfigService],
    },
  ],
  exports: [AiService],
})
export class AiModule {}
