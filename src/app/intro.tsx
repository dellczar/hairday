import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Check } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { AppText, Button, Headline, SalonCard } from '@/components';
import { useListings, useOrigin } from '@/hooks/useDiscovery';
import { useFinishIntro } from '@/hooks/useIntro';
import { useSession } from '@/hooks/useSession';
import { CATEGORY_PHOTOS } from '@/lib/categoryPhotos';
import { categoryName, DEFAULT_FILTERS, HOME_TILES, search } from '@/lib/discovery';
import { colors, fonts, radius, space } from '@/theme';

type Step = 0 | 1 | 2;

/**
 * First-launch intro, shown once per phone before Welcome (like Booksy's):
 * 1) welcome with the category photos gliding past the swirl, 2) "What are you into?",
 * 3) "Salons we think you'll love". Skippable at every step. No notification or gender questions:
 * notifications are asked after the first booking (SPEC §12), and services say enough.
 */
export default function Intro() {
  const insets = useSafeAreaInsets();
  const { setGuest } = useSession();
  const finish = useFinishIntro();
  const [step, setStep] = useState<Step>(0);
  const [back, setBack] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const reduce = useReducedMotion();
  const go = (next: Step) => {
    setBack(next < step);
    setStep(next);
  };
  // Each step slides in from the right (from the left when going back), like Booksy's intro.
  const enter = reduce ? undefined : (back ? SlideInLeft : SlideInRight).duration(320);
  const exit = reduce ? undefined : (back ? SlideOutRight : SlideOutLeft).duration(320);

  const done = async (to: 'home' | 'signin' | { salon: string }) => {
    await finish.mutateAsync(picked).catch(() => {});
    if (to === 'signin') return router.replace('/(auth)/welcome');
    setGuest(true);
    router.replace('/(customer)/(tabs)');
    if (typeof to === 'object') router.push({ pathname: '/salon/[id]', params: { id: to.salon } });
  };

  return (
    <View style={[styles.screen, step === 0 && styles.dark]}>
      <Animated.View key={step} entering={enter} exiting={exit} style={[styles.page, step === 0 ? styles.dark : styles.light]}>
        {step === 0 ? (
          <WelcomeStep insets={insets} onStart={() => go(1)} onSkip={() => done('home')} onSignIn={() => done('signin')} />
        ) : step === 1 ? (
          <PickStep insets={insets} picked={picked} setPicked={setPicked} onNext={() => go(2)} onSkip={() => done('home')} />
        ) : (
          <PicksStep insets={insets} picked={picked} onDone={() => done('home')} onSalon={(id) => done({ salon: id })} onBack={() => go(1)} />
        )}
      </Animated.View>
    </View>
  );
}

type Insets = { top: number; bottom: number };

/** Step 1: navy welcome. The category photos glide sideways past the gold swirl over soft wavy lines. */
function WelcomeStep({ insets, onStart, onSkip, onSignIn }: { insets: Insets; onStart: () => void; onSkip: () => void; onSignIn: () => void }) {
  const reduce = useReducedMotion();
  const { width } = useWindowDimensions();
  const DOT = 84;
  const GAP = 16;
  const rowWidth = HOME_TILES.length * (DOT + GAP);
  const x = useSharedValue(0);
  const breath = useSharedValue(1);
  useEffect(() => {
    if (reduce) return;
    x.value = withRepeat(withTiming(-rowWidth, { duration: 22000, easing: Easing.linear }), -1, false);
    breath.value = withRepeat(withTiming(1.07, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [x, breath, reduce, rowWidth]);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const breathe = useAnimatedStyle(() => ({ transform: [{ scale: breath.value }] }));

  // Three soft gold waves across the photo band (decorative).
  const waves = [0, 1, 2].map((k) => {
    const y = 70 + k * 40;
    let d = `M 0 ${y}`;
    for (let px = 0; px <= width; px += 20) d += ` L ${px} ${(y + Math.sin((px / width) * Math.PI * 3 + k) * 10).toFixed(1)}`;
    return d;
  });

  return (
    <View style={[styles.flex1, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }]}>
      <StatusBar style="light" />
      <View style={styles.topBar}>
        <Image source={require('../../assets/brand/logo-on-dark.png')} style={styles.logo} contentFit="contain" accessibilityLabel="Hairday" />
        <Pressable onPress={onSkip} accessibilityRole="button" hitSlop={10} style={styles.skipDark}>
          <AppText variant="smallStrong" color="onDark">
            Skip
          </AppText>
        </Pressable>
      </View>

      <View style={styles.band} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Svg width={width} height={200} style={styles.waves}>
          {waves.map((d, k) => (
            <Path key={k} d={d} stroke={colors.gold} strokeOpacity={0.28 - k * 0.06} strokeWidth={1.5} fill="none" />
          ))}
        </Svg>
        <Animated.View style={[styles.row, slide]}>
          {[...HOME_TILES, ...HOME_TILES, ...HOME_TILES].map((slug, i) => (
            <Animated.View
              key={`${slug}-${i}`}
              entering={reduce ? undefined : FadeIn.delay(80 * (i % HOME_TILES.length)).duration(500)}
              style={[styles.dot, { width: DOT, height: DOT, borderRadius: DOT / 2, marginRight: GAP }]}>
              <Image source={CATEGORY_PHOTOS[slug]} style={StyleSheet.absoluteFill} contentFit="cover" />
            </Animated.View>
          ))}
        </Animated.View>
        <Animated.View style={[styles.badge, breathe]}>
          <Image source={require('../../assets/images/adaptive-icon.png')} style={styles.badgeSwirl} contentFit="contain" />
        </Animated.View>
      </View>

      <Animated.View entering={reduce ? undefined : FadeInDown.delay(300).duration(500)} style={styles.welcomeText}>
        <Headline text="Welcome to" accent="Hairday." onDark size="hero" style={styles.center} />
        <AppText color="onDarkMuted" style={styles.center}>
          Find great salons, barbers and stylists near you, and book in seconds. No phone calls.
        </AppText>
      </Animated.View>

      <View style={styles.actions}>
        <Button title="Get started" variant="gold" onPress={onStart} />
        <Pressable onPress={onSignIn} accessibilityRole="link" style={styles.signIn}>
          <AppText variant="small" color="onDarkMuted">
            Already have an account?{' '}
            <AppText variant="smallStrong" color="onDark" style={styles.underline}>
              Sign in
            </AppText>
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

/** Step 2: pick the services you're into (as many as you like). */
function PickStep({
  insets,
  picked,
  setPicked,
  onNext,
  onSkip,
}: {
  insets: Insets;
  picked: string[];
  setPicked: (p: string[]) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const toggle = (slug: string) => {
    Haptics.selectionAsync().catch(() => {});
    setPicked(picked.includes(slug) ? picked.filter((s) => s !== slug) : [...picked, slug]);
  };
  return (
    <View style={[styles.flex1, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }]}>
      <View style={[styles.topBar, styles.topBarEnd]}>
        <Pressable onPress={onSkip} accessibilityRole="button" hitSlop={10} style={styles.skip}>
          <AppText variant="smallStrong">Skip</AppText>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.pickContent}>
        <Animated.View entering={FadeInDown.duration(400)} style={styles.gapS}>
          <Headline text="What are you" accent="into?" size="title" style={styles.center} />
          <AppText color="muted" style={styles.center}>
            Pick as many as you like. We’ll show you these first.
          </AppText>
        </Animated.View>
        <View style={styles.grid} accessibilityRole="list">
          {HOME_TILES.map((slug, i) => {
            const on = picked.includes(slug);
            return (
              <Animated.View key={slug} entering={FadeInDown.delay(60 * i).duration(400)} style={styles.cell}>
                <Pressable
                  onPress={() => toggle(slug)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={categoryName(slug)}
                  style={styles.cellPress}>
                  <View style={[styles.bubble, on && styles.bubbleOn]}>
                    <Image source={CATEGORY_PHOTOS[slug]} style={StyleSheet.absoluteFill} contentFit="cover" />
                    {on ? (
                      <View style={styles.tick}>
                        <Check size={18} strokeWidth={2.6} color={colors.onGold} />
                      </View>
                    ) : null}
                  </View>
                  <AppText variant="small" style={[styles.center, on && styles.bold]}>
                    {categoryName(slug)}
                  </AppText>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>
      <View style={styles.actionsLight}>
        <Button title={picked.length ? 'Continue' : 'Show me everything'} onPress={onNext} />
      </View>
    </View>
  );
}

/** Step 3: salons that match the picks (or the best-rated ones). */
function PicksStep({
  insets,
  picked,
  onDone,
  onSalon,
  onBack,
}: {
  insets: Insets;
  picked: string[];
  onDone: () => void;
  onSalon: (id: string) => void;
  onBack: () => void;
}) {
  const listings = useListings();
  const origin = useOrigin(false);
  const salons = useMemo(() => {
    const all = listings.data ?? [];
    const point = origin.data?.point ?? null;
    const matched = search(all, { ...DEFAULT_FILTERS, categories: picked, sort: 'top' }, point);
    return (matched.length ? matched : search(all, { ...DEFAULT_FILTERS, sort: 'top' }, point)).slice(0, 3);
  }, [listings.data, origin.data, picked]);

  return (
    <View style={[styles.flex1, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }]}>
      <ScrollView contentContainerStyle={styles.picksContent}>
        <Animated.View entering={FadeInDown.duration(400)} style={styles.gapS}>
          <Headline text="Salons we think" accent="you’ll love." size="title" style={styles.center} />
          <AppText color="muted" style={styles.center}>
            {picked.length ? `Picked for you: ${picked.map(categoryName).join(', ')}.` : 'Some of the best-rated salons near you.'}
          </AppText>
          <Pressable onPress={onBack} accessibilityRole="button" style={styles.adjust}>
            <AppText variant="smallStrong">Change my picks</AppText>
          </Pressable>
        </Animated.View>
        {salons.map((s, i) => (
          <Animated.View key={s.business.id} entering={FadeInDown.delay(100 + 80 * i).duration(400)}>
            <SalonCard salon={s} onPress={() => onSalon(s.business.id)} />
          </Animated.View>
        ))}
      </ScrollView>
      <View style={styles.actionsLight}>
        <Button title="Start exploring" variant="gold" onPress={onDone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  dark: { backgroundColor: colors.ink },
  flex1: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.screen, minHeight: 56 },
  topBarEnd: { justifyContent: 'flex-end' },
  logo: { width: 100, height: 55, marginLeft: -8 },
  skipDark: {
    minHeight: 44,
    paddingHorizontal: space.l,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.onDarkLineStrong,
    justifyContent: 'center',
  },
  skip: { minHeight: 44, paddingHorizontal: space.l, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, justifyContent: 'center' },
  page: { ...StyleSheet.absoluteFill },
  light: { backgroundColor: colors.bg },
  band: { flex: 1, minHeight: 220, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  row: { position: 'absolute', left: 0, top: '50%', marginTop: -42, flexDirection: 'row', alignItems: 'center' },
  waves: { position: 'absolute', left: 0, top: '50%', marginTop: -110 },
  dot: { overflow: 'hidden', borderWidth: 2, borderColor: colors.onDarkLine },
  badge: {
    width: 112,
    height: 112,
    borderRadius: 30,
    // See-through, so the gliding photos stay visible behind the swirl.
    backgroundColor: colors.inkGlass,
    borderWidth: 1.5,
    borderColor: colors.goldGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSwirl: { width: 120, height: 120 },
  welcomeText: { paddingHorizontal: space.screen, gap: space.m },
  center: { textAlign: 'center' },
  actions: { paddingHorizontal: space.screen, paddingTop: space.xxl, gap: space.s },
  actionsLight: { paddingHorizontal: space.screen, paddingTop: space.m },
  signIn: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
  pickContent: { paddingHorizontal: space.screen, paddingTop: space.s, paddingBottom: space.xl, gap: space.xxl },
  gapS: { gap: space.s, alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.xl },
  cell: { width: '33.333%', alignItems: 'center' },
  cellPress: { alignItems: 'center', gap: space.s, minWidth: 88 },
  bubble: { width: 88, height: 88, borderRadius: 44, overflow: 'hidden', borderWidth: 3, borderColor: colors.bg, backgroundColor: colors.bg },
  bubbleOn: { borderColor: colors.gold },
  tick: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bold: { fontFamily: fonts.semibold },
  picksContent: { paddingHorizontal: space.screen, paddingTop: space.xl, paddingBottom: space.xl, gap: space.l },
  adjust: { minHeight: 44, paddingHorizontal: space.l, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, justifyContent: 'center' },
});
