/**
 * Reset Password (FR-006) — enumeration-safe by construction: the contract
 * resolves identically (state AND timing) whether or not the email is
 * registered, and this screen renders ONE confirmation, worded to promise
 * nothing about account existence.
 */

import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthErrorNotice } from '@/features/auth/components/AuthErrorNotice';
import { AuthSubmitButton } from '@/features/auth/components/AuthSubmitButton';
import { AuthTextField } from '@/features/auth/components/AuthTextField';
import { usePasswordReset } from '@/features/auth/hooks/usePasswordReset';

const enterSpring = FadeInDown.springify().mass(0.8).damping(18).stiffness(160);

export default function ResetPasswordScreen() {
  const router = useRouter();
  const form = usePasswordReset();

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

              {form.sent ? (
                <Animated.View entering={enterSpring} className="flex-1 justify-center gap-4">
                  <Text className="text-5xl">✉️</Text>
                  <Text className="font-serif text-3xl text-ink">Check your inbox</Text>
                  {/* Identical copy for every input — promises a check, not an account. */}
                  <Text className="text-base leading-relaxed text-ink-muted">
                    If an account exists for {form.email.trim()}, we&apos;ve sent a link to reset your
                    password.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.back()}
                    className="min-h-[52px] items-center justify-center rounded-full bg-primary active:bg-primary-pressed">
                    <Text className="text-base font-semibold text-on-primary">Back to log in</Text>
                  </Pressable>
                </Animated.View>
              ) : (
                <>
                  <Animated.View entering={enterSpring} className="gap-4 pt-2">
                    <Text className="font-serif text-3xl text-ink">Reset password</Text>
                    <Text className="text-base leading-relaxed text-ink-muted">
                      Enter your email and we&apos;ll send you a link to choose a new password.
                    </Text>
                    <AuthErrorNotice message={form.formError} />
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
                      returnKeyType="go"
                      onSubmitEditing={form.submit}
                    />
                  </Animated.View>

                  <View className="mt-auto pt-6">
                    <AuthSubmitButton
                      label="Send reset link"
                      busy={form.submitting}
                      disabled={!form.canSubmit}
                      onPress={form.submit}
                    />
                  </View>
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
