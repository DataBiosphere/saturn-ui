import { div, span } from 'react-hyperscript-helpers';
import {
  AnyCriteria,
  Cohort,
  convertCohort,
  convertCriteria,
  convertDatasetAccessRequest,
  convertValueSet,
  CriteriaGroup,
  DatasetAccessRequest,
  DomainCriteria,
  formatCount,
  HighlightConceptName,
  ProgramDataListCriteria,
  ProgramDataRangeCriteria,
  ValueSet,
} from 'src/dataset-builder/DatasetBuilderUtils';
import {
  DomainConceptSet,
  DomainCriteria as DomainCriteriaApi,
  ProgramDataListCriteria as ProgramDataListCriteriaApi,
  ProgramDataRangeCriteria as ProgramDataRangeCriteriaApi,
  SnapshotAccessRequest as SnapshotAccessRequestApi,
  SnapshotBuilderCohort,
  SnapshotBuilderConcept,
  SnapshotBuilderCriteria,
  SnapshotBuilderCriteriaGroup,
  SnapshotBuilderDomainOption,
  SnapshotBuilderFeatureValueGroup as ValueSetApi,
  SnapshotBuilderProgramDataListItem,
  SnapshotBuilderProgramDataListOption,
  SnapshotBuilderProgramDataRangeOption,
} from 'src/libs/ajax/DataRepo';

const concept: SnapshotBuilderConcept = {
  id: 0,
  name: 'concept',
  count: 10,
  code: '0',
  hasChildren: false,
};

const domainOption: SnapshotBuilderDomainOption = {
  id: 1,
  name: 'category',
  kind: 'domain',
  tableName: 'category_occurrence',
  columnName: 'category_concept_id',
  conceptCount: 10,
  participantCount: 20,
  root: concept,
};

const domainCriteria: DomainCriteria = {
  conceptId: 100,
  conceptName: 'conceptName',
  kind: 'domain',
  option: domainOption,
  index: 0,
  count: 100,
};

const domainCriteriaApi: DomainCriteriaApi = {
  kind: 'domain',
  id: 1,
  conceptId: 100,
};

const rangeOption: SnapshotBuilderProgramDataRangeOption = {
  id: 2,
  kind: 'range',
  tableName: 'person',
  columnName: 'range_column',
  min: 0,
  max: 101,
  name: 'rangeOption',
};

const rangeCriteria: ProgramDataRangeCriteria = {
  kind: 'range',
  option: rangeOption,
  index: 4,
  count: 100,
  low: 1,
  high: 99,
};

const rangeCriteriaApi: ProgramDataRangeCriteriaApi = {
  id: 2,
  kind: 'range',
  low: 1,
  high: 99,
};

const optionValues: SnapshotBuilderProgramDataListItem[] = [{ id: 5, name: 'listOptionListValue' }];

const listOption: SnapshotBuilderProgramDataListOption = {
  id: 2,
  kind: 'list',
  name: 'listOption',
  tableName: 'person',
  columnName: 'list_concept_id',
  values: optionValues,
};

const criteriaListValues: SnapshotBuilderProgramDataListItem[] = [
  { id: 7, name: 'criteriaListValue1' },
  { id: 8, name: 'criteriaListValue2' },
];

const criteriaListValuesApi: number[] = [7, 8];

const listCriteria: ProgramDataListCriteria = {
  kind: 'list',
  index: 9,
  option: listOption,
  values: criteriaListValues,
};

const listCriteriaApi: ProgramDataListCriteriaApi = {
  id: 2,
  kind: 'list',
  values: criteriaListValuesApi,
};

const anyCriteriaArray: AnyCriteria[] = [domainCriteria, rangeCriteria, listCriteria];

const anyCriteriaArrayApi: SnapshotBuilderCriteria[] = [domainCriteriaApi, rangeCriteriaApi, listCriteriaApi];

const criteriaGroup: CriteriaGroup = {
  name: 'criteriaGroup',
  criteria: anyCriteriaArray,
  mustMeet: true,
  meetAll: false,
};

const criteriaGroupApi: SnapshotBuilderCriteriaGroup = {
  name: 'criteriaGroup',
  criteria: anyCriteriaArrayApi,
  mustMeet: true,
  meetAll: false,
};

const cohort: Cohort = { name: 'cohort', criteriaGroups: [criteriaGroup] };

const cohortApi: SnapshotBuilderCohort = { name: 'cohort', criteriaGroups: [criteriaGroupApi] };

const valueSet: ValueSet = { domain: 'valueDomain', values: [{ name: 'valueName' }] };

const valueSetApi: ValueSetApi = { name: 'valueDomain', values: ['valueName'] };

const conceptSet: DomainConceptSet = {
  name: 'conceptSetName',
  concept,
  featureValueGroupName: 'featureValueGroupName',
};

const datasetAccessRequest: DatasetAccessRequest = {
  name: 'RequestName',
  researchPurposeStatement: 'purpose',
  datasetRequest: { cohorts: [cohort], conceptSets: [conceptSet], valueSets: [valueSet] },
};

const datasetAccessRequestApi: SnapshotAccessRequestApi = {
  name: 'RequestName',
  researchPurposeStatement: 'purpose',
  datasetRequest: { cohorts: [cohortApi], conceptSets: [conceptSet], valueSets: [valueSetApi] },
};

describe('test conversion of criteria', () => {
  test('domainCriteria converted to domainCriteriaApi', () => {
    expect(convertCriteria(domainCriteria)).toStrictEqual(domainCriteriaApi);
  });
  test('rangeCriteria converted to rangeCriteriaApi', () => {
    expect(convertCriteria(rangeCriteria)).toStrictEqual(rangeCriteriaApi);
  });
  test('listCriteria converted to listCriteriaApi', () => {
    expect(convertCriteria(listCriteria)).toStrictEqual(listCriteriaApi);
  });
});

describe('test conversion of a cohort', () => {
  test('cohort converted to cohortApi', () => {
    expect(convertCohort(cohort)).toStrictEqual(cohortApi);
  });
});

describe('test conversion of valueSets', () => {
  test('valueSet converted to valueSetApi', () => {
    expect(convertValueSet(valueSet)).toStrictEqual(valueSetApi);
  });
});

describe('test conversion of DatasetAccessRequest', () => {
  test('datasetAccessRequest converted to datasetAccessRequestApi', () => {
    expect(convertDatasetAccessRequest(datasetAccessRequest)).toStrictEqual(datasetAccessRequestApi);
  });
});

describe('test HighlightConceptName', () => {
  const createHighlightConceptName = (beforeHighlight: string, highlightWord: string, afterHighlight: string) => {
    return div({ style: { display: 'pre-wrap' } }, [
      span([beforeHighlight]),
      span({ style: { fontWeight: 600 } }, [highlightWord]),
      span([afterHighlight]),
    ]);
  };

  test('searching beginning of conceptName', () => {
    const searchFilter = 'Clinic';
    const conceptName = 'Clinical Finding';
    const result = createHighlightConceptName('', 'Clinic', 'al Finding');
    expect(HighlightConceptName({ conceptName, searchFilter })).toStrictEqual(result);
  });

  test("Testing to make sure capitalization doesn't change", () => {
    const searchFilter = 'clin';
    const conceptName = 'Clinical Finding';
    const result = createHighlightConceptName('', 'Clin', 'ical Finding');
    expect(HighlightConceptName({ conceptName, searchFilter })).toStrictEqual(result);
  });

  test('searchedWord in the middle of conceptName', () => {
    const searchFilter = 'cal';
    const conceptName = 'Clinical Finding';
    const result = createHighlightConceptName('Clini', 'cal', ' Finding');
    expect(HighlightConceptName({ conceptName, searchFilter })).toStrictEqual(result);
  });

  test('searchedWord in the end of conceptName', () => {
    const searchFilter = 'Finding';
    const conceptName = 'Clinical Finding';
    const result = createHighlightConceptName('Clinical ', 'Finding', '');
    expect(HighlightConceptName({ conceptName, searchFilter })).toStrictEqual(result);
  });

  test('searchedWord in the not in conceptName: "XXX" in "Clinical Finding"', () => {
    const searchFilter = 'XXX';
    const conceptName = 'Clinical Finding';
    const result = div(['Clinical Finding']);
    expect(HighlightConceptName({ conceptName, searchFilter })).toStrictEqual(result);
  });

  test('searchedWord in the not in conceptName: "Clinical" in "Clin"', () => {
    const searchFilter = 'Clinical';
    const conceptName = 'Clin';
    const result = div(['Clin']);
    expect(HighlightConceptName({ conceptName, searchFilter })).toStrictEqual(result);
  });

  test('searchedWord is empty: "" ', () => {
    const searchFilter = '';
    const conceptName = 'Condition';
    const result = div(['Condition']);
    expect(HighlightConceptName({ conceptName, searchFilter })).toStrictEqual(result);
  });

  test("doesn't bold whitespace", () => {
    let searchFilter = ' ';
    let conceptName = 'Clinical Finding';
    let result = div(['Clinical Finding']);
    expect(HighlightConceptName({ conceptName, searchFilter })).toStrictEqual(result);

    searchFilter = '   ';
    conceptName = 'Clinical Finding';
    result = div(['Clinical Finding']);
    expect(HighlightConceptName({ conceptName, searchFilter })).toStrictEqual(result);
  });
});

describe('test formatCount', () => {
  test('count is 0', () => {
    expect(formatCount(0)).toStrictEqual('0');
  });

  test('count is 19', () => {
    expect(formatCount(19)).toStrictEqual('Less than 20');
  });

  test('count is 20', () => {
    expect(formatCount(20)).toStrictEqual('20');
  });
});
