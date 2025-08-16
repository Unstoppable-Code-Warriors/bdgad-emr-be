import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'S3_SECRET_ACCESS_KEY',
    );

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error(
        'S3 configuration is missing. Please check S3_ENDPOINT, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY environment variables.',
      );
    }

    this.s3Client = new S3Client({
      region: 'auto', // Cloudflare R2 uses 'auto' region
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true, // Required for R2 compatibility
    });
  }

  /**
   * Parse S3 URL to extract bucket and key
   * Supports both path-style and virtual-hosted-style URLs
   */
  private parseS3Url(s3Url: string): { bucket: string; key: string } {
    try {
      const url = new URL(s3Url);

      // Check if it's a Cloudflare R2 URL pattern
      if (url.hostname.includes('cloudflarestorage.com')) {
        // For Cloudflare R2, the URL format is typically:
        // https://[account-id].r2.cloudflarestorage.com/[bucket]/[key]
        const pathParts = url.pathname
          .split('/')
          .filter((part) => part.length > 0);
        if (pathParts.length < 2) {
          throw new Error('Invalid R2 URL format');
        }

        const bucket = pathParts[0];
        const key = pathParts.slice(1).join('/');

        return { bucket, key };
      }

      // Standard S3 URL parsing
      // Path-style: https://s3.region.amazonaws.com/bucket/key
      // Virtual-hosted-style: https://bucket.s3.region.amazonaws.com/key
      if (url.hostname.startsWith('s3.') || url.hostname.includes('.s3.')) {
        // Path-style URL
        const pathParts = url.pathname
          .split('/')
          .filter((part) => part.length > 0);
        if (pathParts.length < 2) {
          throw new Error('Invalid S3 URL format');
        }

        const bucket = pathParts[0];
        const key = pathParts.slice(1).join('/');

        return { bucket, key };
      } else {
        // Virtual-hosted-style URL
        const bucket = url.hostname.split('.')[0];
        const key = url.pathname.substring(1); // Remove leading slash

        return { bucket, key };
      }
    } catch (error) {
      this.logger.error('Failed to parse S3 URL:', error);
      throw new BadRequestException('Invalid S3 URL format');
    }
  }

  /**
   * Generate a pre-signed URL for downloading a file from S3/R2
   */
  async generatePresignedDownloadUrl(
    s3Url: string,
    expiresIn: number = 3600, // Default 1 hour
  ): Promise<string> {
    try {
      const { bucket, key } = this.parseS3Url(s3Url);

      this.logger.log(
        `Generating presigned URL for bucket: ${bucket}, key: ${key}`,
      );

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const presignedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      this.logger.log('Presigned URL generated successfully');
      return presignedUrl;
    } catch (error) {
      this.logger.error('Failed to generate presigned URL:', error);
      throw new BadRequestException(
        `Failed to generate download URL: ${error.message}`,
      );
    }
  }

  /**
   * Check if a file exists in S3/R2
   */
  async fileExists(s3Url: string): Promise<boolean> {
    try {
      const { bucket, key } = this.parseS3Url(s3Url);

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      if (
        error.name === 'NoSuchKey' ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return false;
      }
      this.logger.error('Error checking file existence:', error);
      throw error;
    }
  }

  /**
   * Download a file from S3/R2 to a local folder
   * If the file already exists locally, skip the download
   */
  async downloadFileToLocal(
    s3Url: string,
    localFolderPath: string,
    filename?: string,
  ): Promise<{ filePath: string; downloaded: boolean; message: string }> {
    try {
      const { bucket, key } = this.parseS3Url(s3Url);

      // Use provided filename or extract from S3 key
      const finalFilename = filename || path.basename(key);

      // Ensure the local folder exists
      if (!fs.existsSync(localFolderPath)) {
        fs.mkdirSync(localFolderPath, { recursive: true });
        this.logger.log(`Created directory: ${localFolderPath}`);
      }

      const localFilePath = path.join(localFolderPath, finalFilename);

      // Check if file already exists locally
      if (fs.existsSync(localFilePath)) {
        this.logger.log(`File already exists: ${localFilePath}`);
        return {
          filePath: localFilePath,
          downloaded: false,
          message: 'File already exists locally, skipped download',
        };
      }

      this.logger.log(
        `Downloading file from S3 bucket: ${bucket}, key: ${key} to ${localFilePath}`,
      );

      // Download file from S3
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new Error('No file content received from S3');
      }

      // Convert the readable stream to buffer
      const chunks: Uint8Array[] = [];
      const reader = response.Body.transformToWebStream().getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const buffer = Buffer.concat(chunks);

      // Write file to local path
      fs.writeFileSync(localFilePath, buffer);

      this.logger.log(`File downloaded successfully to: ${localFilePath}`);

      return {
        filePath: localFilePath,
        downloaded: true,
        message: 'File downloaded successfully',
      };
    } catch (error) {
      this.logger.error('Failed to download file from S3:', error);
      throw new BadRequestException(
        `Failed to download file: ${error.message}`,
      );
    }
  }
}
