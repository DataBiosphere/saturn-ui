import { Modal, Spinner, useLoadedData } from '@terra-ui-packages/components';
import * as _ from 'lodash/fp';
import React, { Fragment, ReactElement, useEffect, useMemo, useState } from 'react';
import { div, h, h2, h3, label, li, ul } from 'react-hyperscript-helpers';
import { ActionBar } from 'src/components/ActionBar';
import { ButtonOutline, ButtonPrimary, IdContainer, LabeledCheckbox, spinnerOverlay } from 'src/components/common';
import FooterWrapper from 'src/components/FooterWrapper';
import { ValidatedInput } from 'src/components/input';
import { MenuButton } from 'src/components/MenuButton';
import { makeMenuIcon, MenuTrigger } from 'src/components/PopupTrigger';
import { TopBar } from 'src/components/TopBar';
import { StringInput } from 'src/data-catalog/create-dataset/CreateDatasetInputs';
import {
  addSelectableObjectToGroup,
  Cohort,
  createSnapshotAccessRequest,
  createSnapshotBuilderCountRequest,
  DatasetBuilderValue,
  formatCount,
} from 'src/dataset-builder/DatasetBuilderUtils';
import { DomainCriteriaSearch } from 'src/dataset-builder/DomainCriteriaSearch';
import { RequestAccessModal } from 'src/dataset-builder/RequestAccessModal';
import {
  DataRepo,
  DatasetBuilderType,
  SnapshotAccessRequestDetailsResponse,
  SnapshotAccessRequestResponse,
  SnapshotBuilderCountResponse,
  SnapshotBuilderDatasetConceptSet as ConceptSet,
  SnapshotBuilderDatasetConceptSet,
  SnapshotBuilderOutputTableApi as OutputTable,
  SnapshotBuilderSettings,
} from 'src/libs/ajax/DataRepo';
import colors from 'src/libs/colors';
import { withErrorReporting } from 'src/libs/error';
import { FormLabel } from 'src/libs/forms';
import * as Nav from 'src/libs/nav';
import { useOnMount } from 'src/libs/react-utils';
import * as Utils from 'src/libs/utils';
import { validate } from 'validate.js';

import { CohortEditor } from './CohortEditor';
import { AnyDatasetBuilderState, cohortEditorState, homepageState, newCohort, Updater } from './dataset-builder-types';
import { BuilderPageHeaderWrapper, DatasetBuilderHeader } from './DatasetBuilderHeader';
import { DomainCriteriaSelector } from './DomainCriteriaSelector';

const SelectorSubHeader = ({ children }) => div({ style: { fontSize: 12, fontWeight: 600 } }, children);

interface ObjectSetListItemProps<T extends DatasetBuilderType> {
  value: T;
  checked: boolean;
  onChange: (value: T) => void;
  icon?: ReactElement;
}

const ObjectSetListItem = <T extends DatasetBuilderType>(props: ObjectSetListItemProps<T>) => {
  const { value, checked, onChange } = props;
  return div(
    {
      style: {
        display: 'flex',
        padding: '0.5rem',
        border: `1px solid ${colors.light()}`,
        width: '100%',
        marginTop: '0.3rem',
        fontSize: 13,
        alignItems: 'center',
        justifyContent: 'space-between',
      },
    },
    [
      div([
        h(
          LabeledCheckbox,
          {
            checked,
            onChange: () => onChange(value),
          },
          [label({ style: { paddingLeft: '0.5rem' } }, [value.name])]
        ),
      ]),
      props.icon,
    ]
  );
};

interface ObjectSetListSectionProps<T extends DatasetBuilderType> {
  objectSet: HeaderAndValues<T>;
  selectedValues: { header: string; value: T }[];
  onChange: (value, header) => void;
}

const ObjectSetListSection = <T extends DatasetBuilderType>(props: ObjectSetListSectionProps<T>) => {
  const { objectSet, selectedValues, onChange } = props;
  const isChecked = (datasetBuilderObjectSet, value) =>
    _.intersectionWith(_.isEqual, [{ header: datasetBuilderObjectSet.header, value }], selectedValues).length > 0;

  return h(Fragment, [
    h(SelectorSubHeader, [objectSet.header]),
    _.map(
      (value) =>
        h(ObjectSetListItem, {
          key: _.uniqueId(''),
          value,
          checked: isChecked(objectSet, value),
          onChange: (value) => onChange(value, objectSet.header),
          icon: objectSet.makeIcon?.(value, objectSet.header),
        }),
      objectSet.values
    ),
  ]);
};

export interface HeaderAndValues<T extends DatasetBuilderType> {
  header?: string;
  values: T[];
  makeIcon?: (value, header) => ReactElement;
}

export interface RequiredHeaderAndValues<T extends DatasetBuilderType> extends HeaderAndValues<T> {
  header: string;
}

interface SelectorProps<T extends DatasetBuilderType> {
  number: number;
  header: string;
  subheader?: string;
  objectSets: HeaderAndValues<T>[];
  selectedObjectSets: HeaderAndValues<T>[];
  onChange: (newDatasetBuilderObjectSets: HeaderAndValues<T>[]) => void;
  headerAction?: any;
  placeholder?: any;
  style?: React.CSSProperties;
}

type SelectorComponent = <T extends DatasetBuilderType>(props: SelectorProps<T>) => ReactElement;
const Selector: SelectorComponent = <T extends DatasetBuilderType>(props) => {
  const { number, header, subheader, headerAction, placeholder, objectSets, onChange, selectedObjectSets, style } =
    props;
  const selectedValues = _.flatMap(
    (selectedDatasetBuilderObjectSet) =>
      _.map(
        (value) => ({ header: selectedDatasetBuilderObjectSet.header, value }),
        selectedDatasetBuilderObjectSet.values
      ),
    selectedObjectSets
  );

  const datasetBuilderSectionHasListItems = (datasetBuilderObjectSets) =>
    datasetBuilderObjectSets &&
    _.flatMap((datasetBuilderObjectSet) => datasetBuilderObjectSet.values, datasetBuilderObjectSets).length > 0;

  return li({ style: { width: '45%', ...style } }, [
    div({ style: { display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'flex-start' } }, [
      div({ style: { display: 'flex' } }, [
        div(
          {
            style: {
              backgroundColor: colors.accent(0.2),
              color: colors.dark(),
              padding: '0.5rem',
              borderRadius: '2rem',
              fontSize: 14,
              height: 24,
              width: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
            },
          },
          [number]
        ),
        div({ style: { marginLeft: 10, height: '3rem' } }, [
          h3({ style: { marginTop: 0, marginBottom: '0.5rem' } }, [header]),
          div({ style: { fontSize: 12 } }, [subheader]),
        ]),
      ]),
      headerAction,
    ]),
    div(
      {
        style: {
          backgroundColor: 'white',
          border: `1px solid ${colors.dark(0.5)}`,
          borderRadius: 10,
          height: 300,
          padding: '1rem',
          marginTop: '0.5rem',
        },
      },
      [
        datasetBuilderSectionHasListItems(objectSets)
          ? div(
              { style: { display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' } },
              _.map(
                (objectSet: HeaderAndValues<T>) =>
                  h(ObjectSetListSection, {
                    key: _.uniqueId(''),
                    objectSet,
                    selectedValues,
                    onChange: (value, header) => {
                      addSelectableObjectToGroup(value, header, selectedObjectSets, onChange);
                    },
                  }),
                _.filter((objectSet) => objectSet.values?.length > 0, objectSets)
              )
            )
          : div([placeholder]),
      ]
    ),
  ]);
};

export type OnStateChangeHandler = (state: AnyDatasetBuilderState) => void;
export const CreateCohortModal = ({
  onDismiss,
  onStateChange,
  cohorts,
}: {
  onDismiss: () => void;
  onStateChange: OnStateChangeHandler;
  cohorts: Cohort[];
}) => {
  const [cohortNameTouched, setCohortNameTouched] = useState(false);
  const [cohortName, setCohortName] = useState('');

  const errors =
    cohortNameTouched &&
    validate(
      { cohortName },
      {
        cohortName: {
          presence: {
            allowEmpty: false,
          },
          exclusion: {
            within: _.map((cohort: Cohort) => cohort.name, cohorts),
            message: 'already exists',
          },
        },
      }
    );

  const createCohort = (cohortName) => {
    onStateChange(cohortEditorState.new(newCohort(cohortName)));
  };

  return h(
    Modal,
    {
      onDismiss,
      title: 'Create a new cohort',
      okButton: h(
        ButtonPrimary,
        {
          onClick: () => {
            createCohort(cohortName);
            onDismiss();
          },
          disabled: !cohortNameTouched || errors?.cohortName,
        },
        ['Create cohort']
      ),
    },
    [
      h(StringInput, {
        title: 'Cohort name',
        onChange: (value) => {
          !cohortNameTouched && setCohortNameTouched(true);
          setCohortName(value);
        },
        value: cohortName,
        errors: errors?.cohortName,
        placeholder: 'Enter the cohort name',
        required: true,
      }),
    ]
  );
};

export const CohortSelector = ({
  cohorts,
  selectedCohorts,
  updateCohorts,
  onChange,
  onStateChange,
}: {
  cohorts: Cohort[];
  selectedCohorts: HeaderAndValues<Cohort>[];
  updateCohorts: Updater<Cohort[]>;
  onChange: (cohorts: HeaderAndValues<Cohort>[]) => void;
  onStateChange: OnStateChangeHandler;
}) => {
  const [creatingCohort, setCreatingCohort] = useState(false);

  return h(Fragment, [
    h(Selector<Cohort>, {
      headerAction: h(
        ButtonOutline,
        {
          style: { borderRadius: 0, fill: 'white', textTransform: 'none' },
          onClick: () => setCreatingCohort(true),
          'aria-haspopup': 'dialog',
        },
        ['Find participants']
      ),
      number: 1,
      onChange,
      objectSets: [
        {
          values: cohorts,
          header: selectedCohorts[0]?.header,
          makeIcon: (value, header) =>
            h(
              MenuTrigger,
              {
                closeOnClick: true,
                style: { marginLeft: '1rem' },
                content: h(Fragment, [
                  h(
                    MenuButton,
                    { 'aria-label': 'Edit cohort', onClick: () => onStateChange(cohortEditorState.new(value)) },
                    ['Edit']
                  ),
                  h(
                    MenuButton,
                    {
                      'aria-label': 'Delete cohort',
                      onClick: () => updateCohorts(_.without([value])),
                    },
                    ['Delete']
                  ),
                ]),
              },
              [makeMenuIcon('menu-icon-filled', { size: 20, 'aria-label': `${header}/${value.name} menu` })]
            ),
        },
      ],
      selectedObjectSets: selectedCohorts,
      header: 'Select participants',
      subheader: 'Which participants to include',
      placeholder: div([
        h(SelectorSubHeader, ['No cohorts yet']),
        div(["Create a cohort by clicking on the 'Find participants' button"]),
      ]),
    }),
    creatingCohort && h(CreateCohortModal, { onDismiss: () => setCreatingCohort(false), onStateChange, cohorts }),
  ]);
};

export const ConceptSetSelector = ({
  conceptSets,
  selectedConceptSets,
  onChange,
}: {
  conceptSets: ConceptSet[];
  selectedConceptSets: HeaderAndValues<ConceptSet>[];
  onChange: (conceptSets: HeaderAndValues<ConceptSet>[]) => void;
  onStateChange: OnStateChangeHandler;
}) => {
  return h(Selector<ConceptSet>, {
    number: 2,
    onChange,
    objectSets: [{ values: conceptSets }],
    selectedObjectSets: selectedConceptSets,
    header: 'Select data about participants',
    subheader: 'Which information to include about participants',
    style: { marginLeft: '1rem' },
  });
};

export const snapshotRequestNameValidator = {
  length: { minimum: 3, maximum: 511 },
};

export type DatasetBuilderContentsProps = {
  onStateChange: OnStateChangeHandler;
  updateCohorts: Updater<Cohort[]>;
  snapshotId: string;
  snapshotBuilderSettings: SnapshotBuilderSettings;
  cohorts: Cohort[];
  conceptSets: ConceptSet[];
  selectedCohorts: HeaderAndValues<Cohort>[];
  updateSelectedCohorts: (cohorts: HeaderAndValues<Cohort>[]) => void;
  selectedConceptSets: HeaderAndValues<ConceptSet>[];
  updateSelectedConceptSets: (cohorts: HeaderAndValues<ConceptSet>[]) => void;
  selectedColumns: RequiredHeaderAndValues<DatasetBuilderValue>[];
  updateSelectedColumns: (values: RequiredHeaderAndValues<DatasetBuilderValue>[]) => void;
  snapshotRequestName: string;
  updateSnapshotRequestName: (string) => void;
};

export const DatasetBuilderContents = ({
  onStateChange,
  updateCohorts,
  snapshotId,
  snapshotBuilderSettings,
  cohorts,
  conceptSets,
  selectedCohorts,
  updateSelectedCohorts,
  selectedConceptSets,
  updateSelectedConceptSets,
  selectedColumns,
  updateSelectedColumns,
  snapshotRequestName,
  updateSnapshotRequestName,
}: DatasetBuilderContentsProps) => {
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [snapshotRequestParticipantCount, setSnapshotRequestParticipantCount] =
    useLoadedData<SnapshotBuilderCountResponse>();
  const [snapshotAccessRequest, setSnapshotAccessRequest] = useLoadedData<SnapshotAccessRequestResponse>();
  const [snapshotAccessRequestDetails, setSnapshotAccessRequestDetails] =
    useLoadedData<SnapshotAccessRequestDetailsResponse>();
  const [snapshotRequestNameTouched, setSnapshotRequestNameTouched] = useState(false);

  const allCohorts: Cohort[] = useMemo(() => _.flatMap('values', selectedCohorts), [selectedCohorts]);
  const allConceptSets: ConceptSet[] = useMemo(() => _.flatMap('values', selectedConceptSets), [selectedConceptSets]);

  const requestValid = allCohorts.length > 0 && allConceptSets.length > 0;

  useEffect(() => {
    requestValid &&
      setSnapshotRequestParticipantCount(
        withErrorReporting(`Error fetching snapshot builder count for snapshot ${snapshotId}`)(async () =>
          DataRepo().snapshot(snapshotId).getSnapshotBuilderCount(createSnapshotBuilderCountRequest(allCohorts))
        )
      );
  }, [snapshotId, selectedColumns, setSnapshotRequestParticipantCount, allCohorts, allConceptSets, requestValid]);

  useEffect(() => {
    if (snapshotAccessRequest.status === 'Ready') {
      setSnapshotAccessRequestDetails(
        withErrorReporting('Error creating dataset request')(
          async () =>
            await DataRepo().snapshotAccessRequest().getSnapshotAccessRequestDetails(snapshotAccessRequest.state.id)
        )
      );
    }
  }, [snapshotAccessRequest, setSnapshotAccessRequestDetails]);

  const getNewColumns = (includedColumns: string[]): string[] =>
    _.without(
      [
        ..._.flatMap(
          (selectedHeaderValues: RequiredHeaderAndValues<DatasetBuilderValue>) => selectedHeaderValues.header,
          selectedColumns
        ),
        ..._.flow(
          _.flatMap((selectedConceptSetGroup: HeaderAndValues<ConceptSet>) => selectedConceptSetGroup.values),
          _.map((selectedConceptSet) => selectedConceptSet.name)
        )(selectedConceptSets),
      ],
      includedColumns
    );

  const createHeaderAndValuesFromColumns = (columns: string[]): RequiredHeaderAndValues<DatasetBuilderValue>[] =>
    _.flow(
      _.filter((outputTable: OutputTable) => _.includes(outputTable.name, columns)),
      _.map((datasetConceptSet: SnapshotBuilderDatasetConceptSet) => ({
        header: datasetConceptSet.name,
        values: _.map((value) => ({ name: value }), datasetConceptSet.table.columns),
      }))
    )(snapshotBuilderSettings.datasetConceptSets);

  const errors = validate({ snapshotRequestName }, { snapshotRequestName: snapshotRequestNameValidator });

  return h(Fragment, [
    div({ style: { display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }, [
      h(BuilderPageHeaderWrapper, [
        h2(['Data Snapshots']),
        div(['Subset your data by choosing participants and data then importing to a Terra workspace']),
        h(IdContainer, [
          (id) =>
            div({ style: { height: '4rem', paddingBottom: '1rem', width: '30rem' } }, [
              h(FormLabel, { htmlFor: id, style: { fontSize: 14, paddingBottom: '0.5rem' } }, [
                'Name your data snapshot',
              ]),
              h(ValidatedInput, {
                inputProps: {
                  id,
                  value: snapshotRequestName,
                  onChange: (v) => {
                    setSnapshotRequestNameTouched(true);
                    updateSnapshotRequestName(v);
                  },
                  placeholder: 'Enter a name',
                },
                error: snapshotRequestNameTouched && Utils.summarizeErrors(errors),
              }),
            ]),
        ]),
        ul({ style: { display: 'flex', width: '100%', marginTop: '2rem', listStyleType: 'none', padding: 0 } }, [
          h(CohortSelector, {
            cohorts,
            selectedCohorts,
            onChange: updateSelectedCohorts,
            updateCohorts,
            onStateChange,
          }),
          h(ConceptSetSelector, {
            // all concept sets
            conceptSets,
            selectedConceptSets,
            onChange: async (conceptSets) => {
              const includedColumns = _.flow(
                _.flatMap((headerAndValues: HeaderAndValues<ConceptSet>) => headerAndValues.values),
                _.map((conceptSet: ConceptSet) => conceptSet.name)
              )(conceptSets);
              const newColumns = getNewColumns(includedColumns);
              updateSelectedColumns([...selectedColumns, ...createHeaderAndValuesFromColumns(newColumns)]);
              updateSelectedConceptSets(conceptSets);
            },
            onStateChange,
          }),
        ]),
      ]),
      requestValid &&
        h(ActionBar, {
          prompt: h(Fragment, [
            snapshotRequestParticipantCount.status === 'Ready'
              ? formatCount(snapshotRequestParticipantCount.state.result.total)
              : h(Spinner),
            ' participants in this dataset',
          ]),
          disabled: !!errors,
          tooltip: !!errors && _.map((error) => div({ key: error }, [error]), errors),
          actionText: 'Import to workspace',
          onClick: () => {
            setSnapshotAccessRequest(
              withErrorReporting('Error creating dataset request')(
                async () =>
                  await DataRepo()
                    .snapshotAccessRequest()
                    .createSnapshotAccessRequest(
                      createSnapshotAccessRequest(
                        snapshotRequestName,
                        '',
                        snapshotId,
                        _.flatMap((cohortSet) => cohortSet.values, selectedCohorts),
                        _.map(
                          (outputTables: RequiredHeaderAndValues<DatasetBuilderValue>) => ({
                            domain: outputTables.header,
                            columns: outputTables.values,
                          }),
                          selectedColumns // convert from HeaderAndValues<DatasetBuilderType>[] to OutputTable[]
                        )
                      )
                    )
              )
            );
            setRequestingAccess(true);
          },
        }),
    ]),
    snapshotAccessRequest.status === 'Loading' || snapshotAccessRequestDetails.status === 'Loading'
      ? spinnerOverlay
      : snapshotAccessRequest.status === 'Ready' &&
        snapshotAccessRequestDetails.status === 'Ready' &&
        requestingAccess &&
        h(RequestAccessModal, {
          onDismiss: () => {
            setRequestingAccess(false);
            Nav.goToPath('dataset-builder-details', { snapshotId });
          },
          requestId: snapshotAccessRequest.state.id,
          summary: snapshotAccessRequestDetails.state.summary,
        }),
  ]);
};

interface DatasetBuilderProps {
  snapshotId: string;
  initialState?: AnyDatasetBuilderState;
}

const editorBackgroundColor = colors.light(0.7);

let criteriaCount = 1;

const defaultHeader = 'Saved cohorts';

export const DatasetBuilderView: React.FC<DatasetBuilderProps> = (props) => {
  const { snapshotId, initialState } = props;
  const [snapshotRoles, loadSnapshotRoles] = useLoadedData<string[]>();
  const [snapshotBuilderSettings, loadSnapshotBuilderSettings] = useLoadedData<SnapshotBuilderSettings>();
  const [datasetBuilderState, setDatasetBuilderState] = useState<AnyDatasetBuilderState>(
    initialState || homepageState.new()
  );
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohorts, setSelectedCohorts] = useState([
    { header: defaultHeader, values: [] },
  ] as HeaderAndValues<Cohort>[]);
  const [selectedConceptSets, setSelectedConceptSets] = useState([] as HeaderAndValues<ConceptSet>[]);
  const [selectedColumns, setSelectedColumns] = useState([] as RequiredHeaderAndValues<DatasetBuilderValue>[]);
  const [snapshotRequestName, setSnapshotRequestName] = useState('');
  const conceptSets =
    snapshotBuilderSettings.status === 'Ready' ? snapshotBuilderSettings.state.datasetConceptSets : [];
  const onStateChange = setDatasetBuilderState;

  const getNextCriteriaIndex = () => {
    criteriaCount++;
    return criteriaCount;
  };

  const addSelectedCohort = (cohort: Cohort) => {
    addSelectableObjectToGroup(cohort, defaultHeader, selectedCohorts, setSelectedCohorts);
  };

  useOnMount(() => {
    void loadSnapshotBuilderSettings(
      withErrorReporting(`Error fetching snapshot builder settings for snapshot ${snapshotId}`)(async () =>
        DataRepo().snapshot(snapshotId).getSnapshotBuilderSettings()
      )
    );
    void loadSnapshotRoles(
      withErrorReporting(`Error fetching roles for snapshot ${snapshotId}`)(async () =>
        DataRepo().snapshot(snapshotId).roles()
      )
    );
  });

  useEffect(() => {
    if (snapshotRoles.status === 'Ready' && !_.contains('aggregate_data_reader', snapshotRoles.state)) {
      Nav.goToPath('dataset-builder-details', { snapshotId });
    }
  }, [snapshotRoles, snapshotId]);

  return snapshotRoles.status === 'Ready' && snapshotBuilderSettings.status === 'Ready'
    ? h(FooterWrapper, [
        h(TopBar, { title: 'Preview', href: '' }, []),
        h(DatasetBuilderHeader, { snapshotId }),
        div({ style: { backgroundColor: editorBackgroundColor, height: '100%' } }, [
          (() => {
            switch (datasetBuilderState.mode) {
              case 'homepage':
                return h(DatasetBuilderContents, {
                  onStateChange,
                  updateCohorts: setCohorts,
                  snapshotId,
                  snapshotBuilderSettings: snapshotBuilderSettings.state,
                  cohorts,
                  conceptSets,
                  selectedCohorts,
                  updateSelectedCohorts: setSelectedCohorts,
                  selectedConceptSets,
                  updateSelectedConceptSets: setSelectedConceptSets,
                  selectedColumns,
                  updateSelectedColumns: setSelectedColumns,
                  snapshotRequestName,
                  updateSnapshotRequestName: setSnapshotRequestName,
                });
              case 'cohort-editor':
                return h(CohortEditor, {
                  onStateChange,
                  originalCohort: datasetBuilderState.cohort,
                  snapshotId,
                  addSelectedCohort,
                  snapshotBuilderSettings: snapshotBuilderSettings.state,
                  updateCohorts: setCohorts,
                  getNextCriteriaIndex,
                });
              case 'domain-criteria-selector':
                return h(DomainCriteriaSelector, {
                  state: datasetBuilderState,
                  onStateChange,
                  snapshotId,
                  getNextCriteriaIndex,
                });
              case 'domain-criteria-search':
                return h(DomainCriteriaSearch, {
                  state: datasetBuilderState,
                  onStateChange,
                  snapshotId,
                  getNextCriteriaIndex,
                });
              default:
                return datasetBuilderState;
            }
          })(),
        ]),
      ])
    : spinnerOverlay;
};
