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

const VCF_FILES = [
  'MYH7_MYBPC3.vcf.gz', // Cơ tim
  'BRCA_50k.vcf.gz', // Bệnh ung thư vú, ung thư buồng trứng
  'DNAH_50k.vcf.gz', // Vô sinh do tinh trùng bất động
  'MLH1_MSH2_MSH6_PMS2_50k.vcf.gz', // Ung thư đại trực tràng
];

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

  private getIndexBasedOnFastQSuffix(fastQUrl: string) {
    try {
      const fastQSuffix = fastQUrl
        .split('/')
        ?.pop()
        ?.split('_')
        .pop()
        ?.split('.')[0];
      if (!fastQSuffix) {
        return 0;
      }
      switch (fastQSuffix) {
        case 'A':
          return 0;
        case 'B':
          return 1;
        case 'C':
          return 2;
        case 'D':
          return 3;
        default:
          return 0;
      }
    } catch (error) {
      return 0;
    }
  }

  async startAnalyze(body: MockEtlReqDto) {
    this.logger.log('startAnalyze', body);
    let tempFilePath: string | null = null;

    try {
      // 1. Download VCF file from S3 to local temp folder
      // If VCF_PATH is a prefix (e.g., s3://etl-results), list objects and pick a random .vcf/.vcf.gz
      let selectedS3Url = this.vcfPath;
      if (
        this.vcfPath.startsWith('s3://') &&
        (this.vcfPath.split('/').length <= 4 || this.vcfPath.endsWith('/'))
      ) {
        const index = this.getIndexBasedOnFastQSuffix(body.fastq_1_url);
        selectedS3Url = `${this.vcfPath}/${VCF_FILES[index]}`;
        this.logger.log(`Selected random VCF: ${selectedS3Url}`);
      }

      this.logger.log(
        `Starting analysis for ${body.analysis_id}, downloading VCF from: ${selectedS3Url}`,
      );

      const tempDir = path.join(process.cwd(), 'temp');
      const downloadResult = await this.s3Service.downloadFileToLocal(
        selectedS3Url,
        tempDir,
        `${body.analysis_id}_${body.patient_id}_${body.sample_name}_${Date.now()}.vcf.gz`,
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
