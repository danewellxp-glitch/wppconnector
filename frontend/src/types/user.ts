export enum Role {
  ADMIN = 'ADMIN',
  AGENT = 'AGENT',
}

export interface Department {
  id: string;
  name: string;
  color?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  companyId: string;
  departmentId?: string | null;
  activeDepartmentIds?: string[];
  department?: Department | null;
  userDepartments?: { department: Department }[];
  isActive: boolean;
}

export interface AuthResponse {
  user: User;
  token: string;
}
