import { StateStorage } from 'zustand/middleware';
import Cookies from 'js-cookie';

export const getCookiesStorageDefinitions = (): StateStorage => {
  return {
    getItem: (name: string): string | null => {
      return Cookies.get(name) || null;
    },
    setItem: (name: string, value: string): void => {
      // 7 days expiration for persisted state
      Cookies.set(name, value, { expires: 7, secure: true, sameSite: 'strict' });
    },
    removeItem: (name: string): void => {
      Cookies.remove(name);
    },
  };
};
