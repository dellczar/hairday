import { addressErrors, fromGeocode, stateCode } from '../address';

describe('address', () => {
  it('accepts state names or codes', () => {
    expect(stateCode('New York')).toBe('NY');
    expect(stateCode('ny')).toBe('NY');
    expect(stateCode('Narnia')).toBeNull();
  });
  it('puts one plain message under each wrong field', () => {
    expect(addressErrors({ street: '', city: '', state: 'XX', zip: '123' })).toEqual({
      street: 'Enter your street address.',
      city: 'Enter the city.',
      state: 'Use a US state, like NY.',
      zip: 'ZIP codes are 5 digits.',
    });
    expect(addressErrors({ street: '555 Main St', city: 'New York', state: 'NY', zip: '10001' })).toEqual({});
  });
  it('fills the form from the phone’s location lookup', () => {
    expect(fromGeocode({ streetNumber: '555', street: 'Main St', city: 'New York', region: 'New York', postalCode: '10001' })).toEqual({
      street: '555 Main St',
      city: 'New York',
      state: 'NY',
      zip: '10001',
    });
  });
});
