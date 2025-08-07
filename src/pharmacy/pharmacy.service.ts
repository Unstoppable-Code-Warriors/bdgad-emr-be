import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { PharmacyQueueDto } from './dto/pharmacy-queue.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PharmacyService {
  private readonly logger = new Logger(PharmacyService.name);

  constructor(
    @Inject('PHARMACY_SERVICE')
    private readonly pharmacyClient: ClientProxy,
  ) {}

  /**
   * Generate mock data for pharmacy queue message
   */
  private generateMockData(
    customData?: Partial<PharmacyQueueDto>,
  ): PharmacyQueueDto {
    const mockData: PharmacyQueueDto = {
      appointment: {
        id: uuidv4(),
        date: new Date().toISOString(),
      },
      patient: {
        fullname: 'Nguyễn Thị Mai',
        ethnicity: 'Kinh',
        marital_status: 'Đã kết hôn',
        address1: '123 Nguyễn Văn Cừ',
        address2: 'Phường 4, Quận 5, TP.HCM',
        phone: '0908123456',
        gender: 'Nữ',
        nation: 'Việt Nam',
        work_address: 'Công ty ABC, Quận 1, TP.HCM',
        allergies: 'Không có',
        personal_history: 'Tiền sử cao huyết áp',
        family_history: 'Cha bị tiểu đường',
        citizen_id: '001203009876',
      },
      medical_record: {
        incharge_doctor: {
          id: 7, // Fixed ID as requested
          name: 'Đào Xuân Quý',
        },
        support_doctor: {
          id: 7, // Fixed ID as requested
          name: 'Đào Xuân Quý',
        },
        start_at: new Date().toISOString(),
        reason: 'Khám sức khỏe định kỳ',
        current_status: 'Bệnh nhân tỉnh, sinh hiệu ổn',
        treatment: 'Theo dõi huyết áp, điều chỉnh chế độ ăn',
        diagnoses: 'Tăng huyết áp độ 1',
        lab_test: [
          {
            test_type: 'Xét nghiệm',
            test_name: 'Công thức máu toàn bộ',
            machine: 'Sysmex XN-1000',
            taken_by: {
              id: 7,
              name: 'Nguyễn Văn Bình',
            },
            results: [
              {
                name: 'Hồng cầu',
                value: '4.8',
                units: '10^12/L',
                reference_range: '4.2 - 5.4',
              },
              {
                name: 'Bạch cầu',
                value: '6.5',
                units: '10^9/L',
                reference_range: '4.0 - 10.0',
              },
              {
                name: 'Hemoglobin',
                value: '13.5',
                units: 'g/dL',
                reference_range: '12.0 - 16.0',
              },
            ],
            notes: 'Chỉ số trong giới hạn bình thường.',
            conclusion: 'Không có bất thường.',
          },
          {
            test_type: 'Chẩn đoán hình ảnh',
            test_name: 'X-quang ngực',
            taken_by: {
              id: 7,
              name: 'Bác sĩ Nguyễn Thị Dương',
            },
            file_attachments: [
              {
                filename: `patient${Date.now()}_CXR_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.pdf`,
                url: `/path/to/ehr/files/patient${Date.now()}_CXR_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.pdf`,
                file_type: 'application/pdf',
              },
              {
                filename: `patient${Date.now()}_CXR_${new Date().toISOString().split('T')[0].replace(/-/g, '')}_image.dcm`,
                url: `/path/to/ehr/files/patient${Date.now()}_CXR_${new Date().toISOString().split('T')[0].replace(/-/g, '')}_image.dcm`,
                file_type: 'application/dicom',
              },
            ],
            notes: 'Không phát hiện tổn thương phổi.',
            conclusion: 'Phổi bình thường.',
          },
        ],
        prescription: {
          issuedDate: new Date().toISOString(),
          notes: 'Theo dõi huyết áp mỗi ngày tại nhà. Tái khám sau 2 tuần.',
          medications: [
            {
              name: 'Amlodipine 5mg',
              dosage: '1 viên/ngày',
              route: 'Uống',
              frequency: '1 lần/ngày',
              duration: '30 ngày',
              instruction: 'Uống vào buổi sáng sau khi ăn',
              quantity: 30,
            },
            {
              name: 'Paracetamol 500mg',
              dosage: '1 viên khi cần',
              route: 'Uống',
              frequency: 'Tối đa 3 lần/ngày',
              duration: '5 ngày',
              instruction: 'Uống khi sốt trên 38.5°C',
              quantity: 10,
            },
          ],
        },
      },
    };

    // Merge with custom data if provided
    if (customData) {
      return this.deepMerge(mockData, customData);
    }

    return mockData;
  }

  /**
   * Deep merge objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key])
      ) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * Send message to pharmacy queue with pattern "pharmacy_send"
   */
  async sendToPharmacyQueue(
    customData?: Partial<PharmacyQueueDto>,
  ): Promise<any> {
    try {
      const payload = this.generateMockData(customData);

      this.logger.log(
        'Sending message to pharmacy queue with pattern: pharmacy_send',
      );
      this.logger.debug('Payload:', JSON.stringify(payload, null, 2));

      // Emit to RabbitMQ with the specified pattern
      const result = await this.pharmacyClient
        .emit('pharmacy_send', payload)
        .toPromise();

      this.logger.log('Message sent successfully to pharmacy queue');
      return {
        success: true,
        message: 'Message sent to pharmacy queue successfully',
        pattern: 'pharmacy_send',
        payload,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        'Failed to send message to pharmacy queue',
        error.stack,
      );
      throw new Error(
        `Failed to send message to pharmacy queue: ${error.message}`,
      );
    }
  }

  /**
   * Send message with custom appointment ID
   */
  async sendToPharmacyQueueWithAppointmentId(
    appointmentId: string,
    customData?: Partial<PharmacyQueueDto>,
  ): Promise<any> {
    const dataWithAppointmentId = {
      ...customData,
      appointment: {
        ...customData?.appointment,
        id: appointmentId,
      },
    };

    return this.sendToPharmacyQueue(dataWithAppointmentId);
  }

  /**
   * Send message with custom patient data
   */
  async sendToPharmacyQueueWithPatient(
    patientData: Partial<PharmacyQueueDto['patient']>,
    customData?: Partial<PharmacyQueueDto>,
  ): Promise<any> {
    const dataWithPatient = {
      ...customData,
      patient: {
        ...customData?.patient,
        ...patientData,
      },
    };

    return this.sendToPharmacyQueue(dataWithPatient);
  }
}
