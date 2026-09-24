import type { AuthUser } from '../api/auth-types';

export function dashboardPathFor(user: AuthUser) {
  switch (user.role) {
    case 'admin':
      return '/admin-dashboard';
    case 'teacher':
      return '/school-teacher-dashboard';
    case 'supervisor':
      return '/supervisor-dashboard';
    case 'school_admin':
      return '/school-director-dashboard';
    case 'parent':
      return '/parent-dashboard';
    default:
      return '/dashboard';
  }
}
