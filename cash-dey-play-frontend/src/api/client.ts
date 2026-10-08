import axios, { AxiosError, type AxiosRequestConfig, type RawAxiosRequestHeaders } from "axios";
import { errorMessage, successMessage } from "../helpers/message.helpers";
import { useAuthStore } from "../store/auth.store";
import client from "../config/client.config";

export interface RequestOptions {
  params?: Record<string, any>;
  headers?: RawAxiosRequestHeaders;
  silent?: boolean;
  onUploadProgress?: (event: any, percentage?: number) => void;
}

export const handleAxiosError = <T, D>(ex: AxiosError<T, D>) => {
  if (ex) {
    if (ex instanceof AxiosError) {
      if (ex.code === "ECONNABORTED") {
        errorMessage("Request timed out. Please check your connection and try again.");
      }
    }

    if (ex.response?.status === 401) {
      errorMessage(
        (ex.response?.data as { message?: string })?.message ??
          "Sorry, your session has expired. Please reopen the app in Telegram to continue."
      );
      // Clear auth state — Telegram Mini App will re-init on next open
      useAuthStore.getState().clearAuth();
      return ex;
    } else if (ex.response?.status === 400) {
      errorMessage(
        (ex.response?.data as { message?: string })?.message ??
          "Sorry, this request could not be processed. Please review your inputs and try again."
      );
    } else if (ex.response?.status === 404) {
      errorMessage(
        (ex.response?.data as { message?: string })?.message ??
          "Sorry, the resource you wish to access could not be found."
      );
    } else if (ex.response?.status === 429) {
      errorMessage(
        (ex.response?.data as { message?: string })?.message ??
          "Too many requests. Please slow down and try again shortly."
      );
    } else {
      if (ex.response?.data) {
        const message = (ex.response?.data as { message?: string })?.message;
        if (message) {
          errorMessage(message);
        }
      }
      return ex;
    }
  }

  return ex;
};

export async function getService<T = any>(url = "", options: RequestOptions = {}) {
  try {
    const result = await client.get(url, {
      params: options.params,
      headers: options.headers,
    });
    return result.data?.data as T;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      handleAxiosError<unknown, T>(e);
    }
    throw e;
  }
}

export async function postService<P extends Record<any, any>, T = any>(
  url = "",
  data: P = {} as P,
  options: RequestOptions = {}
) {
  try {
    const result = await client.post(url, data, {
      params: options.params,
      headers: options.headers,
      onUploadProgress: options.onUploadProgress,
    });
    if (result?.data?.message && !options.silent) {
      successMessage(result.data.message);
    }
    return result.data?.data as T;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      handleAxiosError<unknown, T>(e);
    }
    throw e;
  }
}

export async function putService<P extends Record<any, any>, T = any>(
  url = "",
  data: P = {} as P,
  options: RequestOptions = {}
) {
  try {
    const result = await client.put(url, data, {
      params: options.params,
      headers: options.headers,
      onUploadProgress: options.onUploadProgress,
    });
    if (result?.data?.message && !options.silent) {
      successMessage(result.data.message);
    }
    return result.data?.data as T;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      handleAxiosError<unknown, T>(e);
    }
    throw e;
  }
}

export async function deleteService<T = any>(url = "", options: RequestOptions = {}) {
  try {
    const result = await client.delete(url, {
      params: options.params,
      headers: options.headers,
    });
    if (result?.data?.message && !options.silent) {
      successMessage(result.data.message);
    }
    return result.data?.data as T;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      handleAxiosError<unknown, T>(e);
    }
    throw e;
  }
}

export async function patchService<P extends Record<any, any>, T = any>(
  url = "",
  data: P = {} as P,
  options: RequestOptions = {}
) {
  try {
    const result = await client.patch(url, data, {
      params: options.params,
      headers: options.headers,
      onUploadProgress: options.onUploadProgress,
    });
    if (result?.data?.message && !options.silent) {
      successMessage(result.data.message);
    }
    return result.data?.data as T;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      handleAxiosError<unknown, T>(e);
    }
    throw e;
  }
}
