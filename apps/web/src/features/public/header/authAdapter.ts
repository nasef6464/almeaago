import {useAuth as useGoAuth} from '../../auth/state/AuthProvider';
import type {AuthUser} from '../../auth/api/auth-types';
import {DEFAULT_AVATAR} from '../../presentation/defaultAvatar';

const legacyUser=(user:AuthUser)=>({...user,displayName:user.name,photoURL:user.avatarUrl||DEFAULT_AVATAR,
  schoolId:(user as AuthUser&{schoolId?:string}).schoolId,
  groupIds:(user as AuthUser&{groupIds?:string[]}).groupIds,
  managedPathIds:(user as AuthUser&{managedPathIds?:string[]}).managedPathIds,
  managedSubjectIds:(user as AuthUser&{managedSubjectIds?:string[]}).managedSubjectIds});
// Only map transport names. Existing Go auth/session/CSRF remains authoritative.
export function createHeaderAuthAdapter(auth:ReturnType<typeof useGoAuth>){
  return {user:auth.user?legacyUser(auth.user):null,
    signInWithEmail:async(email:string,password:string)=>legacyUser(await auth.signIn(email,password)),
    signInWithPhone:async(phone:string,password:string)=>legacyUser(await auth.signInPhone(phone,password)),
    startWhatsAppOTP:auth.startWhatsAppOTP,
    verifyWhatsAppOTP:async(phone:string,code:string)=>legacyUser(await auth.verifyWhatsAppOTP(phone,code)),
    signInWithNationalId:async(id:string,password:string)=>legacyUser(await auth.signInNationalId(id,password)),
    signUpWithEmail:async(email:string,password:string,name:string)=>legacyUser(await auth.signUp(name,email,password)),
    signInWithGoogle:async()=>{window.location.assign(auth.googleStartURL(headerAuthReturnPath(window.location)));},
    logout:auth.signOut};
}

export function useAuth(){return createHeaderAuthAdapter(useGoAuth());}

type HeaderLocation={pathname:string;search?:string;hash?:string};
export function safeHeaderReturnTo(value:string|null|undefined):string|null{
  if(!value||!value.startsWith('/')||value.startsWith('//')||/[\\\r\n\t]/.test(value))return null;
  return value;
}
function stripAuthHint(path:string):string{
  const url=new URL(path,'https://header.invalid');url.searchParams.delete('auth');
  return url.pathname+url.search+url.hash;
}
export function afterHeaderLoginPath(location:HeaderLocation,dashboardPath:string):string{
  const params=new URLSearchParams(location.search||'');
  const returnTo=safeHeaderReturnTo(params.get('returnTo'));
  if(returnTo)return stripAuthHint(returnTo);
  const explicitAuth=params.get('auth');
  if(location.pathname==='/login'||location.pathname==='/signup'||(explicitAuth!=='login'&&explicitAuth!=='signup'))return dashboardPath;
  params.delete('auth');params.delete('returnTo');
  const query=params.toString();return location.pathname+(query?'?'+query:'')+(location.hash||'');
}
// OAuth returns to the same in-place page, without reopening its auth modal.
export function headerAuthReturnPath(location:HeaderLocation):string{
  const params=new URLSearchParams(location.search||'');
  const explicit=safeHeaderReturnTo(params.get('returnTo'));
  if(explicit)return stripAuthHint(explicit);
  if(params.get('auth')==='login'||params.get('auth')==='signup')return stripAuthHint(location.pathname+(location.search||'')+(location.hash||''));
  return location.pathname==='/signup'?'/signup':'/login';
}
