import { render, screen } from '@testing-library/react';
import { h } from 'react-hyperscript-helpers';
import { ContributorInput } from 'src/data-catalog/create-dataset/custom-inputs/ContributorInput';

describe('ContributorInput', () => {
  it('Renders a ContributorInput with all fields and email validation', () => {
    render(
      h(ContributorInput, {
        contributor: {
          name: 'name',
          email: 'email',
        },
        onChange: () => {},
        wrapperProps: {},
      })
    );
    expect(screen.getByLabelText('Name').closest('input')?.value).toBe('name');
    expect(screen.getByLabelText('Email').closest('input')?.value).toBe('email');
    expect(screen.queryByText('Email is not a valid email')).toBeTruthy();
  });

  it('Renders a ContributorInput without email error if there is a valid email', () => {
    render(
      h(ContributorInput, {
        contributor: {
          name: 'name',
          email: 'email@foo.bar',
        },
        onChange: () => {},
        wrapperProps: {},
      })
    );
    expect(screen.queryByText('Email is not a valid email')).toBeFalsy();
  });

  it('Renders a ContributorInput without email error if there is no email', () => {
    render(
      h(ContributorInput, {
        contributor: {
          name: 'name',
        },
        onChange: () => {},
        wrapperProps: {},
      })
    );
    expect(screen.queryByText('Email is not a valid email')).toBeFalsy();
  });
});
