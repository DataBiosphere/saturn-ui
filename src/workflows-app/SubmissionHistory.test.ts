import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { div, h } from 'react-hyperscript-helpers';
import { MenuTrigger } from 'src/components/PopupTrigger';
import { Apps, AppsAjaxContract } from 'src/libs/ajax/leonardo/Apps';
import { SamUserRegistrationStatusResponse, User, UserContract } from 'src/libs/ajax/User';
import { Cbas, CbasAjaxContract, CbasRunSetsContract } from 'src/libs/ajax/workflows-app/Cbas';
import { WorkspaceWrapper } from 'src/libs/ajax/workspaces/workspace-models';
import { getConfig } from 'src/libs/config';
import { asMockedFn, MockedFn, partial, renderWithAppContexts as render, SelectHelper } from 'src/testing/test-utils';
import { BaseSubmissionHistory } from 'src/workflows-app/SubmissionHistory';
import { mockAbortResponse, mockAzureApps, mockAzureWorkspace } from 'src/workflows-app/utils/mock-responses';

// Necessary to mock the AJAX module.
jest.mock('src/libs/ajax/leonardo/Apps');
jest.mock('src/libs/ajax/User');
jest.mock('src/libs/ajax/workflows-app/Cbas');

jest.mock('src/libs/notifications');
jest.mock('src/libs/ajax/leonardo/Apps');
jest.mock('src/libs/nav', () => ({
  getCurrentUrl: jest.fn().mockReturnValue(new URL('https://app.terra.bio')),
  getLink: jest.fn(),
  goToPath: jest.fn(),
}));
jest.mock('src/components/PopupTrigger', () => {
  const originalModule = jest.requireActual('src/components/PopupTrigger');
  return {
    ...originalModule,
    MenuTrigger: jest.fn(),
  };
});
// Mocking feature preview setup
jest.mock('src/libs/feature-previews', () => ({
  ...jest.requireActual('src/libs/feature-previews'),
  isFeaturePreviewEnabled: jest.fn(),
}));
jest.mock('src/libs/config', () => ({
  ...jest.requireActual('src/libs/config'),
  getConfig: jest.fn().mockReturnValue({}),
}));
jest.mock('src/libs/state', () => ({
  ...jest.requireActual('src/libs/state'),
  getTerraUser: jest.fn(),
}));

// SubmissionHistory component uses AutoSizer to determine the right size for table to be displayed. As a result we need to
// mock out the height and width so that when AutoSizer asks for the width and height of "browser" it can use the mocked
// values and render the component properly. Without this the tests will be break.
// (see https://github.com/bvaughn/react-virtualized/issues/493 and https://stackoverflow.com/a/62214834)
const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight') || {
  value: undefined,
};
const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth') || {
  value: undefined,
};

const runSetData = {
  run_sets: [
    {
      error_count: 0,
      submission_timestamp: '2022-01-01T12:00:00.000+00:00',
      last_modified_timestamp: '2022-01-02T13:01:01.000+00:00',
      record_type: 'FOO',
      run_count: 1,
      run_set_id: 'ea001565-1cd6-4e43-b446-932ac1918081',
      state: 'COMPLETE',
    },
    {
      error_count: 1,
      submission_timestamp: '2021-07-10T12:00:00.000+00:00',
      last_modified_timestamp: '2021-08-11T13:01:01.000+00:00',
      record_type: 'FOO',
      run_count: 2,
      run_set_id: 'b7234aae-6f43-405e-bb3a-71f924e09825',
      state: 'ERROR',
    },
  ],
};

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 1000 });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 800 });

  asMockedFn(Apps).mockReturnValue(
    partial<AppsAjaxContract>({
      // TODO: fix mockAzureApps type to match return type of listAppsV2
      listAppsV2: jest.fn(async () => mockAzureApps as any),
    })
  );
  asMockedFn(User).mockReturnValue(
    partial<UserContract>({
      getStatus: jest.fn(async () =>
        partial<SamUserRegistrationStatusResponse>({
          userSubjectId: 'user-id-blah-blah',
        })
      ),
    })
  );
});

const cbasUrlRoot = 'https://lz-abc/terra-app-abc/cbas';
const cromwellUrlRoot = 'https://lz-abc/terra-app-abc/cromwell';

beforeEach(() => {
  asMockedFn(getConfig).mockReturnValue({ cbasUrlRoot, cromwellUrlRoot });
  asMockedFn(MenuTrigger).mockImplementation(({ content }) => {
    return div({ role: 'menu' }, [content]);
  });
});

afterAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
});

// Note: Since the timestamps in the data is being converted to Local timezone, it returns different time when the tests
//       are run locally and in GitHub action. Hence everywhere in this file we are verifying only the date format for now.
describe('SubmissionHistory tab', () => {
  const headerPosition = {
    Actions: 0,
    Submission: 1,
    Status: 2,
    'Date Submitted': 3,
    Duration: 4,
    Submitter: 5,
    Comment: 6,
  };

  it('should sort columns properly', async () => {
    const user = userEvent.setup();
    const getRunSetsMethod: MockedFn<CbasRunSetsContract['get']> = jest.fn(async (_root) => runSetData);

    asMockedFn(Cbas).mockReturnValue(
      partial<CbasAjaxContract>({
        runSets: partial<CbasRunSetsContract>({
          get: getRunSetsMethod,
        }),
      })
    );

    // Act
    await act(async () => {
      render(
        h(BaseSubmissionHistory, {
          name: 'test-azure-ws-name',
          namespace: 'test-azure-ws-namespace',
          workspace: mockAzureWorkspace,
        })
      );
    });

    expect(screen.getByRole('table')).toBeInTheDocument();

    const table = await screen.findByRole('table');

    const rows = within(table).getAllByRole('row');
    expect(rows.length).toBe(3);

    const headers = within(rows[0]).getAllByRole('columnheader');
    expect(headers.length).toBe(7);

    const topRowCells = (column) => {
      const topRowCells = within(rows[1]).getAllByRole('cell');
      return topRowCells[column];
    };
    // Click on "Date Submitted" column and check that the top column is correct for:
    // * ascending order
    await user.click(await within(headers[headerPosition['Date Submitted']]).getByRole('button'));
    within(topRowCells(headerPosition['Date Submitted'])).getByText(/Jul 10, 2021/);

    // * descending order
    await user.click(await within(headers[headerPosition['Date Submitted']]).getByRole('button'));
    within(topRowCells(headerPosition['Date Submitted'])).getByText(/Jan 1, 2022/);

    // Click on "Status" column and check that the top column is correct for:
    // * ascending order
    await user.click(await within(headers[headerPosition.Status]).getByRole('button'));
    within(topRowCells(headerPosition.Status)).getByText('Success');

    // * descending order
    await user.click(await within(headers[headerPosition.Status]).getByRole('button'));
    within(topRowCells(headerPosition.Status)).getByText('Failed with 1 errors');

    // Click on "Duration" column and check that the top column is correct for:
    // * ascending order
    await user.click(await within(headers[headerPosition.Duration]).getByRole('button'));
    within(topRowCells(headerPosition.Duration)).getByText('1 day 1 hour 1 minute 1 second');

    // * descending order
    await user.click(await within(headers[headerPosition.Duration]).getByRole('button'));
    within(topRowCells(headerPosition.Duration)).getByText('1 month 1 day 1 hour 1 minute 1 second');
  });

  it('should display no content message when there are no previous run sets', async () => {
    // Arrange
    const mockRunSetResponse: MockedFn<CbasRunSetsContract['get']> = jest.fn(async (_root) => []);

    asMockedFn(Cbas).mockReturnValue(
      partial<CbasAjaxContract>({
        runSets: partial<CbasRunSetsContract>({
          get: mockRunSetResponse,
        }),
      })
    );

    // Act
    await act(async () => {
      render(
        h(BaseSubmissionHistory, {
          name: 'test-azure-ws-name',
          namespace: 'test-azure-ws-namespace',
          workspace: mockAzureWorkspace,
        })
      );
    });

    // Assert
    expect(mockRunSetResponse).toBeCalled();

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    screen.getByText(/No workflows have been submitted./i);
  });

  it('should correctly display previous 2 run sets', async () => {
    // Arrange
    const getRunSetsMethod: MockedFn<CbasRunSetsContract['get']> = jest.fn(async (_root) => runSetData);

    asMockedFn(Cbas).mockReturnValue(
      partial<CbasAjaxContract>({
        runSets: partial<CbasRunSetsContract>({
          get: getRunSetsMethod,
        }),
      })
    );

    // Act
    await act(async () => {
      render(
        h(BaseSubmissionHistory, {
          name: 'test-azure-ws-name',
          namespace: 'test-azure-ws-namespace',
          workspace: mockAzureWorkspace,
        })
      );
    });

    screen.getByText(/See workflows that were submitted by all collaborators in this workspace./i);
    expect(screen.getByRole('table')).toBeInTheDocument();

    const table = await screen.findByRole('table');

    // Assert
    expect(table).toHaveAttribute('aria-colcount', '7');
    expect(table).toHaveAttribute('aria-rowcount', '3');

    const rows = within(table).getAllByRole('row');
    expect(rows.length).toBe(3);

    const headers = within(rows[0]).getAllByRole('columnheader');
    expect(headers.length).toBe(7);
    within(headers[headerPosition.Actions]).getByText('Actions');
    within(headers[headerPosition.Submission]).getByText('Submission name');
    within(headers[headerPosition.Status]).getByText('Status');
    within(headers[headerPosition['Date Submitted']]).getByText('Date Submitted');
    within(headers[headerPosition.Duration]).getByText('Duration');
    within(headers[headerPosition.Comment]).getByText('Comment');

    // check data rows are rendered as expected
    const cellsFromDataRow1 = within(rows[1]).getAllByRole('cell');
    expect(cellsFromDataRow1.length).toBe(7);
    within(headers[headerPosition.Actions]).getByText('Actions');
    within(cellsFromDataRow1[headerPosition.Submission]).getByText('Data used: FOO');
    within(cellsFromDataRow1[headerPosition.Submission]).getByText('1 workflows');
    within(cellsFromDataRow1[headerPosition.Status]).getByText('Success');
    within(cellsFromDataRow1[headerPosition['Date Submitted']]).getByText(/Jan 1, 2022/);
    within(cellsFromDataRow1[headerPosition.Duration]).getByText('1 day 1 hour 1 minute 1 second');

    const cellsFromDataRow2 = within(rows[2]).getAllByRole('cell');
    expect(cellsFromDataRow2.length).toBe(7);
    within(headers[headerPosition.Actions]).getByText('Actions');
    within(cellsFromDataRow2[headerPosition.Submission]).getByText('Data used: FOO');
    within(cellsFromDataRow2[headerPosition.Status]).getByText('Failed with 1 errors');
    within(cellsFromDataRow2[headerPosition['Date Submitted']]).getByText(/Jul 10, 2021/);
    within(cellsFromDataRow2[headerPosition.Duration]).getByText('1 month 1 day 1 hour 1 minute 1 second');
  });

  it('should support canceled, canceling and queued submissions', async () => {
    const runSetData = {
      run_sets: [
        {
          error_count: 0,
          submission_timestamp: '2022-01-01T12:00:00.000+00:00',
          last_modified_timestamp: '2022-01-02T13:01:01.000+00:00',
          record_type: 'FOO',
          run_count: 1,
          run_set_id: 'ea001565-1cd6-4e43-b446-932ac1918081',
          state: 'CANCELED',
        },
        {
          error_count: 0,
          submission_timestamp: '2021-07-10T12:00:00.000+00:00',
          last_modified_timestamp: '2021-08-11T13:01:01.000+00:00',
          record_type: 'FOO',
          run_count: 2,
          run_set_id: 'b7234aae-6f43-405e-bb3a-71f924e09825',
          state: 'CANCELING',
        },
        {
          error_count: 0,
          submission_timestamp: '2021-07-10T12:00:00.000+00:00',
          last_modified_timestamp: '2021-08-11T13:01:01.000+00:00',
          record_type: 'FOO',
          run_count: 5,
          run_set_id: '97e04fd6-bbd4-49d4-942d-4e91edc3c3f8',
          state: 'QUEUED',
        },
      ],
    };

    const getRunSetsMethod: MockedFn<CbasRunSetsContract['get']> = jest.fn(async (_root) => runSetData);

    asMockedFn(Cbas).mockReturnValue(
      partial<CbasAjaxContract>({
        runSets: partial<CbasRunSetsContract>({
          get: getRunSetsMethod,
        }),
      })
    );

    // Act
    await act(async () => {
      render(
        h(BaseSubmissionHistory, {
          name: 'test-azure-ws-name',
          namespace: 'test-azure-ws-namespace',
          workspace: mockAzureWorkspace,
        })
      );
    });

    expect(screen.getByRole('table')).toBeInTheDocument();

    const table = await screen.findByRole('table');

    // Assert
    expect(table).toHaveAttribute('aria-colcount', '7');
    expect(table).toHaveAttribute('aria-rowcount', '4');

    const rows = within(table).getAllByRole('row');
    expect(rows.length).toBe(4);

    // check data rows are rendered as expected
    const cellsFromDataRow1 = within(rows[1]).getAllByRole('cell');
    within(cellsFromDataRow1[headerPosition.Status]).getByText('Canceled');

    const cellsFromDataRow2 = within(rows[2]).getAllByRole('cell');
    within(cellsFromDataRow2[headerPosition.Status]).getByText('Canceling');

    const cellsFromDataRow3 = within(rows[3]).getAllByRole('cell');
    within(cellsFromDataRow3[headerPosition.Status]).getByText('Queued');
  });

  const simpleRunSetData = {
    run_sets: [
      {
        error_count: 0,
        submission_timestamp: '2022-01-01T12:00:00.000+00:00',
        last_modified_timestamp: '2022-01-02T13:01:01.000+00:00',
        record_type: 'FOO',
        run_count: 1,
        run_set_id: '20000000-0000-0000-0000-200000000002',
        state: 'RUNNING',
        user_id: 'foo',
      },
    ],
    fully_updated: true,
  };

  const queuedRunSetData = {
    run_sets: [
      {
        error_count: 0,
        submission_timestamp: '2022-01-01T12:00:00.000+00:00',
        last_modified_timestamp: '2022-01-02T13:01:01.000+00:00',
        record_type: 'FOO',
        run_count: 1,
        run_set_id: '20000000-0000-0000-0000-200000000002',
        state: 'QUEUED',
        user_id: 'foo',
      },
    ],
    fully_updated: true,
  };

  it('should correctly set default option', async () => {
    // Act
    await act(async () => {
      render(
        h(BaseSubmissionHistory, {
          name: 'test-azure-ws-name',
          namespace: 'test-azure-ws-namespace',
          workspace: mockAzureWorkspace,
        })
      );
    });

    screen.getByText(/None selected/);
  });

  it('should correctly select and change results', async () => {
    const user = userEvent.setup();
    const getRunSetsMethod: MockedFn<CbasRunSetsContract['get']> = jest.fn(async (_root) => runSetData);

    asMockedFn(Cbas).mockReturnValue(
      partial<CbasAjaxContract>({
        runSets: partial<CbasRunSetsContract>({
          get: getRunSetsMethod,
        }),
      })
    );

    // Act
    await act(async () => {
      render(
        h(BaseSubmissionHistory, {
          name: 'test-azure-ws-name',
          namespace: 'test-azure-ws-namespace',
          workspace: mockAzureWorkspace,
        })
      );
    });

    expect(getRunSetsMethod).toHaveBeenCalled();

    const dropdown = await screen.findByLabelText('Filter selection');
    const filterDropdown = new SelectHelper(dropdown, user);
    await filterDropdown.selectOption('Failed');

    const table = await screen.findByRole('table');

    // Assert
    expect(table).toHaveAttribute('aria-colcount', '7');
    expect(table).toHaveAttribute('aria-rowcount', '2');

    const rows = within(table).getAllByRole('row');
    expect(rows.length).toBe(2);

    const headers = within(rows[0]).getAllByRole('columnheader');
    expect(headers.length).toBe(7);
    within(headers[0]).getByText('Actions');
    within(headers[1]).getByText('Submission name');
    within(headers[2]).getByText('Status');
    within(headers[3]).getByText('Date Submitted');
    within(headers[4]).getByText('Duration');
    within(headers[5]).getByText('Submitter');
    within(headers[6]).getByText('Comment');

    // // check data rows are rendered as expected
    const cellsFromDataRow1 = within(rows[1]).getAllByRole('cell');
    expect(cellsFromDataRow1.length).toBe(7);
    within(cellsFromDataRow1[0]).getByText('Abort');
    within(cellsFromDataRow1[1]).getByText('No name');
    within(cellsFromDataRow1[1]).getByText('Data used: FOO');
    within(cellsFromDataRow1[1]).getByText('2 workflows');
    within(cellsFromDataRow1[2]).getByText('Failed with 1 errors');
    within(cellsFromDataRow1[3]).getByText('Jul 10, 2021, 12:00 PM');
    within(cellsFromDataRow1[4]).getByText('1 month 1 day 1 hour 1 minute 1 second');
    within(cellsFromDataRow1[6]).getByText('No Description');
  });

  it('Gives abort option for actions button', async () => {
    const user = userEvent.setup();
    const getRunSetsMethod: MockedFn<CbasRunSetsContract['get']> = jest.fn(async (_root) => simpleRunSetData);

    asMockedFn(Cbas).mockReturnValue(
      partial<CbasAjaxContract>({
        runSets: partial<CbasRunSetsContract>({
          get: getRunSetsMethod,
        }),
      })
    );

    // Act
    await act(async () => {
      render(
        h(BaseSubmissionHistory, {
          name: 'test-azure-ws-name',
          namespace: 'test-azure-ws-namespace',
          workspace: mockAzureWorkspace,
        })
      );
    });

    expect(screen.getByRole('table')).toBeInTheDocument();

    const table = await screen.findByRole('table');

    const rows = within(table).getAllByRole('row');
    const headers = within(rows[0]).getAllByRole('columnheader');
    expect(headers.length).toBe(7);

    const cellsFromDataRow1 = within(rows[1]).getAllByRole('cell');
    const actionsMenu = within(cellsFromDataRow1[1]).getByRole('button');

    await act(async () => {
      const select = new SelectHelper(actionsMenu, user);
      await select.openMenu();
      expect(screen.getByText('Abort')).toBeInTheDocument();
    });
  });

  interface AbortTestCaseArgs {
    workspace: WorkspaceWrapper;
    userId: string;
    // TODO: get some better types from Cbas ajax calls so we can use that instead of "any"
    runSet: any;
    abortAllowed: boolean;
  }

  const abortTestCases: [string, AbortTestCaseArgs][] = [
    [
      'abort successfully',
      { workspace: mockAzureWorkspace, userId: 'foo', runSet: simpleRunSetData, abortAllowed: true },
    ],
    [
      'not allow abort for non-submitter',
      { workspace: mockAzureWorkspace, userId: 'not-foo', runSet: simpleRunSetData, abortAllowed: false },
    ],
    [
      'not allow abort for Queued submission',
      { workspace: mockAzureWorkspace, userId: 'not-foo', runSet: queuedRunSetData, abortAllowed: false },
    ],
  ];

  it.each(abortTestCases)('should %s', async (_unused, { workspace, userId, runSet, abortAllowed }) => {
    const user = userEvent.setup();
    const getRunSetsMethod: MockedFn<CbasRunSetsContract['get']> = jest.fn(async (_root) => runSet);
    const cancelSubmissionFunction: MockedFn<CbasRunSetsContract['cancel']> = jest.fn(
      async (_root, _id) => mockAbortResponse
    );

    asMockedFn(Cbas).mockReturnValue(
      partial<CbasAjaxContract>({
        runSets: partial<CbasRunSetsContract>({
          get: getRunSetsMethod,
          cancel: cancelSubmissionFunction,
        }),
      })
    );

    asMockedFn(User).mockReturnValue(
      partial<UserContract>({
        getStatus: jest.fn(async () =>
          partial<SamUserRegistrationStatusResponse>({
            userSubjectId: userId,
          })
        ),
      })
    );

    // Act
    await act(async () => {
      render(
        h(BaseSubmissionHistory, {
          name: 'test-azure-ws-name',
          namespace: 'test-azure-ws-namespace',
          workspace,
        })
      );
    });

    // Assert
    expect(getRunSetsMethod).toBeCalled();
    expect(screen.getByRole('table')).toBeInTheDocument();

    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row');
    const headers = within(rows[0]).getAllByRole('columnheader');
    expect(headers.length).toBe(7);

    const cellsFromDataRow1 = within(rows[1]).getAllByRole('cell');
    const actionsMenu = within(cellsFromDataRow1[1]).getByRole('button');

    await act(async () => {
      const select = new SelectHelper(actionsMenu, user);
      await select.openMenu();
      expect(screen.getByText('Abort')).toBeInTheDocument();
    });

    const abortButton = screen.getByText('Abort');
    expect(abortButton).toHaveAttribute('aria-disabled', (!abortAllowed).toString());
    await user.click(abortButton);

    if (abortAllowed) {
      expect(cancelSubmissionFunction).toHaveBeenCalled();
      expect(cancelSubmissionFunction).toBeCalledWith(
        'https://lz-abc/terra-app-abc/cbas',
        '20000000-0000-0000-0000-200000000002'
      );
    } else {
      expect(cancelSubmissionFunction).not.toHaveBeenCalled();
    }
  });
});
