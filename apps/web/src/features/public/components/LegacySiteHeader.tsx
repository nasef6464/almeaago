import {Header} from '../header/OriginalHeader';
type AuthMode='login'|'signup';
export function LegacySiteHeader({requestedAuthMode,onAuthIntentConsumed}:{onAuth?:(mode:AuthMode)=>void;requestedAuthMode?:AuthMode|null;onAuthIntentConsumed?:()=>void}){
  return <Header requestedAuthMode={requestedAuthMode} onAuthIntentConsumed={onAuthIntentConsumed}/>;
}
