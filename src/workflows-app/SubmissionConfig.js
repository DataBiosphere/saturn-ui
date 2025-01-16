import { Switch, useUniqueId } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { a, div, h, h2, label, span } from 'react-hyperscript-helpers';
import { ButtonPrimary, Link, Select } from 'src/components/common';
import { centeredSpinner, icon } from 'src/components/icons';
import { InfoBox } from 'src/components/InfoBox';
import StepButtons from 'src/components/StepButtons';
import { Cbas } from 'src/libs/ajax/workflows-app/Cbas';
import { WorkflowScript } from 'src/libs/ajax/workflows-app/WorkflowScript';
import { WorkspaceData } from 'src/libs/ajax/WorkspaceDataService';
import colors from 'src/libs/colors';
import * as Nav from 'src/libs/nav';
import { notify } from 'src/libs/notifications';
import { useCancellation, useOnMount, usePollingEffect } from 'src/libs/react-utils';
import { AppProxyUrlStatus, workflowsAppStore } from 'src/libs/state';
import * as Utils from 'src/libs/utils';
import { maybeParseJSON } from 'src/libs/utils';
import HelpfulLinksBox from 'src/workflows-app/components/HelpfulLinksBox';
import InputsTable from 'src/workflows-app/components/InputsTable';
import OutputsTable from 'src/workflows-app/components/OutputsTable';
import RecordsTable from 'src/workflows-app/components/RecordsTable';
import { SubmitWorkflowModal } from 'src/workflows-app/components/SubmitWorkflowModal';
import ViewWorkflowScriptModal from 'src/workflows-app/components/ViewWorkflowScriptModal';
import { doesAppProxyUrlExist, loadAppUrls } from 'src/workflows-app/utils/app-utils';
import { convertToRawUrl } from 'src/workflows-app/utils/method-common';
import {
  autofillOutputDef,
  CbasDefaultSubmissionLimits,
  CbasPollInterval,
  validateInputs,
  WdsPollInterval,
} from 'src/workflows-app/utils/submission-utils';
import { wrapWorkflowsPage } from 'src/workflows-app/WorkflowsContainer';

export const BaseSubmissionConfig = (
  {
    methodId,
    name,
    namespace,
    workspace,
    workspace: {
      workspace: { workspaceId },
    },
  },
  _ref
) => {
  const [activeTab, setActiveTab] = useState({ key: 'select-data' });
  const [recordTypes, setRecordTypes] = useState();
  const [method, setMethod] = useState();
  const [availableMethodVersions, setAvailableMethodVersions] = useState();
  const [selectedMethodVersion, setSelectedMethodVersion] = useState();
  const [records, setRecords] = useState([]);
  const [totalRecordsInActualDataTable, setTotalRecordsInActualDataTable] = useState();
  const [loading, setLoading] = useState(false);
  const [workflowScript, setWorkflowScript] = useState();
  const [cbasSubmissionLimits, setCbasSubmissionLimits] = useState(CbasDefaultSubmissionLimits);

  // Options chosen on this page:
  const [selectedRecordType, setSelectedRecordType] = useState();
  const [selectedRecords, setSelectedRecords] = useState({});
  const [configuredInputDefinition, setConfiguredInputDefinition] = useState([]);
  const [configuredOutputDefinition, setConfiguredOutputDefinition] = useState();
  const [inputValidations, setInputValidations] = useState([]);
  const [viewWorkflowScriptModal, setViewWorkflowScriptModal] = useState(false);
  const [isCallCachingEnabled, setIsCallCachingEnabled] = useState(true);

  const [displayLaunchModal, setDisplayLaunchModal] = useState(false);
  const [noRecordTypeData, setNoRecordTypeData] = useState(null);

  const signal = useCancellation();
  const errorMessageCount = _.filter((message) => message.type === 'error')(inputValidations).length;

  const loadRecordsData = useCallback(
    async (recordType, wdsUrlRoot, searchLimit) => {
      try {
        const searchResult = await WorkspaceData(signal).queryRecords(wdsUrlRoot, workspaceId, recordType, searchLimit);
        setRecords(searchResult.records);
        setTotalRecordsInActualDataTable(searchResult.totalRecords);
      } catch (error) {
        if (recordType === undefined) {
          setNoRecordTypeData('Select a data table');
        } else {
          setNoRecordTypeData(`Data table not found: ${recordType}`);
        }
      }
    },
    [signal, workspaceId]
  );

  const loadMethodsData = useCallback(
    async (cbasUrlRoot, methodId, methodVersionId) => {
      try {
        const methodsResponse = await Cbas(signal).methods.getById(cbasUrlRoot, methodId);
        const method = methodsResponse.methods[0];
        if (method) {
          const selectedVersion = _.filter((mv) => mv.method_version_id === methodVersionId, method.method_versions)[0];
          setMethod(method);
          setAvailableMethodVersions(method.method_versions);
          setSelectedMethodVersion(selectedVersion);
        } else {
          notify('error', 'Error loading methods data', { detail: 'Method not found.' });
        }
      } catch (error) {
        notify('error', 'Error loading methods data', { detail: error instanceof Response ? await error.text() : error });
      }
    },
    [signal]
  );

  const loadRunSet = useCallback(
    async (cbasUrlRoot) => {
      try {
        const runSet = await Cbas(signal).runSets.getForMethod(cbasUrlRoot, methodId, 1);
        const newRunSetData = runSet.run_sets[0];

        setConfiguredInputDefinition(maybeParseJSON(newRunSetData.input_definition));
        const outputDef = autofillOutputDef(newRunSetData.output_definition, newRunSetData.run_count);
        setConfiguredOutputDefinition(outputDef);
        setSelectedRecordType(newRunSetData.record_type);

        let callCache = maybeParseJSON(newRunSetData.call_caching_enabled);
        callCache = _.isEmpty(callCache) ? true : callCache; // avoid setting boolean to undefined, default to true
        setIsCallCachingEnabled(callCache);

        return newRunSetData;
      } catch (error) {
        notify('error', 'Error loading run set data', { detail: error instanceof Response ? await error.text() : error });
      }
    },
    [methodId, signal]
  );

  const loadCbasSubmissionLimits = useCallback(
    async (cbasUrlRoot) => {
      try {
        const capabilities = await Cbas(signal).capabilities(cbasUrlRoot);
        if (capabilities) {
          const newCapabilities = {
            maxWorkflows: capabilities['submission.limits.maxWorkflows']
              ? capabilities['submission.limits.maxWorkflows']
              : cbasSubmissionLimits.maxWorkflows,
            maxInputs: capabilities['submission.limits.maxInputs'] ? capabilities['submission.limits.maxInputs'] : cbasSubmissionLimits.maxInputs,
            maxOutputs: capabilities['submission.limits.maxOutputs'] ? capabilities['submission.limits.maxOutputs'] : cbasSubmissionLimits.maxOutputs,
          };
          setCbasSubmissionLimits(newCapabilities);
          return newCapabilities;
        }

        return CbasDefaultSubmissionLimits;
      } catch (error) {
        // in case the /capabilities API doesn't exist in this CBAS instance or the API exists but CBAS
        // threw non-OK status, then use default submission limits
        return CbasDefaultSubmissionLimits;
      }
    },
    [signal, cbasSubmissionLimits]
  );

  const loadRecordTypes = useCallback(
    async (wdsUrlRoot) => {
      try {
        setRecordTypes(await WorkspaceData(signal).describeAllRecordTypes(wdsUrlRoot, workspaceId));
      } catch (error) {
        notify('error', 'Error loading data types', { detail: error instanceof Response ? await error.text() : error });
      }
    },
    [signal, workspaceId]
  );

  const loadRecordTypesAndData = useCallback(
    async ({ wdsUrlRoot, recordType, searchLimit, includeLoadRecordTypes }) => {
      if (includeLoadRecordTypes) {
        await loadRecordTypes(wdsUrlRoot);
      }
      await loadRecordsData(recordType, wdsUrlRoot, searchLimit);
    },
    [loadRecordsData, loadRecordTypes]
  );

  const handleWdsAppNotFound = useCallback(async (wdsUrlState) => {
    const errorDetails = wdsUrlState instanceof Response ? await wdsUrlState.text() : wdsUrlState;
    const additionalDetails = errorDetails ? `Error details: ${JSON.stringify(errorDetails)}` : '';
    // to avoid stacked warning banners due to auto-poll for WDS url, we remove the current banner at 29th second
    notify('warn', 'Error loading data tables', {
      detail: `Data Table app not found. Will retry in 30 seconds. ${additionalDetails}`,
      timeout: WdsPollInterval - 1000,
    });
  }, []);

  const loadWdsData = useCallback(
    async ({ wdsProxyUrlDetails, recordType, searchLimit, includeLoadRecordTypes = true }) => {
      try {
        // try to load WDS proxy URL if one doesn't exist
        if (wdsProxyUrlDetails.status !== AppProxyUrlStatus.Ready) {
          const { wdsProxyUrlState } = await loadAppUrls(workspaceId, 'wdsProxyUrlState');

          if (wdsProxyUrlState.status === AppProxyUrlStatus.Ready) {
            await loadRecordTypesAndData({ wdsUrlRoot: wdsProxyUrlState.state, recordType, searchLimit, includeLoadRecordTypes });
          } else {
            await handleWdsAppNotFound(wdsProxyUrlState.state);
          }
        } else {
          // if we have the WDS proxy URL load the WDS data
          await loadRecordTypesAndData({ wdsUrlRoot: wdsProxyUrlDetails.state, recordType, searchLimit, includeLoadRecordTypes });
        }
      } catch (error) {
        notify('error', 'Error loading data tables', { detail: error instanceof Response ? await error.text() : error });
      }
    },
    [workspaceId, loadRecordTypesAndData, handleWdsAppNotFound]
  );

  const loadConfigData = useCallback(
    async (cbasProxyUrlDetails, wdsProxyUrlDetails) => {
      try {
        // try to load CBAS proxy url if one doesn't exist
        if (cbasProxyUrlDetails.status !== AppProxyUrlStatus.Ready) {
          const { wdsProxyUrlState, cbasProxyUrlState } = await loadAppUrls(workspaceId, 'cbasProxyUrlState');

          if (cbasProxyUrlState.status === AppProxyUrlStatus.Ready) {
            loadRunSet(cbasProxyUrlState.state).then((runSet) => {
              if (runSet !== undefined) {
                loadMethodsData(cbasProxyUrlState.state, runSet.method_id, runSet.method_version_id);
                loadCbasSubmissionLimits(cbasProxyUrlState.state).then((submissionLimits) => {
                  loadWdsData({
                    wdsProxyUrlDetails: wdsProxyUrlState,
                    recordType: runSet.record_type,
                    searchLimit: submissionLimits.maxWorkflows,
                  });
                });
              }
            });
          } else {
            const cbasUrlState = cbasProxyUrlState.state;
            const errorDetails = cbasUrlState instanceof Response ? await cbasUrlState.text() : cbasUrlState;
            const additionalDetails = errorDetails ? `Error details: ${JSON.stringify(errorDetails)}` : '';
            // to avoid stacked warning banners due to auto-poll for CBAS url, we remove the current banner at 29th second
            notify('warn', 'Error loading Workflows app', {
              detail: `Workflows app not found. Will retry in 30 seconds. ${additionalDetails}`,
              timeout: CbasPollInterval - 1000,
            });
          }
        } else {
          loadRunSet(cbasProxyUrlDetails.state).then((runSet) => {
            if (runSet !== undefined) {
              loadMethodsData(cbasProxyUrlDetails.state, runSet.method_id, runSet.method_version_id);
              loadCbasSubmissionLimits(cbasProxyUrlDetails.state).then((submissionLimits) => {
                loadWdsData({ wdsProxyUrlDetails, recordType: runSet.record_type, searchLimit: submissionLimits.maxWorkflows });
              });
            }
          });
        }
      } catch (error) {
        notify('error', 'Error loading Workflows app', { detail: error instanceof Response ? await error.text() : error });
      }
    },
    [loadCbasSubmissionLimits, loadMethodsData, loadRunSet, loadWdsData, workspaceId]
  );

  useOnMount(() => {
    const loadWorkflowsApp = async () => {
      const { wdsProxyUrlState, cbasProxyUrlState } = await loadAppUrls(workspaceId, 'cbasProxyUrlState');

      if (cbasProxyUrlState.status === AppProxyUrlStatus.Ready) {
        const runSet = await loadRunSet(cbasProxyUrlState.state);
        if (runSet !== undefined) {
          await loadMethodsData(cbasProxyUrlState.state, runSet.method_id, runSet.method_version_id);
          const submissionLimits = await loadCbasSubmissionLimits(cbasProxyUrlState.state);
          await loadWdsData({
            wdsProxyUrlDetails: wdsProxyUrlState,
            recordType: runSet.record_type,
            searchLimit: submissionLimits.maxWorkflows,
          });
        }
      }
    };
    loadWorkflowsApp();
  });

  useEffect(() => {
    // inspect input configuration and selected data table to find required inputs without attributes assigned to it
    if (recordTypes && records && records.length && configuredInputDefinition) {
      const selectedDataTable = _.keyBy('name', recordTypes)[records[0].type];
      const dataTableAttributes = _.keyBy('name', selectedDataTable.attributes);

      const newInputValidations = validateInputs(configuredInputDefinition, dataTableAttributes);

      setInputValidations(newInputValidations);
    } else if (configuredInputDefinition) {
      const newInputValidations = validateInputs(configuredInputDefinition, undefined);
      setInputValidations(newInputValidations);
    }
  }, [records, recordTypes, configuredInputDefinition]);

  useEffect(() => {
    if (method && availableMethodVersions) {
      setLoading(false);
    } else {
      setLoading(true);
    }
  }, [method, availableMethodVersions]);

  useEffect(() => {
    async function getWorkflowScript() {
      try {
        if (!method.isPrivate) {
          const workflowUrlRaw = await convertToRawUrl(selectedMethodVersion.url, selectedMethodVersion.name, method.source);
          const script = await WorkflowScript(signal).get(workflowUrlRaw);
          setWorkflowScript(script);
        }
      } catch (error) {
        notify('error', 'Error loading workflow script', { detail: error instanceof Response ? await error.text() : error });
      }
    }

    if (selectedMethodVersion != null) {
      getWorkflowScript();
    }
  }, [signal, selectedMethodVersion, method]);

  // poll if we're missing CBAS proxy url and stop polling when we have it
  usePollingEffect(
    () =>
      !doesAppProxyUrlExist(workspaceId, 'cbasProxyUrlState') &&
      loadConfigData(workflowsAppStore.get().cbasProxyUrlState, workflowsAppStore.get().wdsProxyUrlState),
    { ms: CbasPollInterval, leading: false }
  );

  // poll if we're missing WDS proxy url and stop polling when we have it
  usePollingEffect(
    () =>
      !doesAppProxyUrlExist(workspaceId, 'wdsProxyUrlState') &&
      loadWdsData({
        wdsProxyUrlDetails: workflowsAppStore.get().wdsProxyUrlState,
        recordType: selectedRecordType,
        searchLimit: cbasSubmissionLimits.maxWorkflows,
      }),
    { ms: WdsPollInterval, leading: false }
  );

  const getSupportLink = (article) => {
    return `https://support.terra.bio/hc/en-us/articles/${article}`;
  };

  const callCacheId = useUniqueId();

  const renderSummary = () => {
    return div({ style: { marginLeft: '2em', marginTop: '1rem', display: 'flex', justifyContent: 'space-between' } }, [
      div([
        h(
          Link,
          {
            onClick: () =>
              Nav.goToPath('workspace-workflows-app', {
                name,
                namespace,
                workspace: {
                  workspace: { workspaceId },
                },
              }),
            style: { display: 'inline-flex', alignItems: 'center', padding: '0.5rem 0 0' },
          },
          [icon('arrowLeft', { style: { marginRight: '0.5rem' } }), 'Back to Workflows in this workspace']
        ),
        div([h2([method ? `Submission Configuration for ${method.name}` : 'loading'])]),
        div({ style: { lineHeight: 2.0 } }, [
          div([
            span({ style: { fontWeight: 'bold' } }, ['Workflow Version: ']),
            availableMethodVersions
              ? h(Select, {
                  isDisabled: false,
                  'aria-label': 'Select a workflow version',
                  isClearable: false,
                  value: selectedMethodVersion ? selectedMethodVersion.name : null,
                  onChange: ({ value }) => {
                    setSelectedMethodVersion(_.find((m) => m.name === value, availableMethodVersions));
                  },
                  placeholder: 'None',
                  styles: { container: (old) => ({ ...old, display: 'inline-block', width: 325, marginLeft: 20 }) },
                  options: _.map((m) => m.name, availableMethodVersions),
                })
              : 'Fetching available workflow versions...',
          ]),
          div([
            span({ style: { fontWeight: 'bold' } }, ['Workflow source URL: ']),
            selectedMethodVersion ? selectedMethodVersion.url : 'No workflow version selected',
          ]),
          div([
            h(
              Link,
              {
                tooltip: method?.isPrivate === true ? 'View Workflow Script not yet available for private workflows' : undefined,
                disabled: workflowScript == null || method?.isPrivate === true,
                onClick: () => setViewWorkflowScriptModal(true),
              },
              'View Workflow Script'
            ),
          ]),
        ]),
        div({ style: { marginTop: '1rem' } }, [
          label({ htmlFor: callCacheId, style: { height: '2rem', marginRight: '0.25rem', fontWeight: 'bold', display: 'inline-block' } }, [
            'Call Caching:',
          ]),
          div({ style: { display: 'inline-block', marginRight: '1rem' } }, [
            h(InfoBox, [
              "Call caching detects when a job has been run in the past so that it doesn't have to re-compute results. ",
              h(Link, { href: getSupportLink('19619225467163'), ...Utils.newTabLinkProps }, ['Click here to learn more.']),
            ]),
          ]),
          div({ style: { display: 'inline-block' } }, [
            h(Switch, {
              id: callCacheId,
              checked: isCallCachingEnabled,
              onChange: (newValue) => {
                setIsCallCachingEnabled(newValue);
              },
              onLabel: 'On',
              offLabel: 'Off',
            }),
          ]),
        ]),
        div({ style: { marginTop: '1rem', height: '2rem', fontWeight: 'bold' } }, ['Select a data table:']),
        div({}, [
          h(Select, {
            isDisabled: false,
            'aria-label': 'Select a data table',
            isClearable: false,
            value: selectedRecordType || null,
            onChange: ({ value }) => {
              setNoRecordTypeData(null);
              setSelectedRecordType(value);
              setSelectedRecords(null);
              loadWdsData({
                wdsProxyUrlDetails: workflowsAppStore.get().wdsProxyUrlState,
                recordType: value,
                searchLimit: cbasSubmissionLimits.maxWorkflows,
                includeLoadRecordTypes: false,
              });
            },
            placeholder: 'None selected',
            styles: { container: (old) => ({ ...old, display: 'inline-block', width: 200 }), paddingRight: '2rem' },
            options: _.map((t) => t.name, recordTypes),
          }),
          noRecordTypeData &&
            h(Fragment, [
              a(
                {
                  'aria-label': 'warning message',
                  style: { marginLeft: '1rem', fontSize: 15, marginTop: '1rem', height: '2rem', fontWeight: 'bold' },
                },
                [
                  icon('error-standard', {
                    size: 20,
                    style: { color: colors.warning(), flex: 'none', marginRight: '0.5rem' },
                  }),
                  noRecordTypeData,
                ]
              ),
            ]),
        ]),
        h(StepButtons, {
          tabs: [
            { key: 'select-data', title: 'Select Data', isValid: true },
            { key: 'inputs', title: 'Inputs', isValid: errorMessageCount === 0 },
            { key: 'outputs', title: 'Outputs', isValid: true },
          ],
          activeTab: activeTab.key || 'select-data',
          onChangeTab: (v) => setActiveTab({ key: v }),
          finalStep: h(
            ButtonPrimary,
            {
              'aria-label': 'Submit button',
              style: { marginLeft: '1rem' },
              disabled: _.isEmpty(selectedRecords) || errorMessageCount > 0,
              tooltip: Utils.cond(
                [_.isEmpty(selectedRecords), () => 'No records selected'],
                [errorMessageCount > 0, () => `${errorMessageCount} input(s) have missing/invalid values`],
                () => ''
              ),
              onClick: () => setDisplayLaunchModal(true),
            },
            ['Submit']
          ),
        }),
        displayLaunchModal &&
          h(SubmitWorkflowModal, {
            method,
            methodVersion: selectedMethodVersion,
            recordType: selectedRecordType,
            selectedRecords,
            inputDefinition: configuredInputDefinition,
            outputDefinition: configuredOutputDefinition,
            callCachingEnabled: isCallCachingEnabled,
            onDismiss: () => setDisplayLaunchModal(false),
            name,
            namespace,
            workspace,
          }),
        viewWorkflowScriptModal &&
          h(ViewWorkflowScriptModal, {
            workflowScript,
            onDismiss: () => setViewWorkflowScriptModal(false),
          }),
      ]),
      method && div({ style: { marginRight: '1em' } }, [h(HelpfulLinksBox, { method })]),
    ]);
  };

  const renderInputs = () => {
    return configuredInputDefinition
      ? h(InputsTable, {
          selectedDataTable: _.keyBy('name', recordTypes)[selectedRecordType] || {},
          configuredInputDefinition,
          setConfiguredInputDefinition,
          inputValidations,
        })
      : 'Input definition is not configured...';
  };

  const renderOutputs = () => {
    return configuredOutputDefinition
      ? h(OutputsTable, {
          configuredOutputDefinition,
          setConfiguredOutputDefinition,
        })
      : 'No previous run set data...';
  };

  const renderRecordSelector = () => {
    return recordTypes && records.length
      ? h(RecordsTable, {
          records,
          selectedRecords,
          setSelectedRecords,
          selectedDataTable: _.keyBy('name', recordTypes)[selectedRecordType || records[0].type],
          totalRecordsInActualDataTable,
        })
      : 'No data table rows selected...';
  };

  return loading
    ? centeredSpinner()
    : h(Fragment, [
        div(
          {
            style: {
              borderBottom: '2px solid rgb(116, 174, 67)',
              boxShadow: 'rgb(0 0 0 / 26%) 0px 2px 5px 0px, rgb(0 0 0 / 16%) 0px 2px 10px 0px',
              position: 'relative',
            },
          },
          [renderSummary()]
        ),
        div(
          {
            style: {
              display: 'flex',
              flex: '1 1 auto',
              flexDirection: 'column',
              padding: '1rem 3rem',
            },
          },
          [
            Utils.switchCase(
              activeTab.key || 'select-data',
              ['select-data', () => renderRecordSelector()],
              ['inputs', () => renderInputs()],
              ['outputs', () => renderOutputs()]
            ),
          ]
        ),
      ]);
};

export const SubmissionConfig = wrapWorkflowsPage({ name: 'SubmissionConfig' })(BaseSubmissionConfig);

export const navPaths = [
  {
    name: 'workspace-workflows-app-submission-config',
    path: '/workspaces/:namespace/:name/workflows-app/submission-config/:methodId',
    component: SubmissionConfig,
    title: ({ name }) => `${name} - Submission Config`,
  },
];
