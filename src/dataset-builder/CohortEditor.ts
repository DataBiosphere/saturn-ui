import { Spinner } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import React, { Fragment, useEffect, useRef, useState } from 'react';
import { div, h, h2, h3, strong } from 'react-hyperscript-helpers';
import { ButtonOutline, ButtonPrimary, GroupedSelect, Link, Select } from 'src/components/common';
import Slider from 'src/components/common/Slider';
import { icon } from 'src/components/icons';
import { NumberInput } from 'src/components/input';
import { BuilderPageHeader } from 'src/dataset-builder/DatasetBuilderHeader';
import {
  AnyCriteria,
  Cohort,
  convertDatasetParticipantCountRequest,
  CriteriaGroup,
  formatCount,
  ProgramDataListCriteria,
  ProgramDataRangeCriteria,
} from 'src/dataset-builder/DatasetBuilderUtils';
import {
  DataRepo,
  DatasetModel,
  SnapshotBuilderCountResponse,
  SnapshotBuilderDomainOption,
  SnapshotBuilderOption,
  SnapshotBuilderProgramDataListItem,
  SnapshotBuilderProgramDataListOption,
  SnapshotBuilderProgramDataOption,
  SnapshotBuilderProgramDataRangeOption,
} from 'src/libs/ajax/DataRepo';
import { useLoadedData } from 'src/libs/ajax/loaded-data/useLoadedData';
import colors from 'src/libs/colors';
import * as Utils from 'src/libs/utils';

import { domainCriteriaSearchState, homepageState, newCriteriaGroup, Updater } from './dataset-builder-types';
import { OnStateChangeHandler } from './DatasetBuilder';

const flexWithBaseline = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
};

const narrowMargin = 5;
const wideMargin = 10;

type CriteriaViewProps = {
  readonly datasetId: string;
  readonly criteria: AnyCriteria;
  readonly deleteCriteria: (criteria: AnyCriteria) => void;
  readonly updateCriteria: (criteria: AnyCriteria) => void;
};

const addCriteriaText = 'Add criteria';

export const CriteriaView = (props: CriteriaViewProps) => {
  const { datasetId, criteria, deleteCriteria, updateCriteria } = props;

  const [criteriaCount, setCriteriaCount] = useLoadedData<SnapshotBuilderCountResponse>();

  const updateCriteriaCount = useRef(
    _.debounce(250, (datasetId, criteria) => {
      setCriteriaCount(
        async () =>
          await DataRepo()
            .dataset(datasetId)
            .getSnapshotBuilderCount(
              convertDatasetParticipantCountRequest({
                cohorts: [
                  {
                    // Create a "cohort" to get the count of participants for this criteria on its own.
                    criteriaGroups: [{ criteria: [criteria], name: '', meetAll: true, mustMeet: true }],
                    name: '',
                  },
                ],
              })
            )
      );
    })
  );

  useEffect(() => {
    updateCriteriaCount.current(datasetId, criteria);
  }, [criteria, datasetId]);
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
  dataset: DatasetModel;
  onStateChange: OnStateChangeHandler;
  getNextCriteriaIndex: () => number;
  cohort: Cohort;
};

const AddCriteriaSelector: React.FC<AddCriteriaSelectorProps> = (props) => {
  const {
    index,
    criteriaGroup,
    updateCohort,
    dataset: { snapshotBuilderSettings },
    onStateChange,
    getNextCriteriaIndex,
    cohort,
  } = props;

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
          label: 'Program Data',
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
  dataset: DatasetModel;
  onStateChange: OnStateChangeHandler;
  getNextCriteriaIndex: () => number;
};

export const CriteriaGroupView: React.FC<CriteriaGroupViewProps> = (props) => {
  const { index, criteriaGroup, updateCohort, cohort, dataset, onStateChange, getNextCriteriaIndex } = props;

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
    _.debounce(250, (dataset, criteriaGroup) =>
      setGroupParticipantCount(async () =>
        DataRepo()
          .dataset(dataset.id)
          .getSnapshotBuilderCount({ cohorts: [{ criteriaGroups: [criteriaGroup], name: '' }] })
      )
    )
  );

  useEffect(() => {
    updateGroupParticipantCount.current(dataset, criteriaGroup);
  }, [criteriaGroup, dataset]);

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
              strong({ style: { marginRight: narrowMargin, fontSize: 16 } }, [criteriaGroup.name]),
              h(
                Link,
                {
                  'aria-label': 'delete group',
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
                    datasetId: dataset.id,
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
          updateCohort,
          dataset,
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
  dataset: DatasetModel;
  updateCohort: Updater<Cohort>;
  onStateChange: OnStateChangeHandler;
  getNextCriteriaIndex: () => number;
};
const CohortGroups: React.FC<CohortGroupsProps> = (props) => {
  const { dataset, cohort, updateCohort, onStateChange, getNextCriteriaIndex } = props;
  return div({ style: { width: '47rem' } }, [
    cohort == null
      ? 'No cohort found'
      : div([
          _.map(
            ([index, criteriaGroup]) =>
              h(Fragment, { key: criteriaGroup.name }, [
                h(CriteriaGroupView, {
                  index,
                  criteriaGroup,
                  updateCohort,
                  cohort,
                  dataset,
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
  dataset: DatasetModel;
  onStateChange: OnStateChangeHandler;
  getNextCriteriaIndex: () => number;
};
const CohortEditorContents: React.FC<CohortEditorContentsProps> = (props) => {
  const { updateCohort, cohort, dataset, onStateChange, getNextCriteriaIndex } = props;
  return h(BuilderPageHeader, [
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
        dataset,
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
  readonly dataset: DatasetModel;
  readonly originalCohort: Cohort;
  readonly updateCohorts: Updater<Cohort[]>;
  readonly getNextCriteriaIndex: () => number;
}

export const CohortEditor: React.FC<CohortEditorProps> = (props) => {
  const { onStateChange, dataset, originalCohort, updateCohorts, getNextCriteriaIndex } = props;
  const [cohort, setCohort] = useState<Cohort>(originalCohort);

  const updateCohort = (updateCohort: (Cohort) => Cohort) => setCohort(updateCohort);

  return h(Fragment, [
    h(CohortEditorContents, {
      updateCohort,
      cohort,
      dataset,
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
          padding: wideMargin,
        },
      },
      [
        h(
          ButtonPrimary,
          {
            onClick: () => {
              updateCohorts((cohorts) => {
                const index = _.findIndex((c) => _.equals(c.name, cohort.name), cohorts);
                return _.set(`[${index === -1 ? cohorts.length : index}]`, cohort, cohorts);
              });
              onStateChange(homepageState.new());
            },
          },
          ['Save cohort']
        ),
      ]
    ),
  ]);
};
