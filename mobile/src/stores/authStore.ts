/**
 * Authentication state (zustand).
 *
 * - Tokens are persisted in AsyncStorage; the user profile is re-fetched
 *   from /me on bootstrap so it is never stale.
 * - Registers the refresh/logout handlers used by the api axios instance.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loginRequest,
  logoutRequest,
  meRequest,
  refreshRequest,
} from '../services/authApi';
import {
  getApiErrorMessage,
  setAccessToken,
  setLogoutHandler,
  setRefreshHandler,
} from '../services/api';
import { User } from '../types/api';

const ACCESS_TOKEN_KEY = '@pos.auth.accessToken';
const REFRESH_TOKEN_KEY = '@pos.auth.refreshToken';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** True while bootstrap() is restoring the session at app start. */
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  bootstrap: () => Promise<void>;
  hasPermission: (code: string) => boolean;
}

async function persistTokens(
  accessToken: string | null,
  refreshToken: string | null,
): Promise<void> {
  if (accessToken && refreshToken) {
    await AsyncStorage.setMany({
      [ACCESS_TOKEN_KEY]: accessToken,
      [REFRESH_TOKEN_KEY]: refreshToken,
    });
  } else {
    await AsyncStorage.removeMany([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
  }
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: true,
  error: null,

  login: async (username, password) => {
    set({ error: null });
    try {
      const { token, user } = await loginRequest(username.trim(), password);
      await persistTokens(token.accessToken, token.refreshToken);
      setAccessToken(token.accessToken);
      set({
        user,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        error: null,
      });
    } catch (e) {
      const message = getApiErrorMessage(e, 'Login gagal. Coba lagi.');
      set({ error: message });
      throw new Error(message);
    }
  },

  logout: async () => {
    const { refreshToken } = get();
    // Best effort: notify the backend, but always clear local state.
    if (refreshToken) {
      try {
        await logoutRequest(refreshToken);
      } catch {
        // ignore — local logout must still happen
      }
    }
    await persistTokens(null, null);
    setAccessToken(null);
    set({ user: null, accessToken: null, refreshToken: null, error: null });
  },

  bootstrap: async () => {
    set({ isLoading: true });
    try {
      const stored = await AsyncStorage.getMany([
        ACCESS_TOKEN_KEY,
        REFRESH_TOKEN_KEY,
      ]);
      const storedAccess = stored[ACCESS_TOKEN_KEY] ?? null;
      const storedRefresh = stored[REFRESH_TOKEN_KEY] ?? null;

      if (!storedAccess || !storedRefresh) {
        return; // no saved session
      }

      setAccessToken(storedAccess);
      try {
        const user = await meRequest(storedAccess);
        set({
          user,
          accessToken: storedAccess,
          refreshToken: storedRefresh,
        });
      } catch {
        // Saved token invalid/expired and refresh will be attempted lazily
        // by the api interceptor on next request; for a clean bootstrap we
        // try one refresh here so the user isn't stuck logged-out on a
        // merely expired access token.
        try {
          const token = await refreshRequest(storedRefresh);
          await persistTokens(token.accessToken, token.refreshToken);
          setAccessToken(token.accessToken);
          const user = await meRequest(token.accessToken);
          set({
            user,
            accessToken: token.accessToken,
            refreshToken: token.refreshToken,
          });
        } catch {
          await persistTokens(null, null);
          setAccessToken(null);
          set({ user: null, accessToken: null, refreshToken: null });
        }
      }
    } finally {
      set({ isLoading: false });
    }
  },

  hasPermission: code => {
    const { user } = get();
    return !!user && user.permissions.includes(code);
  },
}));

/**
 * Wire the api client's 401 handling to this store. Called once at module load:
 * - refresh: exchange the stored refresh token for a new pair (single-flight is
 *   handled inside the api interceptor).
 * - logout: clear the session when refresh is impossible.
 */
setRefreshHandler(async () => {
  const { refreshToken } = useAuthStore.getState();
  if (!refreshToken) {
    return null;
  }
  try {
    const token = await refreshRequest(refreshToken);
    await persistTokens(token.accessToken, token.refreshToken);
    setAccessToken(token.accessToken);
    useAuthStore.setState({
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
    });
    return token.accessToken;
  } catch {
    return null;
  }
});

setLogoutHandler(async () => {
  await useAuthStore.getState().logout();
});
