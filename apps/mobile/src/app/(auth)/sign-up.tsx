/**
 * Create Account (FR-004, D11) — top-aligned fields, bottom-anchored CTA.
 *
 * Keyboard strategy (FR-007): KeyboardAvoidingView('padding') lifts the whole
 * scroll region, and the CTA block sits at the END of the scroll content with
 * `mt-auto` — so with the keyboard open the submit button rides directly above
 * it, always visible, always tappable.
 */

import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthErrorNotice } from '@/features/auth/components/AuthErrorNotice';
import { AuthSubmitButton } from '@/features/auth/components/AuthSubmitButton';
import { AuthTextField } from '@/features/auth/components/AuthTextField';
import { SocialSignInRow } from '@/features/auth/components/SocialSignInRow';
import { useSignUpForm } from '@/features/auth/hooks/useSignUpForm';

export default function SignUpScreen() {
  const router = useRouter();
  const form = useSignUpForm();

  return (
    <View className="flex-1 bg-surface">
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1">
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexGrow: 1 }}>
            <View className="flex-1 px-6 pb-4">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                onPress={() => router.back()}
                className="h-11 w-11 justify-center">
                <Text className="text-2xl text-ink">‹</Text>
              </Pressable>

              <Animated.View
                entering={FadeInDown.springify().mass(0.8).damping(18).stiffness(160)}
                className="gap-4 pt-2">
                <Text className="font-serif text-3xl text-ink">Create account</Text>
                <AuthErrorNotice message={form.formError} />
                <AuthTextField
                  label="First name (optional)"
                  value={form.firstName}
                  onChangeText={form.setFirstName}
                  placeholder="How should we greet you?"
                  autoCapitalize="words"
                  autoComplete="given-name"
                  textContentType="givenName"
                />
                <AuthTextField
                  label="Email"
                  value={form.email}
                  onChangeText={form.setEmail}
                  error={form.emailError}
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                />
                <AuthTextField
                  label="Password"
                  value={form.password}
                  onChangeText={form.setPassword}
                  error={form.passwordError}
                  placeholder="At least 8 characters"
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="go"
                  onSubmitEditing={form.submit}
                />
              </Animated.View>

              <View className="mt-auto gap-4 pt-6">
                <AuthSubmitButton
                  label="Create account"
                  busy={form.submitting}
                  disabled={!form.canSubmit}
                  onPress={form.submit}
                />
                <SocialSignInRow />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.replace('/sign-in')}
                  className="min-h-11 items-center justify-center">
                  <Text className="text-sm text-ink-muted">
                    Already have an account? <Text className="font-semibold text-primary">Log in</Text>
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
