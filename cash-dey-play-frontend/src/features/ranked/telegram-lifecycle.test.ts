import { describe,it,expect,vi } from 'vitest';
import { bindTelegramActivation,bindTelegramGameplay } from './telegram-lifecycle';
describe('Telegram version and method compatibility',()=>{
 it('degrades safely with no Telegram API, an old version or incomplete SDK methods',()=>{
  for(const app of [undefined,{}, {isVersionAtLeast:()=>false}, {isVersionAtLeast:()=>true},{isVersionAtLeast:()=>{throw new Error('old SDK');}}]){
   expect(()=>{bindTelegramActivation(app,()=>{})();bindTelegramGameplay(app,true,true)();}).not.toThrow();
  }
 });
 it('enables and restores only the gameplay controls it changed',()=>{
  const app={isVersionAtLeast:()=>true,isClosingConfirmationEnabled:false,isVerticalSwipesEnabled:true,enableClosingConfirmation:vi.fn(),disableClosingConfirmation:vi.fn(),disableVerticalSwipes:vi.fn(),enableVerticalSwipes:vi.fn()};
  const cleanup=bindTelegramGameplay(app,true,true);expect(app.enableClosingConfirmation).toHaveBeenCalledOnce();expect(app.disableVerticalSwipes).toHaveBeenCalledOnce();cleanup();expect(app.disableClosingConfirmation).toHaveBeenCalledOnce();expect(app.enableVerticalSwipes).toHaveBeenCalledOnce();
  app.isClosingConfirmationEnabled=true;app.isVerticalSwipesEnabled=false;bindTelegramGameplay(app,true,true)();expect(app.disableClosingConfirmation).toHaveBeenCalledOnce();expect(app.enableVerticalSwipes).toHaveBeenCalledOnce();
 });
 it('unsubscribes the same foreground callback on cleanup',()=>{
  const onEvent=vi.fn(),offEvent=vi.fn(),foreground=vi.fn();const cleanup=bindTelegramActivation({isVersionAtLeast:()=>true,onEvent,offEvent},foreground);expect(onEvent).toHaveBeenCalledWith('activated',foreground);cleanup();expect(offEvent).toHaveBeenCalledWith('activated',foreground);
 });
});
