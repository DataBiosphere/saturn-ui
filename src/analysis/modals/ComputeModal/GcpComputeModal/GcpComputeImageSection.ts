import _ from 'lodash/fp';
import React, { Fragment, useEffect, useState } from 'react';
import { h } from 'react-hyperscript-helpers';
import { getImageUrl } from 'src/analysis/modal-utils';
import { GcpComputeImageSelect } from 'src/analysis/modals/ComputeModal/GcpComputeModal/GcpComputeImageSelect';
import { ComputeImage, ComputeImageStore, useComputeImages } from 'src/analysis/useComputeImages';
import { RuntimeToolLabel, runtimeToolLabels, runtimeTools } from 'src/analysis/utils/tool-utils';
import { spinnerOverlay } from 'src/components/common';
import { GetRuntimeItem } from 'src/libs/ajax/leonardo/models/runtime-models';

export interface GcpComputeImageSectionProps {
  readonly onSelect: (image: ComputeImage | undefined, isCustomImage: boolean) => void;
  readonly tool: RuntimeToolLabel;
  readonly currentRuntime?: Pick<GetRuntimeItem, 'runtimeImages'>;
}

const customImageOptionUrl = 'CUSTOM_IMAGE_OPTION';

export const GcpComputeImageSection: React.FC<GcpComputeImageSectionProps> = (props: GcpComputeImageSectionProps) => {
  const { loadedState, refresh }: ComputeImageStore = useComputeImages();
  const [images, setImages] = useState<ComputeImage[]>([]);
  const [selectedComputeImageUrl, setSelectedComputeImageUrl] = useState<string>('');
  const { onSelect, tool, currentRuntime } = props;

  // on selection change
  useEffect(() => {
    const isCustom = selectedComputeImageUrl === customImageOptionUrl;
    const selectedComputeImage = images.find(({ url }) => url === selectedComputeImageUrl);
    onSelect(selectedComputeImage, isCustom);
  }, [onSelect, selectedComputeImageUrl, images]);

  // initialize on load
  useEffect(() => {
    if (loadedState.status === 'Ready') {
      const allImages = loadedState.state;
      const imagesForTool = allImages.filter((image) => runtimeTools[tool].imageIds.includes(image.id));

      const currentImageUrl: string = getImageUrl(currentRuntime) ?? '';
      const currentImage: ComputeImage | undefined = allImages.find(({ url }) => url === currentImageUrl);

      setImages(imagesForTool);

      if (!currentImage) {
        setSelectedComputeImageUrl(customImageOptionUrl);
      } else if (imagesForTool.includes(currentImage)) {
        setSelectedComputeImageUrl(currentImageUrl);
      } else {
        const defaultImageId: string = runtimeTools[tool].defaultImageId;
        const defaultImageUrl: string = allImages.find(({ id }) => id === defaultImageId)?.url ?? '';
        setSelectedComputeImageUrl(defaultImageUrl);
      }
    }
  }, [loadedState, currentRuntime, tool]);

  useEffect(() => {
    _.once(refresh);
  });

  return h(Fragment, [
    loadedState.status === 'Ready'
      ? h(GcpComputeImageSelect, {
          selectedComputeImageUrl,
          setSelectedComputeImageUrl,
          images,
          hasCustomOption: tool === runtimeToolLabels.Jupyter || tool === runtimeToolLabels.RStudio,
          customOptionUrl: customImageOptionUrl,
        })
      : spinnerOverlay,
  ]);
};
