import { DeepPartial } from '@terra-ui-packages/core-utils';
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as clipboard from 'clipboard-polyfill/text';
import FileSaver from 'file-saver';
import { h } from 'react-hyperscript-helpers';
import { EntityQueryResponse, EntityQueryResultMetadata } from 'src/libs/ajax/data-table-providers/DataTableProvider';
import { Metrics, MetricsContract } from 'src/libs/ajax/Metrics';
import { WorkspaceContract, Workspaces, WorkspacesAjaxContract } from 'src/libs/ajax/workspaces/Workspaces';
import { asMockedFn, MockedFn, partial, renderWithAppContexts as render } from 'src/testing/test-utils';
import { defaultGoogleWorkspace } from 'src/testing/workspace-fixtures';

import EntitiesContent from './EntitiesContent';

jest.mock('src/libs/ajax/GoogleStorage');
jest.mock('src/libs/ajax/Metrics');
jest.mock('src/libs/ajax/workspaces/Workspaces');

type ReactNotificationsComponentExports = typeof import('react-notifications-component');
jest.mock('react-notifications-component', (): DeepPartial<ReactNotificationsComponentExports> => {
  return {
    Store: {
      addNotification: jest.fn(),
      removeNotification: jest.fn(),
    },
  };
});

type ReactVirtualizedExports = typeof import('react-virtualized');
jest.mock('react-virtualized', (): ReactVirtualizedExports => {
  const actual = jest.requireActual<ReactVirtualizedExports>('react-virtualized');

  const { AutoSizer } = actual;
  class MockAutoSizer extends AutoSizer {
    state = {
      height: 1000,
      width: 1000,
    };

    setState = () => {};
  }

  return {
    ...actual,
    AutoSizer: MockAutoSizer,
  };
});

type ClipboardPolyfillExports = typeof import('clipboard-polyfill/text');
jest.mock('clipboard-polyfill/text', (): ClipboardPolyfillExports => {
  const actual = jest.requireActual<ClipboardPolyfillExports>('clipboard-polyfill/text');
  return {
    ...actual,
    writeText: jest.fn().mockResolvedValue(undefined),
  };
});

type FileSaveExports = typeof import('file-saver');
jest.mock('file-saver', (): FileSaveExports => {
  const actual = jest.requireActual<FileSaveExports>('file-saver');
  return {
    ...actual,
    saveAs: jest.fn().mockResolvedValue(undefined),
  };
});

describe('EntitiesContent', () => {
  it('copies to clipboard', async () => {
    // Arrange
    const user = userEvent.setup();

    const paginatedEntitiesOfType: MockedFn<WorkspaceContract['paginatedEntitiesOfType']> = jest.fn();
    paginatedEntitiesOfType.mockResolvedValue(
      partial<EntityQueryResponse>({
        results: [
          {
            entityType: 'sample',
            name: 'sample_1',
            attributes: {},
          },
        ],
        resultMetadata: partial<EntityQueryResultMetadata>({ filteredCount: 1, unfilteredCount: 1 }),
      })
    );
    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            paginatedEntitiesOfType,
          }),
      })
    );
    asMockedFn(Metrics).mockReturnValue(
      partial<MetricsContract>({
        captureEvent: async () => {},
      })
    );

    await act(async () => {
      render(
        h(EntitiesContent, {
          workspace: {
            ...defaultGoogleWorkspace,
            workspace: {
              ...defaultGoogleWorkspace.workspace,
              attributes: {},
            },
            workspaceSubmissionStats: {
              runningSubmissionsCount: 0,
            },
          },
          entityKey: 'sample',
          activeCrossTableTextFilter: '',
          entityMetadata: {
            sample: {
              idName: 'sample_id',
              attributeNames: [],
              count: 1,
            },
          },
          setEntityMetadata: () => {},
          loadMetadata: () => {},
          snapshotName: null,
          editable: false,
        })
      );
    });

    // Act

    // Select entity
    const checkbox = screen.getByRole('checkbox', { name: 'sample_1' });
    await user.click(checkbox);
    screen.getByText('1 row selected');

    // Copy to clipboard
    const exportButton = screen.getByText('Export');
    await user.click(exportButton);
    const copyMenuItem = screen.getByRole('menuitem', { name: 'Copy to clipboard' });
    const copyButton = within(copyMenuItem).getByRole('button');
    await user.click(copyButton);

    // Assert
    expect(clipboard.writeText).toHaveBeenCalledWith('entity:sample_id\nsample_1\n');
  });

  it('copies set table to clipboard', async () => {
    // Arrange
    const user = userEvent.setup();

    const paginatedEntitiesOfType: MockedFn<WorkspaceContract['paginatedEntitiesOfType']> = jest.fn();
    paginatedEntitiesOfType.mockResolvedValue(
      partial<EntityQueryResponse>({
        results: [
          {
            entityType: 'sample_set',
            name: 'sample_set_1',
            attributes: {
              samples: {
                itemsType: 'EntityReference',
                items: [
                  {
                    entityType: 'sample',
                    entityName: 'sample_1',
                  },
                  {
                    entityType: 'sample',
                    entityName: 'sample_2',
                  },
                ],
              },
            },
          },
        ],
        resultMetadata: partial<EntityQueryResultMetadata>({ filteredCount: 1, unfilteredCount: 1 }),
      })
    );

    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            paginatedEntitiesOfType,
          }),
      })
    );
    asMockedFn(Metrics).mockReturnValue(
      partial<MetricsContract>({
        captureEvent: async () => {},
      })
    );

    await act(async () => {
      render(
        h(EntitiesContent, {
          workspace: {
            ...defaultGoogleWorkspace,
            workspace: {
              ...defaultGoogleWorkspace.workspace,
              attributes: {},
            },
            workspaceSubmissionStats: {
              runningSubmissionsCount: 0,
            },
          },
          entityKey: 'sample_set',
          activeCrossTableTextFilter: '',
          entityMetadata: {
            sample_set: {
              idName: 'sample_set_id',
              attributeNames: ['samples'],
              count: 1,
            },
          },
          setEntityMetadata: () => {},
          loadMetadata: () => {},
          snapshotName: null,
          editable: false,
        })
      );
    });

    // Act

    // Select entity
    const checkbox = screen.getByRole('checkbox', { name: 'sample_set_1' });
    await user.click(checkbox);
    screen.getByText('1 row selected');

    // Copy to clipboard
    const exportButton = screen.getByText('Export');
    await user.click(exportButton);
    const copyMenuItem = screen.getByRole('menuitem', { name: 'Copy to clipboard' });
    const copyButton = within(copyMenuItem).getByRole('button');
    await user.click(copyButton);

    // Assert
    expect(clipboard.writeText).toHaveBeenCalledWith('entity:sample_set_id\nsample_set_1\n');
  });

  it('copies filtered table to clipboard', async () => {
    // Arrange
    const user = userEvent.setup();

    const paginatedEntitiesOfType: MockedFn<WorkspaceContract['paginatedEntitiesOfType']> = jest.fn();
    paginatedEntitiesOfType.mockResolvedValue(
      partial<EntityQueryResponse>({
        results: [
          {
            entityType: 'sample',
            name: 'sample_1',
            attributes: {},
          },
        ],
        resultMetadata: partial<EntityQueryResultMetadata>({ filteredCount: 1, unfilteredCount: 2 }),
      })
    );
    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            paginatedEntitiesOfType,
          }),
      })
    );
    asMockedFn(Metrics).mockReturnValue(
      partial<MetricsContract>({
        captureEvent: async () => {},
      })
    );

    await act(async () => {
      render(
        h(EntitiesContent, {
          workspace: {
            ...defaultGoogleWorkspace,
            workspace: {
              ...defaultGoogleWorkspace.workspace,
              attributes: {},
            },
            workspaceSubmissionStats: {
              runningSubmissionsCount: 0,
            },
          },
          entityKey: 'sample',
          activeCrossTableTextFilter: '',
          entityMetadata: {
            sample: {
              idName: 'sample_id',
              attributeNames: [],
              count: 2,
            },
          },
          setEntityMetadata: () => {},
          loadMetadata: () => {},
          snapshotName: null,
          editable: false,
        })
      );
    });

    // Act

    const columnMenu = screen.getByRole('button', { name: 'Column menu' });
    await user.click(columnMenu);

    // Filter
    fireEvent.change(screen.getByLabelText('Exact match filter'), { target: { value: 'even' } });

    const menuModal = screen.getByRole('dialog');
    const searchButton = within(menuModal).getByRole('button', { name: 'Search' });
    await user.click(searchButton);

    // Select filtered entity
    const checkbox = screen.getByRole('button', { name: '"Select All" options' });
    await user.click(checkbox);

    const pageButton = screen.getByRole('button', { name: 'Filtered (1)' });
    await user.click(pageButton);

    // Copy to clipboard
    const exportButton = screen.getByText('Export');
    await user.click(exportButton);
    const copyMenuItem = screen.getByRole('menuitem', { name: 'Copy to clipboard' });
    const copyButton = within(copyMenuItem).getByRole('button');
    await user.click(copyButton);

    // Assert
    expect(clipboard.writeText).toHaveBeenCalledWith('entity:sample_id\nsample_1\n');
  });

  it('downloads selection to tsv', async () => {
    // Arrange
    const user = userEvent.setup();

    const paginatedEntitiesOfType: MockedFn<WorkspaceContract['paginatedEntitiesOfType']> = jest.fn();
    paginatedEntitiesOfType.mockResolvedValue(
      partial<EntityQueryResponse>({
        results: [
          {
            entityType: 'sample',
            name: 'sample_1',
            attributes: {},
          },
        ],
        resultMetadata: partial<EntityQueryResultMetadata>({ filteredCount: 1, unfilteredCount: 1 }),
      })
    );
    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            paginatedEntitiesOfType,
          }),
      })
    );
    asMockedFn(Metrics).mockReturnValue(
      partial<MetricsContract>({
        captureEvent: async () => {},
      })
    );

    await act(async () => {
      render(
        h(EntitiesContent, {
          workspace: {
            ...defaultGoogleWorkspace,
            workspace: {
              ...defaultGoogleWorkspace.workspace,
              attributes: {},
            },
            workspaceSubmissionStats: {
              runningSubmissionsCount: 0,
            },
          },
          entityKey: 'sample',
          activeCrossTableTextFilter: '',
          entityMetadata: {
            sample: {
              idName: 'sample_id',
              attributeNames: [],
              count: 1,
            },
          },
          setEntityMetadata: () => {},
          loadMetadata: () => {},
          snapshotName: null,
          editable: false,
        })
      );
    });

    // Act

    // Select entity
    const checkbox = screen.getByRole('checkbox', { name: 'sample_1' });
    await user.click(checkbox);
    screen.getByText('1 row selected');

    // Download tsv
    const exportButton = screen.getByText('Export');
    await user.click(exportButton);
    const downloadMenuItem = screen.getByRole('menuitem', { name: 'Download as TSV' });
    const downloadButton = within(downloadMenuItem).getByRole('button');
    await user.click(downloadButton);

    // Assert
    expect(FileSaver.saveAs).toHaveBeenCalledWith(new Blob(['entity:sample_id\nsample_1\n']), 'sample.tsv');
  });

  it('downloads set table selection to tsv', async () => {
    // Arrange
    const user = userEvent.setup();

    const paginatedEntitiesOfType: MockedFn<WorkspaceContract['paginatedEntitiesOfType']> = jest.fn();
    paginatedEntitiesOfType.mockResolvedValue(
      partial<EntityQueryResponse>({
        results: [
          {
            entityType: 'sample_set',
            name: 'sample_set_1',
            attributes: {
              samples: {
                itemsType: 'EntityReference',
                items: [
                  {
                    entityType: 'sample',
                    entityName: 'sample_1',
                  },
                  {
                    entityType: 'sample',
                    entityName: 'sample_2',
                  },
                ],
              },
            },
          },
        ],
        resultMetadata: partial<EntityQueryResultMetadata>({ filteredCount: 1, unfilteredCount: 1 }),
      })
    );
    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            paginatedEntitiesOfType,
          }),
      })
    );
    asMockedFn(Metrics).mockReturnValue(
      partial<MetricsContract>({
        captureEvent: async () => {},
      })
    );

    await act(async () => {
      render(
        h(EntitiesContent, {
          workspace: {
            ...defaultGoogleWorkspace,
            workspace: {
              ...defaultGoogleWorkspace.workspace,
              attributes: {},
            },
            workspaceSubmissionStats: {
              runningSubmissionsCount: 0,
            },
          },
          entityKey: 'sample_set',
          activeCrossTableTextFilter: '',
          entityMetadata: {
            sample_set: {
              idName: 'sample_set_id',
              attributeNames: ['samples'],
              count: 1,
            },
          },
          setEntityMetadata: () => {},
          loadMetadata: () => {},
          snapshotName: null,
          editable: false,
        })
      );
    });

    // Act

    // Select entity
    const checkbox = screen.getByRole('checkbox', { name: 'sample_set_1' });
    await user.click(checkbox);
    screen.getByText('1 row selected');

    // Download tsv
    const exportButton = screen.getByText('Export');
    await user.click(exportButton);
    const downloadMenuItem = screen.getByRole('menuitem', { name: 'Download as TSV' });
    const downloadButton = within(downloadMenuItem).getByRole('button');
    await user.click(downloadButton);

    // Assert
    expect(FileSaver.saveAs).toHaveBeenCalledWith(
      new Blob(['membership:sample_set_id\\tsample\\nsample_set_1\\tsample_1\\nsample_set_1\\tsample_2']),
      'sample_set.zip'
    );
  });
});
