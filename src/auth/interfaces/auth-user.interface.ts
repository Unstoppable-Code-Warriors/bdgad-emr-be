export interface AuthUser {
  id: number;
  email: string;
  name: string;
  roles: Array<{
    id: number;
    name: string;
    code: string;
  }>;
}
