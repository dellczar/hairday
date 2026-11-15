import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { Navigation, Plus } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, BackButton, Button, Chip, Headline, Input, ListGroup, TimeRow } from '@/components';
import { useBusinessHours, useMyBusiness, useOwnerAction } from '@/hooks/useOwner';
import { useSession } from '@/hooks/useSession';
import { addressErrors, fromGeocode, stateCode, type AddressErrors } from '@/lib/address';
import { BUSINESS_TYPES } from '@/lib/catalog';
import { formatRange, fromMinutes, openSummary, toMinutes, WEEK } from '@/lib/hours';
import type { Business, BusinessHour } from '@/lib/types';
import { createBusiness, replaceBusinessHours, updateBusiness, type DayHours } from '@/lib/owner';
import { pickPhoto } from '@/lib/photos';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors, radius, space } from '@/theme';

type Range = { start: number; end: number };
const DEFAULT_RANGE: Range = { start: 10 * 60, end: 20 * 60 };

/**
 * Set up business (Setup.html): 1 name/logo/type → 2 address → 3 open days and hours.
 * Also opened from Business profile → "Location & hours" with ?edit=1, which shows steps 2–3 and saves changes.
 */
export default function Setup() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const editing = edit === '1';
  const { session } = useSession();
  const business = useMyBusiness();
  const savedHours = useBusinessHours(editing ? business.data?.id : undefined);

  // Signing in is needed to own a business (except in demo mode, before Supabase exists).
  useEffect(() => {
    if (isSupabaseConfigured && !session) router.replace({ pathname: '/(auth)/email', params: { intent: 'business' } });
  }, [session]);

  // When editing, wait for what's saved so the form starts from it.
  if (editing && (!business.data || !savedHours.data)) {
    return (
      <View style={[styles.flex, styles.center]}>
        <ActivityIndicator color={colors.muted} />
      </View>
    );
  }
  return <SetupForm editing={editing} business={editing ? (business.data ?? null) : null} savedHours={savedHours.data ?? []} />;
}

/** Form starting values: blank for a new business, or what's saved when editing. */
function initialValues(b: Business | null, rows: BusinessHour[]) {
  const first = rows[0];
  const perDay: Record<number, Range> = {};
  for (const r of rows) perDay[r.weekday] = { start: toMinutes(r.opens_at), end: toMinutes(r.closes_at) };
  return {
    street: b?.address_line1 ?? '',
    suite: b?.address_line2 ?? '',
    city: b?.city ?? '',
    state: b?.state ?? '',
    zip: b?.zip ?? '',
    coords: b?.lat != null && b?.lng != null ? { lat: b.lat, lng: b.lng } : null,
    // Monday–Saturday open by default, like the design.
    open: new Set(rows.length ? rows.map((r) => r.weekday) : [1, 2, 3, 4, 5, 6]),
    common: first ? { start: toMinutes(first.opens_at), end: toMinutes(first.closes_at) } : DEFAULT_RANGE,
    perDay,
    custom: rows.some((r) => r.opens_at !== first?.opens_at || r.closes_at !== first?.closes_at),
  };
}

function SetupForm({ editing, business, savedHours }: { editing: boolean; business: Business | null; savedHours: BusinessHour[] }) {
  const insets = useSafeAreaInsets();
  const { setMode } = useSession();
  const [init] = useState(() => initialValues(business, savedHours));

  const [step, setStep] = useState(editing ? 2 : 1);
  // Step 1
  const [name, setName] = useState('');
  const [type, setType] = useState<string>(BUSINESS_TYPES[0]);
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  // Step 2
  const [street, setStreet] = useState(init.street);
  const [suite, setSuite] = useState(init.suite);
  const [city, setCity] = useState(init.city);
  const [state, setState] = useState(init.state);
  const [zip, setZip] = useState(init.zip);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(init.coords);
  const [addrErrors, setAddrErrors] = useState<AddressErrors>({});
  const clearAddrError = (k: keyof AddressErrors) => setAddrErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
  const [locating, setLocating] = useState(false);
  // Step 3
  const [open, setOpen] = useState<Set<number>>(init.open);
  const [common, setCommon] = useState<Range>(init.common);
  const [perDay, setPerDay] = useState<Record<number, Range>>(init.perDay);
  const [custom, setCustom] = useState(init.custom);

  const rangeFor = (weekday: number): Range => (custom ? (perDay[weekday] ?? common) : common);
  const hours: DayHours[] = useMemo(
    () => [...open].sort().map((weekday) => {
      const r = custom ? (perDay[weekday] ?? common) : common;
      return { weekday, start: fromMinutes(r.start), end: fromMinutes(r.end) };
    }),
    [open, common, perDay, custom],
  );
  const badHours = hours.some((h) => toMinutes(h.end) <= toMinutes(h.start));

  const create = useOwnerAction(createBusiness);
  const saveEdits = useOwnerAction(async () => {
    const b = business;
    if (!b) throw new Error('Business not found.');
    await updateBusiness(b.id, addressPatch());
    await replaceBusinessHours(b.id, hours);
  });

  function addressPatch() {
    return {
      address_line1: street.trim(),
      address_line2: suite.trim() || null,
      city: city.trim(),
      state: stateCode(state) ?? state.trim(),
      zip: zip.trim(),
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    };
  }

  const locateMe = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Location is off', 'You can type your address instead, or allow location for Hairday in Settings.', [
          { text: 'OK', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) },
        ]);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync(pos.coords);
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      if (place) {
        const a = fromGeocode(place);
        setStreet(a.street);
        setCity(a.city);
        setState(a.state);
        setZip(a.zip);
        setAddrErrors({});
      }
    } catch {
      Alert.alert('Couldn’t find your location', 'Type your address instead.');
    } finally {
      setLocating(false);
    }
  };

  const next = async () => {
    if (step === 1) {
      const n = name.trim();
      if (!n) return setNameError('Enter your business name.');
      if (n.length > 60) return setNameError('Keep the name under 60 characters.');
      setNameError(null);
      return setStep(2);
    }
    if (step === 2) {
      const errs = addressErrors({ street, city, state, zip });
      setAddrErrors(errs);
      if (Object.keys(errs).length) return;
      return setStep(3);
    }
    // Step 3
    if (!open.size) return Alert.alert('Pick at least one day', 'Clients can only book on days you’re open.');
    if (badHours) return Alert.alert('Check your hours', 'Closing time has to be after opening time.');
    try {
      if (editing) {
        await saveEdits.mutateAsync(undefined);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        router.back();
      } else {
        await create.mutateAsync({ name: name.trim(), type, logoUri, ...addressPatch(), hours });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setMode('business');
        router.replace('/(business)/(tabs)/business');
      }
    } catch (e) {
      Alert.alert('Couldn’t save', e instanceof Error ? e.message : 'Try again.');
    }
  };

  const back = () => {
    if (step === (editing ? 2 : 1)) return router.canGoBack() ? router.back() : router.replace('/');
    setStep(step - 1);
  };

  const toggleDay = (weekday: number) => {
    Haptics.selectionAsync().catch(() => {});
    const s = new Set(open);
    if (s.has(weekday)) s.delete(weekday);
    else s.add(weekday);
    setOpen(s);
  };

  const saving = create.isPending || saveEdits.isPending;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <ScrollView
        style={styles.flex}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 34 }]}>
        <View style={styles.top}>
          <BackButton onPress={back} />
          <View style={styles.bars} accessible accessibilityLabel={`Step ${step} of 3`}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={[styles.bar, { backgroundColor: i <= step ? colors.gold : colors.line }]} />
            ))}
          </View>
          <AppText variant="caption" color="muted" style={styles.stepLabel} importantForAccessibility="no">
            {step} of 3
          </AppText>
        </View>

        {step === 1 ? (
          <View style={styles.section}>
            <Headline text={'Tell us about\nyour'} accent="business." style={styles.h1} />
            <Pressable accessibilityRole="button" accessibilityLabel={logoUri ? 'Change your logo' : 'Add your logo'} onPress={async () => setLogoUri((await pickPhoto({ square: true, title: 'Add your logo' })) ?? logoUri)} style={styles.logoRow}>
              {logoUri ? (
                <Image source={{ uri: logoUri }} style={styles.logo} contentFit="cover" />
              ) : (
                <View style={[styles.logo, styles.logoEmpty]}>
                  <Plus size={22} strokeWidth={1.8} color={colors.muted} />
                </View>
              )}
              <AppText variant="smallStrong">{logoUri ? 'Change logo' : 'Add your logo'}</AppText>
            </Pressable>
            <Input label="Business name" value={name} onChangeText={(t) => { setName(t); setNameError(null); }} error={nameError} placeholder="Lisa’s Salon" autoCapitalize="words" returnKeyType="next" maxLength={80} />
            <View style={styles.group}>
              <AppText variant="smallStrong">What kind of business?</AppText>
              <View style={styles.chips}>
                {BUSINESS_TYPES.map((t) => (
                  <Chip key={t} label={t} selected={type === t} onPress={() => setType(t)} />
                ))}
              </View>
            </View>
          </View>
        ) : step === 2 ? (
          <View style={[styles.section, { gap: 14 }]}>
            <Headline text={'Where can clients'} accent="find you?" breakBefore style={{ ...styles.h1, marginBottom: 4 }} />
            <Pressable accessibilityRole="button" onPress={locateMe} disabled={locating} style={styles.locate}>
              {locating ? <ActivityIndicator color={colors.ink} /> : <Navigation size={18} strokeWidth={1.8} color={colors.ink} />}
              <AppText variant="smallStrong">Use my current location</AppText>
            </Pressable>
            <Input label="Street address" value={street} onChangeText={(t) => { setStreet(t); setCoords(null); clearAddrError('street'); }} error={addrErrors.street} placeholder="555 Main St" autoComplete="street-address" textContentType="streetAddressLine1" />
            <Input label="Suite or unit (optional)" value={suite} onChangeText={setSuite} placeholder="Suite 6" textContentType="streetAddressLine2" />
            <Input label="City" value={city} onChangeText={(t) => { setCity(t); setCoords(null); clearAddrError('city'); }} error={addrErrors.city} placeholder="New York" textContentType="addressCity" />
            <View style={styles.pair}>
              <View style={styles.flex1}>
                <Input label="State" value={state} onChangeText={(t) => { setState(t); clearAddrError('state'); }} error={addrErrors.state} placeholder="NY" autoCapitalize="characters" textContentType="addressState" maxLength={20} />
              </View>
              <View style={styles.flex1}>
                <Input label="ZIP code" value={zip} onChangeText={(t) => { setZip(t); clearAddrError('zip'); }} error={addrErrors.zip} placeholder="10001" keyboardType="number-pad" textContentType="postalCode" maxLength={10} />
              </View>
            </View>
            <View style={styles.map} accessible accessibilityRole="image" accessibilityLabel="Map preview of the address">
              <View style={styles.roadH} />
              <View style={styles.roadV} />
              <View style={styles.pin} />
            </View>
            <AppText variant="caption" color="muted">
              {coords ? 'Pinned at your current location.' : 'We’ll place your pin on the map from this address.'}
            </AppText>
          </View>
        ) : (
          <View style={[styles.section, { gap: 14 }]}>
            <Headline text={'When are\nyou'} accent="open?" style={{ ...styles.h1, marginBottom: 4 }} />
            <View style={styles.days}>
              {WEEK.map((d) => {
                const on = open.has(d.weekday);
                return (
                  <Pressable key={d.weekday} accessibilityRole="checkbox" accessibilityLabel={d.full} accessibilityState={{ checked: on }} onPress={() => toggleDay(d.weekday)} style={[styles.day, on ? styles.dayOn : styles.dayOff]}>
                    <AppText variant="smallStrong" color={on ? 'white' : 'ink'}>
                      {d.short}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
            {!custom ? (
              <ListGroup>
                <TimeRow label="Opens" value={common.start} onChange={(start) => setCommon({ ...common, start })} />
                <TimeRow label="Closes" value={common.end} onChange={(end) => setCommon({ ...common, end })} />
              </ListGroup>
            ) : (
              WEEK.filter((d) => open.has(d.weekday)).map((d) => {
                const r = rangeFor(d.weekday);
                const set = (patch: Partial<Range>) => setPerDay({ ...perDay, [d.weekday]: { ...r, ...patch } });
                return (
                  <View key={d.weekday} style={styles.group}>
                    <AppText variant="smallStrong">{d.full}</AppText>
                    <ListGroup>
                      <TimeRow label={`${d.full} opens`} value={r.start} onChange={(start) => set({ start })} />
                      <TimeRow label={`${d.full} closes`} value={r.end} onChange={(end) => set({ end })} />
                    </ListGroup>
                  </View>
                );
              })
            )}
            <Pressable
              accessibilityRole="button"
              style={styles.link}
              onPress={() => {
                if (!custom) {
                  const all: Record<number, Range> = {};
                  for (const d of WEEK) all[d.weekday] = perDay[d.weekday] ?? common;
                  setPerDay(all);
                }
                setCustom(!custom);
              }}>
              <AppText variant="smallStrong" style={styles.underline}>
                {custom ? 'Use the same hours every day' : 'Set different hours for some days'}
              </AppText>
            </Pressable>
            {badHours ? (
              <AppText variant="caption" color="danger" accessibilityLiveRegion="polite">
                Closing time has to be after opening time.
              </AppText>
            ) : null}
            <AppText variant="caption" color="muted">
              {openSummary(open.size, !custom && open.size ? formatRange(common.start, common.end) : undefined)}
            </AppText>
          </View>
        )}

        <View style={styles.flex1} />
        <Button
          title={step < 3 ? 'Continue' : editing ? 'Save changes' : 'Finish setup'}
          onPress={next}
          loading={saving}
          style={{ marginTop: space.xxl }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  flex1: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: space.screen },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  bars: { flex: 1, flexDirection: 'row', gap: 6 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  stepLabel: { width: 44, textAlign: 'right' },
  section: { gap: 18, marginTop: 26 },
  h1: { fontSize: 38, lineHeight: 39, letterSpacing: -0.8 },
  logoRow: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 44 },
  logo: { width: 64, height: 64, borderRadius: 18 },
  logoEmpty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.placeholder, alignItems: 'center', justifyContent: 'center' },
  group: { gap: space.s },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  locate: { minHeight: 48, borderRadius: radius.input, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  pair: { flexDirection: 'row', gap: space.s },
  map: { height: 150, borderRadius: radius.card, backgroundColor: colors.tint, overflow: 'hidden' },
  roadH: { position: 'absolute', left: 0, right: 0, top: 64, height: 8, backgroundColor: colors.bg },
  roadV: { position: 'absolute', top: 0, bottom: 0, left: '40%', width: 8, backgroundColor: colors.bg },
  pin: { position: 'absolute', left: '37%', top: 38, width: 32, height: 32, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomRightRadius: 16, backgroundColor: colors.gold, transform: [{ rotate: '-45deg' }] },
  days: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  dayOff: { backgroundColor: colors.surface, borderColor: colors.line },
  link: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
});
