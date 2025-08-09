import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { McpClientModule } from '../mcp-client/mcp-client.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    McpClientModule.register({
      throwOnLoadError: true,
      prefixToolNameWithServerName: false,
      additionalToolNamePrefix: '',
      mcpServers: {
        myServer: {
          transport: 'sse',
          url: 'http://ai-search.bdgad.bio/sse',
          reconnect: {
            enabled: true,
            maxAttempts: 5,
            delayMs: 2000,
          },
        },
      },
    }),
  ],
  controllers: [HealthController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
