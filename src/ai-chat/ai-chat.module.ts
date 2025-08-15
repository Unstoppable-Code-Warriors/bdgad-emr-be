import { Module } from '@nestjs/common';
import { AiChatService } from './ai-chat.service';
import { AiChatController } from './ai-chat.controller';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { AiMcpClientModule } from 'src/ai-mcp-client/ai-mcp-client.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    AiModule,
    AuthModule,
    ConfigModule,
    AiMcpClientModule.register({
      transport: {
        type: 'sse',
        url: 'https://ai-search.bdgad.bio/sse',
      },
    }),
  ],
  providers: [AiChatService],
  controllers: [AiChatController],
})
export class AiChatModule {}
