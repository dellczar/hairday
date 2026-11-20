import { errorText } from '../errors';

describe('errorText', () => {
  const fallback = 'Please try again.';

  it('shows our own plain-sentence errors as they are', () => {
    expect(errorText(new Error('Someone just booked that time. Pick another.'), fallback)).toBe('Someone just booked that time. Pick another.');
    expect(errorText(new Error('Your card was declined.'), fallback)).toBe('Your card was declined.');
  });

  it('turns network failures into a clear connection message', () => {
    expect(errorText(new TypeError('Network request failed'), fallback)).toBe('No connection. Check your internet and try again.');
  });

  it('hides technical messages behind the screen’s fallback', () => {
    expect(errorText(new TypeError("undefined is not an object (evaluating 'a.b')"), fallback)).toBe(fallback);
    expect(errorText(new Error('JSON Parse error: Unexpected token <'), fallback)).toBe(fallback);
    expect(errorText(new Error('Edge Function returned a non-2xx status code'), fallback)).toBe(fallback);
    expect(errorText(new Error('invalid input syntax for type uuid'), fallback)).toBe(fallback);
    expect(errorText({ weird: true }, fallback)).toBe(fallback);
    expect(errorText(new Error(''), fallback)).toBe(fallback);
  });
});
