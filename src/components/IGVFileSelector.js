import _ from 'lodash/fp';
import { useEffect, useState } from 'react';
import { div, h } from 'react-hyperscript-helpers';
import { AutoSizer, List } from 'react-virtualized';
import ButtonBar from 'src/components/ButtonBar';
import { ButtonPrimary, LabeledCheckbox, Link } from 'src/components/common';
import IGVReferenceSelector, { addIgvRecentlyUsedReference, defaultIgvReference } from 'src/components/IGVReferenceSelector';
import { DrsUriResolver } from 'src/libs/ajax/drs/DrsUriResolver';
import { isFeaturePreviewEnabled } from 'src/libs/feature-previews';
import { IGV_ENHANCEMENTS } from 'src/libs/feature-previews-config';
import { useCancellation } from 'src/libs/react-utils';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';

const getStrings = (v) => {
  return Utils.cond([_.isString(v), () => [v]], [!!v?.items, () => _.flatMap(getStrings, v.items)], () => []);
};

const splitExtension = (fileUrl) => {
  const extensionDelimiterIndex = fileUrl.lastIndexOf('.');
  const base = fileUrl.slice(0, extensionDelimiterIndex);
  const extension = fileUrl.slice(extensionDelimiterIndex + 1);
  return [base, extension];
};

const UUID_PATTERN = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';

const UUID_REGEX = new RegExp(UUID_PATTERN);

const isUUID = (s) => UUID_REGEX.test(s);

const isTdrUrl = (fileUrl) => {
  const parts = fileUrl.split('/').slice(2);
  const bucket = parts[0];
  const datasetId = parts[1];
  const fileRefId = parts[2];
  return /datarepo(-(dev|alpha|perf|staging|tools))?-[a-f0-9]+-bucket/.test(bucket) && isUUID(datasetId) && isUUID(fileRefId);
};

const genomicFiles = ['bam', 'bed', 'cram', 'gz', 'vcf'];
const indexFiles = ['bai', 'crai', 'idx', 'tbi'];
const allFiles = genomicFiles.concat(indexFiles);

function indexMap(base) {
  return {
    cram: [`${base}.crai`, `${base}.cram.crai`],
    bam: [`${base}.bai`, `${base}.bam.bai`],
    vcf: [`${base}.idx`, `${base}.vcf.idx`, `${base}.tbi`, `${base}.vcf.tbi`],
    gz: [`${base}.gz.tbi`],
  };
}

const findIndexForFile = (fileUrl, fileUrls) => {
  if (!genomicFiles.some((extension) => fileUrl.pathname.endsWith(extension))) {
    return undefined;
  }

  if (isTdrUrl(fileUrl.href)) {
    const parts = fileUrl.href.split('/').slice(2);
    const bucket = parts[0];
    const datasetId = parts[1];
    // parts[2] is the fileRef. Skip it since the index file will have a different file ref.
    const otherPathSegments = parts.slice(3, -1);
    const filename = parts.at(-1);
    const [base, extension] = splitExtension(filename);
    const indexCandidates = indexMap(base)[extension].map(
      (candidate) => new RegExp([`gs://${bucket}`, datasetId, UUID_PATTERN, ...otherPathSegments, candidate].join('/'))
    );
    return fileUrls.find((url) => indexCandidates.some((candidate) => candidate.test(url.href)));
  }

  const [base, extension] = splitExtension(fileUrl.pathname);
  const indexCandidates = indexMap(base)[extension];

  return fileUrls.find((url) => indexCandidates.includes(url.pathname));
};

// Determine whether filename has an IGV-eligible extension
const hasValidIgvExtension = (filename) => {
  const [base, extension] = splitExtension(filename);
  return !!base && allFiles.includes(extension);
};

export const resolveValidIgvDrsUris = async (values, signal) => {
  if (!isFeaturePreviewEnabled(IGV_ENHANCEMENTS)) return [];

  const igvDrsUris = [];

  await Promise.all(
    values.map(async (value) => {
      if (value.startsWith('drs://')) {
        const json = await DrsUriResolver(signal).getDataObjectMetadata(value, ['fileName']);
        const filename = json.fileName;
        const isValid = hasValidIgvExtension(filename);
        if (isValid) {
          igvDrsUris.push(value);
        }
      }
    })
  );

  const igvAccessUrls = [];
  await Promise.all(
    igvDrsUris.map(async (value) => {
      const { accessUrl } = await DrsUriResolver(signal).getDataObjectMetadata(value, ['accessUrl']);
      igvAccessUrls.push(accessUrl.url);
    })
  );

  return igvAccessUrls;
};

export const getValidIgvFiles = async (values, signal) => {
  const basicFileUrls = values.filter((value) => {
    let url;
    try {
      // Filter to values containing URLs.
      url = new URL(value);

      // Filter to GCS URLs (IGV.js supports GCS URLs).
      if (url.protocol !== 'gs:') {
        return false;
      }

      // Filter to URLs that point to a file with one of the relevant extensions.
      const filename = url.pathname.split('/').at(-1);
      return hasValidIgvExtension(filename);
    } catch (err) {
      return false;
    }
  });

  const accessUrls = await resolveValidIgvDrsUris(values, signal);
  const fileUrlStrings = basicFileUrls.concat(accessUrls);
  const fileUrls = fileUrlStrings.map((fus) => new URL(fus));

  return fileUrls.flatMap((fileUrl) => {
    if (fileUrl.pathname.endsWith('.bed')) {
      return [{ filePath: fileUrl.href, indexFilePath: false }];
    }
    const indexFileUrl = findIndexForFile(fileUrl, fileUrls);
    if (indexFileUrl !== undefined) {
      return [{ filePath: fileUrl.href, indexFilePath: indexFileUrl.href }];
    }
    return [];
  });
};

export const getValidIgvFilesFromAttributeValues = async (attributeValues, signal) => {
  const allAttributeStrings = _.flatMap(getStrings, attributeValues);

  const validIgvFiles = await getValidIgvFiles(allAttributeStrings, signal);
  return validIgvFiles;
};

const IGVFileSelector = ({ selectedEntities, onSuccess }) => {
  const [refGenome, setRefGenome] = useState(defaultIgvReference);
  const isRefGenomeValid = Boolean(_.get('genome', refGenome) || _.get('reference.fastaURL', refGenome));

  const [selections, setSelections] = useState([]);
  const [hasDrsCandidateFiles, setHasDrsCandidateFiles] = useState(false);

  const signal = useCancellation();

  useEffect(() => {
    async function fetchData() {
      const allAttributeValues = _.flatMap(_.flow(_.get('attributes'), _.values), selectedEntities);

      // If there are 2 or more DRS URIs in this row, then IGV might be openable.
      // This lets us know we need to show a loading message while awaiting DRS URI
      // resolution to confirm if IGV is indeed openable for the selections.
      const drsCandidateFiles = allAttributeValues.filter((value) => value.startsWith('drs://'));
      setHasDrsCandidateFiles(drsCandidateFiles.length >= 2);

      const selections = await getValidIgvFilesFromAttributeValues(allAttributeValues, signal);
      setHasDrsCandidateFiles(selections.length >= 1);
      setSelections(selections);
    }
    fetchData();
  }, [selectedEntities, setSelections, signal]);

  const toggleSelected = (index) => setSelections(_.update([index, 'isSelected'], (v) => !v));
  const numSelected = _.countBy('isSelected', selections).true;
  const isSelectionValid = !!numSelected;

  const noRowsMessage = hasDrsCandidateFiles ? 'Searching for valid files with indices...' : 'No valid files with indices found';

  return div({ style: Style.modalDrawer.content }, [
    h(IGVReferenceSelector, {
      value: refGenome,
      onChange: setRefGenome,
    }),
    div({ style: { marginBottom: '1rem', display: 'flex' } }, [
      div({ style: { fontWeight: 500 } }, ['Select:']),
      h(Link, { style: { padding: '0 0.5rem' }, onClick: () => setSelections(_.map(_.set('isSelected', true))) }, ['all']),
      '|',
      h(Link, { style: { padding: '0 0.5rem' }, onClick: () => setSelections(_.map(_.set('isSelected', false))) }, ['none']),
    ]),
    div({ style: { flex: 1, marginBottom: '3rem' } }, [
      h(AutoSizer, [
        ({ width, height }) => {
          return h(List, {
            height,
            width,
            rowCount: selections.length,
            rowHeight: 30,
            noRowsRenderer: () => noRowsMessage,
            rowRenderer: ({ index, style, key }) => {
              const { filePath, isSelected } = selections[index];

              // Show the file name, i.e. the last URL path segment, without URL parameters
              const fileName = _.last(filePath.split('/')).split('?')[0];

              return div({ key, style: { ...style, display: 'flex' } }, [
                h(
                  LabeledCheckbox,
                  {
                    checked: isSelected,
                    onChange: () => toggleSelected(index),
                  },
                  [div({ style: { paddingLeft: '0.25rem', flex: 1, ...Style.noWrapEllipsis } }, [fileName])]
                ),
              ]);
            },
          });
        },
      ]),
    ]),
    h(ButtonBar, {
      style: Style.modalDrawer.buttonBar,
      okButton: h(
        ButtonPrimary,
        {
          disabled: !isSelectionValid || !isRefGenomeValid,
          tooltip: Utils.cond([!isSelectionValid, () => 'Select at least one file'], [!isRefGenomeValid, () => 'Select a reference genome']),
          onClick: () => {
            addIgvRecentlyUsedReference(refGenome);
            onSuccess({ selectedFiles: _.filter('isSelected', selections), refGenome });
          },
        },
        ['Launch IGV']
      ),
    }),
  ]);
};

export default IGVFileSelector;
