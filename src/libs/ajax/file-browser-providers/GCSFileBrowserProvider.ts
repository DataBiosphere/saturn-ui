import FileBrowserProvider from 'src/libs/ajax/file-browser-providers/FileBrowserProvider';
import { GoogleStorage } from 'src/libs/ajax/GoogleStorage';
import { GCSItem } from 'src/libs/ajax/GoogleStorage';
import IncrementalResponse from 'src/libs/ajax/incremental-response/IncrementalResponse';
import { SamResources } from 'src/libs/ajax/SamResources';

export interface GCSFileBrowserProviderParams {
  bucket: string;
  project: string;
  pageSize?: number;
}

type GCSFileBrowserProviderGetPageParams<T> = {
  isFirstPage: boolean;
  matchGlob?: string;
  pageToken?: string;
  pendingItems?: T[];
  prefix: string;
  previousItems?: T[];
  signal: any;
} & (
  | {
      itemsOrPrefixes: 'items';
      mapItemOrPrefix: (item: GCSItem) => T;
    }
  | {
      itemsOrPrefixes: 'prefixes';
      mapItemOrPrefix: (prefix: string) => T;
    }
);

interface BucketListRequestOptions {
  matchGlob?: string;
  maxResults: number;
  pageToken?: string;
}

const GCSFileBrowserProvider = ({
  bucket,
  project,
  pageSize = 1000,
}: GCSFileBrowserProviderParams): FileBrowserProvider => {
  const getNextPage = async <T>(params: GCSFileBrowserProviderGetPageParams<T>): Promise<IncrementalResponse<T>> => {
    const {
      isFirstPage,
      itemsOrPrefixes,
      mapItemOrPrefix,
      matchGlob,
      pageToken,
      pendingItems = [],
      prefix,
      previousItems = [],
      signal,
    } = params;

    let buffer = pendingItems;
    let nextPageToken = pageToken;

    if (nextPageToken || isFirstPage) {
      do {
        const requestOptions: BucketListRequestOptions = {
          maxResults: pageSize,
        };
        if (nextPageToken) {
          requestOptions.pageToken = nextPageToken;
        }
        if (matchGlob) {
          requestOptions.matchGlob = matchGlob;
        }

        const response = await GoogleStorage(signal).list(project, bucket, prefix, requestOptions);
        const responseItems = (response[itemsOrPrefixes] || []).map((itemOrPrefix) => mapItemOrPrefix(itemOrPrefix));

        // Exclude folder placeholder objects.
        // See https://cloud.google.com/storage/docs/folders for more information.
        const responseItemsWithoutPlaceholders = responseItems.filter(
          (fileOrDirectory) => (fileOrDirectory as any).path !== prefix
        );

        buffer = buffer.concat(responseItemsWithoutPlaceholders);
        nextPageToken = response.nextPageToken;
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
              itemsOrPrefixes,
              mapItemOrPrefix,
              matchGlob,
              pageToken: nextPageToken,
              pendingItems: nextPendingItems,
              prefix,
              previousItems: items,
              signal,
            } as GCSFileBrowserProviderGetPageParams<T>)
        : () => {
            throw new Error('No next page');
          },
      hasNextPage,
    };
  };

  return {
    getFilesInDirectory: (path, { signal } = {}) =>
      getNextPage({
        isFirstPage: true,
        itemsOrPrefixes: 'items',
        mapItemOrPrefix: (item) => ({
          path: item.name,
          url: `gs://${item.bucket}/${item.name}`,
          // If an object is stored without a Content-Type, it is served as application/octet-stream.
          // https://cloud.google.com/storage/docs/json_api/v1/objects#resource-representations
          contentType: item.contentType || 'application/octet-stream',
          size: parseInt(item.size),
          createdAt: new Date(item.timeCreated).getTime(),
          updatedAt: new Date(item.updated).getTime(),
        }),
        // This glob pattern matches objects which are not themselves prefixes (i.e. files)
        matchGlob: '**?',
        prefix: path,
        signal,
      }),
    getDirectoriesInDirectory: (path, { signal } = {}) =>
      getNextPage({
        isFirstPage: true,
        itemsOrPrefixes: 'prefixes',
        mapItemOrPrefix: (prefix) => ({
          path: `${prefix}`,
          url: `gs://${bucket}/${prefix}`,
        }),
        // This glob pattern matches prefixes (directories) excluding the given path
        matchGlob: `${path}**?/`,
        prefix: path,
        signal,
      }),
    getDownloadUrlForFile: async (path, { signal } = {}) => {
      return await SamResources(signal).getSignedUrl(bucket, path);
    },
    getDownloadCommandForFile: (path) => {
      return Promise.resolve(`gcloud storage cp 'gs://${bucket}/${path}' .`);
    },
    uploadFileToDirectory: (directoryPath, file) => {
      return GoogleStorage().upload(project, bucket, directoryPath, file);
    },
    deleteFile: async (path: string): Promise<void> => {
      await GoogleStorage().delete(project, bucket, path);
    },
    moveFile: async (sourcePath: string, destinationPath: string): Promise<void> => {
      await GoogleStorage().copyWithinBucket(project, bucket, sourcePath, destinationPath);
      await GoogleStorage().delete(project, bucket, sourcePath);
    },
    createEmptyDirectory: async (directoryPath: string) => {
      // Create a placeholder object for the new folder.
      // See https://cloud.google.com/storage/docs/folders for more information.
      console.assert(directoryPath.endsWith('/'), 'Directory paths must include a trailing slash');
      const prefixSegments = directoryPath.split('/').slice(0, -2);
      const prefix = prefixSegments.length === 0 ? '' : `${prefixSegments.join('/')}/`;
      const directoryName = directoryPath.split('/').slice(-2, -1)[0];
      const placeholderObject = new File([''], `${directoryName}/`, { type: 'text/plain' });
      await GoogleStorage().upload(project, bucket, prefix, placeholderObject);
      return {
        path: directoryPath,
      };
    },
    deleteEmptyDirectory: async (directoryPath: string) => {
      console.assert(directoryPath.endsWith('/'), 'Directory paths must include a trailing slash');
      // Attempt to delete folder placeholder object.
      // A placeholder object may not exist for the prefix being viewed, so do not an report error for 404 responses.
      // See https://cloud.google.com/storage/docs/folders for more information on placeholder objects.
      try {
        await GoogleStorage().delete(project, bucket, directoryPath);
      } catch (error) {
        if (!(error instanceof Response && error.status === 404)) {
          throw error;
        }
      }
    },
  };
};

export default GCSFileBrowserProvider;
