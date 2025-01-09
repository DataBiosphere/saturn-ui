import _ from 'lodash/fp';
import { Ajax } from 'src/libs/ajax';
import {
  AttributeArray,
  DataTableFeatures,
  DataTableProvider,
  EntityMetadata,
  EntityQueryOptions,
  EntityQueryResponse,
  RecordEditParameters,
  TSVFeatures,
  TsvUploadButtonDisabledOptions,
  TsvUploadButtonTooltipOptions,
  UpdateAttributeParameters,
  UploadParameters,
} from 'src/libs/ajax/data-table-providers/DataTableProvider';
import { LeoAppStatus, ListAppItem } from 'src/libs/ajax/leonardo/models/app-models';
import { Capabilities, Capability } from 'src/libs/ajax/WorkspaceDataService';
import { notificationStore } from 'src/libs/state';
import * as Utils from 'src/libs/utils';
import { notifyDataImportProgress } from 'src/workspace-data/import-jobs';

// interface definitions for WDS payload responses
export interface AttributeSchema {
  name: string;
  datatype: string;
  relatesTo?: string;
}

export interface RecordTypeSchema {
  name: string;
  count: number;
  attributes: AttributeSchema[];
  primaryKey: string;
}

export interface SearchRequest {
  offset: number;
  limit: number;
  sort: 'asc' | 'desc';
  sortAttribute?: string;
  filter?: { ids?: string[]; query?: string };
}

export type RecordAttributes = Record<string, unknown>; // truly "unknown" here; the backend Java representation is Map<String, Object>

export interface RecordResponse {
  id: string;
  type: string;
  attributes: RecordAttributes;
}

export interface RecordQueryResponse {
  searchRequest: SearchRequest;
  totalRecords: number;
  records: RecordResponse[];
}

export interface TsvUploadResponse {
  message: string;
  recordsModified: number;
}

export interface RecordResponseBody {
  id: string;
  type: string;
  attributes: { [attributeName: string]: any };
}

export const wdsToEntityServiceMetadata = (wdsSchema: RecordTypeSchema[]): EntityMetadata => {
  const keyedSchema: Record<string, RecordTypeSchema> = _.keyBy((x) => x.name, wdsSchema);
  return _.mapValues((typeDef) => {
    // exclude the primary-key attribute from the list of attributes. The data table reads
    // the primary-key attribute from the "idName" property.
    const attrs = _.filter((attr) => attr.name !== typeDef.primaryKey, typeDef.attributes);
    return {
      count: typeDef.count,
      attributeNames: _.map((attr) => attr.name, attrs),
      attributes: attrs,
      idName: typeDef.primaryKey,
    };
  }, keyedSchema);
};

export const relationUriScheme = 'terra-wds';

// Callers outside this module should not call this function. It returns a string array of size 2
// iff it looks like a valid relation URI; else it returns an empty array.
// Returning the array prevents callers from string-parsing the URI multiple times.
// This function does not verify that the record type and record id are syntactically
// valid according to WDS - for instance, do they contain special characters?
// WDS should own that logic. Here, we only check if the type and id are nonempty.
const getRelationParts = (val: unknown): string[] => {
  if (_.isString(val) && val.startsWith(`${relationUriScheme}:/`)) {
    const parts: string[] = val.substring(relationUriScheme.length + 2).split('/');
    if (parts.length === 2 && _.every((part) => !!part, parts)) {
      return parts;
    }
    return [];
  }
  return [];
};

// Invokes logic to determine the appropriate app for WDS
// If WDS is not running, a URL will not be present -- in some cases, this function may invoke
// a new call to Leo to instantiate a WDS being available, thus having a valid URL
export const resolveWdsApp = (apps: ListAppItem[]): ListAppItem | undefined => {
  // WDS looks for Kubernetes deployment statuses (such as RUNNING or PROVISIONING), expressed by Leo
  // See here for specific enumerations -- https://github.com/DataBiosphere/leonardo/blob/develop/core/src/main/scala/org/broadinstitute/dsde/workbench/leonardo/kubernetesModels.scala
  // look explicitly for a RUNNING app named 'wds-${app.workspaceId}' -- if WDS is healthy and running, there should only be one app RUNNING
  // an app may be in the 'PROVISIONING', 'UPDATING', 'STOPPED', 'STOPPING', which can still be deemed as an OK state for WDS
  const healthyStates: LeoAppStatus[] = ['RUNNING', 'PROVISIONING', 'UPDATING', 'STOPPED', 'STOPPING'];

  const eligibleApps = apps.filter((app) => app.appType === 'WDS' || app.appType === 'CROMWELL');

  const prioritizedApps = _.sortBy(
    [
      // Prefer WDS app with the proper name
      (app) => (app.appType === 'WDS' && app.appName === `wds-${app.workspaceId}` ? -1 : 1),
      // Prefer WDS apps over CROMWELL apps
      (app) => (app.appType === 'WDS' ? -1 : 1),
      // Prefer running apps
      (app) => (app.status === 'RUNNING' ? -1 : 1),
      // Prefer healthy apps
      (app) => (healthyStates.includes(app.status) ? -1 : 1),
      // Prefer apps created earlier
      (app) => new Date(app.auditInfo?.createdDate).valueOf(),
    ],
    eligibleApps
  );

  return prioritizedApps[0];
};

// Extract wds URL from Leo response. exported for testing
export const resolveWdsUrl = (apps) => {
  const foundApp = resolveWdsApp(apps);
  if (foundApp?.status === 'RUNNING') {
    return foundApp.proxyUrls.wds;
  }
  return '';
};

export const wdsProviderName = 'WDS';

export class WdsDataTableProvider implements DataTableProvider {
  constructor(workspaceId: string, proxyUrl: string, capabilities: Capabilities) {
    this.workspaceId = workspaceId;
    this.proxyUrl = proxyUrl;
    this.capabilities = capabilities;
  }

  providerName: string = wdsProviderName;

  proxyUrl: string;

  workspaceId: string;

  capabilities: Capabilities;

  private isCapabilityEnabled = (capability: Capability): boolean => {
    return !!(this.capabilities && this.capabilities[capability] === true);
  };

  get features(): DataTableFeatures {
    return {
      supportsCapabilities: this.isCapabilityEnabled('capabilities'),
      supportsTsvDownload: false,
      supportsTsvAjaxDownload: true,
      supportsTypeDeletion: true,
      supportsTypeRenaming: false,
      supportsEntityRenaming: false,
      supportsEntityUpdating: true,
      supportsEntityUpdatingTypes: ['string', 'number', 'boolean', 'json'], // remove this as part of AJ-<need to create ticket> for other types
      supportsAttributeRenaming: this.isCapabilityEnabled('edit.renameAttribute'),
      supportsAttributeDeleting: this.isCapabilityEnabled('edit.deleteAttribute'),
      supportsAttributeClearing: false,
      supportsExport: false,
      supportsPointCorrection: false,
      supportsFiltering: this.isCapabilityEnabled('search.filter.query.column.exact'),
      supportsRowSelection: false,
      supportsPerColumnDatatype: true,
    };
  }

  tsvFeatures: TSVFeatures = {
    needsTypeInput: true,
    sampleTSVLink:
      'https://azurefeaturedworkspace.blob.core.windows.net/featuredworkspacedata/template_data_table_Azure.txt',
    dataImportSupportLink: '',
    dataTableSupportLink: '',
    textImportPlaceholder: 'idcolumn(tab)column1(tab)column2...',
    invalidFormatWarning: 'Invalid format: Data does not include sys_name column.',
    isInvalid: (): boolean => {
      // WDS does not have any restrictions on what can be uploaded, as entity_id
      // is not required like in Entity Service for GCP.
      return false;
    },
    disabled: (options: TsvUploadButtonDisabledOptions): boolean => {
      return !options.filePresent || options.uploading || !options.recordTypePresent;
    },
    tooltip: (options: TsvUploadButtonTooltipOptions): string => {
      return Utils.cond(
        [!options.recordTypePresent, () => 'Please enter table name'],
        [!options.filePresent, () => 'Please select valid data to upload'],
        () => 'Upload selected data'
      );
    },
  };

  private maybeTransformRelation = (val: unknown): unknown => {
    const relationParts = getRelationParts(val);
    return relationParts.length ? { entityType: relationParts[0], entityName: relationParts[1] } : val;
  };

  private toEntityServiceArray = (val: unknown[]): AttributeArray => {
    if (val.length && getRelationParts(val[0]).length) {
      // first element of the array looks like a relation. Now, check all elements.
      const translated: string[][] = val.map(getRelationParts);
      if (_.every((parts) => parts.length, translated)) {
        const references = translated.map((parts) => {
          return { entityType: parts[0], entityName: parts[1] };
        });
        return { itemsType: 'EntityReference', items: references };
      }
    }
    // empty array, or the first element isn't a relation; return as attribute values.
    return { itemsType: 'AttributeValue', items: val };
  };

  // transforms a WDS array to Entity Service array format
  protected transformAttributes = (attributes: RecordAttributes, primaryKey: string): RecordAttributes => {
    // the pickBy here excludes the primary-key attribute from the attribute map. The data table reads
    // the primary-key attribute name from the idName of entity metadata, and its value from the entity name.
    // if we included the primary-key attribute in the attribute map, the data table would show a duplicate column.
    return _.pickBy(
      (_v, k) => k !== primaryKey,
      _.mapValues((val) => {
        return _.isArray(val) ? this.toEntityServiceArray(val) : this.maybeTransformRelation(val);
      }, attributes)
    );
  };

  // Copying from https://github.com/bripkens/lucene/blob/master/lib/escaping.js
  // This library is not maintained, but we want the same functionality
  protected prefixCharWithBackslashes = (char: string): string => {
    return `\\${char}`;
  };

  escape = (s: string): string => {
    return s.replace(/[+\-!(){}[\]^"?:\\&|'/\s*~]/g, this.prefixCharWithBackslashes);
  };

  protected transformQuery = (query: string): string => {
    return this.escape(query).replace('=', ':');
  };

  protected queryOptionsToSearchRequest = (queryOptions: EntityQueryOptions): SearchRequest => {
    const baseRequest: SearchRequest = {
      offset: (queryOptions.pageNumber - 1) * queryOptions.itemsPerPage,
      limit: queryOptions.itemsPerPage,
      sort: queryOptions.sortDirection,
    };
    if (queryOptions.sortField !== 'name') baseRequest.sortAttribute = queryOptions.sortField;
    if (queryOptions.columnFilter !== '')
      baseRequest.filter = { query: this.transformQuery(queryOptions.columnFilter) };
    return baseRequest;
  };

  protected transformPage = (
    wdsPage: RecordQueryResponse,
    recordType: string,
    queryOptions: EntityQueryOptions,
    metadata: EntityMetadata
  ): EntityQueryResponse => {
    // translate WDS to Entity Service
    const filteredCount = wdsPage.totalRecords;
    const unfilteredCount = wdsPage.totalRecords;
    const primaryKey = metadata[recordType] ? metadata[recordType].idName : '(unknown column)'; // for safety; recordType should always be present
    const results = _.map((rec) => {
      return {
        entityType: recordType,
        attributes: this.transformAttributes(rec.attributes, primaryKey),
        name: rec.id,
      };
    }, wdsPage.records);

    return {
      results,
      parameters: {
        page: queryOptions.pageNumber,
        pageSize: queryOptions.itemsPerPage,
        sortField: queryOptions.sortField,
        sortDirection: queryOptions.sortDirection,
        filterTerms: '', // unused so it doesn't matter
        filterOperator: 'and', // unused so it doesn't matter
      },
      resultMetadata: {
        filteredCount,
        unfilteredCount,
        filteredPageCount: -1, // unused so it doesn't matter
      },
    };
  };

  getPage = async (
    signal: AbortSignal,
    entityType: string,
    queryOptions: EntityQueryOptions,
    metadata: EntityMetadata
  ): Promise<EntityQueryResponse> => {
    if (!this.proxyUrl) return Promise.reject('Proxy Url not loaded');
    const wdsPage: RecordQueryResponse = await Ajax(signal).WorkspaceData.getRecords(
      this.proxyUrl,
      this.workspaceId,
      entityType,
      this.queryOptionsToSearchRequest(queryOptions)
    );
    return this.transformPage(wdsPage, entityType, queryOptions, metadata);
  };

  deleteTable = (entityType: string): Promise<Response> => {
    if (!this.proxyUrl) return Promise.reject('Proxy Url not loaded');
    return Ajax().WorkspaceData.deleteTable(this.proxyUrl, this.workspaceId, entityType);
  };

  deleteColumn = (signal: AbortSignal, entityType: string, attributeName: string): Promise<Response> => {
    if (!this.proxyUrl) return Promise.reject('Proxy URL not loaded');
    return Ajax(signal).WorkspaceData.deleteColumn(this.proxyUrl, this.workspaceId, entityType, attributeName);
  };

  downloadTsv = (signal: AbortSignal, entityType: string): Promise<Blob> => {
    if (!this.proxyUrl) return Promise.reject('Proxy Url not loaded');
    return Ajax(signal).WorkspaceData.downloadTsv(this.proxyUrl, this.workspaceId, entityType);
  };

  uploadTsv = (uploadParams: UploadParameters): Promise<TsvUploadResponse> => {
    if (!this.proxyUrl) return Promise.reject('Proxy Url not loaded');
    setTimeout(() => {
      if (
        notificationStore.get().length === 0 ||
        !notificationStore
          .get()
          .some((notif: { id: string }) =>
            [uploadParams.recordType, `${uploadParams.recordType}_success`].includes(notif.id)
          )
      ) {
        notifyDataImportProgress(
          uploadParams.recordType,
          'Your data will show up under Tables once import is complete.'
        );
      }
    }, 1000);
    return Ajax().WorkspaceData.uploadTsv(
      this.proxyUrl,
      uploadParams.workspaceId,
      uploadParams.recordType,
      uploadParams.file
    );
  };

  updateRecord = (recordEditParams: RecordEditParameters): Promise<RecordResponseBody> => {
    if (!this.proxyUrl) return Promise.reject('Proxy Url not loaded');

    return Ajax().WorkspaceData.updateRecord(
      this.proxyUrl,
      recordEditParams.instance,
      recordEditParams.recordName,
      recordEditParams.recordId,
      recordEditParams.record
    );
  };

  updateAttribute = (params: UpdateAttributeParameters): Promise<Blob> => {
    if (!this.proxyUrl) return Promise.reject('Proxy Url not loaded');
    return Ajax().WorkspaceData.updateAttribute(
      this.proxyUrl,
      this.workspaceId,
      params.entityType,
      params.oldAttributeName,
      {
        name: params.newAttributeName,
      }
    );
  };
}
