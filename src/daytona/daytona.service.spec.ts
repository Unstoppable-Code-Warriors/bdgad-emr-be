import { Test, TestingModule } from '@nestjs/testing';
import { DaytonaService } from './daytona.service';

describe('DaytonaService', () => {
  let service: DaytonaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DaytonaService],
    }).compile();

    service = module.get<DaytonaService>(DaytonaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
