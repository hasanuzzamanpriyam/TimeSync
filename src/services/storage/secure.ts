import { Store } from "@tauri-apps/plugin-store";

const TOKEN_STORE = "tokens.json";
const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

let store: Store | null = null;

async function getStore(): Promise<Store> {
  if (!store) {
    store = await Store.load(TOKEN_STORE);
  }
  return store;
}

export const secureStorage = {
  setTokens: async (accessToken: string, refreshToken: string) => {
    const s = await getStore();
    await s.set(ACCESS_TOKEN_KEY, accessToken);
    await s.set(REFRESH_TOKEN_KEY, refreshToken);
    await s.save();
  },

  getAccessToken: async () => {
    const s = await getStore();
    const val = await s.get<string>(ACCESS_TOKEN_KEY);
    return val ?? null;
  },

  getRefreshToken: async () => {
    const s = await getStore();
    const val = await s.get<string>(REFRESH_TOKEN_KEY);
    return val ?? null;
  },

  clearTokens: async () => {
    const s = await getStore();
    await s.delete(ACCESS_TOKEN_KEY);
    await s.delete(REFRESH_TOKEN_KEY);
    await s.save();
  },
};
