import { IconProps } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import { BillingProject } from 'src/billing-core/models';
import colors from 'src/libs/colors';
import validate from 'validate.js';

export const billingRoles = {
  owner: 'Owner',
  user: 'User',
};

export const billingProjectNameValidator = (existing: string[]) => ({
  length: { minimum: 6, maximum: 30 },
  format: {
    pattern: /(\w|-)+/,
    message: 'can only contain letters, numbers, underscores and hyphens.',
  },
  exclusion: {
    within: existing,
    message: 'already exists',
  },
});

export const isCreating = (project: BillingProject) =>
  project.status === 'Creating' || project.status === 'CreatingLandingZone';
export const isDeleting = (project: BillingProject) => project.status === 'Deleting';
export const isErrored = (project: BillingProject) => project.status === 'Error' || project.status === 'DeletionFailed';

export const billingAccountIconSize = 16;

export type BillingAccountStatus = 'updating' | 'done' | 'error';
const billingAccountIconProps: Record<BillingAccountStatus, IconProps> = {
  updating: {
    icon: 'sync',
    color: colors.warning(),
    size: billingAccountIconSize,
    'aria-label': 'billing account updating',
  },
  done: {
    icon: 'check',
    color: colors.accent(),
    size: billingAccountIconSize,
    'aria-label': 'billing account up-to-date',
  },
  error: {
    icon: 'warning-standard',
    color: colors.danger(),
    size: billingAccountIconSize,
    'aria-label': 'billing account in error state',
  },
};

export const getBillingAccountIconProps = (status: BillingAccountStatus): IconProps => {
  return billingAccountIconProps[status];
};

export const accountLinkStyle = {
  color: colors.dark(),
  fontSize: 14,
  display: 'flex',
  alignItems: 'center',
  marginTop: '0.5rem',
  marginLeft: '1rem',
};

export const currencyStringToFloat = (currencyString: string) => {
  // Helper function to check if comma appears before period
  const isCommaBeforePeriod = (currencyStr: string) => {
    const commaIndex = currencyStr.indexOf(',');
    const periodIndex = currencyStr.indexOf('.');
    return commaIndex < periodIndex;
  };

  // Remove any non-numeric symbols except comma, period, and dash for negative numbers
  let cleanString = currencyString.replace(/[^\d,.-]/g, '');

  // If comma appears before period, assume US format and replace commas only
  if (isCommaBeforePeriod(cleanString)) {
    cleanString = cleanString.replace(/,/g, '');
  } else {
    // Otherwise, remove periods and replace commas with periods
    cleanString = cleanString.replace(/\./g, '').replace(/,/g, '.');
  }

  return parseFloat(cleanString);
};

// Main function to parse currency only for specified fields
export const parseCurrencyIfNeeded = (field: string, value: string | undefined): number | string => {
  const currencyFields = new Set(['totalSpend', 'totalCompute', 'totalStorage']);

  // Handle non-numeric cases
  if (value === 'N/A' || typeof value === 'undefined') return -Infinity;

  // Convert currency string if field matches specified currency fields
  if (currencyFields.has(field)) {
    const parsedValue = currencyStringToFloat(value);
    return Number.isNaN(parsedValue) ? value : parsedValue;
  }

  // Return original value for non-currency fields
  return value;
};

// Custom validator for an array of emails
validate.validators.emailArray = (value: string[], options: { message: string; emptyMessage: string }, key: any) => {
  if (!Array.isArray(value)) {
    return options.message || `^${key} must be an array.`;
  }

  if (value.length === 0) {
    return options.emptyMessage || `^${key} cannot be empty.`;
  }

  const errors = _.flow(
    _.map((email: string) => (validate.single(email, { email: true, presence: true }) ? email : null)),
    _.filter(Boolean)
  )(value);

  return errors.length ? `^Invalid email(s): ${errors.join(', ')}` : null;
};

export const validateUserEmails = (userEmails: string[]) => {
  return validate(
    { userEmails },
    {
      userEmails: {
        emailArray: {
          message: '^All inputs must be valid email addresses.',
          emptyMessage: '^User emails cannot be empty.',
        },
      },
    }
  );
};
