import {useSyncExternalStore} from 'react';
import {addCartItem,removeCartItem,readCartItems,CART_KEY,type CartItem} from './cart-model';
function initialItems():CartItem[]{try{return typeof window==='undefined'?[]:readCartItems(localStorage.getItem(CART_KEY))}catch{return []}}
let items:CartItem[]=initialItems();const listeners=new Set<()=>void>();
function changed(next:CartItem[]){items=next;try{localStorage.setItem(CART_KEY,JSON.stringify({items}))}catch{/* Current session remains usable when storage is unavailable. */}listeners.forEach(fn=>fn())}
if(typeof window!=='undefined')window.addEventListener('storage',e=>{if(e.key===CART_KEY){items=readCartItems(e.newValue);listeners.forEach(fn=>fn())}});
const subscribe=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn)}};
const addToCart=(item:CartItem)=>changed(addCartItem(items,item));const removeFromCart=(id:string,type?:CartItem['type'])=>changed(removeCartItem(items,id,type));const clearCart=()=>changed([]);
export function useHeaderCart(){const cartItems=useSyncExternalStore(subscribe,()=>items,()=>items);return {cartItems,count:cartItems.length,cartCount:()=>cartItems.length,addToCart,removeFromCart,clearCart}}
