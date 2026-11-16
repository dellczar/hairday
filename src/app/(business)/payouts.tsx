import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { Check, ExternalLink } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, BackButton, Button, Headline, ListGroup, ListRow, Skeleton } from '@/components';
import { useMyBusiness } from '@/hooks/useOwner';
import { getDb } from '@/lib/db';
import { FREE_CANCEL_HOURS, LATE_CANCEL_SHARE } from '@/lib/payments';
import { colors, fonts, space } from '@/theme';

type Step = { title: string; sub: string; state: 'done' | 'current' | 'todo' };

/**
 * Payouts (Payouts.html, SPEC §9). "Continue to Stripe" opens Stripe Connect onboarding in a browser
 * sheet; Stripe collects ID and bank details, Hairday never sees them. When the owner comes back we ask
 * Stripe where setup stands. A salon goes live only once payouts are on.
 */
export default function Payouts() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const biz = useMyBusiness();
  const b = biz.data;
  const [opening, setOpening] = useState(false);

  const status = useQuery({
    queryKey: ['owner', 'payouts', b?.id],
    enabled: !!b,
    queryFn: () => getDb().payouts(b!.id, 'status'),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['owner'] });

  const onContinue = async () => {
    if (!b) return;
    setOpening(true);
    try {
      const r = await getDb().payouts(b.id, 'start');
      if (r.url) await WebBrowser.openAuthSessionAsync(r.url, 'hairday://payouts');
      await refresh();
    } catch (e) {
      Alert.alert('Couldn’t open Stripe', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setOpening(false);
    }
  };

  const s = status.data;
  const on = !!s?.payouts_enabled;
  const street = [b?.address_line1, b?.address_line2].filter(Boolean).join(', ');
  const steps: Step[] = [
    {
      title: 'Business details',
      sub: [b?.name, street].filter(Boolean).join(' · ') || 'From your business profile',
      state: 'done',
    },
    {
      title: 'Verify your identity',
      sub: on ? 'Done' : s?.started && !s.needs_more ? 'Stripe is checking your details' : 'About 5 minutes · handled by Stripe',
      state: on || (s?.started && !s.needs_more) ? 'done' : 'current',
    },
    {
      title: 'Add your bank account',
      sub: on ? 'Deposits are on' : 'Where your deposits go',
      state: on ? 'done' : s?.started ? 'current' : 'todo',
    },
  ];
  const schedule = s?.schedule ? s.schedule[0]!.toUpperCase() + s.schedule.slice(1) : 'Daily';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + space.xxl,
        },
      ]}>
      <View style={styles.header}>
        <BackButton />
        <AppText style={styles.title} accessibilityRole="header">
          Payouts
        </AppText>
      </View>

      <View style={styles.intro}>
        <Headline text="Get paid for" accent="every booking." style={styles.h1} />
        <AppText color="muted" style={styles.lead}>
          Deposits go straight to your bank. Stripe collects your ID and bank details securely — Hairday never stores them.
        </AppText>
      </View>

      {biz.isPending || status.isPending ? (
        <Skeleton height={200} />
      ) : (
        <View style={styles.steps}>
          {steps.map((st, i) => (
            <View
              key={st.title}
              style={[styles.step, i < steps.length - 1 && styles.stepLine]}
              accessible
              accessibilityLabel={`${st.title}. ${st.sub}. ${st.state === 'done' ? 'Done' : st.state === 'current' ? 'Next step' : 'Not started'}`}>
              <View
                style={[styles.dot, st.state === 'done' ? styles.dotDone : st.state === 'current' ? styles.dotCurrent : styles.dotTodo]}>
                {st.state === 'done' ? (
                  <Check size={16} strokeWidth={2.4} color={colors.onGold} />
                ) : (
                  <AppText style={styles.dotText} color={st.state === 'current' ? 'goldText' : 'muted'}>
                    {i + 1}
                  </AppText>
                )}
              </View>
              <View style={styles.flex1}>
                <AppText style={styles.stepTitle}>{st.title}</AppText>
                <AppText variant="caption" color="muted">
                  {st.sub}
                </AppText>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.cta}>
        <Button
          title={on ? 'Update details with Stripe' : 'Continue to Stripe'}
          variant={on ? 'secondary' : 'primary'}
          icon={<ExternalLink size={18} strokeWidth={1.8} color={on ? colors.ink : colors.white} />}
          onPress={onContinue}
          loading={opening}
          disabled={!b}
        />
        <AppText variant="caption" color="muted" style={styles.center}>
          {on ? 'Payouts are on. Clients can book and pay you.' : 'You’ll come back to Hairday when you’re done.'}
        </AppText>
      </View>

      <AppText style={styles.h2} accessibilityRole="header">
        Payout settings
      </AppText>
      <ListGroup>
        <ListRow label="Payout schedule" value={schedule} />
        <ListRow label="Late-cancel charge" value={`${LATE_CANCEL_SHARE * 100}% after ${FREE_CANCEL_HOURS} hr`} />
        <ListRow label="Deposit at booking" value="Off" />
      </ListGroup>
      <AppText variant="caption" color="muted">
        Clients’ cards are saved when they book and charged after the appointment. Cancelling less than {FREE_CANCEL_HOURS} hours ahead, or
        not showing up, costs them {LATE_CANCEL_SHARE * 100}% of the services.
      </AppText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.screen, gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  title: { flex: 1, fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22 },
  intro: { gap: 10 },
  h1: { fontSize: 38, lineHeight: 40 },
  lead: { fontSize: 15, lineHeight: 22 },
  steps: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardLine,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 64,
    paddingVertical: 8,
  },
  stepLine: { borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.gold },
  dotCurrent: { borderWidth: 2, borderColor: colors.gold },
  dotTodo: { borderWidth: 2, borderColor: colors.placeholder },
  dotText: { fontFamily: fonts.semibold, fontSize: 14 },
  flex1: { flex: 1, gap: 2 },
  stepTitle: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21 },
  cta: { gap: space.s },
  center: { textAlign: 'center' },
  h2: { fontFamily: fonts.semibold, fontSize: 15, marginTop: 6 },
});
