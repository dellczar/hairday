/**
 * What to show people when something fails. Our own errors (database rules, server functions,
 * sign-in, Stripe's card messages) are already written as plain sentences, so they're shown as is.
 * Anything that looks technical — a program bug, a raw network or parsing error — gets the
 * screen's own friendly fallback instead.
 */
const TECHNICAL = /undefined|null is not|is not a function|is not an object|\(evaluating|TypeError|SyntaxError|JSON|status code|PGRST|stack|\bat \w+ \(|https?:\/\//i;

export function errorText(e: unknown, fallback: string): string {
  const message = e instanceof Error ? e.message.trim() : typeof e === 'string' ? e.trim() : '';
  if (!message || message.length > 200) return fallback;
  if (/network request failed|failed to fetch|network error/i.test(message)) return 'No connection. Check your internet and try again.';
  if (TECHNICAL.test(message)) return fallback;
  // Plain sentences end like one; raw system messages ("Network request failed") usually don't.
  if (!/[.!?’]$/.test(message)) return fallback;
  return message;
}
