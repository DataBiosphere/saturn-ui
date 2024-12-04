import { TermsOfService } from 'src/libs/ajax/TermsOfService';
import { SamTermsOfServiceConfig } from 'src/libs/ajax/TermsOfService';
import { SystemState, systemStore } from 'src/libs/state';

export const initializeSystemProperties = async (): Promise<void> => {
  const termsOfServiceConfig: SamTermsOfServiceConfig = await TermsOfService().getTermsOfServiceConfig();
  systemStore.update((state: SystemState) => ({
    ...state,
    termsOfServiceConfig,
  }));
};
