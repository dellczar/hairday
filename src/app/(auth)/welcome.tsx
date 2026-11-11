import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { AppText, Button, Headline } from '@/components';
import { AppleIcon, GoogleIcon, MailIcon } from '@/components/icons';
import { useSession } from '@/hooks/useSession';
import { signInWithApple } from '@/lib/auth';
import { links } from '@/lib/links';
import { colors, fonts, radius, space } from '@/theme';

const HERO_HEIGHT = 400;

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const { setGuest } = useSession();
  const [busy, setBusy] = useState<'apple' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const skip = () => {
    setGuest(true);
    router.replace('/(customer)/(tabs)');
  };

  const apple = async () => {
    setError(null);
    setBusy('apple');
    try {
      const session = await signInWithApple();
      if (session) router.replace('/(customer)/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Apple sign-in didn’t work. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const google = () => {
    // Needs the Google Cloud sign-in keys from Phase 0 before the native Google SDK can be added.
    setError('Google sign-in is coming soon. For now, continue with email.');
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 34 }}
      bounces={false}>
      <View style={styles.hero} accessibilityRole="image" accessibilityLabel="Salon photo">
        {/* Photo placeholder; a real salon photo replaces this before launch. */}
        <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.6" stopColor={colors.ink} stopOpacity={0} />
              <Stop offset="1" stopColor={colors.ink} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#fade)" />
        </Svg>
        <View style={[styles.heroBar, { top: insets.top + 6 }]}>
          <Image
            source={require('../../../assets/brand/logo-on-dark.png')}
            style={styles.logo}
            contentFit="contain"
            accessibilityLabel="Hairday"
          />
          <Pressable accessibilityRole="button" onPress={skip} style={styles.skip} hitSlop={4}>
            <AppText variant="small" color="onDark" style={{ fontFamily: fonts.medium }}>
              Skip
            </AppText>
          </Pressable>
        </View>
      </View>

      <View style={styles.body}>
        <Headline text="Great hair days," accent="booked in seconds." breakBefore onDark size="hero" style={styles.headline} />
        <AppText color="onDarkMuted" style={{ marginBottom: 6 }}>
          Find trusted salons near you and book any time.
        </AppText>

        {Platform.OS === 'ios' ? (
          <Button
            variant="light"
            title="Continue with Apple"
            icon={<AppleIcon color={colors.ink} />}
            loading={busy === 'apple'}
            onPress={apple}
          />
        ) : null}
        <Button variant="outlineDark" title="Continue with Google" icon={<GoogleIcon color={colors.onDark} />} onPress={google} />
        <Button
          variant="outlineDark"
          title="Continue with email"
          icon={<MailIcon color={colors.onDark} />}
          onPress={() => router.push('/(auth)/email')}
        />

        {error ? (
          <View style={styles.error} accessibilityLiveRegion="polite">
            <AppText variant="caption" color="onDark">
              {error}
            </AppText>
          </View>
        ) : null}

        <View style={{ flexGrow: 1, minHeight: space.xl }} />

        <AppText variant="label" color="onDarkFaint" style={styles.legal}>
          By continuing you agree to the{' '}
          <AppText variant="label" color="onDark" style={styles.link} onPress={() => WebBrowser.openBrowserAsync(links.terms)} accessibilityRole="link">
            Terms
          </AppText>{' '}
          and{' '}
          <AppText variant="label" color="onDark" style={styles.link} onPress={() => WebBrowser.openBrowserAsync(links.privacy)} accessibilityRole="link">
            Privacy Policy
          </AppText>
          .{'\n'}Own a salon?{' '}
          <AppText
            variant="label"
            color="onDark"
            style={[styles.link, { fontFamily: fonts.semibold }]}
            onPress={() => router.push({ pathname: '/(auth)/email', params: { intent: 'business' } })}
            accessibilityRole="link">
            List your business
          </AppText>
        </AppText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  hero: { height: HERO_HEIGHT, backgroundColor: colors.photo },
  heroBar: { position: 'absolute', left: 18, right: space.screen, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logo: { width: 128, height: 70 },
  skip: {
    height: 40,
    paddingHorizontal: space.l,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.onDarkLineStrong,
    backgroundColor: colors.inkGlass,
    justifyContent: 'center',
    marginTop: 6,
  },
  body: { flexGrow: 1, paddingHorizontal: space.xxl, gap: 14 },
  headline: { marginTop: -24 },
  error: { backgroundColor: colors.onDarkFill, borderRadius: radius.card, padding: space.m },
  legal: { textAlign: 'center' },
  link: { textDecorationLine: 'underline' },
});
