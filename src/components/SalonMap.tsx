import Constants from 'expo-constants';
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
        showsPointsOfInterests={false}
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

/** The design's drawn map (streets + a park), with pins placed by their real positions. */
function DrawnMap({ pins, selectedId, onSelect, height = 210 }: Props) {
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
