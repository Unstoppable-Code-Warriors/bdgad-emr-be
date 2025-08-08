import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { PharmacyQueueDto } from '../pharmacy/dto/pharmacy-queue.dto';

@Injectable()
export class PharmacyForwardService {
  private readonly logger = new Logger(PharmacyForwardService.name);

  constructor(
    @Inject('PHARMACY_BE_SERVICE')
    private readonly pharmacyBeClient: ClientProxy,
    @Inject('PHARMACY_DW_SERVICE')
    private readonly pharmacyDwClient: ClientProxy,
  ) {}

  /**
   * Forward data to both pharmacy_be and pharmacy_dw queues
   */
  async forwardToTargetQueues(data: PharmacyQueueDto): Promise<void> {
    try {
      this.logger.log('Forwarding data to pharmacy_be and pharmacy_dw queues');

      // Forward to pharmacy_be queue
      const beResult = this.pharmacyBeClient.emit(
        'pharmacy_patient_info',
        data,
      );
      this.logger.log('Data forwarded to pharmacy_be queue');

      // Forward to pharmacy_dw queue
      const dwResult = this.pharmacyDwClient.emit(
        'pharmacy_patient_info',
        data,
      );
      this.logger.log('Data forwarded to pharmacy_dw queue');

      this.logger.log('Successfully forwarded data to both target queues');
    } catch (error) {
      this.logger.error('Failed to forward data to target queues', error.stack);
      throw new Error(
        `Failed to forward data to target queues: ${error.message}`,
      );
    }
  }
}
