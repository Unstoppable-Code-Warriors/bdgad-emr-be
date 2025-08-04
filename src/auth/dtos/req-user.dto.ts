import {
  AuthServiceResponse,
  AuthServiceErrorResponse,
} from '../interfaces/auth-response.interface';

export type ReqUserDto = AuthServiceResponse | AuthServiceErrorResponse;
