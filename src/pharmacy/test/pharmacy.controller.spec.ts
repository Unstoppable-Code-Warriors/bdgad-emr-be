import { Test, TestingModule } from '@nestjs/testing';
import { PharmacyController } from '../pharmacy.controller';
import { PharmacyService } from '../pharmacy.service';

describe('PharmacyController', () => {
  let controller: PharmacyController;
  let service: PharmacyService;

  beforeEach(async () => {
    const mockService = {
      sendToPharmacyQueue: jest.fn().mockResolvedValue({
        success: true,
        message: 'Message sent successfully',
        pattern: 'pharmacy_send',
        payload: { test: 'data' },
        timestamp: new Date().toISOString(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PharmacyController],
      providers: [
        {
          provide: PharmacyService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<PharmacyController>(PharmacyController);
    service = module.get<PharmacyService>(PharmacyService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('sendToQueue', () => {
    it('should send mock data when body is empty', async () => {
      const result = await controller.sendToQueue();

      expect(service.sendToPharmacyQueue).toHaveBeenCalledWith();
      expect(result.success).toBe(true);
    });

    it('should send mock data when body is empty object', async () => {
      const result = await controller.sendToQueue({});

      expect(service.sendToPharmacyQueue).toHaveBeenCalledWith();
      expect(result.success).toBe(true);
    });

    it('should send custom data when body is provided', async () => {
      const customData = {
        patient: {
          fullname: 'Test Patient',
        },
      };

      const result = await controller.sendToQueue(customData);

      expect(service.sendToPharmacyQueue).toHaveBeenCalledWith(customData);
      expect(result.success).toBe(true);
    });

    it('should send mock data when body is null', async () => {
      const result = await controller.sendToQueue(undefined);

      expect(service.sendToPharmacyQueue).toHaveBeenCalledWith();
      expect(result.success).toBe(true);
    });

    it('should send mock data when body is undefined', async () => {
      const result = await controller.sendToQueue(undefined);

      expect(service.sendToPharmacyQueue).toHaveBeenCalledWith();
      expect(result.success).toBe(true);
    });
  });

  describe('sendQueueHourly (Cron Job)', () => {
    it('should send mock data successfully', async () => {
      const result = await controller.sendQueueHourly();

      expect(service.sendToPharmacyQueue).toHaveBeenCalledWith();
      expect(result.success).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Queue connection failed');
      jest.spyOn(service, 'sendToPharmacyQueue').mockRejectedValue(error);

      await expect(controller.sendQueueHourly()).rejects.toThrow(error);
      expect(service.sendToPharmacyQueue).toHaveBeenCalledWith();
    });
  });
});
