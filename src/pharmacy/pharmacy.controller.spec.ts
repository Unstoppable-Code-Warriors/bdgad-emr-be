import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { PharmacyController } from './pharmacy.controller';
import { PharmacyService } from './pharmacy.service';
import { PharmacyQueueDto } from './dto/pharmacy-queue.dto';

describe('PharmacyController', () => {
  let controller: PharmacyController;
  let pharmacyService: jest.Mocked<PharmacyService>;
  let logger: jest.SpyInstance;

  const mockSuccessResponse = {
    success: true,
    message: 'Message sent to pharmacy queue successfully',
    pattern: 'pharmacy_patient_info',
    payload: {
      appointment: {
        id: 'appointment-123',
        date: '2024-01-15',
      },
      patient: {
        fullname: 'Test Patient',
        phone: '0123456789',
        gender: 'Nam',
        citizen_id: '123456789012',
        date_of_birth: '1990-01-01',
      },
      medical_record: {
        doctor: {
          id: '7',
          name: 'Dr. Test',
        },
      },
    },
    timestamp: '2024-01-15T10:00:00.000Z',
  };

  beforeEach(async () => {
    const mockPharmacyService = {
      sendToPharmacyQueue: jest.fn(),
      sendToPharmacyQueueWithAppointmentId: jest.fn(),
      sendToPharmacyQueueWithPatient: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PharmacyController],
      providers: [
        {
          provide: PharmacyService,
          useValue: mockPharmacyService,
        },
      ],
    }).compile();

    controller = module.get<PharmacyController>(PharmacyController);
    pharmacyService = module.get(PharmacyService);

    // Mock logger
    logger = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('sendToQueue', () => {
    beforeEach(() => {
      pharmacyService.sendToPharmacyQueue.mockResolvedValue(
        mockSuccessResponse,
      );
    });

    it('should send mock data when body is undefined', async () => {
      const result = await controller.sendToQueue();

      expect(pharmacyService.sendToPharmacyQueue).toHaveBeenCalledWith();
      expect(result).toEqual(mockSuccessResponse);
      expect(logger).toHaveBeenCalledWith(
        'POST /pharmacy/send-queue - Body is empty, sending mock data',
      );
    });

    it('should send mock data when body is null', async () => {
      const result = await controller.sendToQueue(null as any);

      expect(pharmacyService.sendToPharmacyQueue).toHaveBeenCalledWith();
      expect(result).toEqual(mockSuccessResponse);
      expect(logger).toHaveBeenCalledWith(
        'POST /pharmacy/send-queue - Body is empty, sending mock data',
      );
    });

    it('should send mock data when body is empty object', async () => {
      const result = await controller.sendToQueue({});

      expect(pharmacyService.sendToPharmacyQueue).toHaveBeenCalledWith();
      expect(result).toEqual(mockSuccessResponse);
      expect(logger).toHaveBeenCalledWith(
        'POST /pharmacy/send-queue - Body is empty, sending mock data',
      );
    });

    it('should send custom data when body is provided', async () => {
      const customData: Partial<PharmacyQueueDto> = {
        patient: {
          fullname: 'Custom Patient',
          phone: '0987654321',
          gender: 'Nữ',
          citizen_id: '987654321098',
          date_of_birth: '1999-01-01',
        },
        appointment: {
          id: 'custom-appointment-456',
          date: '2024-01-20',
        },
      };

      const result = await controller.sendToQueue(customData);

      expect(pharmacyService.sendToPharmacyQueue).toHaveBeenCalledWith(
        customData,
      );
      expect(result).toEqual(mockSuccessResponse);
      expect(logger).toHaveBeenCalledWith(
        'POST /pharmacy/send-queue - Body provided, sending custom data',
      );
    });

    it('should handle service errors', async () => {
      const error = new Error('Service error');
      pharmacyService.sendToPharmacyQueue.mockRejectedValue(error);

      await expect(controller.sendToQueue()).rejects.toThrow('Service error');
      expect(pharmacyService.sendToPharmacyQueue).toHaveBeenCalledWith();
    });

    it('should treat object with only empty nested objects as empty', async () => {
      const emptyNestedData = {
        patient: {},
        appointment: {},
        medical_record: {},
      };

      const result = await controller.sendToQueue(emptyNestedData);

      // Object.keys(emptyNestedData).length > 0, so it should send custom data
      expect(pharmacyService.sendToPharmacyQueue).toHaveBeenCalledWith(
        emptyNestedData,
      );
      expect(result).toEqual(mockSuccessResponse);
      expect(logger).toHaveBeenCalledWith(
        'POST /pharmacy/send-queue - Body provided, sending custom data',
      );
    });
  });

  describe('sendQueueHourly (Cron Job)', () => {
    beforeEach(() => {
      pharmacyService.sendToPharmacyQueue.mockResolvedValue(
        mockSuccessResponse,
      );
    });

    it('should send mock data successfully', async () => {
      const result = await controller.sendQueueHourly();

      expect(pharmacyService.sendToPharmacyQueue).toHaveBeenCalledWith();
      expect(result).toEqual(mockSuccessResponse);
      expect(logger).toHaveBeenCalledWith(
        'Cron job triggered - Sending mock data to pharmacy queue (hourly)',
      );
      expect(logger).toHaveBeenCalledWith(
        `Cron job completed successfully - Message sent with timestamp: ${mockSuccessResponse.timestamp}`,
      );
    });

    it('should handle errors gracefully and log them', async () => {
      const error = new Error('Queue connection failed');
      pharmacyService.sendToPharmacyQueue.mockRejectedValue(error);

      await expect(controller.sendQueueHourly()).rejects.toThrow(error);

      expect(pharmacyService.sendToPharmacyQueue).toHaveBeenCalledWith();
      expect(logger).toHaveBeenCalledWith(
        'Cron job triggered - Sending mock data to pharmacy queue (hourly)',
      );
      // Check error logging
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Cron job failed to send message to pharmacy queue',
        error.stack,
      );
    });

    it('should handle errors without stack trace', async () => {
      const error = new Error('Queue connection failed');
      error.stack = undefined;
      pharmacyService.sendToPharmacyQueue.mockRejectedValue(error);

      await expect(controller.sendQueueHourly()).rejects.toThrow(error);

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Cron job failed to send message to pharmacy queue',
        undefined,
      );
    });

    it('should propagate different types of errors', async () => {
      const errorTypes = [
        new Error('Network error'),
        new TypeError('Type error'),
        new ReferenceError('Reference error'),
        { message: 'Custom error object' } as Error,
      ];

      for (const error of errorTypes) {
        pharmacyService.sendToPharmacyQueue.mockRejectedValue(error);

        await expect(controller.sendQueueHourly()).rejects.toThrow(error);
        expect(pharmacyService.sendToPharmacyQueue).toHaveBeenCalledWith();

        pharmacyService.sendToPharmacyQueue.mockClear();
      }
    });
  });

  describe('Logger Integration', () => {
    it('should have logger instance', () => {
      expect(controller['logger']).toBeDefined();
      expect(controller['logger']).toBeInstanceOf(Logger);
    });

    it('should use PharmacyController as logger context', () => {
      const loggerInstance = controller['logger'];
      expect(loggerInstance['context']).toBe('PharmacyController');
    });
  });
});
