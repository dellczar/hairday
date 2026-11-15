import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { ChevronDown, ChevronRight, ChevronUp, Plus, Scissors } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Chip, EmptyState, IconButton, Input, ModalSheet, PillButton, ScreenHeader, Skeleton, Stepper, Toggle } from '@/components';
import { useCategories, useMyBusiness, useOwnerAction, useServices, useTeam } from '@/hooks/useOwner';
import { CATEGORIES, defaultCategoryFor, SERVICE_CATALOG, type CatalogItem } from '@/lib/catalog';
import { clampDuration, formatDuration } from '@/lib/hours';
import { formatPrice, parsePrice, priceError } from '@/lib/money';
import { deleteService, reorderServices, saveService } from '@/lib/owner';
import type { Category, Service } from '@/lib/types';
import { colors, fonts, space } from '@/theme';

type Draft = { id?: string; category_id: string | null; name: string; price: string; duration: number; description: string; visible: boolean };

/** Services (Services.html): grouped by category, add from catalog, edit sheet, reorder. */
export default function Services() {
  const insets = useSafeAreaInsets();
  const business = useMyBusiness();
  const b = business.data;
  const services = useServices(b?.id);
  const categories = useCategories();
  const team = useTeam(b?.id);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [reordering, setReordering] = useState(false);

  const reorder = useOwnerAction(reorderServices);

  const catById = useMemo(() => new Map((categories.data ?? []).map((c) => [c.id, c])), [categories.data]);
  const groups = useMemo(() => {
    const out: { key: string; title: string; items: Service[] }[] = [];
    for (const s of services.data ?? []) {
      const cat = s.category_id ? catById.get(s.category_id) : undefined;
      const key = cat?.id ?? 'other';
      let g = out.find((x) => x.key === key);
      if (!g) out.push((g = { key, title: (cat?.name ?? 'Other').toUpperCase(), items: [] }));
      g.items.push(s);
    }
    return out;
  }, [services.data, catById]);

  const prosFor = (serviceId: string) => (team.data ?? []).filter((p) => p.serviceIds.includes(serviceId));
  const whoText = (serviceId: string) => {
    const pros = prosFor(serviceId);
    if (!pros.length) return 'No one yet';
    if (pros.length === 1) return pros[0]!.first_name;
    return `${pros.length} pros`;
  };

  const move = (group: Service[], index: number, dir: -1 | 1) => {
    const all = [...(services.data ?? [])];
    const a = group[index];
    const c = group[index + dir];
    if (!a || !c) return;
    const ia = all.findIndex((s) => s.id === a.id);
    const ic = all.findIndex((s) => s.id === c.id);
    [all[ia], all[ic]] = [all[ic]!, all[ia]!];
    Haptics.selectionAsync().catch(() => {});
    reorder.mutateAsync(all.map((s) => s.id)).catch(() => Alert.alert('Couldn’t save the new order', 'Try again.'));
  };

  const loading = !b || services.isPending;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40 }]}
        refreshControl={<RefreshControl refreshing={services.isRefetching} onRefresh={() => void services.refetch()} tintColor={colors.muted} />}>
        <ScreenHeader
          title="Services"
          right={
            reordering ? (
              <PillButton title="Done" variant="secondary" onPress={() => setReordering(false)} />
            ) : (
              <PillButton title="Add" icon={<Plus size={16} strokeWidth={2} color={colors.white} />} onPress={() => setCatalogOpen(true)} accessibilityLabel="Add a service" />
            )
          }
        />

        {loading ? (
          <View style={{ gap: space.s }}>
            <Skeleton height={18} width={120} />
            <Skeleton height={72} />
            <Skeleton height={72} />
            <Skeleton height={72} />
          </View>
        ) : !groups.length ? (
          <EmptyState
            icon={<Scissors size={28} strokeWidth={1.8} color={colors.goldText} />}
            title="Add your first service"
            body="Pick from common services and set your own price and time."
            actionLabel="Add a service"
            onAction={() => setCatalogOpen(true)}
          />
        ) : (
          <>
            {groups.map((g) => (
              <View key={g.key} style={styles.group}>
                <AppText variant="label" color="muted" style={styles.section} accessibilityRole="header">
                  {g.title} · {g.items.length}
                </AppText>
                {g.items.map((s, i) => (
                  <View key={s.id} style={styles.cardRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${s.name}, ${formatPrice(s.price_cents)}, ${formatDuration(s.duration_min)}${s.is_visible ? '' : ', hidden'}`}
                      accessibilityHint="Edit this service"
                      disabled={reordering}
                      onPress={() =>
                        setDraft({
                          id: s.id,
                          category_id: s.category_id,
                          name: s.name,
                          price: (s.price_cents / 100).toString(),
                          duration: s.duration_min,
                          description: s.description ?? '',
                          visible: s.is_visible,
                        })
                      }
                      style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}>
                      <View style={styles.flex1}>
                        <AppText variant="bodyStrong">{s.name}</AppText>
                        <AppText variant="caption" color="muted">
                          {formatDuration(s.duration_min)} · {whoText(s.id)}
                          {s.is_visible ? '' : ' · Hidden'}
                        </AppText>
                      </View>
                      <AppText variant="bodyStrong">{formatPrice(s.price_cents)}</AppText>
                      {!reordering ? <ChevronRight size={18} strokeWidth={1.8} color={colors.muted} /> : null}
                    </Pressable>
                    {reordering ? (
                      <View style={styles.arrows}>
                        <IconButton accessibilityLabel={`Move ${s.name} up`} disabled={i === 0} onPress={() => move(g.items, i, -1)}>
                          <ChevronUp size={18} strokeWidth={1.8} color={i === 0 ? colors.placeholder : colors.ink} />
                        </IconButton>
                        <IconButton accessibilityLabel={`Move ${s.name} down`} disabled={i === g.items.length - 1} onPress={() => move(g.items, i, 1)}>
                          <ChevronDown size={18} strokeWidth={1.8} color={i === g.items.length - 1 ? colors.placeholder : colors.ink} />
                        </IconButton>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            ))}
            {!reordering && (services.data?.length ?? 0) > 1 ? (
              <Pressable accessibilityRole="button" onPress={() => setReordering(true)} style={styles.link}>
                <AppText variant="smallStrong" style={styles.underline}>
                  Change the order
                </AppText>
              </Pressable>
            ) : null}
            {!team.data?.length ? (
              <View style={styles.notice}>
                <AppText variant="caption" color="inkSoft">
                  Next, add your team so clients can pick who does their service.
                </AppText>
                <PillButton title="Add your team" variant="secondary" onPress={() => router.push('/(business)/team/new')} />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <CatalogSheet
        visible={catalogOpen}
        startSlug={defaultCategoryFor(b?.type ?? null)}
        categories={categories.data ?? []}
        existing={services.data ?? []}
        onClose={() => setCatalogOpen(false)}
        onPick={(item, cat) => {
          setCatalogOpen(false);
          setDraft({
            category_id: cat?.id ?? null,
            name: item?.name ?? '',
            price: item ? (item.price_cents / 100).toString() : '',
            duration: item?.duration_min ?? 30,
            description: '',
            visible: true,
          });
        }}
      />

      {b ? <EditSheet draft={draft} businessId={b.id} nextOrder={services.data?.length ?? 0} categories={categories.data ?? []} onClose={() => setDraft(null)} /> : null}
    </View>
  );
}

function CatalogSheet({
  visible,
  startSlug,
  categories,
  existing,
  onClose,
  onPick,
}: {
  visible: boolean;
  startSlug: string;
  categories: Category[];
  existing: Service[];
  onClose: () => void;
  onPick: (item: CatalogItem | null, category: Category | undefined) => void;
}) {
  const [slug, setSlug] = useState<string | null>(null);
  const current = slug ?? startSlug;
  const cat = categories.find((c) => c.slug === current);
  const items = SERVICE_CATALOG[current] ?? [];
  const have = new Set(existing.map((s) => s.name.toLowerCase()));
  return (
    <ModalSheet visible={visible} onClose={onClose} title="Add a service">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catChips}>
        {CATEGORIES.map((c) => (
          <Chip key={c.slug} label={c.name} selected={c.slug === current} onPress={() => setSlug(c.slug)} />
        ))}
      </ScrollView>
      <View style={styles.list}>
        {items.map((item) => {
          const added = have.has(item.name.toLowerCase());
          return (
            <Pressable
              key={item.name}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${formatDuration(item.duration_min)}, about ${formatPrice(item.price_cents)}${added ? ', already added' : ''}`}
              onPress={() => onPick(item, cat)}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}>
              <View style={styles.flex1}>
                <AppText variant="bodyStrong">{item.name}</AppText>
                <AppText variant="caption" color="muted">
                  {formatDuration(item.duration_min)} · usually {formatPrice(item.price_cents)}
                  {added ? ' · Added' : ''}
                </AppText>
              </View>
              <Plus size={18} strokeWidth={1.8} color={colors.ink} />
            </Pressable>
          );
        })}
        <Pressable accessibilityRole="button" onPress={() => onPick(null, cat)} style={styles.custom}>
          <Plus size={18} strokeWidth={1.8} color={colors.ink} />
          <AppText variant="smallStrong">Create your own {cat?.name.toLowerCase() ?? ''} service</AppText>
        </Pressable>
      </View>
    </ModalSheet>
  );
}

function EditSheet({
  draft,
  businessId,
  nextOrder,
  categories,
  onClose,
}: {
  draft: Draft | null;
  businessId: string;
  nextOrder: number;
  categories: Category[];
  onClose: () => void;
}) {
  // Keyed by the draft so the fields reset each time the sheet opens.
  return draft ? <EditForm key={draft.id ?? `new-${draft.name}`} draft={draft} businessId={businessId} nextOrder={nextOrder} categories={categories} onClose={onClose} /> : null;
}

function EditForm({ draft, businessId, nextOrder, categories, onClose }: { draft: Draft; businessId: string; nextOrder: number; categories: Category[]; onClose: () => void }) {
  const [d, setD] = useState(draft);
  const [errors, setErrors] = useState<{ name?: string; price?: string }>({});
  const save = useOwnerAction((input: Parameters<typeof saveService>[0]) => saveService(input, nextOrder));
  const remove = useOwnerAction(deleteService);
  const catName = categories.find((c) => c.id === d.category_id)?.name;

  const submit = async () => {
    const e: typeof errors = {};
    if (!d.name.trim()) e.name = 'Give the service a name.';
    const pe = priceError(d.price);
    if (pe) e.price = pe;
    setErrors(e);
    if (Object.keys(e).length) return;
    try {
      await save.mutateAsync({
        id: d.id,
        business_id: businessId,
        category_id: d.category_id,
        name: d.name.trim(),
        description: d.description.trim() || null,
        price_cents: parsePrice(d.price)!,
        duration_min: clampDuration(d.duration),
        is_visible: d.visible,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onClose();
    } catch (err) {
      Alert.alert('Couldn’t save', err instanceof Error ? err.message : 'Try again.');
    }
  };

  const confirmDelete = () =>
    Alert.alert(`Delete ${d.name}?`, 'Clients won’t be able to book it any more. Bookings already made stay as they are.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          remove
            .mutateAsync(d.id!)
            .then(onClose)
            .catch(() => Alert.alert('Couldn’t delete', 'Try again.')),
      },
    ]);

  return (
    <ModalSheet
      visible
      onClose={onClose}
      title={d.id ? d.name || 'Edit service' : d.name ? `Add ${d.name}` : `New ${catName?.toLowerCase() ?? ''} service`}
      footer={<Button title={d.id ? 'Save changes' : 'Add service'} onPress={submit} loading={save.isPending} />}>
      <Input label="Name" value={d.name} onChangeText={(name) => setD({ ...d, name })} error={errors.name} placeholder="Adult cut" maxLength={60} />
      <Input label="Price" value={d.price} onChangeText={(price) => setD({ ...d, price })} error={errors.price} keyboardType="decimal-pad" placeholder="30" hint="In dollars. What the client pays you for this service." />
      <Stepper
        label="Duration"
        display={formatDuration(d.duration)}
        canLess={d.duration > 15}
        canMore={d.duration < 480}
        onLess={() => setD({ ...d, duration: clampDuration(d.duration - 15) })}
        onMore={() => setD({ ...d, duration: clampDuration(d.duration + 15) })}
        lessLabel="15 minutes shorter"
        moreLabel="15 minutes longer"
      />
      <Input label="Description" value={d.description} onChangeText={(description) => setD({ ...d, description })} multiline maxLength={300} placeholder="What’s included, and anything clients should know." style={styles.textarea} />
      <View style={styles.toggleRow}>
        <AppText style={styles.flex1}>Show on my profile</AppText>
        <Toggle value={d.visible} onChange={(visible) => setD({ ...d, visible })} accessibilityLabel="Show on my profile" />
      </View>
      {d.id ? (
        <Pressable accessibilityRole="button" onPress={confirmDelete} style={styles.link}>
          <AppText variant="smallStrong" color="danger">
            Delete service
          </AppText>
        </Pressable>
      ) : null}
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.screen, gap: space.l },
  flex1: { flex: 1 },
  group: { gap: space.s },
  section: { fontFamily: fonts.semibold, letterSpacing: 1.2, marginTop: 4 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  card: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardLine, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: space.m },
  arrows: { flexDirection: 'row', gap: 6 },
  link: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
  notice: { backgroundColor: colors.tint, borderRadius: 16, padding: 14, gap: space.m, alignItems: 'flex-start' },
  catChips: { gap: space.s, paddingRight: space.l },
  list: { gap: space.s },
  custom: { minHeight: 52, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.placeholder, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.s, paddingHorizontal: space.l },
  textarea: { minHeight: 72, paddingTop: 12, textAlignVertical: 'top' },
  toggleRow: { flexDirection: 'row', alignItems: 'center' },
});
