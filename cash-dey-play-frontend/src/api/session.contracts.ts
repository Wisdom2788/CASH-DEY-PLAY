import { z } from 'zod';

export const userProfileSchema = z.object({
  id:z.string().regex(/^tg_[1-9]\d*$/),telegramId:z.number().int().positive().safe(),
  username:z.string().nullable(),firstName:z.string(),avatarUrl:z.string().nullable(),
  isPhoneVerified:z.boolean(),isPremium:z.boolean(),xp:z.number().int(),points:z.number().int(),
  monthlyRank:z.number().int().nullable(),monthlyTrend:z.number().nullable(),matchesWonMonth:z.number().int().nonnegative(),
  matchesPlayedMonth:z.number().int().nonnegative(),referralCode:z.string().nullable(),activeTaskDaysCount:z.number().int().nonnegative(),
}).refine(user=>user.id === `tg_${user.telegramId}`,'Identity mismatch');
export const loginResponseSchema=z.object({token:z.string().min(1),user:userProfileSchema});
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const serverStreakSchema=z.object({windowStartDate:date,lastLoginDate:date,consecutiveLoginDaysCount:z.number().int().positive(),graceDaysUsed:z.number().int().min(0).max(1),hasClaimedBonus:z.boolean()});
export const recordedLoginSchema=z.object({state:serverStreakSchema,wasReset:z.boolean(),graceDayConsumedToday:z.boolean(),qualifiesForBonus:z.boolean()});
export const capabilitiesSchema=z.object({version:z.literal(1),features:z.object({realtime:z.boolean(),verifiedAds:z.boolean(),premiumPayments:z.boolean(),airtimeRedemption:z.boolean(),streakRewards:z.boolean()})});

/** Presentation adapter only. No milestone award or eligibility calculation occurs here. */
export function presentStreak(state:z.infer<typeof serverStreakSchema>) {
  return {windowStartDate:state.windowStartDate,lastLoginDate:state.lastLoginDate,currentStreakDays:state.consecutiveLoginDaysCount,
    hasUsedGraceDay:state.graceDaysUsed>0,graceDayDate:null,claimedMilestones:state.hasClaimedBonus?[30]:[],
    totalWindowDays:30,isWindowCompleted:state.hasClaimedBonus,history:[] as string[]};
}
