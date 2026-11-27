import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { Bell, ChevronRight, CircleHelp, FileText, Heart, Shield } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Avatar, Button, ListGroup, ListRow, ModalSheet, Toggle } from '@/components';
import { useFavoriteDetails } from '@/hooks/useDiscovery';
import { useNotifySettings, useSaveNotifySettings } from '@/hooks/useNotifySettings';
import { useMyBusiness } from '@/hooks/useOwner';
import { roleLabel } from '@/lib/catalog';
import { useSession } from '@/hooks/useSession';
import { getDb, resetDemoData } from '@/lib/db';
import { links } from '@/lib/links';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors, fonts, space } from '@/theme';

// Profile (Profile.html), with Privacy Policy, Terms and Delete account (SPEC §10, §13).
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
  const favorites = useFavoriteDetails();
  const favSalons = favorites.data?.salons ?? [];
  const favPros = favorites.data?.pros ?? [];
  const notify = useNotifySettings();
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const n = notify.data;
  const remindersLabel = !n
    ? ''
    : n.notify_push && n.notify_email
      ? 'Push and email'
      : n.notify_push
        ? 'Push only'
        : n.notify_email
          ? 'Email only'
          : 'Off';

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

      {canOwn ? (
        <View style={styles.section}>
          <AppText variant="smallStrong" accessibilityRole="header">
            Favorites
          </AppText>
          {favSalons.length || favPros.length ? (
            <ListGroup>
              {favSalons.map(({ business: b, photo }) => (
                <ListRow
                  key={b.id}
                  label={b.name}
                  sublabel={b.type ?? 'Salon'}
                  icon={
                    photo ? <Image source={{ uri: photo }} style={styles.favPhoto} contentFit="cover" /> : <View style={styles.favPhoto} />
                  }
                  onPress={() => router.push({ pathname: '/salon/[id]', params: { id: b.id } })}
                />
              ))}
              {favPros.map(({ pro: p, salonName }) => {
                const name = [p.first_name, p.last_name].filter(Boolean).join(' ');
                return (
                  <ListRow
                    key={p.id}
                    label={name}
                    sublabel={[roleLabel(p.role), salonName].filter(Boolean).join(' · ')}
                    icon={<Avatar name={name} uri={p.avatar_url} size={44} tone="photo" />}
                    onPress={() => router.push({ pathname: '/pro/[id]', params: { id: p.id } })}
                  />
                );
              })}
            </ListGroup>
          ) : (
            <View style={styles.favEmpty}>
              <Heart size={18} strokeWidth={1.8} color={colors.goldText} />
              <AppText variant="caption" color="inkSoft" style={styles.flexText}>
                Tap the heart on a salon or professional to save them here.
              </AppText>
            </View>
          )}
        </View>
      ) : null}

      <ListGroup>
        {canOwn ? (
          <ListRow
            label="Reminders"
            sublabel={remindersLabel}
            icon={<Bell size={20} strokeWidth={1.8} color={colors.ink} />}
            onPress={() => setRemindersOpen(true)}
          />
        ) : null}
        <ListRow
          label="Help & support"
          icon={<CircleHelp size={20} strokeWidth={1.8} color={colors.ink} />}
          onPress={() => Linking.openURL(links.support).catch(() => {})}
        />
        <ListRow
          label="Privacy Policy"
          icon={<Shield size={20} strokeWidth={1.8} color={colors.ink} />}
          onPress={() => WebBrowser.openBrowserAsync(links.privacy).catch(() => {})}
        />
        <ListRow
          label="Terms"
          icon={<FileText size={20} strokeWidth={1.8} color={colors.ink} />}
          onPress={() => WebBrowser.openBrowserAsync(links.terms).catch(() => {})}
        />
      </ListGroup>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          hasBusiness ? `Switch to Business, ${business.data?.name}` : 'Own a salon? List your business and take bookings free.'
        }
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
            Alert.alert(
              'Reset demo data?',
              'Deletes the business and favorites you saved on this phone so you can start again. The sample salons stay.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Reset',
                  style: 'destructive',
                  onPress: async () => {
                    await resetDemoData();
                    qc.clear();
                  },
                },
              ],
            )
          }>
          <AppText variant="caption" color="muted" style={styles.underline}>
            Reset demo data
          </AppText>
        </Pressable>
      ) : null}

      {signedIn ? (
        <Pressable accessibilityRole="button" style={styles.link} onPress={() => setDeleteOpen(true)}>
          <AppText variant="caption" color="muted" style={styles.underline}>
            Delete account
          </AppText>
        </Pressable>
      ) : null}
      <RemindersSheet visible={remindersOpen} onClose={() => setRemindersOpen(false)} />
      <DeleteAccountSheet
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        hasBusiness={hasBusiness}
        onDeleted={async () => {
          setDeleteOpen(false);
          await signOut();
          qc.clear();
          router.replace('/(auth)/welcome');
          Alert.alert('Account deleted', 'Your Hairday account and its information have been deleted.');
        }}
      />
    </ScrollView>
  );
}

/** Profile → Reminders: booking confirmations, reminders and review requests, by push and email. */
function RemindersSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const q = useNotifySettings();
  const save = useSaveNotifySettings();
  const n = q.data;
  return (
    <ModalSheet visible={visible} onClose={onClose} title="Reminders">
      <AppText color="inkSoft" style={styles.sheetText}>
        Booking confirmations, reminders 24 hours and 2 hours before, and changes to your appointments.
      </AppText>
      <ListGroup>
        <ListRow
          label="Push notifications"
          sublabel="On this phone"
          right={
            <Toggle accessibilityLabel="Push notifications" value={!!n?.notify_push} onChange={(v) => save.mutate({ notify_push: v })} />
          }
        />
        <ListRow
          label="Email"
          sublabel="To the address you sign in with"
          right={<Toggle accessibilityLabel="Email" value={!!n?.notify_email} onChange={(v) => save.mutate({ notify_email: v })} />}
        />
      </ListGroup>
    </ModalSheet>
  );
}

/** Profile → Delete account: says what goes, "Keep my account" first, then the server does it. */
function DeleteAccountSheet({
  visible,
  onClose,
  hasBusiness,
  onDeleted,
}: {
  visible: boolean;
  onClose: () => void;
  hasBusiness: boolean;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const onYes = async () => {
    setBusy(true);
    try {
      await getDb().deleteAccount();
      onDeleted();
    } catch (e) {
      Alert.alert('Couldn’t delete your account', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      title="Delete your account?"
      footer={
        <View style={styles.sheetButtons}>
          <Button title="Keep my account" onPress={onClose} disabled={busy} />
          <Pressable
            onPress={onYes}
            disabled={busy}
            accessibilityRole="button"
            accessibilityState={{ busy }}
            style={({ pressed }) => [styles.yes, pressed && { opacity: 0.7 }]}>
            <AppText style={styles.actionText} color="goldText">
              {busy ? 'Deleting…' : 'Yes, delete my account'}
            </AppText>
          </Pressable>
        </View>
      }>
      <AppText color="inkSoft" style={styles.sheetText}>
        This permanently deletes your profile, favorites, reviews, saved cards and notification settings.
        {hasBusiness ? ' Your salon’s listing, services, team, photos and booking history are deleted too.' : ''} It can’t be
        undone.
      </AppText>
      <AppText color="inkSoft" style={styles.sheetText}>
        Upcoming bookings need to be cancelled first. Records of past payments are kept without your name, as the law requires.
      </AppText>
    </ModalSheet>
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
  section: { gap: space.s },
  favPhoto: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.placeholder },
  favEmpty: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.tint, borderRadius: 16, padding: 14 },
  flexText: { flex: 1 },
  sheetText: { fontSize: 15, lineHeight: 22 },
  sheetButtons: { gap: space.s },
  yes: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontFamily: fonts.semibold, fontSize: 14 },
});
