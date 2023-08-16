import { DeepPartial } from '@terra-ui-packages/core-utils';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as clipboard from 'clipboard-polyfill/text';
import FileSaver from 'file-saver';
import { h } from 'react-hyperscript-helpers';
import { defaultGoogleWorkspace } from 'src/analysis/_testData/testData';
import { Ajax } from 'src/libs/ajax';
import { asMockedFn } from 'src/testing/test-utils';

import EntitiesContent from './EntitiesContent';

type AjaxContract = ReturnType<typeof Ajax>;

jest.mock('src/libs/ajax');

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

    const paginatedEntitiesOfType = jest.fn().mockResolvedValue({
      results: [
        {
          entityType: 'sample',
          name: 'sample_1',
          attributes: {},
        },
      ],
      resultMetadata: { filteredCount: 1, unfilteredCount: 1 },
    });
    const mockAjax: DeepPartial<AjaxContract> = {
      Workspaces: {
        workspace: () => {
          return {
            paginatedEntitiesOfType,
          };
        },
      },
      Metrics: {
        captureEvent: () => {},
      },
    };
    asMockedFn(Ajax).mockImplementation(() => mockAjax as AjaxContract);

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
          deleteColumnUpdateMetadata: () => {},
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

    const paginatedEntitiesOfType = jest.fn().mockResolvedValue({
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
      resultMetadata: { filteredCount: 1, unfilteredCount: 1 },
    });
    const mockAjax: DeepPartial<AjaxContract> = {
      Workspaces: {
        workspace: () => {
          return {
            paginatedEntitiesOfType,
          };
        },
      },
      Metrics: {
        captureEvent: () => {},
      },
    };
    asMockedFn(Ajax).mockImplementation(() => mockAjax as AjaxContract);

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
          deleteColumnUpdateMetadata: () => {},
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
    expect(clipboard.writeText).toHaveBeenCalledWith(
      'membership:sample_set_id\tsample\nsample_set_1\tsample_1\nsample_set_1\tsample_2\n'
    );
  });

  it('downloads selection to tsv', async () => {
    // Arrange
    const user = userEvent.setup();

    const paginatedEntitiesOfType = jest.fn().mockResolvedValue({
      results: [
        {
          entityType: 'sample',
          name: 'sample_1',
          attributes: {},
        },
      ],
      resultMetadata: { filteredCount: 1, unfilteredCount: 1 },
    });
    const mockAjax: DeepPartial<AjaxContract> = {
      Workspaces: {
        workspace: () => {
          return {
            paginatedEntitiesOfType,
          };
        },
      },
      Metrics: {
        captureEvent: () => {},
      },
    };
    asMockedFn(Ajax).mockImplementation(() => mockAjax as AjaxContract);

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
          deleteColumnUpdateMetadata: () => {},
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

    const paginatedEntitiesOfType = jest.fn().mockResolvedValue({
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
      resultMetadata: { filteredCount: 1, unfilteredCount: 1 },
    });
    const mockAjax: DeepPartial<AjaxContract> = {
      Workspaces: {
        workspace: () => {
          return {
            paginatedEntitiesOfType,
          };
        },
      },
      Metrics: {
        captureEvent: () => {},
      },
    };
    asMockedFn(Ajax).mockImplementation(() => mockAjax as AjaxContract);

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
          deleteColumnUpdateMetadata: () => {},
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
