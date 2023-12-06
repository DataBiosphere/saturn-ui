import { useState } from 'react';
import { div, h, h2 } from 'react-hyperscript-helpers';
import { ButtonPrimary } from 'src/components/common';
import { icon } from 'src/components/icons';
import { ValidatedInput } from 'src/components/input';
import { TooltipCell } from 'src/components/table';
import { useMetricsEvent } from 'src/libs/ajax/metrics/useMetrics';
import colors from 'src/libs/colors';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import { FormLabel } from 'src/libs/forms';
import * as Utils from 'src/libs/utils';
import { withBusyState } from 'src/libs/utils';
import { ImportWorkflowModal } from 'src/workflows-app/components/ImportWorkflowModal';
import { getMethodVersionName, submitMethod } from 'src/workflows-app/utils/method-common';
import validate from 'validate.js';

const constraints = {
  methodUrl: {
    length: { maximum: 254 },
    url: true,
  },
  methodName: {
    presence: { allowEmpty: false },
  },
};

const ImportGithub = ({ setLoading, signal, workspace, name, namespace, setSelectedSubHeader }) => {
  const [methodName, setMethodName] = useState('');
  const [methodVersionName, setMethodVersionName] = useState('');
  const [methodUrl, setMethodUrl] = useState('');
  const [methodUrlModified, setMethodUrlModified] = useState(false);
  const [methodNameModified, setMethodNameModified] = useState(false);
  const [methodId, setMethodId] = useState('');

  const [importWorkflowModal, setImportWorkflowModal] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [successfulImport, setSuccessfulImport] = useState(undefined);
  const [errorMessage, setErrorMessage] = useState('');

  const errors = validate({ methodName, methodUrl }, constraints, {
    prettify: (v) => ({ methodName: 'Method name', methodUrl: 'Workflow url' }[v] || validate.prettify(v)),
  });

  const updateWorkflowName = (url) => {
    setMethodName(url.substring(url.lastIndexOf('/') + 1).replace('.wdl', ''));
  };

  const onSuccess = (methodObject) => {
    setMethodId(methodObject.method_id);
    setImportLoading(false);
    setSuccessfulImport(true);
  };
  const onError = async (error) => {
    setImportLoading(false);
    setSuccessfulImport(false);
    setErrorMessage(JSON.stringify(error instanceof Response ? await error.text() : error, null, 2));
  };
  const { captureEvent } = useMetricsEvent();
  return div({ style: { display: 'flex', flexDirection: 'column', flexGrow: 1, margin: '1rem 2rem' } }, [
    h2({ style: { marginTop: 0 } }, ['Import a workflow']),
    'Options to add workflows via a link or adding a script.',
    div({ style: { marginTop: '2rem' } }, [
      h2({}, ['Add a link']),
      div({ style: { display: 'flex', alignItems: 'center' } }, [
        h(FormLabel, { style: { fontWeight: 'bold' }, htmlFor: 'methodurl', required: true }, ['Workflow Link']),
        h(TooltipCell, { tooltip: 'Link must start with https://github.com or https://raw.githubusercontent.com' }, [
          icon('error-standard', { size: 20, style: { top: '50px', marginLeft: '1rem', color: colors.accent(), cursor: 'help' } }),
        ]),
      ]),
      h(ValidatedInput, {
        inputProps: {
          style: { width: '30%', height: '3.5rem' },
          id: 'methodurl',
          placeholder: 'Paste Github link',
          value: methodUrl,
          onChange: (u) => {
            updateWorkflowName(u);
            setMethodVersionName(getMethodVersionName(u));
            setMethodUrl(u);
            setMethodUrlModified(true);
          },
        },
        error: Utils.summarizeErrors(methodUrlModified && errors?.methodUrl),
      }),
      h(FormLabel, { style: { fontWeight: 'bold' }, htmlFor: 'workflowName', required: true }, ['Workflow Name']),
      h(ValidatedInput, {
        inputProps: {
          id: 'workflowName',
          style: { width: '30%', height: '3.5rem' },
          placeholder: 'Workflow Name',
          value: methodName,
          onChange: (n) => {
            setMethodName(n);
            setMethodNameModified(true);
          },
        },
        error: Utils.summarizeErrors(methodNameModified && errors?.methodName),
      }),
      div({}, [
        h(
          ButtonPrimary,
          {
            style: { marginTop: '2rem', borderRadius: 2 },
            'aria-label': 'Add to Workspace button',
            disabled: errors,
            onClick: () => {
              setImportWorkflowModal(true);
              setImportLoading(true);
              const method = {
                method_name: methodName,
                method_version: methodVersionName,
                method_url: methodUrl,
                method_source: 'GitHub',
              };
              captureEvent(Events.workflowsAppImport, {
                ...extractWorkspaceDetails(workspace),
                workflowSource: 'GitHub',
                workflowName: methodName,
                workflowUrl: methodUrl,
                importPage: 'ImportGithub',
              });
              withBusyState(setLoading, submitMethod(signal, method, workspace, onSuccess, onError));
            },
          },
          ['Add to Workspace']
        ),
      ]),
    ]),
    importWorkflowModal &&
      h(ImportWorkflowModal, {
        importLoading,
        methodName,
        onDismiss: () => setImportWorkflowModal(false),
        workspace,
        namespace,
        name,
        methodId,
        setSelectedSubHeader,
        successfulImport,
        errorMessage,
      }),
  ]);
};

export default ImportGithub;
