import { div } from 'react-hyperscript-helpers';
import { AboutPersistentDiskSection } from 'src/analysis/modals/ComputeModal/AboutPersistentDiskSection';
import { GcpPersistentDiskSizeNumberInput } from 'src/analysis/modals/ComputeModal/GcpComputeModal/GcpPersistentDiskSizeNumberInput';
import { PersistentDiskTypeInputContainer } from 'src/analysis/modals/ComputeModal/PersistentDiskTypeInputContainer';
import { computeStyles } from 'src/analysis/modals/modalStyles';
import { GcpPersistentDiskOptions, SharedPdType } from 'src/libs/ajax/leonardo/models/disk-models';
import { CloudProvider } from 'src/workspaces/utils';

export interface GcpPersistentDiskSectionProps {
  persistentDiskExists: boolean;
  persistentDiskSize: number;
  persistentDiskType: SharedPdType;
  onChangePersistentDiskType: (type: SharedPdType) => void;
  onChangePersistentDiskSize: (size: number) => void;
  onClickAbout: () => void;
  cloudPlatform: CloudProvider;
}

export const GcpPersistentDiskSection: React.FC<GcpPersistentDiskSectionProps> = (
  props: GcpPersistentDiskSectionProps
) => {
  const {
    onClickAbout,
    persistentDiskType,
    persistentDiskSize,
    onChangePersistentDiskType,
    onChangePersistentDiskSize,
    persistentDiskExists,
  } = props;

  const gridStyle = { display: 'grid', gridGap: '1rem', alignItems: 'center', marginTop: '1rem' };
  return div({ style: { ...computeStyles.whiteBoxContainer, marginTop: '1rem' } }, [
    AboutPersistentDiskSection({ onClick: onClickAbout }),
    div({ style: { ...gridStyle, gridGap: '1rem', gridTemplateColumns: '15rem 5.5rem', marginTop: '0.75rem' } }, [
      PersistentDiskTypeInputContainer({
        persistentDiskExists,
        value: persistentDiskType.value,
        onChange: (e) => onChangePersistentDiskType(e),
        options: GcpPersistentDiskOptions,
      }),
      GcpPersistentDiskSizeNumberInput({
        persistentDiskSize,
        // GCP disk size may be updated after creation
        isDisabled: false,
        onChangePersistentDiskSize,
      }),
    ]),
  ]);
};
