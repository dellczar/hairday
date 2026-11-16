// Row shapes for the tables the app reads and writes (supabase/migrations, SPEC §7).
// Times of day are 'HH:MM' or 'HH:MM:SS' strings, as Postgres `time` returns them.

export type ProRole =
  | 'hair stylist'
  | 'colorist'
  | 'barber'
  | 'braider'
  | 'cosmetologist'
  | 'makeup artist'
  | 'nail technician'
  | 'lash artist'
  | 'massage therapist'
  | 'other';

export type Business = {
  id: string;
  owner_id: string;
  name: string;
  type: string | null;
  description: string | null;
  phone: string | null;
  website: string | null;
  instagram: string | null;
  tiktok: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  time_zone: string;
  logo_url: string | null;
  amenities: string[];
  health_safety: string[];
  cancellation_hours: number;
  late_cancel_percent: number;
  stripe_account_id: string | null;
  payouts_enabled: boolean;
  is_published: boolean;
  created_at: string;
};

export type Photo = { id: string; url: string; sort_order: number };
export type BusinessPhoto = Photo & { business_id: string };
export type ProfessionalPhoto = Photo & { professional_id: string };

export type BusinessHour = { id: string; business_id: string; weekday: number; opens_at: string; closes_at: string };

export type Category = { id: string; slug: string; name: string };

export type Service = {
  id: string;
  business_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price_cents: number;
  duration_min: number;
  is_visible: boolean;
  sort_order: number;
};

export type Professional = {
  id: string;
  business_id: string;
  role: ProRole;
  first_name: string;
  last_name: string | null;
  avatar_url: string | null;
  instagram: string | null;
  is_active: boolean;
};

export type ProfessionalService = { professional_id: string; service_id: string };

export type Availability = { id: string; professional_id: string; weekday: number; starts_at: string; ends_at: string };

/** weekday null = every working day. */
export type Break = { id: string; professional_id: string; weekday: number | null; starts_at: string; ends_at: string };

export type TimeOff = { id: string; professional_id: string; starts_at: string; ends_at: string; note: string | null };

/**
 * A review as customers see it: the `public_reviews` view (reviewer shown as "Dana T.", no ids).
 * Read-only; customers write reviews in Phase 7.
 */
export type PublicReview = {
  id: string;
  business_id: string;
  professional_id: string | null;
  rating: number;
  tags: string[];
  body: string | null;
  photo_url: string | null;
  created_at: string;
  reviewer_name: string;
};

/** Exactly one of business_id / professional_id is set. */
export type Favorite = { id: string; customer_id: string; business_id: string | null; professional_id: string | null };

export type BookingStatus = 'pending_payment' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export type Booking = {
  id: string;
  business_id: string;
  professional_id: string;
  customer_id: string | null;
  client_id: string | null;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  source: 'online' | 'walk_in' | 'phone';
  subtotal_cents: number;
  fee_cents: number;
  tip_cents: number;
  total_cents: number;
  stripe_payment_intent_id: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  refund_cents: number;
  created_at: string;
  // Phase 5 — payments (charged after the appointment; written only by server functions)
  tip_percent: number;
  payment_status: PaymentStatus;
  stripe_setup_intent_id: string | null;
  stripe_payment_method_id: string | null;
  /** "Visa ending 4242" */
  card_label: string | null;
  /** What was (or will be) charged: the visit, or a late-cancel / no-show share. */
  charge_cents: number;
  charged_at: string | null;
  payment_error: string | null;
};

export type PaymentStatus = 'none' | 'card_saved' | 'charging' | 'charged' | 'failed' | 'not_charged';

/** What the app needs to show Stripe's PaymentSheet for saving a card. Demo mode skips Stripe. */
export type CardSetup =
  | { demo: true }
  | { demo?: false; setupIntentClientSecret: string; ephemeralKey: string; customerId: string };

export type PayoutsStatus = { started: boolean; payouts_enabled: boolean; needs_more?: boolean; schedule?: string | null };

/** Services copied onto a booking at the moment it's made (prices can change later). */
export type BookingService = { booking_id: string; service_id: string; professional_id: string; price_cents: number; duration_min: number };

/** One row from busy_times(): when a professional can't take clients. Never says who or why. */
export type BusyTime = { professional_id: string; starts_at: string; ends_at: string; kind: 'booking' | 'time_off' };

export type HoldRequest = { business_id: string; professional_id: string; service_ids: string[]; starts_at: string };

export type Tables = {
  businesses: Business;
  business_photos: BusinessPhoto;
  business_hours: BusinessHour;
  categories: Category;
  services: Service;
  professionals: Professional;
  professional_services: ProfessionalService;
  professional_photos: ProfessionalPhoto;
  availability: Availability;
  breaks: Break;
  time_off: TimeOff;
  public_reviews: PublicReview;
  favorites: Favorite;
  bookings: Booking;
  booking_services: BookingService;
};

export type TableName = keyof Tables;
