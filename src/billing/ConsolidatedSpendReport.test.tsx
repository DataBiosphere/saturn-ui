import { asMockedFn } from '@terra-ui-packages/test-utils';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Billing, BillingContract } from 'src/libs/ajax/billing/Billing';
import { renderWithAppContexts } from 'src/testing/test-utils';
import { WorkspaceWrapper } from 'src/workspaces/utils';

import { ConsolidatedSpendReport } from './ConsolidatedSpendReport';

jest.mock('src/libs/ajax/billing/Billing', () => ({ Billing: jest.fn() }));

jest.mock('src/libs/ajax/Metrics');
type NavExports = typeof import('src/libs/nav');
jest.mock(
  'src/libs/nav',
  (): NavExports => ({
    ...jest.requireActual<NavExports>('src/libs/nav'),
    getLink: jest.fn(() => '/'),
    goToPath: jest.fn(),
    useRoute: jest.fn().mockReturnValue({ query: {} }),
    updateSearch: jest.fn(),
  })
);

const spendReport = {
  spendSummary: {
    cost: '1.20',
    credits: '0.00',
    currency: 'USD',
    endTime: '2024-12-11T23:59:59.999Z',
    startTime: '2024-11-11T00:00:00.000Z',
  },
  spendDetails: [
    {
      aggregationKey: 'Workspace',
      spendData: [
        {
          cost: '0.11',
          credits: '0.00',
          currency: 'USD',
          endTime: '2024-12-11T23:59:59.999Z',
          googleProjectId: 'terra-dev-fe98dcb6',
          startTime: '2024-11-11T00:00:00.000Z',
          subAggregation: {
            aggregationKey: 'Category',
            spendData: [
              {
                category: 'Other',
                cost: '0.10',
                credits: '0.00',
                currency: 'USD',
              },
              {
                category: 'Storage',
                cost: '0.00',
                credits: '0.00',
                currency: 'USD',
              },
              {
                category: 'Compute',
                cost: '0.00',
                credits: '0.00',
                currency: 'USD',
              },
            ],
          },
          workspace: {
            name: 'workspace2',
            namespace: 'namespace-1',
          },
        },
      ],
    },
    {
      aggregationKey: 'Workspace',
      spendData: [
        {
          cost: '0.11',
          credits: '0.00',
          currency: 'USD',
          endTime: '2024-12-11T23:59:59.999Z',
          googleProjectId: 'terra-dev-fe98dcb8',
          startTime: '2024-11-11T00:00:00.000Z',
          subAggregation: {
            aggregationKey: 'Category',
            spendData: [
              {
                category: 'Other',
                cost: '0.10',
                credits: '0.00',
                currency: 'USD',
              },
              {
                category: 'Storage',
                cost: '0.00',
                credits: '0.00',
                currency: 'USD',
              },
              {
                category: 'Compute',
                cost: '0.00',
                credits: '0.00',
                currency: 'USD',
              },
            ],
          },
          workspace: {
            name: 'workspace3',
            namespace: 'namespace-2',
          },
        },
      ],
    },
  ],
};

const workspaces = [
  {
    canShare: true,
    canCompute: true,
    accessLevel: 'WRITER',
    policies: [],
    public: false,
    workspace: {
      attributes: {
        description: '',
        'tag:tags': {
          itemsType: 'AttributeValue',
          items: [],
        },
      },
      authorizationDomain: [],
      billingAccount: 'billingAccounts/00102A-34B56C-78DEFA',
      bucketName: 'fc-01111a11-20b2-3033-4044-55c0c5c55555',
      cloudPlatform: 'Gcp',
      createdBy: 'user2@gmail.com',
      createdDate: '2024-08-16T13:55:36.984Z',
      googleProject: 'terra-dev-fe98dcb7',
      googleProjectNumber: '123045678091',
      isLocked: false,
      lastModified: '2024-12-11T04:32:15.461Z',
      name: 'workspace1',
      namespace: 'namespace-1',
      state: 'Ready',
      workflowCollectionName: '01111a11-20b2-3033-4044-55c0c5c55555',
      workspaceId: '01111a11-20b2-3033-4044-55c0c5c55555',
      workspaceType: 'rawls',
      workspaceVersion: 'v2',
    },
  } as WorkspaceWrapper,
  {
    canShare: true,
    canCompute: true,
    accessLevel: 'OWNER',
    policies: [],
    public: false,
    workspace: {
      attributes: {
        description: '',
        'tag:tags': {
          itemsType: 'AttributeValue',
          items: [],
        },
      },
      authorizationDomain: [],
      billingAccount: 'billingAccounts/00102A-34B56C-78DEFA',
      bucketName: 'fc-01111a11-20b2-3033-4044-66c0c6c66666',
      cloudPlatform: 'Gcp',
      createdBy: 'user1@gmail.com',
      createdDate: '2024-09-26T11:55:36.984Z',
      googleProject: 'terra-dev-fe98dcb6',
      googleProjectNumber: '123045678092',
      isLocked: false,
      lastModified: '2024-11-11T04:32:15.461Z',
      name: 'workspace2',
      namespace: 'namespace-1',
      state: 'Ready',
      workflowCollectionName: '01111a11-20b2-3033-4044-66c0c6c66666',
      workspaceId: '01111a11-20b2-3033-4044-66c0c6c66666',
      workspaceType: 'rawls',
      workspaceVersion: 'v2',
    },
  } as WorkspaceWrapper,
  {
    canShare: true,
    canCompute: true,
    policies: [],
    accessLevel: 'PROJECT_OWNER',
    public: false,
    workspace: {
      attributes: {
        description: '',
        'tag:tags': {
          itemsType: 'AttributeValue',
          items: [],
        },
      },
      authorizationDomain: [],
      billingAccount: 'billingAccounts/00102A-34B56C-78DEFB',
      bucketName: 'fc-01111a11-20b2-3033-4044-77c0c7c77777',
      cloudPlatform: 'Gcp',
      createdBy: 'user1@gmail.com',
      createdDate: '2024-08-10T13:50:36.984Z',
      googleProject: 'terra-dev-fe98dcb8',
      googleProjectNumber: '123045678090',
      isLocked: false,
      lastModified: '2024-12-19T04:30:15.461Z',
      name: 'workspace3',
      namespace: 'namespace-2',
      state: 'Ready',
      workflowCollectionName: '01111a11-20b2-3033-4044-77c0c7c77777',
      workspaceId: '01111a11-20b2-3033-4044-77c0c7c77777',
      workspaceType: 'rawls',
      workspaceVersion: 'v2',
    },
  } as WorkspaceWrapper,
];

describe('ConsolidatedSpendReport', () => {
  it('displays results of spend query', async () => {
    // Arrange
    const getCrossBillingSpendReport = jest.fn(() => Promise.resolve(spendReport));
    asMockedFn(Billing).mockImplementation(
      () => ({ getCrossBillingSpendReport } as Partial<BillingContract> as BillingContract)
    );

    // Act
    await act(async () => renderWithAppContexts(<ConsolidatedSpendReport workspaces={workspaces} />));

    // Assert
    expect(screen.getByText('workspace2')).not.toBeNull();
    expect(screen.getByText('workspace3')).not.toBeNull();
  });

  it('searches by workspace name', async () => {
    // Arrange
    const user = userEvent.setup();
    const getCrossBillingSpendReport = jest.fn(() => Promise.resolve(spendReport));
    asMockedFn(Billing).mockImplementation(
      () => ({ getCrossBillingSpendReport } as Partial<BillingContract> as BillingContract)
    );

    // Act
    await act(async () => renderWithAppContexts(<ConsolidatedSpendReport workspaces={workspaces} />));
    await user.type(screen.getByPlaceholderText('Search by name, project or bucket'), 'workspace2');

    // Assert
    expect(screen.getByText('workspace2')).not.toBeNull();
    expect(screen.queryByText('workspace3')).toBeNull();
  });

  // TODO: tests for tests for changing time period, tests for caching (once it's implemented)
});
