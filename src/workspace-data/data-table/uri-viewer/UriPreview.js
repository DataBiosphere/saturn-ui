import DOMPurify from 'dompurify';
import _ from 'lodash/fp';
import { Fragment, useState } from 'react';
import { div, h, img } from 'react-hyperscript-helpers';
import { Ajax } from 'src/libs/ajax';
import colors from 'src/libs/colors';
import { useCancellation, useOnMount } from 'src/libs/react-utils';
import * as Utils from 'src/libs/utils';

import els from './uri-viewer-styles';
import { isAzureUri } from './uri-viewer-utils';

const styles = {
  previewText: {
    whiteSpace: 'pre',
    fontFamily: 'Menlo, monospace',
    fontSize: 12,
    overflowY: 'auto',
    maxHeight: 400,
    marginTop: '0.5rem',
    padding: '0.5rem',
    background: colors.light(0.2),
    borderRadius: '0.2rem',
  },
};

export const isImage = ({ contentType, name }) => {
  return /^(?:image)/.test(contentType) || /\.(?:jpe?g|png|svg|bmp)$/.test(name);
};

export const isText = ({ name }) => {
  return /\.(?:txt|[ct]sv|log|json|fastq|fasta|fa|vcf|sam|bed|interval_list|gtf|md)$/.test(name);
};

export const isHtml = ({ contentType, name }) => {
  return /^(?:text\/html)/.test(contentType) || _.endsWith('html', name);
};

export const isPdf = ({ contentType, name }) => {
  return /^(?:application\/pdf)/.test(contentType) || _.endsWith('pdf', name);
};

export const canRender = ({ contentType, name }) => {
  return isHtml({ contentType, name }) || isPdf({ contentType, name });
};

export const isFilePreviewable = ({ size, ...metadata }) => {
  return (isText(metadata) || isImage(metadata) || canRender(metadata)) && size <= 1e9;
};

export const UriPreview = ({ metadata, metadata: { uri, bucket, name }, googleProject }) => {
  const signal = useCancellation();
  const [preview, setPreview] = useState();
  const loadPreview = async () => {
    try {
      if (isAzureUri(uri)) {
        setPreview(metadata.textContent); // NB: For now, we only support text previews for Azure URIs.
      } else {
        const canPreviewFull = isImage(metadata) || canRender(metadata);
        const res = await Ajax(signal).Buckets.getObjectPreview(googleProject, bucket, name, canPreviewFull);
        if (isImage(metadata) || isPdf(metadata)) {
          setPreview(URL.createObjectURL(await res.blob()));
        } else if (isHtml(metadata)) {
          const sanitizedHtml = DOMPurify.sanitize(await res.text());
          const safeHtmlPreview = URL.createObjectURL(new Blob([sanitizedHtml], { type: 'text/html' }));
          setPreview(safeHtmlPreview);
        } else {
          setPreview(await res.text());
        }
      }
    } catch (error) {
      setPreview(null);
    }
  };
  useOnMount(() => {
    if (isFilePreviewable(metadata)) {
      loadPreview();
    }
  });
  return els.cell([
    div({ style: { fontWeight: 'bold', padding: '1rem', backgroundColor: 'lightgray' } }, ['File Preview']),
    Utils.cond(
      [
        isFilePreviewable(metadata),
        () =>
          h(Fragment, [
            Utils.cond(
              [preview === null, () => 'Unable to load preview.'],
              [preview === undefined, () => 'Loading preview...'],
              [isImage(metadata), () => img({ src: preview, width: '100%', height: 400 })],
              [canRender(metadata), () => h('iframe', { src: preview, width: '100%', height: 400 })],
              () =>
                div(
                  {
                    tabIndex: 0,
                    style: styles.previewText,
                  },
                  [preview]
                )
            ),
          ]),
      ],
      [isImage(metadata), () => els.label('Image is too large to preview')],
      () => els.label("File can't be previewed.")
    ),
  ]);
};
