import { HttpService } from '@nestjs/axios/dist/http.service';
import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AxiosResponse } from 'axios';
import { Observable, from, of } from 'rxjs';
import { switchMap, tap, catchError } from 'rxjs/operators';
import { Cache } from 'cache-manager';
import { ReqUserDto } from './dtos/req-user.dto';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE || 'https://auth.bdgad.bio';

// curl --request GET \
//   --url https://auth.bdgad.bio/api/v1/auth/verify/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3IiwiZW1haWwiOiJxdXlkeC53b3JrQGdtYWlsLmNvbSIsIm5hbWUiOiJEYW8gWHVhbiBRdXkiLCJyb2xlcyI6W3siaWQiOjIsIm5hbWUiOiJMYWIgVGVzdGluZyBUZWNobmljaWFuIiwiY29kZSI6IjIifV0sImlhdCI6MTc1NDI3MzEzNywiZXhwIjoxNzU0ODc3OTM3fQ.mqljSi171qsejTW4uvPyFdREADMLgEmRMhl_XpoLq4E

// response (200):
// {
//   "valid": true,
//   "user": {
//     "id": 7,
//     "email": "quydx.work@gmail.com",
//     "name": "Dao Xuan Quy",
//     "roles": [
//       {
//         "id": 2,
//         "name": "Lab Testing Technician",
//         "code": "2"
//       }
//     ]
//   }
// }

// invalid token response (200):
// {
//   "status": 401,
//   "code": "INVALID_TOKEN",
//   "message": "Invalid token"
// }

@Injectable()
export class AuthService {
  constructor(
    private readonly httpService: HttpService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  verifyToken(token: string): Observable<AxiosResponse<ReqUserDto>> {
    const cacheKey = `auth_token_${token}`;

    return from(this.cacheManager.get<ReqUserDto>(cacheKey)).pipe(
      switchMap((cachedResult) => {
        if (cachedResult) {
          // Return cached result wrapped in AxiosResponse-like structure
          return of({
            data: cachedResult,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {
              headers: {},
            },
          } as unknown as AxiosResponse<ReqUserDto>);
        }

        // Make HTTP request if not cached
        const url = `${AUTH_SERVICE_URL}/api/v1/auth/verify/${token}`;
        return this.httpService
          .get<ReqUserDto>(url, {
            headers: {
              'Content-Type': 'application/json',
            },
          })
          .pipe(
            tap((response) => {
              // Cache successful responses for 5 minutes (300 seconds)
              if (
                response.data &&
                'valid' in response.data &&
                response.data.valid
              ) {
                void this.cacheManager.set(cacheKey, response.data, 300000); // 5 minutes in milliseconds
              }
            }),
            catchError((error) => {
              // Don't cache errors, just propagate them
              throw error;
            }),
          );
      }),
    );
  }

  async clearTokenCache(token: string): Promise<void> {
    const cacheKey = `auth_token_${token}`;
    await this.cacheManager.del(cacheKey);
  }

  clearAllAuthCache(): void {
    // Note: cache-manager doesn't have a reset method in v7
    // For production, implement a more sophisticated cache invalidation strategy
    // You could maintain a set of cache keys or use cache tags
    console.warn(
      'clearAllAuthCache: Individual key deletion required for cache-manager v7',
    );
  }

  async isTokenCached(token: string): Promise<boolean> {
    const cacheKey = `auth_token_${token}`;
    const cachedResult = await this.cacheManager.get(cacheKey);
    return cachedResult !== undefined;
  }

  async getCachedTokenData(token: string): Promise<ReqUserDto | undefined> {
    const cacheKey = `auth_token_${token}`;
    return await this.cacheManager.get<ReqUserDto>(cacheKey);
  }
}
