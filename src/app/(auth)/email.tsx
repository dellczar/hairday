import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, BackButton, Button, Headline, Input } from '@/components';
import { sendEmailCode } from '@/lib/auth';
import { emailError, normalizeEmail } from '@/lib/email';
import { colors, radius, space } from '@/theme';

/**
 * Collects the email before the code screen. Not in the original designs (Welcome → Verify skips it);
 * styled to match Verify.html. See docs/DECISIONS.md.
 */
export default function EmailStep() {
  const insets = useSafeAreaInsets();
  const { intent } = useLocalSearchParams<{ intent?: string }>();
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const fieldError = touched ? emailError(email) : null;

  const submit = async () => {
    setTouched(true);
    setServerError(null);
    if (emailError(email)) return;
    setSending(true);
    try {
      await sendEmailCode(email);
      router.push({ pathname: '/(auth)/verify', params: { email: normalizeEmail(email), intent: intent ?? '' } });
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <ScrollView
        style={styles.flex}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 34 }]}>
        <BackButton />
        <Headline text={intent === 'business' ? 'List your' : 'What’s your'} accent={intent === 'business' ? 'business.' : 'email?'} style={styles.headline} />
        <AppText color="muted">
          {intent === 'business'
            ? 'Start with your email. We’ll send a 6-digit code, then help you set up your salon.'
            : 'We’ll send you a 6-digit code. No password needed.'}
        </AppText>

        <View style={styles.field}>
          <Input
            label="Email"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setServerError(null);
            }}
            onBlur={() => setTouched(true)}
            onSubmitEditing={submit}
            error={fieldError}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="send"
            autoFocus
          />
        </View>

        {serverError ? (
          <View style={styles.notice} accessibilityLiveRegion="polite">
            <AppText variant="caption" color="inkSoft">
              {serverError}
            </AppText>
          </View>
        ) : null}

        <View style={styles.flex} />
        <Button title="Send code" onPress={submit} loading={sending} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, paddingHorizontal: space.screen },
  headline: { marginTop: 28, marginBottom: 10 },
  field: { marginTop: 28 },
  notice: { backgroundColor: colors.tint, borderRadius: radius.card, padding: 14, marginTop: space.m },
});
