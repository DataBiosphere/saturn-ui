import { Modal, TooltipTrigger } from '@terra-ui-packages/components';
import { readFileAsText } from '@terra-ui-packages/core-utils';
import _ from 'lodash/fp';
import { Component, Fragment, useEffect, useState } from 'react';
import { b, div, h, label, span } from 'react-hyperscript-helpers';
import * as breadcrumbs from 'src/components/breadcrumbs';
import {
  ButtonPrimary,
  ButtonSecondary,
  Clickable,
  GroupedSelect,
  IdContainer,
  LabeledCheckbox,
  Link,
  RadioButton,
  Select,
  spinnerOverlay,
} from 'src/components/common';
import Dropzone from 'src/components/Dropzone';
import { centeredSpinner, icon } from 'src/components/icons';
import { InfoBox } from 'src/components/InfoBox';
import { DelayedAutocompleteTextArea, DelayedSearchInput, NumberInput, TextInput } from 'src/components/input';
import { MarkdownViewer } from 'src/components/markdown';
import { MenuButton } from 'src/components/MenuButton';
import { makeMenuIcon, MenuTrigger } from 'src/components/PopupTrigger';
import StepButtons from 'src/components/StepButtons';
import { HeaderCell, SimpleFlexTable, SimpleTable, Sortable, TextCell } from 'src/components/table';
import WDLViewer from 'src/components/WDLViewer';
import { Dockstore } from 'src/libs/ajax/Dockstore';
import { GoogleStorage } from 'src/libs/ajax/GoogleStorage';
import { Methods } from 'src/libs/ajax/methods/Methods';
import { Metrics } from 'src/libs/ajax/Metrics';
import { makeExportWorkflowFromWorkspaceProvider } from 'src/libs/ajax/workspaces/providers/ExportWorkflowToWorkspaceProvider';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import colors, { terraSpecial } from 'src/libs/colors';
import { reportError, withErrorReporting } from 'src/libs/error';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import { isFeaturePreviewEnabled } from 'src/libs/feature-previews';
import { FIRECLOUD_UI_MIGRATION, PREVIEW_COST_CAPPING } from 'src/libs/feature-previews-config';
import { HiddenLabel } from 'src/libs/forms';
import * as Nav from 'src/libs/nav';
import { getLocalPref, setLocalPref } from 'src/libs/prefs';
import { useCancellation, useOnMount, withCancellationSignal } from 'src/libs/react-utils';
import { workflowSelectionStore } from 'src/libs/state';
import * as StateHistory from 'src/libs/state-history';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';
import {
  downloadIO,
  getWorkflowInputSuggestionsForAttributesOfSetMembers,
  ioTask,
  ioVariable,
  WorkflowTableColumnNames,
} from 'src/libs/workflow-utils';
import DataStepContent from 'src/pages/workspaces/workspace/workflows/DataStepContent';
import DeleteWorkflowConfirmationModal from 'src/pages/workspaces/workspace/workflows/DeleteWorkflowConfirmationModal';
import { chooseBaseType, chooseRootType, chooseSetType, processSnapshotTable } from 'src/pages/workspaces/workspace/workflows/EntitySelectionType';
import LaunchAnalysisModal from 'src/pages/workspaces/workspace/workflows/LaunchAnalysisModal';
import { methodLink } from 'src/pages/workspaces/workspace/workflows/methodLink';
import { sanitizeAttributeUpdateString } from 'src/pages/workspaces/workspace/workflows/workflow-view-utils';
import ExportWorkflowModal from 'src/workflows/modals/ExportWorkflowModal';
import { wrapWorkspace } from 'src/workspaces/container/WorkspaceContainer';
import * as WorkspaceUtils from 'src/workspaces/utils';

const sideMargin = '3rem';

const miniMessage = (text) => span({ style: { fontWeight: 500, fontSize: '75%', marginRight: '1rem', textTransform: 'uppercase' } }, [text]);

const augmentErrors = ({ invalidInputs, invalidOutputs, missingInputs }) => {
  return {
    inputs: {
      ...invalidInputs,
      ..._.fromPairs(_.map((name) => [name, 'This attribute is required'], missingInputs)),
    },
    outputs: invalidOutputs,
  };
};

const styles = {
  messageContainer: {
    height: '2.25rem',
    display: 'flex',
    alignItems: 'center',
    position: 'absolute',
    bottom: '0.5rem',
    right: sideMargin,
  },
  tabContents: {
    padding: `1rem ${sideMargin}`,
    backgroundColor: colors.dark(0.1),
  },
  cell: (optional) => ({
    fontWeight: !optional && 500,
    fontStyle: optional && 'italic',
  }),
  outputInfoLabel: {
    color: colors.dark(),
  },
  placeholder: {
    fontStyle: 'italic',
  },
  checkBoxSpanMargins: {
    margin: '0 0.5rem 0 1rem',
  },
  checkBoxLeftMargin: {
    marginLeft: '1rem',
  },
};

const ioType = ({ inputType, outputType }) => (inputType || outputType).match(/(.*?)\??$/)[1]; // unify, and strip off trailing '?'

// Trim a config down based on what the `/inputsOutputs` endpoint says
const filterConfigIO = ({ inputs, outputs }) => {
  return _.flow(_.update('inputs', _.pick(_.map('name', inputs))), _.update('outputs', _.pick(_.map('name', outputs))));
};

const WorkflowIOTable = ({
  which,
  inputsOutputs: data,
  config,
  errors,
  onChange,
  onSetDefaults,
  onBrowse,
  suggestions,
  availableSnapshots,
  readOnly,
}) => {
  const [sort, setSort] = useState({ field: 'taskVariable', direction: 'asc' });

  // will only match if the current root entity type comes from a snapshot
  const isSnapshot = _.some({ name: config.dataReferenceName }, availableSnapshots);

  const taskSort = (o) => ioTask(o.name).toLowerCase();
  const varSort = (o) => ioVariable(o.name).toLowerCase();
  const sortedData = _.orderBy(
    sort.field === 'taskVariable' ? ['optional', taskSort, varSort] : ['optional', varSort, taskSort],
    ['asc', sort.direction, sort.direction],
    data
  );

  return h(SimpleFlexTable, {
    'aria-label': `workflow ${which}`,
    rowCount: sortedData.length,
    noContentMessage: `No matching ${which}.`,
    sort,
    readOnly,
    columns: [
      {
        size: { basis: 350, grow: 0 },
        field: 'taskVariable',
        headerRenderer: () => h(Sortable, { sort, field: 'taskVariable', onSort: setSort }, [h(HeaderCell, ['Task name'])]),
        cellRenderer: ({ rowIndex }) => {
          const io = sortedData[rowIndex];
          return h(TextCell, { style: { fontWeight: 500 } }, [ioTask(io.name)]);
        },
      },
      {
        size: { basis: 360, grow: 0 },
        field: 'workflowVariable',
        headerRenderer: () => h(Sortable, { sort, field: 'workflowVariable', onSort: setSort }, [h(HeaderCell, ['Variable'])]),
        cellRenderer: ({ rowIndex }) => {
          const io = sortedData[rowIndex];
          return h(TextCell, { style: styles.cell(io.optional) }, [ioVariable(io.name)]);
        },
      },
      {
        size: { basis: 160, grow: 0 },
        headerRenderer: () => h(HeaderCell, ['Type']),
        cellRenderer: ({ rowIndex }) => {
          const io = sortedData[rowIndex];
          return h(TextCell, { style: styles.cell(io.optional) }, [ioType(io)]);
        },
      },
      {
        headerRenderer: () =>
          h(Fragment, [
            h(HeaderCell, [WorkflowTableColumnNames.INPUT_VALUE]),
            !readOnly &&
              !isSnapshot &&
              which === 'outputs' &&
              h(Fragment, [div({ style: { whiteSpace: 'pre' } }, ['  |  ']), h(Link, { onClick: onSetDefaults }, ['Use defaults'])]),
          ]),
        cellRenderer: ({ rowIndex }) => {
          const io = sortedData[rowIndex];
          const { name, optional, inputType } = io;
          const value = config?.[which]?.[name] || '';
          const error = errors?.[which]?.[name];
          const isFile = inputType === 'File' || inputType === 'File?';
          const formattedValue = JSON.stringify(Utils.maybeParseJSON(value), null, 2);
          return div({ style: { display: 'flex', alignItems: 'center', width: '100%', paddingTop: '0.5rem', paddingBottom: '0.5rem' } }, [
            div({ style: { flex: 1, display: 'flex', position: 'relative', minWidth: 0 } }, [
              !readOnly
                ? h(IdContainer, [
                    (labelId) =>
                      h(Fragment, [
                        h(HiddenLabel, { id: labelId }, [`${ioTask(io.name)} ${ioVariable(io.name)} attribute`]),
                        h(DelayedAutocompleteTextArea, {
                          autosize: true,
                          spellCheck: false,
                          placeholder: which === 'inputs' && !optional ? 'Required' : 'Optional',
                          value,
                          style: isFile ? { paddingRight: '2rem' } : undefined,
                          onChange: (v) => onChange(name, v),
                          suggestions,
                          labelId,
                        }),
                      ]),
                  ])
                : h(TextCell, { style: { flex: 1 } }, [value]),
              !readOnly &&
                isFile &&
                h(
                  Clickable,
                  {
                    style: { position: 'absolute', right: '0.5rem', top: 0, bottom: 0, display: 'flex', alignItems: 'center' },
                    onClick: () => onBrowse(name),
                    tooltip: 'Browse bucket files',
                    'aria-haspopup': 'dialog',
                  },
                  [icon('folder-open', { size: 20 })]
                ),
            ]),
            !readOnly &&
              h(
                Link,
                {
                  style: { marginLeft: '0.25rem' },
                  disabled: formattedValue === undefined || formattedValue === value,
                  onClick: () => onChange(name, formattedValue),
                  tooltip: Utils.cond(
                    [formattedValue === undefined, () => 'Cannot format this value'],
                    [formattedValue === value, () => 'Already formatted'],
                    () => 'Reformat'
                  ),
                  useTooltipAsLabel: true,
                },
                ['{…}']
              ),
            error &&
              h(TooltipTrigger, { content: error }, [
                icon('error-standard', {
                  size: 14,
                  style: { marginLeft: '0.5rem', color: colors.warning(), cursor: 'help' },
                }),
              ]),
          ]);
        },
      },
    ],
  });
};

const BucketContentModal = ({
  workspace: {
    workspace: { googleProject, bucketName },
  },
  onSelect,
  onDismiss,
}) => {
  const [prefix, setPrefix] = useState('');
  const [prefixes, setPrefixes] = useState();
  const [objects, setObjects] = useState(undefined);
  const [loading, setLoading] = useState(false);

  const signal = useCancellation();

  const load = _.flow(
    Utils.withBusyState(setLoading),
    withErrorReporting('Error loading bucket data')
  )(async (newPrefix = prefix) => {
    const { items, prefixes: newPrefixes } = await GoogleStorage(signal).list(googleProject, bucketName, newPrefix);
    setObjects(items);
    setPrefixes(newPrefixes);
    setPrefix(newPrefix);
  });

  useOnMount(() => {
    load();
  });

  useEffect(() => {
    StateHistory.update({ objects, prefix });
  }, [objects, prefix]);

  const prefixParts = _.dropRight(1, prefix.split('/'));
  return h(
    Modal,
    {
      onDismiss,
      title: 'Choose input file',
      showX: true,
      showButtons: false,
    },
    [
      div([
        _.map(
          ({ label, target }) => {
            return h(Fragment, { key: target }, [h(Link, { onClick: () => load(target) }, [label]), ' / ']);
          },
          [
            { label: 'Files', target: '' },
            ..._.map((n) => {
              return { label: prefixParts[n], target: _.map((s) => `${s}/`, _.take(n + 1, prefixParts)).join('') };
            }, _.range(0, prefixParts.length)),
          ]
        ),
      ]),
      div({ style: { margin: '1rem -1rem 1rem -1rem', borderBottom: `1px solid ${colors.light(0.4)}` } }),
      h(SimpleTable, {
        'aria-label': 'file browser',
        columns: [{ header: h(HeaderCell, ['Name']), size: { grow: 1 }, key: 'name' }],
        rows: [
          ..._.map((p) => {
            return {
              name: h(TextCell, [h(Link, { onClick: () => load(p) }, [p.slice(prefix.length)])]),
            };
          }, prefixes),
          ..._.map(({ name }) => {
            return {
              name: h(TextCell, [h(Link, { onClick: () => onSelect(`"gs://${bucketName}/${name}"`) }, [name.slice(prefix.length)])]),
            };
          }, objects),
        ],
      }),
      loading && spinnerOverlay,
    ]
  );
};

const DocumentationCollapse = ({ children }) => {
  const [isOpened, setIsOpened] = useState(false);

  return div(
    {
      style: { display: 'flex', margin: '0.5rem 0' },
      onClick: () => setIsOpened(!isOpened),
    },
    [
      icon(isOpened ? 'angle-down' : 'angle-right', { style: { marginRight: '0.5rem', color: colors.accent() }, size: 21 }),
      isOpened
        ? h(MarkdownViewer, { style: { marginBottom: '1rem' } }, [children])
        : div({ style: { width: '100%', ...Style.noWrapEllipsis } }, [children]),
    ]
  );
};

const isSet = _.endsWith('_set');

const findPossibleSets = (listOfExistingEntities) => {
  return _.reduce(
    (acc, entityType) => {
      return isSet(entityType) || _.includes(`${entityType}_set`, listOfExistingEntities) ? acc : Utils.append(`${entityType}_set`, acc);
    },
    [],
    listOfExistingEntities
  );
};

const getWfOptionsPersistenceId = (namespace, name) => {
  return `${namespace}/${name}/workflow_options`;
};

export const WorkflowView = _.flow(
  wrapWorkspace({
    breadcrumbs: (props) => breadcrumbs.commonPaths.workspaceTab(props, 'workflows'),
    title: _.get('workflowName'),
    activeTab: 'workflows',
  }),
  withCancellationSignal
)(
  class WorkflowView extends Component {
    resetSelectionModel(value, selectedEntities = {}, entityMetadata = this.state.entityMetadata, isSnapshot) {
      const { workflowName } = this.props;
      return {
        type: Utils.cond([isSnapshot, () => processSnapshotTable], [_.has(value, entityMetadata), () => chooseRootType], () => chooseBaseType),
        selectedEntities,
        newSetName: Utils.sanitizeEntityName(`${workflowName}_${new Date().toISOString().slice(0, -5)}`),
      };
    }

    constructor(props) {
      super(props);

      const { namespace, name } = props;

      const workflowOptionsPref = getLocalPref(getWfOptionsPersistenceId(namespace, name));
      const retryWithMoreMemoryPref = workflowOptionsPref?.retryWithMoreMemory;
      const resourceMonitoringPref = workflowOptionsPref?.resourceMonitoring;
      const resourceMonitoringEnabledPref = resourceMonitoringPref?.enabled;

      this.state = {
        activeTab: 'inputs',
        entitySelectionModel: { selectedEntities: {} },
        useCallCache: workflowOptionsPref && 'useCallCache' in workflowOptionsPref ? workflowOptionsPref.useCallCache : true,
        deleteIntermediateOutputFiles: workflowOptionsPref?.deleteIntermediateOutputFiles || false,
        useReferenceDisks: workflowOptionsPref?.useReferenceDisks || false,
        retryWithMoreMemory: retryWithMoreMemoryPref?.enabled || false,
        retryMemoryFactor: retryWithMoreMemoryPref?.enabled ? retryWithMoreMemoryPref?.factor : 1.2,
        ignoreEmptyOutputs: workflowOptionsPref?.ignoreEmptyOutputs || false,
        enableResourceMonitoring: resourceMonitoringEnabledPref || false,
        monitoringScript: resourceMonitoringEnabledPref ? resourceMonitoringPref?.script : '',
        monitoringImage: resourceMonitoringEnabledPref ? resourceMonitoringPref?.image : '',
        monitoringImageScript: resourceMonitoringEnabledPref ? resourceMonitoringPref?.imageScript : '',
        perWorkflowCostCap: workflowOptionsPref?.perWorkflowCostCap || '',
        includeOptionalInputs: true,
        filter: '',
        errors: { inputs: {}, outputs: {} },
        ...StateHistory.get(),
      };
    }

    isSingle() {
      return !this.isMultiple();
    }

    isMultiple() {
      return !this.state.processSingle;
    }

    selectSingle() {
      const { modifiedConfig } = this.state;
      this.setState({
        processSingle: true,
        modifiedConfig: _.omit('rootEntityType', modifiedConfig),
      });
    }

    selectMultiple() {
      const { modifiedConfig, selectedEntityType } = this.state;
      this.setState({
        processSingle: false,
        modifiedConfig: { ...modifiedConfig, rootEntityType: selectedEntityType },
      });
    }

    updateSingleOrMultipleRadioState(config) {
      this.setState({
        processSingle: !config.rootEntityType,
        selectedEntityType: config.dataReferenceName || config.rootEntityType,
      });
    }

    /** Returns the href link for the specified article. */
    getSupportLink(article) {
      return `https://support.terra.bio/hc/en-us/articles/${article}`;
    }

    render() {
      // isFreshData: controls spinnerOverlay on initial load
      // variableSelected: field of focus for bucket file browser
      // savedConfig: unmodified copy of config for checking for unsaved edits
      // modifiedConfig: active data, potentially unsaved
      const {
        isFreshData,
        savedConfig,
        launching,
        activeTab,
        useCallCache,
        deleteIntermediateOutputFiles,
        useReferenceDisks,
        retryWithMoreMemory,
        retryMemoryFactor,
        ignoreEmptyOutputs,
        enableResourceMonitoring,
        monitoringScript,
        monitoringImage,
        monitoringImageScript,
        entitySelectionModel,
        variableSelected,
        modifiedConfig,
        updatingConfig,
        selectedSnapshotEntityMetadata,
        availableSnapshots,
        perWorkflowCostCap,
      } = this.state;
      const { namespace, name, workspace } = this.props;
      const workspaceId = { namespace, name };

      return h(Fragment, [
        savedConfig &&
          h(Fragment, [
            this.renderSummary(),
            Utils.switchCase(
              activeTab,
              ['wdl', () => this.renderWDL()],
              ['inputs', () => this.renderIOTable('inputs')],
              ['outputs', () => this.renderIOTable('outputs')]
            ),
            launching &&
              h(LaunchAnalysisModal, {
                workspace,
                config: savedConfig,
                entityMetadata: selectedSnapshotEntityMetadata,
                accessLevel: workspace.accessLevel,
                bucketName: workspace.workspace.bucketName,
                processSingle: this.isSingle(),
                entitySelectionModel,
                useCallCache,
                deleteIntermediateOutputFiles,
                useReferenceDisks,
                retryWithMoreMemory,
                retryMemoryFactor,
                ignoreEmptyOutputs,
                enableResourceMonitoring,
                monitoringScript,
                monitoringImage,
                monitoringImageScript,
                perWorkflowCostCap,
                onDismiss: () => this.setState({ launching: false }),
                onSuccess: (submissionId) => {
                  const {
                    methodRepoMethod: { methodVersion, methodNamespace, methodName, methodPath, sourceRepo },
                  } = modifiedConfig;
                  // will only match if the current root entity type comes from a snapshot
                  const snapshot = _.find({ metadata: { name: modifiedConfig.dataReferenceName } }, availableSnapshots);
                  void Metrics().captureEvent(Events.workflowLaunch, {
                    ...extractWorkspaceDetails(workspace),
                    snapshotId: snapshot?.reference.snapshot,
                    referenceId: snapshot?.referenceId,
                    methodVersion,
                    sourceRepo,
                    methodPath: sourceRepo === 'agora' ? `${methodNamespace}/${methodName}` : methodPath,
                  });
                  // TODO should this be done here or when the workflows are actually launched?
                  // What info needs to be included?
                  if (perWorkflowCostCap !== '') {
                    void Metrics().captureEvent(Events.workflowSetCostCap, {
                      ...extractWorkspaceDetails(workspace),
                      snapshotId: snapshot?.reference.snapshot,
                      referenceId: snapshot?.referenceId,
                      methodVersion,
                      sourceRepo,
                      methodPath: sourceRepo === 'agora' ? `${methodNamespace}/${methodName}` : methodPath,
                    });
                  }
                  Nav.goToPath('workspace-submission-details', { submissionId, ...workspaceId });
                },
              }),
            variableSelected &&
              h(BucketContentModal, {
                workspace,
                onDismiss: () => this.setState({ variableSelected: undefined }),
                onSelect: (v) => {
                  this.setState({ modifiedConfig: _.set(['inputs', variableSelected], v, modifiedConfig), variableSelected: undefined });
                },
              }),
          ]),
        (!isFreshData || updatingConfig) && spinnerOverlay,
      ]);
    }

    async getValidation() {
      const { namespace, name, workflowNamespace, workflowName, signal } = this.props;

      this.setState({ snapshotReferenceError: undefined });
      try {
        return await Workspaces(signal).workspace(namespace, name).methodConfig(workflowNamespace, workflowName).validate();
      } catch (e) {
        if (e.status === 404) {
          const errmsg = await e.text();
          // distinguish between snapshot-reference-not-found and workflow-not-found
          if (errmsg?.includes('Reference name') && errmsg?.includes('does not exist in workspace')) {
            this.setState(_.set(['snapshotReferenceError', errmsg]));
            return true;
          }
          return false;
        }
        throw e;
      }
    }

    async maybeGetSnapshotEntityMetadata(googleProject, modifiedConfig) {
      const { namespace, name, signal } = this.props;

      try {
        return await Workspaces(signal).workspace(namespace, name).snapshotEntityMetadata(googleProject, modifiedConfig.dataReferenceName);
      } catch (error) {
        return undefined;
      }
    }

    async componentDidMount() {
      const {
        namespace,
        name,
        workflowNamespace,
        workflowName,
        workspace: {
          workspace: { attributes, googleProject },
        },
        signal,
        queryParams: { selectionKey },
      } = this.props;

      try {
        const ws = Workspaces(signal).workspace(namespace, name);

        const [entityMetadata, validationResponse, config] = await Promise.all([
          ws.entityMetadata(),
          this.getValidation(),
          ws.methodConfig(workflowNamespace, workflowName).get(),
        ]);
        const {
          methodRepoMethod: { methodNamespace, methodName, sourceRepo, methodPath },
        } = config;
        const isRedacted = !validationResponse;

        const inputsOutputs = isRedacted ? {} : await Methods(signal).configInputsOutputs(config);
        const selection = workflowSelectionStore.get();
        const readSelection = selectionKey && selection.key === selectionKey;

        const { gcpDataRepoSnapshots: snapshots } = await Workspaces(signal).workspace(namespace, name).listSnapshots(1000, 0);
        const snapshotMetadata = _.map('metadata', snapshots);

        // Dockstore users who target floating tags can change their WDL via Github without explicitly selecting a new version in Terra.
        // Before letting the user edit the config we retrieved from the DB, drop any keys that are no longer valid. [WA-291]
        // N.B. this causes `config` and `modifiedConfig` to be unequal, so we (accurately) prompt the user to save before launching
        // DO NOT filter when a config is redacted, when there's no IO from the WDL we would erase the user's inputs
        const modifiedConfig = _.flow(
          readSelection ? _.set('rootEntityType', selection.entityType) : _.identity,
          !isRedacted ? filterConfigIO(inputsOutputs) : _.identity
        )(config);

        const selectedSnapshotEntityMetadata = modifiedConfig.dataReferenceName
          ? await this.maybeGetSnapshotEntityMetadata(googleProject, modifiedConfig)
          : undefined;

        this.setState({
          savedConfig: config,
          modifiedConfig,
          currentSnapRedacted: isRedacted,
          savedSnapRedacted: isRedacted,
          entityMetadata,
          availableSnapshots: _.sortBy(_.lowerCase, snapshotMetadata),
          selectedSnapshotEntityMetadata,
          savedInputsOutputs: inputsOutputs,
          modifiedInputsOutputs: inputsOutputs,
          errors: isRedacted ? { inputs: {}, outputs: {} } : augmentErrors(validationResponse),
          entitySelectionModel: this.resetSelectionModel(
            modifiedConfig.dataReferenceName || modifiedConfig.rootEntityType,
            readSelection ? selection.entities : {},
            entityMetadata,
            !!modifiedConfig.dataReferenceName
          ),
          workspaceAttributes: _.flow(
            _.without(['description']), // workspace description
            _.remove((s) => s.includes(':')), // library, tags
            _.remove((s) => s.startsWith('__DESCRIPTION__')) // workspace data variable descriptions
          )(_.keys(attributes)),
        });

        if (sourceRepo === 'agora') {
          const methods = await Methods(signal).list({ namespace: methodNamespace, name: methodName });
          const snapshotIds = _.map('snapshotId', methods);

          this.setState({ versionIds: snapshotIds });
        } else if (sourceRepo === 'dockstore' || sourceRepo === 'dockstoretools') {
          const versions = await Dockstore(signal).getVersions({ path: methodPath, isTool: sourceRepo === 'dockstoretools' });
          const versionIds = _.map('name', versions);

          this.setState({ versionIds });
        } else {
          throw new Error('unknown sourceRepo');
        }

        this.updateSingleOrMultipleRadioState(modifiedConfig);
        this.fetchInfo(config, isRedacted);
      } catch (error) {
        reportError('Error loading data', error);
      } finally {
        this.setState({ isFreshData: true });
      }
    }

    getUpdatedWorkflowOptionsPref() {
      const {
        useCallCache,
        useReferenceDisks,
        ignoreEmptyOutputs,
        deleteIntermediateOutputFiles,
        retryWithMoreMemory,
        retryMemoryFactor,
        enableResourceMonitoring,
        monitoringScript,
        monitoringImage,
        monitoringImageScript,
      } = this.state;

      const updatedWfOptionsPref = {};

      // call caching by default is checked hence persist it only if it is unchecked
      if (!useCallCache) updatedWfOptionsPref.useCallCache = useCallCache;

      // below workflow options are unchecked by default hence persist them if they are checked
      if (useReferenceDisks) updatedWfOptionsPref.useReferenceDisks = useReferenceDisks;
      if (ignoreEmptyOutputs) updatedWfOptionsPref.ignoreEmptyOutputs = ignoreEmptyOutputs;
      if (deleteIntermediateOutputFiles) updatedWfOptionsPref.deleteIntermediateOutputFiles = deleteIntermediateOutputFiles;
      if (retryWithMoreMemory)
        updatedWfOptionsPref.retryWithMoreMemory = {
          enabled: retryWithMoreMemory,
          factor: retryMemoryFactor,
        };
      if (enableResourceMonitoring)
        updatedWfOptionsPref.resourceMonitoring = {
          enabled: enableResourceMonitoring,
          script: monitoringScript,
          image: monitoringImage,
          imageScript: monitoringImageScript,
        };

      return updatedWfOptionsPref;
    }

    componentDidUpdate() {
      StateHistory.update(
        _.pick(
          [
            'savedConfig',
            'modifiedConfig',
            'entityMetadata',
            'savedInputsOutputs',
            'modifiedInputsOutputs',
            'invalid',
            'activeTab',
            'wdl',
            'currentSnapRedacted',
            'savedSnapRedacted',
          ],
          this.state
        )
      );

      const { namespace, name } = this.props;
      const updatedWfOptionsPref = this.getUpdatedWorkflowOptionsPref();

      // note: setting the key to 'undefined' will remove it from local storage. See method implementation for more details.
      if (_.isEmpty(updatedWfOptionsPref)) setLocalPref(getWfOptionsPersistenceId(namespace, name), undefined);
      else setLocalPref(getWfOptionsPersistenceId(namespace, name), updatedWfOptionsPref);
    }

    async fetchInfo(savedConfig, currentSnapRedacted) {
      const {
        methodRepoMethod: { sourceRepo, methodNamespace, methodName, methodVersion, methodPath },
      } = savedConfig;
      const { signal } = this.props;
      try {
        if (sourceRepo === 'agora') {
          if (!currentSnapRedacted) {
            const { synopsis, documentation, payload } = await Methods(signal).method(methodNamespace, methodName, methodVersion).get();
            this.setState({ synopsis, documentation, wdl: payload });
          }
        } else if (sourceRepo === 'dockstore' || sourceRepo === 'dockstoretools') {
          const wdl = await Dockstore(signal).getWdl({ path: methodPath, version: methodVersion, isTool: sourceRepo === 'dockstoretools' });
          this.setState({ wdl });
        } else {
          throw new Error('unknown sourceRepo');
        }
      } catch (error) {
        reportError('Error loading WDL', error);
      }
    }

    describeSelectionModel() {
      const {
        modifiedConfig: { rootEntityType },
        entitySelectionModel: { newSetName, selectedEntities, type },
      } = this.state;
      const count = _.size(selectedEntities);
      const newSetMessage = (t) => `(will create a new ${t} named "${newSetName}")`;
      const baseEntityType = isSet(rootEntityType) ? rootEntityType.slice(0, -4) : rootEntityType;
      const setType = `${rootEntityType}_set`;
      const pluralS = count > 1 ? 's' : '';
      return Utils.cond(
        [this.isSingle() || !rootEntityType, () => ''],
        [!count, () => 'No data selected'],
        [type === chooseSetType, () => `${rootEntityType}s from ${count} ${setType}${pluralS} ${count > 1 ? newSetMessage(setType) : ''}`],
        [type === chooseBaseType, () => `1 ${rootEntityType} containing ${count} ${baseEntityType}${pluralS} ${newSetMessage(rootEntityType)}`],
        [type === chooseRootType, () => `${count} selected ${rootEntityType}${pluralS} ${count > 1 ? newSetMessage(setType) : ''}`],
        [type === processSnapshotTable, () => 'process entire snapshot table']
      );
    }

    canSave() {
      const {
        modifiedConfig: { rootEntityType },
      } = this.state;
      return this.isSingle() || !!rootEntityType;
    }

    loadNewMethodConfig = _.flow(
      withErrorReporting('Error updating config'),
      Utils.withBusyState((v) => this.setState({ updatingConfig: v }))
    )(async (newSnapshotId) => {
      const { signal } = this.props;
      const {
        modifiedConfig: {
          methodRepoMethod: { methodNamespace, methodName, methodPath, sourceRepo },
        },
        currentSnapRedacted,
      } = this.state;
      const config = await Methods(signal).template({ methodNamespace, methodName, methodPath, sourceRepo, methodVersion: newSnapshotId });
      const modifiedInputsOutputs = await Methods(signal).configInputsOutputs(config);
      this.setState({ modifiedInputsOutputs, savedSnapRedacted: currentSnapRedacted, currentSnapRedacted: false });
      this.setState(_.update('modifiedConfig', _.flow(_.set('methodRepoMethod', config.methodRepoMethod), filterConfigIO(modifiedInputsOutputs))));
      this.fetchInfo(config);
    });

    renderSummary() {
      const {
        signal,
        workspace: ws,
        workspace: { workspace },
        namespace,
        name: workspaceName,
      } = this.props;
      const {
        modifiedConfig,
        savedConfig,
        saving,
        saved,
        exporting,
        copying,
        deleting,
        selectingData,
        activeTab,
        errors,
        synopsis,
        documentation,
        availableSnapshots,
        selectedSnapshotEntityMetadata,
        selectedEntityType,
        entityMetadata,
        entitySelectionModel,
        versionIds = [],
        useCallCache,
        deleteIntermediateOutputFiles,
        useReferenceDisks,
        retryWithMoreMemory,
        retryMemoryFactor,
        ignoreEmptyOutputs,
        enableResourceMonitoring,
        monitoringScript,
        monitoringImage,
        monitoringImageScript,
        currentSnapRedacted,
        savedSnapRedacted,
        wdl,
        snapshotReferenceError,
      } = this.state;
      const {
        name,
        methodRepoMethod: { methodPath, methodVersion, methodNamespace, methodName, sourceRepo },
        rootEntityType,
      } = modifiedConfig;
      const entityTypes = _.keys(entityMetadata);
      const possibleSetTypes = findPossibleSets(entityTypes);
      const modified = !_.isEqual(modifiedConfig, savedConfig);
      const noLaunchReason = Utils.cond(
        [saving || modified, () => 'Save or cancel to Launch Analysis'],
        [
          entitySelectionModel.type === processSnapshotTable && (!rootEntityType || !modifiedConfig.dataReferenceName),
          () => 'A snapshot and table must be selected',
        ],
        [!_.isEmpty(errors.inputs) || !_.isEmpty(errors.outputs), () => 'At least one required attribute is missing or invalid'],
        [
          entitySelectionModel.type !== processSnapshotTable &&
            this.isMultiple() &&
            !entityMetadata[rootEntityType] &&
            !_.includes(rootEntityType, possibleSetTypes),
          () => `There are no ${selectedEntityType}s in this workspace.`,
        ],
        [
          entitySelectionModel.type !== processSnapshotTable && this.isMultiple() && !_.size(entitySelectionModel.selectedEntities),
          () => 'Select data for analysis',
        ]
      );

      const inputsValid = _.isEmpty(errors.inputs);
      const outputsValid = _.isEmpty(errors.outputs);
      const sourceDisplay = sourceRepo === 'agora' ? `${methodNamespace}/${methodName}/${methodVersion}` : `${methodPath}:${methodVersion}`;
      const clickToLearnMore = 'Click here to learn more.';
      return div(
        {
          style: {
            position: 'relative',
            backgroundColor: 'white',
            borderBottom: `2px solid ${terraSpecial()}`,
            boxShadow: '0 2px 5px 0 rgba(0,0,0,0.26), 0 2px 10px 0 rgba(0,0,0,0.16)',
          },
        },
        [
          div({ style: { display: 'flex', padding: `0.5rem ${sideMargin} 0`, minHeight: 120 } }, [
            div({ style: { flex: '1', lineHeight: '1.5rem', minWidth: 0 } }, [
              h(
                Link,
                {
                  href: Nav.getLink('workspace-workflows', { namespace, name: workspaceName }),
                  style: { display: 'inline-flex', alignItems: 'center', padding: '0.5rem 0' },
                },
                [icon('arrowLeft', { style: { marginRight: '0.5rem' } }), 'Back to list']
              ),
              div({ style: { display: 'flex' } }, [
                span({ style: { marginLeft: '-2rem', width: '2rem' } }, [
                  h(
                    MenuTrigger,
                    {
                      closeOnClick: true,
                      content: h(Fragment, [
                        h(
                          MenuButton,
                          {
                            onClick: () => this.setState({ exporting: true }),
                          },
                          [makeMenuIcon('export'), 'Copy to Another Workspace']
                        ),
                        h(
                          MenuButton,
                          {
                            onClick: () => this.setState({ copying: true }),
                          },
                          [makeMenuIcon('copy'), 'Duplicate']
                        ),
                        h(
                          MenuButton,
                          {
                            ...WorkspaceUtils.getWorkspaceEditControlProps(ws),
                            tooltipSide: 'right',
                            onClick: () => this.setState({ deleting: true }),
                          },
                          [makeMenuIcon('trash'), 'Delete']
                        ),
                      ]),
                    },
                    [h(Link, { 'aria-label': 'Workflow menu' }, [icon('cardMenuIcon', { size: 22 })])]
                  ),
                ]),
                span({ style: { color: colors.dark(), fontSize: 24 } }, name),
              ]),
              currentSnapRedacted &&
                div({ style: { color: colors.warning(), fontSize: 16, fontWeight: 500, marginTop: '0.5rem' } }, [
                  'You do not have access to this workflow, or this snapshot has been deleted. To use this workflow, contact the owner to request access, or select another snapshot.',
                ]),
              h(IdContainer, [
                (id) =>
                  div({ style: { marginTop: '0.5rem' } }, [
                    label({ htmlFor: id }, [`${sourceRepo === 'agora' ? 'Snapshot' : 'Version'}: `]),
                    div({ style: { display: 'inline-block', marginLeft: '0.25rem', width: sourceRepo === 'agora' ? 75 : 200 } }, [
                      h(Select, {
                        id,
                        isDisabled: !WorkspaceUtils.canEditWorkspace(ws).value,
                        isClearable: false,
                        isSearchable: false,
                        value: methodVersion,
                        options: _.sortBy(
                          sourceRepo === 'agora' ? _.toNumber : _.identity,
                          _.uniq([...versionIds, savedConfig.methodRepoMethod.methodVersion])
                        ),
                        isOptionDisabled: ({ value }) =>
                          (currentSnapRedacted || savedSnapRedacted) && value === savedConfig.methodRepoMethod.methodVersion,
                        onChange: (chosenSnapshot) => this.loadNewMethodConfig(chosenSnapshot.value),
                      }),
                    ]),
                  ]),
              ]),
              div([
                'Source: ',
                currentSnapRedacted
                  ? sourceDisplay
                  : h(
                      Link,
                      {
                        href: methodLink(modifiedConfig),
                        ...(isFeaturePreviewEnabled(FIRECLOUD_UI_MIGRATION) ? {} : Utils.newTabLinkProps),
                      },
                      [sourceDisplay]
                    ),
              ]),
              div(`Synopsis: ${synopsis || ''}`),
              documentation
                ? h(DocumentationCollapse, [documentation])
                : div({ style: { fontStyle: 'italic', ...styles.description } }, ['No documentation provided']),
              div({ role: 'radiogroup', 'aria-label': 'Select number of target entities', style: { marginBottom: '1rem' } }, [
                div([
                  h(RadioButton, {
                    disabled: !WorkspaceUtils.canEditWorkspace(ws).value || currentSnapRedacted,
                    text: 'Run workflow with inputs defined by file paths',
                    name: 'process-workflows',
                    checked: this.isSingle(),
                    onChange: () => this.selectSingle(),
                    labelStyle: { marginLeft: '0.5rem' },
                  }),
                ]),
                div([
                  h(RadioButton, {
                    disabled: !WorkspaceUtils.canEditWorkspace(ws).value || currentSnapRedacted,
                    text: 'Run workflow(s) with inputs defined by data table',
                    name: 'process-workflows',
                    checked: this.isMultiple(),
                    onChange: () => this.selectMultiple(),
                    labelStyle: { marginLeft: '0.5rem' },
                  }),
                ]),
                this.isMultiple() &&
                  div({ style: { display: 'flex', margin: '0.5rem 0 0 2rem' } }, [
                    div([
                      div({ style: { height: '2rem', fontWeight: 'bold' } }, ['Step 1']),
                      label(['Select data table:']),
                      snapshotReferenceError &&
                        h(
                          TooltipTrigger,
                          { content: `The requested snapshot reference '${modifiedConfig.dataReferenceName}' could not be found in this workspace.` },
                          [
                            icon('error-standard', {
                              size: 14,
                              style: { marginLeft: '0.5rem', color: colors.warning(), cursor: 'help' },
                            }),
                          ]
                        ),
                      h(GroupedSelect, {
                        'aria-label': 'Entity type selector',
                        isClearable: false,
                        isDisabled: currentSnapRedacted || this.isSingle() || !WorkspaceUtils.canEditWorkspace(ws).value,
                        isSearchable: true,
                        placeholder: 'Select data type...',
                        styles: { container: (old) => ({ ...old, display: 'inline-block', width: 200, marginLeft: '0.5rem' }) },
                        value: selectedEntityType,
                        onChange: async ({ value, source }) => {
                          this.setState({ snapshotReferenceError: undefined });
                          if (source === 'snapshot') {
                            const selectedSnapshotEntityMetadata = await Workspaces(signal)
                              .workspace(namespace, workspaceName)
                              .snapshotEntityMetadata(workspace.googleProject, value);

                            this.setState(_.set(['modifiedConfig', 'dataReferenceName'], value));
                            this.setState(_.unset(['modifiedConfig', 'rootEntityType']));

                            this.setState({
                              selectedSnapshotEntityMetadata,
                              selectedEntityType: value,
                              entitySelectionModel: this.resetSelectionModel(value, undefined, undefined, true),
                            });
                          } else {
                            this.setState(_.set(['modifiedConfig', 'rootEntityType'], value));
                            this.setState(_.unset(['modifiedConfig', 'dataReferenceName']));
                            this.setState({
                              selectedEntityType: value,
                              entitySelectionModel: this.resetSelectionModel(value, {}, entityMetadata, false),
                              selectedSnapshotEntityMetadata: undefined,
                            });
                          }
                        },
                        options: [
                          {
                            label: 'TABLES',
                            options: _.map(
                              (entityType) => ({ value: entityType, source: 'table' }),
                              _.sortBy(_.lowerCase, [...entityTypes, ...possibleSetTypes])
                            ),
                          },
                          {
                            label: 'SNAPSHOTS',
                            options: _.map(({ name }) => ({ value: name, source: 'snapshot' }), availableSnapshots),
                          },
                        ],
                      }),
                    ]),
                    entitySelectionModel.type === processSnapshotTable
                      ? div({ style: { margin: '2rem 0 0 2rem' } }, [
                          h(Select, {
                            isDisabled: !WorkspaceUtils.canEditWorkspace(ws).value || !!snapshotReferenceError,
                            'aria-label': 'Snapshot table selector',
                            isClearable: false,
                            value: modifiedConfig.dataReferenceName && !snapshotReferenceError ? modifiedConfig.rootEntityType : undefined,
                            onChange: ({ value }) => {
                              this.setState(_.set(['modifiedConfig', 'rootEntityType'], value));
                              this.setState(_.unset(['modifiedConfig', 'entityName']));
                            },
                            styles: { container: (old) => ({ ...old, display: 'inline-block', width: 200, marginLeft: '0.5rem' }) },
                            options: _.sortBy(_.identity, _.keys(selectedSnapshotEntityMetadata)),
                          }),
                        ])
                      : div({ style: { marginLeft: '2rem', paddingLeft: '2rem', borderLeft: `2px solid ${colors.dark(0.2)}`, flex: 1 } }, [
                          div({ style: { height: '2rem', fontWeight: 'bold' } }, ['Step 2']),
                          div({ style: { display: 'flex', alignItems: 'center' } }, [
                            h(
                              ButtonPrimary,
                              {
                                disabled:
                                  currentSnapRedacted ||
                                  this.isSingle() ||
                                  !rootEntityType ||
                                  !_.includes(selectedEntityType, [...entityTypes, ...possibleSetTypes]),
                                onClick: () => this.setState({ selectingData: true }),
                                ...WorkspaceUtils.getWorkspaceEditControlProps(ws),
                              },
                              ['Select Data']
                            ),
                            label({ style: { marginLeft: '1rem' } }, [`${this.describeSelectionModel()}`]),
                          ]),
                        ]),
                  ]),
              ]),
              div({ style: { display: 'flex', alignItems: 'baseline', minWidth: 'max-content' } }, [
                span({ style: { marginTop: '1.0rem', marginBottom: '0.5rem' } }, [
                  div([
                    span({ style: { ...styles.checkBoxSpanMargins, marginLeft: 0 } }, [
                      h(
                        LabeledCheckbox,
                        {
                          disabled: currentSnapRedacted || !WorkspaceUtils.canRunAnalysisInWorkspace(ws).value,
                          checked: useCallCache,
                          onChange: (v) => this.setState({ useCallCache: v }),
                        },
                        [' Use call caching']
                      ),
                    ]),
                    h(InfoBox, [
                      "Call caching detects when a job has been run in the past so that it doesn't have to re-compute results. ",
                      h(Link, { href: this.getSupportLink('360047664872'), ...Utils.newTabLinkProps }, [clickToLearnMore]),
                    ]),
                  ]),
                  div([
                    span({ style: { ...styles.checkBoxSpanMargins, marginLeft: 0 } }, [
                      h(
                        LabeledCheckbox,
                        {
                          checked: deleteIntermediateOutputFiles,
                          onChange: (v) => this.setState({ deleteIntermediateOutputFiles: v }),
                        },
                        [' Delete intermediate outputs']
                      ),
                    ]),
                    h(InfoBox, [
                      'If the workflow succeeds, only the final output will be saved. Subsequently, call caching cannot be used as the intermediate steps will be not available. ',
                      h(Link, { href: this.getSupportLink('360039681632'), ...Utils.newTabLinkProps }, [clickToLearnMore]),
                    ]),
                  ]),
                ]),
                span({ style: { marginTop: '0.5rem', marginBottom: '0.5rem' } }, [
                  div([
                    span({ style: styles.checkBoxSpanMargins }, [
                      h(
                        LabeledCheckbox,
                        {
                          checked: useReferenceDisks,
                          onChange: (v) => this.setState({ useReferenceDisks: v }),
                          style: styles.checkBoxLeftMargin,
                        },
                        [' Use reference disks']
                      ),
                    ]),
                    h(InfoBox, [
                      'Use a reference disk image if available rather than localizing reference inputs. ',
                      h(Link, { href: this.getSupportLink('360056384631'), ...Utils.newTabLinkProps }, [clickToLearnMore]),
                    ]),
                  ]),
                  div([
                    span({ style: styles.checkBoxSpanMargins }, [
                      h(
                        LabeledCheckbox,
                        {
                          checked: retryWithMoreMemory,
                          onChange: (v) => this.setState({ retryWithMoreMemory: v }),
                          style: styles.checkBoxLeftMargin,
                        },
                        [' Retry with more memory']
                      ),
                    ]),
                    // We show either an info message or a warning, based on whether increasing memory on retries is
                    // enabled and the value of the retry multiplier.
                    retryWithMoreMemory && retryMemoryFactor > 2
                      ? h(InfoBox, { style: { color: colors.warning() }, icon: 'warning-standard' }, [
                          'Retry factors above 2 are not recommended. The retry factor compounds and may substantially increase costs. ',
                          h(Link, { href: this.getSupportLink('4403215299355'), ...Utils.newTabLinkProps }, [clickToLearnMore]),
                        ])
                      : h(InfoBox, [
                          'If a task has a maxRetries value greater than zero and fails because it ran out of memory, retry it with more memory. ',
                          h(Link, { href: this.getSupportLink('4403215299355'), ...Utils.newTabLinkProps }, [clickToLearnMore]),
                        ]),
                  ]),
                  div([
                    retryWithMoreMemory &&
                      span({ style: { margin: '0 0.5rem 0 0.5rem' } }, [
                        h(IdContainer, [
                          (id) =>
                            h(Fragment, [
                              label(
                                {
                                  htmlFor: id,
                                  style: { ...styles.label, verticalAlign: 'middle', marginLeft: '1.5rem' },
                                },
                                ['Memory factor:']
                              ),
                              div({ style: { display: 'inline-block', marginLeft: '0.5rem', height: '1.75rem', marginTop: '0.5rem' } }, [
                                h(NumberInput, {
                                  id,
                                  min: 1.1,
                                  max: 10,
                                  step: 0.1,
                                  isClearable: false,
                                  onlyInteger: false,
                                  value: retryMemoryFactor,
                                  style: { width: '5rem' },
                                  onChange: (v) => this.setState({ retryMemoryFactor: v }),
                                }),
                              ]),
                            ]),
                        ]),
                      ]),
                  ]),
                ]),
                span({ style: { marginTop: '0.5rem', marginBottom: '0.5rem' } }, [
                  div([
                    span({ style: styles.checkBoxSpanMargins }, [
                      h(
                        LabeledCheckbox,
                        {
                          checked: ignoreEmptyOutputs,
                          onChange: (v) => this.setState({ ignoreEmptyOutputs: v }),
                          style: styles.checkBoxLeftMargin,
                        },
                        [' Ignore empty outputs']
                      ),
                    ]),
                    h(InfoBox, ['Do not create output columns if the data is null/empty. ']),
                  ]),
                  div([
                    span({ style: styles.checkBoxSpanMargins }, [
                      h(
                        LabeledCheckbox,
                        {
                          checked: enableResourceMonitoring,
                          onChange: (v) => this.setState({ enableResourceMonitoring: v }),
                          style: styles.checkBoxLeftMargin,
                        },
                        [' Resource monitoring']
                      ),
                    ]),
                    h(InfoBox, [
                      'Specify user-provided tools to monitor task resources. ',
                      h(Link, { href: this.getSupportLink('27341964316699'), ...Utils.newTabLinkProps }, [clickToLearnMore]),
                    ]),
                    enableResourceMonitoring &&
                      div({ style: { display: 'flex', flexDirection: 'column', marginLeft: '2.0rem', width: '20rem', key: 'textFieldsParent' } }, [
                        div({ style: { display: 'flex', flexDirection: 'row', alignItems: 'center' } }, [
                          h(TextInput, {
                            id: 'resource-monitoring-script',
                            placeholder: 'Script',
                            value: monitoringScript,
                            onChange: (v) => this.setState({ monitoringScript: v }),
                            style: { marginTop: '0.5rem', width: '90%', marginRight: '0.5rem' },
                          }),
                          h(InfoBox, ['Standalone .sh script that runs inside task container']),
                        ]),
                        div({ style: { display: 'flex', flexDirection: 'row', alignItems: 'center' } }, [
                          h(TextInput, {
                            id: 'resource-monitoring-image',
                            placeholder: 'Image',
                            value: monitoringImage,
                            onChange: (v) => this.setState({ monitoringImage: v }),
                            style: { marginTop: '0.5rem', width: '90%', marginRight: '0.5rem' },
                          }),
                          h(InfoBox, ['Image that runs as a sibling alongside task container']),
                        ]),
                        div({ style: { display: 'flex', flexDirection: 'row', alignItems: 'center' } }, [
                          h(TextInput, {
                            id: 'resource-monitoring-image-script',
                            placeholder: 'Image script',
                            value: monitoringImageScript,
                            onChange: (v) => this.setState({ monitoringImageScript: v }),
                            style: { marginTop: '0.5rem', width: '90%', marginRight: '0.5rem' },
                          }),
                          h(InfoBox, ['Script that runs inside the sibling container']),
                        ]),
                      ]),
                  ]),
                ]),
                isFeaturePreviewEnabled(PREVIEW_COST_CAPPING) &&
                  div({ style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginTop: '1rem', marginLeft: '1rem' } }, [
                    span({ style: { ...styles.checkBoxSpanMargins, fontWeight: 'bold' } }, [
                      'Set workflow run budget ',
                      h(InfoBox, ['Set workflow run budget tooltip. ']),
                    ]),
                    div({ style: { display: 'flex', alignItems: 'center', marginLeft: '0.5rem' } }, [
                      span({ style: { marginRight: '0.5rem' } }, ['$']),
                      h(TextInput, {
                        id: 'workflow-run-budget',
                        placeholder: 'Example: 1.00',
                        onChange: (v) => this.setState({ perWorkflowCostCap: v }),
                        style: { marginTop: '0.5rem', width: '70%', marginRight: '0.5rem' },
                      }),
                    ]),
                    span({ style: { ...styles.checkBoxSpanMargins, fontSize: '0.75rem' } }, [[' We recommend adding 20% room for variability']]),
                  ]),
              ]),
              h(StepButtons, {
                tabs: [
                  ...(!currentSnapRedacted ? [{ key: 'wdl', title: 'Script', isValid: true }] : []),
                  { key: 'inputs', title: 'Inputs', isValid: inputsValid },
                  { key: 'outputs', title: 'Outputs', isValid: outputsValid },
                ],
                activeTab,
                onChangeTab: (v) => this.setState({ activeTab: v, filter: '' }),
                finalStep: h(
                  ButtonPrimary,
                  {
                    style: { marginLeft: '1rem' },
                    disabled: !!noLaunchReason || currentSnapRedacted || !!snapshotReferenceError,
                    tooltip: noLaunchReason || (currentSnapRedacted && 'Workflow version was deleted.'),
                    ...WorkspaceUtils.getWorkspaceAnalysisControlProps(ws),
                    onClick: () => this.setState({ launching: true }),
                  },
                  ['Run analysis']
                ),
              }),
              activeTab === 'outputs' &&
                !currentSnapRedacted &&
                div({ style: { marginBottom: '1rem' } }, [
                  div({ style: styles.outputInfoLabel }, 'Output files will be saved to'),
                  div({ style: { display: 'flex', alignItems: 'center' } }, [
                    div({ style: { flex: 'none', display: 'flex', width: '1.5rem' } }, [icon('folder', { size: 18 })]),
                    div({ style: { flex: 1 } }, [
                      'Files / ',
                      span({ style: styles.placeholder }, 'submission unique ID'),
                      ' / ',
                      wdl ? wdl.match(/^\s*workflow ([^\s{]+)\s*{/m)[1] : span({ style: styles.placeholder }, 'workflow name'),
                      ' / ',
                      span({ style: styles.placeholder }, 'workflow unique ID'),
                    ]),
                  ]),
                  !!rootEntityType &&
                    entitySelectionModel.type !== processSnapshotTable &&
                    h(Fragment, [
                      div({ style: { margin: '0.5rem 0', borderBottom: `1px solid ${colors.dark(0.55)}` } }),
                      div({ style: styles.outputInfoLabel }, 'References to outputs will be written to'),
                      div({ style: { display: 'flex', alignItems: 'center' } }, [
                        div({ style: { flex: 'none', display: 'flex', width: '1.5rem' } }, [icon('listAlt')]),
                        `Tables / ${rootEntityType}`,
                      ]),
                      'Fill in the attributes below to add or update columns in your data table',
                    ]),
                ]),
            ]),
          ]),
          div({ style: styles.messageContainer }, [
            saving && miniMessage('Saving...'),
            saved && !saving && !modified && miniMessage('Saved!'),
            modified && h(ButtonSecondary, { style: { marginRight: '1rem' }, disabled: saving, onClick: () => this.cancel() }, 'Cancel'),
            modified && h(ButtonPrimary, { disabled: saving || !this.canSave(), onClick: () => this.save() }, 'Save'),
          ]),
          exporting &&
            h(ExportWorkflowModal, {
              defaultWorkflowName: savedConfig.name,
              destinationWorkspace: ({ workspace: { workspaceId }, accessLevel }) => {
                return workspace.workspaceId !== workspaceId && WorkspaceUtils.canWrite(accessLevel);
              },
              title: 'Copy to Workspace',
              exportButtonText: 'Copy',
              exportProvider: makeExportWorkflowFromWorkspaceProvider(workspace, savedConfig),
              onGoToExportedWorkflow: (selectedWorkspace, workflowName) =>
                Nav.goToPath('workflow', {
                  namespace: selectedWorkspace.namespace,
                  name: selectedWorkspace.name,
                  workflowNamespace: selectedWorkspace.namespace,
                  workflowName,
                }),
              onDismiss: () => this.setState({ exporting: false }),
            }),
          copying &&
            h(ExportWorkflowModal, {
              defaultWorkflowName: `${savedConfig.name}_copy`,
              destinationWorkspace: workspace,
              title: 'Duplicate Workflow',
              exportButtonText: 'Copy',
              exportProvider: makeExportWorkflowFromWorkspaceProvider(workspace, savedConfig),
              onDismiss: () => this.setState({ copying: false }),
              onSuccess: () => Nav.goToPath('workspace-workflows', { namespace, name: workspaceName }),
            }),
          deleting &&
            h(DeleteWorkflowConfirmationModal, {
              workspace,
              methodConfig: savedConfig,
              onDismiss: () => this.setState({ deleting: false }),
              onConfirm: async () => {
                this.setState({ deleting: false, updatingConfig: true });

                try {
                  await Workspaces().workspace(workspace.namespace, workspace.name).methodConfig(savedConfig.namespace, savedConfig.name).delete();

                  Nav.goToPath('workspace-workflows', _.pick(['namespace', 'name'], workspace));
                } catch (err) {
                  this.setState({ updatingConfig: false });
                  reportError('Error deleting workflow.', err);
                }
              },
            }),
          selectingData &&
            h(DataStepContent, {
              entityMetadata,
              entitySelectionModel,
              onDismiss: () => {
                this.setState({ selectingData: false });
              },
              onSuccess: (model) => this.setState({ entitySelectionModel: model, selectingData: false }),
              workspace: ws,
              rootEntityType: modifiedConfig.rootEntityType,
            }),
        ]
      );
    }

    downloadJson(key) {
      const { modifiedConfig } = this.state;
      downloadIO(modifiedConfig[key], key);
    }

    async uploadJson(key, file) {
      try {
        const rawUpdates = JSON.parse(await readFileAsText(file));
        const updates = _.mapValues((v) => sanitizeAttributeUpdateString(v))(rawUpdates);
        this.setState(({ modifiedConfig, modifiedInputsOutputs }) => {
          const existing = _.map('name', modifiedInputsOutputs[key]);
          return {
            modifiedConfig: _.update(key, _.assign(_, _.pick(existing, updates)), modifiedConfig),
          };
        });

        const { workspace } = this.props;
        const { modifiedConfig } = this.state;
        const {
          methodRepoMethod: { methodVersion, methodNamespace, methodName, methodPath, sourceRepo },
        } = modifiedConfig;
        void Metrics().captureEvent(Events.workflowUploadIO, {
          ...extractWorkspaceDetails(workspace.workspace),
          inputsOrOutputs: key,
          methodVersion,
          sourceRepo,
          methodPath: sourceRepo === 'agora' ? `${methodNamespace}/${methodName}` : methodPath,
        });
      } catch (error) {
        if (error instanceof SyntaxError) {
          reportError('Error processing file', 'This json file is not formatted correctly.');
        } else {
          reportError('Error processing file', error);
        }
      }
    }

    clear(key) {
      this.setState((prevState) => {
        const { modifiedConfig: prevModifiedConfig } = prevState;
        return { modifiedConfig: _.set(key, {}, prevModifiedConfig) };
      });

      const { workspace } = this.props;
      const { modifiedConfig } = this.state;
      const {
        methodRepoMethod: { methodVersion, methodNamespace, methodName, methodPath, sourceRepo },
      } = modifiedConfig;
      void Metrics().captureEvent(Events.workflowClearIO, {
        ...extractWorkspaceDetails(workspace.workspace),
        inputsOrOutputs: key,
        methodVersion,
        sourceRepo,
        methodPath: sourceRepo === 'agora' ? `${methodNamespace}/${methodName}` : methodPath,
      });
    }

    renderWDL() {
      const { wdl } = this.state;
      return div({ style: styles.tabContents }, [
        wdl
          ? h(WDLViewer, {
              wdl,
              readOnly: true,
              style: { maxHeight: 500 },
            })
          : centeredSpinner(),
      ]);
    }

    renderIOTable(key) {
      const { workspace } = this.props;
      const {
        modifiedConfig,
        modifiedInputsOutputs,
        errors,
        entityMetadata,
        workspaceAttributes,
        includeOptionalInputs,
        currentSnapRedacted,
        filter,
        selectedSnapshotEntityMetadata,
        availableSnapshots,
        entitySelectionModel: { selectedEntities },
      } = this.state;
      // Sometimes we're getting totally empty metadata. Not sure if that's valid; if not, revert this

      const selectedTableName = modifiedConfig.dataReferenceName ? modifiedConfig.rootEntityType : undefined;
      const selectionMetadata = selectedTableName ? selectedSnapshotEntityMetadata : entityMetadata;
      const attributeNames = _.get([modifiedConfig.rootEntityType, 'attributeNames'], selectionMetadata) || [];

      const suggestions = [
        ...(!selectedTableName && !modifiedConfig.dataReferenceName && modifiedConfig.rootEntityType
          ? [`this.${modifiedConfig.rootEntityType}_id`]
          : []),
        ...(modifiedConfig.rootEntityType ? _.map((name) => `this.${name}`, attributeNames) : []),
        ...getWorkflowInputSuggestionsForAttributesOfSetMembers(selectedEntities, selectionMetadata),
        ..._.map((name) => `workspace.${name}`, workspaceAttributes),
      ];
      const data = currentSnapRedacted ? _.map((k) => ({ name: k, inputType: 'unknown' }), _.keys(modifiedConfig[key])) : modifiedInputsOutputs[key];
      const filteredData = _.filter(({ name, optional }) => {
        return !(key === 'inputs' && !includeOptionalInputs && optional) && Utils.textMatch(filter, name);
      }, data);

      const isSingleAndOutputs = key === 'outputs' && this.isSingle();
      const isEditable = !currentSnapRedacted && WorkspaceUtils.canEditWorkspace(workspace).value && !isSingleAndOutputs;

      const linkStyle = { color: colors.accent(1.05) }; // Get to 4.5:1 contrast on the gray background

      return h(
        Dropzone,
        {
          key,
          accept: '.json',
          multiple: false,
          disabled: currentSnapRedacted || !WorkspaceUtils.canEditWorkspace(workspace).value || data.length === 0,
          style: {
            ...styles.tabContents,
            flex: 'auto',
            display: 'flex',
            flexDirection: 'column',
            position: undefined,
          },
          activeStyle: { backgroundColor: colors.accent(0.2), cursor: 'copy' },
          onDropRejected: () =>
            reportError(
              'Not a valid inputs file',
              'The selected file is not a json file. To import inputs for this workflow, upload a file with a .json extension.'
            ),
          onDropAccepted: (files) => this.uploadJson(key, files[0]),
        },
        [
          ({ openUploader }) =>
            data.length === 0
              ? `No configurable ${key}.`
              : h(Fragment, [
                  div({ style: { flex: 'none', display: 'flex', alignItems: 'center', marginBottom: '0.25rem' } }, [
                    isSingleAndOutputs &&
                      !currentSnapRedacted &&
                      div({ style: { margin: '0 1rem 0.5rem' } }, [
                        b(['Outputs are not mapped to the data model when processing a single workflow from files.']),
                        div(['To write to the data model, select "Process multiple workflows" above.']),
                      ]),
                    key === 'inputs' && _.some('optional', modifiedInputsOutputs.inputs)
                      ? h(
                          Link,
                          {
                            style: { marginRight: 'auto', ...linkStyle },
                            onClick: () => this.setState({ includeOptionalInputs: !includeOptionalInputs }),
                          },
                          [includeOptionalInputs ? 'Hide optional inputs' : 'Show optional inputs']
                        )
                      : div({ style: { marginRight: 'auto' } }),
                    h(Link, { style: linkStyle, onClick: () => this.downloadJson(key) }, ['Download json']),
                    isEditable &&
                      h(Fragment, [
                        div({ style: { whiteSpace: 'pre' } }, ['  |  Drag or click to ']),
                        h(Link, { style: linkStyle, onClick: openUploader }, ['upload json']),
                      ]),
                    isEditable &&
                      h(Fragment, [
                        div({ style: { whiteSpace: 'pre' } }, ['  |  ']),
                        h(Link, { style: linkStyle, onClick: () => this.clear(key) }, [`Clear ${key}`]),
                      ]),
                    h(DelayedSearchInput, {
                      'aria-label': `Search ${key}`,
                      style: { marginLeft: '1rem', width: 200 },
                      placeholder: `SEARCH ${key.toUpperCase()}`,
                      value: filter,
                      onChange: (filter) => this.setState({ filter }),
                    }),
                  ]),
                  div({ style: { flex: '1 0 auto' } }, [
                    h(WorkflowIOTable, {
                      readOnly: !isEditable,
                      which: key,
                      inputsOutputs: filteredData,
                      config: modifiedConfig,
                      errors,
                      onBrowse: (name) => this.setState({ variableSelected: name }),
                      onChange: (name, v) => this.setState(_.set(['modifiedConfig', key, name], v)),
                      onSetDefaults: () => {
                        this.setState((oldState) => {
                          return _.set(
                            ['modifiedConfig', 'outputs'],
                            _.fromPairs(_.map(({ name }) => [name, `this.${_.last(name.split('.'))}`], oldState.modifiedInputsOutputs.outputs)),
                            oldState
                          );
                        });

                        const { workspace } = this.props;
                        const { modifiedConfig } = this.state;
                        const {
                          methodRepoMethod: { methodVersion, methodNamespace, methodName, methodPath, sourceRepo },
                        } = modifiedConfig;
                        void Metrics().captureEvent(Events.workflowUseDefaultOutputs, {
                          ...extractWorkspaceDetails(workspace.workspace),
                          methodVersion,
                          sourceRepo,
                          methodPath: sourceRepo === 'agora' ? `${methodNamespace}/${methodName}` : methodPath,
                        });
                      },
                      suggestions,
                      availableSnapshots,
                    }),
                  ]),
                ]),
        ]
      );
    }

    async save() {
      const { namespace, name, workflowNamespace, workflowName } = this.props;
      const {
        modifiedConfig,
        modifiedInputsOutputs,
        entitySelectionModel: { type },
      } = this.state;

      this.setState({ saving: true });

      try {
        const trimInputOutput = _.flow(
          _.update('inputs', _.mapValues(_.trim)),
          _.update('outputs', this.isSingle() ? () => ({}) : _.mapValues(_.trim))
        );

        const validationResponse = await Workspaces()
          .workspace(namespace, name)
          .methodConfig(workflowNamespace, workflowName)
          .save(trimInputOutput(modifiedConfig));

        this.setState(
          {
            saved: true,
            savedConfig: validationResponse.methodConfiguration,
            modifiedConfig: validationResponse.methodConfiguration,
            errors: augmentErrors(validationResponse),
            savedInputsOutputs: modifiedInputsOutputs,
            ...(type === processSnapshotTable
              ? {
                  selectedEntityType: validationResponse.methodConfiguration.dataReferenceName,
                  selectedTableName: validationResponse.methodConfiguration.rootEntityType,
                }
              : { selectedEntityType: validationResponse.methodConfiguration.rootEntityType, selectedTableName: undefined }),
          },
          () => setTimeout(() => this.setState({ saved: false }), 3000)
        );
      } catch (error) {
        reportError('Error saving', error);
      } finally {
        this.setState({ saving: false });
      }
    }

    cancel() {
      const {
        savedConfig,
        savedInputsOutputs,
        savedConfig: { rootEntityType },
        savedSnapRedacted,
        activeTab,
      } = this.state;

      this.setState({
        saved: false,
        modifiedConfig: savedConfig,
        modifiedInputsOutputs: savedInputsOutputs,
        entitySelectionModel: this.resetSelectionModel(rootEntityType),
        currentSnapRedacted: savedSnapRedacted,
        activeTab: activeTab === 'wdl' && savedSnapRedacted ? 'inputs' : activeTab,
      });
      this.updateSingleOrMultipleRadioState(savedConfig);
    }
  }
);

export const navPaths = [
  {
    name: 'workflow',
    path: '/workspaces/:namespace/:name/workflows/:workflowNamespace/:workflowName',
    component: WorkflowView,
    title: ({ name, workflowName }) => `${name} - Workflows - ${workflowName}`,
  },
  {
    name: 'tools-workflow', // legacy
    path: '/workspaces/:namespace/:name/tools/:workflowNamespace/:workflowName',
    component: (props) => h(Nav.Redirector, { pathname: Nav.getPath('workflow', props) }),
  },
];
