import { generateTestDiskWithGoogleWorkspace } from 'src/analysis/_testData/testData';
import { leoDiskProvider, PersistentDisk } from 'src/libs/ajax/leonardo/providers/LeoDiskProvider';
import { Runtimes, RuntimesAjaxContract } from 'src/libs/ajax/leonardo/Runtimes';
import { asMockedFn, partial, renderHookInAct } from 'src/testing/test-utils';
import { defaultGoogleWorkspace, defaultInitializedGoogleWorkspace } from 'src/testing/workspace-fixtures';

import { useCloudEnvironmentPolling } from './useCloudEnvironmentPolling';

jest.mock('src/libs/ajax/leonardo/Runtimes');
jest.mock('src/libs/ajax/leonardo/providers/LeoDiskProvider');

// This code will be needed when we mock and test the runtime methods
type RuntimesNeeds = Pick<RuntimesAjaxContract, 'listV2'>;
interface RuntimeMockNeeds {
  topLevel: RuntimesNeeds;
}
interface AjaxMockNeeds {
  Runtimes: RuntimeMockNeeds;
}
/**
 * local test utility - sets up mocks for needed ajax data-calls with as much type-saftely as possible.
 *
 * @return collection of key data-call fns for easy
 * mock overrides and/or method spying/assertions
 */
const mockAjaxNeeds = (): AjaxMockNeeds => {
  const partialRuntimes: RuntimesNeeds = {
    listV2: jest.fn(),
  };
  const mockRuntimes = partial<RuntimesAjaxContract>(partialRuntimes);

  asMockedFn(Runtimes).mockReturnValue(mockRuntimes);

  return {
    Runtimes: {
      topLevel: partialRuntimes,
    },
  };
};

describe('useCloudEnvironmentPolling', () => {
  beforeAll(() => {
    mockAjaxNeeds();
  });
  it('calls list disk', async () => {
    // Arrange
    const appDisk = generateTestDiskWithGoogleWorkspace({}, defaultGoogleWorkspace);
    // Remove the label used to detect app disks
    const persistentDisk: PersistentDisk = {
      ...appDisk,
      labels: {
        saturnWorkspaceName: appDisk.labels.saturnWorkspaceName,
        saturnWorkspaceNamespace: appDisk.labels.saturnWorkspaceNamespace,
      },
    };
    asMockedFn(leoDiskProvider.list).mockResolvedValue([appDisk, persistentDisk]);

    // Act
    const { result } = await renderHookInAct(() =>
      useCloudEnvironmentPolling(
        defaultGoogleWorkspace.workspace.name,
        defaultGoogleWorkspace.workspace.namespace,
        defaultInitializedGoogleWorkspace
      )
    );

    // Assert
    // Runtimes and disk ajax calls
    expect(Runtimes).toBeCalledTimes(1);
    expect(leoDiskProvider.list).toBeCalledTimes(1);
    expect(result.current.persistentDisks).toEqual([persistentDisk]);
    expect(result.current.appDataDisks).toEqual([appDisk]);
  });
});
