// Helpers every server function uses: Stripe, the admin database client, the signed-in user, replies.
// Secrets come from Supabase (Edge Functions → Secrets); SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
// are provided automatically.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';

export { Stripe };

let stripeClient: Stripe | null = null;
export function stripe(): Stripe {
  if (!stripeClient) {
    const key = Deno.env.get('STRIPE_SECRET_KEY');
    if (!key) throw new HttpError(500, 'Payments aren’t set up yet.');
    // CLAUDE.md: test mode until the owner says otherwise.
    if (!key.startsWith('sk_test_') && Deno.env.get('STRIPE_LIVE_OK') !== 'yes') {
      throw new HttpError(500, 'Live Stripe keys are turned off.');
    }
    stripeClient = new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
  }
  return stripeClient;
}

export function admin(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** The signed-in person calling this function. */
export async function requireUser(req: Request, db: SupabaseClient): Promise<{ id: string; email: string | null }> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Please sign in.');
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Please sign in again.');
  return { id: data.user.id, email: data.user.email ?? null };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Wraps a handler: friendly JSON errors, never a stack trace. */
export function handle(fn: (req: Request) => Promise<Response>): (req: Request) => Promise<Response> {
  return async (req) => {
    try {
      if (req.method !== 'POST' && req.method !== 'GET') return json({ error: 'Not allowed.' }, 405);
      return await fn(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: 'Something went wrong. Please try again.' }, 500);
    }
  };
}

export async function body<T>(req: Request): Promise<Partial<T>> {
  try {
    return (await req.json()) as Partial<T>;
  } catch {
    return {};
  }
}

export const isUuid = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f-]{36}$/i.test(s);
