// The key contains no bank details. Scope it to both the signed-in user and product.
const memory = new Map<string,string>();
function name(userId:string,productId:string){return `commerce-pending-v1:${JSON.stringify([userId,productId])}`}
export function readCheckoutRecovery(userId:string,productId:string):string {
 const key=name(userId,productId); if(memory.has(key))return memory.get(key)||'';
 try {const value=sessionStorage.getItem(key)||''; if(value)memory.set(key,value);return value} catch{return ''}
}
export function rememberCheckoutRecovery(userId:string,productId:string,key:string):void {
 const item=name(userId,productId); memory.set(item,key); try{sessionStorage.setItem(item,key)}catch{/* keep the in-memory retry key */}
}
export function clearCheckoutRecovery(userId:string,productId:string):void {
 const item=name(userId,productId);memory.delete(item);try{sessionStorage.removeItem(item)}catch{/* no persisted key */}
}
