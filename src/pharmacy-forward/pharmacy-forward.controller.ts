import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { PharmacyForwardService } from './pharmacy-forward.service';
import { PharmacyQueueDto } from '../pharmacy/dto/pharmacy-queue.dto';

@Controller()
export class PharmacyForwardController {
  private readonly logger = new Logger(PharmacyForwardController.name);

  constructor(
    private readonly pharmacyForwardService: PharmacyForwardService,
  ) {}

  @EventPattern('pharmacy_patient_info')
  async handlePharmacyPatientInfo(@Payload() data: PharmacyQueueDto) {
    this.logger.log('Received pharmacy_patient_info event from pharmacy queue');
    this.logger.debug('Data:', JSON.stringify(data, null, 2));

    try {
      await this.pharmacyForwardService.forwardToTargetQueues(data);
      this.logger.log('Successfully forwarded data to target queues');
    } catch (error) {
      this.logger.error('Failed to forward data to target queues', error.stack);
      throw error;
    }
  }
}
