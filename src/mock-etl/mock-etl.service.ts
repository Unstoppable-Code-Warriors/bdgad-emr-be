import { Inject, Injectable } from '@nestjs/common';
import { MockEtlReqDto } from './dtos/mock-etl-req.dto';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class MockEtlService {
  constructor(@Inject('ETL_SERVICE') private readonly etlClient: ClientProxy) {}

  sendMockEtl(body: MockEtlReqDto) {
    this.etlClient.emit('result', {
      ...body,
      complete_time: new Date().toISOString(),
      resultS3Url: 's3://etl-results/mock-output.zip',
    });
    return {
      message: 'Analysis pipeline started',
    };
  }
}
