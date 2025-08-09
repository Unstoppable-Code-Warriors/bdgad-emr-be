import { Controller, Get } from '@nestjs/common';
import { McpClientService } from '../mcp-client/mcp-client.service';

@Controller('health')
export class HealthController {
  constructor(private readonly mcpClientService: McpClientService) {}

  @Get('mcp')
  async getMcpStatus() {
    try {
      const status = await this.mcpClientService.getServerStatus();
      return {
        timestamp: new Date().toISOString(),
        status: 'success',
        mcp: status,
      };
    } catch (error) {
      return {
        timestamp: new Date().toISOString(),
        status: 'error',
        error: error.message,
        mcp: { connected: false, servers: [] },
      };
    }
  }
}
