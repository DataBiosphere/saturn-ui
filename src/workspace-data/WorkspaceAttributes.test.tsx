import { delay } from '@terra-ui-packages/core-utils';
import { asMockedFn, MockedFn, partial } from '@terra-ui-packages/test-utils';
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { WorkspaceContract, Workspaces, WorkspacesAjaxContract } from 'src/libs/ajax/workspaces/Workspaces';
import { renderWithAppContexts as render } from 'src/testing/test-utils';
import { defaultGoogleWorkspace } from 'src/testing/workspace-fixtures';
import { WorkspaceWrapper } from 'src/workspaces/utils';

import { useWorkspaceDataAttributes } from './useWorkspaceDataAttributes';
import { WorkspaceAttributes } from './WorkspaceAttributes';

type UseWorkspaceDataAttributesExports = typeof import('./useWorkspaceDataAttributes');
jest.mock(
  './useWorkspaceDataAttributes',
  (): UseWorkspaceDataAttributesExports => ({
    ...jest.requireActual<UseWorkspaceDataAttributesExports>('./useWorkspaceDataAttributes'),
    useWorkspaceDataAttributes: jest.fn(),
  })
);

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

jest.mock('src/libs/ajax/workspaces/Workspaces');

describe('WorkspaceAttributes', () => {
  interface SetupArgs {
    attributes?: [string, unknown, string | undefined][];
    workspace?: WorkspaceWrapper;
  }

  const setup = (args: SetupArgs = {}): void => {
    const { attributes = [], workspace = defaultGoogleWorkspace } = args;

    const refresh = jest.fn().mockResolvedValue(Promise.resolve());

    asMockedFn(useWorkspaceDataAttributes).mockReturnValue([
      {
        state: attributes,
        status: 'Ready',
      },
      refresh,
    ]);

    render(<WorkspaceAttributes refreshKey={0} workspace={workspace} />);
  };

  it('loads and displays workspace data attributes', () => {
    // Arrange/Act
    setup({
      attributes: [
        ['attribute1', 'value1', 'description1'],
        ['attribute2', 'value2', 'description2'],
      ],
    });

    // Assert
    expect(useWorkspaceDataAttributes).toHaveBeenCalledWith(
      defaultGoogleWorkspace.workspace.namespace,
      defaultGoogleWorkspace.workspace.name
    );

    const rows = screen.getAllByRole('row');

    const firstRowCells = within(rows[1]).getAllByRole('cell');
    expect(firstRowCells.slice(1).map((el) => el.textContent)).toEqual([
      'attribute1',
      'value1',
      'description1Edit variable',
    ]);

    const secondRowCells = within(rows[2]).getAllByRole('cell');
    expect(secondRowCells.slice(1).map((el) => el.textContent)).toEqual([
      'attribute2',
      'value2',
      'description2Edit variable',
    ]);
  });

  it.each([
    { filter: 'f', expectedMatches: ['foo', 'baz'] },
    { filter: '2', expectedMatches: ['bar'] },
    { filter: 'def', expectedMatches: ['baz'] },
  ])('filters workspace data attributes by name, value, or description', async ({ filter, expectedMatches }) => {
    // Arrange
    setup({
      attributes: [
        ['foo', '1', undefined],
        ['bar', '2', 'abc'],
        ['baz', '3', 'def'],
      ],
    });

    // Act
    const filterInput = screen.getByLabelText('Search');
    fireEvent.change(filterInput, { target: { value: filter } });

    await act(() => delay(250)); // debounced input

    // Assert
    const rows = screen.getAllByRole('row').slice(1);
    const filteredAttributes = rows.map((row) => within(row).getAllByRole('cell')[1].textContent);

    expect(filteredAttributes).toEqual(expectedMatches);
  });

  it('has option to add a new variable', () => {
    // Arrange
    setup();

    // Act
    const editMenuButton = screen.getByRole('button', { name: 'Edit' });
    fireEvent.click(editMenuButton);

    const addVariableButton = screen.getByText('Add variable');
    fireEvent.click(addVariableButton);

    // Assert
    const rows = screen.getAllByRole('row');
    const inputs = within(rows[1]).getAllByRole('textbox');
    expect(inputs).toHaveLength(3);
  });

  it('disables edit menu for read-only workspaces', () => {
    // Arrange/Act
    setup({
      workspace: {
        ...defaultGoogleWorkspace,
        accessLevel: 'READER',
      },
    });

    // Assert
    const editMenuButton = screen.getByRole('button', { name: 'Edit' });
    expect(editMenuButton).toHaveAttribute('aria-disabled', 'true');
  });

  it('allows selecting and deleting attributes', async () => {
    // Arrange/Act
    const deleteAttributes: MockedFn<WorkspaceContract['deleteAttributes']> = jest.fn();
    deleteAttributes.mockResolvedValue(undefined);

    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () => partial<WorkspaceContract>({ deleteAttributes }),
      })
    );

    setup({
      attributes: [
        ['attribute1', 'value1', 'description1'],
        ['attribute2', 'value2', 'description2'],
        ['attribute3', 'value3', 'description3'],
      ],
    });

    // Act
    fireEvent.click(screen.getByRole('checkbox', { name: 'attribute2' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'attribute3' }));

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByText('Delete selected variables'));

    screen.getByText('Are you sure you want to delete the selected variables?');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete variables' }));
    });

    // Assert
    expect(deleteAttributes).toHaveBeenCalledWith([
      'attribute2',
      '__DESCRIPTION__attribute2',
      'attribute3',
      '__DESCRIPTION__attribute3',
    ]);
  });

  it('requires unique keys when editing', async () => {
    // Arrange
    setup({
      attributes: [
        ['attribute1', 'value1', 'description1'],
        ['attribute2', 'value2', 'description2'],
      ],
    });

    // Act
    const rows = screen.getAllByRole('row');
    const editMenuButton = within(rows[1]).getByRole('button', { name: 'Edit variable' });
    fireEvent.click(editMenuButton);

    const input = within(rows[1]).getAllByRole('textbox')[0];
    await userEvent.clear(input);
    await userEvent.type(input, 'attribute2');

    // Assert
    within(rows[1]).getByRole('button', { name: 'Key must be unique' });
  });
});
