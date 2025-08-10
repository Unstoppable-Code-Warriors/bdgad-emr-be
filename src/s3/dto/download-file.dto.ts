import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class DownloadFileDto {
  @IsString()
  @IsNotEmpty()
  s3Url: string;

  @IsOptional()
  @IsNumber()
  @Min(60) // Minimum 1 minute
  @Max(86400) // Maximum 24 hours
  @Transform(({ value }) => parseInt(value))
  expiresIn?: number = 3600; // Default 1 hour
}

export interface DownloadFileResponse {
  downloadUrl: string;
  expiresIn: number;
  expiresAt: string;
}
