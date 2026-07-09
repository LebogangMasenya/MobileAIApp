/**
 * AuthErrorNotice — inline, non-blocking failure surface (FR-008).
 *
 * Renders ALREADY-MAPPED human copy (see utils/error-copy.ts) — never raw
 * error codes. Springs into place rather than appearing, so a failure reads
 * as a gentle nudge instead of a jolt (Constitution V applies to feedback
 * motion too).
 */

import { Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

interface AuthErrorNoticeProps {
  /** null renders nothing — callers can pass their error state straight through. */
  message: string | null;
  /** "gentle" for informational notices (e.g. session expired) vs. failures. */
  tone?: 'error' | 'gentle';
}

export function AuthErrorNotice({ message, tone = 'error' }: AuthErrorNoticeProps) {
  if (!message) return null;
  return (
    <Animated.View
      entering={FadeInDown.springify().mass(0.7).damping(16).stiffness(180)}
      accessibilityRole="alert"
      className={`rounded-2xl border px-4 py-3 ${
        tone === 'error' ? 'border-danger/30 bg-danger-surface' : 'border-line bg-surface-dim'
      }`}>
      <Text className={`text-sm ${tone === 'error' ? 'text-danger' : 'text-ink'}`}>{message}</Text>
    </Animated.View>
  );
}
