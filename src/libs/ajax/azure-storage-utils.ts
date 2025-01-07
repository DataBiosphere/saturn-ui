import _ from 'lodash/fp';
import { AzureBlobContent, AzureBlobResult, AzurePublicBlobResult } from 'src/libs/ajax/AzureStorage';

export const isAzureBlobSasResult = (result: AzureBlobResult | AzurePublicBlobResult): result is AzureBlobResult => {
  return !_.isEmpty((result as AzureBlobResult).azureSasStorageUrl);
};

export const convert = {
  azureBlobResult: {
    toAzureBlobContent: (blobResult: AzureBlobResult | AzurePublicBlobResult): AzureBlobContent => {
      const isSasBlob = isAzureBlobSasResult(blobResult);
      const uri = !isSasBlob ? blobResult.azureStorageUrl : blobResult.azureSasStorageUrl;
      const textContent = !isSasBlob ? undefined : blobResult.textContent;
      return { textContent, downloadUri: uri };
    },
  },
};
