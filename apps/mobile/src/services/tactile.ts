/**
 * Tactile seam (specs/007 contracts/motion-tactility §2) — the ONLY module
 * that imports expo-haptics (the device-store precedent: one seam per
 * hardware/storage backend, so "does this device buzz?" has exactly one
 * answer site).
 *
 * Why SEMANTIC beats instead of raw impact calls: call sites say what a
 * moment *means* (`tick` on a scan-wave peak, `confirm` on a ring segment,
 * `celebrate` on the full ring) and this file owns what that feels like.
 * Retuning the app's tactile personality is then a one-file edit — the same
 * argument as the Tailwind semantic color tokens.
 *
 * Contract rules enforced here:
 * - Additive-only: no caller may treat a beat as the sole carrier of state,
 *   so every function is fire-and-forget `void` — there is nothing to await
 *   and nothing to branch on.
 * - Silent no-op on web/unsupported/errors (Constitution VII): expo-haptics
 *   throws on web and can throw on devices with haptics disabled; we contain
 *   every failure here so a missing vibration motor can never crash a scan.
 * - Worklet call sites must hop threads first: `scheduleOnRN(tick)` — these
 *   functions touch a native module and are JS-thread-only.
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Web has no haptics module at all — skip before touching the native call. */
const supported = Platform.OS === 'ios' || Platform.OS === 'android';

/** Swallow rejections so a beat can never surface as an unhandled error. */
function fire(effect: () => Promise<void>): void {
  if (!supported) return;
  try {
    effect().catch(() => undefined);
  } catch {
    // Synchronous module-level throw (e.g., remote debugging) — same no-op.
  }
}

/**
 * One light tap — the scan wave's bloom-peak heartbeat (US1).
 * REPEATING contexts must gate this on !useReducedMotion() at the call site
 * (motion-tactility §3): rhythm is decoration, and decoration must be
 * suppressible.
 */
export function tick(): void {
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/**
 * One medium tap — a discrete achievement: ring segment closed, setup
 * journey advanced. One-shot beats survive reduce-motion: they carry
 * information ("that worked"), not rhythm.
 */
export function confirm(): void {
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/**
 * The big moment (full ring, first scan): a success notification followed by
 * one spaced heavy tap — two DISCRETE beats, never a buzz (contract §2).
 * The 180ms gap is what separates "fanfare" from "malfunction".
 */
export function celebrate(): void {
  fire(async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await new Promise((resolve) => setTimeout(resolve, 180));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  });
}
