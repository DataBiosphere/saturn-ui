import { asMockedFn, partial } from '@terra-ui-packages/test-utils';
import { screen } from '@testing-library/react';
import { act } from '@testing-library/react';
import { h } from 'react-hyperscript-helpers';
import { Apps, AppsAjaxContract } from 'src/libs/ajax/leonardo/Apps';
import { Runtimes, RuntimesAjaxContract } from 'src/libs/ajax/leonardo/Runtimes';
import { WorkspaceContract, Workspaces, WorkspacesAjaxContract } from 'src/libs/ajax/workspaces/Workspaces';
import { oidcStore } from 'src/libs/state';
import { Workflows } from 'src/pages/workspaces/workspace/Workflows';
import { renderWithAppContexts as render } from 'src/testing/test-utils';

jest.mock('src/libs/ajax/GoogleStorage');
jest.mock('src/libs/ajax/leonardo/Apps');
jest.mock('src/libs/ajax/leonardo/Runtimes');
jest.mock('src/libs/ajax/workspaces/Workspaces');
jest.mock('src/libs/ajax/leonardo/providers/LeoDiskProvider');

jest.mock('src/libs/nav', () => ({
  getCurrentUrl: jest.fn().mockReturnValue(new URL('https://app.terra.bio')),
  getLink: jest.fn(),
  goToPath: jest.fn(),
}));

jest.mock('src/libs/notifications', () => ({
  notify: jest.fn(),
}));

jest.spyOn(oidcStore, 'get').mockImplementation(
  jest.fn().mockReturnValue({
    userManager: { getUser: jest.fn() },
  })
);

describe('Workflows', () => {
  const mockGoogleWorkspace = {
    accessLevel: 'OWNER',
    owners: ['groot@gmail.com'],
    workspace: {
      attributes: {
        description: '',
      },
      authorizationDomain: [],
      billingAccount: 'billingAccounts/google-billing-account',
      bucketName: 'bucket-name',
      cloudPlatform: 'Gcp',
      completedCloneWorkspaceFileTransfer: '2024-11-27T22:29:04.319Z',
      createdBy: 'groot@gmail.com',
      createdDate: '2024-11-27T22:26:06.124Z',
      googleProject: 'google-project-id',
      isLocked: false,
      lastModified: '2024-11-27T22:26:06.202Z',
      name: 'groot-scientific-workflow',
      namespace: 'groot-namespace',
      workspaceId: 'google-workspace-id',
      workspaceType: 'rawls',
      workspaceVersion: 'v2',
    },
    canShare: true,
    canCompute: true,
    workspaceInitialized: true,
  };
  const mockStorageDetails = {
    fetchedLocation: 'SUCCESS',
  };

  const mockAjax = () => {
    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: (_namespace, _name) =>
          partial<WorkspaceContract>({
            details: jest.fn().mockResolvedValue(mockGoogleWorkspace),
            checkBucketReadAccess: jest.fn(),
            storageCostEstimate: jest.fn(),
            bucketUsage: jest.fn(),
            checkBucketLocation: jest.fn().mockResolvedValue(mockStorageDetails),
            listMethodConfigs: jest.fn(),
          }),
      })
    );

    asMockedFn(Runtimes).mockReturnValue(
      partial<RuntimesAjaxContract>({
        listV2: jest.fn(),
      })
    );

    asMockedFn(Apps).mockReturnValue(
      partial<AppsAjaxContract>({
        list: jest.fn().mockReturnValue([]),
      })
    );
  };

  it('loads Find Workflow card', async () => {
    // Arrange
    const namespace = 'groot-namespace';
    const name = 'groot-scientific-workflow';

    mockAjax();

    // Act
    await act(async () => {
      render(h(Workflows, { name, namespace }));
    });

    // Assert
    expect(screen.getByRole('button', { name: /find a workflow/i })).toBeInTheDocument();
  });
});
