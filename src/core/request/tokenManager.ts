import { refreshToken, logout } from '../../api/interface/auth';

export interface TokenManager {
  getToken: () => InternalToken.Token | null;
  setToken: (token: InternalToken.Token) => void;
  refreshToken: () => Promise<InternalToken.Token | null>;
  removeToken: () => Promise<void>;
}

export class defaultTokenManager implements TokenManager {
  private static instance: defaultTokenManager;
  private readonly tokenKey = 'auth_token';

  private constructor() {}

  static getInstance(): defaultTokenManager {
    if (!defaultTokenManager.instance) {
      defaultTokenManager.instance = new defaultTokenManager();
    }
    return defaultTokenManager.instance;
  }

  getToken(): InternalToken.Token | null {
    try {
      const tokenString = localStorage.getItem(this.tokenKey);
      return tokenString ? JSON.parse(tokenString) : null;
    } catch {
      return null;
    }
  }

  setToken(token: InternalToken.Token): void {
    localStorage.setItem(this.tokenKey, JSON.stringify(token));
  }

  async refreshToken(): Promise<InternalToken.Token | null> {
    try {
      const currentToken = this.getToken();
      if (!currentToken?.refresh) {
        throw new Error('No refresh token available');
      }

      const response = await refreshToken({ refreshToken: currentToken.refresh });
      if (response?.data) {
        this.setToken(response.data);
        return response.data;
      }
      return null;
    } catch (error) {
      await this.removeToken();
      throw error;
    }
  }

  async removeToken(): Promise<void> {
    try {
      await logout();
    } finally {
      localStorage.removeItem(this.tokenKey);
    }
  }
} 