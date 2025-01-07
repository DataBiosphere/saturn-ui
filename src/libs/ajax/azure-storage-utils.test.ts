import { partial } from 'src/testing/test-utils';

import { convert, isAzureBlobSasResult } from './azure-storage-utils';
import { AzureBlobContent, AzureBlobResult, AzurePublicBlobResult } from './AzureStorage';

describe('isAzureBlobSasResult', () => {
  it('returns true', () => {
    // Arrange
    const blob = partial<AzureBlobResult>({
      azureSasStorageUrl: 'https://coaexternalstorage.blob.core.windows.net/cromwell/user-inputs/privateFile.txt',
      textContent: 'data123',
    });

    // Act
    const result = isAzureBlobSasResult(blob);

    // Assert
    expect(result).toBe(true);
  });

  it('returns false', () => {
    // Arrange
    const blob = partial<AzurePublicBlobResult>({
      azureStorageUrl: 'https://coaexternalstorage.blob.core.windows.net/cromwell/user-inputs/publicFile.txt',
    });

    // Act
    const result = isAzureBlobSasResult(blob);

    // Assert
    expect(result).toBe(false);
  });
});
describe('convert - azureBlobResult', () => {
  it('converts to AzureBlobContent for private sas url', () => {
    // Arrange
    const blob = partial<AzureBlobResult>({
      azureSasStorageUrl: 'https://coaexternalstorage.blob.core.windows.net/cromwell/user-inputs/privateFile.txt',
      textContent: 'data123',
    });

    // Act
    const result = convert.azureBlobResult.toAzureBlobContent(blob);

    // Assert
    expect(result).toEqual({
      textContent: 'data123',
      downloadUri: 'https://coaexternalstorage.blob.core.windows.net/cromwell/user-inputs/privateFile.txt',
    } satisfies AzureBlobContent);
  });

  it('converts to AzureBlobContent for public url', () => {
    // Arrange
    const blob = partial<AzurePublicBlobResult>({
      azureStorageUrl: 'https://coaexternalstorage.blob.core.windows.net/cromwell/user-inputs/publicFile.txt',
    });

    // Act
    const result = convert.azureBlobResult.toAzureBlobContent(blob);

    // Assert
    expect(result).toEqual({
      downloadUri: 'https://coaexternalstorage.blob.core.windows.net/cromwell/user-inputs/publicFile.txt',
    } satisfies AzureBlobContent);
  });
});
