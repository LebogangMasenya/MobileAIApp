/**
 * Sign In (FR-005/FR-007/FR-008) — email/password + one-tap social, with the
 * same keyboard-avoiding bottom-CTA structure as sign-up (D11). Failed
 * attempts keep every input populated for an immediate retry.
 */

import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthErrorNotice } from '@/features/auth/components/AuthErrorNotice';
import { AuthSubmitButton } from '@/features/auth/components/AuthSubmitButton';
import { AuthTextField } from '@/features/auth/components/AuthTextField';
import { SocialSignInRow } from '@/features/auth/components/SocialSignInRow';
import { useSignInForm } from '@/features/auth/hooks/useSignInForm';

export default function SignInScreen() {
  const router = useRouter();
  const form = useSignInForm();

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
                <Text className="font-serif text-3xl text-ink">Welcome back</Text>
                <AuthErrorNotice message={form.formError} />
                <AuthTextField
                  label="Email"
                  value={form.email}
                  onChangeText={form.setEmail}
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
                  placeholder="Your password"
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="current-password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={form.submit}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/reset-password')}
                  className="min-h-11 justify-center self-start">
                  <Text className="text-sm font-semibold text-primary">Forgot password?</Text>
                </Pressable>
              </Animated.View>

              <View className="mt-auto gap-4 pt-6">
                <AuthSubmitButton
                  label="Log in"
                  busy={form.submitting}
                  disabled={!form.canSubmit}
                  onPress={form.submit}
                />
                <SocialSignInRow />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.replace('/sign-up')}
                  className="min-h-11 items-center justify-center">
                  <Text className="text-sm text-ink-muted">
                    New here? <Text className="font-semibold text-primary">Create account</Text>
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
