import { router } from 'expo-router';
import { ChevronRight, Plus, Users } from 'lucide-react-native';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Avatar, EmptyState, PillButton, ScreenHeader, Skeleton } from '@/components';
import { useMyBusiness, useTeam } from '@/hooks/useOwner';
import { roleLabel } from '@/lib/catalog';
import { colors, space } from '@/theme';

/** Team list: everyone at the salon. Tap to edit; "Add" opens Add professional (Team.html). */
export default function Team() {
  const insets = useSafeAreaInsets();
  const business = useMyBusiness();
  const team = useTeam(business.data?.id);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40 }]}
      refreshControl={<RefreshControl refreshing={team.isRefetching} onRefresh={() => void team.refetch()} tintColor={colors.muted} />}>
      <ScreenHeader
        title="Team"
        right={<PillButton title="Add" icon={<Plus size={16} strokeWidth={2} color={colors.white} />} accessibilityLabel="Add a professional" onPress={() => router.push('/(business)/team/new')} />}
      />
      {team.isPending ? (
        <View style={{ gap: space.s }}>
          <Skeleton height={70} />
          <Skeleton height={70} />
        </View>
      ) : !team.data?.length ? (
        <EmptyState
          icon={<Users size={28} strokeWidth={1.8} color={colors.goldText} />}
          title="Add your team"
          body="Add everyone who takes clients — including you. Clients pick who they book with."
          actionLabel="Add a professional"
          onAction={() => router.push('/(business)/team/new')}
        />
      ) : (
        team.data.map((p) => {
          const name = [p.first_name, p.last_name].filter(Boolean).join(' ');
          return (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityLabel={`${name}, ${roleLabel(p.role)}, ${p.serviceIds.length} services`}
              onPress={() => router.push({ pathname: '/(business)/team/[id]', params: { id: p.id } })}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}>
              <Avatar name={name} uri={p.avatar_url} size={44} />
              <View style={styles.flex1}>
                <AppText variant="bodyStrong">{name}</AppText>
                <AppText variant="caption" color="muted">
                  {roleLabel(p.role)} · {p.serviceIds.length} {p.serviceIds.length === 1 ? 'service' : 'services'}
                  {p.is_active ? '' : ' · Not taking bookings'}
                </AppText>
              </View>
              <ChevronRight size={18} strokeWidth={1.8} color={colors.muted} />
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.screen, gap: space.m },
  flex1: { flex: 1, gap: 2 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardLine, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: space.m },
});
