import IncrementalResponse from 'src/libs/ajax/incremental-response/IncrementalResponse';

export interface FileBrowserFile {
  path: string;
  url: string;
  contentType: string;
  size: number;
  createdAt: number;
  updatedAt: number;
}

export interface FileBrowserDirectory {
  path: string;
}

interface FileBrowserProvider {
  getDirectoriesInDirectory(
    path: string,
    options?: { signal?: AbortSignal }
  ): Promise<IncrementalResponse<FileBrowserDirectory>>;
  getFilesInDirectory(path: string, options?: { signal?: AbortSignal }): Promise<IncrementalResponse<FileBrowserFile>>;
  getDownloadUrlForFile(path: string, options?: { signal?: AbortSignal }): Promise<string>;
  getDownloadCommandForFile(path: string, options?: { signal?: AbortSignal }): Promise<string>;

  uploadFileToDirectory(directoryPath: string, file: File): Promise<void>;
  deleteFile(path: string): Promise<void>;
  moveFile(sourcePath: string, destinationPath: string): Promise<void>;

  createEmptyDirectory(directoryPath: string): Promise<FileBrowserDirectory>;
  deleteEmptyDirectory(directoryPath: string): Promise<void>;
}

export default FileBrowserProvider;
