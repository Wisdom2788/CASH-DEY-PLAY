import axios from "axios";
import { useAuthStore } from "../store/auth.store";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const client = axios.create({ baseURL: BASE_URL, timeout: 15000 });

client.interceptors.request.use((config) => {
  if (config?.headers) {
    config.headers.accept = "application/json";
    config.headers["Content-Type"] = "application/json";

    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.authorization = `Bearer ${token}`;
    }

    // For local development bypass outside of Telegram
    if (import.meta.env.DEV && import.meta.env.VITE_DEV_TELEGRAM_USER_ID) {
      config.headers["X-Dev-Telegram-User-Id"] = import.meta.env.VITE_DEV_TELEGRAM_USER_ID;
    }
  }
  return config;
});

client.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default client;
