import { Test, TestingModule } from '@nestjs/testing';
import { MockEtlService } from './mock-etl.service';

describe('MockEtlService', () => {
  let service: MockEtlService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MockEtlService],
    }).compile();

    service = module.get<MockEtlService>(MockEtlService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
