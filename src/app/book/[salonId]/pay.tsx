import { useStripe } from "@stripe/stripe-react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import {
  CalendarDays,
  Clock,
  ShieldCheck,
  Timer,
  UserRound,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppText,
  BackButton,
  Button,
  EmptyState,
  Skeleton,
} from "@/components";
import {
  useConfirmBooking,
  useHeldBooking,
  useReleaseHold,
} from "@/hooks/useBooking";
import { HOLD_MINUTES } from "@/lib/availability";
import { formatDuration, formatTime, zonedClock } from "@/lib/hours";
import { formatPrice } from "@/lib/money";
import { bookingTotals, DEFAULT_TIP, TIP_CHOICES } from "@/lib/payments";
import { STRIPE_RETURN_URL } from "@/lib/stripe";
import { colors, fonts, radius, space } from "@/theme";

/**
 * Review & pay (Confirm.html). The time is held for 10 minutes. "Confirm booking" saves the card with
 * Stripe's PaymentSheet (card, Apple Pay, Google Pay); it's charged after the appointment
 * (Open question 2). No booking fee for now (Open question 1), so that line is left out.
 */
export default function ReviewAndPay() {
  const { salonId, booking: bookingId } = useLocalSearchParams<{
    salonId: string;
    booking: string;
  }>();
  const insets = useSafeAreaInsets();
  const q = useHeldBooking(bookingId);
  const release = useReleaseHold();
  const confirm = useConfirmBooking();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [tip, setTip] = useState<number>(DEFAULT_TIP);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (q.isPending) {
    return (
      <View
        style={[
          styles.screen,
          styles.pad,
          { paddingTop: insets.top + 8, gap: space.l },
        ]}
      >
        <Skeleton height={44} width={44} rounded={22} />
        <Skeleton height={190} />
        <Skeleton height={150} />
      </View>
    );
  }
  const d = q.data;
  if (!d) {
    return (
      <View style={[styles.screen, styles.pad, { paddingTop: insets.top + 8 }]}>
        <BackButton />
        <EmptyState
          title="Booking not found"
          body="Go back and pick a time again."
        />
      </View>
    );
  }

  const { booking, business, pro, items, photo } = d;
  const tz = business?.time_zone ?? "America/New_York";
  const expiresAt =
    new Date(booking.created_at).getTime() + HOLD_MINUTES * 60_000;
  const left = Math.max(0, expiresAt - now);
  const expired = booking.status !== "pending_payment" || left === 0;
  const mm = Math.floor(left / 60_000);
  const ss = Math.floor((left % 60_000) / 1000);
  const start = new Date(booking.starts_at);
  const dateLabel = start.toLocaleDateString("en-US", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const minutes = items.reduce((s, i) => s + i.duration_min, 0);
  const totals = bookingTotals(booking.subtotal_cents, tip);
  const proName = pro?.first_name ?? "your stylist";
  const street = [business?.address_line1, business?.address_line2]
    .filter(Boolean)
    .join(", ");

  const pickAgain = () =>
    router.canGoBack() ? router.back() : router.replace("/");
  const letGo = () =>
    Alert.alert(
      "Let go of this time?",
      "Someone else will be able to book it.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Let go",
          style: "destructive",
          onPress: async () => {
            try {
              await release.mutateAsync(booking.id);
            } catch {
              // Nothing to undo: the hold runs out on its own in a few minutes.
            }
            pickAgain();
          },
        },
      ],
    );

  const onConfirm = async () => {
    try {
      const done = await confirm.mutateAsync({
        bookingId: booking.id,
        tipPercent: tip,
        presentSheet: async (setup) => {
          const init = await initPaymentSheet({
            merchantDisplayName: "Hairday",
            customerId: setup.customerId,
            customerEphemeralKeySecret: setup.ephemeralKey,
            setupIntentClientSecret: setup.setupIntentClientSecret,
            applePay: { merchantCountryCode: "US" },
            googlePay: { merchantCountryCode: "US", testEnv: true },
            returnURL: STRIPE_RETURN_URL,
            primaryButtonLabel: "Save card",
          });
          if (init.error) throw new Error(init.error.message);
          const shown = await presentPaymentSheet();
          if (shown.error) {
            if (shown.error.code === "Canceled") return false;
            throw new Error(shown.error.message);
          }
          return true;
        },
      });
      if (done)
        router.replace({
          pathname: "/book/[salonId]/booked",
          params: { salonId, booking: booking.id },
        });
    } catch (e) {
      Alert.alert(
        "Couldn’t confirm",
        e instanceof Error ? e.message : "Please try again.",
      );
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.pad,
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 110 },
        ]}
      >
        <View style={styles.header}>
          <BackButton onPress={pickAgain} />
          <AppText style={styles.title} accessibilityRole="header">
            Review & pay
          </AppText>
        </View>

        <View
          style={[styles.timer, expired && styles.timerOut]}
          accessibilityLiveRegion="polite"
        >
          <Timer
            size={18}
            strokeWidth={1.8}
            color={expired ? colors.danger : colors.goldText}
          />
          <AppText
            variant="small"
            color={expired ? "danger" : "inkSoft"}
            style={styles.flex1}
            accessibilityLabel={
              expired
                ? "Your hold ran out"
                : `Time held for ${mm} minutes ${ss} seconds`
            }
          >
            {expired
              ? "Your hold ran out, so the time was let go."
              : `We’re holding this time for ${mm}:${String(ss).padStart(2, "0")}.`}
          </AppText>
        </View>

        <View style={styles.card}>
          <View style={styles.salonRow}>
            <Image
              source={photo ? { uri: photo } : undefined}
              style={styles.thumb}
              contentFit="cover"
              accessibilityRole="image"
              accessibilityLabel="Salon photo"
            />
            <View style={styles.flex1}>
              <AppText
                variant="cardTitle"
                style={styles.salon}
                numberOfLines={2}
              >
                {business?.name ?? "Salon"}
              </AppText>
              {street ? (
                <AppText variant="small" color="muted" numberOfLines={1}>
                  {street}
                </AppText>
              ) : null}
            </View>
          </View>
          <View style={styles.divider} />
          <Detail
            icon={
              <CalendarDays size={20} strokeWidth={1.8} color={colors.muted} />
            }
          >
            {dateLabel} · {formatTime(zonedClock(start, tz).minutes)}
          </Detail>
          <Detail
            icon={<Clock size={20} strokeWidth={1.8} color={colors.muted} />}
          >
            {items.map((i) => i.name).join(", ")} · {formatDuration(minutes)}
          </Detail>
          {pro ? (
            <Detail
              icon={
                <UserRound size={20} strokeWidth={1.8} color={colors.muted} />
              }
            >
              {[pro.first_name, pro.last_name].filter(Boolean).join(" ")},{" "}
              {pro.role}
            </Detail>
          ) : null}
        </View>

        <View style={[styles.card, styles.prices]}>
          {items.map((i) => (
            <Line
              key={i.service_id}
              label={i.name}
              value={formatPrice(i.price_cents)}
            />
          ))}
          <Line label="Tip" value={formatPrice(totals.tip)} muted />
          <View style={styles.divider} />
          <View style={styles.line}>
            <AppText style={[styles.flex1, styles.total]}>Total</AppText>
            <AppText style={styles.total}>{formatPrice(totals.total)}</AppText>
          </View>
        </View>

        <View style={styles.tips}>
          <AppText style={styles.semibold}>Add a tip for {proName}</AppText>
          <View style={styles.tipRow} accessibilityRole="radiogroup">
            {TIP_CHOICES.map((p) => {
              const on = tip === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => setTip(p)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on, checked: on }}
                  accessibilityLabel={
                    p
                      ? `${p} percent tip, ${formatPrice(bookingTotals(booking.subtotal_cents, p).tip)}`
                      : "No tip"
                  }
                  style={[styles.tip, on && styles.tipOn]}
                >
                  <AppText
                    style={styles.semibold}
                    color={on ? "white" : "ink"}
                    maxFontSizeMultiplier={1.4}
                  >
                    {p ? `${p}%` : "None"}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.note}>
          <ShieldCheck size={20} strokeWidth={1.8} color={colors.inkSoft} />
          <AppText variant="small" color="inkSoft" style={styles.flex1}>
            You won’t be charged now. We save your card and charge it after your
            appointment. Free cancellation up to 24 hours before. After that,
            50% is charged.
          </AppText>
        </View>

        {!expired ? (
          <Button
            title="Let go of this time"
            variant="secondary"
            onPress={letGo}
            loading={release.isPending}
          />
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        {expired ? (
          <Button title="Pick another time" onPress={pickAgain} />
        ) : (
          <Button
            title="Confirm booking"
            variant="gold"
            onPress={onConfirm}
            loading={confirm.isPending}
          />
        )}
      </View>
    </View>
  );
}

function Detail({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.detail}>
      {icon}
      <AppText variant="small" style={styles.flex1}>
        {children}
      </AppText>
    </View>
  );
}

function Line({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <View style={styles.line}>
      <AppText
        variant="small"
        color={muted ? "muted" : "ink"}
        style={styles.flex1}
      >
        {label}
      </AppText>
      <AppText variant="small" color={muted ? "muted" : "ink"}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  pad: { paddingHorizontal: space.screen },
  content: { gap: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: space.m },
  title: { flex: 1, fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22 },
  timer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.tint,
    borderRadius: radius.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  timerOut: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  flex1: { flex: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.bigCard,
    borderWidth: 1,
    borderColor: colors.cardLine,
    padding: 16,
    gap: 14,
  },
  prices: { gap: 10 },
  salonRow: { flexDirection: "row", alignItems: "center", gap: space.m },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.tile6,
  },
  salon: { fontSize: 24, lineHeight: 26 },
  detail: { flexDirection: "row", alignItems: "center", gap: space.m },
  divider: { height: 1, backgroundColor: colors.lineSoft },
  line: { flexDirection: "row", alignItems: "center", gap: space.m },
  total: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  semibold: { fontFamily: fonts.semibold, fontSize: 14 },
  tips: { gap: space.s },
  tipRow: { flexDirection: "row", gap: space.s },
  tip: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  tipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  note: {
    flexDirection: "row",
    gap: space.m,
    backgroundColor: colors.tint,
    borderRadius: radius.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.screen,
    paddingTop: 14,
    backgroundColor: colors.bg,
  },
});
