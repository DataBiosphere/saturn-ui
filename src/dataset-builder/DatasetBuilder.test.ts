import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import _ from 'lodash/fp';
import { h } from 'react-hyperscript-helpers';
import { Cohort, convertCohort } from 'src/dataset-builder/DatasetBuilderUtils';
import {
  DataRepo,
  DataRepoContract,
  SnapshotBuilderDatasetConceptSet,
  SnapshotBuilderSettings,
} from 'src/libs/ajax/DataRepo';
import * as Nav from 'src/libs/nav';
import { asMockedFn, renderWithAppContexts as render } from 'src/testing/test-utils';

import { cohortEditorState, newCohort, newConceptSet, Updater } from './dataset-builder-types';
import {
  CohortSelector,
  ConceptSetSelector,
  CreateCohortModal,
  DatasetBuilderContents,
  DatasetBuilderView,
  HeaderAndValues,
  OnStateChangeHandler,
} from './DatasetBuilder';
import { testSnapshotBuilderSettings, testSnapshotId } from './TestConstants';

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

describe('DatasetBuilder', () => {
  const testSettings = testSnapshotBuilderSettings();
  type DatasetBuilderContentsPropsOverrides = {
    onStateChange?: OnStateChangeHandler;
    updateCohorts?: Updater<Cohort[]>;
    updateConceptSets?: Updater<SnapshotBuilderDatasetConceptSet[]>;
    snapshotId?: string;
    snapshotBuilderSettings?: SnapshotBuilderSettings;
    cohorts?: Cohort[];
    conceptSets?: SnapshotBuilderDatasetConceptSet[];
    selectedCohorts?: HeaderAndValues<Cohort>[];
    selectedConceptSets?: HeaderAndValues<SnapshotBuilderDatasetConceptSet>[];
    snapshotRequestName?: string;
    updateSelectedCohorts?: (cohorts: HeaderAndValues<Cohort>[]) => void;
    updateSelectedConceptSets?: (conceptSets: HeaderAndValues<SnapshotBuilderDatasetConceptSet>[]) => void;
    updateSnapshotRequestName?: (snapshotRequestName: string) => void;
  };

  const defaultHeader = 'Saved cohorts';
  const showDatasetBuilderContents = (overrides?: DatasetBuilderContentsPropsOverrides) => {
    render(
      h(DatasetBuilderContents, {
        cohorts: [],
        conceptSets: [],
        updateCohorts: jest.fn(),
        updateConceptSets: jest.fn(),
        onStateChange: (state) => state,
        snapshotId: testSnapshotId,
        snapshotBuilderSettings: testSettings,
        selectedCohorts: [{ header: defaultHeader, values: [] }],
        selectedConceptSets: [],
        selectedColumns: [],
        snapshotRequestName: '',
        updateSnapshotRequestName: jest.fn(),
        updateSelectedCohorts: jest.fn(),
        updateSelectedConceptSets: jest.fn(),
        updateSelectedColumns: jest.fn(),
        ...overrides,
      })
    );
  };

  const mockDataRepo = (snapshotMocks: Partial<DataRepoContract['snapshot']>[]) => {
    asMockedFn(DataRepo).mockImplementation(
      () =>
        ({
          snapshot: (_snapshotId) => Object.assign({}, ...snapshotMocks),
        } as Partial<DataRepoContract> as DataRepoContract)
    );
  };

  const snapshotBuilderSettingsMock = (snapshotBuilderSettingsResponse: SnapshotBuilderSettings) => ({
    getSnapshotBuilderSettings: jest.fn((_include) => Promise.resolve(snapshotBuilderSettingsResponse)),
  });

  const snapshotRolesMock = (snapshotRolesResponse: string[]) => ({
    roles: jest.fn((_include) => Promise.resolve(snapshotRolesResponse)),
  });

  const getSnapshotBuilderCountMock = (count = 0) => ({
    getSnapshotBuilderCount: () =>
      Promise.resolve({
        result: {
          total: count,
        },
        sql: 'sql',
      }),
  });

  const validDatasetRequestCohort = newCohort('cohort 1');
  const validDatasetRequestConceptSet = newConceptSet('Condition');
  const validDatasetRequestSnapshotRequestName = 'valid name';

  const initializeValidDatasetRequest = () => {
    showDatasetBuilderContents({
      cohorts: [validDatasetRequestCohort],
      selectedCohorts: [{ header: defaultHeader, values: [validDatasetRequestCohort] }],
      conceptSets: [validDatasetRequestConceptSet],
      selectedConceptSets: [{ values: [validDatasetRequestConceptSet] }],
      snapshotRequestName: validDatasetRequestSnapshotRequestName,
    });
  };

  beforeEach(() => {
    asMockedFn(Nav.useRoute).mockReturnValue({ title: 'Data Explorer', params: {}, query: {} });
  });

  const renderCohortSelector = () => {
    render(
      h(CohortSelector, {
        updateCohorts: jest.fn(),
        cohorts: [newCohort('cohort 1'), newCohort('cohort 2')],
        selectedCohorts: [{ header: defaultHeader, values: [] }],
        onChange: (cohorts) => cohorts,
        onStateChange: (state) => state,
      })
    );
  };

  const renderConceptSetSelector = () =>
    render(
      h(ConceptSetSelector, {
        conceptSets: testSettings.datasetConceptSets,
        selectedConceptSets: [],
        updateConceptSets: jest.fn(),
        onChange: (conceptSets) => conceptSets,
        onStateChange: (state) => state,
      })
    );

  const mockCreateSnapshotAccessRequest = jest.fn().mockResolvedValue({
    id: '',
    sourceSnapshotId: '',
    snapshotName: '',
    snapshotResearchPurpose: '',
    snapshotSpecification: {
      cohorts: [{ name: 'g', criteriaGroups: [] }],
      conceptSets: [],
      valueSets: [{ name: 'Person', values: ['Person Column 1', 'Person Column 2'] }],
    },
    createdBy: 'user@email.com',
    status: 'SUBMITTED',
    createdDate: '2024-05-21T14:46:28.622665Z',
    updatedDate: null,
  });

  const mockGetSnapshotAccessRequestDetails = jest.fn().mockResolvedValue({
    summary: 'Summary',
  });

  it('renders cohorts', () => {
    // Arrange
    renderCohortSelector();
    // Assert
    expect(screen.getByText('Find participants')).toBeTruthy();
    expect(screen.getByText('cohort 1')).toBeTruthy();
    expect(screen.getByText('cohort 2')).toBeTruthy();
  });

  it('opens the create cohort model when clicking find participants button', async () => {
    // Arrange
    const user = userEvent.setup();
    renderCohortSelector();
    // Act
    await user.click(screen.getByText('Find participants'));
    // Assert
    expect(screen.getByText('Create a new cohort')).toBeTruthy();
  });

  it('creates a cohort when the cohort creation modal is filled out', async () => {
    // Arrange
    const user = userEvent.setup();
    const onStateChange = jest.fn();

    render(h(CreateCohortModal, { onDismiss: () => {}, onStateChange, cohorts: [] }));
    // Act
    const cohortName = 'new cohort';
    fireEvent.change(await screen.findByLabelText('Cohort name *'), { target: { value: cohortName } });
    await user.click(screen.getByText('Create cohort'));
    // Assert
    const cohort = newCohort(cohortName);
    const expected = _.set('criteriaGroups[0].id', cohort.criteriaGroups[0].id - 1, cohort);
    expect(onStateChange).toHaveBeenCalledWith(cohortEditorState.new(expected));
  });

  it('renders concept sets', () => {
    renderConceptSetSelector();
    _.flow(
      _.map((conceptSet: SnapshotBuilderDatasetConceptSet) => conceptSet.name),
      _.forEach((conceptSetName: string) => expect(screen.getByText(conceptSetName)).toBeTruthy())
    )(testSettings.datasetConceptSets);
  });

  it('renders dataset builder contents with cohorts and concept sets', () => {
    // Arrange
    showDatasetBuilderContents();
    // Assert
    expect(screen.getByText('Select participants')).toBeTruthy();
    expect(screen.getByText('Select data about participants')).toBeTruthy();
  });

  it('checks selected cohorts, concept sets, and values', async () => {
    // Arrange
    mockDataRepo([getSnapshotBuilderCountMock()]);
    const cohortOne = newCohort('cohort 1');
    const conditionConceptSet = newConceptSet('Condition');
    showDatasetBuilderContents({
      cohorts: [cohortOne, newCohort('cohort 2')],
      conceptSets: [conditionConceptSet, newConceptSet('Procedure'), newConceptSet('Observation')],
      selectedCohorts: [{ header: defaultHeader, values: [cohortOne] }],
      selectedConceptSets: [{ values: [conditionConceptSet] }],
    });

    // Assert
    expect(await screen.findByLabelText('cohort 1')).toBeChecked();
    expect(await screen.findByLabelText('cohort 2')).not.toBeChecked();
    expect(await screen.findByLabelText('Condition')).toBeChecked();
    expect(await screen.findByLabelText('Procedure')).not.toBeChecked();
    expect(await screen.findByLabelText('Observation')).not.toBeChecked();
  });

  it('calls update on selecting cohorts, and concept sets', async () => {
    // Arrange
    mockDataRepo([getSnapshotBuilderCountMock()]);
    const user = userEvent.setup();
    const cohortOne = newCohort('cohort 1');
    const conditionConceptSet = newConceptSet('Condition');
    const updateSelectedConceptSets = jest.fn();
    const updateSelectedCohorts = jest.fn();
    showDatasetBuilderContents({
      cohorts: [cohortOne, newCohort('cohort 2')],
      conceptSets: [conditionConceptSet, newConceptSet('Procedure'), newConceptSet('Observation')],
      updateSelectedConceptSets,
      updateSelectedCohorts,
    });
    // Act
    await user.click(screen.getByLabelText('cohort 1'));
    await user.click(screen.getByLabelText('Condition'));
    // Assert
    expect(updateSelectedCohorts).toBeCalledWith([{ header: defaultHeader, values: [cohortOne] }]);
    expect(updateSelectedConceptSets).toBeCalledWith([{ values: [conditionConceptSet] }]);
  });

  it('shows the home page by default', async () => {
    // Arrange
    mockDataRepo([
      snapshotBuilderSettingsMock(testSnapshotBuilderSettings()),
      snapshotRolesMock(['aggregate_data_reader']),
    ]);
    render(h(DatasetBuilderView));
    // Assert
    expect(screen.getByTestId('loading-spinner')).toBeTruthy();
    expect(await screen.findByText('Data Snapshots')).toBeTruthy();
  });

  it('shows the cohort editor page', async () => {
    // Arrange
    mockDataRepo([
      snapshotBuilderSettingsMock(testSnapshotBuilderSettings()),
      snapshotRolesMock(['aggregate_data_reader']),
      getSnapshotBuilderCountMock(),
    ]);
    const initialState = cohortEditorState.new(newCohort('my test cohort'));
    render(h(DatasetBuilderView, { snapshotId: 'ignored', initialState }));
    // Assert
    expect(await screen.findByText(initialState.cohort.name)).toBeTruthy();
  });

  it('selects cohort on creation', async () => {
    // Arrange
    mockDataRepo([
      snapshotBuilderSettingsMock(testSnapshotBuilderSettings()),
      snapshotRolesMock(['aggregate_data_reader']),
      getSnapshotBuilderCountMock(),
    ]);
    const user = userEvent.setup();
    const initialState = cohortEditorState.new(newCohort('my test cohort'));
    render(h(DatasetBuilderView, { snapshotId: 'ignored', initialState }));
    // Assert
    await user.click(await screen.findByText('Save cohort'));
    expect(await screen.findByLabelText(initialState.cohort.name)).toBeChecked();
  });

  it('shows the participant count and request access buttons when request is valid', async () => {
    const mockDataRepoContract: Partial<DataRepoContract> = {
      snapshot: (_snapshotId) =>
        ({
          getSnapshotBuilderCount: () => Promise.resolve({ result: { total: 100 }, sql: '' }),
        } as Partial<DataRepoContract['snapshot']>),
    } as Partial<DataRepoContract> as DataRepoContract;
    asMockedFn(DataRepo).mockImplementation(() => mockDataRepoContract as DataRepoContract);
    // Arrange
    initializeValidDatasetRequest();
    // Assert
    expect(await screen.findByText('100 participants in this dataset')).toBeTruthy();
    expect(await screen.findByText('Import to workspace')).toBeTruthy();
  });

  it('shows the participant count and disabled request button when request is valid but no name', async () => {
    const mockDataRepoContract: Partial<DataRepoContract> = {
      snapshot: (_snapshotId) =>
        ({
          getSnapshotBuilderCount: () => Promise.resolve({ result: { total: 100 }, sql: '' }),
        } as Partial<DataRepoContract['snapshot']>),
    } as Partial<DataRepoContract> as DataRepoContract;
    asMockedFn(DataRepo).mockImplementation(() => mockDataRepoContract as DataRepoContract);
    // Arrange
    const cohortOne = newCohort('cohort 1');
    const conditionConceptSet = newConceptSet('Condition');
    showDatasetBuilderContents({
      cohorts: [cohortOne],
      selectedCohorts: [{ header: defaultHeader, values: [cohortOne] }],
      conceptSets: [conditionConceptSet],
      selectedConceptSets: [{ values: [conditionConceptSet] }],
    });
    // Assert
    expect(await screen.findByText('100 participants in this dataset')).toBeTruthy();
    const requestButton = await screen.findByText('Import to workspace');
    expect(requestButton).toBeTruthy();
    expect(requestButton.hasAttribute('disabled')).toBeTruthy();
  });

  it('updates name when name is entered into text field', async () => {
    // Arrange
    const updateSnapshotRequestName = jest.fn();
    showDatasetBuilderContents({ updateSnapshotRequestName });
    const input = 'input';
    const user = userEvent.setup();
    // Act
    await user.type(await screen.findByLabelText('Name your data snapshot'), input);
    // Assert
    expect(updateSnapshotRequestName).toBeCalledTimes(input.length);
    input.split('').forEach((inputCharacter) => {
      expect(updateSnapshotRequestName).toBeCalledWith(inputCharacter);
    });
  });

  it('hides the count with there are few participants in this dataset ', async () => {
    const mockDataRepoContract: Partial<DataRepoContract> = {
      snapshot: (_snapshotId) =>
        ({
          getSnapshotBuilderCount: () => Promise.resolve({ result: { total: 19 }, sql: '' }),
        } as Partial<DataRepoContract['snapshot']>),
    } as Partial<DataRepoContract> as DataRepoContract;
    asMockedFn(DataRepo).mockImplementation(() => mockDataRepoContract as DataRepoContract);
    // Arrange
    initializeValidDatasetRequest();
    // Assert
    expect(await screen.findByText('Less than 20 participants in this dataset')).toBeTruthy();
    expect(await screen.findByText('Import to workspace')).toBeTruthy();
  });

  it('Handles request snapshot operation', async () => {
    const mockDataRepoContract: Partial<DataRepoContract> = {
      snapshot: (_snapshotId) =>
        ({
          getSnapshotBuilderCount: () => Promise.resolve({ result: { total: 19 }, sql: '' }),
        } as Partial<DataRepoContract['snapshot']>),
      snapshotAccessRequest: () =>
        ({
          createSnapshotAccessRequest: mockCreateSnapshotAccessRequest,
          getSnapshotAccessRequestDetails: mockGetSnapshotAccessRequestDetails,
        } as Partial<DataRepoContract['snapshotAccessRequest']>),
    } as Partial<DataRepoContract> as DataRepoContract;

    asMockedFn(DataRepo).mockImplementation(() => mockDataRepoContract as DataRepoContract);

    // Arrange
    const user = userEvent.setup();
    initializeValidDatasetRequest();
    await user.click(await screen.findByText('Import to workspace'));
    // Assert
    // createSnapshotAccessRequest is called with the correct parameters
    expect(mockCreateSnapshotAccessRequest).toBeCalledWith({
      name: validDatasetRequestSnapshotRequestName,
      researchPurposeStatement: '',
      sourceSnapshotId: testSnapshotId,
      snapshotBuilderRequest: {
        cohorts: _.map(convertCohort, [validDatasetRequestCohort]),
        outputTables: [],
      },
    });
    // opens the modal when requesting access to the dataset
    expect(await screen.findByText('Access request created in Terra')).toBeTruthy();
  });

  it('Fetches detail information when snapshot request is created', async () => {
    const mockDataRepoContract: Partial<DataRepoContract> = {
      snapshot: (_snapshotId) =>
        ({
          getSnapshotBuilderCount: () => Promise.resolve({ result: { total: 19 }, sql: '' }),
        } as Partial<DataRepoContract['snapshot']>),
      snapshotAccessRequest: () =>
        ({
          createSnapshotAccessRequest: mockCreateSnapshotAccessRequest,
          getSnapshotAccessRequestDetails: mockCreateSnapshotAccessRequest,
        } as Partial<DataRepoContract['snapshotAccessRequest']>),
    } as Partial<DataRepoContract> as DataRepoContract;

    asMockedFn(DataRepo).mockImplementation(() => mockDataRepoContract as DataRepoContract);

    // Arrange
    const user = userEvent.setup();
    initializeValidDatasetRequest();
    await user.click(await screen.findByText('Import to workspace'));
    // Wait for the modal to open so we can verify all calls are finished
    await screen.findByText('Access request created in Terra');
    // Assert
    expect(mockCreateSnapshotAccessRequest).toBeCalledWith('');
  });

  it('enables editing cohorts', async () => {
    // Arrange
    const user = userEvent.setup();
    const onStateChange = jest.fn();
    const cohorts = [newCohort('cohort 1'), newCohort('cohort 2')];
    showDatasetBuilderContents({
      cohorts,
      onStateChange,
    });
    // Act
    await user.click(await screen.findByLabelText(`Saved cohorts/${cohorts[0].name} menu`));
    await user.click(await screen.findByLabelText('Edit cohort'));
    // Assert
    expect(onStateChange).toHaveBeenCalledWith(cohortEditorState.new(cohorts[0]));
  });

  it('enables deleting cohorts', async () => {
    // Arrange
    const user = userEvent.setup();
    const updateCohorts = jest.fn();
    const cohorts = [newCohort('cohort 1'), newCohort('cohort 2')];
    showDatasetBuilderContents({ cohorts, updateCohorts });
    // Act
    await user.click(await screen.findByLabelText(`Saved cohorts/${cohorts[0].name} menu`));
    await user.click(await screen.findByLabelText('Delete cohort'));
    // Assert
    expect(updateCohorts.mock.calls[0][0](cohorts)).toStrictEqual(_.tail(cohorts));
  });
});
