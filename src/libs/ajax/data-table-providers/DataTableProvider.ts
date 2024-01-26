// define metadata structures
export interface EntityTypeMetadata {
  attributeNames: string[];
  count: number;
  idName: string;
}

export interface EntityMetadata {
  [index: string]: EntityTypeMetadata;
}

export type EntityQuerySortDirection = 'asc' | 'desc';

export type EntityQueryFilterOperator = 'and' | 'or';

// define paginated query result structures
interface EntityQuery {
  page: number;
  pageSize: number;
  sortField: string;
  sortDirection: EntityQuerySortDirection;
  filterTerms: string;
  filterOperator: EntityQueryFilterOperator;
}
interface EntityQueryResultMetadata {
  unfilteredCount: number;
  filteredCount: number;
  filteredPageCount: number;
}
interface Entity {
  name: string;
  entityType: string;
  attributes: Record<string, any>;
}

export interface EntityQueryResponse {
  parameters: EntityQuery;
  resultMetadata: EntityQueryResultMetadata;
  results: Entity[];
}

export interface EntityQueryOptions {
  pageNumber: number;
  itemsPerPage: number;
  sortField: string;
  sortDirection: EntityQuerySortDirection;
  snapshotName: string;
  googleProject: string;
  activeTextFilter: string;
  filterOperator: string;
  columnFilter: string;
}

export type UploadParameters = {
  file: File;
  useFireCloudDataModel: boolean;
  deleteEmptyValues: boolean;
  namespace: string;
  name: string;
  workspaceId: string;
  recordType: string;
};

export type RecordEditParameters = {
  instance: string;
  recordName: string;
  recordId: string;
  record: object;
};

export type InvalidTsvOptions = {
  fileImportModeMatches: boolean;
  filePresent: boolean;
  match: boolean;
};

export type TsvUploadButtonDisabledOptions = {
  filePresent: boolean;
  isInvalid?: boolean;
  uploading: boolean;
  recordTypePresent: boolean;
};

export type TsvUploadButtonTooltipOptions = {
  filePresent: boolean;
  isInvalid?: boolean;
  recordTypePresent: boolean;
};

export interface AttributeArray {
  itemsType: 'AttributeValue' | 'EntityReference';
  items: unknown[]; // truly "unknown" here; the backend Java representation is Object[]
}

// queryOptions can contain:
export type GetPageFn = (
  signal: AbortSignal,
  entityType: string,
  queryOptions: EntityQueryOptions,
  metadata: EntityMetadata
) => Promise<EntityQueryResponse>;

export type GetMetadataFn = (signal: AbortSignal) => Promise<EntityMetadata>;

export type DeleteTableFn = (entityType: string) => Promise<Response>;

export type DownloadTsvFn = (signal: AbortSignal, entityType: string) => Promise<Blob>;

export type IsInvalidTsvFn = (options: InvalidTsvOptions) => boolean;

export type IsTsvUploadButtonDisabledFn = (options: TsvUploadButtonDisabledOptions) => boolean;

export type TsvUploadButtonTooltipFn = (options: TsvUploadButtonTooltipOptions) => string;

export type UploadTsvFn = (uploadParams: UploadParameters) => Promise<any>;

export interface DataTableFeatures {
  supportsCapabilities: boolean;
  supportsTsvDownload: boolean;
  supportsTsvAjaxDownload: boolean;
  supportsTypeDeletion: boolean;
  supportsTypeRenaming: boolean;
  supportsEntityRenaming: boolean;
  supportsEntityUpdating: boolean;
  supportsAttributeRenaming: boolean;
  supportsAttributeDeleting: boolean;
  supportsAttributeClearing: boolean;
  supportsExport: boolean;
  supportsPointCorrection: boolean;
  supportsFiltering: boolean;
  supportsRowSelection: boolean;
}

export interface TSVFeatures {
  needsTypeInput: boolean;
  sampleTSVLink: string;
  dataImportSupportLink: string;
  dataTableSupportLink: string;
  invalidFormatWarning?: string;
  textImportPlaceholder: string;
  isInvalid: IsInvalidTsvFn;
  disabled: IsTsvUploadButtonDisabledFn;
  tooltip: TsvUploadButtonTooltipFn;
}

export interface DataTableProvider {
  providerName: string;
  features: DataTableFeatures;
  tsvFeatures: TSVFeatures;
  getPage: GetPageFn;
  deleteTable: DeleteTableFn;
  downloadTsv: DownloadTsvFn;
  uploadTsv: UploadTsvFn;
  // todos that we may need soon:
  // getMetadata: GetMetadataFn
  // updateAttribute: function, see also boolean
}
