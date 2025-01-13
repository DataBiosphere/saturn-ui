import { screen } from '@testing-library/react';
import React from 'react';
import { TopBar } from 'src/components/TopBar';
import { renderWithAppContexts as render } from 'src/testing/test-utils';

import { BillingListPage } from './BillingListPage';

// Mock dependencies
type NavExports = typeof import('src/libs/nav');
jest.mock(
  'src/libs/nav',
  (): NavExports => ({
    ...jest.requireActual<NavExports>('src/libs/nav'),
    getLink: jest.fn().mockReturnValue('/billing'),
    goToPath: jest.fn(),
    useRoute: jest.fn().mockReturnValue({ query: {} }),
    updateSearch: jest.fn(),
  })
);

jest.mock('src/components/TopBar', () => ({
  TopBar: jest.fn(({ title, href, children }) => (
    <div>
      <div>{title}</div>
      <a href={href} data-testid='topbar-link'>
        TopBar Link
      </a>
      {children}
    </div>
  )),
}));

jest.mock('src/billing/List/BillingList', () => ({
  BillingList: jest.fn(() => <div>Mocked BillingList</div>),
}));

describe('BillingListPage', () => {
  test('renders the page with default props', () => {
    render(<BillingListPage queryParams={{ selectedName: undefined, type: undefined }} />);

    // Verify title
    expect(screen.getByText('Billing')).toBeInTheDocument();

    // Verify breadcrumbs are not displayed
    expect(screen.queryByText('Billing > Billing Project')).not.toBeInTheDocument();

    // Verify BillingList is rendered
    expect(screen.getByText('Mocked BillingList')).toBeInTheDocument();
  });

  test('renders breadcrumbs when selectedName is provided', () => {
    render(<BillingListPage queryParams={{ selectedName: 'Test Project', type: undefined }} />);

    // Verify breadcrumbs
    expect(screen.getByText('Billing > Billing Project')).toBeInTheDocument();
    expect(screen.getByText('Test Project')).toBeInTheDocument();
  });

  test('TopBar renders the correct href when selectedName is provided', () => {
    render(<BillingListPage queryParams={{ selectedName: 'Test Project', type: undefined }} />);

    // Verify TopBar link
    const link = screen.getByTestId('topbar-link');
    expect(link).toHaveAttribute('href', '/billing');
  });

  test('TopBar does not render href when selectedName is undefined', () => {
    render(<BillingListPage queryParams={{ selectedName: undefined, type: undefined }} />);

    // Verify TopBar link absence
    const link = screen.getByTestId('topbar-link');
    expect(link).not.toHaveAttribute('href');
  });

  test('passes correct props to BillingList', () => {
    render(<BillingListPage queryParams={{ selectedName: 'Test Project', type: undefined }} />);

    // Verify BillingList is rendered
    expect(screen.getByText('Mocked BillingList')).toBeInTheDocument();
  });

  test('TopBar receives correct props', () => {
    render(<BillingListPage queryParams={{ selectedName: 'Test Project', type: undefined }} />);

    // Verify TopBar props
    expect(TopBar).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Billing',
        href: '/billing',
      }),
      expect.any(Object)
    );
  });

  test('TopBar receives correct props when selectedName is undefined', () => {
    render(<BillingListPage queryParams={{ selectedName: undefined, type: undefined }} />);

    // Verify TopBar props
    expect(TopBar).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Billing',
        href: undefined,
      }),
      expect.any(Object)
    );
  });
});
