import axios, { AxiosRequestConfig, AxiosInstance, AxiosResponse } from "axios";
import { TokenManager, defaultTokenManager } from './tokenManager';
import { ErrorHandler, defaultErrorHandler } from './errorHandler';

export type Response<T> =
  | {
      data: T;
      success: true;
      errorCode?: string;
      errorMessage?: string;
    }
  | {
      data?: T;
      success: false;
      errorCode: number;
      errorMessage: string;
    };

type ExtractKeys<T extends string> =
  T extends `${string}{${infer Key}}${infer Rest}`
    ? Key | ExtractKeys<Rest>
    : never;

type PathVariables<T extends string> = ExtractKeys<T> extends never
  ? Record<string, string | number>
  : Record<ExtractKeys<T>, string | number>;

type RequestConfig<
  D extends object,
  Q extends object,
  U extends string,
  P = PathVariables<U>
> = Omit<AxiosRequestConfig<D>, "url" | "params"> & {
  /**
   * @example '/api/:id' => pathVariables: { id: "1" }
   * @example '/api/:id/:name' => pathVariables: { id: "1", name: "2" }
   */
  url: U;
  ignoreAuth?: boolean; //不為true時 header需附帶Authentication value為token
  silentError?: boolean;
  throwError?: boolean;
  params?: Q;
  /**
   * @example '/api/:id' => { id: "1" }
   * @example '/api/:id/:name' => { id: "1", name: "2" }
   */
  pathVariables?: P;
};

export interface Request {
  <
    T,
    D extends object = any,
    Q extends object = any,
    U extends string = string,
    P = PathVariables<U>
  >(
    args: RequestConfig<D, Q, U, P>
  ): Promise<Response<T>>;
}

class RequestInit {
  private axios: AxiosInstance;
  private errorHandler: ErrorHandler;
  private tokenManager: TokenManager;

  constructor(
    baseURL: string,
    errorHandler: ErrorHandler,
    tokenManager: TokenManager
  ) {
    this.axios = axios.create({
      baseURL: baseURL
    });
    this.errorHandler = errorHandler;
    this.tokenManager = tokenManager;

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.axios.interceptors.request.use(
      async (config: any) => {
        if (!config?.ignoreAuth) {
          const token = this.tokenManager.getToken();
          if (token?.access) {
            config.headers['Authorization'] = `Bearer ${token.access}`;
          }
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const requestConfig = error.config;
        
        // 处理401错误，尝试刷新token
        if (error.response?.status === 401 && !requestConfig._retry) {
          requestConfig._retry = true;
          try {
            const newToken = await this.tokenManager.refreshToken();
            if (newToken?.access) {
              requestConfig.headers['Authorization'] = `Bearer ${newToken.access}`;
              return this.axios(requestConfig);
            }
          } catch (refreshError) {
            await this.tokenManager.removeToken();
            this.errorHandler.showError('登录已过期，请重新登录');
            return Promise.reject(refreshError);
          }
        }

        if (!requestConfig?.silentError) {
          const errorMessage = error.response?.data?.message 
            || error.message 
            || '请求失败';
          this.errorHandler.showError(errorMessage);
        }

        if (requestConfig?.throwError) {
          return Promise.reject(error);
        }

        return {
          success: false,
          errorCode: error.response?.status || 500,
          errorMessage: error.response?.data?.message || '请求失败'
        };
      }
    );
  }

  replacePathVariables<T extends string>(
    url: T,
    pathVariables: PathVariables<T>
  ): T {
    let requestUrl = url;
    for (const key in pathVariables) {
      if (pathVariables.hasOwnProperty(key)) {
        requestUrl = url.replace(
          /:([a-zA-Z0-9_]+)/g,
          String(pathVariables[key])
        ) as T;
      }
    }
    return requestUrl;
  }
  
  async request<T = any, D extends object = any, Q extends object = any, U extends string = string, P = PathVariables<U>>(
    config: RequestConfig<D, Q, U, P>
  ): Promise<Response<T>> {
    let { url, pathVariables, throwError } = config;
    if (pathVariables) {
      url = this.replacePathVariables(url, pathVariables as PathVariables<U>);
    }
    try {
      const response: AxiosResponse<T> = await this.axios({
        ...config,
        url,
      });
      return {
        data: response.data,
        success: true,
      };
    } catch (error: any) {
      if (throwError) {
        throw error;
      }
      return {
        data: undefined,
        success: false,
        errorCode: error.response?.status || 500,
        errorMessage: error.response?.data?.message || '请求失败'
      };
    }
  }
}

const requestFunc = new RequestInit(
  process.env.BASE_URL || '',
  defaultErrorHandler.getInstance(),
  defaultTokenManager.getInstance()
);

const request: Request = async <
  T = any,
  D extends object = any,
  Q extends object = any,
  U extends string = string,
  P = PathVariables<U>
>(
  args: RequestConfig<D, Q, U, P>
) => {
  return requestFunc.request<T, D, Q, U, P>(args)
};

export default request;
