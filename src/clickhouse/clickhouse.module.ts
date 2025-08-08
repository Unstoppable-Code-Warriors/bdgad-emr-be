import { Module, DynamicModule } from '@nestjs/common';
import { ClickHouseService } from './clickhouse.service';

export interface ClickHouseModuleOptions {
  database?: string;
  useFactory?: (
    ...args: any[]
  ) => ClickHouseModuleOptions | Promise<ClickHouseModuleOptions>;
  inject?: any[];
}

export interface ClickHouseModuleAsyncOptions {
  useFactory?: (
    ...args: any[]
  ) => ClickHouseModuleOptions | Promise<ClickHouseModuleOptions>;
  inject?: any[];
}

export const CLICKHOUSE_MODULE_OPTIONS = 'CLICKHOUSE_MODULE_OPTIONS';

@Module({})
export class ClickHouseModule {
  static forRoot(options: ClickHouseModuleOptions = {}): DynamicModule {
    return {
      module: ClickHouseModule,
      providers: [
        {
          provide: CLICKHOUSE_MODULE_OPTIONS,
          useValue: options,
        },
        ClickHouseService,
      ],
      exports: [ClickHouseService],
      global: true,
    };
  }

  static forRootAsync(options: ClickHouseModuleAsyncOptions): DynamicModule {
    return {
      module: ClickHouseModule,
      providers: [
        {
          provide: CLICKHOUSE_MODULE_OPTIONS,
          useFactory: options.useFactory || (() => ({})),
          inject: options.inject || [],
        },
        ClickHouseService,
      ],
      exports: [ClickHouseService],
      global: true,
    };
  }

  static forFeature(options: ClickHouseModuleOptions = {}): DynamicModule {
    return {
      module: ClickHouseModule,
      providers: [
        {
          provide: CLICKHOUSE_MODULE_OPTIONS,
          useValue: options,
        },
        ClickHouseService,
      ],
      exports: [ClickHouseService],
    };
  }
}
