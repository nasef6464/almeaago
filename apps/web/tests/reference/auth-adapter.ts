import {useAuth as useTargetAuth} from '../../src/features/auth/state/AuthProvider';
export function useAuth(){const auth=useTargetAuth();return {...auth,logout:auth.signOut};}
