import { Module, DynamicModule } from '@nestjs/common';
import { McpClientService } from './mcp-client.service';
import { type ClientConfig } from '@langchain/mcp-adapters';

@Module({})
export class McpClientModule {
  static register(options: ClientConfig): DynamicModule {
    return {
      module: McpClientModule,
      providers: [
        {
          provide: 'MCP_CLIENT_OPTIONS',
          useValue: options,
        },
        McpClientService,
      ],
      exports: [McpClientService],
    };
  }
}
