import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import { GeneralFilesService } from './general-files.service';
import { GeneralFilesController } from './general-files.controller';

@Module({
  controllers: [GeneralFilesController],
  providers: [
    {
      provide: 'GENERAL_FILES_CLICKHOUSE_SERVICE',
      useFactory: (configService: ConfigService) => {
        const service = new ClickHouseService(configService, {
          database: 'emr_general_files',
        });
        return service;
      },
      inject: [ConfigService],
    },
    {
      provide: GeneralFilesService,
      useFactory: (clickHouseService: ClickHouseService) => {
        return new GeneralFilesService(clickHouseService);
      },
      inject: ['GENERAL_FILES_CLICKHOUSE_SERVICE'],
    },
  ],
  exports: [GeneralFilesService],
})
export class GeneralFilesModule {}
