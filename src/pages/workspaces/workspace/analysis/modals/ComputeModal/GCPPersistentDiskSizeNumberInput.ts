import { div, h, label } from 'react-hyperscript-helpers';
import { NumberInput } from 'src/components/input';
import { useUniqueId } from 'src/libs/react-utils';
import { computeStyles } from 'src/pages/workspaces/workspace/analysis/modals/modalStyles';

export interface GCPPersistentDiskSizeNumberInputProps {
  persistentDiskSize: number;
  isDisabled: boolean;
  onChangePersistentDiskSize: (size: number) => void;
}

export const GCPPersistentDiskSizeNumberInput = (props: GCPPersistentDiskSizeNumberInputProps) => {
  const { persistentDiskSize, isDisabled, onChangePersistentDiskSize } = props;

  const diskSizeId = useUniqueId();

  return h(div, [
    label({ htmlFor: diskSizeId, style: computeStyles.label }, ['Disk Size (GB)']),
    div({ style: { width: 75, marginTop: '0.5rem' } }, [
      h(NumberInput, {
        id: diskSizeId,
        min: 10,
        max: 64000,
        isClearable: false,
        onlyInteger: true,
        value: persistentDiskSize,
        disabled: isDisabled,
        onChange: onChangePersistentDiskSize,
      }),
    ]),
  ]);
};
