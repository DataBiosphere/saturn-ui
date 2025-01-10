import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { h } from 'react-hyperscript-helpers';
import { AnalysesData } from 'src/analysis/Analyses';
import { renderWithAppContexts as render } from 'src/testing/test-utils';
import { WorkflowsAppNavPanel } from 'src/workflows-app/components/WorkflowsAppNavPanel';
import { mockAzureWorkspace } from 'src/workflows-app/utils/mock-responses';

const defaultAnalysesData: AnalysesData = {
  apps: [],
  lastRefresh: null,
  refreshApps: jest.fn().mockReturnValue(Promise.resolve()),
  runtimes: [],
  refreshRuntimes: () => Promise.resolve(),
  appDataDisks: [],
  persistentDisks: [],
  isLoadingCloudEnvironments: false,
};

const defaultAnalysesDataWithAppsRefreshed: AnalysesData = {
  ...defaultAnalysesData,
  lastRefresh: new Date(),
};

type UseMetricsExports = typeof import('src/libs/ajax/metrics/useMetrics');
jest.mock(
  'src/libs/ajax/metrics/useMetrics',
  (): UseMetricsExports => ({
    ...jest.requireActual<UseMetricsExports>('src/libs/ajax/metrics/useMetrics'),
    useMetricsEvent: jest.fn(() => ({ captureEvent: jest.fn() })),
  })
);

jest.mock('src/libs/nav', () => ({
  ...jest.requireActual('src/libs/nav'),
  useQueryParameter: jest.requireActual('react').useState,
}));

describe('Workflows App Navigation Panel', () => {
  it('renders headers', async () => {
    const user = userEvent.setup();

    render(
      h(WorkflowsAppNavPanel, {
        loading: false,
        launcherDisabled: true,
        launching: true,
        createWorkflowsApp: jest.fn(),
        pageReady: true,
        name: 'test-azure-ws-name',
        namespace: 'test-azure-ws-namespace',
        workspace: mockAzureWorkspace,
        analysesData: defaultAnalysesData,
        setLoading: jest.fn(),
      })
    );

    // Assert
    // Using getAll because there will also be a header in the body. Wondering if this also points to a refactor -
    // where the panel and the content are on the same level, rather than the panel being a parent of the content
    screen.getAllByText('Workflows in this workspace');
    screen.getByText('Submission history');
    screen.getByText('Find & add workflows');
    screen.getByText('Featured workflows');
    screen.getByText('Import a workflow');
    screen.getByText('Dockstore');
    screen.getByText('Have questions?');

    // Act
    const findAndAddWorkflowsCollapse = screen.getByText('Find & add workflows');
    const featuredWorkflows = screen.getByText('Featured workflows');
    const importWorkflows = screen.getByText('Import a workflow');

    await user.click(findAndAddWorkflowsCollapse);

    expect(featuredWorkflows).not.toBeInTheDocument();
    expect(importWorkflows).not.toBeInTheDocument();
  });

  it('is disabled when page is not ready', () => {
    render(
      h(WorkflowsAppNavPanel, {
        loading: false,
        launcherDisabled: true,
        launching: true,
        createWorkflowsApp: jest.fn(),
        pageReady: false,
        name: 'test-azure-ws-name',
        namespace: 'test-azure-ws-namespace',
        workspace: mockAzureWorkspace,
        analysesData: defaultAnalysesData,
        setLoading: jest.fn(),
      })
    );

    expect(screen.queryByText('Featured workflows')).not.toBeInTheDocument();
    expect(screen.queryByText('Import a workflow')).not.toBeInTheDocument();
    expect(screen.queryByText('Dockstore')).not.toBeInTheDocument();

    const workflowsInWorkspaceButton = screen.getAllByRole('button')[0];
    const submissionHistoryButton = screen.getAllByRole('button')[1];

    expect(workflowsInWorkspaceButton).toHaveAttribute('aria-disabled', 'true');
    expect(submissionHistoryButton).toHaveAttribute('aria-disabled', 'true');
  });

  it('disables find and add workflows when user is reader', async () => {
    await act(() =>
      render(
        h(WorkflowsAppNavPanel, {
          loading: false,
          launcherDisabled: true,
          launching: false,
          createWorkflowsApp: jest.fn(),
          pageReady: true,
          name: 'test-azure-ws-name',
          namespace: 'test-azure-ws-namespace',
          workspace: {
            ...mockAzureWorkspace,
            canCompute: false,
          },
          analysesData: defaultAnalysesData,
          setLoading: jest.fn(),
        })
      )
    );

    expect(screen.queryByText('Featured workflows')).not.toBeInTheDocument();
    expect(screen.queryByText('Import a workflow')).not.toBeInTheDocument();
    expect(screen.queryByText('Dockstore')).not.toBeInTheDocument();

    const workflowsInWorkspaceButton = screen.getAllByRole('button')[0];
    const submissionHistoryButton = screen.getAllByRole('button')[1];

    expect(workflowsInWorkspaceButton).not.toHaveAttribute('aria-disabled', 'true');
    expect(submissionHistoryButton).not.toHaveAttribute('aria-disabled', 'true');

    const findAndAddWorkflowsCollapse = screen.getByRole('button', { name: 'Find & add workflows' });

    expect(findAndAddWorkflowsCollapse).toHaveAttribute('aria-disabled', 'true');
  });

  it('renders loading placeholder when apps are unloaded', async () => {
    render(
      h(WorkflowsAppNavPanel, {
        loading: false,
        launcherDisabled: true,
        launching: false,
        createWorkflowsApp: jest.fn(),
        pageReady: false,
        name: 'test-azure-ws-name',
        namespace: 'test-azure-ws-namespace',
        workspace: mockAzureWorkspace,
        analysesData: defaultAnalysesData,
        setLoading: jest.fn(),
      })
    );

    expect(screen.getByText('Loading Workflows App')).toBeInTheDocument();
  });

  it('renders workflow launch card when page is not ready', async () => {
    const { rerender } = render(
      h(WorkflowsAppNavPanel, {
        loading: false,
        launcherDisabled: true,
        launching: false,
        createWorkflowsApp: jest.fn(),
        pageReady: false,
        name: 'test-azure-ws-name',
        namespace: 'test-azure-ws-namespace',
        workspace: mockAzureWorkspace,
        analysesData: defaultAnalysesDataWithAppsRefreshed,
        setLoading: jest.fn(),
      })
    );

    expect(screen.getByText('Launch Workflows app to run workflows')).toBeInTheDocument();

    // Re-render with pageReady: true
    await act(() => {
      rerender(
        h(WorkflowsAppNavPanel, {
          loading: false,
          launcherDisabled: true,
          launching: false,
          createWorkflowsApp: jest.fn(),
          pageReady: true,
          name: 'test-azure-ws-name',
          namespace: 'test-azure-ws-namespace',
          workspace: mockAzureWorkspace,
          analysesData: defaultAnalysesDataWithAppsRefreshed,
          setLoading: jest.fn(),
        })
      );
    });

    expect(screen.queryByText('Launch Workflows app to run workflows')).not.toBeInTheDocument();
  });

  it('renders an error screen when WORKFLOWS_APP is in error state', async () => {
    const analysesDataWithAppsInError: AnalysesData = {
      ...defaultAnalysesDataWithAppsRefreshed,
      apps: [
        {
          workspaceId: 'test-id',
          cloudContext: {
            cloudProvider: 'AZURE',
            cloudResource: 'test-resource',
          },
          kubernetesRuntimeConfig: {
            numNodes: 1,
            machineType: 'test-machine-type',
            autoscalingEnabled: false,
          },
          proxyUrls: {},
          diskName: 'test-disk',
          accessScope: 'test-scope',
          labels: {},
          region: 'test-region',
          appName: 'WORKFLOWS_APP',
          errors: [
            {
              errorMessage: 'Sample error message',
              timestamp: '2024-01-23T18:41:42.831Z',
              action: 'createApp',
              source: 'app',
              googleErrorCode: null,
              traceId: null,
            },
            {
              errorMessage: 'Second error message',
              timestamp: '2024-01-23T18:41:42.831Z',
              action: 'deleteApp',
              source: 'app',
              googleErrorCode: null,
              traceId: null,
            },
          ],
          status: 'ERROR',
          auditInfo: {
            creator: 'ssalahi@broadinstitute.org',
            createdDate: '2024-01-23T18:41:42.186232Z',
            destroyedDate: null,
            dateAccessed: '2024-01-23T18:41:42.186232Z',
          },
          appType: 'WORKFLOWS_APP',
        },
      ],
    };

    await act(() => {
      render(
        h(WorkflowsAppNavPanel, {
          loading: false,
          launcherDisabled: true,
          launching: false,
          createWorkflowsApp: jest.fn(),
          pageReady: true,
          name: 'test-azure-ws-name',
          namespace: 'test-azure-ws-namespace',
          workspace: mockAzureWorkspace,
          analysesData: analysesDataWithAppsInError,
          setLoading: jest.fn(),
        })
      );
    });

    expect(screen.getByText('Error launching Workflows app')).toBeInTheDocument();
    expect(screen.getByText('Sample error message')).toBeInTheDocument();
  });
});
