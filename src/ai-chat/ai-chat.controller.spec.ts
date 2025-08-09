import { Test, TestingModule } from '@nestjs/testing';
import { AiChatController } from './ai-chat.controller';

describe('AiChatController', () => {
  let controller: AiChatController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiChatController],
    }).compile();

    controller = module.get<AiChatController>(AiChatController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
