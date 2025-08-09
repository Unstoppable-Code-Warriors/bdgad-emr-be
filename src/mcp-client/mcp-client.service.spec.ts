import { Test, TestingModule } from '@nestjs/testing';
import { McpClientService } from './mcp-client.service';

describe('McpClientService', () => {
  let service: McpClientService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [McpClientService],
    }).compile();

    service = module.get<McpClientService>(McpClientService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
