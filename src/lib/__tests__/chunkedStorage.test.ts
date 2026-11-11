import { CHUNK_SIZE, createChunkedStorage, safeKey, type BasicStore } from '../chunkedStorage';

function memoryStore(): BasicStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItemAsync: async (k) => data.get(k) ?? null,
    setItemAsync: async (k, v) => {
      if (v.length > 2048) throw new Error('value too large for SecureStore');
      data.set(k, v);
    },
    deleteItemAsync: async (k) => {
      data.delete(k);
    },
  };
}

describe('chunked secure storage', () => {
  it('round-trips a value larger than the 2 KB SecureStore limit', async () => {
    const store = memoryStore();
    const s = createChunkedStorage(store);
    const big = 'x'.repeat(CHUNK_SIZE * 3 + 17);
    await s.setItem('sb-abc-auth-token', big);
    expect(await s.getItem('sb-abc-auth-token')).toBe(big);
    expect(store.data.get('sb-abc-auth-token.n')).toBe('4');
  });

  it('returns null for a missing key', async () => {
    expect(await createChunkedStorage(memoryStore()).getItem('nope')).toBeNull();
  });

  it('removes every chunk', async () => {
    const store = memoryStore();
    const s = createChunkedStorage(store);
    await s.setItem('k', 'y'.repeat(CHUNK_SIZE * 2));
    await s.removeItem('k');
    expect(store.data.size).toBe(0);
  });

  it('overwriting with a shorter value leaves no stale chunks', async () => {
    const store = memoryStore();
    const s = createChunkedStorage(store);
    await s.setItem('k', 'a'.repeat(CHUNK_SIZE * 3));
    await s.setItem('k', 'short');
    expect(await s.getItem('k')).toBe('short');
    expect([...store.data.keys()].sort()).toEqual(['k.0', 'k.n']);
  });

  it('treats a half-written value as missing', async () => {
    const store = memoryStore();
    const s = createChunkedStorage(store);
    await s.setItem('k', 'b'.repeat(CHUNK_SIZE * 2));
    store.data.delete('k.1');
    expect(await s.getItem('k')).toBeNull();
  });

  it('makes keys SecureStore accepts', () => {
    expect(safeKey('sb://abc auth')).toBe('sb___abc_auth');
  });
});
