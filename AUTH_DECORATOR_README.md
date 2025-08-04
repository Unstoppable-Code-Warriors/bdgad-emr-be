# Authentication Custom Decorator

This project implements a custom `@User()` decorator that automatically extracts the JWT token from the Authorization header, verifies it with an external auth service, and injects the user data into your controller methods.

## How it works

1. **AuthGuard**: Intercepts requests and validates JWT tokens
2. **@User() Decorator**: Extracts authenticated user data and injects it into controller methods
3. **External Auth Service**: Validates tokens via HTTP API call
4. **Caching System**: Caches valid token verification results to improve performance

## Caching Strategy

The authentication system implements an intelligent caching mechanism to reduce API calls to the external auth service:

- **Cache Key**: `auth_token_${token}` (unique per token)
- **TTL (Time To Live)**: 5 minutes (300 seconds)
- **Cache Size**: Maximum 1000 items
- **Cache Policy**: Only successful authentication responses are cached
- **Cache Storage**: In-memory using `@nestjs/cache-manager`

### Cache Benefits

- ✅ **Performance**: Reduces API latency for repeated requests with the same token
- ✅ **Reliability**: Reduces dependency on external auth service availability
- ✅ **Cost**: Reduces API calls to external service
- ✅ **User Experience**: Faster response times for authenticated requests

### Cache Invalidation

- **Automatic**: Cached tokens expire after 5 minutes
- **Manual**: Use `AuthService.clearTokenCache(token)` to invalidate specific tokens
- **Error Handling**: Failed auth requests are not cached

## Usage

### 1. Apply the AuthGuard to your controller or specific routes

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard, User, UserInfo } from '../auth';

@Controller('patients')
@UseGuards(AuthGuard) // Apply to entire controller
export class PatientController {
  @Get()
  getPatient(@User() user: UserInfo) {
    return {
      message: 'Patient data retrieved successfully',
      user: user,
    };
  }
}
```

### 2. Or apply to individual routes

```typescript
@Controller('patients')
export class PatientController {
  @Get()
  @UseGuards(AuthGuard) // Apply to specific route
  getPatient(@User() user: UserInfo) {
    return {
      message: 'Patient data retrieved successfully',
      user: user,
    };
  }
}
```

### 3. Request format

Send requests with the Authorization header:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3000/patients
```

### 4. User object structure

The `@User()` decorator provides a `UserInfo` object (which extends `AuthUser`) with the following structure:

```typescript
interface AuthUser {
  id: number;
  email: string;
  name: string;
  roles: Array<{
    id: number;
    name: string;
    code: string;
  }>;
}

interface UserInfo extends AuthUser {}
```

### 5. Centralized Type System

The auth system uses a centralized type structure:

- **`AuthUser`**: Core user data structure from the auth service
- **`UserInfo`**: Interface for user data in controllers (extends AuthUser)
- **`AuthServiceResponse`**: Success response from auth service
- **`AuthServiceErrorResponse`**: Error response from auth service
- **`ReqUserDto`**: Union type of success and error responses

```typescript
interface AuthServiceResponse {
  valid: boolean;
  user: AuthUser;
}

interface AuthServiceErrorResponse {
  status: number;
  code: string;
  message: string;
}

type ReqUserDto = AuthServiceResponse | AuthServiceErrorResponse;
```

## Configuration

### Auth Service URL

The auth service URL is configured via environment variable:

```env
AUTH_SERVICE=https://auth.bdgad.bio
```

If not set, it defaults to `https://auth.bdgad.bio`.

### Cache Configuration

The caching system can be configured in the `AuthModule`:

```typescript
CacheModule.register({
  ttl: 300000, // 5 minutes (in milliseconds)
  max: 1000, // Maximum number of items in cache
});
```

### Manual Cache Management

You can manually manage the cache through the `AuthService`:

```typescript
// Check if a token is cached
const isCached = await authService.isTokenCached(token);

// Get cached token data
const cachedData = await authService.getCachedTokenData(token);

// Clear specific token from cache
await authService.clearTokenCache(token);
```

## Error handling

The guard will throw `UnauthorizedException` in the following cases:

- No Authorization header provided
- Invalid token format
- Token verification fails
- External auth service returns invalid response

## Files created/modified

- `src/auth/guards/auth.guard.ts` - Authentication guard
- `src/auth/decorators/user.decorator.ts` - Custom @User() decorator
- `src/auth/interfaces/auth-user.interface.ts` - **Centralized user type from auth service**
- `src/auth/interfaces/user-info.interface.ts` - User data interface for controllers
- `src/auth/interfaces/auth-response.interface.ts` - Auth service response types
- `src/auth/config/auth-cache.config.ts` - **Cache configuration and types**
- `src/auth/dtos/req-user.dto.ts` - Updated to use centralized types
- `src/auth/auth.service.ts` - **Updated with caching functionality**
- `src/auth/auth.module.ts` - **Updated to include CacheModule**
- `src/auth/index.ts` - Barrel export file with all types
- `src/patient/patient.controller.ts` - Example usage
