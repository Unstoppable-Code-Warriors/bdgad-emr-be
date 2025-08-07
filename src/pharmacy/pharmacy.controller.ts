import { Controller, Post, Body, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PharmacyService } from './pharmacy.service';
import { PharmacyQueueDto } from './dto/pharmacy-queue.dto';

@Controller('pharmacy')
export class PharmacyController {
  private readonly logger = new Logger(PharmacyController.name);

  constructor(private readonly pharmacyService: PharmacyService) {}

  @Post('send-queue')
  async sendToQueue(@Body() body?: Partial<PharmacyQueueDto>) {
    // Check if body is empty (null, undefined, or empty object)
    const isEmpty = !body || Object.keys(body).length === 0;

    if (isEmpty) {
      this.logger.log(
        'POST /pharmacy/send-queue - Body is empty, sending mock data',
      );
      return await this.pharmacyService.sendToPharmacyQueue();
    } else {
      this.logger.log(
        'POST /pharmacy/send-queue - Body provided, sending custom data',
      );
      return await this.pharmacyService.sendToPharmacyQueue(body);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async sendQueueHourly() {
    this.logger.log(
      'Cron job triggered - Sending mock data to pharmacy queue (hourly)',
    );
    try {
      const result = await this.pharmacyService.sendToPharmacyQueue();
      this.logger.log(
        `Cron job completed successfully - Message sent with timestamp: ${result.timestamp}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        'Cron job failed to send message to pharmacy queue',
        error.stack,
      );
      throw error;
    }
  }
}
