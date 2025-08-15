import { DynamicModule, Module } from '@nestjs/common';
import { AiMcpClientService } from './ai-mcp-client.service';
import { experimental_MCPClientConfig } from 'ai';

@Module({})
export class AiMcpClientModule {
  static register(options: experimental_MCPClientConfig): DynamicModule {
    return {
      module: AiMcpClientModule,
      providers: [
        {
          provide: 'MCP_OPTIONS',
          useValue: options,
        },
        AiMcpClientService,
      ],
      exports: [AiMcpClientService],
    };
  }
}
