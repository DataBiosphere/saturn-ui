import { Spinner } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import { Fragment, useState } from 'react';
import { div, h } from 'react-hyperscript-helpers';
import { ButtonPrimary } from 'src/components/common';
import { getUserProjectForWorkspace } from 'src/components/data/data-utils';
import { DrsUriResolver } from 'src/libs/ajax/drs/DrsUriResolver';
import { Metrics } from 'src/libs/ajax/Metrics';
import { SamResources } from 'src/libs/ajax/SamResources';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import { useCancellation, useOnMount } from 'src/libs/react-utils';
import { knownBucketRequesterPaysStatuses, workspaceStore } from 'src/libs/state';
import * as Utils from 'src/libs/utils';
import DownloadPrices from 'src/workspace-data/download-prices';

import els from './uri-viewer-styles';
import { isAzureUri, isDrsUri } from './uri-viewer-utils';

const getMaxDownloadCostNA = (bytes: number) => {
  const nanos = DownloadPrices.pricingInfo[0].pricingExpression.tieredRates[1].unitPrice.nanos;
  const downloadPrice =
    (bytes * nanos) / DownloadPrices.pricingInfo[0].pricingExpression.baseUnitConversionFactor / 10e8;

  return Utils.formatUSD(downloadPrice);
};

export const UriDownloadButton = ({ uri, metadata: { bucket, name, fileName, size }, accessUrl, workspace }) => {
  const signal = useCancellation();
  const [url, setUrl] = useState<string | null>();
  const getUrlFromDrsProvider = async (userProject: string) => {
    const { url } = await DrsUriResolver(signal).getSignedUrl({
      bucket,
      object: name,
      googleProject: workspace.workspace.googleProject,
      dataObjectUri: uri,
    });
    return knownBucketRequesterPaysStatuses.get()[bucket] ? Utils.mergeQueryParams({ userProject }, url) : url;
  };
  const getUrlFromSam = async (userProject: string) => {
    const requesterPaysProject = knownBucketRequesterPaysStatuses.get()[bucket] ? userProject : undefined;
    return await SamResources(signal).getRequesterPaysSignedUrl(uri, requesterPaysProject);
  };
  const getUrl = async () => {
    if (accessUrl?.url) {
      /*
      NOTE: Not supporting downloading using `accessUrl.headers`:
      - https://ga4gh.github.io/data-repository-service-schemas/preview/release/drs-1.1.0/docs/#_accessurl

      If we want to support supplying `accessUrl.headers` here we'll probably need a bigger solution.
      As of 2021-05-17 a google search turned up this c. 2018 result that mentioned something called `ServiceWorker`
      - https://stackoverflow.com/questions/51721904/make-browser-submit-additional-http-header-if-click-on-hyperlink#answer-51784608
       */
      setUrl(_.isEmpty(accessUrl.headers) ? accessUrl.url : null);
    } else if (isAzureUri(uri)) {
      setUrl(uri);
    } else {
      try {
        const userProject = await getUserProjectForWorkspace(workspace);
        const url = isDrsUri(uri) ? await getUrlFromDrsProvider(userProject) : await getUrlFromSam(userProject);
        setUrl(url);
      } catch (error) {
        setUrl(null);
      }
    }
  };

  useOnMount(() => {
    getUrl();
  });

  const loadingSpinner = () => {
    return h(Fragment, ['Generating download link...', h(Spinner, { style: { color: 'white', marginLeft: 4 } })]);
  };

  const azureDownloadButton = () => {
    return h(
      ButtonPrimary,
      {
        disabled: !url,
        // url is typed string | null, but Clickable wants string | undefined.
        href: url || undefined,
        download: fileName,
        ...Utils.newTabLinkProps,
      },
      [url ? 'Download' : loadingSpinner()]
    );
  };

  const googleDownloadButton = () => {
    const cost = getMaxDownloadCostNA(size);
    return h(
      ButtonPrimary,
      {
        disabled: !url,
        onClick: () => {
          void Metrics().captureEvent(Events.workspaceDataDownload, {
            ...extractWorkspaceDetails(workspaceStore.get()!.workspace),
            fileType: _.head(/\.\w+$/.exec(uri)),
            downloadFrom: 'file direct',
          });
        },
        // url is typed string | null, but Clickable wants string | undefined.
        href: url || undefined,
        /*
         NOTE:
         Some DOS/DRS servers return file names that are different from the end of the path in the gsUri/url.
         Attempt to hint to the browser the correct name.
         FYI this hint doesn't work in Chrome: https://bugs.chromium.org/p/chromium/issues/detail?id=373182#c24
         */
        download: fileName,
        ...Utils.newTabLinkProps,
      },
      [url ? `Download for ${cost}*` : loadingSpinner()]
    );
  };

  // If URL missing, show error. Otherwise, show the Azure/GCP download button.
  return els.cell([
    _.isEmpty(url)
      ? 'Unable to generate download link.'
      : div({ style: { display: 'flex', justifyContent: 'center' } }, [
          isAzureUri(uri) ? azureDownloadButton() : googleDownloadButton(),
        ]),
  ]);
};
