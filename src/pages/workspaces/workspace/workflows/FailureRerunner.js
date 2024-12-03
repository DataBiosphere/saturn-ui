import { Spinner } from '@terra-ui-packages/components';
import { delay } from '@terra-ui-packages/core-utils';
import _ from 'lodash/fp';
import { div, h } from 'react-hyperscript-helpers';
import { icon } from 'src/components/icons';
import { Metrics } from 'src/libs/ajax/Metrics';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import { launch } from 'src/libs/analysis';
import colors from 'src/libs/colors';
import { reportError } from 'src/libs/error';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import { clearNotification, notify } from 'src/libs/notifications';
import { useStore } from 'src/libs/react-utils';
import { rerunFailuresStatus } from 'src/libs/state';
import * as Utils from 'src/libs/utils';

const ToastMessageComponent = () => {
  const { done, text } = useStore(rerunFailuresStatus);
  return div({ style: { padding: '0.5rem 0', display: 'flex', alignItems: 'center', fontSize: 14 } }, [
    done
      ? icon('success-standard', { size: 24, style: { color: colors.success(), marginRight: '1rem' } })
      : h(Spinner, { style: { marginRight: '1rem' } }),
    text,
  ]);
};

export const rerunFailures = async ({
  workspace,
  workspace: {
    workspace: { namespace, name },
  },
  submissionId,
  configNamespace,
  configName,
  onDone,
}) => {
  rerunFailuresStatus.set({ text: 'Loading workflow info...' });
  const id = notify('info', h(ToastMessageComponent));
  const eventData = { ...extractWorkspaceDetails(workspace), configNamespace, configName };

  try {
    const [{ workflows, useCallCache, deleteIntermediateOutputFiles, useReferenceDisks, memoryRetryMultiplier, userComment }, config] =
      await Promise.all([
        Workspaces().workspace(namespace, name).submission(submissionId).get(),
        Workspaces().workspace(namespace, name).methodConfig(configNamespace, configName).get(),
      ]);

    await launch({
      workspace,
      config,
      selectedEntityType: config.rootEntityType,
      selectedEntityNames: _.flow(
        _.filter((v) => v.status === 'Aborted' || v.status === 'Failed'),
        _.map('workflowEntity.entityName')
      )(workflows),
      newSetName: Utils.sanitizeEntityName(`${configName}-resubmission-${new Date().toISOString().slice(0, -5)}`),
      useCallCache,
      deleteIntermediateOutputFiles,
      useReferenceDisks,
      memoryRetryMultiplier,
      userComment,
      onProgress: (stage) => {
        rerunFailuresStatus.set({
          text: { createSet: 'Creating set from failures...', launch: 'Launching new job...', checkBucketAccess: 'Checking bucket access...' }[stage],
        });
      },
    });
    rerunFailuresStatus.set({ text: 'Success!', done: true });
    onDone();
    void Metrics().captureEvent(Events.workflowRerun, { ...eventData, success: true });

    await delay(2000);
  } catch (error) {
    void Metrics().captureEvent(Events.workflowRerun, { ...eventData, success: false });
    reportError('Error rerunning failed workflows', error);
  } finally {
    clearNotification(id);
  }
};
