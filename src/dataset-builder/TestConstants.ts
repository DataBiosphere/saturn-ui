import _ from 'lodash/fp';
import { SnapshotBuilderConcept as Concept, SnapshotBuilderSettings } from 'src/libs/ajax/DataRepo';

export const dummySnapshotId = '0';

export const dummySnapshotBuilderSettings = (): SnapshotBuilderSettings => ({
  programDataOptions: [
    {
      id: 0,
      name: 'Year of birth',
      kind: 'range',
      tableName: 'person',
      columnName: 'year_of_birth',
      min: 1907,
      max: 2013,
    },
    {
      id: 1,
      name: 'Ethnicity',
      kind: 'list',
      tableName: 'person',
      columnName: 'ethnicity',
      values: [
        { name: 'ethnicity 1', id: 300 },
        { name: 'ethnicity 2', id: 301 },
      ],
    },
    {
      id: 2,
      name: 'Gender identity',
      kind: 'list',
      tableName: 'person',
      columnName: 'gender_identity',
      values: [
        { name: 'gender 1', id: 200 },
        { name: 'gender 2', id: 201 },
      ],
    },
    {
      id: 3,
      name: 'Race',
      kind: 'list',
      tableName: 'person',
      columnName: 'race',
      values: [
        { name: 'race 1', id: 100 },
        { name: 'race 2', id: 101 },
      ],
    },
  ],
  domainOptions: [
    {
      kind: 'domain',
      id: 10,
      name: 'Condition',
      tableName: 'condition_occurrence',
      columnName: 'condition_concept_id',
      conceptCount: 18000,
      participantCount: 12500,
      root: dummyGetConceptForId(100),
    },
    {
      kind: 'domain',
      id: 11,
      name: 'Procedure',
      tableName: 'procedure_occurrence',
      columnName: 'procedure_concept_id',
      conceptCount: 22500,
      participantCount: 11328,
      root: dummyGetConceptForId(200),
    },
    {
      kind: 'domain',
      id: 12,
      name: 'Observation',
      tableName: 'observation',
      columnName: 'observation_concept_id',
      conceptCount: 12300,
      participantCount: 23223,
      root: dummyGetConceptForId(300),
    },
  ],
  featureValueGroups: [
    {
      values: ['condition column 1', 'condition column 2'],
      name: 'Condition',
    },
    {
      values: ['observation column 1', 'observation column 2'],
      name: 'Observation',
    },
    {
      values: ['procedure column 1', 'procedure column 2'],
      name: 'Procedure',
    },
    {
      values: ['surveys column 1', 'surveys column 2'],
      name: 'Surveys',
    },
    {
      values: ['demographics column 1', 'demographics column 2'],
      name: 'Person',
    },
  ],
  datasetConceptSets: [
    {
      name: 'Demographics',
      featureValueGroupName: 'Person',
    },
    {
      name: 'All surveys',
      featureValueGroupName: 'Surveys',
    },
  ],
});

const dummyConcepts = [
  // IDs must be unique.
  { id: 100, name: 'Condition', count: 100, code: '10000', hasChildren: true },
  { id: 101, name: 'Clinical Finding', count: 100, code: '10101', hasChildren: true },
  { id: 102, name: 'Disease', count: 100, code: '101020', hasChildren: true },
  { id: 103, name: 'Disorder by body site', count: 100, code: '10103', hasChildren: false },
  { id: 104, name: 'Inflammatory disorder', count: 100, code: '10104', hasChildren: false },
  { id: 105, name: 'Degenerative disorder', count: 100, code: '10105', hasChildren: false },
  { id: 106, name: 'Metabolic disease', count: 100, code: '10106', hasChildren: false },
  { id: 107, name: 'Finding by site', count: 100, code: '10107', hasChildren: false },
  { id: 108, name: 'Neurological finding', count: 100, code: '10108', hasChildren: false },
  { id: 200, name: 'Procedure', count: 100, code: '10200', hasChildren: true },
  { id: 201, name: 'Procedure', count: 100, code: '10201', hasChildren: true },
  { id: 202, name: 'Surgery', count: 100, code: '10202', hasChildren: false },
  { id: 203, name: 'Heart Surgery', count: 100, code: '10203', hasChildren: false },
  { id: 204, name: 'Cancer Surgery', count: 100, code: '10204', hasChildren: false },
  { id: 300, name: 'Observation', count: 100, code: '10300', hasChildren: true },
  { id: 301, name: 'Blood Pressure', count: 100, code: '10301', hasChildren: false },
  { id: 302, name: 'Weight', count: 100, code: '10302', hasChildren: false },
  { id: 303, name: 'Height', count: 100, code: '10303', hasChildren: false },
  { id: 400, name: 'Carcinoma of lung parenchyma', count: 100, code: '10400', hasChildren: true },
  { id: 401, name: 'Squamous cell carcinoma of lung', count: 100, code: '10401', hasChildren: true },
  { id: 402, name: 'Non-small cell lung cancer', count: 100, code: '10402', hasChildren: true },
  { id: 403, name: 'Epidermal growth factor receptor negative ...', count: 100, code: '10403', hasChildren: false },
  {
    id: 404,
    name: 'Non-small cell lung cancer with mutation in epidermal.',
    count: 100,
    code: '10404',
    hasChildren: true,
  },
  { id: 405, name: 'Non-small cell cancer of lung biopsy..', count: 100, code: '10405', hasChildren: false },
  { id: 406, name: 'Non-small cell cancer of lung lymph node..', count: 100, code: '10406', hasChildren: false },
  { id: 407, name: 'Small cell lung cancer', count: 100, code: '10407', hasChildren: true },
  { id: 408, name: 'Lung Parenchcyma', count: 100, code: '10408', hasChildren: false },
];

export const dummyGetConceptForId = (id: number): Concept => {
  return _.find({ id }, dummyConcepts)!;
};
