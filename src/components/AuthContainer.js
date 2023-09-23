import _ from 'lodash/fp';
import { h } from 'react-hyperscript-helpers';
import { centeredSpinner } from 'src/components/icons';
import { isAzureUser } from 'src/libs/auth';
import { useRoute } from 'src/libs/nav';
import { useStore } from 'src/libs/react-utils';
import { authStore, azurePreviewStore } from 'src/libs/state';
import * as Utils from 'src/libs/utils';
import AzurePreview from 'src/pages/AzurePreview';
import { Disabled } from 'src/pages/Disabled';
import Register from 'src/pages/Register';
import SignIn from 'src/pages/SignIn';
import TermsOfService from 'src/pages/TermsOfService';

const AuthContainer = ({ children }) => {
  const { name, public: isPublic } = useRoute();
  const { isSignedIn, isSigningIn, registrationStatus, termsOfService, profile } = useStore(authStore);
  const displayTosPage = isSignedIn && termsOfService.permitsSystemUsage === false;
  const seenAzurePreview = useStore(azurePreviewStore) || false;
  const authspinner = () => h(centeredSpinner, { style: { position: 'fixed' } });

  return Utils.cond(
    [isSigningIn === true && !isPublic, authspinner],
    [isSignedIn === false && !isPublic, () => h(SignIn)],
    [seenAzurePreview === false && isAzureUser(), () => h(AzurePreview)],
    [registrationStatus === 'uninitialized' && !isPublic, authspinner],
    [registrationStatus === 'unregistered', () => h(Register)],
    [displayTosPage && name !== 'privacy', () => h(TermsOfService)],
    [registrationStatus === 'disabled', () => h(Disabled)],
    [_.isEmpty(profile) && !isPublic, authspinner],
    () => children
  );
};

export default AuthContainer;
