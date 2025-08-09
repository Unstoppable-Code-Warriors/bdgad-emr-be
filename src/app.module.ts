import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { ClickHouseModule } from './clickhouse/clickhouse.module';
import { envValidationSchema } from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { PatientModule } from './patient/patient.module';
import { PharmacyModule } from './pharmacy/pharmacy.module';
import { PharmacyForwardModule } from './pharmacy-forward/pharmacy-forward.module';
import { AiModule } from './ai/ai.module';
import { GeneralFilesModule } from './general-files/general-files.module';
import { MockEtlModule } from './mock-etl/mock-etl.module';
import { McpClientModule } from './mcp-client/mcp-client.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    ScheduleModule.forRoot(),
    ClickHouseModule.forRoot(), // Using default database
    AuthModule,
    PatientModule,
    PharmacyModule,
    PharmacyForwardModule,
    AiModule,
    GeneralFilesModule,
    MockEtlModule,
    McpClientModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
