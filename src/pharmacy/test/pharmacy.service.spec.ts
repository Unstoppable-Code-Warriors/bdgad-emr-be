import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';
import { PharmacyService } from '../pharmacy.service';
import { of } from 'rxjs';

describe('PharmacyService', () => {
  let service: PharmacyService;
  let mockClient: jest.Mocked<ClientProxy>;

  beforeEach(async () => {
    mockClient = {
      emit: jest.fn().mockReturnValue(of({})),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PharmacyService,
        {
          provide: 'PHARMACY_SERVICE',
          useValue: mockClient,
        },
      ],
    }).compile();

    service = module.get<PharmacyService>(PharmacyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendToPharmacyQueue', () => {
    it('should send default mock data to queue', async () => {
      const result = await service.sendToPharmacyQueue();

      expect(mockClient.emit).toHaveBeenCalledWith(
        'pharmacy_send',
        expect.any(Object),
      );
      expect(result.success).toBe(true);
      expect(result.pattern).toBe('pharmacy_send');
      expect(result.payload).toHaveProperty('appointment');
      expect(result.payload).toHaveProperty('patient');
      expect(result.payload).toHaveProperty('medical_record');
    });

    it('should send custom data to queue', async () => {
      const customData = {
        patient: {
          fullname: 'Test Patient',
          phone: '0123456789',
        },
        appointment: {
          id: 'test-appointment-id',
        },
      };

      const result = await service.sendToPharmacyQueue(customData);

      expect(mockClient.emit).toHaveBeenCalledWith(
        'pharmacy_send',
        expect.any(Object),
      );
      expect(result.success).toBe(true);
      expect(result.payload.patient.fullname).toBe('Test Patient');
      expect(result.payload.patient.phone).toBe('0123456789');
      expect(result.payload.appointment.id).toBe('test-appointment-id');
    });

    it('should use fixed doctor ID 7', async () => {
      const result = await service.sendToPharmacyQueue();

      expect(result.payload.medical_record.incharge_doctor.id).toBe(7);
      expect(result.payload.medical_record.support_doctor.id).toBe(7);
    });

    it('should handle errors gracefully', async () => {
      mockClient.emit.mockReturnValue({
        toPromise: jest.fn().mockRejectedValue(new Error('Connection failed')),
      } as any);

      await expect(service.sendToPharmacyQueue()).rejects.toThrow(
        'Failed to send message to pharmacy queue: Connection failed',
      );
    });
  });

  describe('sendToPharmacyQueueWithAppointmentId', () => {
    it('should send message with custom appointment ID', async () => {
      const appointmentId = 'custom-appointment-123';
      const result =
        await service.sendToPharmacyQueueWithAppointmentId(appointmentId);

      expect(mockClient.emit).toHaveBeenCalledWith(
        'pharmacy_send',
        expect.any(Object),
      );
      expect(result.payload.appointment.id).toBe(appointmentId);
    });
  });

  describe('sendToPharmacyQueueWithPatient', () => {
    it('should send message with custom patient data', async () => {
      const patientData = {
        fullname: 'John Doe',
        phone: '0987654321',
        gender: 'Nam',
      };

      const result = await service.sendToPharmacyQueueWithPatient(patientData);

      expect(mockClient.emit).toHaveBeenCalledWith(
        'pharmacy_send',
        expect.any(Object),
      );
      expect(result.payload.patient.fullname).toBe('John Doe');
      expect(result.payload.patient.phone).toBe('0987654321');
      expect(result.payload.patient.gender).toBe('Nam');
    });
  });
});
