import { currencyStringToFloat, parseCurrencyIfNeeded } from 'src/billing/utils';
import { validateUserEmails } from 'src/billing/utils';
import validate from 'validate.js';

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

describe('emailArray validator', () => {
  it('should return an error message if the value is not an array', () => {
    // Arrange
    const value = 'not an array';
    const options = { message: 'must be an array' };
    const key = 'userEmails';

    // Act
    const result = validate.validators.emailArray(value, options, key);

    // Assert
    expect(result).toBe('must be an array');
  });

  it('should return an error message if the array is empty', () => {
    // Arrange
    const value: string[] = [];
    const options = { emptyMessage: 'cannot be empty' };
    const key = 'userEmails';

    // Act
    const result = validate.validators.emailArray(value, options, key);

    // Assert
    expect(result).toBe('cannot be empty');
  });

  it('should return an error message if any email is invalid', () => {
    // Arrange
    const value = ['valid@example.com', 'invalid-email'];
    const options = {};
    const key = 'userEmails';

    // Act
    const result = validate.validators.emailArray(value, options, key);

    // Assert
    expect(result).toBe('^Invalid email(s): invalid-email');
  });

  it('should return null if all emails are valid', () => {
    // Arrange
    const value = ['valid@example.com', 'another.valid@example.com'];
    const options = {};
    const key = 'userEmails';

    // Act
    const result = validate.validators.emailArray(value, options, key);

    // Assert
    expect(result).toBeNull();
  });
});

describe('validateUserEmails', () => {
  it('should return an error if userEmails is not an array', () => {
    // Arrange
    const userEmails = 'not an array' as any;

    // Act
    const result = validateUserEmails(userEmails);

    // Assert
    expect(result).toEqual({ userEmails: ['All inputs must be valid email addresses.'] });
  });

  it('should return an error if userEmails array is empty', () => {
    // Arrange
    const userEmails: string[] = [];

    // Act
    const result = validateUserEmails(userEmails);

    // Assert
    expect(result).toEqual({ userEmails: ['User emails cannot be empty.'] });
  });

  it('should return an error if any email in userEmails array is invalid', () => {
    // Arrange
    const userEmails = ['valid@example.com', 'invalid-email'];

    // Act
    const result = validateUserEmails(userEmails);

    // Assert
    expect(result).toEqual({ userEmails: ['Invalid email(s): invalid-email'] });
  });

  it('should return undefined if all emails in userEmails array are valid', () => {
    // Arrange
    const userEmails = ['valid@example.com', 'another.valid@example.com'];

    // Act
    const result = validateUserEmails(userEmails);

    // Assert
    expect(result).toBeUndefined();
  });
});
