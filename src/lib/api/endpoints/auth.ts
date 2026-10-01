import { authRequest } from '../client';
import { bffAuthResultSchema, type LoginInput, type MfaInput } from '../schemas';

export const authApi = {
  login: (input: LoginInput) =>
    authRequest('/login', { method: 'POST', body: input, schema: bffAuthResultSchema }),
  verifyMfa: (input: MfaInput) =>
    authRequest('/mfa', { method: 'POST', body: input, schema: bffAuthResultSchema }),
  logout: () => authRequest('/logout', { method: 'POST', schema: undefined }),
};
