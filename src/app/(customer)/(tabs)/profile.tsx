import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronRight, CircleHelp } from 'lucide-react-native';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Avatar, Button, ListGroup, ListRow } from '@/components';
import { useMyBusiness } from '@/hooks/useOwner';
import { useSession } from '@/hooks/useSession';
import { getDb, resetDemoData } from '@/lib/db';
import { links } from '@/lib/links';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors, space } from '@/theme';

// Profile (Profile.html). Favorites, payment methods, reminders and Delete account arrive in Phases 3, 5, 7 and 8.
export default function Profile() {
  const insets = useSafeAreaInsets();
  const { session, signOut, setMode } = useSession();
  const qc = useQueryClient();
  const email = session?.user.email;
  const signedIn = !!session;
  const demo = !isSupabaseConfigured;
  // Owners need an account; in demo mode (before Supabase exists) the phone stands in for one.
  const canOwn = signedIn || demo;
  const business = useMyBusiness();
  const hasBusiness = canOwn && !!business.data;

  const openBusiness = () => {
    if (!canOwn) return router.push({ pathname: '/(auth)/email', params: { intent: 'business' } });
    if (hasBusiness) {
      setMode('business');
      return router.replace('/(business)/(tabs)/business');
    }
    router.push('/(business)/setup');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}>
      <View style={styles.header}>
        <Avatar name={email ?? 'Guest'} size={64} />
        <View style={styles.flex1}>
          <AppText variant="cardTitle" style={styles.name} accessibilityRole="header">
            {signedIn ? 'Your profile' : 'Guest'}
          </AppText>
          <AppText variant="small" color="muted">
            {email ?? (demo ? 'Demo mode — sign-in isn’t connected yet' : 'Sign in to book and save favorites')}
          </AppText>
        </View>
      </View>

      <ListGroup>
        <ListRow label="Help & support" icon={<CircleHelp size={20} strokeWidth={1.8} color={colors.ink} />} onPress={() => Linking.openURL(links.support).catch(() => {})} />
      </ListGroup>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={hasBusiness ? `Switch to Business, ${business.data?.name}` : 'Own a salon? List your business and take bookings free.'}
        onPress={openBusiness}
        style={({ pressed }) => [styles.ownCard, pressed && { opacity: 0.9 }]}>
        <View style={styles.flex1}>
          <AppText variant="cardTitle" color="onDark" style={styles.ownTitle}>
            {hasBusiness ? 'Switch to Business' : 'Own a salon?'}
          </AppText>
          <AppText variant="caption" color="onDarkMuted">
            {hasBusiness ? `Manage ${business.data?.name}.` : 'List your business and take bookings free.'}
          </AppText>
        </View>
        <ChevronRight size={20} strokeWidth={1.8} color={colors.onDark} />
      </Pressable>

      {signedIn ? (
        <Button
          title="Sign out"
          variant="secondary"
          onPress={async () => {
            await signOut();
            qc.clear();
            router.replace('/(auth)/welcome');
          }}
        />
      ) : (
        <Button
          title="Sign in"
          onPress={async () => {
            await signOut(); // clears guest mode
            router.replace('/(auth)/welcome');
          }}
        />
      )}

      {demo && getDb().demo ? (
        <Pressable
          accessibilityRole="button"
          style={styles.link}
          onPress={() =>
            Alert.alert('Reset demo data?', 'Deletes the business you set up on this phone so you can start again.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Reset',
                style: 'destructive',
                onPress: async () => {
                  await resetDemoData();
                  qc.clear();
                },
              },
            ])
          }>
          <AppText variant="caption" color="muted" style={styles.underline}>
            Reset demo data
          </AppText>
        </Pressable>
      ) : null}

      <AppText variant="caption" color="muted" style={styles.center}>
        Favorites, payment methods, reminders and account deletion come in later phases.
      </AppText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.screen, paddingBottom: space.xxl * 2, gap: space.l },
  flex1: { flex: 1, gap: 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  name: { fontSize: 30, lineHeight: 32 },
  ownCard: { backgroundColor: colors.ink, borderRadius: 20, padding: space.l, flexDirection: 'row', alignItems: 'center', gap: 14 },
  ownTitle: { fontSize: 22, lineHeight: 24 },
  link: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
  center: { textAlign: 'center' },
});
