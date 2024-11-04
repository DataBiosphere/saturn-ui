import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KEY_LEFT, KEY_RIGHT } from 'keycode-js';
import _ from 'lodash/fp';
import { h } from 'react-hyperscript-helpers';
import {
  AnyCriteria,
  Cohort,
  CriteriaGroup,
  ProgramDataListCriteria,
  ProgramDataRangeCriteria,
  ProgramDomainCriteria,
} from 'src/dataset-builder/DatasetBuilderUtils';
import {
  DataRepo,
  DataRepoContract,
  SnapshotBuilderDomainOption,
  SnapshotBuilderProgramDataListOption,
  SnapshotBuilderProgramDataRangeOption,
} from 'src/libs/ajax/DataRepo';
import { asMockedFn, renderWithAppContexts as render } from 'src/testing/test-utils';

import { CohortEditor, criteriaFromOption, CriteriaGroupView, CriteriaView } from './CohortEditor';
import { domainCriteriaSearchState, homepageState, newCohort, newCriteriaGroup } from './dataset-builder-types';
import { testSnapshotBuilderSettings, testSnapshotId } from './TestConstants';

jest.mock('src/libs/ajax/GoogleStorage');
type DataRepoExports = typeof import('src/libs/ajax/DataRepo');
jest.mock('src/libs/ajax/DataRepo', (): DataRepoExports => {
  return {
    ...jest.requireActual('src/libs/ajax/DataRepo'),
    DataRepo: jest.fn(),
  };
});

type LodashFpExports = typeof import('lodash/fp');
jest.mock('lodash/fp', (): LodashFpExports => {
  const actual = jest.requireActual<LodashFpExports>('lodash/fp');
  return <_.LoDashFp & _.LodashDebounce>{
    ...actual,
    debounce: (_wait, func) => func,
  };
});

type ChartExports = typeof import('src/components/Chart');
jest.mock('src/components/Chart', (): ChartExports => {
  return {
    ...jest.requireActual('src/components/Chart'),
    Chart: jest.fn().mockReturnValue('Chart'),
  };
});

describe('CohortEditor', () => {
  type CriteriaViewPropsOverrides = {
    criteria: AnyCriteria;
    deleteCriteria?: (criteria: AnyCriteria) => void;
    updateCriteria?: (criteria: AnyCriteria) => void;
  };
  const programDataRangeOption = (min = 55, max = 99): SnapshotBuilderProgramDataRangeOption => {
    return {
      id: 0,
      kind: 'range',
      name: 'range',
      tableName: 'person',
      columnName: 'range_column',
      min,
      max,
    };
  };

  const mockDataRepo = (datasetMocks: Partial<DataRepoContract['snapshot']>[]) => {
    asMockedFn(DataRepo).mockImplementation(
      () =>
        ({
          snapshot: (_snapshotId) => Object.assign({}, ...datasetMocks),
        } as Partial<DataRepoContract> as DataRepoContract)
    );
  };

  const getSnapshotBuilderCountMock = (count = 0) => ({
    getSnapshotBuilderCount: () =>
      Promise.resolve({
        result: {
          total: count,
        },
        sql: 'sql',
      }),
  });

  const getNextCriteriaIndex = () => 1234;

  const snapshotBuilderSettings = testSnapshotBuilderSettings();
  const renderCriteriaView = (propsOverrides: CriteriaViewPropsOverrides) =>
    render(
      h(CriteriaView, {
        snapshotId: testSnapshotId,
        deleteCriteria: _.noop,
        updateCriteria: _.noop,
        key: '1',
        ...propsOverrides,
      })
    );

  beforeEach(() => {
    mockDataRepo([getSnapshotBuilderCountMock()]);
  });

  it('renders unknown criteria', async () => {
    // Arrange
    const criteria = { name: 'bogus', invalid: 'property' };
    let consoleError = '';
    // This should error fetching the count because the conversion to API counts to generate counts should fail
    jest.spyOn(console, 'error').mockImplementation((error) => {
      consoleError = error;
    });

    // The 'as any' is required to create an invalid criteria for testing purposes.
    renderCriteriaView({ criteria: criteria as any });
    // Assert
    expect(await screen.findByText('Unknown criteria')).toBeTruthy();
    expect(screen.queryByText(criteria.name)).toBeFalsy();
    expect(consoleError).toBe('Error getting criteria group count');
  });

  it('renders domain criteria', async () => {
    // Arrange
    const criteria: ProgramDomainCriteria = {
      kind: 'domain',
      conceptId: 0,
      index: 0,
      conceptName: 'test concept',
      count: 0,
      option: {
        kind: 'domain',
        id: 0,
        name: 'test name',
        participantCount: 0,
        conceptCount: 0,
        tableName: 'domain_occurrence',
        columnName: 'domain_concept_id',
        root: { id: 0, name: 'test concept', code: '0', count: 0, hasChildren: false },
      },
    };
    renderCriteriaView({ criteria });
    // Assert
    expect(await screen.findByText(criteria.option.name, { exact: false })).toBeTruthy();
    expect(screen.getByText(criteria.conceptName)).toBeTruthy();
  });

  it('renders list criteria', async () => {
    // Arrange
    const criteria = criteriaFromOption(0, {
      id: 0,
      name: 'list',
      kind: 'list',
      tableName: 'person',
      columnName: 'list_column',
      values: [],
    }) as ProgramDataListCriteria;
    renderCriteriaView({ criteria });

    expect(await screen.findByText(criteria.option.name, { exact: false })).toBeTruthy();
    expect(criteria.values.length).toBe(0);
  });

  it('updates when list updated', async () => {
    // Arrange
    const user = userEvent.setup();
    const updateCriteria = jest.fn();
    const criteria = criteriaFromOption(0, {
      id: 0,
      name: 'list',
      kind: 'list',
      tableName: 'person',
      columnName: 'list_column_id',
      values: [
        {
          id: 0,
          name: 'value 0',
        },
        {
          id: 1,
          name: 'value 1',
        },
      ],
    }) as ProgramDataListCriteria;
    criteria.values = [{ id: 0, name: 'value 0' }];
    renderCriteriaView({ updateCriteria, criteria });
    // Act
    await user.click(await screen.findByLabelText('Remove value 0'));
    // Assert
    expect(updateCriteria).toBeCalledWith({ ...criteria, values: [] });
    // Act
    await user.click(screen.getByLabelText('Select one or more list'));
    await user.click((await screen.findAllByText('value 0'))[0]);
    await user.click(screen.getByLabelText('Select one or more list'));
    await user.click((await screen.findAllByText('value 1'))[0]);
    // Assert
    expect(updateCriteria).toBeCalledWith({
      ...criteria,
      values: [
        { id: 0, name: 'value 0' },
        { id: 1, name: 'value 1' },
      ],
    });
  });

  it('renders range criteria', async () => {
    // Arrange
    mockDataRepo([getSnapshotBuilderCountMock(12345)]);
    const criteria = criteriaFromOption(0, {
      id: 0,
      name: 'range',
      kind: 'range',
      tableName: 'person',
      columnName: 'range_column',
      min: 55,
      max: 99,
    }) as ProgramDataRangeCriteria;
    renderCriteriaView({ criteria });
    // Assert
    expect(await screen.findByText(criteria.option.name, { exact: false })).toBeTruthy();
    expect(screen.getByText(criteria.low, { exact: false })).toBeTruthy();
    expect(screen.getByText(criteria.high, { exact: false })).toBeTruthy();
  });

  it('allows number inputs for range criteria', async () => {
    // Arrange
    const user = userEvent.setup();
    const criteria = criteriaFromOption(0, {
      id: 0,
      name: 'range',
      kind: 'range',
      tableName: 'person',
      columnName: 'range_column',
      min: 55,
      max: 99,
    }) as ProgramDataRangeCriteria;
    const updateCriteria = jest.fn();
    renderCriteriaView({ criteria, updateCriteria });
    const lowInput = 65;
    const highInput = 75;
    // Act
    await user.clear(screen.getByLabelText(`${criteria.option.name} low`));
    await user.type(screen.getByLabelText(`${criteria.option.name} low`), lowInput.toString());
    await user.clear(screen.getByLabelText(`${criteria.option.name} high`));
    await user.type(screen.getByLabelText(`${criteria.option.name} high`), highInput.toString());

    // Assert
    expect(updateCriteria).toBeCalledWith({ ...criteria, low: lowInput });
    expect(updateCriteria).toBeCalledWith({ ...criteria, high: highInput });
  });

  it('renders accessible slider handles', async () => {
    // Arrange
    const min = 55;
    const max = 99;

    const criteria = criteriaFromOption(0, {
      id: 0,
      tableName: 'person',
      columnName: 'range_column',
      name: 'range',
      kind: 'range',
      min,
      max,
    }) as ProgramDataRangeCriteria;
    const updateCriteria = jest.fn();
    renderCriteriaView({ criteria, updateCriteria });
    // Act
    // We need to use fireEvent for this because rc-slider uses deprecated KeyboardEvent properties which and keyCode
    fireEvent.keyDown(await screen.findByLabelText(`${criteria.option.name} low slider`), {
      keyCode: KEY_RIGHT /* Right Arrow */,
    });
    fireEvent.keyDown(screen.getByLabelText(`${criteria.option.name} high slider`), {
      keyCode: KEY_LEFT /* Left Arrow */,
    });

    // Arrange
    expect(updateCriteria).toBeCalledWith({ ...criteria, low: min + 1 });
    expect(updateCriteria).toBeCalledWith({ ...criteria, high: max - 1 });
  });

  it('can delete criteria', async () => {
    // Arrange
    const criteria = criteriaFromOption(0, {
      id: 0,
      tableName: 'person',
      columnName: 'range_column',
      name: 'range',
      kind: 'range',
      min: 55,
      max: 99,
    }) as ProgramDataRangeCriteria;
    const deleteCriteria = jest.fn();

    renderCriteriaView({ deleteCriteria, criteria });
    const user = userEvent.setup();
    // Act
    expect(screen.getByText('range', { exact: false })).toBeTruthy();
    await user.click(screen.getByLabelText('delete criteria'));
    // Assert
    expect(deleteCriteria).toBeCalledWith(criteria);
  });

  interface ShowCriteriaGroupArgs {
    initializeGroup?: ((criteriaGroup: CriteriaGroup) => void) | undefined;
    domainOptions?: SnapshotBuilderDomainOption[];
    programDataOptions?: (SnapshotBuilderProgramDataRangeOption | SnapshotBuilderProgramDataListOption)[];
  }

  function showCriteriaGroup(args?: ShowCriteriaGroupArgs) {
    const { initializeGroup, domainOptions, programDataOptions }: ShowCriteriaGroupArgs = {
      domainOptions: [],
      programDataOptions: [],
      ...args,
    };
    const cohort = newCohort('cohort');
    const criteriaGroup = cohort.criteriaGroups[0];
    if (initializeGroup) {
      initializeGroup(criteriaGroup);
    }
    cohort.criteriaGroups.push(criteriaGroup);
    const updateCohort = jest.fn();
    const snapshotBuilderSettingsUpdated = _.flow(
      _.set('domainOptions', domainOptions),
      _.set('programDataOptions', programDataOptions)
    )(snapshotBuilderSettings);

    render(
      h(CriteriaGroupView, {
        index: 0,
        criteriaGroup,
        updateCohort,
        cohort,
        snapshotId: testSnapshotId,
        snapshotBuilderSettings: snapshotBuilderSettingsUpdated,
        onStateChange: _.noop,
        getNextCriteriaIndex,
      })
    );
    return { cohort, updateCohort };
  }

  it('renders criteria group', async () => {
    // Arrange
    const count = 12345;
    mockDataRepo([getSnapshotBuilderCountMock(count)]);
    showCriteriaGroup({
      initializeGroup: (criteriaGroup) => {
        criteriaGroup.meetAll = false;
        criteriaGroup.mustMeet = false;
      },
    });
    // Assert
    expect(screen.getByText('Must not')).toBeTruthy();
    expect(screen.getByText('any')).toBeTruthy();
    expect(await screen.findByText(`${count}`, { exact: false })).toBeTruthy();
    expect(screen.getByText('Group 1')).toBeTruthy();
  });

  it('can delete criteria group', async () => {
    // Arrange
    const { cohort, updateCohort } = showCriteriaGroup();
    const user = userEvent.setup();
    // Act
    await user.click(screen.getByLabelText('delete group 1'));
    // Assert
    expect(updateCohort).toHaveBeenCalled();
    expect(updateCohort.mock.calls[0][0](cohort)).toStrictEqual({ name: 'cohort', criteriaGroups: [] });
  });

  it('can modify criteria group', async () => {
    // Arrange
    const { cohort, updateCohort } = showCriteriaGroup({
      initializeGroup: (criteriaGroup) => {
        criteriaGroup.meetAll = false;
        criteriaGroup.mustMeet = false;
      },
    });
    const user = userEvent.setup();
    // Act
    await user.click(screen.getByLabelText('must or must not meet'));
    const mustItem = screen.getByText('Must');
    await user.click(mustItem);
    // Assert
    expect(updateCohort).toHaveBeenCalled();
    const updatedCohort: Cohort = updateCohort.mock.calls[0][0](cohort);
    expect(updatedCohort.criteriaGroups[0].mustMeet).toBeTruthy();
    // Act
    await user.click(screen.getByLabelText('all or any'));
    const allItem = screen.getByText('all');
    await user.click(allItem);
    // Assert
    expect(updateCohort).toHaveBeenCalled();
    const updatedCohort2: Cohort = updateCohort.mock.calls[1][0](cohort);
    expect(updatedCohort2.criteriaGroups[0].meetAll).toBeTruthy();
  });

  it('can add new criteria to criteria group', async () => {
    // Arrange
    const rangeOption = programDataRangeOption();
    const { cohort, updateCohort } = showCriteriaGroup({
      programDataOptions: [rangeOption],
    });
    const user = userEvent.setup();

    // Act
    await user.click(screen.getByLabelText('Add criteria'));
    const dataOptionMenuItem = screen.getByText(rangeOption.name);
    await user.click(dataOptionMenuItem);
    // Assert
    expect(updateCohort).toHaveBeenCalledTimes(1);

    const updatedCohort: Cohort = updateCohort.mock.calls[0][0](cohort);
    const { index: _, ...expectedCriteria } = criteriaFromOption(2, programDataRangeOption());
    expect(updatedCohort.criteriaGroups[0].criteria).toMatchObject([expectedCriteria]);
  });

  it('can delete criteria from the criteria group', async () => {
    // Arrange
    const criteria = criteriaFromOption(0, programDataRangeOption());
    const { cohort, updateCohort } = showCriteriaGroup({
      initializeGroup: (criteriaGroup) => criteriaGroup.criteria.push(criteria),
    });
    const user = userEvent.setup();
    // Act
    await user.click(screen.getByLabelText('delete criteria'));
    // Assert
    expect(updateCohort).toHaveBeenCalled();
    const updatedCohort: Cohort = updateCohort.mock.calls[0][0](cohort);
    expect(updatedCohort.criteriaGroups[0].criteria).toMatchObject([]);
  });

  it('produces user understandable criteria group names after deletion', async () => {
    // Arrange
    showCohortEditor();
    const user = userEvent.setup();
    // Act
    await user.click(screen.getByText('Add group'));
    await user.click(screen.getByLabelText('delete group 1'));
    await user.click(screen.getByText('Add group'));
    // Assert
    expect(screen.getByText('Group 1')).toBeTruthy();
  });

  it('can delete criteria groups and maintain user understandable names', async () => {
    // Arrange
    showCohortEditor();
    const user = userEvent.setup();
    // Act
    await user.click(screen.getByText('Add group'));
    await user.click(screen.getByText('Add group'));
    // Assert
    expect(screen.getByText('Group 1')).toBeTruthy();
    expect(screen.getByText('Group 2')).toBeTruthy();
    expect(screen.getByText('Group 3')).toBeTruthy();
    // Act
    await user.click(screen.getByLabelText('delete group 2'));
    // Assert
    expect(screen.getByText('Group 1')).toBeTruthy();
    expect(screen.getByText('Group 2')).toBeTruthy();
    expect(screen.queryByText('Group 3')).toBeFalsy();
  });

  function showCohortEditor(originalCohort = newCohort('my cohort name')) {
    const onStateChange = jest.fn();
    const updateCohorts = jest.fn();
    const addSelectedCohort = jest.fn();

    render(
      h(CohortEditor, {
        onStateChange,
        snapshotId: testSnapshotId,
        snapshotBuilderSettings,
        originalCohort,
        updateCohorts,
        addSelectedCohort,
        getNextCriteriaIndex,
      })
    );
    return { originalCohort, onStateChange, updateCohorts, addSelectedCohort };
  }

  it('renders a cohort', async () => {
    // Arrange
    const { originalCohort } = showCohortEditor();
    // Assert
    expect(await screen.findByText(originalCohort.name)).toBeTruthy();
  });

  it('saves a cohort', async () => {
    // Arrange
    const { originalCohort, onStateChange, updateCohorts, addSelectedCohort } = showCohortEditor();
    const user = userEvent.setup();
    // Act
    await user.click(screen.getByText('Save cohort'));
    // Assert
    expect(onStateChange).toBeCalledWith(homepageState.new());
    expect(updateCohorts.mock.calls[0][0]([])).toStrictEqual([originalCohort]);
    expect(addSelectedCohort).toBeCalledWith(originalCohort);
  });

  it('cancels editing a cohort', async () => {
    // Arrange
    const { onStateChange, updateCohorts } = showCohortEditor();
    const user = userEvent.setup();
    // Act
    await user.click(screen.getByLabelText('cancel'));
    // Assert
    expect(onStateChange).toBeCalledWith(homepageState.new());
    expect(updateCohorts).not.toHaveBeenCalled();
  });

  it('can add a criteria group', async () => {
    // Arrange
    const { originalCohort, updateCohorts } = showCohortEditor();
    const user = userEvent.setup();
    // Act
    await user.click(screen.getByText('Add group'));
    await user.click(screen.getByText('Save cohort'));
    // Assert
    // Don't compare id since it's generated.
    const { id: _unused, ...expectedCriteriaGroup } = newCriteriaGroup();
    expect(updateCohorts.mock.calls[0][0]([])).toMatchObject([
      { ...originalCohort, criteriaGroups: [expectedCriteriaGroup, expectedCriteriaGroup] },
    ]);
  });

  it('shows the domain criteria search', async () => {
    // Arrange
    const { onStateChange } = showCohortEditor();
    const user = userEvent.setup();
    // Act
    await user.click(screen.getByLabelText('Add criteria'));
    const domainMenuItem = screen.getByText(snapshotBuilderSettings.domainOptions[0].name);
    await user.click(domainMenuItem);
    // Assert
    expect(onStateChange).toBeCalledWith(
      domainCriteriaSearchState.new(
        expect.anything(),
        expect.anything(),
        _.set('kind', 'domain', snapshotBuilderSettings.domainOptions[0]),
        [],
        ''
      )
    );
  });

  it('renders total cohort count', async () => {
    // Arrange
    showCohortEditor();
    // Assert
    expect(await screen.findByText('Total participant count: 0', { exact: false })).toBeTruthy();
  });
});
