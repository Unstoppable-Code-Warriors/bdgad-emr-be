import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, ClickHouseClient } from '@clickhouse/client';
import {
  CLICKHOUSE_MODULE_OPTIONS,
  ClickHouseModuleOptions,
} from './clickhouse.module';

@Injectable()
export class ClickHouseService implements OnModuleInit, OnModuleDestroy {
  private client: ClickHouseClient;

  constructor(
    private configService: ConfigService,
    @Optional()
    @Inject(CLICKHOUSE_MODULE_OPTIONS)
    private options: ClickHouseModuleOptions = {},
  ) {}

  async onModuleInit() {
    const protocol = this.configService.get<string>(
      'CLICKHOUSE_PROTOCOL',
      'http',
    );
    const host = this.configService.get<string>('CLICKHOUSE_HOST');
    const port = this.configService.get<number>('CLICKHOUSE_PORT', 8123);
    const username = this.configService.get<string>('CLICKHOUSE_USERNAME');
    const password = this.configService.get<string>('CLICKHOUSE_PASSWORD');

    // Use database from options first, then fallback to config, then to 'default'
    const database =
      this.options?.database ||
      this.configService.get<string>('CLICKHOUSE_DATABASE') ||
      'default';

    this.client = createClient({
      url: `${protocol}://${host}:${port}`,
      username: username,
      password: password,
      database: database,
    });

    // Test connection
    try {
      await this.client.ping();
      console.log(
        `ClickHouse connection established successfully to database: ${database}`,
      );
    } catch (error) {
      console.error('Failed to connect to ClickHouse:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.close();
      console.log('ClickHouse connection closed');
    }
  }

  getClient(): ClickHouseClient {
    return this.client;
  }

  getCurrentDatabase(): string {
    return (
      this.options?.database ||
      this.configService.get<string>('CLICKHOUSE_DATABASE') ||
      'default'
    );
  }

  async query(query: string, params?: Record<string, any>) {
    try {
      const result = await this.client.query({
        query,
        query_params: params,
      });

      return await result.json();
    } catch (error) {
      console.error('ClickHouse query error:', error);
      throw error;
    }
  }

  async insert(table: string, data: any[]) {
    try {
      await this.client.insert({
        table,
        values: data,
        format: 'JSONEachRow',
      });
    } catch (error) {
      console.error('ClickHouse insert error:', error);
      throw error;
    }
  }
}
