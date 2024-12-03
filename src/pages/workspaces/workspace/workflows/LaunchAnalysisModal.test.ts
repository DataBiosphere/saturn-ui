import { asMockedFn, partial } from '@terra-ui-packages/test-utils';
import { act, screen } from '@testing-library/react';
import { h } from 'react-hyperscript-helpers';
import { WorkspaceContract, Workspaces, WorkspacesAjaxContract } from 'src/libs/ajax/workspaces/Workspaces';
import { isFeaturePreviewEnabled } from 'src/libs/feature-previews';
import { PREVIEW_COST_CAPPING } from 'src/libs/feature-previews-config';
import { chooseRootType } from 'src/pages/workspaces/workspace/workflows/EntitySelectionType';
import LaunchAnalysisModal from 'src/pages/workspaces/workspace/workflows/LaunchAnalysisModal';
import { renderWithAppContexts as render } from 'src/testing/test-utils';

jest.mock('src/libs/ajax/workspaces/Workspaces');

jest.mock('src/libs/feature-previews', () => ({
  ...jest.requireActual('src/libs/feature-previews'),
  isFeaturePreviewEnabled: jest.fn(),
}));

asMockedFn(isFeaturePreviewEnabled).mockImplementation((id) => id === PREVIEW_COST_CAPPING);

describe('Launch Analysis Modal', () => {
  const mockDefaultAjax = () => {
    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            checkBucketLocation: jest.fn().mockResolvedValue({ location: 'us-south', locationType: 'region' }),
          }),
      })
    );
  };

  it('reports workflow cost limit if set', async () => {
    // Arrange

    mockDefaultAjax();
    asMockedFn(isFeaturePreviewEnabled).mockReturnValue(true);

    const namespace = 'test-namespace';
    const name = 'test-workspace';
    const googleProject = 'google-project-id';
    const entityMetadata = {};
    const workspace = { workspace: { namespace, name, googleProject } };
    const config = { rootEntityType: 'sample' };
    const entitySelectionModel = {
      type: chooseRootType,
      newSetName: 'sampleSet',
      selectedEntities: [
        {
          sample1: {
            entityType: 'samples',
            name: 'sample1',
          },
        },
        {
          sample2: {
            entityType: 'samples',
            name: 'sample2',
          },
        },
      ],
    };

    const perWorkflowCostCap = '10.00';

    // Act
    await act(async () => {
      render(
        h(LaunchAnalysisModal, {
          workspace,
          entityMetadata,
          config,
          entitySelectionModel,
          perWorkflowCostCap,
          useCallCache: true,
          deleteIntermediateOutputFiles: false,
          useReferenceDisks: false,
          retryWithMoreMemory: false,
          retryMemoryFactor: 1.5,
          ignoreEmptyOutputs: false,
          enableResourceMonitoring: false,
          monitoringScript: '',
          monitoringImage: '',
          monitoringImageScript: '',
          onDismiss: jest.fn(),
          onSuccess: jest.fn(),
          processSingle: false,
        })
      );
    });

    // Assert
    expect(
      screen.getByText('You are launching 2 workflow runs in this submission', { exact: false })
    ).toBeInTheDocument();

    expect(screen.getByText('x 2 workflow runs = $20.00', { exact: false })).toBeInTheDocument();
  });

  it('reports only number of submissions if no cost limit set', async () => {
    // Arrange

    mockDefaultAjax();
    asMockedFn(isFeaturePreviewEnabled).mockReturnValue(true);

    const namespace = 'test-namespace';
    const name = 'test-workspace';
    const googleProject = 'google-project-id';
    const entityMetadata = {};
    const workspace = { workspace: { namespace, name, googleProject } };
    const config = { rootEntityType: 'sample' };
    const entitySelectionModel = {
      type: chooseRootType,
      newSetName: 'sampleSet',
      selectedEntities: [
        {
          sample1: {
            entityType: 'samples',
            name: 'sample1',
          },
        },
        {
          sample2: {
            entityType: 'samples',
            name: 'sample2',
          },
        },
      ],
    };

    const perWorkflowCostCap = '';

    // Act
    await act(async () => {
      render(
        h(LaunchAnalysisModal, {
          workspace,
          entityMetadata,
          config,
          entitySelectionModel,
          perWorkflowCostCap,
          useCallCache: true,
          deleteIntermediateOutputFiles: false,
          useReferenceDisks: false,
          retryWithMoreMemory: false,
          retryMemoryFactor: 1.5,
          ignoreEmptyOutputs: false,
          enableResourceMonitoring: false,
          monitoringScript: '',
          monitoringImage: '',
          monitoringImageScript: '',
          onDismiss: jest.fn(),
          onSuccess: jest.fn(),
          processSingle: false,
        })
      );
    });

    // Assert
    expect(
      screen.getByText('You are launching 2 workflow runs in this submission', { exact: false })
    ).toBeInTheDocument();

    expect(screen.getByText('You did not set a cost limit', { exact: false })).toBeInTheDocument();
  });
});
