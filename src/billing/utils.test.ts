import { currencyStringToFloat, parseCurrencyIfNeeded } from 'src/billing/utils';

describe('currencyStringToFloat', () => {
  test('should correctly parse European format (€1.234,56) to float', () => {
    expect(currencyStringToFloat('€1.234,56')).toBeCloseTo(1234.56);
  });

  test('should correctly parse US format ($1,234.56) to float', () => {
    expect(currencyStringToFloat('$1,234.56')).toBeCloseTo(1234.56);
  });

  test('should handle plain number with comma as decimal separator (1234,56)', () => {
    expect(currencyStringToFloat('1234,56')).toBeCloseTo(1234.56);
  });

  test('should handle plain number with period as decimal separator (1234.56)', () => {
    expect(currencyStringToFloat('1234.56')).toBeCloseTo(1234.56);
  });

  test('should return NaN for invalid input', () => {
    expect(currencyStringToFloat('invalid')).toBeNaN();
  });

  test('should handle negative numbers in European format (-€1.234,56)', () => {
    expect(currencyStringToFloat('-€1.234,56')).toBeCloseTo(-1234.56);
  });

  test('should handle negative numbers in US format (-$1,234.56)', () => {
    expect(currencyStringToFloat('-$1,234.56')).toBeCloseTo(-1234.56);
  });
});

describe('parseCurrencyIfNeeded', () => {
  it('should return -Infinity for "N/A" value', () => {
    expect(parseCurrencyIfNeeded('name', 'N/A')).toBe(-Infinity);
    expect(parseCurrencyIfNeeded('totalSpend', 'N/A')).toBe(-Infinity);
  });

  it('should return -Infinity for undefined value', () => {
    expect(parseCurrencyIfNeeded('name', undefined)).toBe(-Infinity);
    expect(parseCurrencyIfNeeded('totalSpend', undefined)).toBe(-Infinity);
  });

  it('should parse currency values correctly', () => {
    expect(parseCurrencyIfNeeded('totalSpend', '$1,234.56')).toBe(1234.56);
    expect(parseCurrencyIfNeeded('totalCompute', '€1.234,56')).toBe(1234.56);
    expect(parseCurrencyIfNeeded('totalStorage', '£1,234.56')).toBe(1234.56);
  });

  it('should return the original value for non-currency fields', () => {
    expect(parseCurrencyIfNeeded('name', 'workspace1')).toBe('workspace1');
  });

  it('should return the original value for non-currency values', () => {
    expect(parseCurrencyIfNeeded('totalSpend', '...')).toBe('...');
  });
});
