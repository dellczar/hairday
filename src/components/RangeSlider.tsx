import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';

import { colors, touch } from '@/theme';

type Props = {
  min: number;
  max: number;
  step: number;
  low: number;
  high: number;
  onChange: (low: number, high: number) => void;
  /** How a value is read aloud, e.g. 20 → "$20". */
  format: (v: number) => string;
  label: string;
};

const THUMB = 28;

/** Two-thumb price slider (Filters.html). Drag either thumb; screen readers swipe up/down to adjust. */
export function RangeSlider({ min, max, step, low, high, onChange, format, label }: Props) {
  const [width, setWidth] = useState(0);
  const toX = (v: number) => ((v - min) / (max - min)) * width;
  const toValue = (x: number) => {
    const ratio = Math.min(1, Math.max(0, x / Math.max(1, width)));
    return Math.round((min + ratio * (max - min)) / step) * step;
  };
  const setLow = (v: number) => onChange(Math.min(Math.max(min, v), high - step), high);
  const setHigh = (v: number) => onChange(low, Math.max(Math.min(max, v), low + step));

  return (
    <View style={styles.wrap} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width - THUMB)}>
      <View style={styles.inner}>
        <View style={styles.track} />
        {width > 0 ? (
          <>
            <View style={[styles.fill, { left: toX(low), width: Math.max(0, toX(high) - toX(low)) }]} />
            <Thumb x={toX(low)} value={low} step={step} name={`${label}, lowest`} format={format} toValue={toValue} onValue={setLow} />
            <Thumb x={toX(high)} value={high} step={step} name={`${label}, highest`} format={format} toValue={toValue} onValue={setHigh} />
          </>
        ) : null}
      </View>
    </View>
  );
}

type ThumbProps = {
  x: number;
  value: number;
  step: number;
  name: string;
  format: (v: number) => string;
  toValue: (x: number) => number;
  onValue: (v: number) => void;
};

function Thumb({ x, value, step, name, format, toValue, onValue }: ThumbProps) {
  const startX = useRef(0);
  const last = useRef(value);
  const pan = usePanGesture({
    runOnJS: true,
    minDistance: 1,
    onBegin: () => {
      startX.current = x;
      last.current = value;
    },
    onUpdate: (e) => {
      const v = toValue(startX.current + e.translationX);
      if (v !== last.current) {
        last.current = v;
        Haptics.selectionAsync().catch(() => {});
        onValue(v);
      }
    },
  });
  return (
    <GestureDetector gesture={pan}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={name}
        accessibilityValue={{ text: format(value) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => onValue(value + (e.nativeEvent.actionName === 'increment' ? step : -step))}
        hitSlop={8}
        style={[styles.thumbHit, { left: x - touch / 2 }]}>
        <View style={styles.thumb} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  // The thumbs' centers travel from THUMB/2 to width − THUMB/2, so they never hang off the edge.
  wrap: { height: touch, justifyContent: 'center' },
  inner: { marginHorizontal: THUMB / 2, height: touch, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.line },
  fill: { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: colors.gold, top: (touch - 4) / 2 },
  thumbHit: { position: 'absolute', top: 0, width: touch, height: touch, alignItems: 'center', justifyContent: 'center' },
  thumb: { width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.placeholder },
});
