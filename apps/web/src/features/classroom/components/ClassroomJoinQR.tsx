import{QRCodeSVG}from'qrcode.react';

export function ClassroomJoinQR({pin,size=160}:{pin:string;size?:number}){
 const value=typeof window==='undefined'?'/classroom/join?pin='+encodeURIComponent(pin):window.location.origin+'/classroom/join?pin='+encodeURIComponent(pin);
 return <div data-testid="classroom-join-qr" className="inline-flex flex-col items-center gap-2 rounded-2xl bg-white p-3 text-slate-950 shadow-sm">
  <QRCodeSVG value={value} size={size} level="M" marginSize={1}/>
  <span className="text-[10px] font-black text-slate-500">امسح للانضمام الآمن</span>
 </div>;
}
