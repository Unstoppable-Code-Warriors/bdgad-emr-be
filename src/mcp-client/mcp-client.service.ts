import {
  Injectable,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import {
  type ClientConfig,
  MultiServerMCPClient,
} from '@langchain/mcp-adapters';

@Injectable()
export class McpClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(McpClientService.name);
  private client: MultiServerMCPClient;

  constructor(@Inject('MCP_CLIENT_OPTIONS') private options: ClientConfig) {}

  async onModuleInit() {
    this.logger.log('🚀 Initializing MCP Client Service...');

    // Log MCP server configuration
    await this.logMcpConfiguration();

    // Initialize the client when the module is initialized
    await this.connect();

    // Log available tools after connection
    await this.logAvailableTools();
  }

  async onModuleDestroy() {
    this.logger.log('🔥 Shutting down MCP Client Service...');
    // Clean up connections when the module is destroyed
    await this.disconnect();
  }

  private async logMcpConfiguration() {
    this.logger.log('📋 MCP Server Configuration:');

    if (
      this.options.mcpServers &&
      Object.keys(this.options.mcpServers).length > 0
    ) {
      Object.entries(this.options.mcpServers).forEach(
        ([serverName, config]) => {
          this.logger.log(`  📡 Server: ${serverName}`);
          this.logger.log(`     🔗 Transport: ${config.transport || 'stdio'}`);

          // Handle different server types safely
          if ('url' in config && config.url) {
            this.logger.log(`     🌐 URL: ${config.url}`);
          }

          if ('command' in config && config.command) {
            this.logger.log(`     💻 Command: ${config.command}`);
            if ('args' in config && config.args && config.args.length > 0) {
              this.logger.log(`     📝 Args: ${config.args.join(' ')}`);
            }
          }

          if ('reconnect' in config && config.reconnect) {
            this.logger.log(
              `     🔄 Reconnect: ${config.reconnect.enabled ? 'Enabled' : 'Disabled'}`,
            );
            if (config.reconnect.enabled) {
              this.logger.log(
                `     ⚡ Max Attempts: ${config.reconnect.maxAttempts}`,
              );
              this.logger.log(`     ⏱️  Delay: ${config.reconnect.delayMs}ms`);
            }
          }
        },
      );
    } else {
      this.logger.warn('⚠️  No MCP servers configured');
    }

    // Log other MCP options
    this.logger.log(
      `🏷️  Prefix Tool Names: ${this.options.prefixToolNameWithServerName ? 'Yes' : 'No'}`,
    );
    this.logger.log(
      `🏷️  Additional Prefix: "${this.options.additionalToolNamePrefix || 'None'}"`,
    );
    this.logger.log(
      `🚨 Throw on Load Error: ${this.options.throwOnLoadError ? 'Yes' : 'No'}`,
    );
  }

  private async connect() {
    try {
      this.logger.log('🔌 Connecting to MCP servers...');

      // Create a new client instance
      this.client = new MultiServerMCPClient(this.options);

      await this.client.initializeConnections();

      this.logger.log('✅ Successfully connected to MCP servers');
      return this.client;
    } catch (error) {
      this.logger.error('❌ Failed to connect to MCP servers:', error.message);
      throw error;
    }
  }

  private async logAvailableTools() {
    try {
      this.logger.log('🔍 Loading available tools...');

      const tools = await this.client.getTools();

      if (tools && tools.length > 0) {
        this.logger.log(`🛠️  Found ${tools.length} tools:`);

        tools.forEach((tool, index) => {
          this.logger.log(`  ${index + 1}. 🔧 ${tool.name}`);
          if (tool.description) {
            this.logger.log(`     📝 ${tool.description}`);
          }
        });
      } else {
        this.logger.warn('⚠️  No tools available from MCP servers');
      }
    } catch (error) {
      this.logger.error('❌ Failed to load tools:', error.message);
    }
  }

  async getClient() {
    if (!this.client) {
      await this.connect();
    }

    return this.client;
  }

  async disconnect() {
    if (this.client) {
      this.logger.log('🔌 Disconnecting from MCP servers...');
      await this.client.close();
      this.logger.log('✅ Disconnected from MCP servers');
    }
  }

  async getTools(...servers: string[]) {
    try {
      const tools = await this.client.getTools(...servers);

      if (servers.length > 0) {
        this.logger.debug(
          `🔍 Retrieved ${tools.length} tools from servers: ${servers.join(', ')}`,
        );
      } else {
        this.logger.debug(
          `🔍 Retrieved ${tools.length} tools from all servers`,
        );
      }

      return tools;
    } catch (error) {
      this.logger.error(`❌ Failed to get tools: ${error.message}`);
      throw error;
    }
  }

  // New method to get server status information
  async getServerStatus() {
    if (!this.client) {
      return { connected: false, servers: [] };
    }

    try {
      const tools = await this.client.getTools();
      const serverNames = Object.keys(this.options.mcpServers || {});

      return {
        connected: true,
        serversCount: serverNames.length,
        servers: serverNames,
        toolsCount: tools.length,
      };
    } catch (error) {
      this.logger.error('❌ Failed to get server status:', error.message);
      return { connected: false, servers: [], error: error.message };
    }
  }
}
