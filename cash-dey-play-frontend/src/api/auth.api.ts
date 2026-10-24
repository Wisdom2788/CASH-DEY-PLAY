import { API_ROUTES } from '../config/constant.config';
import client from '../config/client.config';
import { getService,postService } from './client';
import { capabilitiesSchema,loginResponseSchema,presentStreak,recordedLoginSchema,userProfileSchema } from './session.contracts';

export async function loginWithTelegram(initData:string) {
  return loginResponseSchema.parse(await postService(API_ROUTES.AUTH_LOGIN,{initData},{silent:true}));
}
export async function fetchCurrentUser() { return userProfileSchema.parse(await getService(API_ROUTES.USER_ME)); }
export async function recordServerLogin() {
  const response=await client.post(API_ROUTES.LOGIN_STREAK,{});
  // Transitional stage01 compatibility: old backend has top-level result, new backend wraps data.
  return presentStreak(recordedLoginSchema.parse(response.data.data ?? response.data).state);
}
export async function fetchCapabilities() { return capabilitiesSchema.parse((await client.get(API_ROUTES.PRODUCT_RULES)).data.data); }
