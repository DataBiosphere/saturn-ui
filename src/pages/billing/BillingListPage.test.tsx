import { act, screen } from '@testing-library/react';
import React from 'react';
import { renderWithAppContexts as render } from 'src/testing/test-utils';

import { BillingListPage } from './BillingListPage';

type BillingListExports = typeof import('src/billing/List/BillingList');
jest.mock(
  'src/billing/List/BillingList',
  (): BillingListExports => ({
    ...jest.requireActual('src/billing/List/BillingList'),
    BillingList: jest.fn((_) => {
      return <>billing list</>;
    }),
  })
);

type FooterWrapperExports = typeof import('src/components/FooterWrapper');
jest.mock(
  'src/components/FooterWrapper',
  (): FooterWrapperExports => ({
    ...jest.requireActual('src/components/FooterWrapper'),
    default: jest.fn((_) => {
      return <>footer wrapper</>;
    }),
  })
);

type NavExports = typeof import('src/libs/nav');
jest.mock(
  'src/libs/nav',
  (): NavExports => ({
    ...jest.requireActual('src/libs/nav'),
    getLink: jest.fn((link) => link),
  })
);

type TopBarExports = typeof import('src/components/TopBar') & { __esModule: true };
jest.mock(
  'src/components/TopBar',
  (): TopBarExports => ({
    __esModule: true,
    TopBar: (props) => {
      return <a href={props.href}>navigation link</a>;
    },
  })
);

describe('BillingListPage', () => {
  it('navigates to home page when top bar logo is clicked if no billing project is selected', async () => {
    // Act
    await act(async () => {
      render(<BillingListPage queryParams={{ selectedName: undefined }} />);
    });

    // Assert
    const links = screen.getByRole('link');
    expect(links).toHaveTextContent('root');
  });

  it('navigates to billing page when top bar logo is clicked if a billing project is selected', async () => {
    // Act
    await act(async () => {
      render(<BillingListPage queryParams={{ selectedName: 'test-project' }} />);
    });

    // Assert
    const links = screen.getByRole('link');
    expect(links).toHaveTextContent('billing');
  });
});
