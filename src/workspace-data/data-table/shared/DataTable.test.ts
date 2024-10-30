import { DeepPartial } from '@terra-ui-packages/core-utils';
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import _ from 'lodash/fp';
import { useState } from 'react';
import { h } from 'react-hyperscript-helpers';
import { EntityQueryResponse } from 'src/libs/ajax/data-table-providers/DataTableProvider';
import { EntityServiceDataTableProvider } from 'src/libs/ajax/data-table-providers/EntityServiceDataTableProvider';
import { Metrics, MetricsContract } from 'src/libs/ajax/Metrics';
import { WorkspaceContract, Workspaces, WorkspacesAjaxContract } from 'src/libs/ajax/workspaces/Workspaces';
import { asMockedFn, MockedFn, partial, renderWithAppContexts as render } from 'src/testing/test-utils';
import { defaultGoogleWorkspace } from 'src/testing/workspace-fixtures';

import DataTable from './DataTable';

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

const entityType = 'sample';
const entities = _.map(
  (n) => ({ entityType: 'sample', name: `sample_${n}`, attributes: { attr: n % 2 === 0 ? 'even' : 'odd' } }),
  _.range(0, 25)
);
const entityMetadata = {
  sample: {
    idName: 'sample_id',
    attributeNames: [],
    count: entities.length,
  },
};

type ReactVirtualizedExports = typeof import('react-virtualized');
jest.mock('react-virtualized', (): ReactVirtualizedExports => {
  const actual = jest.requireActual<ReactVirtualizedExports>('react-virtualized');

  const { AutoSizer } = actual;
  class MockAutoSizer extends AutoSizer {
    state = {
      height: 7000,
      width: 2000,
    };

    setState = () => {};
  }

  return {
    ...actual,
    AutoSizer: MockAutoSizer,
  };
});

const mockDataProvider = new EntityServiceDataTableProvider('test-namespace', 'test-workspace');

/**
 * TestHarness provides some of the same state management that EntitiesContent/WDSContent do in the app.
 */
const TestHarness = (props) => {
  const [selectedEntities, setSelectedEntities] = useState({});
  return h(DataTable, {
    ...props,
    selectionModel: {
      selected: selectedEntities,
      setSelected: setSelectedEntities,
    },
  });
};

describe('DataTable', () => {
  const paginatedEntitiesOfType: MockedFn<WorkspaceContract['paginatedEntitiesOfType']> = jest.fn();

  beforeAll(() => {
    paginatedEntitiesOfType.mockImplementation((_entityType, params) => {
      const { columnFilter, page = 1, pageSize } = params;

      let results = entities;
      let filteredCount = entities.length;

      if (columnFilter) {
        results = results.filter((e) => e.attributes.attr === 'even');
        filteredCount = results.length;
      }

      const offset = (page - 1) * pageSize;
      const limit = pageSize;
      results = results.slice(offset, offset + limit);

      return Promise.resolve(
        partial<EntityQueryResponse>({
          results,
          resultMetadata: {
            filteredCount,
            unfilteredCount: entities.length,
            filteredPageCount: Math.ceil(filteredCount / pageSize),
          },
        })
      );
    });

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
  });

  it('selects all', async () => {
    // Arrange
    const user = userEvent.setup();

    await act(async () => {
      render(
        h(TestHarness, {
          entityType,
          entityMetadata,
          setEntityMetadata: () => {},
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
          googleProject: defaultGoogleWorkspace.workspace.googleProject,
          workspaceId: {
            namespace: defaultGoogleWorkspace.workspace.namespace,
            name: defaultGoogleWorkspace.workspace.name,
          },
          onScroll: () => {},
          initialX: 0,
          initialY: 0,
          loadMetadata: () => {},
          childrenBefore: '',
          editable: false,
          activeCrossTableTextFilter: '',
          persist: '',
          refreshKey: 0,
          snapshotName: null,
          controlPanelStyle: '',
          border: true,
          extraColumnActions: '',
          dataProvider: mockDataProvider,
          defaultItemsPerPage: 10,
        })
      );
    });

    // Act

    // Select all entities
    const button = screen.getByRole('button', { name: '"Select All" options' });
    await user.click(button);

    const pageButton = screen.getByRole('button', { name: 'All (25)' });
    await user.click(pageButton);

    // Assert

    // Should include all rows + the 'Select all' check
    const allChecks = screen.getAllByRole('checkbox', { checked: true });
    expect(allChecks.length).toEqual(11);

    // Go to next page
    const nextPageButton = screen.getByRole('button', { name: 'Next page' });
    await user.click(nextPageButton);

    // Get the checkboxes on this page
    const newPageChecks = screen.getAllByRole('checkbox', { checked: true });
    expect(newPageChecks.length).toEqual(11);
  });

  it('selects page', async () => {
    // Arrange
    const user = userEvent.setup();

    await act(async () => {
      render(
        h(TestHarness, {
          entityType,
          entityMetadata,
          setEntityMetadata: () => {},
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
          googleProject: defaultGoogleWorkspace.workspace.googleProject,
          workspaceId: {
            namespace: defaultGoogleWorkspace.workspace.namespace,
            name: defaultGoogleWorkspace.workspace.name,
          },
          onScroll: () => {},
          initialX: 0,
          initialY: 0,
          loadMetadata: () => {},
          childrenBefore: '',
          editable: false,
          activeCrossTableTextFilter: '',
          persist: '',
          refreshKey: 0,
          snapshotName: null,
          controlPanelStyle: '',
          border: true,
          extraColumnActions: '',
          dataProvider: mockDataProvider,
          defaultItemsPerPage: 10,
        })
      );
    });

    // Act

    // Select page of entities
    const button = screen.getByRole('button', { name: '"Select All" options' });
    await user.click(button);

    const pageButton = screen.getByRole('button', { name: 'Page' });
    await user.click(pageButton);

    // Assert

    // Should include all rows + the 'Select all' check
    const allChecks = screen.getAllByRole('checkbox', { checked: true });
    expect(allChecks.length).toEqual(11);

    // Go to next page
    const nextPageButton = screen.getByRole('button', { name: 'Next page' });
    await user.click(nextPageButton);

    // Get the checkboxes on this page
    const newPageChecks = screen.getAllByRole('checkbox', { checked: false });
    expect(newPageChecks.length).toEqual(11);
  });

  it('passes filters to getPaginatedEntities', async () => {
    // Arrange
    const user = userEvent.setup();

    await act(async () => {
      render(
        h(TestHarness, {
          entityType,
          entityMetadata,
          setEntityMetadata: () => {},
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
          googleProject: defaultGoogleWorkspace.workspace.googleProject,
          workspaceId: {
            namespace: defaultGoogleWorkspace.workspace.namespace,
            name: defaultGoogleWorkspace.workspace.name,
          },
          onScroll: () => {},
          initialX: 0,
          initialY: 0,
          loadMetadata: () => {},
          childrenBefore: '',
          editable: false,
          activeCrossTableTextFilter: '',
          persist: '',
          refreshKey: 0,
          snapshotName: null,
          controlPanelStyle: '',
          border: true,
          extraColumnActions: '',
          dataProvider: mockDataProvider,
          defaultItemsPerPage: 10,
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

    // Select filtered entities
    const checkbox = screen.getByRole('button', { name: '"Select All" options' });
    await user.click(checkbox);

    const pageButton = screen.getByRole('button', { name: 'Filtered (13)' });
    await user.click(pageButton);

    expect(paginatedEntitiesOfType).toHaveBeenCalledWith(
      'sample',
      expect.objectContaining({ columnFilter: 'sample_id=even' })
    );
  });

  it('selects filtered', async () => {
    // Arrange
    const user = userEvent.setup();

    await act(async () => {
      render(
        h(TestHarness, {
          entityType,
          entityMetadata,
          setEntityMetadata: () => {},
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
          googleProject: defaultGoogleWorkspace.workspace.googleProject,
          workspaceId: {
            namespace: defaultGoogleWorkspace.workspace.namespace,
            name: defaultGoogleWorkspace.workspace.name,
          },
          onScroll: () => {},
          initialX: 0,
          initialY: 0,
          loadMetadata: () => {},
          childrenBefore: '',
          editable: false,
          activeCrossTableTextFilter: '',
          persist: '',
          refreshKey: 0,
          snapshotName: null,
          controlPanelStyle: '',
          border: true,
          extraColumnActions: '',
          dataProvider: mockDataProvider,
          defaultItemsPerPage: 10,
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

    // Select filtered entities
    const checkbox = screen.getByRole('button', { name: '"Select All" options' });
    await user.click(checkbox);

    const pageButton = screen.getByRole('button', { name: 'Filtered (13)' });
    await user.click(pageButton);

    // Should include all (filtered) entities + select all checkbox
    const allChecks = screen.getAllByRole('checkbox', { checked: true });
    expect(allChecks.length).toEqual(11);
  });
});
