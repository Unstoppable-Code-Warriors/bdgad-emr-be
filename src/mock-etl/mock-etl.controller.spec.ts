import { Test, TestingModule } from '@nestjs/testing';
import { MockEtlController } from './mock-etl.controller';

describe('MockEtlController', () => {
  let controller: MockEtlController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MockEtlController],
    }).compile();

    controller = module.get<MockEtlController>(MockEtlController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
