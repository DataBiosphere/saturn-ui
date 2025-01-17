import { delay } from '@terra-ui-packages/core-utils';
import { useEffect, useState } from 'react';
import { DataRepo, Snapshot } from 'src/libs/ajax/DataRepo';
import { SamResources } from 'src/libs/ajax/SamResources';
import { isFeaturePreviewEnabled } from 'src/libs/feature-previews';
import { ENABLE_AZURE_TDR_IMPORT } from 'src/libs/feature-previews-config';
import { useRoute } from 'src/libs/nav';

import {
  CatalogDatasetImportRequest,
  FileImportRequest,
  ImportRequest,
  TDRSnapshotExportImportRequest,
  TDRSnapshotReferenceImportRequest,
} from './import-types';

type QueryParams = { [key: string]: unknown };

/**
 * Validate that a value is a string. Throw an error if it is not.
 *
 * @param value The value to validate.
 * @param label Label for the value to use in error messages.
 * @returns The validated string value.
 */
const requireString = (value: unknown, label = 'value'): string => {
  if (value === undefined || value === null) {
    throw new Error(`A ${label} is required`);
  }
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return value;
};

/**
 * Validate that a value can be parsed as a URL. Throw an error if it cannot.
 *
 * @param value The value to validate.
 * @param label Label for the value to use in error messages.
 * @returns The parsed URL.
 */
const requireUrl = (value: unknown, label = 'value'): URL => {
  const stringValue = requireString(value, label);
  try {
    return new URL(stringValue);
  } catch {
    throw new Error(`Invalid ${label}: ${value}`);
  }
};

/**
 * Get the requested import format from query parameters. Default to 'bagit' if none is specified.
 *
 * @param queryParams Query parameters from import request.
 * @returns Requested import format.
 */
const getFormat = (queryParams: QueryParams): string => {
  const { format } = queryParams;
  if (format === undefined) {
    return 'bagit';
  }
  if (typeof format !== 'string') {
    throw new Error(`Invalid format: ${format}`);
  }
  return format.toLowerCase();
};

const getFileImportRequest = (queryParams: QueryParams, type: FileImportRequest['type']): FileImportRequest => {
  const url = requireUrl(queryParams.url, 'URL');
  return { type, url };
};

/**
 * Generate a snapshot manifest on demand for importing a TDR snapshot.
 */
const generateSnapshotManifest = async (snapshotId: string): Promise<URL> => {
  const { id } = await DataRepo().snapshot(snapshotId).exportSnapshot();
  const jobApi = DataRepo().job(id);
  let jobInfo = await jobApi.details();
  while (jobInfo.job_status === 'running') {
    await delay(1000);
    jobInfo = await jobApi.details();
  }
  if (jobInfo.job_status !== 'succeeded') {
    throw new Error(`Failed to generate manifest for snapshot ${id}.`);
  }
  const jobResult = await jobApi.result();
  // @ts-ignore - this has an unknown response type, but in this case it should
  // include these fields
  return jobResult?.format?.parquet?.manifest;
};

const getTDRSnapshotExportImportRequest = async (queryParams: QueryParams): Promise<TDRSnapshotExportImportRequest> => {
  const snapshotId = requireString(queryParams.snapshotId, 'snapshot ID');
  const syncPermissions = queryParams.tdrSyncPermissions === 'true';

  const { tdrmanifest } = queryParams;
  const manifestUrl = tdrmanifest
    ? requireUrl(tdrmanifest, 'manifest URL')
    : await generateSnapshotManifest(snapshotId);

  let snapshot: Snapshot;
  let snapshotAccessControls: string[];
  try {
    [snapshot, snapshotAccessControls] = await Promise.all([
      DataRepo().snapshot(snapshotId).details(),
      SamResources().getAuthDomains({ resourceTypeName: 'datasnapshot', resourceId: snapshotId }),
    ]);
  } catch (err: unknown) {
    throw new Error('Unable to load snapshot.');
  }

  if (snapshot.cloudPlatform === 'azure' && !isFeaturePreviewEnabled(ENABLE_AZURE_TDR_IMPORT)) {
    throw new Error('Importing Azure snapshots is not supported.');
  }

  return {
    type: 'tdr-snapshot-export',
    manifestUrl,
    snapshot,
    snapshotAccessControls,
    syncPermissions,
  };
};

const getTDRSnapshotReferenceImportRequest = async (
  queryParams: QueryParams
): Promise<TDRSnapshotReferenceImportRequest> => {
  const snapshotId = requireString(queryParams.snapshotId, 'snapshot ID');

  let snapshot: Snapshot;
  let snapshotAccessControls: string[];
  try {
    [snapshot, snapshotAccessControls] = await Promise.all([
      DataRepo().snapshot(snapshotId).details(),
      SamResources().getAuthDomains({ resourceTypeName: 'datasnapshot', resourceId: snapshotId }),
    ]);
  } catch (err: unknown) {
    throw new Error('Unable to load snapshot.');
  }

  if (snapshot.cloudPlatform === 'azure') {
    throw new Error('Importing by reference is not supported for Azure snapshots.');
  }

  return {
    type: 'tdr-snapshot-reference',
    snapshot,
    snapshotAccessControls,
  };
};

const getCatalogDatasetImportRequest = (queryParams: QueryParams): CatalogDatasetImportRequest => {
  const datasetId = requireString(queryParams.catalogDatasetId, 'dataset ID');
  return {
    type: 'catalog-dataset',
    datasetId,
  };
};

export const getImportRequest = (queryParams: QueryParams): Promise<ImportRequest> => {
  const format = getFormat(queryParams);

  switch (format) {
    case 'pfb':
      return Promise.resolve(getFileImportRequest(queryParams, 'pfb'));
    case 'bagit':
      return Promise.resolve(getFileImportRequest(queryParams, 'bagit'));
    case 'entitiesjson':
      return Promise.resolve(getFileImportRequest(queryParams, 'entities'));
    case 'tdrexport':
      return getTDRSnapshotExportImportRequest(queryParams);
    case 'snapshot':
      return getTDRSnapshotReferenceImportRequest(queryParams);
    case 'catalog':
      return Promise.resolve(getCatalogDatasetImportRequest(queryParams));
    default:
      throw new Error(`Invalid format: ${format}`);
  }
};

export type UseImportRequestResult =
  | { status: 'Loading'; message?: string }
  | { status: 'Ready'; importRequest: ImportRequest }
  | { status: 'Error'; error: Error };

/**
 * For each format that takes a long time to prepare, define a message to display while the import request is being loaded.
 */
const messages = {
  tdrexport: 'Preparing your snapshot for import.',
};

export const useImportRequest = (): UseImportRequestResult => {
  const { query } = useRoute();
  const message = messages[query.format];

  const [result, setResult] = useState<UseImportRequestResult>({ status: 'Loading', message });
  useEffect(() => {
    (async () => {
      try {
        setResult({ status: 'Loading', message });
        const importRequest = await getImportRequest(query);
        setResult({ status: 'Ready', importRequest });
      } catch (originalError: unknown) {
        const error = originalError instanceof Error ? originalError : new Error('Unknown error');
        setResult({ status: 'Error', error });
      }
    })();
  }, [JSON.stringify(query)]); // eslint-disable-line react-hooks/exhaustive-deps

  return result;
};
