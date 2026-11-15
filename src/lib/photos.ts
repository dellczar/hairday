import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

/**
 * Lets the owner add a photo: asks "Take photo" or "Choose from library", asks for the matching
 * permission only at that moment (SPEC §12), then shrinks the photo so uploads stay small.
 * Resolves to a local file URI, or null if they cancel.
 */
export function pickPhoto(opts: { square?: boolean; title?: string } = {}): Promise<string | null> {
  return new Promise((resolve) => {
    Alert.alert(opts.title ?? 'Add a photo', undefined, [
      { text: 'Take photo', onPress: () => fromCamera(opts.square).then(resolve, () => resolve(null)) },
      { text: 'Choose from library', onPress: () => fromLibrary(opts.square).then(resolve, () => resolve(null)) },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
    ], { cancelable: true, onDismiss: () => resolve(null) });
  });
}

async function fromLibrary(square?: boolean): Promise<string | null> {
  // The system photo picker (iOS 14+, Android 13+) needs no permission: the owner only shares what they pick.
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: !!square, aspect: square ? [1, 1] : undefined, quality: 1 });
  return res.canceled || !res.assets[0] ? null : shrink(res.assets[0].uri, res.assets[0].width);
}

async function fromCamera(square?: boolean): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    explainDenied();
    return null;
  }
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: !!square, aspect: square ? [1, 1] : undefined, quality: 1 });
  return res.canceled || !res.assets[0] ? null : shrink(res.assets[0].uri, res.assets[0].width);
}

const MAX_WIDTH = 1600;

async function shrink(uri: string, width: number): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  if (width > MAX_WIDTH) ctx.resize({ width: MAX_WIDTH });
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return saved.uri;
}

function explainDenied() {
  Alert.alert(
    'Allow camera access',
    'To take a picture, let Hairday use the camera in Settings.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) },
    ],
  );
}
