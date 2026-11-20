import { createEventInCalendarAsync } from 'expo-calendar/legacy';
import { Alert } from 'react-native';

/**
 * "Add to calendar" (Booked.html): opens the phone's own new-event screen, filled in, so the person
 * checks it and taps Add. Hairday never reads their calendar (SPEC §12 asks only when tapped).
 */
export async function addToCalendar(e: { title: string; start: string; end: string; location?: string | null; notes?: string }) {
  try {
    await createEventInCalendarAsync({
      title: e.title,
      startDate: new Date(e.start),
      endDate: new Date(e.end),
      location: e.location ?? undefined,
      notes: e.notes,
      alarms: [{ relativeOffset: -60 }],
    });
  } catch {
    Alert.alert('Couldn’t open your calendar', 'Please add the appointment to your calendar yourself.');
  }
}

/** "Lisa's Salon, 555 Main St, New York, NY 10001" */
export function salonAddress(b: {
  name: string;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}) {
  return [b.name, b.address_line1, b.city, [b.state, b.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}
