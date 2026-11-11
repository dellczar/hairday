/**
 * Key-value storage that splits large values into chunks.
 *
 * The phone's secure storage (iOS Keychain / Android Keystore via expo-secure-store)
 * only reliably holds ~2 KB per item, and a Supabase session is larger than that.
 * So we store `key.n` = number of chunks and `key.0`, `key.1`, … = the pieces.
 */
export type BasicStore = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

export const CHUNK_SIZE = 1800;

// SecureStore keys may only contain letters, numbers, ".", "-" and "_".
export function safeKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, '_');
}

export function createChunkedStorage(store: BasicStore) {
  async function removeItem(key: string): Promise<void> {
    const k = safeKey(key);
    const n = Number((await store.getItemAsync(`${k}.n`)) ?? 0);
    await Promise.all(Array.from({ length: n }, (_, i) => store.deleteItemAsync(`${k}.${i}`)));
    await store.deleteItemAsync(`${k}.n`);
  }

  return {
    async getItem(key: string): Promise<string | null> {
      const k = safeKey(key);
      const raw = await store.getItemAsync(`${k}.n`);
      if (raw == null) return null;
      const n = Number(raw);
      const parts = await Promise.all(Array.from({ length: n }, (_, i) => store.getItemAsync(`${k}.${i}`)));
      if (parts.some((p) => p == null)) return null; // partial write — treat as missing
      return parts.join('');
    },

    async setItem(key: string, value: string): Promise<void> {
      await removeItem(key);
      const k = safeKey(key);
      const chunks: string[] = [];
      for (let i = 0; i < value.length; i += CHUNK_SIZE) chunks.push(value.slice(i, i + CHUNK_SIZE));
      await Promise.all(chunks.map((c, i) => store.setItemAsync(`${k}.${i}`, c)));
      await store.setItemAsync(`${k}.n`, String(chunks.length));
    },

    removeItem,
  };
}
