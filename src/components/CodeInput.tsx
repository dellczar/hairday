import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';

import { cleanCode, OTP_LENGTH } from '@/lib/otp';
import { colors, radius, type } from '@/theme';

import { AppText } from './AppText';

type Props = {
  value: string;
  onChange: (code: string) => void;
  error?: boolean;
};

export type CodeInputHandle = { focus: () => void };

/**
 * Six boxes backed by one hidden text field (Verify.html). One field means paste and the
 * iOS/Android one-time-code autofill fill all six boxes at once, and typing "auto-advances".
 */
export const CodeInput = forwardRef<CodeInputHandle, Props>(function CodeInput({ value, onChange, error }, ref) {
  const input = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);
  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }));

  const active = Math.min(value.length, OTP_LENGTH - 1);

  return (
    <Pressable onPress={() => input.current?.focus()} accessible={false}>
      <View style={styles.row} importantForAccessibility="no-hide-descendants">
        {Array.from({ length: OTP_LENGTH }, (_, i) => {
          const isActive = focused && i === active;
          return (
            <View key={i} style={[styles.box, isActive && styles.boxActive, error && styles.boxError]}>
              <AppText variant="digit">{value[i] ?? ''}</AppText>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={input}
        value={value}
        onChangeText={(t) => onChange(cleanCode(t))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        maxLength={OTP_LENGTH}
        autoFocus
        caretHidden
        accessibilityLabel="Verification code, 6 digits"
        accessibilityHint={value ? `${value.length} of 6 digits entered` : undefined}
        style={styles.hidden}
      />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  box: {
    flex: 1,
    height: 60,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderWidth: 2, borderColor: colors.gold },
  boxError: { borderColor: colors.danger },
  // Kept on screen (not display:none) so autofill and screen readers can reach it.
  hidden: { ...StyleSheet.absoluteFill, opacity: 0.011, color: 'transparent', ...type.digit },
});
