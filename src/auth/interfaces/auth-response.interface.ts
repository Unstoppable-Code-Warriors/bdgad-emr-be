import { AuthUser } from './auth-user.interface';

export interface AuthServiceResponse {
  valid: boolean;
  user: AuthUser;
}

export interface AuthServiceErrorResponse {
  status: number;
  code: string;
  message: string;
}
