import { delay } from '@terra-ui-packages/core-utils';
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';
import _ from 'lodash/fp';
import React from 'react';
import { Methods, MethodsAjaxContract } from 'src/libs/ajax/methods/Methods';
import { MethodResponse } from 'src/libs/ajax/methods/methods-models';
import { MethodDefinition } from 'src/libs/ajax/methods/methods-models';
import { postMethodProvider } from 'src/libs/ajax/methods/providers/PostMethodProvider';
import * as Nav from 'src/libs/nav';
import { getLink } from 'src/libs/nav';
import { notify } from 'src/libs/notifications';
import { TerraUser, TerraUserState, userStore } from 'src/libs/state';
import { WorkflowList } from 'src/pages/methods/WorkflowList';
import { asMockedFn, partial, renderWithAppContexts as render } from 'src/testing/test-utils';

jest.mock('src/libs/ajax/methods/Methods');

jest.mock('src/libs/notifications');
jest.mock('src/libs/nav', () => ({
  ...jest.requireActual('src/libs/nav'),
  getLink: jest.fn(() => '#methods'),
  goToPath: jest.fn(),
}));

type WDLEditorExports = typeof import('src/workflows/methods/WDLEditor');
jest.mock('src/workflows/methods/WDLEditor', (): WDLEditorExports => {
  const mockWDLEditorModule = jest.requireActual('src/workflows/methods/WDLEditor.mock');
  return {
    WDLEditor: mockWDLEditorModule.MockWDLEditor,
  };
});

// Space for tables is rendered based on the available space. In unit tests, there is no available space, and so we must mock out the space needed to get the data table to render.
jest.mock('react-virtualized', () => {
  const actual = jest.requireActual('react-virtualized');

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

const mockMethods = (methods: MethodDefinition[]): MethodsAjaxContract => {
  return partial<MethodsAjaxContract>({
    definitions: jest.fn(async () => methods),
  });
};

const mockUser = (email: string): Partial<TerraUser> => ({ email });

const mockUserState = (email: string): Partial<TerraUserState> => {
  return { terraUser: mockUser(email) as TerraUser };
};

const mockCreateMethodResponse: MethodResponse = {
  name: 'response-name',
  createDate: '2024-01-01T15:41:38Z',
  documentation: 'response docs',
  synopsis: 'response synopsis',
  entityType: 'Workflow',
  snapshotComment: 'response comment',
  snapshotId: 1,
  namespace: 'response-namespace',
  payload: 'workflow response {}',
  url: 'http://agora.dsde-dev.broadinstitute.org/api/v1/methods/sschu/response-test/1',
};

const darukMethod: MethodDefinition = {
  namespace: 'daruk rock namespace',
  name: 'daruk method',
  synopsis: 'daruk description',
  managers: ['daruk@protection.com', 'yunobo@goron.com'],
  public: true,
  numConfigurations: 11,
  numSnapshots: 11,
  entityType: 'Workflow',
};

const revaliMethod: MethodDefinition = {
  namespace: 'revali bird namespace',
  name: 'revali method',
  synopsis: 'revali description',
  managers: ['revali@gale.com'],
  public: true,
  numConfigurations: 10,
  numSnapshots: 2,
  entityType: 'Workflow',
};

const revaliMethod2: MethodDefinition = {
  namespace: 'revali bird namespace',
  name: 'revali method 2',
  synopsis: 'another revali description',
  managers: ['revali@gale.com', 'revali@champions.com'],
  public: true,
  numConfigurations: 2,
  numSnapshots: 1,
  entityType: 'Workflow',
};

const sortingMethod: MethodDefinition = {
  namespace: 'a namespace',
  name: 'sorting method',
  synopsis: 'great synopsis',
  managers: ['anemail@email.com'],
  public: true,
  numConfigurations: 1,
  numSnapshots: 10,
  entityType: 'Workflow',
};

const noSpacesMethod: MethodDefinition = {
  namespace: 'test-namespace',
  name: 'method-name',
  synopsis: 'synopsis',
  managers: ['email@email.com'],
  public: true,
  numConfigurations: 1,
  numSnapshots: 2,
  entityType: 'Workflow',
};

const revaliPrivateMethod: MethodDefinition = {
  namespace: 'revali private bird namespace',
  name: 'revali private method',
  synopsis: 'revali private description',
  managers: ['revali@gale.com'],
  public: false,
  numConfigurations: 1,
  numSnapshots: 4,
  entityType: 'Workflow',
};

const ganonPrivateMethod: MethodDefinition = {
  namespace: 'ganon private evil namespace',
  name: 'ganon private method',
  synopsis: 'ganon private description',
  managers: ['ganon@ganon.com'],
  public: false,
  numConfigurations: 1,
  numSnapshots: 5,
  entityType: 'Workflow',
};

const paginationMethods: MethodDefinition[] = _.flatMap(
  (suffix: string) => {
    return [
      {
        namespace: 'test namespace',
        name: `method ${suffix}`,
        synopsis: 'test synopsis',
        managers: ['test@test.com'],
        public: true,
        numConfigurations: 0,
        numSnapshots: 1,
        entityType: 'Workflow',
      },
      {
        namespace: 'test namespace',
        name: `method ${suffix}`,
        synopsis: 'test synopsis',
        managers: ['me@me.com'],
        public: false,
        numConfigurations: 0,
        numSnapshots: 1,
        entityType: 'Workflow',
      },
    ];
  },
  ['az', 'bz', 'cz', 'dz', 'ez', 'fz', 'gz', 'hz', 'iz', 'jz', 'kz', 'lz', 'm']
);

// Note: For these test cases, the user is assumed to be Revali
const tabMethodCountsTestCases: { methods: MethodDefinition[]; myMethodsCount: number; publicMethodsCount: number }[] =
  [
    { methods: [], myMethodsCount: 0, publicMethodsCount: 0 },
    { methods: [revaliPrivateMethod], myMethodsCount: 1, publicMethodsCount: 0 },
    { methods: [revaliMethod], myMethodsCount: 1, publicMethodsCount: 1 },
    { methods: [revaliMethod, darukMethod, revaliMethod2], myMethodsCount: 2, publicMethodsCount: 3 },
    {
      methods: [revaliMethod, darukMethod, revaliMethod2, revaliPrivateMethod],
      myMethodsCount: 3,
      publicMethodsCount: 3,
    },
  ];

describe('workflows table', () => {
  it('renders the search bar and tabs', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(mockMethods([]));

    // Act
    await act(async () => {
      render(<WorkflowList />);
    });

    // Assert
    expect(screen.getByPlaceholderText('SEARCH METHODS')).toBeInTheDocument();
    expect(screen.getByText('My Methods (0)')).toBeInTheDocument();
    expect(screen.getByText('Public Methods (0)')).toBeInTheDocument();

    expect(screen.queryByText('Featured Methods')).not.toBeInTheDocument();
  });

  it('renders the workflows table with method information', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(mockMethods([revaliMethod2]));

    // Act
    await act(async () => {
      render(<WorkflowList queryParams={{ tab: 'public' }} />);
    });

    const table: HTMLElement = await screen.findByRole('table');

    // Assert
    expect(table).toHaveAttribute('aria-colcount', '5');
    expect(table).toHaveAttribute('aria-rowcount', '2');

    const headers: HTMLElement[] = within(table).getAllByRole('columnheader');
    expect(headers).toHaveLength(5);
    expect(headers[0]).toHaveTextContent('Actions');
    expect(headers[1]).toHaveTextContent('Method');
    expect(headers[2]).toHaveTextContent('Synopsis');
    expect(headers[3]).toHaveTextContent('Owners');
    expect(headers[4]).toHaveTextContent('Snapshots');

    const rows: HTMLElement[] = within(table).getAllByRole('row');
    expect(rows).toHaveLength(2);

    const methodCells: HTMLElement[] = within(rows[1]).getAllByRole('cell');
    expect(methodCells).toHaveLength(5);
    within(methodCells[1]).getByText('revali bird namespace');
    within(methodCells[1]).getByText('revali method 2');
    expect(methodCells[2]).toHaveTextContent('another revali description');
    expect(methodCells[3]).toHaveTextContent('revali@gale.com, revali@champions.com');
    expect(methodCells[4]).toHaveTextContent('1');
  });

  it('displays a message with no my workflows', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(mockMethods([darukMethod]));

    // set the user's email
    jest.spyOn(userStore, 'get').mockImplementation(jest.fn().mockReturnValue(mockUserState('revali@gale.com')));

    // Act
    await act(async () => {
      render(<WorkflowList />);
    });

    // Assert
    expect(screen.getByText('Nothing to display')).toBeInTheDocument();
    expect(screen.queryByText('daruk method')).not.toBeInTheDocument();
  });

  it('displays only my workflows in the my methods tab', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(mockMethods([darukMethod, revaliMethod, revaliPrivateMethod]));

    // set the user's email
    jest.spyOn(userStore, 'get').mockImplementation(jest.fn().mockReturnValue(mockUserState('revali@gale.com')));

    // Act
    await act(async () => {
      render(<WorkflowList />);
    });

    // Assert
    expect(screen.queryByText('Nothing to display')).not.toBeInTheDocument();
    expect(screen.queryByText('daruk method')).not.toBeInTheDocument();
    expect(screen.getByText('revali method')).toBeInTheDocument();
    expect(screen.getByText('revali private method')).toBeInTheDocument();
  });

  it('displays a message with no public workflows', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(mockMethods([ganonPrivateMethod]));

    // set the user's email
    jest.spyOn(userStore, 'get').mockImplementation(jest.fn().mockReturnValue(mockUserState('ganon@ganon.com')));

    // Act
    await act(async () => {
      render(<WorkflowList queryParams={{ tab: 'public' }} />);
    });

    // Assert
    expect(screen.getByText('Nothing to display')).toBeInTheDocument();
    expect(screen.queryByText('ganon private method')).not.toBeInTheDocument();
  });

  it('displays only public workflows in the public methods tab', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(mockMethods([darukMethod, revaliMethod, ganonPrivateMethod]));

    // set the user's email
    jest.spyOn(userStore, 'get').mockImplementation(jest.fn().mockReturnValue(mockUserState('ganon@ganon.com')));

    // Act
    await act(async () => {
      render(<WorkflowList queryParams={{ tab: 'public' }} />);
    });

    // Assert
    expect(screen.queryByText('Nothing to display')).not.toBeInTheDocument();
    expect(screen.queryByText('ganon private method')).not.toBeInTheDocument();
    expect(screen.getByText('daruk method')).toBeInTheDocument();
    expect(screen.getByText('revali method')).toBeInTheDocument();
  });

  it.each(tabMethodCountsTestCases)(
    'provides accurate method counts in the tab display names',
    async ({ methods, myMethodsCount, publicMethodsCount }) => {
      // Arrange
      asMockedFn(Methods).mockReturnValue(mockMethods(methods));

      // set the user's email
      jest.spyOn(userStore, 'get').mockImplementation(jest.fn().mockReturnValue(mockUserState('revali@gale.com')));

      // Act
      await act(async () => {
        render(<WorkflowList />);
      });

      // Assert
      expect(screen.getByText(`My Methods (${myMethodsCount})`)).toBeInTheDocument();
      expect(screen.getByText(`Public Methods (${publicMethodsCount})`)).toBeInTheDocument();
    }
  );

  it("updates only the current tab's method count based on the filter", async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(mockMethods([revaliMethod, darukMethod, revaliMethod2, revaliPrivateMethod]));

    // set the user's email
    jest.spyOn(userStore, 'get').mockImplementation(jest.fn().mockReturnValue(mockUserState('revali@gale.com')));

    // Act
    await act(async () => {
      render(<WorkflowList queryParams={{ filter: '2' }} />);
    });

    // Assert

    // currently selected tab - count based on filter
    expect(screen.getByText('My Methods (1)')).toBeInTheDocument();

    // other tab - count not based on filter
    expect(screen.getByText('Public Methods (3)')).toBeInTheDocument();
  });

  it('filters workflows by namespace', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(mockMethods([darukMethod, revaliMethod]));

    // Act
    await act(async () => {
      render(<WorkflowList queryParams={{ tab: 'public', filter: 'rock' }} />);
    });

    // Assert
    expect(screen.queryByText('Nothing to display')).not.toBeInTheDocument();
    expect(screen.getByText('daruk method')).toBeInTheDocument();
    expect(screen.queryByText('revali method')).not.toBeInTheDocument();
  });

  it('filters workflows by name', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(mockMethods([darukMethod, revaliMethod, revaliMethod2]));

    // Act
    await act(async () => {
      render(<WorkflowList queryParams={{ tab: 'public', filter: 'revali method' }} />);
    });

    // Assert
    expect(screen.queryByText('Nothing to display')).not.toBeInTheDocument();
    expect(screen.queryByText('daruk method')).not.toBeInTheDocument();
    expect(screen.getByText('revali method')).toBeInTheDocument();
    expect(screen.getByText('revali method 2')).toBeInTheDocument();
  });

  it('filters workflows by namespace and name simultaneously', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(mockMethods([darukMethod, revaliMethod, revaliMethod2]));

    // Act
    await act(async () => {
      render(<WorkflowList queryParams={{ tab: 'public', filter: 'revali bird namespace/revali method' }} />);
    });

    // Assert
    expect(screen.queryByText('Nothing to display')).not.toBeInTheDocument();
    expect(screen.queryByText('daruk method')).not.toBeInTheDocument();
    expect(screen.getByText('revali method')).toBeInTheDocument();
    expect(screen.getByText('revali method 2')).toBeInTheDocument();
  });

  it('updates the query parameters when you click a tab', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(mockMethods([darukMethod, revaliMethod]));

    // set the user's email to ensure there are no my methods
    jest.spyOn(userStore, 'get').mockImplementation(jest.fn().mockReturnValue(mockUserState('test@test.com')));

    // should be called to switch tabs
    const navHistoryReplace = jest.spyOn(Nav.history, 'replace');

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(<WorkflowList queryParams={{ filter: 'test' }} />);
    });

    await user.click(screen.getByText('Public Methods (2)'));
    await user.click(screen.getByText('My Methods (0)'));

    // Assert
    expect(navHistoryReplace).toHaveBeenCalledTimes(2);

    // clicking a tab clears the search filter
    expect(navHistoryReplace).toHaveBeenCalledWith({ search: '?tab=public' });
  });

  it('updates the query parameters when you type in the search bar', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(mockMethods([darukMethod, revaliMethod]));

    // should be called after the user types in the search bar
    const navHistoryReplace = jest.spyOn(Nav.history, 'replace');

    // Act
    await act(async () => {
      render(<WorkflowList />);
    });

    fireEvent.change(screen.getByPlaceholderText('SEARCH METHODS'), { target: { value: 'mysearch' } });
    await act(() => delay(300)); // debounced search

    // Assert
    expect(navHistoryReplace).toHaveBeenCalledTimes(1);
    expect(navHistoryReplace).toHaveBeenCalledWith({ search: '?filter=mysearch' });
  });

  it('displays the search filter in the search bar', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(mockMethods([darukMethod]));

    // Act
    await act(async () => {
      render(<WorkflowList queryParams={{ filter: 'testfilter' }} />);
    });

    // Assert
    expect(screen.getByRole('searchbox')).toHaveProperty('value', 'testfilter');
  });

  it('sorts by method ascending by default', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(mockMethods([sortingMethod, darukMethod, revaliMethod, revaliMethod2]));

    // Act
    await act(async () => {
      render(<WorkflowList queryParams={{ tab: 'public' }} />);
    });

    // Assert
    checkOrder('daruk method', 'revali method', 'revali method 2', 'sorting method');
  });

  it('sorts by method descending', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(mockMethods([sortingMethod, darukMethod, revaliMethod, revaliMethod2]));

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(<WorkflowList queryParams={{ tab: 'public' }} />);
    });

    await user.click(screen.getByText('Method'));

    // Assert
    checkOrder('sorting method', 'revali method 2', 'revali method', 'daruk method');
  });

  it('sorts by synopsis ascending', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(mockMethods([sortingMethod, darukMethod, revaliMethod, revaliMethod2]));

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(<WorkflowList queryParams={{ tab: 'public' }} />);
    });

    await user.click(screen.getByText('Synopsis'));

    // Assert
    checkOrder('revali method 2', 'daruk method', 'sorting method', 'revali method');
  });

  it('sorts by synopsis descending', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(mockMethods([sortingMethod, darukMethod, revaliMethod, revaliMethod2]));

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(<WorkflowList queryParams={{ tab: 'public' }} />);
    });

    await user.click(screen.getByText('Synopsis'));
    await user.click(screen.getByText('Synopsis'));

    // Assert
    checkOrder('revali method', 'sorting method', 'daruk method', 'revali method 2');
  });

  it('sorts by owners ascending', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(mockMethods([sortingMethod, darukMethod, revaliMethod, revaliMethod2]));

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(<WorkflowList queryParams={{ tab: 'public' }} />);
    });

    await user.click(screen.getByText('Owners'));

    // Assert
    checkOrder('sorting method', 'daruk method', 'revali method', 'revali method 2');
  });

  it('sorts by owners descending', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(mockMethods([sortingMethod, darukMethod, revaliMethod, revaliMethod2]));

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(<WorkflowList queryParams={{ tab: 'public' }} />);
    });

    await user.click(screen.getByText('Owners'));
    await user.click(screen.getByText('Owners'));

    // Assert
    checkOrder('revali method 2', 'revali method', 'daruk method', 'sorting method');
  });

  it('sorts by snapshots ascending', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(mockMethods([sortingMethod, darukMethod, revaliMethod, revaliMethod2]));

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(<WorkflowList queryParams={{ tab: 'public' }} />);
    });

    await user.click(screen.getByText('Snapshots'));

    // Assert
    checkOrder('revali method 2', 'revali method', 'sorting method', 'daruk method');
  });

  it('sorts by snapshots descending', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(mockMethods([sortingMethod, darukMethod, revaliMethod, revaliMethod2]));

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(<WorkflowList queryParams={{ tab: 'public' }} />);
    });

    await user.click(screen.getByText('Snapshots'));
    await user.click(screen.getByText('Snapshots'));

    // Assert
    checkOrder('daruk method', 'sorting method', 'revali method', 'revali method 2');
  });

  it('displays a paginator with at least one displayed workflow', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(mockMethods([darukMethod]));

    // Act
    await act(async () => {
      render(<WorkflowList queryParams={{ tab: 'public' }} />);
    });

    // Assert
    expect(screen.getByLabelText('Items per page:')).toBeInTheDocument();
  });

  it('correctly uses the paginator to paginate workflows', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(mockMethods(paginationMethods));

    const user: UserEvent = userEvent.setup();

    // set the user's email
    jest.spyOn(userStore, 'get').mockImplementation(jest.fn().mockReturnValue(mockUserState('me@me.com')));

    // Act
    await act(async () => {
      render(<WorkflowList queryParams={{ tab: 'public', filter: 'z' }} />);
    });

    await user.selectOptions(screen.getByRole('combobox', { name: /items per page:/i }), '10');

    // Assert
    expect(screen.getByText('1 - 10 of 12 (filtered from 13 total)')).toBeInTheDocument();
    expect(screen.getByText('method az')).toBeInTheDocument();
    expect(screen.getByText('method jz')).toBeInTheDocument();
    expect(screen.queryByText('method kz')).not.toBeInTheDocument();

    // Act
    await user.click(screen.getByRole('button', { name: /next page/i }));

    // Assert
    expect(screen.getByText('11 - 12 of 12 (filtered from 13 total)')).toBeInTheDocument();
    expect(screen.queryByText('method az')).not.toBeInTheDocument();
    expect(screen.queryByText('method jz')).not.toBeInTheDocument();
    expect(screen.getByText('method kz')).toBeInTheDocument();
    expect(screen.getByText('method lz')).toBeInTheDocument();
    expect(screen.queryByText('method m')).not.toBeInTheDocument();
  });

  it('resets the table page when sorting', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(mockMethods(paginationMethods));

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(<WorkflowList queryParams={{ tab: 'public' }} />);
    });

    await user.selectOptions(screen.getByRole('combobox', { name: /items per page:/i }), '10');
    await user.click(screen.getByRole('button', { name: /next page/i }));

    // Assert
    expect(screen.getByText('11 - 13 of 13')).toBeInTheDocument();

    // Act
    await user.click(screen.getByText('Synopsis'));

    // Assert
    expect(screen.getByText('1 - 10 of 13')).toBeInTheDocument();
  });

  it('resets the table page when switching tabs', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(mockMethods(paginationMethods));

    // set the user's email
    jest.spyOn(userStore, 'get').mockImplementation(jest.fn().mockReturnValue(mockUserState('me@me.com')));

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(<WorkflowList />);
    });

    await user.selectOptions(screen.getByRole('combobox', { name: /items per page:/i }), '10');
    await user.click(screen.getByRole('button', { name: /next page/i }));

    // Assert
    expect(screen.getByText('11 - 13 of 13')).toBeInTheDocument();

    // Act
    await user.click(screen.getByText('Public Methods (13)'));

    // Assert

    // Note: the total workflow count (13) is actually still from
    // the previous tab just in the test because Nav cannot be
    // mocked properly to actually switch tabs when the public
    // methods tab is clicked
    expect(screen.getByText('1 - 10 of 13')).toBeInTheDocument();
  });

  it('resets the table page when typing in the search bar', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(mockMethods(paginationMethods));

    // set the user's email
    jest.spyOn(userStore, 'get').mockImplementation(jest.fn().mockReturnValue(mockUserState('me@me.com')));

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(<WorkflowList />);
    });

    await user.selectOptions(screen.getByRole('combobox', { name: /items per page:/i }), '10');
    await user.click(screen.getByRole('button', { name: /next page/i }));

    // Assert
    expect(screen.getByText('11 - 13 of 13')).toBeInTheDocument();

    // Act
    fireEvent.change(screen.getByPlaceholderText('SEARCH METHODS'), { target: { value: 'method' } });
    await act(() => delay(300)); // debounced search

    // Assert

    // Note: just in the test, this would be the text displayed
    // even if the search should filter out some of the workflows,
    // because Nav cannot be mocked properly to actually update
    // the filter when the value in the search bar changes
    expect(screen.getByText('1 - 10 of 13')).toBeInTheDocument();
  });

  it('displays a tooltip for namespace and method names', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(mockMethods([revaliMethod]));

    // set the user's email
    jest.spyOn(userStore, 'get').mockImplementation(jest.fn().mockReturnValue(mockUserState('revali@gale.com')));

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(<WorkflowList />);
    });

    await user.pointer({ target: screen.getByText('revali method') });

    // Assert
    expect(screen.getByRole('tooltip')).toHaveTextContent('revali bird namespace/revali method');
  });

  it('displays a tooltip for method synopsis', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(mockMethods([revaliMethod]));

    // set the user's email
    jest.spyOn(userStore, 'get').mockImplementation(jest.fn().mockReturnValue(mockUserState('revali@gale.com')));

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(<WorkflowList />);
    });

    const revaliDescriptionVisibleElementArray = screen
      .getAllByText('revali description')
      .filter((element) => !element.style.display.includes('none'));

    await user.pointer({ target: revaliDescriptionVisibleElementArray[0] });

    // Assert
    expect(revaliDescriptionVisibleElementArray).toHaveLength(1);
    expect(screen.getByRole('tooltip')).toHaveTextContent('revali description');
  });

  it('displays a tooltip for method owners', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(mockMethods([revaliMethod2]));

    // set the user's email
    jest.spyOn(userStore, 'get').mockImplementation(jest.fn().mockReturnValue(mockUserState('revali@gale.com')));

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(<WorkflowList />);
    });

    const revaliOwnersVisibleElementArray = screen
      .getAllByText('revali@gale.com, revali@champions.com')
      .filter((element) => !element.style.display.includes('none'));

    await user.pointer({ target: revaliOwnersVisibleElementArray[0] });

    // Assert
    expect(revaliOwnersVisibleElementArray).toHaveLength(1);
    expect(screen.getByRole('tooltip')).toHaveTextContent('revali@gale.com, revali@champions.com');
  });

  it('links on the method name to additional workflow details', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(mockMethods([noSpacesMethod]));

    asMockedFn(getLink).mockImplementation(
      (routeName: string, { namespace, name }: { namespace?: string; name?: string } = {}) =>
        `/${routeName}/${namespace}/${name}`
    );

    // Act
    await act(async () => {
      render(<WorkflowList queryParams={{ tab: 'public' }} />);
    });

    // Assert

    // This is not the correct path of the link on the actual site (due to
    // the mock), but is sufficient to verify that getLink is being called
    // with the correct parameters based on the method namespace and name
    expect(screen.getByText('method-name')).toHaveAttribute('href', '/workflow-dashboard/test-namespace/method-name');
  });

  it('shows a loading spinner while the workflows are loading', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(
      partial<MethodsAjaxContract>({
        definitions: jest.fn(async () => {
          await delay(100);
          return [];
        }),
      })
    );

    // Act
    await act(async () => {
      render(<WorkflowList />);
    });

    // Assert
    const spinner = document.querySelector('[data-icon="loadingSpinner"]');
    expect(spinner).toBeInTheDocument();

    // Act
    await act(async () => await delay(200));

    // Assert
    expect(spinner).not.toBeInTheDocument();
  });

  it('handles errors loading workflows', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(
      partial<MethodsAjaxContract>({
        definitions: jest.fn(async () => {
          throw new Error('BOOM');
        }),
      })
    );

    // Act
    await act(async () => {
      render(<WorkflowList />);
    });

    // Assert

    // tabs should not display method counts because their
    // true values are not known
    expect(screen.getByText('My Methods')).toBeInTheDocument();
    expect(screen.getByText('Public Methods')).toBeInTheDocument();

    expect(screen.getByText('Nothing to display')).toBeInTheDocument();
    expect(notify).toHaveBeenCalledWith('error', 'Error loading methods', expect.anything());
  });
});

describe('create workflow modal', () => {
  it('appears with the correct text and blank inputs when you press the create new method button', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(mockMethods([]));

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(<WorkflowList />);
    });

    await user.click(screen.getByRole('button', { name: 'Create New Method' }));

    // Assert
    const createWorkflowModal = screen.getByRole('dialog', { name: 'Create New Method' });

    expect(createWorkflowModal).toBeInTheDocument();
    expect(within(createWorkflowModal).getByText('Create New Method')).toBeInTheDocument();
    expect(within(createWorkflowModal).getByRole('button', { name: 'Upload' })).toBeInTheDocument();

    expect(within(createWorkflowModal).getByRole('textbox', { name: 'Namespace *' })).toHaveDisplayValue('');
    expect(within(createWorkflowModal).getByRole('textbox', { name: 'Name *' })).toHaveDisplayValue('');
    expect(within(createWorkflowModal).getByTestId('wdl editor')).toHaveDisplayValue('');
    expect(within(createWorkflowModal).getByRole('textbox', { name: 'Documentation' })).toHaveDisplayValue('');
    expect(
      within(createWorkflowModal).getByRole('textbox', { name: 'Synopsis (80 characters max)' })
    ).toHaveDisplayValue('');
    expect(within(createWorkflowModal).getByRole('textbox', { name: 'Snapshot comment' })).toHaveDisplayValue('');
  });

  it('uploads a new workflow and navigates to its workflow details page', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(mockMethods([]));

    jest.spyOn(postMethodProvider, 'postMethod').mockResolvedValue(mockCreateMethodResponse);

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(<WorkflowList />);
    });

    await user.click(screen.getByRole('button', { name: 'Create New Method' }));

    fireEvent.change(screen.getByRole('textbox', { name: 'Namespace *' }), { target: { value: 'testnamespace' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Name *' }), { target: { value: 'testname' } });
    fireEvent.change(screen.getByTestId('wdl editor'), { target: { value: 'workflow hi {}' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Documentation' }), { target: { value: 'docs' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Synopsis (80 characters max)' }), {
      target: { value: 'my synopsis' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Snapshot comment' }), { target: { value: 'comment' } });

    await user.click(screen.getByRole('button', { name: 'Upload' }));

    // Assert
    expect(postMethodProvider.postMethod).toHaveBeenCalled();

    expect(Nav.goToPath).toHaveBeenCalledWith('workflow-dashboard', {
      name: 'response-name',
      namespace: 'response-namespace',
      snapshotId: 1,
    });
  });

  it('closes when you press the cancel button', async () => {
    // Arrange
    asMockedFn(Methods).mockReturnValue(mockMethods([]));

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(<WorkflowList />);
    });

    await user.click(screen.getByRole('button', { name: 'Create New Method' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Assert
    expect(screen.queryByRole('dialog', { name: 'Create New Method' })).not.toBeInTheDocument();
  });
});

/**
 * Checks that the elements with the given text appear on the page in the
 * specified order.
 * @param {...string} elementsText - the text of the elements to check, in the
 * order that they should appear on the page
 */
const checkOrder = (...elementsText: string[]) => {
  const elements: HTMLElement[] = _.map((text) => screen.getByText(text), elementsText);

  for (let i = 0; i < elements.length - 1; i++) {
    expect(elements[i].compareDocumentPosition(elements[i + 1])).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  }
};
