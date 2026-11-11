import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { KeyRound } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, BackButton, Button, Headline } from '@/components';
import { CodeInput } from '@/components/CodeInput';
import { sendEmailCode, verifyEmailCode } from '@/lib/auth';
import { formatCountdown, OTP_LENGTH, RESEND_SECONDS } from '@/lib/otp';
import { colors, fonts, radius, space, touch } from '@/theme';

export default function Verify() {
  const insets = useSafeAreaInsets();
  const { email = '', intent } = useLocalSearchParams<{ email?: string; intent?: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [left, setLeft] = useState(RESEND_SECONDS);
  const [resent, setResent] = useState(false);
  const lastTried = useRef('');

  // Resend countdown.
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const verify = async (value = code) => {
    if (value.length !== OTP_LENGTH || verifying) return;
    lastTried.current = value;
    setVerifying(true);
    setError(null);
    try {
      await verifyEmailCode(email, value);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // "List your business" goes on to Set up business in Phase 2; everyone else lands on Home.
      router.replace(intent === 'business' ? '/(customer)/(tabs)/profile' : '/(customer)/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That code didn’t work.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setVerifying(false);
    }
  };

  // Verify automatically as soon as 6 digits are in (typed, pasted or autofilled).
  useEffect(() => {
    if (code.length === OTP_LENGTH && code !== lastTried.current) verify(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when the code changes
  }, [code]);

  const resend = async () => {
    setError(null);
    try {
      await sendEmailCode(email);
      setLeft(RESEND_SECONDS);
      setCode('');
      lastTried.current = '';
      setResent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t send a new code. Try again.');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <ScrollView
        style={styles.flex}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 34 }]}>
        <BackButton />
        <Headline text="Check your" accent="inbox." style={styles.headline} />
        <AppText color="muted">
          We sent a 6-digit code to{' '}
          <AppText color="ink" style={{ fontFamily: fonts.semibold }}>
            {email}
          </AppText>
          . It expires in 10 minutes.
        </AppText>

        <View style={styles.code}>
          <CodeInput value={code} onChange={(c) => { setCode(c); setError(null); }} error={!!error} />
        </View>

        {error ? (
          <AppText variant="small" color="danger" style={{ marginTop: space.m }} accessibilityLiveRegion="polite">
            {error}
          </AppText>
        ) : null}

        <View style={styles.resendRow}>
          <AppText variant="small" color="muted">
            {resent && left > 0 ? 'New code sent. ' : 'Didn’t get it? '}
          </AppText>
          <Pressable accessibilityRole="button" disabled={left > 0} onPress={resend} style={styles.resend} accessibilityState={{ disabled: left > 0 }}>
            <AppText variant="smallStrong" style={styles.resendText}>
              {left > 0 ? `Resend in ${formatCountdown(left)}` : 'Resend code'}
            </AppText>
          </Pressable>
        </View>

        <View style={styles.info}>
          <KeyRound size={18} strokeWidth={1.8} color={colors.goldText} />
          <AppText variant="caption" color="inkSoft" style={styles.flex1}>
            No password to remember. We’ll send a fresh code whenever you sign in.
          </AppText>
        </View>

        <View style={styles.flex1} />
        <Button title="Verify and continue" onPress={() => verify()} disabled={code.length !== OTP_LENGTH} loading={verifying} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  flex1: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: space.screen },
  headline: { marginTop: 28, marginBottom: 10 },
  code: { marginTop: 28 },
  resendRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 18 },
  resend: { minHeight: touch, justifyContent: 'center' },
  resendText: { textDecorationLine: 'underline' },
  info: { flexDirection: 'row', gap: space.m, backgroundColor: colors.tint, borderRadius: radius.card, paddingVertical: 14, paddingHorizontal: space.l, marginTop: space.m },
});
