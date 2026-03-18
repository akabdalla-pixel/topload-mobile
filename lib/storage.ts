// Pure JS storage using React Native's built-in MMKVStorage alternative
// This uses a simple in-memory store with no native modules required
// For Expo Go compatibility

let memoryStore: Record<string, string> = {};

export const storage = {
  async getItem(key: string): Promise<string | null> {
    return memoryStore[key] ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    memoryStore[key] = value;
  },
  async removeItem(key: string): Promise<void> {
    delete memoryStore[key];
  },
};
