import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
