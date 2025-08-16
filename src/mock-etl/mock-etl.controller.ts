import { Body, Controller, Post } from '@nestjs/common';
import { MockEtlReqDto } from './dtos/mock-etl-req.dto';
import { MockEtlService } from './mock-etl.service';

@Controller('mock-etl')
export class MockEtlController {
  constructor(private readonly mockEtlService: MockEtlService) {}

  @Post('analyze')
  sendMockEtl(@Body() body: MockEtlReqDto) {
    return this.mockEtlService.startAnalyze(body);
  }
}
