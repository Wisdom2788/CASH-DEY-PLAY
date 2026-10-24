import { serverStreakSchema,presentStreak,userProfileSchema } from './session.contracts';
import { useAuthStore } from '../store/auth.store';

describe('server-owned session state',()=>{
  it('displays actual server progress without inventing login history or milestone awards',()=>{
    const state=serverStreakSchema.parse({windowStartDate:'2026-10-01',lastLoginDate:'2026-10-21',consecutiveLoginDaysCount:20,graceDaysUsed:1,hasClaimedBonus:false});
    expect(presentStreak(state)).toMatchObject({currentStreakDays:20,hasUsedGraceDay:true,claimedMilestones:[],history:[]});
    expect(()=>serverStreakSchema.parse({...state,consecutiveLoginDaysCount:-1})).toThrow();
  });
  it('rejects mismatched identity and accepts nullable real-profile fields',()=>{
    const user={id:'tg_123',telegramId:123,username:null,firstName:'Test',avatarUrl:null,isPhoneVerified:false,isPremium:false,xp:0,points:0,monthlyRank:null,monthlyTrend:null,matchesWonMonth:0,matchesPlayedMonth:0,referralCode:null,activeTaskDaysCount:0};
    expect(userProfileSchema.parse(user).monthlyRank).toBeNull();
    expect(()=>userProfileSchema.parse({...user,id:'tg_456'})).toThrow();
  });
  it('clears session and progress together without a persisted-state interface',()=>{
    useAuthStore.getState().syncStreakState(presentStreak({windowStartDate:'2026-10-01',lastLoginDate:'2026-10-10',consecutiveLoginDaysCount:10,graceDaysUsed:0,hasClaimedBonus:false}));
    useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState()).toMatchObject({token:null,user:null,loginStreak:null,isAuthenticated:false});
    expect('persist' in useAuthStore).toBe(false);
  });
});
