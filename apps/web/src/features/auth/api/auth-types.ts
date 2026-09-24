export type UserRole =
  | 'student'
  | 'teacher'
  | 'admin'
  | 'supervisor'
  | 'school_admin'
  | 'parent';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  status: string;
  avatarUrl: string;
  nationalId?: string;
  phone?: string;
  emailVerified: boolean;
  role: UserRole;
  roles: UserRole[];
}

export interface AuthResult {
  user: AuthUser;
  csrfToken: string;
}

export interface MessageResult {
  message: string;
}
