import { Injectable } from '@nestjs/common';
import { ClickHouseService } from './clickhouse/clickhouse.service';

@Injectable()
export class AppService {
  constructor(private readonly clickHouseService: ClickHouseService) {}

  getHello(): string {
    return 'Hello From EMR Backend!';
  }

  async getClickHouseVersion() {
    try {
      const result = await this.clickHouseService.query('SELECT version()');
      return result;
    } catch (error) {
      throw new Error(`Failed to get ClickHouse version: ${error.message}`);
    }
  }
}
