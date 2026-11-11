import BottomSheet, { BottomSheetBackdrop, BottomSheetView, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, space } from '@/theme';

type Props = {
  children: ReactNode;
  /** Snap points, e.g. ['50%'] — leave empty to size to content. */
  snapPoints?: (string | number)[];
  onClose?: () => void;
};

/**
 * Bottom sheet (filters, edit service, walk-in, cancel booking).
 * Starts closed; open with ref.current?.expand(), close with ref.current?.close().
 */
export const Sheet = forwardRef<BottomSheet, Props>(function Sheet({ children, snapPoints, onClose }, ref) {
  const insets = useSafeAreaInsets();
  const backdrop = useCallback(
    (p: BottomSheetBackdropProps) => <BottomSheetBackdrop {...p} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />,
    [],
  );
  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={snapPoints}
      enableDynamicSizing={!snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={backdrop}
      backgroundStyle={styles.bg}
      handleIndicatorStyle={styles.handle}>
      <BottomSheetView style={[styles.content, { paddingBottom: insets.bottom + space.xl }]}>{children}</BottomSheetView>
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  bg: { backgroundColor: colors.bg, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet },
  handle: { backgroundColor: colors.line, width: 40 },
  content: { paddingHorizontal: space.screen, gap: space.l },
});
