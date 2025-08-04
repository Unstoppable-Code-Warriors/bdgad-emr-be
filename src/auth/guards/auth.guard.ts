import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable, map, catchError, throwError } from 'rxjs';
import { AuthService } from '../auth.service';
import { AuthenticatedRequest } from '../decorators/user.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    return this.authService.verifyToken(token).pipe(
      map((response) => {
        const data = response.data;

        // Check if the response indicates an invalid token (error response)
        if ('status' in data) {
          throw new UnauthorizedException(data.message || 'Invalid token');
        }

        // Check if the token is valid (success response)
        if (!data.valid) {
          throw new UnauthorizedException('Token is not valid');
        }

        // Store user data in request object for later access
        request.user = data.user;
        return true;
      }),
      catchError((error) => {
        if (error instanceof UnauthorizedException) {
          return throwError(() => error);
        }
        return throwError(
          () => new UnauthorizedException('Token verification failed'),
        );
      }),
    );
  }

  private extractTokenFromHeader(
    request: AuthenticatedRequest,
  ): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
