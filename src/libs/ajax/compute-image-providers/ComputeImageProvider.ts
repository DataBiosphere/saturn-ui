import { ComputeImage } from 'src/analysis/useComputeImages';
import {
  getToolLabelForImage,
  isRuntimeToolLabel,
  runtimeToolLabels,
  terraSupportedRuntimeImageIds,
} from 'src/analysis/utils/tool-utils';
import { GoogleStorage } from 'src/libs/ajax/GoogleStorage';
import { getConfig } from 'src/libs/config';

export interface ComputeImageProviderContract {
  listImages: (googleProject: string, signal?: AbortSignal) => Promise<ComputeImage[]>;
}

/**
 * Refers to a docker image of a Terra VM.
 * Sample response:
     {
        "id": "terra-jupyter-bioconductor",
        "image": "us.gcr.io/broad-dsp-gcr-public/terra-jupyter-bioconductor:2.2.1",
        "label": "R / Bioconductor: (Python 3.10.11, R 4.3.1, Bioconductor 3.17, tidyverse 2.0.0)",
        "packages": "https://storage.googleapis.com/terra-docker-image-documentation/terra-jupyter-bioconductor-2.2.1-versions.json",
        "requiresSpark": false,
        "updated": "2023-07-13",
        "version": "2.2.1"
    },
 */
export interface ComputeImageRaw {
  id: string;
  image: string;
  isCommunity?: boolean;
  isRStudio?: boolean;
  label: string;
  packages: string;
  requiresSpark: boolean;
  updated: string;
  version: string;
}

const normalizeImage: (rawImage: ComputeImageRaw) => ComputeImage = (rawImage) => {
  const toolLabel = getToolLabelForImage(rawImage.id);
  if (toolLabel && !isRuntimeToolLabel(toolLabel)) {
    throw Error('Compute images are not supported for non-Runtime tools');
  }

  const {
    id,
    image: url,
    isCommunity = false,
    isRStudio = toolLabel === runtimeToolLabels.RStudio,
    label,
    packages,
    requiresSpark,
    updated,
    version,
  } = rawImage;

  return {
    id,
    url,
    isCommunity,
    isRStudio,
    isTerraSupported: terraSupportedRuntimeImageIds.includes(id),
    toolLabel,
    label,
    packages,
    requiresSpark,
    updated,
    version,
  };
};

export const ComputeImageProvider: ComputeImageProviderContract = {
  listImages: async (googleProject: string, signal?: AbortSignal): Promise<ComputeImage[]> => {
    const fetchedImages: ComputeImageRaw[] = await GoogleStorage(signal)
      .getObjectPreview(
        googleProject,
        getConfig().terraDockerImageBucket,
        getConfig().terraDockerVersionsFile,
        true

        // TODO https://github.com/DataBiosphere/terra-ui/pull/4136#discussion_r1301733112
        // This conversion to json should be done in the Ajax layer in GoogleStorage.ts getObjectPreview method.... which is what the getObject method right next to it is doing.
        // Looking at usages of getObjectPreview it's kinda ugly that it burdens the caller to decide if .text(), .json() or .blob() is the right thing to call on the response.... would be much better to resolve this within the getObjectPreview method and have the appropriate Promise return type there even if its a union. Also, if text() is the error case, then it should get cleaned up in getObjectPreview and thrown as a proper Error so that consumers of the method have normalized expectations.
      )
      .then((r) => r.json());

    const normalizedImages: ComputeImage[] = fetchedImages.map(normalizeImage);
    return normalizedImages;
  },
};
