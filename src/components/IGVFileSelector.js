import _ from 'lodash/fp';
import { useState } from 'react';
import { div, h } from 'react-hyperscript-helpers';
import { AutoSizer, List } from 'react-virtualized';
import ButtonBar from 'src/components/ButtonBar';
import { ButtonPrimary, LabeledCheckbox, Link } from 'src/components/common';
import IGVReferenceSelector, { addIgvRecentlyUsedReference, defaultIgvReference } from 'src/components/IGVReferenceSelector';
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
  if (!genomicFiles.some((extension) => fileUrl.endsWith(extension))) {
    return undefined;
  }

  if (isTdrUrl(fileUrl)) {
    const parts = fileUrl.split('/').slice(2);
    const bucket = parts[0];
    const datasetId = parts[1];
    // parts[2] is the fileRef. Skip it since the index file will have a different file ref.
    const otherPathSegments = parts.slice(3, -1);
    const filename = parts.at(-1);
    const [base, extension] = splitExtension(filename);
    const indexCandidates = indexMap(base)[extension].map(
      (candidate) => new RegExp([`gs://${bucket}`, datasetId, UUID_PATTERN, ...otherPathSegments, candidate].join('/'))
    );
    return fileUrls.find((url) => indexCandidates.some((candidate) => candidate.test(url)));
  }
  const [base, extension] = splitExtension(fileUrl);
  const indexCandidates = indexMap(base)[extension];

  return fileUrls.find((url) => indexCandidates.includes(url));
};

export const getValidIgvFiles = (values) => {
  const fileUrls = values.filter((value) => {
    let url;
    try {
      // Filter to values containing URLs.
      url = new URL(value);

      // Filter to GCS URLs (IGV.js supports GCS URLs).
      if (url.protocol !== 'gs:') {
        return false;
      }

      // Filter to URLs that point to a file with one of the relevant extensions.
      const basename = url.pathname.split('/').at(-1);
      const [base, extension] = splitExtension(basename);
      return !!base && allFiles.includes(extension);
    } catch (err) {
      return false;
    }
  });

  return fileUrls.flatMap((fileUrl) => {
    if (fileUrl.endsWith('.bed')) {
      return [{ filePath: fileUrl, indexFilePath: false }];
    }
    const indexFileUrl = findIndexForFile(fileUrl, fileUrls);
    return indexFileUrl !== undefined ? [{ filePath: fileUrl, indexFilePath: indexFileUrl }] : [];
  });
};

export const getValidIgvFilesFromAttributeValues = (attributeValues) => {
  const allAttributeStrings = _.flatMap(getStrings, attributeValues);
  return getValidIgvFiles(allAttributeStrings);
};

const IGVFileSelector = ({ selectedEntities, onSuccess }) => {
  const [refGenome, setRefGenome] = useState(defaultIgvReference);
  const isRefGenomeValid = Boolean(_.get('genome', refGenome) || _.get('reference.fastaURL', refGenome));

  const [selections, setSelections] = useState(() => {
    const allAttributeValues = _.flatMap(_.flow(_.get('attributes'), _.values), selectedEntities);
    return getValidIgvFilesFromAttributeValues(allAttributeValues);
  });

  const toggleSelected = (index) => setSelections(_.update([index, 'isSelected'], (v) => !v));
  const numSelected = _.countBy('isSelected', selections).true;
  const isSelectionValid = !!numSelected;

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
            noRowsRenderer: () => 'No valid files with indices found',
            rowRenderer: ({ index, style, key }) => {
              const { filePath, isSelected } = selections[index];
              return div({ key, style: { ...style, display: 'flex' } }, [
                h(
                  LabeledCheckbox,
                  {
                    checked: isSelected,
                    onChange: () => toggleSelected(index),
                  },
                  [div({ style: { paddingLeft: '0.25rem', flex: 1, ...Style.noWrapEllipsis } }, [_.last(filePath.split('/'))])]
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
