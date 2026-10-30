export interface CheckoutIntent {actorId:string;productId:string;paymentMethod:'card'|'transfer'|'wallet';discountCode:string}
export interface AttemptStorage {getItem(key:string):string|null;setItem(key:string,value:string):void}
export function normalizeCheckoutIntent(intent:CheckoutIntent):CheckoutIntent{return {actorId:intent.actorId.trim(),productId:intent.productId.trim(),paymentMethod:intent.paymentMethod,discountCode:intent.discountCode.trim().toUpperCase()}}
function intentName(value:CheckoutIntent){const i=normalizeCheckoutIntent(value);return `almeaa-checkout-intent-v1:${JSON.stringify([i.actorId,i.productId,i.paymentMethod,i.discountCode])}`}
export function createCheckoutAttempts(storage:AttemptStorage,createKey:()=>string){
 const memory=new Map<string,string>();
 function save(name:string,key:string){memory.set(name,key);try{storage.setItem(name,key)}catch{/* Session storage may be disabled; keep uncertain retries stable in memory. */}return key}
 function get(intent:CheckoutIntent){const name=intentName(intent);const cached=memory.get(name);if(cached)return cached;try{const persisted=storage.getItem(name);if(persisted){memory.set(name,persisted);return persisted}}catch{/* Use the session fallback. */}return save(name,createKey())}
 return {get,beginNew(intent:CheckoutIntent){return save(intentName(intent),createKey())}};
}
// All non-pending outcomes are prior, completed attempts, never a newly-created
// pending purchase. Only an explicit buyer action can rotate their retry key.
export function isTerminalCheckoutStatus(status:string){return status!=='pending'}
export const checkoutAttempts=createCheckoutAttempts({getItem:key=>sessionStorage.getItem(key),setItem:(key,value)=>sessionStorage.setItem(key,value)},()=>crypto.randomUUID());
