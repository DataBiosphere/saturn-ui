import { Spinner, useLoadedData } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import React, { Fragment, useEffect, useRef, useState } from 'react';
import { div, h, h2, h3, strong } from 'react-hyperscript-helpers';
import { Chart } from 'src/components/Chart';
import { ButtonOutline, ButtonPrimary, GroupedSelect, Link, Select } from 'src/components/common';
import Slider from 'src/components/common/Slider';
import { icon } from 'src/components/icons';
import { NumberInput } from 'src/components/input';
import { BuilderPageHeaderWrapper } from 'src/dataset-builder/DatasetBuilderHeader';
import {
  AnyCriteria,
  Cohort,
  createSnapshotBuilderCountRequest,
  CriteriaGroup,
  debounceAsync,
  formatCount,
  ProgramDataListCriteria,
  ProgramDataRangeCriteria,
} from 'src/dataset-builder/DatasetBuilderUtils';
import {
  DataRepo,
  SnapshotBuilderCountResponse,
  SnapshotBuilderDomainOption,
  SnapshotBuilderOption,
  SnapshotBuilderProgramDataListItem,
  SnapshotBuilderProgramDataListOption,
  SnapshotBuilderProgramDataOption,
  SnapshotBuilderProgramDataRangeOption,
  SnapshotBuilderSettings,
} from 'src/libs/ajax/DataRepo';
import colors from 'src/libs/colors';
import { withErrorReporting } from 'src/libs/error';
import * as Utils from 'src/libs/utils';

import { domainCriteriaSearchState, homepageState, newCriteriaGroup, Updater } from './dataset-builder-types';
import { OnStateChangeHandler } from './DatasetBuilder';
import {
  chartOptions,
  CohortDemographics,
  generateCohortAgeData,
  generateCohortDemographicData,
  generateRandomCohortAgeData,
  generateRandomCohortDemographicData,
} from './DemographicsChart';

const flexWithBaseline = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
};

const narrowMargin = 5;
const wideMargin = 10;

type CriteriaViewProps = {
  readonly snapshotId: string;
  readonly criteria: AnyCriteria;
  readonly deleteCriteria: (criteria: AnyCriteria) => void;
  readonly updateCriteria: (criteria: AnyCriteria) => void;
};

const addCriteriaText = 'Add criteria';

export const CriteriaView = (props: CriteriaViewProps) => {
  const { snapshotId, criteria, deleteCriteria, updateCriteria } = props;

  const [criteriaCount, setCriteriaCount] = useLoadedData<SnapshotBuilderCountResponse>();

  const updateCriteriaCount = useRef(
    debounceAsync((snapshotId: string, criteria: AnyCriteria) =>
      setCriteriaCount(
        withErrorReporting('Error getting criteria group count')(
          async () =>
            await DataRepo()
              .snapshot(snapshotId)
              .getSnapshotBuilderCount(
                createSnapshotBuilderCountRequest([
                  {
                    // Create a "cohort" to get the count of participants for these criteria on its own.
                    criteriaGroups: [{ id: 0, criteria: [criteria], meetAll: true, mustMeet: true }],
                    name: '',
                  },
                ])
              )
        )
      )
    )
  );

  useEffect(() => {
    updateCriteriaCount.current(snapshotId, criteria);
  }, [criteria, snapshotId]);
  return div(
    {
      style: {
        ...flexWithBaseline,
        width: '100%',
        paddingBottom: narrowMargin,
        marginTop: wideMargin,
        marginBottom: narrowMargin,
        borderBottom: `1px solid ${colors.dark(0.35)}`,
      },
    },
    [
      div({ style: { margin: '5px', display: 'flex', alignItems: 'center' } }, [
        h(
          Link,
          {
            'aria-label': 'delete criteria',
            onClick: () => {
              deleteCriteria(criteria);
            },
          },
          [icon('trash-circle-filled', { size: 35, style: { color: colors.danger() } })]
        ),
        div({ style: { marginLeft: narrowMargin, width: '25rem' } }, [
          (() => {
            switch (criteria.kind) {
              case 'domain':
                return h(Fragment, [strong([`${criteria.option.name}:`]), ` ${criteria.conceptName}`]);
              case 'list':
                return h(Fragment, [
                  strong([`${criteria.option.name}: ${_.flow(_.map('name'), _.join(', '))(criteria.values)}`]),
                  h(Select, {
                    'aria-label': `Select one or more ${criteria.option.name}`,
                    isClearable: true,
                    isMulti: true,
                    options: _.map(
                      (value) => ({
                        label: value.name,
                        value: value.id,
                      }),
                      criteria.option.values
                    ),
                    value: _.map('id', criteria.values),
                    onChange: (values) =>
                      _.flow(
                        _.set(
                          'values',
                          _.filter(
                            (value: SnapshotBuilderProgramDataListItem) =>
                              _.flow(_.map('value'), _.includes(value.id))(values),
                            criteria.option.values
                          )
                        ),
                        updateCriteria
                      )(criteria),
                  }),
                ]);
              case 'range': {
                const numberInputStyles = {
                  width: '4rem',
                  padding: 0,
                };
                const rangeSliderMargin = 20;
                return h(Fragment, [
                  div([strong([`${criteria.option.name}:`]), ` ${criteria.low} - ${criteria.high}`]),
                  div({ style: { display: 'flex', alignItems: 'center' } }, [
                    h(NumberInput, {
                      min: criteria.option.min,
                      max: criteria.high,
                      isClearable: false,
                      onlyInteger: true,
                      value: criteria.low,
                      onChange: (v) => updateCriteria({ ...criteria, low: v }),
                      'aria-label': `${criteria.option.name} low`,
                      style: numberInputStyles,
                    }),
                    h(Slider, {
                      range: true,
                      value: [criteria.low, criteria.high],
                      min: criteria.option.min,
                      onChange: (values) => updateCriteria({ ...criteria, low: values[0], high: values[1] }),
                      max: criteria.option.max,
                      style: { marginLeft: rangeSliderMargin },
                      ariaLabelForHandle: [`${criteria.option.name} low slider`, `${criteria.option.name} high slider`],
                    }),
                    h(NumberInput, {
                      min: criteria.low,
                      max: criteria.option.max,
                      isClearable: false,
                      onlyInteger: true,
                      value: criteria.high,
                      onChange: (v) => updateCriteria({ ...criteria, high: v }),
                      'aria-label': `${criteria.option.name} high`,
                      style: { ...numberInputStyles, marginLeft: rangeSliderMargin },
                    }),
                  ]),
                ]);
              }
              default:
                return div(['Unknown criteria']);
            }
          })(),
        ]),
      ]),
      div(['Count: ', criteriaCount.status === 'Ready' ? formatCount(criteriaCount.state.result.total) : h(Spinner)]),
    ]
  );
};

export const criteriaFromOption = (
  index: number,
  option: SnapshotBuilderProgramDataRangeOption | SnapshotBuilderProgramDataListOption
): ProgramDataRangeCriteria | ProgramDataListCriteria => {
  switch (option.kind) {
    case 'range': {
      return {
        kind: option.kind,
        option,
        index,
        low: option.min,
        high: option.max,
      };
    }
    case 'list': {
      return {
        kind: option.kind,
        option,
        index,
        values: [],
      };
    }
    default:
      throw new Error('Unknown option');
  }
};

type AddCriteriaSelectorProps = {
  index: number;
  criteriaGroup: CriteriaGroup;
  updateCohort: Updater<Cohort>;
  snapshotBuilderSettings: SnapshotBuilderSettings;
  onStateChange: OnStateChangeHandler;
  getNextCriteriaIndex: () => number;
  cohort: Cohort;
};

const AddCriteriaSelector: React.FC<AddCriteriaSelectorProps> = (props) => {
  const { index, criteriaGroup, updateCohort, snapshotBuilderSettings, onStateChange, getNextCriteriaIndex, cohort } =
    props;

  const convertToProgramDataOptionSubtype = (option: SnapshotBuilderProgramDataOption) => {
    switch (option.kind) {
      case 'list':
        return option as SnapshotBuilderProgramDataListOption;
      case 'range':
        return option as SnapshotBuilderProgramDataRangeOption;
      default:
        throw new Error(`Unknown program data subtype: ${option.kind}`);
    }
  };

  return (
    snapshotBuilderSettings &&
    h(GroupedSelect<SnapshotBuilderOption>, {
      styles: { container: (provided) => ({ ...provided, width: '230px', marginTop: wideMargin }) },
      isClearable: false,
      isSearchable: false,
      options: [
        {
          label: 'Domains',
          options: _.map(
            (domainOption) => ({
              value: domainOption,
              label: domainOption.name,
            }),
            snapshotBuilderSettings.domainOptions
          ),
        },
        {
          label: 'Demographics',
          options: _.map((programDataOption) => {
            return {
              value: programDataOption,
              label: programDataOption.name,
            };
          }, snapshotBuilderSettings.programDataOptions),
        },
      ],
      'aria-label': addCriteriaText,
      placeholder: addCriteriaText,
      value: null,
      onChange: async (criteriaOption) => {
        if (criteriaOption !== null) {
          if (criteriaOption.value.kind === 'domain') {
            onStateChange(
              domainCriteriaSearchState.new(cohort, criteriaGroup, criteriaOption.value as SnapshotBuilderDomainOption)
            );
          } else {
            const criteriaIndex = getNextCriteriaIndex();
            updateCohort(
              _.set(
                `criteriaGroups.${index}.criteria.${criteriaGroup.criteria.length}`,
                criteriaFromOption(
                  criteriaIndex,
                  convertToProgramDataOptionSubtype(criteriaOption.value as SnapshotBuilderProgramDataOption)
                )
              )
            );
          }
        }
      },
    })
  );
};

type CriteriaGroupViewProps = {
  index: number;
  criteriaGroup: CriteriaGroup;
  updateCohort: Updater<Cohort>;
  cohort: Cohort;
  snapshotId: string;
  snapshotBuilderSettings: SnapshotBuilderSettings;
  onStateChange: OnStateChangeHandler;
  getNextCriteriaIndex: () => number;
};

export const CriteriaGroupView: React.FC<CriteriaGroupViewProps> = (props) => {
  const {
    index,
    criteriaGroup,
    updateCohort,
    cohort,
    snapshotId,
    snapshotBuilderSettings,
    onStateChange,
    getNextCriteriaIndex,
  } = props;

  const deleteCriteria = (criteria: AnyCriteria) =>
    updateCohort(_.set(`criteriaGroups.${index}.criteria`, _.without([criteria], criteriaGroup.criteria)));

  const updateCriteria = (criteria: AnyCriteria) => {
    updateCohort(
      _.set(
        `criteriaGroups.${index}.criteria.${_.findIndex(
          { index: criteria.index },
          cohort.criteriaGroups[index].criteria
        )}`,
        criteria
      )
    );
  };

  const [groupParticipantCount, setGroupParticipantCount] = useLoadedData<SnapshotBuilderCountResponse>();

  const updateGroupParticipantCount = useRef(
    debounceAsync((snapshotId: string, criteriaGroup: CriteriaGroup) =>
      setGroupParticipantCount(
        withErrorReporting('Error getting criteria group count')(
          async () =>
            await DataRepo()
              .snapshot(snapshotId)
              .getSnapshotBuilderCount(
                createSnapshotBuilderCountRequest([{ criteriaGroups: [criteriaGroup], name: '' }])
              )
        )
      )
    )
  );

  useEffect(() => {
    updateGroupParticipantCount.current(snapshotId, criteriaGroup);
  }, [criteriaGroup, snapshotId]);

  return div(
    {
      style: {
        backgroundColor: 'white',
        borderRadius: '5px',
        marginTop: narrowMargin,
        border: `1px solid ${colors.dark(0.35)}`,
      },
    },
    [
      div({ style: { padding: '1rem' } }, [
        div(
          {
            style: { ...flexWithBaseline, width: '100%' },
          },
          [
            div(
              {
                style: flexWithBaseline,
              },
              [
                h(Select, {
                  'aria-label': 'must or must not meet',
                  options: ['Must', 'Must not'],
                  value: criteriaGroup.mustMeet ? 'Must' : 'Must not',
                  onChange: () => updateCohort(_.set(`criteriaGroups.${index}.mustMeet`, !criteriaGroup.mustMeet)),
                }),
                div({ style: { margin: '0 10px' } }, ['meet']),
                h(Select, {
                  'aria-label': 'all or any',
                  styles: { container: (provided) => ({ ...provided, style: { marginLeft: wideMargin } }) },
                  options: ['any', 'all'],
                  value: criteriaGroup.meetAll ? 'all' : 'any',
                  onChange: () => updateCohort(_.set(`criteriaGroups.${index}.meetAll`, !criteriaGroup.meetAll)),
                }),
                div({ style: { marginLeft: wideMargin } }, ['of the following criteria:']),
              ]
            ),
            div({ style: { alignItems: 'center', display: 'flex' } }, [
              strong({ style: { marginRight: narrowMargin, fontSize: 16 } }, [`Group ${index + 1}`]),
              h(
                Link,
                {
                  'aria-label': `delete group ${index + 1}`,
                  onClick: () =>
                    updateCohort(_.set('criteriaGroups', _.without([criteriaGroup], cohort.criteriaGroups))),
                },
                [icon('trash-circle-filled', { size: 24 })]
              ),
            ]),
          ]
        ),
        div([
          criteriaGroup.criteria.length !== 0
            ? _.map(
                ([criteriaIndex, criteria]) =>
                  h(CriteriaView, {
                    snapshotId,
                    deleteCriteria,
                    updateCriteria,
                    criteria,
                    key: criteriaIndex,
                  }),
                Utils.toIndexPairs(criteriaGroup.criteria)
              )
            : div({ style: { marginTop: 15 } }, [
                div({ style: { fontWeight: 'bold', fontStyle: 'italic' } }, ['No criteria yet']),
                div({ style: { fontStyle: 'italic', marginTop: narrowMargin } }, [
                  `You can add a criteria by clicking on '${addCriteriaText}'`,
                ]),
              ]),
        ]),
        h(AddCriteriaSelector, {
          index,
          criteriaGroup,
          snapshotBuilderSettings,
          updateCohort,
          onStateChange,
          getNextCriteriaIndex,
          cohort,
        }),
      ]),
      div(
        {
          style: {
            paddingTop: narrowMargin,
            marginTop: wideMargin,
            marginBottom: wideMargin,
            borderTop: `1px solid ${colors.dark(0.35)}`,
            display: 'flex',
            justifyContent: 'flex-end',
            fontWeight: 'bold',
          },
        },
        [
          div({ style: { marginRight: wideMargin } }, [
            'Group count: ',
            groupParticipantCount.status === 'Ready'
              ? formatCount(groupParticipantCount.state.result.total)
              : h(Spinner),
          ]),
        ]
      ),
    ]
  );
};

type CohortGroupsProps = {
  cohort: Cohort | undefined;
  snapshotId: string;
  snapshotBuilderSettings: SnapshotBuilderSettings;
  updateCohort: Updater<Cohort>;
  onStateChange: OnStateChangeHandler;
  getNextCriteriaIndex: () => number;
};
const CohortGroups: React.FC<CohortGroupsProps> = (props) => {
  const { snapshotId, snapshotBuilderSettings, cohort, updateCohort, onStateChange, getNextCriteriaIndex } = props;
  return div({ style: { width: '47rem' } }, [
    cohort == null
      ? 'No cohort found'
      : div([
          _.map(
            ([index, criteriaGroup]) =>
              h(Fragment, { key: index + 1 }, [
                h(CriteriaGroupView, {
                  index,
                  criteriaGroup,
                  updateCohort,
                  cohort,
                  snapshotId,
                  snapshotBuilderSettings,
                  onStateChange,
                  getNextCriteriaIndex,
                }),
                div({ style: { marginTop: '1rem', display: 'flex', alignItems: 'center' } }, [
                  div(
                    {
                      style: {
                        height: 45,
                        width: 45,
                        backgroundColor: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                        border: `1px solid ${colors.dark(0.35)}`,
                        fontStyle: 'italic',
                      },
                    },
                    ['And']
                  ),
                  div({
                    style: { marginLeft: narrowMargin, flexGrow: 1, borderTop: `1px solid ${colors.dark(0.35)}` },
                  }),
                ]),
              ]),
            Utils.toIndexPairs(cohort.criteriaGroups)
          ),
        ]),
  ]);
};

const editorBackgroundColor = colors.light(0.7);

type CohortEditorContentsProps = {
  updateCohort: Updater<Cohort>;
  cohort: Cohort;
  snapshotId: string;
  snapshotBuilderSettings: SnapshotBuilderSettings;
  onStateChange: OnStateChangeHandler;
  getNextCriteriaIndex: () => number;
};
const CohortEditorContents: React.FC<CohortEditorContentsProps> = (props) => {
  const { updateCohort, cohort, snapshotId, snapshotBuilderSettings, onStateChange, getNextCriteriaIndex } = props;
  return h(BuilderPageHeaderWrapper, [
    h2({ style: { display: 'flex', alignItems: 'center' } }, [
      h(
        Link,
        {
          onClick: () => {
            onStateChange(homepageState.new());
          },
          'aria-label': 'cancel',
        },
        [icon('left-circle-filled', { size: 32 })]
      ),
      div({ style: { marginLeft: 15 } }, [cohort.name]),
    ]),
    h3(['To be included in the cohort, participants...']),
    div({ style: { display: 'flow' } }, [
      h(CohortGroups, {
        key: cohort.name,
        snapshotId,
        snapshotBuilderSettings,
        cohort,
        updateCohort,
        onStateChange,
        getNextCriteriaIndex,
      }),
      h(
        ButtonOutline,
        {
          style: { marginTop: wideMargin },
          onClick: (e) => {
            updateCohort(_.set(`criteriaGroups.${cohort.criteriaGroups.length}`, newCriteriaGroup()));
            // Lose button focus, since button moves out from under the user's cursor.
            e.currentTarget.blur();
          },
        },
        ['Add group']
      ),
    ]),
  ]);
};

interface CohortEditorProps {
  readonly onStateChange: OnStateChangeHandler;
  readonly snapshotId: string;
  readonly snapshotBuilderSettings: SnapshotBuilderSettings;
  readonly originalCohort: Cohort;
  readonly updateCohorts: Updater<Cohort[]>;
  readonly addSelectedCohort: (cohort: Cohort) => void;
  readonly getNextCriteriaIndex: () => number;
}

const defaultCohortDemographicSeries = [
  { name: 'Asian', data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'Black', data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'White', data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'Native American', data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'Pacific Islander', data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
];
const defaultCohortAgeSeries = [{ data: [0, 0, 0] }];

export const CohortEditor: React.FC<CohortEditorProps> = (props) => {
  const {
    onStateChange,
    snapshotId,
    snapshotBuilderSettings,
    originalCohort,
    updateCohorts,
    addSelectedCohort,
    getNextCriteriaIndex,
  } = props;
  const [cohort, setCohort] = useState<Cohort>(originalCohort);
  const [snapshotRequestParticipantCount, setSnapshotRequestParticipantCount] =
    useLoadedData<SnapshotBuilderCountResponse>();
  const [cohortAges, setCohortAges] = useState<CohortDemographics>(generateCohortAgeData(defaultCohortAgeSeries));
  const [cohortDemographics, setCohortDemographics] = useState<CohortDemographics>(
    generateCohortDemographicData(defaultCohortDemographicSeries)
  );
  const countStatus = snapshotRequestParticipantCount.status;

  const updateCohort = (updateCohort: (Cohort) => Cohort) => setCohort(updateCohort);

  useEffect(() => {
    setSnapshotRequestParticipantCount(
      withErrorReporting(`Error fetching snapshot builder count for snapshot ${snapshotId}`)(async () =>
        DataRepo()
          .snapshot(snapshotId)
          .getSnapshotBuilderCount(createSnapshotBuilderCountRequest([cohort]))
      )
    );
  }, [snapshotId, setSnapshotRequestParticipantCount, cohort]);

  useEffect(() => {
    if (countStatus === 'Ready') {
      setCohortAges(generateRandomCohortAgeData());
      setCohortDemographics(generateRandomCohortDemographicData());
    } else {
      setCohortAges(generateCohortAgeData(defaultCohortAgeSeries));
      setCohortDemographics(generateCohortDemographicData(defaultCohortDemographicSeries));
    }
  }, [countStatus, setCohortAges, setCohortDemographics]);

  return div({ style: { display: 'flex' } }, [
    div([
      h(CohortEditorContents, {
        updateCohort,
        cohort,
        snapshotId,
        snapshotBuilderSettings,
        onStateChange,
        getNextCriteriaIndex,
      }),
      // add div to cover page to footer
      div(
        {
          style: {
            display: 'flex',
            backgroundColor: editorBackgroundColor,
            alignItems: 'end',
            flexDirection: 'row-reverse',
            padding: '0 3rem',
          },
        },
        [
          h(
            ButtonPrimary,
            {
              onClick: () => {
                updateCohorts((cohorts) => {
                  const index = _.findIndex((c) => _.equals(c.name, cohort.name), cohorts);
                  if (index === -1) {
                    // Only add to selectedCohorts on creation of new cohort
                    addSelectedCohort(cohort);
                  }
                  return _.set(`[${index === -1 ? cohorts.length : index}]`, cohort, cohorts);
                });
                onStateChange(homepageState.new());
              },
            },
            ['Save cohort']
          ),
        ]
      ),
    ]),
    div({ style: { width: '42rem' } }, [
      h2({ style: { padding: '1rem', display: 'flex', alignItems: 'center', margin: 0, backgroundColor: 'white' } }, [
        'Total participant count: ',
        snapshotRequestParticipantCount.status === 'Ready'
          ? formatCount(snapshotRequestParticipantCount.state.result.total)
          : h(Spinner, { style: { marginLeft: '1rem' } }),
      ]),
      h(Chart, { options: chartOptions(cohortAges) }),
      h(Chart, { options: chartOptions(cohortDemographics) }),
    ]),
  ]);
};
