/**
 * Tiny device key-value adapter over expo-secure-store, with a localStorage
 * fallback on web (SecureStore has no web implementation and web builds must
 * not break — plan.md Technical Context).
 *
 * Why SecureStore for everything (including non-secret scan summaries): it is
 * the only durable storage module installed in this app — no AsyncStorage, no
 * expo-file-system — and the feature ships with zero new dependencies (2026-07-09
 * amendment). Payloads are kept small (caps in the callers) because Android's
 * Keystore-backed store warns above ~2KB. When scan history moves server-side,
 * `useRecentScans` is the single swap point and this constraint disappears.
 *
 * Every function swallows storage exceptions into null/no-op: a broken vault
 * must degrade to "signed out / empty state", never a crash (Constitution VII).
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

function webStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export async function readItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return webStorage()?.getItem(key) ?? null;
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function writeItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      webStorage()?.setItem(key, value);
    } catch {
      // Quota/privacy-mode failures degrade silently — see module comment.
    }
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Keychain write failures degrade silently — see module comment.
  }
}

export async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      webStorage()?.removeItem(key);
    } catch {
      // Ignore — absence is the goal.
    }
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Ignore — absence is the goal.
  }
}
