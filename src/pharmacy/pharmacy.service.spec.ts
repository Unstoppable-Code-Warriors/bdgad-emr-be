import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { PharmacyService } from './pharmacy.service';
import { AiService } from '../ai/ai.service';
import { PharmacyQueueDto } from './dto/pharmacy-queue.dto';
import { of, throwError } from 'rxjs';

describe('PharmacyService', () => {
  let service: PharmacyService;
  let mockClient: jest.Mocked<ClientProxy>;
  let aiService: jest.Mocked<AiService>;
  let logger: jest.SpyInstance;

  const mockGeneratedData = {
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
        id: 7,
        name: 'Dr. Test',
      },
    },
  };

  beforeEach(async () => {
    mockClient = {
      emit: jest.fn().mockReturnValue(of({})),
    } as any;

    const mockAiService = {
      generatePharmacyQueueData: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PharmacyService,
        {
          provide: 'PHARMACY_SERVICE',
          useValue: mockClient,
        },
        {
          provide: AiService,
          useValue: mockAiService,
        },
      ],
    }).compile();

    service = module.get<PharmacyService>(PharmacyService);
    aiService = module.get(AiService);

    // Mock logger
    logger = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendToPharmacyQueue', () => {
    beforeEach(() => {
      aiService.generatePharmacyQueueData.mockResolvedValue(mockGeneratedData);
    });

    it('should send generated data to queue successfully', async () => {
      const result = await service.sendToPharmacyQueue();

      expect(aiService.generatePharmacyQueueData).toHaveBeenCalledWith(
        undefined,
      );
      expect(mockClient.emit).toHaveBeenCalledWith(
        'pharmacy_patient_info',
        mockGeneratedData,
      );
      expect(result).toEqual({
        success: true,
        message: 'Message sent to pharmacy queue successfully',
        pattern: 'pharmacy_patient_info',
        payload: mockGeneratedData,
        timestamp: expect.any(String),
      });
      expect(logger).toHaveBeenCalledWith(
        'Sending message to pharmacy queue with pattern: pharmacy_patient_info',
      );
      expect(Logger.prototype.debug).toHaveBeenCalledWith(
        'Payload:',
        JSON.stringify(mockGeneratedData, null, 2),
      );
      expect(logger).toHaveBeenCalledWith(
        'Message sent successfully to pharmacy queue',
      );
    });

    it('should send custom data to queue', async () => {
      const customData: Partial<PharmacyQueueDto> = {
        patient: {
          fullname: 'Custom Patient',
          phone: '0987654321',
          gender: 'Nữ',
        },
        appointment: {
          id: 'custom-appointment-456',
        },
      };

      const customGeneratedData = {
        ...mockGeneratedData,
        ...customData,
      };

      aiService.generatePharmacyQueueData.mockResolvedValue(
        customGeneratedData,
      );

      const result = await service.sendToPharmacyQueue(customData);

      expect(aiService.generatePharmacyQueueData).toHaveBeenCalledWith(
        customData,
      );
      expect(mockClient.emit).toHaveBeenCalledWith(
        'pharmacy_patient_info',
        customGeneratedData,
      );
      expect(result.success).toBe(true);
      expect(result.payload).toEqual(customGeneratedData);
    });

    it('should handle AI service errors', async () => {
      const error = new Error('AI service failed');
      aiService.generatePharmacyQueueData.mockRejectedValue(error);

      await expect(service.sendToPharmacyQueue()).rejects.toThrow(
        'Failed to send message to pharmacy queue: AI service failed',
      );

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Failed to send message to pharmacy queue',
        error.stack,
      );
    });

    it('should handle client emit errors', async () => {
      const error = new Error('RabbitMQ connection failed');
      mockClient.emit.mockImplementation(() => {
        throw error;
      });

      await expect(service.sendToPharmacyQueue()).rejects.toThrow(
        'Failed to send message to pharmacy queue: RabbitMQ connection failed',
      );

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Failed to send message to pharmacy queue',
        error.stack,
      );
    });

    it('should return proper timestamp format', async () => {
      const result = await service.sendToPharmacyQueue();

      expect(result.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });

    it('should handle undefined custom data', async () => {
      const result = await service.sendToPharmacyQueue(undefined);

      expect(aiService.generatePharmacyQueueData).toHaveBeenCalledWith(
        undefined,
      );
      expect(result.success).toBe(true);
    });

    it('should handle null custom data', async () => {
      const result = await service.sendToPharmacyQueue(null as any);

      expect(aiService.generatePharmacyQueueData).toHaveBeenCalledWith(null);
      expect(result.success).toBe(true);
    });

    it('should handle empty custom data object', async () => {
      const emptyData = {};
      const result = await service.sendToPharmacyQueue(emptyData);

      expect(aiService.generatePharmacyQueueData).toHaveBeenCalledWith(
        emptyData,
      );
      expect(result.success).toBe(true);
    });
  });

  describe('sendToPharmacyQueueWithAppointmentId', () => {
    beforeEach(() => {
      jest.spyOn(service, 'sendToPharmacyQueue').mockResolvedValue({
        success: true,
        message: 'Message sent to pharmacy queue successfully',
        pattern: 'pharmacy_patient_info',
        payload: mockGeneratedData,
        timestamp: '2024-01-15T10:00:00.000Z',
      });
    });

    it('should send message with custom appointment ID', async () => {
      const appointmentId = 'custom-appointment-123';

      const result =
        await service.sendToPharmacyQueueWithAppointmentId(appointmentId);

      expect(service.sendToPharmacyQueue).toHaveBeenCalledWith({
        appointment: {
          id: appointmentId,
        },
      });
      expect(result.success).toBe(true);
    });

    it('should merge with existing custom data', async () => {
      const appointmentId = 'custom-appointment-456';
      const customData: Partial<PharmacyQueueDto> = {
        patient: {
          fullname: 'Test Patient',
        },
        appointment: {
          date: '2024-01-20',
        },
      };

      await service.sendToPharmacyQueueWithAppointmentId(
        appointmentId,
        customData,
      );

      expect(service.sendToPharmacyQueue).toHaveBeenCalledWith({
        patient: {
          fullname: 'Test Patient',
        },
        appointment: {
          date: '2024-01-20',
          id: appointmentId,
        },
      });
    });

    it('should override existing appointment ID', async () => {
      const appointmentId = 'new-appointment-789';
      const customData: Partial<PharmacyQueueDto> = {
        appointment: {
          id: 'old-appointment-123',
          date: '2024-01-20',
        },
      };

      await service.sendToPharmacyQueueWithAppointmentId(
        appointmentId,
        customData,
      );

      expect(service.sendToPharmacyQueue).toHaveBeenCalledWith({
        appointment: {
          id: appointmentId,
          date: '2024-01-20',
        },
      });
    });

    it('should handle undefined custom data', async () => {
      const appointmentId = 'test-appointment';

      await service.sendToPharmacyQueueWithAppointmentId(
        appointmentId,
        undefined,
      );

      expect(service.sendToPharmacyQueue).toHaveBeenCalledWith({
        appointment: {
          id: appointmentId,
        },
      });
    });
  });

  describe('sendToPharmacyQueueWithPatient', () => {
    beforeEach(() => {
      jest.spyOn(service, 'sendToPharmacyQueue').mockResolvedValue({
        success: true,
        message: 'Message sent to pharmacy queue successfully',
        pattern: 'pharmacy_patient_info',
        payload: mockGeneratedData,
        timestamp: '2024-01-15T10:00:00.000Z',
      });
    });

    it('should send message with custom patient data', async () => {
      const patientData = {
        fullname: 'John Doe',
        phone: '0987654321',
        gender: 'Nam',
      };

      await service.sendToPharmacyQueueWithPatient(patientData);

      expect(service.sendToPharmacyQueue).toHaveBeenCalledWith({
        patient: patientData,
      });
    });

    it('should merge with existing custom data', async () => {
      const patientData = {
        fullname: 'Jane Smith',
        phone: '0123456789',
      };
      const customData: Partial<PharmacyQueueDto> = {
        appointment: {
          id: 'test-appointment',
        },
        patient: {
          gender: 'Nữ',
          address1: '123 Main St',
        },
      };

      await service.sendToPharmacyQueueWithPatient(patientData, customData);

      expect(service.sendToPharmacyQueue).toHaveBeenCalledWith({
        appointment: {
          id: 'test-appointment',
        },
        patient: {
          gender: 'Nữ',
          address1: '123 Main St',
          fullname: 'Jane Smith',
          phone: '0123456789',
        },
      });
    });

    it('should override existing patient data', async () => {
      const patientData = {
        fullname: 'New Patient',
        phone: '0999888777',
      };
      const customData: Partial<PharmacyQueueDto> = {
        patient: {
          fullname: 'Old Patient',
          phone: '0111222333',
          gender: 'Nam',
        },
      };

      await service.sendToPharmacyQueueWithPatient(patientData, customData);

      expect(service.sendToPharmacyQueue).toHaveBeenCalledWith({
        patient: {
          fullname: 'New Patient',
          phone: '0999888777',
          gender: 'Nam',
        },
      });
    });

    it('should handle undefined custom data', async () => {
      const patientData = {
        fullname: 'Test Patient',
      };

      await service.sendToPharmacyQueueWithPatient(patientData, undefined);

      expect(service.sendToPharmacyQueue).toHaveBeenCalledWith({
        patient: patientData,
      });
    });

    it('should handle empty patient data', async () => {
      const patientData = {};

      await service.sendToPharmacyQueueWithPatient(patientData);

      expect(service.sendToPharmacyQueue).toHaveBeenCalledWith({
        patient: {},
      });
    });
  });

  describe('Logger Integration', () => {
    it('should have logger instance', () => {
      expect(service['logger']).toBeDefined();
      expect(service['logger']).toBeInstanceOf(Logger);
    });

    it('should use PharmacyService as logger context', () => {
      const loggerInstance = service['logger'];
      expect(loggerInstance['context']).toBe('PharmacyService');
    });
  });

  describe('Error Handling', () => {
    it('should preserve original error message in wrapped error', async () => {
      const originalError = new Error('Original error message');
      aiService.generatePharmacyQueueData.mockRejectedValue(originalError);

      await expect(service.sendToPharmacyQueue()).rejects.toThrow(
        'Failed to send message to pharmacy queue: Original error message',
      );
    });

    it('should handle errors without message', async () => {
      const errorWithoutMessage = { name: 'CustomError' } as Error;
      aiService.generatePharmacyQueueData.mockRejectedValue(
        errorWithoutMessage,
      );

      await expect(service.sendToPharmacyQueue()).rejects.toThrow(
        'Failed to send message to pharmacy queue: undefined',
      );
    });

    it('should handle errors without stack trace', async () => {
      const error = new Error('Test error');
      error.stack = undefined;
      aiService.generatePharmacyQueueData.mockRejectedValue(error);

      await expect(service.sendToPharmacyQueue()).rejects.toThrow(
        'Failed to send message to pharmacy queue: Test error',
      );

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Failed to send message to pharmacy queue',
        undefined,
      );
    });
  });
});
