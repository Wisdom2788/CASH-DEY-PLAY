import { PRODUCT_RULES,productRulesSchema } from "./product-rules.config";
import { loadAppEnv } from "./env.config";
describe("versioned rule and infrastructure contracts",()=>{
 it("cannot advertise unimplemented economic or realtime capabilities",()=>{
   expect(Object.values(PRODUCT_RULES.features).every(value=>value===false)).toBe(true);
   expect(PRODUCT_RULES.streak.regular.map(value=>[value.day,value.airtimeNgn])).toEqual([[14,50],[20,0],[30,100]]);
   expect(PRODUCT_RULES.streak.premium.map(value=>[value.day,value.airtimeNgn])).toEqual([[10,50],[20,100],[30,200]]);
   expect(()=>productRulesSchema.parse({...PRODUCT_RULES,ranked:{...PRODUCT_RULES.ranked,dailyLimit:4}})).toThrow();
 });
 it.each(["NaN","0","-1","1.5"])("rejects invalid per-user limit %s",value=>{
   expect(()=>loadAppEnv({NODE_ENV:"test",USER_REQUESTS_PER_MINUTE:value})).toThrow(/USER_REQUESTS/);
 });
});
