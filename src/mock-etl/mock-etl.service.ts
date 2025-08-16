import { Inject, Injectable, Logger } from '@nestjs/common';
import { MockEtlReqDto } from './dtos/mock-etl-req.dto';
import { ClientProxy } from '@nestjs/microservices';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { S3Service } from 'src/s3';
import { firstValueFrom } from 'rxjs';
import * as FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MockEtlService {
  private readonly logger = new Logger(MockEtlService.name);
  private vcfPath: string;

  constructor(
    @Inject('ETL_SERVICE') private readonly etlClient: ClientProxy,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly s3Service: S3Service,
  ) {
    this.vcfPath = this.configService.get<string>('VCF_PATH') || '';
  }

  async startAnalyze(body: MockEtlReqDto) {
    let tempFilePath: string | null = null;

    try {
      // 1. Download VCF file from S3 to local temp folder
      this.logger.log(
        `Starting analysis for ${body.analysis_id}, downloading VCF from: ${this.vcfPath}`,
      );

      const tempDir = path.join(process.cwd(), 'temp');
      const downloadResult = await this.s3Service.downloadFileToLocal(
        this.vcfPath,
        tempDir,
        `${body.analysis_id}_${Date.now()}.vcf.gz`,
      );

      tempFilePath = downloadResult.filePath;
      this.logger.log(`VCF file downloaded to: ${tempFilePath}`);

      // 2. Submit to OpenCRAVAT /submit/submit endpoint
      const formData = new FormData();

      // Add the VCF file
      formData.append('file_0', fs.createReadStream(tempFilePath));

      // Add options as JSON string
      const options = {
        annotators: ['clinvar', 'cosmic', 'dbsnp'],
        reports: ['text', 'excel'],
        assembly: 'hg38',
        note: `Pipeline automation for analysis ${body.analysis_id}`,
      };
      formData.append('options', JSON.stringify(options));

      this.logger.log('Submitting VCF file to OpenCRAVAT service...');

      const response = await firstValueFrom(
        this.httpService.post('/submit/submit', formData, {
          headers: {
            ...formData.getHeaders(),
          },
        }),
      );

      this.logger.log(
        `OpenCRAVAT submission successful. Job ID: ${response.data.id}`,
      );

      // Send result to ETL queue
      this.etlClient.emit('result', {
        ...body,
        complete_time: new Date().toISOString(),
        htmlResult: `${this.configService.get<string>('OPEN_CRAVAT_SERVICE')}/result/index.html?job_id=${response.data.id}`,
        excelResult: `${this.configService.get<string>('OPEN_CRAVAT_SERVICE')}/submit/jobs/${response.data.id}/reports/excel`,
      });

      // Return only id and status as requested
      return {
        id: response.data.id,
        status: response.data.status,
      };
    } catch (error) {
      this.logger.error('Error in startAnalyze:', error);
      throw error;
    } finally {
      // 3. Clean up temp file
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          this.logger.log(`Temporary file cleaned up: ${tempFilePath}`);
        } catch (cleanupError) {
          this.logger.warn(
            `Failed to cleanup temp file ${tempFilePath}:`,
            cleanupError,
          );
        }
      }
    }
  }
}
