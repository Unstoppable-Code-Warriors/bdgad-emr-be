import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { PharmacyQueueDto } from './dto/pharmacy-queue.dto';
import { AiService } from '../ai/ai.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PharmacyService {
  private readonly logger = new Logger(PharmacyService.name);

  constructor(
    @Inject('PHARMACY_SERVICE')
    private readonly pharmacyClient: ClientProxy,
    private readonly aiService: AiService,
  ) {}

  /**
   * Send message to pharmacy queue with pattern "pharmacy_patient_info"
   */
  async sendToPharmacyQueue(
    customData?: Partial<PharmacyQueueDto>,
  ): Promise<any> {
    try {
      // Use AI service to generate data instead of static mock data
      const payload =
        await this.aiService.generatePharmacyQueueData(customData);

      this.logger.log(
        'Sending message to pharmacy queue with pattern: pharmacy_patient_info',
      );
      this.logger.debug('Payload:', JSON.stringify(payload, null, 2));

      // Emit to RabbitMQ with the specified pattern
      const result = this.pharmacyClient.emit('pharmacy_patient_info', payload);

      this.logger.log('Message sent successfully to pharmacy queue');
      return {
        success: true,
        message: 'Message sent to pharmacy queue successfully',
        pattern: 'pharmacy_patient_info',
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
