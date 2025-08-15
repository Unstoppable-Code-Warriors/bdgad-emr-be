import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  experimental_createMCPClient,
  experimental_MCPClient,
  experimental_MCPClientConfig,
} from 'ai';

@Injectable()
export class AiMcpClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiMcpClientService.name);

  private client: experimental_MCPClient;

  constructor(
    @Inject('MCP_OPTIONS') private options: experimental_MCPClientConfig,
  ) {}
  async onModuleInit() {
    this.logger.log('🚀 Initializing MCP Client Service...');
    this.client = await experimental_createMCPClient(this.options);
  }
  async onModuleDestroy() {
    await this.client.close();
  }
  public async getTools() {
    return this.client.tools();
  }
  public async close() {
    return this.client.close();
  }
}
