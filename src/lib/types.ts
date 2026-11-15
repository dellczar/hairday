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
};

export type TableName = keyof Tables;
