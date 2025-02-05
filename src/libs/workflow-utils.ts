import FileSaver from 'file-saver';
import { List } from 'lodash';
import _ from 'lodash/fp';
import { Workflow } from 'src/libs/ajax/workspaces/workspace-models';
import * as Utils from 'src/libs/utils';

export const workflowNameValidation = () => {
  return {
    presence: { allowEmpty: false },
    length: { maximum: 254 },
    format: {
      pattern: /^[A-Za-z0-9_\-.]*$/,
      message: 'can only contain letters, numbers, underscores, dashes, and periods',
    },
  };
};

export const getWorkflowInputSuggestionsForAttributesOfSetMembers = (selectedEntities, entityMetadata) => {
  return _.flow(
    // Collect attributes of selected entities
    _.values,
    _.flatMap(_.flow(_.get('attributes'), _.toPairs)),
    // Find attributes that reference other entities
    _.filter(([_attributeName, attributeValue]) => _.get('itemsType', attributeValue) === 'EntityReference'),
    // Find all entity types that are referenced by each attribute
    _.flatMap(([attributeName, { items }]) => {
      return _.flow(
        _.map(_.get('entityType')),
        _.uniq,
        _.map((entityType) => [attributeName, entityType])
      )(items);
    }),
    _.uniqBy(([attributeName, entityType]) => `${attributeName}|${entityType}`),
    // Use entity metadata to list attributes for each referenced entity type
    _.flatMap(([attributeName, entityType]) => {
      return _.flow(
        _.over([_.get([entityType, 'attributeNames']), _.get([entityType, 'idName'])]),
        _.spread(_.concat),
        _.map((nestedAttributeName) => `this.${attributeName}.${nestedAttributeName}`)
      )(entityMetadata);
    }),
    // Sort and remove duplicates
    _.sortBy(_.identity),
    _.sortedUniq
  )(selectedEntities);
};

export const ioTask = (ioName) => _.nth(-2, ioName.split('.'));
export const ioVariable = (ioName) => _.nth(-1, ioName.split('.'));

export const downloadIO = (io, filename) => {
  const prepIO = _.mapValues((v: string) => (/^".*"/.test(v) ? v.slice(1, -1) : `\${${v}}`));

  const blob = new Blob([JSON.stringify(prepIO(io))], { type: 'application/json' });
  FileSaver.saveAs(blob, `${filename}.json`);
};

export const downloadWorkflows = (rows: List<Workflow>, filename: any) => {
  const headers = _.keys(_.head(rows));

  const stringifiedRows = _.map((row: Workflow) => {
    return _.map((header) => {
      const value = row[header];
      return _.isObject(value) ? JSON.stringify(value) : value;
    }, headers);
  }, _.sortBy('workflowEntity', rows));

  const rowsAndHeaders = [headers, ...stringifiedRows];

  // Shifts the workflowId column to the first column in the TSV
  const workflowIdIndex = _.indexOf('workflowId', headers);
  const reorderedTSVContents = _.map(
    (row) => [
      ..._.slice(workflowIdIndex, workflowIdIndex + 1, row), // the workflowId column itself
      ..._.slice(0, workflowIdIndex, row), // the columns originally before the workflowId col
      ..._.slice(workflowIdIndex + 1, _.size(row), row), // the columns originally after the workflowId col
    ],
    rowsAndHeaders
  );

  const blob = new Blob([Utils.makeTSV(reorderedTSVContents)], { type: 'text/tab-separated-values' });
  FileSaver.saveAs(blob, `${filename}.tsv`);
};

export enum WorkflowTableColumnNames {
  INPUT_VALUE = 'Input value',
  OUTPUT_NAME = 'Output name',
}
