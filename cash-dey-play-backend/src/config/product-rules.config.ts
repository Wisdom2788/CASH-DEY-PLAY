import { z } from "zod";

export const productRulesSchema = z.object({
  version:z.literal(1), timeZone:z.literal("Africa/Lagos"),
  features:z.object({realtime:z.boolean(),verifiedAds:z.boolean(),premiumPayments:z.boolean(),airtimeRedemption:z.boolean(),streakRewards:z.boolean()}),
  tasks:z.object({pointsPerTask:z.literal(50),dailyTaskCount:z.literal(4),taskDayRequiresAllTasks:z.literal(true)}),
  practice:z.object({regularDailyStartLimit:z.literal(5),qualificationMatchTarget:z.literal(25)}),
  ranked:z.object({dailyLimit:z.literal(3),cooldownAfterMatchNumber:z.literal(2),cooldownMinutes:z.literal(60),premiumHasCooldown:z.literal(false)}),
  streak:z.object({regular:z.array(z.object({day:z.number().int(),airtimeNgn:z.number().int().nonnegative(),adFreeDay:z.boolean()})),premium:z.array(z.object({day:z.number().int(),airtimeNgn:z.number().int().nonnegative()}))}),
  leaderboard:z.object({requiredTaskDays:z.literal(20),requiredRankedWins:z.literal(15),regularRequiresPracticeMatches:z.literal(25)}),
  referral:z.object({pointsEach:z.literal(150),qualificationTaskDays:z.literal(3),qualificationWindowDays:z.literal(30)}),
  premium:z.object({plans:z.array(z.object({id:z.string(),days:z.number().int().positive(),stars:z.number().int().positive(),priceNgn:z.number().int().positive()}))}),
  wallet:z.object({minRedemptionNgn:z.literal(50),maxRedemptionNgnPerTransaction:z.literal(100000),maxRedemptionNgnPerDay:z.literal(100000)}),
});
// These are specified product rules, not an assertion that every feature is implemented.
export const PRODUCT_RULES=productRulesSchema.parse({
  version:1,timeZone:"Africa/Lagos",
  features:{realtime:false,verifiedAds:false,premiumPayments:false,airtimeRedemption:false,streakRewards:false},
  tasks:{pointsPerTask:50,dailyTaskCount:4,taskDayRequiresAllTasks:true},
  practice:{regularDailyStartLimit:5,qualificationMatchTarget:25},
  ranked:{dailyLimit:3,cooldownAfterMatchNumber:2,cooldownMinutes:60,premiumHasCooldown:false},
  streak:{regular:[{day:14,airtimeNgn:50,adFreeDay:false},{day:20,airtimeNgn:0,adFreeDay:true},{day:30,airtimeNgn:100,adFreeDay:false}],premium:[{day:10,airtimeNgn:50},{day:20,airtimeNgn:100},{day:30,airtimeNgn:200}]},
  leaderboard:{requiredTaskDays:20,requiredRankedWins:15,regularRequiresPracticeMatches:25},
  referral:{pointsEach:150,qualificationTaskDays:3,qualificationWindowDays:30},
  premium:{plans:[{id:"PREMIUM_1M",days:30,stars:55,priceNgn:1000},{id:"PREMIUM_3M",days:90,stars:150,priceNgn:2700}]},
  wallet:{minRedemptionNgn:50,maxRedemptionNgnPerTransaction:100000,maxRedemptionNgnPerDay:100000},
});
