import _ from 'lodash/fp';
import { useCallback, useEffect, useState } from 'react';
import { parseGsUri } from 'src/components/data/data-utils';
import { Metrics } from 'src/libs/ajax/Metrics';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import { reportError } from 'src/libs/error';
import Events from 'src/libs/events';
import { useCancellation } from 'src/libs/react-utils';
import * as Utils from 'src/libs/utils';
import { validate as validateUUID } from 'uuid';

export const maxSubmissionsQueriedForProvenance = 25;

const getSubmissionsWithRootEntityType = async (workspace, entityType, { signal } = {}) => {
  const {
    workspace: { namespace, name },
  } = workspace;

  // The root entity type is stored on method configurations, not submissions. To avoid fetching
  // every submission's configuration, first use the list submissions endpoint and filter by
  // submission entity type.
  //
  // If a workflow is run on a single entity, the submission entity type will be the root entity type.
  // If a workflow is run on multiple entities, the submission entity type will be a set of the root entity type.
  //
  // After fetching method configurations, another filter is required remove submissions whose root entity type
  // was a set of the desired entity type.
  const allSubmissions = await Workspaces(signal).workspace(namespace, name).listSubmissions();
  const submissionsMaybeUsingEntityType = _.flow(
    _.filter((submission) => {
      const submissionEntityType = submission.submissionEntity.entityType;
      return submissionEntityType === entityType || submissionEntityType === `${entityType}_set`;
    }),
    _.slice(0, maxSubmissionsQueriedForProvenance)
  )(allSubmissions);

  const submissionConfigurations = await Promise.all(
    _.map(
      (submission) => Workspaces(signal).workspace(namespace, name).submission(submission.submissionId).getConfiguration(),
      submissionsMaybeUsingEntityType
    )
  );

  return _.flow(
    _.map(([submission, configuration]) => ({ submission, configuration })),
    _.filter(({ configuration }) => configuration.rootEntityType === entityType),
    _.orderBy(({ submission }) => new Date(submission.submissionDate), 'desc')
  )(_.zip(submissionsMaybeUsingEntityType, submissionConfigurations));
};

const getColumnFromOutputExpression = (expr) => {
  const match = /^this\.([^.]+)$/.exec(expr);
  return match ? match[1] : null;
};

const getColumnProvenance = async (workspace, entityType, { signal } = {}) => {
  const submissions = await getSubmissionsWithRootEntityType(workspace, entityType, { signal });

  return _.flow(
    _.flatMap((submission) => _.map(([output, expression]) => ({ ...submission, output, expression }), _.toPairs(submission.configuration.outputs))),
    _.map(({ expression, ...output }) => ({ ...output, column: getColumnFromOutputExpression(expression) })),
    _.filter((output) => !!output.column),
    _.reduce((acc, { submission, configuration, output, column }) => {
      const provenanceEntry = {
        submissionId: submission.submissionId,
        submissionDate: submission.submissionDate,
        submitter: submission.submitter,
        configuration,
        output,
      };
      return _.update(column, _.flow(_.defaultTo([]), Utils.append(provenanceEntry)), acc);
    }, {})
  )(submissions);
};

export const useColumnProvenance = (workspace, entityType) => {
  const signal = useCancellation();
  const [loading, setLoading] = useState(false);
  const [columnProvenance, setColumnProvenance] = useState(null);
  const [error, setError] = useState(null);

  const loadColumnProvenance = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setColumnProvenance(await getColumnProvenance(workspace, entityType, { signal }));
    } catch (error) {
      setError(error);
      reportError('Error loading column provenance', error);
    } finally {
      setLoading(false);
    }
  }, [workspace, entityType, signal]);

  return {
    columnProvenance,
    loading,
    error,
    loadColumnProvenance: loading
      ? _.noop
      : () => {
          loadColumnProvenance();
        },
  };
};

export const fileProvenanceTypes = Utils.enumify(['externalFile', 'unknown', 'maybeSubmission', 'workflowOutput', 'workflowLog']);

const isLog = (url, task) => _.some((log) => _.includes(url, [log.backendLogs.log, log.stdout, log.stderr]), task.logs);

const isOutput = (url, task) =>
  _.some(
    // outputs can contain a value, a collection of values, or a collection of collections of values
    (output) => output === url || _.includes(url, output) || _.some(_.includes(url), output),
    task.outputs
  );

export const getFileProvenance = async (workspace, fileUrl, { signal } = {}) => {
  const {
    workspace: { namespace, name, bucketName: workspaceBucket },
  } = workspace;

  const [bucket, path] = parseGsUri(fileUrl);
  if (!bucket || bucket !== workspaceBucket) {
    return { type: fileProvenanceTypes.externalFile };
  }

  const pathParts = path.split('/');

  // Previously, submission roots were `gs://<workspace bucket>/<submission ID>`.
  // Now, they are `gs://<workspace bucket>/submissions/<submission ID>`.
  if (!(validateUUID(pathParts[0]) || (pathParts[0] === 'submissions' && validateUUID(pathParts[1])))) {
    return { type: fileProvenanceTypes.unknown };
  }

  // Workflow outputs and logs are in submissions/<submission ID>/<workflow name>/<workflow ID>/<task name>.
  const [submissionId, workflowId] = _.filter(validateUUID, pathParts);
  if (!workflowId) {
    return {
      type: fileProvenanceTypes.maybeSubmission,
      submissionId,
    };
  }

  const workflowOutputs = await Workspaces(signal).workspace(namespace, name).submission(submissionId).workflow(workflowId).outputs();

  const [taskName, task] = _.flow(
    _.toPairs,
    _.find(([, task]) => isLog(fileUrl, task) || isOutput(fileUrl, task)),
    _.defaultTo([])
  )(workflowOutputs.tasks);

  if (!(taskName && task)) {
    return {
      type: fileProvenanceTypes.maybeSubmission,
      submissionId,
    };
  }

  if (isLog(fileUrl, task)) {
    return {
      type: fileProvenanceTypes.workflowLog,
      submissionId,
      workflowId,
    };
  }

  return {
    type: fileProvenanceTypes.workflowOutput,
    submissionId,
    workflowId,
  };
};

export const getFileProtocol = (fileUrl) => {
  const protocolSeparator = fileUrl.indexOf(':');
  return protocolSeparator > 0 ? fileUrl.substr(0, protocolSeparator) : 'unknown';
};

export const useFileProvenance = (workspace, fileUrl) => {
  const signal = useCancellation();
  const [loading, setLoading] = useState(true);
  const [fileProvenance, setFileProvenance] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadFileProvenance = async () => {
      setError(null);
      setLoading(true);
      const protocol = getFileProtocol(fileUrl); // for mixpanel event
      let success = true;
      let provenanceResultType = 'n/a';
      try {
        const provenanceResult = await getFileProvenance(workspace, fileUrl, { signal });
        provenanceResultType = provenanceResult?.type;
        setFileProvenance(provenanceResult);
      } catch (error) {
        setError(error);
        reportError('Error loading file provenance', error);
        success = false;
      } finally {
        setLoading(false);
        void Metrics().captureEvent(Events.provenanceFile, {
          workspaceNamespace: workspace?.workspace?.namespace,
          workspaceName: workspace?.workspace?.name,
          fileProtocol: protocol,
          provenance: provenanceResultType,
          success,
        });
      }
    };

    loadFileProvenance();
  }, [workspace, fileUrl, signal]);

  return {
    fileProvenance,
    loading,
    error,
  };
};
