import { AzureStorage } from 'src/libs/ajax/AzureStorage';
import { fetchOk } from 'src/libs/ajax/fetch/fetch-core';
import FileBrowserProvider from 'src/libs/ajax/file-browser-providers/FileBrowserProvider';
import IncrementalResponse from 'src/libs/ajax/incremental-response/IncrementalResponse';
import * as Utils from 'src/libs/utils';

export interface AzureBlobStorageFileBrowserProviderParams {
  workspaceId: string;
  pageSize?: number;
}

type AzureBlobStorageFileBrowserProviderGetPageParams<T> = {
  isFirstPage: boolean;
  pageToken?: string;
  pendingItems?: T[];
  prefix: string;
  previousItems?: T[];
  sasUrl: string;
  signal: any;
  tagName: 'Blob' | 'BlobPrefix';
  mapBlobOrBlobPrefix: (blobOrBlobPrefix: Element) => T;
};

interface BlobListRequestOptions {
  maxResults: number;
  marker?: string;
}

// This provider uses Azure Blob Storage's PUT blob API to upload files.
// This API supports blobs up to 5,000 MiB.
// https://learn.microsoft.com/en-us/rest/api/storageservices/put-blob#remarks
const uploadFileSizeLimit = 5000 * 2 ** 20;

const AzureBlobStorageFileBrowserProvider = ({
  workspaceId,
  pageSize = 1000,
}: AzureBlobStorageFileBrowserProviderParams): FileBrowserProvider => {
  const storageDetailsPromise = AzureStorage().details(workspaceId);

  const getNextPage = async <T>(
    params: AzureBlobStorageFileBrowserProviderGetPageParams<T>
  ): Promise<IncrementalResponse<T>> => {
    const {
      isFirstPage,
      tagName,
      mapBlobOrBlobPrefix,
      pageToken,
      pendingItems = [],
      prefix,
      previousItems = [],
      sasUrl,
      signal,
    } = params;

    let buffer = pendingItems;
    let nextPageToken = pageToken;

    if (nextPageToken || isFirstPage) {
      do {
        const requestOptions: BlobListRequestOptions = {
          maxResults: pageSize,
        };
        if (nextPageToken) {
          requestOptions.marker = nextPageToken;
        }

        const url = Utils.mergeQueryParams(
          {
            restype: 'container',
            comp: 'list',
            delimiter: '/',
            prefix,
            ...requestOptions,
          },
          sasUrl
        );

        const response = await fetchOk(url, { signal });
        const responseText = await response.text();
        const responseXML = new window.DOMParser().parseFromString(responseText, 'text/xml');

        const blobOrBlobPrefixElements = Array.from(responseXML.getElementsByTagName(tagName));
        const blobsOrPrefixes = blobOrBlobPrefixElements.map(mapBlobOrBlobPrefix);

        // Exclude folder placeholder objects.
        const blobsOrPrefixesWithoutPlaceholders = blobsOrPrefixes.filter(
          (blobOrPrefix) => (blobOrPrefix as any).path !== prefix
        );

        buffer = buffer.concat(blobsOrPrefixesWithoutPlaceholders);

        nextPageToken = responseXML.getElementsByTagName('NextMarker').item(0)?.textContent || undefined;
      } while (buffer.length < pageSize && nextPageToken);
    }

    const items = previousItems.concat(buffer.slice(0, pageSize));
    const nextPendingItems = buffer.slice(pageSize);
    const hasNextPage = nextPendingItems.length > 0 || !!nextPageToken;

    return {
      items,
      getNextPage: hasNextPage
        ? ({ signal } = {}) =>
            getNextPage({
              isFirstPage: false,
              tagName,
              mapBlobOrBlobPrefix,
              pageToken: nextPageToken,
              pendingItems: nextPendingItems,
              prefix,
              previousItems: items,
              sasUrl,
              signal,
            } as AzureBlobStorageFileBrowserProviderGetPageParams<T>)
        : () => {
            throw new Error('No next page');
          },
      hasNextPage,
    };
  };

  return {
    getFilesInDirectory: async (path, { signal } = {}) => {
      const {
        sas: { url: sasUrl },
      } = await storageDetailsPromise;
      return getNextPage({
        isFirstPage: true,
        tagName: 'Blob',
        mapBlobOrBlobPrefix: (blob) => {
          const name = blob.getElementsByTagName('Name').item(0)!.textContent!;

          const blobProperties = blob.getElementsByTagName('Properties').item(0)!;
          const creationTime = blobProperties.getElementsByTagName('Creation-Time').item(0)!.textContent!;
          const lastModified = blobProperties.getElementsByTagName('Last-Modified').item(0)!.textContent!;
          const contentLength = blobProperties.getElementsByTagName('Content-Length').item(0)!.textContent!;
          const contentType = blobProperties.getElementsByTagName('Content-Type').item(0)!.textContent!;

          const blobUrl = new URL(sasUrl);
          blobUrl.pathname += `/${name}`;
          blobUrl.search = '';

          return {
            path: name,
            url: blobUrl.href,
            contentType,
            size: parseInt(contentLength),
            createdAt: new Date(creationTime).getTime(),
            updatedAt: new Date(lastModified).getTime(),
          };
        },
        prefix: path,
        sasUrl,
        signal,
      });
    },
    getDirectoriesInDirectory: async (path, { signal } = {}) => {
      const {
        sas: { url: sasUrl },
      } = await storageDetailsPromise;
      return getNextPage({
        isFirstPage: true,
        tagName: 'BlobPrefix',
        mapBlobOrBlobPrefix: (blobPrefix) => {
          const name = blobPrefix.getElementsByTagName('Name').item(0)!.textContent!;

          return {
            path: name,
          };
        },
        prefix: path,
        sasUrl,
        signal,
      });
    },
    getDownloadUrlForFile: async (path) => {
      const {
        sas: { url: originalSasUrl },
      } = await storageDetailsPromise;
      const blobUrl = new URL(originalSasUrl);
      blobUrl.pathname += `/${path}`;
      return blobUrl.href;
    },
    getDownloadCommandForFile: async (path) => {
      const {
        sas: { url: originalSasUrl },
      } = await storageDetailsPromise;
      const blobUrl = new URL(originalSasUrl);
      blobUrl.pathname += `/${path}`;
      return `azcopy copy '${blobUrl.href}' .`;
    },
    uploadFileToDirectory: async (directoryPath, file) => {
      // This provider uses Azure Blob Storage's PUT blob API to upload files.
      // If the user attempts to upload a larger file than that API supports, we can fail fast with
      // a more useful error message instead of waiting for the file to upload and the inevitable
      // "Request body too large" error from Azure.
      if (file.size > uploadFileSizeLimit) {
        throw new Error(
          'The Terra file browser supports uploading files up to 5,000 MiB. For larger files, use azcopy or the Azure Storage Explorer.'
        );
      }

      const {
        sas: { url: originalSasUrl },
      } = await storageDetailsPromise;

      const blobUrl = new URL(originalSasUrl);
      blobUrl.pathname += `/${directoryPath}${encodeURIComponent(file.name)}`;

      await fetchOk(blobUrl.href, {
        body: file,
        headers: {
          'Content-Length': file.size,
          'Content-Type': file.type,
          'x-ms-blob-type': 'BlockBlob',
        },
        method: 'PUT',
      });
    },
    deleteFile: async (path: string) => {
      const {
        sas: { url: originalSasUrl },
      } = await storageDetailsPromise;

      const blobUrl = new URL(originalSasUrl);
      blobUrl.pathname += `/${path}`;

      await fetchOk(blobUrl.href, {
        method: 'DELETE',
      });
    },
    moveFile: async (sourcePath: string, destinationPath: string): Promise<void> => {
      const {
        sas: { url: originalSasUrl },
      } = await storageDetailsPromise;

      const sourceBlobUrl = new URL(originalSasUrl);
      sourceBlobUrl.pathname += `/${sourcePath}`;

      const destinationBlobUrl = new URL(originalSasUrl);
      destinationBlobUrl.pathname += `/${destinationPath}`;

      await fetchOk(destinationBlobUrl.href, {
        method: 'PUT',
        headers: {
          'x-ms-copy-source': sourceBlobUrl.href,
        },
      });

      // Note
      // The copy operation can finish asychronously.
      // https://learn.microsoft.com/en-us/rest/api/storageservices/copy-blob?tabs=azure-ad#remarks
      // However, we can't access the x-ms-copy-status header from JavaScript to check if this is the case.
      // To access this header, the response from Azure storage would have to include an Access-Control-Expose-Headers header.
      // https://developer.mozilla.org/en-US/docs/Glossary/CORS-safelisted_response_header
      //
      // Thus, this optimistically assumes that the copy finished synchronously.

      await fetchOk(sourceBlobUrl.href, {
        method: 'DELETE',
      });
    },
    createEmptyDirectory: async (directoryPath: string) => {
      console.assert(directoryPath.endsWith('/'), 'Directory paths must include a trailing slash');

      const {
        sas: { url: originalSasUrl },
      } = await storageDetailsPromise;

      const blobUrl = new URL(originalSasUrl);
      blobUrl.pathname += `/${directoryPath}`;

      const directoryName = directoryPath.split('/').at(-2);
      const placeholderObject = new File([''], `${directoryName}/`, { type: 'text/text' });

      await fetchOk(blobUrl.href, {
        body: placeholderObject,
        headers: {
          'Content-Length': placeholderObject.size,
          'Content-Type': placeholderObject.type,
          'x-ms-blob-type': 'BlockBlob',
        },
        method: 'PUT',
      });

      return {
        path: directoryPath,
      };
    },
    deleteEmptyDirectory: async (directoryPath: string) => {
      const {
        sas: { url: originalSasUrl },
      } = await storageDetailsPromise;

      const blobUrl = new URL(originalSasUrl);
      blobUrl.pathname += `/${directoryPath}`;

      try {
        await fetchOk(blobUrl.href, {
          method: 'DELETE',
        });
      } catch (error) {
        if (!(error instanceof Response && error.status === 404)) {
          throw error;
        }
      }
    },
  };
};

export default AzureBlobStorageFileBrowserProvider;
