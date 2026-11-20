import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { pathFromNotification, refreshPushToken } from '@/lib/push';

import { useSession } from './useSession';

/**
 * Tapping a notification opens the booking it's about (SPEC §11): My bookings, the review screen, or
 * the owner's calendar (switching to Business mode first). Also keeps this phone's push address fresh.
 */
export function useNotificationTaps() {
  const { session, setMode } = useSession();
  const last = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);
  const userId = session?.user.id;

  useEffect(() => {
    if (userId) void refreshPushToken();
  }, [userId]);

  useEffect(() => {
    if (!userId || !last || last.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = last.notification.request.identifier;
    const path = pathFromNotification(last.notification);
    if (!path || handled.current === id) return;
    handled.current = id;
    const owner = last.notification.request.content.data?.audience === 'owner';
    setMode(owner ? 'business' : 'customer');
    // Let the mode switch settle before opening the screen.
    setTimeout(() => router.push(path as never), 0);
  }, [last, userId, setMode]);
}
