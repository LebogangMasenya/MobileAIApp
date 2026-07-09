/**
 * AuthTextField — labeled input with INLINE validation state (FR-004).
 *
 * Validation renders as the user types (once the field has content), not as a
 * post-submit alert: the error slot lives directly under the field so the eye
 * never has to leave the input to learn what's wrong.
 */

import { Text, TextInput, View, type TextInputProps } from 'react-native';

interface AuthTextFieldProps
  extends Pick<
    TextInputProps,
    | 'value'
    | 'onChangeText'
    | 'placeholder'
    | 'autoCapitalize'
    | 'autoComplete'
    | 'autoCorrect'
    | 'keyboardType'
    | 'secureTextEntry'
    | 'textContentType'
    | 'returnKeyType'
    | 'onSubmitEditing'
  > {
  label: string;
  /** Non-null renders the field in its error state with the message below. */
  error?: string | null;
}

export function AuthTextField({ label, error, ...inputProps }: AuthTextFieldProps) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-ink-muted">{label}</Text>
      <TextInput
        {...inputProps}
        accessibilityLabel={label}
        placeholderTextColor="#6F6786"
        // min-h-12 = 48pt — comfortably over the 44pt floor (SC-007).
        className={`min-h-12 rounded-2xl border bg-surface-card px-4 text-base text-ink ${
          error ? 'border-danger' : 'border-line'
        }`}
      />
      {error ? (
        <Text accessibilityRole="alert" className="text-sm text-danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
