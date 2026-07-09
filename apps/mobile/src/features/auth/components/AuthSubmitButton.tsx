/**
 * AuthSubmitButton — the funnel's primary CTA (FR-007, contract C1).
 *
 * Idempotent by construction: the Pressable is disabled the moment `busy`
 * flips, so a rapid double-tap through the mock's simulated latency produces
 * exactly one submission. The busy spinner REPLACES the label (same height)
 * so the button never changes size mid-state — no layout shift.
 */

import { ActivityIndicator, Pressable, Text } from 'react-native';

interface AuthSubmitButtonProps {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
}

export function AuthSubmitButton({ label, onPress, busy = false, disabled = false }: AuthSubmitButtonProps) {
  const inert = busy || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inert, busy }}
      disabled={inert}
      onPress={onPress}
      // min-h-[52px]: over the spec's 48pt CTA floor (FR-003) with margin.
      className={`min-h-[52px] items-center justify-center rounded-full bg-primary active:bg-primary-pressed ${
        disabled && !busy ? 'opacity-50' : ''
      }`}>
      {busy ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text className="text-base font-semibold text-on-primary">{label}</Text>
      )}
    </Pressable>
  );
}
