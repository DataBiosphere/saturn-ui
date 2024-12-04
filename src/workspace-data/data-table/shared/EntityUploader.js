import { Modal, TooltipTrigger } from '@terra-ui-packages/components';
import { readFileAsText } from '@terra-ui-packages/core-utils';
import _ from 'lodash/fp';
import { Fragment, useState } from 'react';
import { div, h, p, span } from 'react-hyperscript-helpers';
import { cloudProviders } from 'src/analysis/utils/runtime-utils';
import { ButtonPrimary, Clickable, LabeledCheckbox, Link, RadioButton } from 'src/components/common';
import Dropzone from 'src/components/Dropzone';
import { icon } from 'src/components/icons';
import { PasteOnlyInput, ValidatedInput } from 'src/components/input';
import { getRegionInfo, locationTypes } from 'src/components/region-common';
import { SimpleTabBar } from 'src/components/tabBars';
import { Ajax } from 'src/libs/ajax';
import { wdsProviderName } from 'src/libs/ajax/data-table-providers/WdsDataTableProvider';
import { getRegionFlag, getRegionLabel } from 'src/libs/azure-utils';
import colors from 'src/libs/colors';
import { reportError } from 'src/libs/error';
import Events from 'src/libs/events';
import { FormLabel } from 'src/libs/forms';
import { clearNotification, notify } from 'src/libs/notifications';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';
import validate from 'validate.js';

const errorTextStyle = { color: colors.danger(), fontWeight: 'bold', fontSize: 12, marginTop: '0.5rem' };

const supportsFireCloudDataModel = (entityType) => _.includes(entityType, ['pair', 'participant', 'sample']);

/** Use the first column heading in the TSV as a suggested name for the table. */
export const getSuggestedTableName = (tsv) => {
  const indexOfFirstSpace = tsv.search(/\s/);
  if (indexOfFirstSpace === -1) {
    return undefined;
  }
  const firstColumnHeading = tsv.slice(0, indexOfFirstSpace);
  return firstColumnHeading.replace(/_id$/, '').replace(/^(membership|entity):/, '');
};

export const EntityUploader = ({ onSuccess, onDismiss, namespace, name, entityTypes, workspaceId, dataProvider, isGoogleWorkspace, region }) => {
  const [useFireCloudDataModel, setUseFireCloudDataModel] = useState(false);
  const [isFileImportCurrMode, setIsFileImportCurrMode] = useState(true);
  const [isFileImportLastUsedMode, setIsFileImportLastUsedMode] = useState(undefined);
  const [file, setFile] = useState(undefined);
  const [fileContents, setFileContents] = useState('');
  const [showInvalidEntryMethodWarning, setShowInvalidEntryMethodWarning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteEmptyValues, setDeleteEmptyValues] = useState(false);
  const [recordType, setRecordType] = useState('');
  const [recordTypeInputTouched, setRecordTypeInputTouched] = useState(false);

  // Google workspace regions are hardcoded for now, as GCP uploads to the Rawls service which is only on uscentral-1
  const rawlsRegion = getRegionInfo('US-CENTRAL1', locationTypes.region);
  const regionLabelToDisplay = isGoogleWorkspace ? rawlsRegion.regionDescription : getRegionLabel(region);
  const regionFlagToDisplay = isGoogleWorkspace ? rawlsRegion.flag : getRegionFlag(region);

  const doUpload = async () => {
    setUploading(true);
    try {
      const isSyncUpload = !!(await dataProvider.uploadTsv({
        workspaceId,
        recordType,
        file,
        useFireCloudDataModel,
        deleteEmptyValues,
        namespace,
        name,
      }));
      onSuccess(recordType);
      // Show success message only for synchronous Google Workspace uploads
      isSyncUpload &&
        isGoogleWorkspace &&
        notify('success', `Data imported successfully to table ${recordType}.`, {
          id: `${recordType}_success`,
        });
      clearNotification(recordType);
      Ajax().Metrics.captureEvent(Events.workspaceDataUpload, {
        workspaceNamespace: namespace,
        workspaceName: name,
        providerName: dataProvider.providerName,
        cloudPlatform: dataProvider.providerName === wdsProviderName ? cloudProviders.azure.label : cloudProviders.gcp.label,
      });
    } catch (error) {
      await reportError('Error uploading entities', error);
      onDismiss();
    }
  };

  const recordTypeNameErrors = validate.single(recordType, {
    presence: {
      allowEmpty: false,
      message: 'Table name is required',
    },
    format: {
      pattern: '^(?!sys_)[a-z0-9_.-]*',
      flags: 'i',
      message: "Table name may only contain alphanumeric characters, underscores, dashes, and periods and cannot start with 'sys_'.",
    },
  });

  const extractEntityType = (text) => {
    // get the first line
    const firstLine = text.split(/\r?\n/)[0];
    // get the first column header
    const header = firstLine.split(/\t/)[0];
    // strip legal prefixes
    const unprefixed =
      header.startsWith('entity:') || header.startsWith('membership:') || header.startsWith('update:')
        ? header.substring(header.indexOf(':') + 1)
        : header;
    // strip legal suffixes
    const unsuffixed = unprefixed.endsWith('_id') ? unprefixed.slice(0, -3) : unprefixed;
    // validate legality
    const match = /^([a-zA-Z_-]+)$/.exec(unsuffixed);
    return match?.[1];
  };

  const newEntityType = extractEntityType(fileContents);
  const isInvalid = dataProvider.tsvFeatures.isInvalid({
    fileImportModeMatches: isFileImportCurrMode === isFileImportLastUsedMode,
    match: !newEntityType,
    filePresent: file,
  });

  const entityTypeAlreadyExists = _.includes(_.toLower(newEntityType), entityTypes);
  const currentFile = isFileImportCurrMode === isFileImportLastUsedMode ? file : undefined;
  const containsNullValues = fileContents.match(/^\t|\t\t+|\t$|\n\n+/gm);

  return h(
    Dropzone,
    {
      multiple: false,
      style: { flexGrow: 1 },
      activeStyle: { cursor: 'copy' },
      onDropAccepted: async ([file]) => {
        setFile(file);
        const fileContentPreview = await readFileAsText(file.slice(0, 1000));
        setFileContents(fileContentPreview);
        if (!recordType) {
          setRecordType(getSuggestedTableName(fileContentPreview) || '');
        }
        setIsFileImportLastUsedMode(true);
      },
    },
    [
      ({ dragging, openUploader }) =>
        h(Fragment, [
          !uploading &&
            h(
              Modal,
              {
                onDismiss,
                title: 'Import Table Data',
                width: '35rem',
                okButton: h(
                  ButtonPrimary,
                  {
                    disabled: dataProvider.tsvFeatures.disabled({ filePresent: currentFile, isInvalid, uploading, recordTypePresent: recordType }),
                    tooltip: dataProvider.tsvFeatures.tooltip({ filePresent: currentFile, isInvalid, recordTypePresent: recordType }),
                    onClick: doUpload,
                  },
                  ['Start Import Job']
                ),
              },
              [
                div([
                  'Choose the data import option below. ',
                  dataProvider.tsvFeatures.dataTableSupportLink &&
                    h(
                      Link,
                      {
                        ...Utils.newTabLinkProps,
                        href: 'https://support.terra.bio/hc/en-us/articles/360025758392',
                      },
                      ['Click here for more info on the table.']
                    ),
                  p([
                    'Data will be saved in Terra-managed location:  ',
                    regionFlagToDisplay,
                    span({ style: { marginLeft: '0.25rem', fontWeight: 'bold' } }, regionLabelToDisplay),
                  ]),
                ]),
                dataProvider.tsvFeatures.needsTypeInput &&
                  div({ style: { paddingTop: '0.1rem', paddingBottom: '2rem' } }, [
                    h(FormLabel, { htmlFor: 'add-table-name' }, ['Table name']),
                    h(ValidatedInput, {
                      inputProps: {
                        id: 'add-table-name',
                        autoFocus: true,
                        placeholder: 'Enter a table name',
                        value: recordType,
                        onChange: (value) => {
                          setRecordType(value);
                          setRecordTypeInputTouched(true);
                        },
                      },
                      error: recordTypeInputTouched && Utils.summarizeErrors(recordTypeNameErrors),
                    }),
                  ]),
                h(SimpleTabBar, {
                  'aria-label': 'import type',
                  tabs: [
                    { title: 'File Import', key: 'file', width: 127 },
                    { title: 'Text Import', key: 'text', width: 127 },
                  ],
                  value: isFileImportCurrMode ? 'file' : 'text',
                  onChange: (value) => {
                    setIsFileImportCurrMode(value === 'file');
                    setShowInvalidEntryMethodWarning(false);
                  },
                }),
                div(
                  {
                    style: {
                      padding: '1rem 0 0',
                      height: '3.25rem',
                    },
                  },
                  [
                    isFileImportCurrMode
                      ? div([
                          'Select the ',
                          h(TooltipTrigger, { content: 'Tab Separated Values', side: 'bottom' }, [
                            span({ style: { textDecoration: 'underline dashed' } }, 'TSV'),
                          ]),
                          ' file containing your data: ',
                        ])
                      : div(['Copy and paste tab separated data here:']),
                    currentFile &&
                      div({ style: { display: 'flex', justifyContent: 'flex-end' } }, [
                        h(
                          Link,
                          {
                            onClick: () => {
                              setFile(undefined);
                              setFileContents('');
                              setUseFireCloudDataModel(false);
                            },
                          },
                          ['Clear']
                        ),
                      ]),
                  ]
                ),
                isFileImportCurrMode
                  ? div([
                      h(
                        Clickable,
                        {
                          style: {
                            ...Style.elements.card.container,
                            flex: 1,
                            backgroundColor: dragging ? colors.accent(0.2) : colors.dark(0.1),
                            border: isInvalid ? `1px solid ${colors.danger()}` : `1px dashed ${colors.dark(0.7)}`,
                            boxShadow: 'none',
                          },
                          onClick: openUploader,
                        },
                        [div(['Drag or ', h(Link, ['Click']), ' to select a .tsv file'])]
                      ),
                      div({ style: { paddingTop: '0.5rem' } }, [
                        'Selected File: ',
                        span({ style: { color: colors.dark(1), fontWeight: 550 } }, [currentFile?.name || 'None']),
                      ]),
                    ])
                  : div([
                      h(PasteOnlyInput, {
                        'aria-label': 'Paste text data here',
                        readOnly: !!fileContents,
                        placeholder: dataProvider.tsvFeatures.textImportPlaceholder,
                        onPaste: (pastedText) => {
                          setFile(new File([pastedText], 'upload.tsv'));
                          setFileContents(pastedText);
                          setIsFileImportLastUsedMode(false);
                          setShowInvalidEntryMethodWarning(false);
                        },
                        onChange: () => setShowInvalidEntryMethodWarning(true),
                        value: !isFileImportLastUsedMode ? fileContents : '',
                        wrap: 'off',
                        style: {
                          fontFamily: 'monospace',
                          height: 100,
                          backgroundColor: isInvalid ? colors.danger(0.1) : colors.light(0.1),
                          border: isInvalid ? `1px solid ${colors.danger()}` : undefined,
                          boxShadow: 'none',
                        },
                      }),
                    ]),
                ((isGoogleWorkspace && currentFile && entityTypeAlreadyExists) || (!isGoogleWorkspace && _.includes(recordType, entityTypes))) &&
                  div(
                    {
                      style: { ...Style.warningBoxStyle, margin: '1rem 0 0.5rem', display: 'flex', alignItems: 'center' },
                    },
                    [
                      icon('warning-standard', {
                        size: 19,
                        style: { color: colors.warning(), flex: 'none', marginRight: '0.5rem', marginLeft: '-0.5rem' },
                      }),
                      `Data with the type '${recordType || newEntityType}' already exists in this workspace. `,
                      'Uploading more data for the same type may overwrite some entries.',
                    ]
                  ),
                currentFile &&
                  containsNullValues &&
                  entityTypeAlreadyExists &&
                  div(
                    {
                      style: { ...Style.warningBoxStyle, margin: '1rem 0 0.5rem' },
                    },
                    [
                      icon('warning-standard', {
                        size: 19,
                        style: { color: colors.warning(), flex: 'none', marginRight: '0.5rem', marginLeft: '-0.5rem' },
                      }),
                      'We have detected empty cells in your TSV. Please choose an option:',
                      div({ role: 'radiogroup', 'aria-label': 'we have detected empty cells in your tsv. please choose an option.' }, [
                        div({ style: { paddingTop: '0.5rem' } }, [
                          h(RadioButton, {
                            text: 'Ignore empty cells (default)',
                            name: 'ignore-empty-cells',
                            checked: !deleteEmptyValues,
                            onChange: () => setDeleteEmptyValues(false),
                            labelStyle: { padding: '0.5rem', fontWeight: 'normal' },
                          }),
                        ]),
                        div({ style: { paddingTop: '0.5rem' } }, [
                          h(RadioButton, {
                            text: 'Overwrite existing cells with empty cells',
                            name: 'ignore-empty-cells',
                            checked: deleteEmptyValues,
                            onChange: () => setDeleteEmptyValues(true),
                            labelStyle: { padding: '0.5rem', fontWeight: 'normal' },
                          }),
                        ]),
                      ]),
                    ]
                  ),
                currentFile &&
                  supportsFireCloudDataModel(newEntityType) &&
                  isGoogleWorkspace &&
                  div([
                    h(
                      LabeledCheckbox,
                      {
                        checked: useFireCloudDataModel,
                        onChange: setUseFireCloudDataModel,
                        style: { margin: '0.5rem' },
                      },
                      [' Create participant, sample, and pair associations']
                    ),
                    h(
                      Link,
                      {
                        style: { marginLeft: '1rem', verticalAlign: 'middle' },
                        href: 'https://support.terra.bio/hc/en-us/articles/360033913771-Understanding-entity-types-and-the-standard-genomic-data-model#h_01EN5PCAEDPX020T2EFGN8TJD6',
                        ...Utils.newTabLinkProps,
                      },
                      ['Learn more ', icon('pop-out', { size: 12 })]
                    ),
                  ]),
                div({ style: errorTextStyle }, [
                  Utils.cond(
                    [isInvalid, () => dataProvider.tsvFeatures.invalidFormatWarning],
                    [showInvalidEntryMethodWarning, () => 'Invalid Data Entry Method: Copy and paste only']
                  ),
                ]),
                div({ style: { borderTop: Style.standardLine, marginTop: '1rem' } }, [
                  div({ style: { marginTop: '1rem', fontWeight: 600 } }, ['TSV file templates']),
                  div({ style: { marginTop: '1rem' } }, [
                    icon('downloadRegular', { style: { size: 14, marginRight: '0.5rem' } }),
                    'Download ',
                    h(
                      Link,
                      {
                        href: dataProvider.tsvFeatures.sampleTSVLink,
                        ...Utils.newTabLinkProps,
                        onClick: () =>
                          Ajax().Metrics.captureEvent(Events.workspaceSampleTsvDownload, {
                            workspaceNamespace: namespace,
                            workspaceName: name,
                            providerName: dataProvider.providerName,
                            cloudPlatform: dataProvider.providerName === wdsProviderName ? cloudProviders.azure.label : cloudProviders.gcp.label,
                          }),
                      },
                      ['sample_template.tsv ']
                    ),
                  ]),
                  dataProvider.tsvFeatures.dataImportSupportLink &&
                    div({ style: { marginTop: '1rem' } }, [
                      icon('pop-out', { style: { size: 14, marginRight: '0.5rem' } }),
                      'Terra Support: ',
                      h(
                        Link,
                        {
                          href: 'https://support.terra.bio/hc/en-us/articles/360059242671',
                          ...Utils.newTabLinkProps,
                        },
                        [' Importing Data - Using a Template']
                      ),
                    ]),
                ]),
              ]
            ),
        ]),
    ]
  );
};
