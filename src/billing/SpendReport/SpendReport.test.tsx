import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { SpendReport, WorkspaceLink } from 'src/billing/SpendReport/SpendReport';
import { Billing, BillingContract } from 'src/libs/ajax/billing/Billing';
import {
  AggregatedCategorySpendData,
  AggregatedWorkspaceSpendData,
  SpendReport as SpendReportServerResponse,
} from 'src/libs/ajax/billing/billing-models';
import { getLink } from 'src/libs/nav';
import { asMockedFn, MockedFn, partial, renderWithAppContexts as render } from 'src/testing/test-utils';

jest.mock('src/libs/ajax/billing/Billing');

type NavExports = typeof import('src/libs/nav');
jest.mock(
  'src/libs/nav',
  (): NavExports => ({
    ...jest.requireActual('src/libs/nav'),
    getLink: jest.fn(),
  })
);

describe('SpendReport', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    // Note that month is 0-based. This is April 1st, 2022.
    jest.setSystemTime(new Date(Date.UTC(2022, 3, 1, 20, 17, 5, 0)));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  const select90Days = async () => {
    // Selecting the option by all the "usual" methods of supplying label text, selecting an option, etc. failed.
    // Perhaps this is because these options have both display text and a value?
    // Unfortunately this awkward approach was the only thing that appeared to work.
    const getDateRangeSelect = screen.getByLabelText('Date range');
    // 7 days
    fireEvent.keyDown(getDateRangeSelect, { key: 'ArrowDown', code: 'ArrowDown' });
    // 30 days
    fireEvent.keyDown(getDateRangeSelect, { key: 'ArrowDown', code: 'ArrowDown' });
    // 90 days
    fireEvent.keyDown(getDateRangeSelect, { key: 'ArrowDown', code: 'ArrowDown' });
    // Choose the current focused option.
    await act(async () => {
      fireEvent.keyDown(getDateRangeSelect, { key: 'Enter', code: 'Enter' });
    });

    await waitFor(() => {
      // Check that 90 days was actually selected. There will always be a DOM element present with
      // text "Last 90 days", but if it is the selected element (which means the option dropdown has closed),
      // it will have a class name ending in "singleValue". This is ugly, but the Select component we are
      // using does not set the value on the input element itself.
      expect(screen.getByText('Last 90 days').className).toContain('singleValue');
    });
  };

  const otherCostMessaging = /other infrastructure or query costs related to the general operations of Terra/i;

  const createSpendReportResult = (totalCost) => {
    const categorySpendData: AggregatedCategorySpendData = {
      aggregationKey: 'Category',
      spendData: [
        { cost: '999', category: 'Compute', credits: '0.00', currency: 'USD' },
        { cost: '22', category: 'Storage', credits: '0.00', currency: 'USD' },
        { cost: '55', category: 'WorkspaceInfrastructure', credits: '0.00', currency: 'USD' },
        { cost: '89', category: 'Other', credits: '0.00', currency: 'USD' },
      ],
    };

    const workspaceSpendData: AggregatedWorkspaceSpendData = {
      aggregationKey: 'Workspace',
      spendData: [
        {
          cost: '100',
          credits: '0.00',
          currency: 'USD',
          googleProjectId: 'googleProjectId',
          workspace: { name: 'Second Most Expensive Workspace', namespace: 'namespace' },
          subAggregation: {
            aggregationKey: 'Category',
            spendData: [
              { cost: '90', category: 'Compute', credits: '0.00', currency: 'USD' },
              { cost: '2', category: 'Storage', credits: '0.00', currency: 'USD' },
              { cost: '8', category: 'Other', credits: '0.00', currency: 'USD' },
            ],
          },
        },
        {
          cost: '1000',
          credits: '0.00',
          currency: 'USD',
          googleProjectId: 'googleProjectId',
          workspace: { name: 'Most Expensive Workspace', namespace: 'namespace' },
          subAggregation: {
            aggregationKey: 'Category',
            spendData: [
              { cost: '900', category: 'Compute', credits: '0.00', currency: 'USD' },
              { cost: '20', category: 'Storage', credits: '0.00', currency: 'USD' },
              { cost: '80', category: 'Other', credits: '0.00', currency: 'USD' },
            ],
          },
        },
        {
          cost: '10',
          credits: '0.00',
          currency: 'USD',
          googleProjectId: 'googleProjectId',
          workspace: { name: 'Third Most Expensive Workspace', namespace: 'namespace' },
          subAggregation: {
            aggregationKey: 'Category',
            spendData: [
              { cost: '9', category: 'Compute', credits: '0.00', currency: 'USD' },
              { cost: '0', category: 'Storage', credits: '0.00', currency: 'USD' },
              { cost: '1', category: 'Other', credits: '0.00', currency: 'USD' },
            ],
          },
        },
      ],
    };

    const mockServerResponse: SpendReportServerResponse = {
      spendSummary: {
        cost: totalCost,
        credits: '2.50',
        currency: 'USD',
        endTime: 'dummyTime',
        startTime: 'dummyTime',
      },
      spendDetails: [workspaceSpendData, categorySpendData],
    };

    return mockServerResponse;
  };

  it('does not call the server if view is not active', async () => {
    // Arrange
    const getSpendReport: MockedFn<BillingContract['getSpendReport']> = jest.fn();
    getSpendReport.mockResolvedValue({} as SpendReportServerResponse);
    asMockedFn(Billing).mockReturnValue(partial<BillingContract>({ getSpendReport }));

    // Act
    await act(async () => {
      render(<SpendReport viewSelected={false} billingProjectName='thrifty' cloudPlatform='GCP' />);
    });

    // Assert
    expect(getSpendReport).not.toHaveBeenCalled();
    expect(screen.queryByText(otherCostMessaging)).toBeNull();
  });

  it('displays GCP cost information', async () => {
    // Arrange
    const getSpendReport: MockedFn<BillingContract['getSpendReport']> = jest.fn();
    getSpendReport.mockResolvedValue(createSpendReportResult('1110'));
    asMockedFn(Billing).mockReturnValue(partial<BillingContract>({ getSpendReport }));

    // Act
    await act(async () => {
      render(<SpendReport viewSelected billingProjectName='thrifty' cloudPlatform='GCP' />);
    });

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/\$89.00 in other infrastructure/i)).toBeInTheDocument();
    });
    expect(getSpendReport).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('spend')).toHaveTextContent('$1,110.00*');
    expect(screen.getByTestId('compute')).toHaveTextContent('$999.00');
    expect(screen.getByTestId('storage')).toHaveTextContent('$22.00');
    // validate that 'workspaceInfractructure' card is not shown for GCP report
    expect(screen.queryByTestId('workspaceInfrastructure')).not.toBeInTheDocument();

    // Highcharts content is very minimal when rendered in the unit test. Testing of "most expensive workspaces"
    // is in the integration test. Accessibility is also tested in the integration test.
  });

  it('displays Azure cost information but does not include per-workspace costs', async () => {
    // Arrange
    const getSpendReport: MockedFn<BillingContract['getSpendReport']> = jest.fn();
    getSpendReport.mockResolvedValue(createSpendReportResult('1110'));
    asMockedFn(Billing).mockReturnValue(partial<BillingContract>({ getSpendReport }));

    // Act
    await act(async () => {
      render(<SpendReport viewSelected billingProjectName='thrifty' cloudPlatform='AZURE' />);
    });

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/\$89.00 in other infrastructure/i)).toBeInTheDocument();
    });
    expect(getSpendReport).toHaveBeenCalledWith({
      billingProjectName: 'thrifty',
      endDate: '2022-04-01',
      startDate: '2022-03-02',
      aggregationKeys: ['Category'],
    });
    expect(screen.getByTestId('spend')).toHaveTextContent('$1,110.00*');
    expect(screen.getByTestId('compute')).toHaveTextContent('$999.00');
    expect(screen.getByTestId('storage')).toHaveTextContent('$22.00');
    expect(screen.getByTestId('workspaceInfrastructure')).toHaveTextContent('$55.00');
  });

  it('fetches reports based on selected date range, if active', async () => {
    // Arrange
    const getSpendReport: MockedFn<BillingContract['getSpendReport']> = jest.fn();
    asMockedFn(Billing).mockReturnValue(partial<BillingContract>({ getSpendReport }));
    getSpendReport
      .mockResolvedValueOnce(createSpendReportResult('1110'))
      .mockResolvedValue(createSpendReportResult('1110.17'));

    // Act
    await act(async () => {
      render(<SpendReport viewSelected billingProjectName='thrifty' cloudPlatform='GCP' />);
    });
    await select90Days();

    // Assert
    await waitFor(() => {
      expect(screen.getByText(otherCostMessaging)).toBeInTheDocument();
    });
    expect(screen.getByTestId('spend')).toHaveTextContent('$1,110.17*');
    expect(getSpendReport).toHaveBeenCalledTimes(2);
    expect(getSpendReport).toHaveBeenNthCalledWith(1, {
      billingProjectName: 'thrifty',
      endDate: '2022-04-01',
      startDate: '2022-03-02',
      aggregationKeys: ['Workspace~Category', 'Category'],
    });
    expect(getSpendReport).toHaveBeenNthCalledWith(2, {
      billingProjectName: 'thrifty',
      endDate: '2022-04-01',
      startDate: '2022-01-01',
      aggregationKeys: ['Workspace~Category', 'Category'],
    });
  });

  it('shows an error if no cost information exists', async () => {
    // Arrange
    const getSpendReport: MockedFn<BillingContract['getSpendReport']> = jest.fn();
    getSpendReport.mockRejectedValue(
      new Response(JSON.stringify({ message: 'No spend data for 30 days' }), { status: 404 })
    );
    asMockedFn(Billing).mockReturnValue(partial<BillingContract>({ getSpendReport }));

    // Act
    await act(async () => {
      render(<SpendReport viewSelected billingProjectName='thrifty' cloudPlatform='GCP' />);
    });

    // Assert
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('No spend data for 30 days');
    });

    // Arrange, switch error message to verify that the UI updates with the new message.
    getSpendReport.mockRejectedValue(
      new Response(JSON.stringify({ message: 'No spend data for 90 days' }), { status: 404 })
    );

    // Act -- switch to 90 days and verify that the alert is updated
    await select90Days();

    // Assert
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('No spend data for 90 days');
    });
  });
});

describe('WorkspaceLink', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('calls nav function and produces a link', () => {
    // Arrange
    asMockedFn(getLink).mockImplementation(() => {
      return 'https://mock-link';
    });

    // Act
    const link = WorkspaceLink('test-billing-project', 'test-workspace');

    // Assert
    expect(getLink).toHaveBeenCalledWith('workspace-dashboard', {
      namespace: 'test-billing-project',
      name: 'test-workspace',
    });
    expect(link).toContain('href=https://mock-link');
    expect(link).toContain('test-workspace');
  });
});
