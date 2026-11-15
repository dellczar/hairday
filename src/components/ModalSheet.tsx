import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, space } from '@/theme';

import { AppText } from './AppText';
import { IconButton } from './IconButton';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Pinned under the scrolling content (usually the Save button). */
  footer?: ReactNode;
};

/**
 * Bottom sheet for forms (edit service, add break, time off, pick a time).
 * Uses the system Modal so the keyboard pushes the fields up on both platforms.
 * Look from Services.html: ivory panel, 28 pt top corners, handle, serif title, close button.
 */
export function ModalSheet({ visible, onClose, title, children, footer }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <Animated.View entering={SlideInDown.duration(260)} style={[styles.panel, { paddingBottom: insets.bottom + space.l }]} accessibilityViewIsModal>
          <View style={styles.handle} />
          <View style={styles.header}>
            <AppText variant="cardTitle" accessibilityRole="header" style={styles.title} numberOfLines={2}>
              {title}
            </AppText>
            <IconButton accessibilityLabel="Close" onPress={onClose} bare>
              <X size={20} strokeWidth={1.8} color={colors.ink} />
            </IconButton>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.content} bounces={false}>
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.inkGlass },
  panel: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: 10,
    paddingHorizontal: space.screen,
    maxHeight: '90%',
  },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.placeholder, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.s },
  title: { flex: 1, fontSize: 28, lineHeight: 32 },
  content: { gap: space.l, paddingTop: space.m, paddingBottom: space.l },
  footer: { paddingTop: space.s },
});
