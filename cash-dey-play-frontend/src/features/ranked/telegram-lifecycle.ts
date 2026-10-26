// Use Telegram's actual browser API; the SDK package's CommonJS default wrapper varies by bundler.
export interface TelegramLifecycle {
 isVersionAtLeast?:(version:string)=>boolean;isClosingConfirmationEnabled?:boolean;isVerticalSwipesEnabled?:boolean;
 enableClosingConfirmation?:()=>void;disableClosingConfirmation?:()=>void;enableVerticalSwipes?:()=>void;disableVerticalSwipes?:()=>void;
 onEvent?:(event:'activated',callback:()=>void)=>void;offEvent?:(event:'activated',callback:()=>void)=>void;
}
export function telegramApp():TelegramLifecycle|undefined{return typeof window==='undefined'?undefined:(window as unknown as {Telegram?:{WebApp?:TelegramLifecycle}}).Telegram?.WebApp;}
function supports(app:TelegramLifecycle|undefined,version:string):boolean{try{return typeof app?.isVersionAtLeast==='function'&&app.isVersionAtLeast(version);}catch{return false;}}
export function bindTelegramActivation(app:TelegramLifecycle|undefined,foreground:()=>void):()=>void{
 if(!supports(app,'8.0')||typeof app?.onEvent!=='function'||typeof app.offEvent!=='function')return ()=>{};
 app.onEvent('activated',foreground);return ()=>app.offEvent!('activated',foreground);
}
export function bindTelegramGameplay(app:TelegramLifecycle|undefined,live:boolean,inMatch:boolean):()=>void{
 const closing=live&&supports(app,'6.2')&&typeof app?.enableClosingConfirmation==='function'&&typeof app.disableClosingConfirmation==='function'&&!app.isClosingConfirmationEnabled;
 const swipes=inMatch&&supports(app,'7.7')&&typeof app?.disableVerticalSwipes==='function'&&typeof app.enableVerticalSwipes==='function'&&app.isVerticalSwipesEnabled===true;
 if(closing)app!.enableClosingConfirmation!();if(swipes)app!.disableVerticalSwipes!();
 return ()=>{if(closing)app!.disableClosingConfirmation!();if(swipes)app!.enableVerticalSwipes!();};
}
