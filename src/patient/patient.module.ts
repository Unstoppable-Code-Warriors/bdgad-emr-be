import { Module } from '@nestjs/common';
import { PatientService } from './patient.service';
import { PatientController } from './patient.controller';
import { ClickHouseModule } from '../clickhouse/clickhouse.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ClickHouseModule.forFeature(), AuthModule],
  controllers: [PatientController],
  providers: [PatientService],
})
export class PatientModule {}
