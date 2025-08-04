import { HttpService } from '@nestjs/axios/dist/http.service';
import { Injectable } from '@nestjs/common';
import { AxiosResponse } from 'axios';
import { Observable } from 'rxjs';
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
  constructor(private readonly httpService: HttpService) {}

  verifyToken(token: string): Observable<AxiosResponse<ReqUserDto>> {
    const url = `${AUTH_SERVICE_URL}/api/v1/auth/verify/${token}`;
    return this.httpService.get<ReqUserDto>(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
