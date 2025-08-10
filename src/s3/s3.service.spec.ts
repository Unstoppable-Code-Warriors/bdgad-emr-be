import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { S3Service } from './s3.service';
import { BadRequestException } from '@nestjs/common';

describe('S3Service', () => {
  let service: S3Service;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        S3Service,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case 'S3_ENDPOINT':
                  return 'https://test.r2.cloudflarestorage.com';
                case 'S3_ACCESS_KEY_ID':
                  return 'test-access-key';
                case 'S3_SECRET_ACCESS_KEY':
                  return 'test-secret-key';
                default:
                  return undefined;
              }
            }),
          },
        },
      ],
    }).compile();

    service = module.get<S3Service>(S3Service);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('parseS3Url', () => {
    it('should parse Cloudflare R2 URL correctly', () => {
      const s3Url =
        'https://d46919b3b31b61ac349836b18c9ac671.r2.cloudflarestorage.com/test-bucket/path/to/file.pdf';

      // Access private method via type assertion for testing
      const parseS3Url = (service as any).parseS3Url.bind(service);
      const result = parseS3Url(s3Url);

      expect(result).toEqual({
        bucket: 'test-bucket',
        key: 'path/to/file.pdf',
      });
    });

    it('should throw error for invalid URL', () => {
      const invalidUrl = 'not-a-valid-url';

      const parseS3Url = (service as any).parseS3Url.bind(service);

      expect(() => parseS3Url(invalidUrl)).toThrow(BadRequestException);
    });
  });
});
