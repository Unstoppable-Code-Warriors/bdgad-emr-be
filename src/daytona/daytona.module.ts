import { Module } from '@nestjs/common';
import { DaytonaService } from './daytona.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [DaytonaService],
  exports: [DaytonaService],
})
export class DaytonaModule {}
