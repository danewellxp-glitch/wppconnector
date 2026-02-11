export enum Role {
  ADMIN = 'ADMIN',
  AGENT = 'AGENT',
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  companyId: string;
  isActive: boolean;
}

export interface AuthResponse {
  user: User;
  token: string;
}
