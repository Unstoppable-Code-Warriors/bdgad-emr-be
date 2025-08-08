import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AuthService } from './auth.service';
import { ReqUserDto } from './dtos/req-user.dto';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { Cache } from 'cache-manager';

describe('AuthService', () => {
  let service: AuthService;
  let httpService: jest.Mocked<HttpService>;
  let cacheManager: jest.Mocked<Cache>;

  const mockValidTokenResponse: AxiosResponse<ReqUserDto> = {
    data: {
      valid: true,
      user: {
        id: 7,
        email: 'test@example.com',
        name: 'Test User',
        roles: [
          {
            id: 2,
            name: 'Lab Testing Technician',
            code: '2',
          },
        ],
      },
    },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {
      headers: {} as any,
    },
  };

  const mockInvalidTokenResponse = {
    status: 401,
    code: 'INVALID_TOKEN',
    message: 'Invalid token',
  };

  beforeEach(async () => {
    const mockHttpService = {
      get: jest.fn(),
    };

    const mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    httpService = module.get(HttpService);
    cacheManager = module.get(CACHE_MANAGER);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('verifyToken', () => {
    const testToken = 'test-token-123';
    const cacheKey = `auth_token_${testToken}`;

    it('should return cached result when available', (done) => {
      const cachedData = mockValidTokenResponse.data;
      cacheManager.get.mockResolvedValue(cachedData);

      service.verifyToken(testToken).subscribe((result) => {
        expect(result.data).toEqual(cachedData);
        expect(result.status).toBe(200);
        expect(cacheManager.get).toHaveBeenCalledWith(cacheKey);
        expect(httpService.get).not.toHaveBeenCalled();
        done();
      });
    });

    it('should make HTTP request when not cached', (done) => {
      cacheManager.get.mockResolvedValue(undefined);
      httpService.get.mockReturnValue(of(mockValidTokenResponse));

      service.verifyToken(testToken).subscribe((result) => {
        expect(result).toEqual(mockValidTokenResponse);
        expect(cacheManager.get).toHaveBeenCalledWith(cacheKey);
        expect(httpService.get).toHaveBeenCalledWith(
          `https://auth.bdgad.bio/api/v1/auth/verify/${testToken}`,
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
        expect(cacheManager.set).toHaveBeenCalledWith(
          cacheKey,
          mockValidTokenResponse.data,
          300000,
        );
        done();
      });
    });

    it('should not cache invalid token responses', (done) => {
      cacheManager.get.mockResolvedValue(undefined);
      const invalidResponse = {
        ...mockValidTokenResponse,
        data: { ...mockInvalidTokenResponse, valid: false },
      };
      httpService.get.mockReturnValue(of(invalidResponse));

      service.verifyToken(testToken).subscribe((result) => {
        expect(result).toEqual(invalidResponse);
        expect(cacheManager.set).not.toHaveBeenCalled();
        done();
      });
    });

    it('should propagate HTTP errors', (done) => {
      cacheManager.get.mockResolvedValue(undefined);
      const error = new Error('Network error');
      httpService.get.mockReturnValue(throwError(() => error));

      service.verifyToken(testToken).subscribe({
        error: (err) => {
          expect(err).toBe(error);
          expect(cacheManager.set).not.toHaveBeenCalled();
          done();
        },
      });
    });

    it('should use correct AUTH_SERVICE_URL from environment', (done) => {
      const originalEnv = process.env.AUTH_SERVICE;
      process.env.AUTH_SERVICE = 'https://custom-auth.example.com';

      cacheManager.get.mockResolvedValue(undefined);
      httpService.get.mockReturnValue(of(mockValidTokenResponse));

      service.verifyToken(testToken).subscribe(() => {
        expect(httpService.get).toHaveBeenCalledWith(
          `https://custom-auth.example.com/api/v1/auth/verify/${testToken}`,
          expect.any(Object),
        );
        process.env.AUTH_SERVICE = originalEnv;
        done();
      });
    });
  });

  describe('clearTokenCache', () => {
    it('should clear cache for specific token', async () => {
      const testToken = 'test-token-123';
      const cacheKey = `auth_token_${testToken}`;

      await service.clearTokenCache(testToken);

      expect(cacheManager.del).toHaveBeenCalledWith(cacheKey);
    });

    it('should handle cache deletion errors gracefully', async () => {
      const testToken = 'test-token-123';
      cacheManager.del.mockRejectedValue(new Error('Cache error'));

      await expect(service.clearTokenCache(testToken)).rejects.toThrow(
        'Cache error',
      );
    });
  });

  describe('clearAllAuthCache', () => {
    it('should log warning about individual key deletion requirement', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      service.clearAllAuthCache();

      expect(consoleSpy).toHaveBeenCalledWith(
        'clearAllAuthCache: Individual key deletion required for cache-manager v7',
      );

      consoleSpy.mockRestore();
    });
  });

  describe('isTokenCached', () => {
    it('should return true when token is cached', async () => {
      const testToken = 'test-token-123';
      const cacheKey = `auth_token_${testToken}`;
      cacheManager.get.mockResolvedValue(mockValidTokenResponse.data);

      const result = await service.isTokenCached(testToken);

      expect(result).toBe(true);
      expect(cacheManager.get).toHaveBeenCalledWith(cacheKey);
    });

    it('should return false when token is not cached', async () => {
      const testToken = 'test-token-123';
      const cacheKey = `auth_token_${testToken}`;
      cacheManager.get.mockResolvedValue(undefined);

      const result = await service.isTokenCached(testToken);

      expect(result).toBe(false);
      expect(cacheManager.get).toHaveBeenCalledWith(cacheKey);
    });

    it('should return false when cache returns null', async () => {
      const testToken = 'test-token-123';
      cacheManager.get.mockResolvedValue(null);

      const result = await service.isTokenCached(testToken);

      expect(result).toBe(false);
    });
  });

  describe('getCachedTokenData', () => {
    it('should return cached token data when available', async () => {
      const testToken = 'test-token-123';
      const cacheKey = `auth_token_${testToken}`;
      const cachedData = mockValidTokenResponse.data;
      cacheManager.get.mockResolvedValue(cachedData);

      const result = await service.getCachedTokenData(testToken);

      expect(result).toEqual(cachedData);
      expect(cacheManager.get).toHaveBeenCalledWith(cacheKey);
    });

    it('should return undefined when token is not cached', async () => {
      const testToken = 'test-token-123';
      const cacheKey = `auth_token_${testToken}`;
      cacheManager.get.mockResolvedValue(undefined);

      const result = await service.getCachedTokenData(testToken);

      expect(result).toBeUndefined();
      expect(cacheManager.get).toHaveBeenCalledWith(cacheKey);
    });

    it('should handle cache errors gracefully', async () => {
      const testToken = 'test-token-123';
      cacheManager.get.mockRejectedValue(new Error('Cache error'));

      await expect(service.getCachedTokenData(testToken)).rejects.toThrow(
        'Cache error',
      );
    });
  });
});
