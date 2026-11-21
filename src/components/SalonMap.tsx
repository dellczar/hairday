import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { regionFor, type LatLng } from '@/lib/geo';
import { colors, fonts, radius } from '@/theme';

import { AppText } from './AppText';

export type MapPin = { id: string; point: LatLng; label: string; name: string };

type Props = {
  pins: MapPin[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** The customer's location, when they allowed it. */
  me?: LatLng | null;
  height?: number;
};

/**
 * Map with price pins (Results.html). Apple Maps on iPhone. Android uses Google Maps, which needs
 * a key (Phase 0) — until it's added, Android shows a drawn map with the same pins.
 */
export function SalonMap(props: Props) {
  const hasAndroidKey = !!(Constants.expoConfig?.extra as { hasAndroidMapsKey?: boolean } | undefined)?.hasAndroidMapsKey;
  if (Platform.OS === 'android' && !hasAndroidKey) return <DrawnMap {...props} />;
  return <NativeMap {...props} />;
}

function Pin({ label, on }: { label: string; on: boolean }) {
  return (
    <View style={[styles.pin, on && styles.pinOn]}>
      {/* Pins sit on the map, so they grow less than other text (1.3x at most). */}
      <AppText variant="label" color={on ? 'onGold' : 'ink'} style={styles.pinText} maxFontSizeMultiplier={1.3}>
        {label}
      </AppText>
    </View>
  );
}

function NativeMap({ pins, selectedId, onSelect, me, height = 210 }: Props) {
  const region = useMemo(() => regionFor(pins.map((p) => p.point)), [pins]);
  return (
    <View style={[styles.frame, { height }]} accessibilityLabel="Map of salons near you" accessible={false}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        region={region}
        showsUserLocation={!!me}
        // Calm, quiet map like Results.html so the price pins stand out: Apple's muted style on
        // iPhone, our own soft colors on Android (Google Maps), no shops, buildings or traffic.
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
        customMapStyle={Platform.OS === 'android' ? CALM_GOOGLE_STYLE : undefined}
        showsPointsOfInterests={false}
        showsBuildings={false}
        showsTraffic={false}
        showsIndoors={false}
        showsCompass={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}>
        {pins.map((p) => {
          const on = p.id === selectedId;
          return (
            <Marker
              // A new key when selection changes redraws the pin in its new color.
              key={`${p.id}-${on ? 1 : 0}`}
              coordinate={{ latitude: p.point.lat, longitude: p.point.lng }}
              onPress={() => onSelect(p.id)}
              zIndex={on ? 2 : 1}
              tracksViewChanges={false}
              accessibilityLabel={`${p.name}, from ${p.label}`}>
              <Pin label={p.label} on={on} />
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}

/** Google Maps style in the design's map colors (tokens mapLand / mapRoad / mapPark). */
const CALM_GOOGLE_STYLE = [
  { elementType: 'geometry', stylers: [{ color: colors.mapLand }] },
  { elementType: 'labels.text.fill', stylers: [{ color: colors.muted }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: colors.mapRoad }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: colors.mapPark }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: colors.mapRoad }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: colors.surface }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: colors.tile3 }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
];

/**
 * Sample map picture of New York for testing on Android until the Google Maps key is added
 * (OpenStreetMap tiles, zoom 12, tinted to the design's map colors). Pins are placed on it by
 * their real latitude/longitude. Outside these bounds the drawn map is used instead.
 */
const SAMPLE_MAP = {
  source: require('../../assets/images/sample-map-nyc.jpg'),
  west: -74.1796875,
  east: -73.740234375,
  north: 40.84706035607122,
  south: 40.6473035625225,
};
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

function SampleImageMap({ pins, selectedId, onSelect, height = 210 }: Props) {
  const m = SAMPLE_MAP;
  const place = (p: LatLng) => ({
    left: `${((p.lng - m.west) / (m.east - m.west)) * 100}%` as const,
    top: `${((mercY(m.north) - mercY(p.lat)) / (mercY(m.north) - mercY(m.south))) * 100}%` as const,
  });
  return (
    <View style={[styles.frame, styles.drawn, { height }]} accessibilityLabel="Map of salons near you">
      <Image source={m.source} style={StyleSheet.absoluteFill} contentFit="fill" accessible={false} />
      {pins.map((p) => {
        const on = p.id === selectedId;
        return (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityLabel={`${p.name}, from ${p.label}`}
            accessibilityState={{ selected: on }}
            hitSlop={8}
            onPress={() => onSelect(p.id)}
            style={[styles.drawnPin, place(p.point), on && { zIndex: 2 }]}>
            <Pin label={p.label} on={on} />
          </Pressable>
        );
      })}
      <View style={styles.credit} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <AppText variant="label" color="muted" maxFontSizeMultiplier={1.2}>
          © OpenStreetMap
        </AppText>
      </View>
    </View>
  );
}

const insideSample = (pins: MapPin[]) =>
  pins.length > 0 &&
  pins.every((p) => p.point.lng > SAMPLE_MAP.west && p.point.lng < SAMPLE_MAP.east && p.point.lat < SAMPLE_MAP.north && p.point.lat > SAMPLE_MAP.south);

/** The design's drawn map (streets + a park), with pins placed by their real positions. */
function DrawnMap(props: Props) {
  if (insideSample(props.pins)) return <SampleImageMap {...props} />;
  return <PlainDrawnMap {...props} />;
}

function PlainDrawnMap({ pins, selectedId, onSelect, height = 210 }: Props) {
  const box = useMemo(() => {
    const lats = pins.map((p) => p.point.lat);
    const lngs = pins.map((p) => p.point.lng);
    return { minLat: Math.min(...lats), maxLat: Math.max(...lats), minLng: Math.min(...lngs), maxLng: Math.max(...lngs) };
  }, [pins]);
  // 12–82% across and 15–80% down keeps every pin fully inside the frame.
  const place = (p: LatLng) => {
    const x = box.maxLng === box.minLng ? 0.5 : (p.lng - box.minLng) / (box.maxLng - box.minLng);
    const y = box.maxLat === box.minLat ? 0.5 : (box.maxLat - p.lat) / (box.maxLat - box.minLat);
    return { left: `${12 + x * 70}%` as const, top: `${15 + y * 65}%` as const };
  };
  return (
    <View style={[styles.frame, styles.drawn, { height }]} accessibilityLabel="Map of salons near you">
      <View style={[styles.road, { top: '33%', height: 8, left: 0, right: 0 }]} />
      <View style={[styles.road, { top: '71%', height: 6, left: 0, right: 0 }]} />
      <View style={[styles.road, { left: '31%', width: 8, top: 0, bottom: 0 }]} />
      <View style={[styles.road, { left: '64%', width: 6, top: 0, bottom: 0 }]} />
      <View style={styles.park} />
      {pins.map((p) => {
        const on = p.id === selectedId;
        return (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityLabel={`${p.name}, from ${p.label}`}
            accessibilityState={{ selected: on }}
            hitSlop={8}
            onPress={() => onSelect(p.id)}
            style={[styles.drawnPin, place(p.point), on && { zIndex: 2 }]}>
            <Pin label={p.label} on={on} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.bigCard, overflow: 'hidden', backgroundColor: colors.placeholder },
  drawn: { backgroundColor: colors.mapLand },
  road: { position: 'absolute', backgroundColor: colors.mapRoad },
  park: { position: 'absolute', left: '36%', top: '43%', width: 96, height: 52, borderRadius: 8, backgroundColor: colors.mapPark },
  drawnPin: { position: 'absolute', transform: [{ translateX: -24 }, { translateY: -14 }] },
  credit: { position: 'absolute', left: 8, bottom: 6, backgroundColor: colors.bg, borderRadius: 6, paddingHorizontal: 6, opacity: 0.85 },
  pin: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: colors.ink,
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  pinOn: { backgroundColor: colors.gold, shadowOpacity: 0.2 },
  pinText: { fontFamily: fonts.semibold },
});
