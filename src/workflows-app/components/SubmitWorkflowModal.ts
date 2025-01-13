import { Modal, Spinner, useThemeFromContext } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import React, { CSSProperties, Fragment, useState } from 'react';
import { div, h, span } from 'react-hyperscript-helpers';
import { ErrorAlert } from 'src/alerts/ErrorAlert';
import { generateAppName, getCurrentApp } from 'src/analysis/utils/app-utils';
import { appAccessScopes, appToolLabels } from 'src/analysis/utils/tool-utils';
import { ButtonPrimary } from 'src/components/common';
import { getStyles as getErrorStyles } from 'src/components/ErrorView';
import { icon } from 'src/components/icons';
import { TextArea, TextInput } from 'src/components/input';
import { TextCell } from 'src/components/table';
import { RecordResponse } from 'src/libs/ajax/data-table-providers/WdsDataTableProvider';
import { Apps } from 'src/libs/ajax/leonardo/Apps';
import { App } from 'src/libs/ajax/leonardo/models/app-models';
import { useMetricsEvent } from 'src/libs/ajax/metrics/useMetrics';
import { Cbas } from 'src/libs/ajax/workflows-app/Cbas';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import * as Nav from 'src/libs/nav';
import { notify } from 'src/libs/notifications';
import { poll, toIndexPairs } from 'src/libs/utils';
import { MethodVersion, WorkflowMethod } from 'src/workflows-app/components/WorkflowCard';
import { InputDefinition, OutputDefinition } from 'src/workflows-app/models/submission-models';
import { loadAppUrls } from 'src/workflows-app/utils/app-utils';
import { convertInputTypes } from 'src/workflows-app/utils/submission-utils';
import { WorkspaceWrapper } from 'src/workspaces/utils';

type SubmitWorkflowModalProps = {
  method: WorkflowMethod;
  methodVersion: MethodVersion;
  recordType: string;
  selectedRecords: Record<string, RecordResponse>;
  inputDefinition: InputDefinition[];
  outputDefinition: OutputDefinition[];
  callCachingEnabled: boolean;
  onDismiss: () => void;
  name: string;
  namespace: string;
  workspace: WorkspaceWrapper;
};

export const SubmitWorkflowModal: React.FC<SubmitWorkflowModalProps> = (props): React.ReactNode => {
  const {
    method,
    methodVersion,
    recordType,
    selectedRecords,
    inputDefinition,
    outputDefinition,
    callCachingEnabled,
    onDismiss,
    name,
    namespace,
    workspace,
    workspace: {
      workspace: { workspaceId },
      canCompute,
    },
  } = props;
  const [runSetName, setRunSetName] = useState(
    `${_.kebabCase(method.name)}_${_.kebabCase(recordType)}_${new Date().toISOString().slice(0, -5)}`
  );
  const [runSetDescription, setRunSetDescription] = useState('');
  const [isCromwellRunnerLaunching, setIsCromwellRunnerLaunching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workflowSubmissionError, setWorkflowSubmissionError] = useState<string>();
  const [problemRunnerApp, setProblemRunnerApp] = useState<App | undefined>();

  const { captureEvent } = useMetricsEvent();
  const canSubmit = canCompute;

  const { colors } = useThemeFromContext();
  const errorStyles = getErrorStyles(colors);
  const submitRun = async () => {
    const runSetsPayload = {
      run_set_name: runSetName,
      run_set_description: runSetDescription,
      method_version_id: methodVersion.method_version_id,
      workflow_input_definitions: _.map(convertInputTypes, inputDefinition),
      workflow_output_definitions: outputDefinition,
      wds_records: {
        record_type: recordType,
        record_ids: _.keys(selectedRecords),
      },
      call_caching_enabled: callCachingEnabled,
    };
    const {
      cbasProxyUrlState: { state: cbasUrl },
    } = await loadAppUrls(workspaceId, 'cbasProxyUrlState');
    const runSetObject = await Cbas().runSets.post(cbasUrl, runSetsPayload);
    notify('success', 'Workflow successfully submitted', {
      message: 'You may check on the progress of workflow on this page anytime.',
      timeout: 5000,
    });
    captureEvent(Events.workflowsAppLaunchWorkflow, {
      ...extractWorkspaceDetails(workspace),
      methodUrl: methodVersion.url,
      methodVersion: methodVersion.name,
      methodSource: method.source,
      methodIsPrivate: method.isPrivate,
      previouslyRun: method.last_run.previously_run,
    });
    Nav.goToPath('workspace-workflows-app-submission-details', {
      name,
      namespace,
      submissionId: runSetObject.run_set_id,
    });
  };

  const submitToWorkflowsApp = () =>
    poll(async () => {
      try {
        const appsResponse = await Apps().listAppsV2(workspaceId, { role: 'creator' });
        const appToUse =
          getCurrentApp(appToolLabels.CROMWELL, appsResponse) ??
          getCurrentApp(appToolLabels.CROMWELL_RUNNER_APP, appsResponse);
        if (!appToUse) {
          setIsCromwellRunnerLaunching(true);
          await Apps().createAppV2(
            generateAppName(),
            workspaceId,
            appToolLabels.CROMWELL_RUNNER_APP,
            appAccessScopes.USER_PRIVATE
          );
          return { result: undefined, shouldContinue: true };
        }
        if (appToUse.status !== 'RUNNING') {
          if (appToUse.status === 'ERROR') {
            setIsCromwellRunnerLaunching(false);
            return { result: appToUse, shouldContinue: false };
          }
          setIsCromwellRunnerLaunching(true);
          return { result: undefined, shouldContinue: true };
        }
        setIsCromwellRunnerLaunching(false);
        await submitRun();
      } catch (error) {
        setWorkflowSubmissionError(JSON.stringify(error instanceof Response ? await error.json() : error, null, 2));
      }
      return { result: undefined, shouldContinue: false };
    }, 30000);

  return h(
    Modal,
    {
      title: 'Send submission',
      width: 600,
      onDismiss: () => {
        if (!isSubmitting) {
          setWorkflowSubmissionError(undefined);
          onDismiss();
        }
      },
      showCancel: !isSubmitting,
      okButton: h(
        ButtonPrimary,
        {
          disabled: isSubmitting || !canSubmit || problemRunnerApp !== undefined,
          tooltip: !canSubmit && 'You do not have permission to submit workflows in this workspace',
          'aria-label': 'Launch Submission',
          onClick: async () => {
            setIsSubmitting(true);
            const submitResult = await submitToWorkflowsApp();
            // If submit returns a value, it represents an app in an invalid state:
            if (submitResult !== undefined) {
              setProblemRunnerApp(submitResult);
            }
            setIsSubmitting(false);
          },
        },
        [isSubmitting ? 'Submitting...' : 'Submit']
      ),
    },
    [
      div({ style: { lineHeight: 2.0 } }, [
        h(TextCell, { style: { marginTop: '1.5rem', fontSize: 16, fontWeight: 'bold' } }, ['Submission name']),
        h(TextInput, {
          disabled: isSubmitting,
          'aria-label': 'Submission name',
          value: runSetName,
          onChange: setRunSetName,
          placeholder: 'Enter submission name',
        }),
      ]),
      div({ style: { lineHeight: 2.0, marginTop: '1.5rem' } }, [
        span({ style: { fontSize: 16, fontWeight: 'bold' } }, ['Comment ']),
        '(optional)',
        h(TextArea, {
          style: { height: 200, borderTopLeftRadius: 0, borderTopRightRadius: 0 },
          'aria-label': 'Enter a comment',
          disabled: isSubmitting,
          value: runSetDescription,
          onChange: setRunSetDescription,
          placeholder: 'Enter comments',
        }),
      ]),
      div({ style: { lineHeight: 2.0, marginTop: '1.5rem' } }, [
        div([
          h(TextCell, [
            'This will launch ',
            span({ style: { fontWeight: 'bold' } }, [_.keys(selectedRecords).length]),
            ' workflow(s).',
          ]),
        ]),
        h(TextCell, { style: { marginTop: '1rem' } }, ['Running workflows will generate cloud compute charges.']),
        workflowSubmissionError &&
          div([
            div({ style: { display: 'flex', alignItems: 'center', marginTop: '1rem' } }, [
              icon('warning-standard', { size: 16, style: { color: colors.danger() } }),
              h(TextCell, { style: { marginLeft: '0.5rem' } }, ['Error submitting workflow:']),
            ]),
            div(
              {
                style: { ...(errorStyles.jsonFrame as CSSProperties), overflowY: 'scroll', maxHeight: 160 },
                'aria-label': 'Modal submission error',
              },
              [workflowSubmissionError]
            ),
          ]),
        isCromwellRunnerLaunching &&
          isSubmitting &&
          h(Fragment, [
            div({ style: { display: 'flex', flexDirection: 'row', marginTop: '0.5rem' } }, [
              h(Spinner),
              div({ style: { marginLeft: '1rem' } }, ['Cromwell is launching...']),
            ]),
            'Your workflow will submit automatically when Cromwell is running',
          ]),
        problemRunnerApp &&
          h(Fragment, [
            div({ style: { display: 'flex', marginTop: '1rem', justifyContent: 'flex-center' } }, [
              icon('warning-standard', {
                size: 19,
                style: { color: colors.warning(), flex: 'none', marginRight: '1rem' },
              }),
              'A problem has occurred launching your personal Cromwell runner ("CROMWELL_RUNNER_APP") in this workspace. If the problem persists, please contact support.',
            ]),
            _.map(([index, error]) => {
              return div({ key: index }, [
                h(ErrorAlert, {
                  errorValue: error,
                  mainMessageField: 'errorMessage',
                }),
              ]);
            }, toIndexPairs(problemRunnerApp.errors)),
          ]),
        !canSubmit &&
          div({ style: { display: 'flex', alignItems: 'center', marginTop: '1rem' } }, [
            icon('warning-standard', { size: 16, style: { color: colors.danger() } }),
            h(TextCell, { style: { marginLeft: '0.5rem', marginRight: 'auto' } }, [
              'You do not have permission to run workflows in this workspace.',
            ]),
          ]),
      ]),
    ]
  );
};
