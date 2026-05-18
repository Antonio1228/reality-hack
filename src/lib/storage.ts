import AsyncStorage from "@react-native-async-storage/async-storage";

import type { PlayerProfile, SavedGeneration } from "../types";

const STORAGE_KEY = "reality-hack";
const LEGACY_STORAGE_KEYS = ["reality-hack:v1"];
const SCHEMA_VERSION = 1;

export type PersistedState = {
  schemaVersion?: number;
  generationsUsed: number;
  isPro: boolean;
  history: SavedGeneration[];
  profile: PlayerProfile | null;
};

const initialState: PersistedState = {
  schemaVersion: SCHEMA_VERSION,
  generationsUsed: 0,
  isPro: false,
  history: [],
  profile: null
};

export async function loadPersistedState(): Promise<PersistedState> {
  const { raw, legacyKey } = await readPersistedPayload();
  if (!raw) {
    return initialState;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const state = {
      schemaVersion: SCHEMA_VERSION,
      generationsUsed: typeof parsed.generationsUsed === "number" ? parsed.generationsUsed : initialState.generationsUsed,
      isPro: typeof parsed.isPro === "boolean" ? parsed.isPro : initialState.isPro,
      history: Array.isArray(parsed.history) ? parsed.history : initialState.history,
      profile: parsed.profile && typeof parsed.profile === "object" ? parsed.profile : initialState.profile
    };
    if (legacyKey) {
      await savePersistedState(state);
      await AsyncStorage.removeItem(legacyKey);
    }
    return state;
  } catch {
    return initialState;
  }
}

export async function savePersistedState(state: PersistedState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, schemaVersion: SCHEMA_VERSION }));
}

async function readPersistedPayload() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw) {
    return { raw, legacyKey: null };
  }

  for (const legacyKey of LEGACY_STORAGE_KEYS) {
    const legacyRaw = await AsyncStorage.getItem(legacyKey);
    if (legacyRaw) {
      return { raw: legacyRaw, legacyKey };
    }
  }

  return { raw: null, legacyKey: null };
}
