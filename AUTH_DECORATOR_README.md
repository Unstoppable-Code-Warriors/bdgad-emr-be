# Authentication Custom Decorator

This project implements a custom `@User()` decorator that automatically extracts the JWT token from the Authorization header, verifies it with an external auth service, and injects the user data into your controller methods.

## How it works

1. **AuthGuard**: Intercepts requests and validates JWT tokens
2. **@User() Decorator**: Extracts authenticated user data and injects it into controller methods
3. **External Auth Service**: Validates tokens via HTTP API call

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

The auth service URL is configured via environment variable:

```env
AUTH_SERVICE=https://auth.bdgad.bio
```

If not set, it defaults to `https://auth.bdgad.bio`.

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
- `src/auth/dtos/req-user.dto.ts` - Updated to use centralized types
- `src/auth/auth.module.ts` - Updated to export guard
- `src/auth/index.ts` - Barrel export file with all types
- `src/patient/patient.controller.ts` - Example usage
