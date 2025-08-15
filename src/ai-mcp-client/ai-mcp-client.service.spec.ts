import { Test, TestingModule } from '@nestjs/testing';
import { AiMcpClientService } from './ai-mcp-client.service';

describe('AiMcpClientService', () => {
  let service: AiMcpClientService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiMcpClientService],
    }).compile();

    service = module.get<AiMcpClientService>(AiMcpClientService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
