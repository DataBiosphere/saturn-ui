import _ from 'lodash/fp';
import {
  DataTableFeatures,
  DataTableProvider,
  EntityMetadata,
  EntityQueryOptions,
  EntityQueryResponse,
  InvalidTsvOptions,
  TSVFeatures,
  TsvUploadButtonDisabledOptions,
  TsvUploadButtonTooltipOptions,
  UpdateAttributeParameters,
  UploadParameters,
} from 'src/libs/ajax/data-table-providers/DataTableProvider';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import { asyncImportJobStore } from 'src/libs/state';
import * as Utils from 'src/libs/utils';
import { notifyDataImportProgress } from 'src/workspace-data/import-jobs';

export class EntityServiceDataTableProvider implements DataTableProvider {
  constructor(namespace: string, name: string) {
    this.namespace = namespace;
    this.name = name;
  }

  providerName = 'Entity Service';

  namespace: string;

  name: string;

  features: DataTableFeatures = {
    supportsCapabilities: false,
    supportsTsvDownload: true,
    supportsTsvAjaxDownload: false,
    supportsTypeDeletion: true,
    supportsTypeRenaming: true,
    supportsEntityRenaming: true,
    supportsEntityUpdating: true,
    supportsAttributeRenaming: true,
    supportsAttributeDeleting: true,
    supportsAttributeClearing: true,
    supportsExport: true,
    supportsPointCorrection: true,
    supportsFiltering: true,
    supportsRowSelection: true,
    supportsPerColumnDatatype: false,
  };

  tsvFeatures: TSVFeatures = {
    needsTypeInput: false,
    sampleTSVLink:
      'https://storage.googleapis.com/terra-featured-workspaces/Table_templates/2-template_sample-table.tsv',
    dataImportSupportLink: 'https://support.terra.bio/hc/en-us/articles/360059242671',
    dataTableSupportLink: 'https://support.terra.bio/hc/en-us/articles/360025758392',
    textImportPlaceholder: 'entity:participant_id(tab)column1(tab)column2...',
    invalidFormatWarning:
      'Invalid format: First column header must be an identifier or have the prefix "entity:", "membership:", or "update:"',
    isInvalid: (options: InvalidTsvOptions): boolean => {
      return options.fileImportModeMatches && options.filePresent && options.match;
    },
    disabled: (options: TsvUploadButtonDisabledOptions): boolean => {
      return !options.filePresent || options.isInvalid || options.uploading;
    },
    tooltip: (options: TsvUploadButtonTooltipOptions): string => {
      return !options.filePresent || options.isInvalid ? 'Please select valid data to upload' : 'Upload selected data';
    },
  };

  getPage = (
    signal: AbortSignal,
    entityType: string,
    queryOptions: EntityQueryOptions,
    _metadata: EntityMetadata
  ): Promise<EntityQueryResponse> => {
    return Workspaces(signal)
      .workspace(this.namespace, this.name)
      .paginatedEntitiesOfType(
        entityType,
        _.pickBy((v) => _.trim(v?.toString()), {
          page: queryOptions.pageNumber,
          pageSize: queryOptions.itemsPerPage,
          sortField: queryOptions.sortField,
          sortDirection: queryOptions.sortDirection,
          ...(queryOptions.snapshotName
            ? { billingProject: queryOptions.googleProject, dataReference: queryOptions.snapshotName }
            : {
                filterTerms: queryOptions.activeTextFilter,
                filterOperator: queryOptions.filterOperator,
                columnFilter: queryOptions.columnFilter,
              }),
        })
      );
  };

  deleteTable = (entityType: string): Promise<Response> => {
    return Workspaces().workspace(this.namespace, this.name).deleteEntitiesOfType(entityType);
  };

  deleteColumn = (signal: AbortSignal, entityType: string, attributeName: string): Promise<Response> => {
    return Workspaces(signal).workspace(this.namespace, this.name).deleteEntityColumn(entityType, attributeName);
  };

  downloadTsv = (signal: AbortSignal, entityType: string): Promise<Blob> => {
    return Workspaces(signal).workspace(this.namespace, this.name).getEntitiesTsv(entityType);
  };

  uploadTsv = async (uploadParams: UploadParameters): Promise<any> => {
    const workspace = Workspaces().workspace(uploadParams.namespace, uploadParams.name);
    if (uploadParams.useFireCloudDataModel) {
      return workspace.importEntitiesFile(uploadParams.file, { deleteEmptyValues: uploadParams.deleteEmptyValues });
    }
    const filesize = uploadParams.file?.size || Number.MAX_SAFE_INTEGER;
    if (filesize < 524288) {
      // 512k
      return workspace.importFlexibleEntitiesFileSynchronous(uploadParams.file, {
        deleteEmptyValues: uploadParams.deleteEmptyValues,
      });
    }
    const { jobId } = await workspace.importFlexibleEntitiesFileAsync(uploadParams.file, {
      deleteEmptyValues: uploadParams.deleteEmptyValues,
    });
    asyncImportJobStore.update(
      Utils.append({ targetWorkspace: { namespace: uploadParams.namespace, name: uploadParams.name }, jobId })
    );
    notifyDataImportProgress(jobId, 'Data will show up incrementally as the job progresses.');
  };

  updateAttribute = async (updateAttrParams: UpdateAttributeParameters): Promise<any> => {
    return Workspaces()
      .workspace(this.namespace, this.name)
      .renameEntityColumn(
        updateAttrParams.entityType,
        updateAttrParams.oldAttributeName,
        updateAttrParams.newAttributeName
      );
  };
}
