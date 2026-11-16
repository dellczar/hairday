// Where Stripe sends the owner after Connect onboarding: straight back into the app's Payouts screen.
// Public (no sign-in) and does nothing else; the app then asks connect-onboarding for the status.

Deno.serve((req) => {
  const again = new URL(req.url).searchParams.get('again') === '1';
  return new Response(null, {
    status: 302,
    headers: { Location: `hairday://payouts?${again ? 'again=1' : 'done=1'}` },
  });
});
