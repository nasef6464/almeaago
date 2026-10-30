// Raw source phone/OTP API aliases only. Source presentation/auth flow is retained.
import {authClient} from '../../src/features/auth/api/auth-client';
export {isStagingEnv} from '../../src/features/public/header/headerApi';
export const api={
  post(path:string,body:{phone:string;password:string}){
    if(path!=='/auth/login/phone-password')throw Error('Unsupported source header API alias: '+path);
    return authClient.loginPhone(body.phone,body.password);
  },
  whatsappStartLogin:(phone:string)=>authClient.startWhatsAppOTP(phone),
  whatsappVerifyLogin:(phone:string,code:string)=>authClient.verifyWhatsAppOTP(phone,code),
};

// Widen source presentation-only optional fields without cloning a legacy store.
import {useStore as useGoStore} from '../../src/features/public/header/headerStore';
export function useStore(){
 const store=useGoStore();
 return {...store,subjects:store.subjects as Array<(typeof store.subjects)[number]&{icon?:string;color?:string}>};
}
