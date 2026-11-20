import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getSupabase, isSupabaseConfigured } from './supabase';

/**
 * Push notifications (SPEC §11). The phone's Expo push address is saved in push_tokens so the
 * send-notifications server function can reach it. Permission is asked only after the first
 * booking is confirmed (SPEC §12), never at launch.
 *
 * Needs an EAS project id (app.json → extra.eas.projectId, set by `eas init`) — until then this
 * quietly does nothing and people still get emails.
 */

// Shown even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

let current: string | null = null;

function projectId(): string | null {
  const id =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
  return id ?? null;
}

/** After the first booking: asks once (the phone remembers the answer), then saves the push address. */
export async function askForPushAfterBooking(): Promise<void> {
  if (!isSupabaseConfigured || !Device.isDevice || !projectId()) return;
  try {
    const now = await Notifications.getPermissionsAsync();
    if (now.status === 'undetermined') {
      const asked = await Notifications.requestPermissionsAsync();
      if (asked.status !== 'granted') return;
    } else if (now.status !== 'granted') return;
    await savePushToken();
  } catch {
    // Push is a nice-to-have; booking already worked.
  }
}

/** On app start when signed in: refresh the saved address if push is already allowed (tokens can change). */
export async function refreshPushToken(): Promise<void> {
  if (!isSupabaseConfigured || !Device.isDevice || !projectId()) return;
  try {
    if ((await Notifications.getPermissionsAsync()).status === 'granted') await savePushToken();
  } catch {
    // Try again next launch.
  }
}

async function savePushToken() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Bookings and reminders',
      // eslint-disable-next-line import/namespace -- exported through `export *`, which the lint rule can't follow
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: projectId()! });
  const sb = getSupabase();
  const { data: user } = await sb.auth.getUser();
  if (!user.user) return;
  await sb
    .from('push_tokens')
    .upsert(
      {
        profile_id: user.user.id,
        expo_token: token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id,expo_token' },
    );
  current = token;
}

/** Before signing out: this phone stops getting that person's notifications. */
export async function forgetPushToken(): Promise<void> {
  if (!isSupabaseConfigured || !current) return;
  try {
    await getSupabase().from('push_tokens').delete().eq('expo_token', current);
  } catch {
    // The token moves to whoever signs in next anyway (database trigger).
  }
  current = null;
}

/** The in-app screen a tapped notification should open, if it's one of ours. */
export function pathFromNotification(n: Notifications.Notification | null | undefined): string | null {
  const path = n?.request.content.data?.path;
  return typeof path === 'string' && path.startsWith('/') ? path : null;
}
