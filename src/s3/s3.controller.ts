import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { S3Service } from './s3.service';
import {
  DownloadFileDto,
  DownloadFileResponse,
  DownloadFileToLocalDto,
  DownloadFileToLocalResponse,
} from './dto/download-file.dto';

@Controller('files')
export class S3Controller {
  private readonly logger = new Logger(S3Controller.name);

  constructor(private readonly s3Service: S3Service) {}

  @Post('download')
  @HttpCode(HttpStatus.OK)
  async generateDownloadUrl(
    @Body() downloadFileDto: DownloadFileDto,
  ): Promise<DownloadFileResponse> {
    this.logger.log(`Download request for URL: ${downloadFileDto.s3Url}`);

    const { s3Url, expiresIn = 3600 } = downloadFileDto;

    // Generate presigned URL
    const downloadUrl = await this.s3Service.generatePresignedDownloadUrl(
      s3Url,
      expiresIn,
    );

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    this.logger.log(
      `Download URL generated successfully, expires at: ${expiresAt}`,
    );

    return {
      downloadUrl,
      expiresIn,
      expiresAt,
    };
  }

  @Post('check')
  @HttpCode(HttpStatus.OK)
  async checkFileExists(
    @Body() { s3Url }: { s3Url: string },
  ): Promise<{ exists: boolean }> {
    this.logger.log(`Checking file existence for URL: ${s3Url}`);

    const exists = await this.s3Service.fileExists(s3Url);

    this.logger.log(`File existence check result: ${exists}`);

    return { exists };
  }

  @Post('download-to-local')
  @HttpCode(HttpStatus.OK)
  async downloadFileToLocal(
    @Body() downloadFileToLocalDto: DownloadFileToLocalDto,
  ): Promise<DownloadFileToLocalResponse> {
    this.logger.log(
      `Local download request for URL: ${downloadFileToLocalDto.s3Url} to folder: ${downloadFileToLocalDto.localFolderPath}`,
    );

    const { s3Url, localFolderPath, filename } = downloadFileToLocalDto;

    const result = await this.s3Service.downloadFileToLocal(
      s3Url,
      localFolderPath,
      filename,
    );

    this.logger.log(
      `Local download completed: ${result.message}, path: ${result.filePath}`,
    );

    return result;
  }
}
