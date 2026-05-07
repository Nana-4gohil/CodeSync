import { api } from '../../config/api';
import { LoginCredentials, SignupCredentials } from '../../types/auth.types';

export const authService = {
  async signup(credentials: SignupCredentials) {
    const { data } = await api.post('/auth/signup', credentials);
    return data.data; // { user, accessToken, refreshToken }
  },

  async login(credentials: LoginCredentials) {
    const { data } = await api.post('/auth/login', credentials);
    return data.data;
  },

  async logout(refreshToken: string) {
    await api.post('/auth/logout', { refreshToken });
  },

  async logoutAll() {
    await api.post('/auth/logout-all');
  },

  async getMe() {
    const { data } = await api.get('/auth/me');
    return data.data;
  },
};
