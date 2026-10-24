import { create } from 'zustand';
import Cookies from 'js-cookie';
import { type UserProfile } from '../types/interfaces/user.types';
import { type LoginStreakState } from '../qualification/login-streak/login-streak-engine';

interface AuthStoreState {
  user:UserProfile|null;loginStreak:LoginStreakState|null;isAuthenticated:boolean;token:string|null;
  setAuthData:(user:UserProfile,token:string)=>void;
  clearAuth:()=>void;
  syncStreakState:(streak:LoginStreakState)=>void;
}
// Previous versions persisted JWTs and derived player state. Remove that cookie; do not restore it.
Cookies.remove('cdp-auth-storage',{path:'/'});
export const useAuthStore=create<AuthStoreState>(set=>({
  user:null,loginStreak:null,isAuthenticated:false,token:null,
  setAuthData:(user,token)=>set({user,token,isAuthenticated:true}),
  clearAuth:()=>set({user:null,loginStreak:null,isAuthenticated:false,token:null}),
  syncStreakState:loginStreak=>set({loginStreak}),
}));
