import { screen } from '@testing-library/react';
import { h } from 'react-hyperscript-helpers';
import { DataRepo, DataRepoContract, SnapshotBuilderSettings } from 'src/libs/ajax/DataRepo';
import { asMockedFn, renderWithAppContexts as render } from 'src/testing/test-utils';

import { DatasetBuilderDetails } from './DatasetBuilderDetails';
import { dummySnapshotBuilderSettings } from './TestConstants';

jest.mock('src/libs/nav', () => ({
  ...jest.requireActual('src/libs/nav'),
  getLink: jest.fn(),
  useRoute: jest.fn(),
}));

jest.mock('src/libs/ajax/GoogleStorage');
type DataRepoExports = typeof import('src/libs/ajax/DataRepo');
jest.mock('src/libs/ajax/DataRepo', (): DataRepoExports => {
  return {
    ...jest.requireActual('src/libs/ajax/DataRepo'),
    DataRepo: jest.fn(),
  };
});

describe('DatasetBuilderDetails', () => {
  const mockWithValues = (snapshotBuilderSettings: SnapshotBuilderSettings, snapshotRolesResponse: string[]) => {
    const snapshotBuilderSettingsMock = jest.fn((_include) => Promise.resolve(snapshotBuilderSettings));
    const datasetRolesMock = jest.fn(() => Promise.resolve(snapshotRolesResponse));
    asMockedFn(DataRepo).mockImplementation(
      () =>
        ({
          snapshot: (_snapshotId) =>
            ({
              roles: datasetRolesMock,
              getSnapshotBuilderSettings: snapshotBuilderSettingsMock,
            } as Partial<DataRepoContract['snapshot']>),
        } as Partial<DataRepoContract> as DataRepoContract)
    );
  };

  it('renders', async () => {
    // Arrange
    mockWithValues(dummySnapshotBuilderSettings(), ['aggregate_data_reader']);
    render(h(DatasetBuilderDetails, { snapshotId: 'id' }));
    // Assert
    expect(await screen.findByText('AnalytiXIN')).toBeTruthy();
    expect(await screen.findByText('Start creating datasets')).toBeTruthy();
  });

  it("renders the 'how to get access' button if discoverer", async () => {
    // Arrange
    mockWithValues(dummySnapshotBuilderSettings(), ['snapshot_creator']);
    render(h(DatasetBuilderDetails, { snapshotId: 'id' }));
    // Assert
    expect(await screen.findByText('AnalytiXIN')).toBeTruthy();
    expect(await screen.findByText('Learn how to gain access')).toBeTruthy();
  });
});
