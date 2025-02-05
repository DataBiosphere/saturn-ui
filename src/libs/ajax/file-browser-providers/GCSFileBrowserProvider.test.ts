import { FileBrowserDirectory, FileBrowserFile } from 'src/libs/ajax/file-browser-providers/FileBrowserProvider';
import GCSFileBrowserProvider from 'src/libs/ajax/file-browser-providers/GCSFileBrowserProvider';
import { GoogleStorage } from 'src/libs/ajax/GoogleStorage';
import { GCSItem, GCSListObjectsResponse, GoogleStorageContract } from 'src/libs/ajax/GoogleStorage';
import { SamResources, SamResourcesContract } from 'src/libs/ajax/SamResources';
import * as Utils from 'src/libs/utils';
import { asMockedFn, MockedFn, partial } from 'src/testing/test-utils';

jest.mock('src/libs/ajax/GoogleStorage');
jest.mock('src/libs/ajax/SamResources');

const gcsObject = (name: string): GCSItem => ({
  bucket: 'test-bucket',
  contentType: 'text/plain',
  crc32c: 'crc32c',
  etag: 'etag',
  generation: '1666792590000000',
  id: `test-bucket}/${name}/1666792590000000`,
  kind: 'storage#object',
  md5Hash: 'abcdef',
  mediaLink: `https://storage.googleapis.com/download/storage/v1/b/test-bucket/o/${name}?generation=1666792590000000&alt=media`,
  metageneration: '1',
  name,
  selfLink: `https://www.googleapis.com/storage/v1/b/test-bucket/o/${name}`,
  size: '1',
  storageClass: 'STANDARD',
  timeCreated: '2022-10-26T13:56:30.000Z',
  timeStorageClassUpdated: '2022-10-26T13:56:30.000Z',
  updated: '2022-10-26T13:56:30.000Z',
});

const expectedFile = (path: string): FileBrowserFile => ({
  path,
  url: `gs://test-bucket/${path}`,
  contentType: 'text/plain',
  size: 1,
  createdAt: 1666792590000,
  updatedAt: 1666792590000,
});

describe('GCSFileBrowserProvider', () => {
  let list: MockedFn<GoogleStorageContract['list']>;

  beforeEach(() => {
    list = jest.fn();
    list.mockImplementation((_googleProject, _bucket, _prefix, options = {}) => {
      const { pageToken } = options;

      const response: GCSListObjectsResponse = Utils.switchCase(
        pageToken,
        [
          undefined,
          () => ({
            kind: 'storage#objects',
            items: [gcsObject('a-file.txt'), gcsObject('b-file.txt'), gcsObject('c-file.txt')],
            prefixes: ['a-prefix/', 'b-prefix/', 'c-prefix/'],
            nextPageToken: '2',
          }),
        ],
        [
          '2',
          () => ({
            kind: 'storage#objects',
            items: [gcsObject('d-file.txt')],
            prefixes: ['d-prefix/'],
          }),
        ],
        [
          Utils.DEFAULT,
          () => {
            throw new Error('Unrecognized page token');
          },
        ]
      );

      return Promise.resolve(response);
    });

    asMockedFn(GoogleStorage).mockReturnValue(partial<GoogleStorageContract>({ list }));
  });

  it('pages through files (objects)', async () => {
    // Arrange
    const provider = GCSFileBrowserProvider({ bucket: 'test-bucket', project: 'test-project', pageSize: 3 });

    // Act
    const firstResponse = await provider.getFilesInDirectory('');
    const numGCSRequestsAfterFirstResponse = list.mock.calls.length;
    const secondResponse = await firstResponse.getNextPage();
    const numGCSRequestsAfterSecondResponse = list.mock.calls.length;

    // Assert
    const expectedFirstPageFiles: FileBrowserFile[] = [
      expectedFile('a-file.txt'),
      expectedFile('b-file.txt'),
      expectedFile('c-file.txt'),
    ];
    expect(firstResponse.items).toEqual(expectedFirstPageFiles);
    expect(firstResponse.hasNextPage).toBe(true);
    expect(numGCSRequestsAfterFirstResponse).toBe(1);

    const expectedSecondPageFiles: FileBrowserFile[] = [
      expectedFile('a-file.txt'),
      expectedFile('b-file.txt'),
      expectedFile('c-file.txt'),
      expectedFile('d-file.txt'),
    ];
    expect(secondResponse.items).toEqual(expectedSecondPageFiles);
    expect(secondResponse.hasNextPage).toBe(false);
    expect(numGCSRequestsAfterSecondResponse).toBe(2);
  });

  it('pages through directories (prefixes)', async () => {
    // Arrange
    const provider = GCSFileBrowserProvider({ bucket: 'test-bucket', project: 'test-project', pageSize: 3 });

    // Act
    const firstResponse = await provider.getDirectoriesInDirectory('');
    const numGCSRequestsAfterFirstResponse = list.mock.calls.length;
    const secondResponse = await firstResponse.getNextPage();
    const numGCSRequestsAfterSecondResponse = list.mock.calls.length;

    // Assert
    const expectedFirstPageDirectories: FileBrowserDirectory[] = [
      { path: 'a-prefix/', url: 'gs://test-bucket/a-prefix/' },
      { path: 'b-prefix/', url: 'gs://test-bucket/b-prefix/' },
      { path: 'c-prefix/', url: 'gs://test-bucket/c-prefix/' },
    ];
    expect(firstResponse.items).toEqual(expectedFirstPageDirectories);
    expect(firstResponse.hasNextPage).toBe(true);
    expect(numGCSRequestsAfterFirstResponse).toBe(1);

    const expectedSecondPageDirectories: FileBrowserDirectory[] = [
      { path: 'a-prefix/', url: 'gs://test-bucket/a-prefix/' },
      { path: 'b-prefix/', url: 'gs://test-bucket/b-prefix/' },
      { path: 'c-prefix/', url: 'gs://test-bucket/c-prefix/' },
      { path: 'd-prefix/', url: 'gs://test-bucket/d-prefix/' },
    ];
    expect(secondResponse.items).toEqual(expectedSecondPageDirectories);
    expect(secondResponse.hasNextPage).toBe(false);
    expect(numGCSRequestsAfterSecondResponse).toBe(2);
  });

  it('gets a signed URL for downloads', async () => {
    // Arrange
    const getSignedUrl: MockedFn<SamResourcesContract['getSignedUrl']> = jest.fn();
    getSignedUrl.mockResolvedValue('signedUrl');

    asMockedFn(SamResources).mockReturnValue(partial<SamResourcesContract>({ getSignedUrl }));

    const provider = GCSFileBrowserProvider({ bucket: 'test-bucket', project: 'test-project' });

    // Act
    const downloadUrl = await provider.getDownloadUrlForFile('path/to/example.txt');

    // Assert
    expect(getSignedUrl).toHaveBeenCalledWith('test-bucket', 'path/to/example.txt');
    expect(downloadUrl).toBe('signedUrl');
  });

  it('returns a gcloud storage download command', async () => {
    // Arrange
    const provider = GCSFileBrowserProvider({ bucket: 'test-bucket', project: 'test-project' });

    // Act
    const downloadCommand = await provider.getDownloadCommandForFile('path/to/example.txt');

    // Assert
    expect(downloadCommand).toBe("gcloud storage cp 'gs://test-bucket/path/to/example.txt' .");
  });

  it('uploads a file', async () => {
    // Arrange
    const upload: MockedFn<GoogleStorageContract['upload']> = jest.fn();
    upload.mockResolvedValue(undefined);

    asMockedFn(GoogleStorage).mockReturnValue(partial<GoogleStorageContract>({ upload }));

    const testFile = new File(['somecontent'], 'example.txt', { type: 'text/text' });

    const provider = GCSFileBrowserProvider({ bucket: 'test-bucket', project: 'test-project' });

    // Act
    await provider.uploadFileToDirectory('path/to/directory/', testFile);

    // Assert
    expect(upload).toHaveBeenCalledWith('test-project', 'test-bucket', 'path/to/directory/', testFile);
  });

  it('deletes files', async () => {
    // Arrange
    const del: MockedFn<GoogleStorageContract['delete']> = jest.fn();
    del.mockResolvedValue(undefined);
    asMockedFn(GoogleStorage).mockReturnValue(partial<GoogleStorageContract>({ delete: del }));

    const provider = GCSFileBrowserProvider({ bucket: 'test-bucket', project: 'test-project' });

    // Act
    await provider.deleteFile('path/to/file.txt');

    // Assert
    expect(del).toHaveBeenCalledWith('test-project', 'test-bucket', 'path/to/file.txt');
  });

  it('moves files', async () => {
    // Arrange
    const copyWithinBucket: MockedFn<GoogleStorageContract['copyWithinBucket']> = jest.fn();
    copyWithinBucket.mockResolvedValue(undefined);
    const del: MockedFn<GoogleStorageContract['delete']> = jest.fn();
    del.mockResolvedValue(undefined);

    asMockedFn(GoogleStorage).mockReturnValue(
      partial<GoogleStorageContract>({
        copyWithinBucket,
        delete: del,
      })
    );

    const provider = GCSFileBrowserProvider({ bucket: 'test-bucket', project: 'test-project' });

    // Act
    await provider.moveFile('path/to/source.txt', 'path/to/destination.txt');

    // Assert
    expect(copyWithinBucket).toBeCalledWith(
      'test-project',
      'test-bucket',
      'path/to/source.txt',
      'path/to/destination.txt'
    );
    expect(del).toHaveBeenCalledWith('test-project', 'test-bucket', 'path/to/source.txt');
  });

  it('creates empty directories', async () => {
    // Arrange
    const upload: MockedFn<GoogleStorageContract['upload']> = jest.fn();
    upload.mockResolvedValue(undefined);

    asMockedFn(GoogleStorage).mockReturnValue(partial<GoogleStorageContract>({ upload }));

    const provider = GCSFileBrowserProvider({ bucket: 'test-bucket', project: 'test-project' });

    // Act
    const directory = await provider.createEmptyDirectory('foo/bar/baz/');

    // Assert
    expect(upload).toHaveBeenCalledWith(
      'test-project',
      'test-bucket',
      'foo/bar/',
      new File([], 'baz/', { type: 'text/plain' })
    );

    expect(directory).toEqual({ path: 'foo/bar/baz/' });
  });

  it('deletes empty directories', async () => {
    // Arrange
    const del: MockedFn<GoogleStorageContract['delete']> = jest.fn();
    del.mockResolvedValue(undefined);

    asMockedFn(GoogleStorage).mockReturnValue(partial<GoogleStorageContract>({ delete: del }));

    const provider = GCSFileBrowserProvider({ bucket: 'test-bucket', project: 'test-project' });

    // Act
    await provider.deleteEmptyDirectory('foo/bar/baz/');

    // Assert
    expect(del).toHaveBeenCalledWith('test-project', 'test-bucket', 'foo/bar/baz/');
  });

  it('retrieves directories in a directory', async () => {
    // Arrange
    const provider = GCSFileBrowserProvider({ bucket: 'test-bucket', project: 'test-project', pageSize: 3 });

    // Act
    const response = await provider.getDirectoriesInDirectory('some/path/');
    const numGCSRequests = list.mock.calls.length;

    // Assert
    const expectedDirectories: FileBrowserDirectory[] = [
      { path: 'a-prefix/', url: 'gs://test-bucket/a-prefix/' },
      { path: 'b-prefix/', url: 'gs://test-bucket/b-prefix/' },
      { path: 'c-prefix/', url: 'gs://test-bucket/c-prefix/' },
    ];
    expect(response.items).toEqual(expectedDirectories);
    expect(response.hasNextPage).toBe(true);
    expect(numGCSRequests).toBe(1);
  });
});
