import _ from 'lodash/fp';
import { Fragment, ReactNode } from 'react';
import { h, p } from 'react-hyperscript-helpers';
import { Link } from 'src/components/common';
import { WorkspaceData } from 'src/libs/ajax/WorkspaceDataService';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import { withErrorReporting } from 'src/libs/error';
import { clearNotification, notify } from 'src/libs/notifications';
import { useCancellation, usePollingEffect, useStore } from 'src/libs/react-utils';
import { AsyncImportJob, asyncImportJobStore } from 'src/libs/state';
import * as Utils from 'src/libs/utils';

const ImportStatus = () => {
  const jobs = useStore(asyncImportJobStore);
  return h(
    Fragment,
    _.map(
      (job) =>
        h(ImportStatusItem, {
          key: job.jobId,
          job,
          onDone: () => {
            asyncImportJobStore.update(_.reject(job));
          },
        }),
      _.uniq(jobs)
    )
  );
};

interface ImportStatusItemProps {
  job: AsyncImportJob;
  onDone: () => void;
}

const ImportStatusItem = (props: ImportStatusItemProps): ReactNode => {
  const signal = useCancellation();
  const {
    job: { targetWorkspace, jobId },
    onDone,
  } = props;
  let wdsProxyUrl: string | undefined;

  // Only have wdsProxyUrl if job is an instance of AzureAsyncImportJob
  if ('wdsProxyUrl' in props.job) {
    wdsProxyUrl = props.job.wdsProxyUrl;
  }

  usePollingEffect(
    withErrorReporting('Problem checking status of data import')(async () => {
      await checkForCompletion(targetWorkspace, jobId, wdsProxyUrl);
    }),
    { ms: 5000, leading: false }
  );

  const checkForCompletion = async ({ namespace, name }, jobId: string, wdsProxyUrl?: string | undefined) => {
    const fetchImportStatus = async () => {
      try {
        if (wdsProxyUrl) {
          return await WorkspaceData(signal).getJobStatus(wdsProxyUrl, jobId);
        }
        return await Workspaces(signal).workspace(namespace, name).getImportJobStatus(jobId);
      } catch (error: unknown) {
        // Ignore 404; We're probably asking for status before the status endpoint knows about the job
        if (error instanceof Response && error.status === 404) {
          return { status: 'PENDING' };
        }
        onDone();
        throw error;
      }
    };

    // In case of error, GCP workspaces will have 'message', Azure will have 'errorMessage'
    const response = await fetchImportStatus();
    const { message, errorMessage, status } = response;
    const notificationMessage = message || errorMessage;

    const successNotify = () =>
      notify('success', 'Data imported successfully.', {
        message: h(Fragment, [
          p([`Data import to workspace "${namespace} / ${name}" is complete. Please refresh the Data view.`]),
          p([
            `If data is imported from external sources like PFB or TDR, prefixes ("pfb:" or tdr:" respectively)
        may be prepended to column names. If present, prefix values must be included in workflow configuration
        attribute references as described `,
            h(
              Link,
              {
                'aria-label': 'Support article',
                href: 'https://support.terra.bio/hc/en-us/articles/360051722371-Data-table-attribute-namespace-support-pfb-prefix-#h_01ENT95Y0KM48QFRMJ44DEXS7S',
                ...Utils.newTabLinkProps,
              },
              ['here.']
            ),
          ]),
        ]),
      });

    const errorNotify = () => notify('error', 'Error importing data.', { message: notificationMessage });

    // GCP/import service statuses: Pending, Translating, ReadyForUpsert, Upserting, Done, Error
    // Azure/WDS import statuses: CREATED, QUEUED, RUNNING, SUCCEEDED, ERROR, CANCELLED, UNKNOWN

    if (
      !_.includes(status, ['Pending', 'Translating', 'ReadyForUpsert', 'Upserting', 'RUNNING', 'CREATED', 'QUEUED'])
    ) {
      Utils.switchCase(
        status,
        ['Done', successNotify],
        ['SUCCEEDED', successNotify],
        ['Error', errorNotify],
        ['ERROR', errorNotify],
        [Utils.DEFAULT, () => notify('error', 'Unexpected error importing data', response)]
      );
      clearNotification(jobId);
      onDone();
    }
  };

  return null;
};

export default ImportStatus;
