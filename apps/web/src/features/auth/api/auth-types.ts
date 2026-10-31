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

export interface SchoolContextEntry {
  schoolId: string;
  role: UserRole;
  permissions: string[];
}

export interface AdminUser {
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
  points?: number;
  badges?: string[];
  isActive: boolean;
  schoolId?: string;
  groupIds?: string[];
  linkedStudentIds?: string[];
  managedPathIds?: string[];
  managedSubjectIds?: string[];
  schoolContexts?: SchoolContextEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminUsersSummary {
  total: number;
  inactive: number;
  byRole: Record<string, number>;
  platformTrainers: number;
}

export interface AdminUsersPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminUsersPage {
  users: AdminUser[];
  pagination: AdminUsersPagination;
}
