import { ClickableProps } from '@terra-ui-packages/components';
import React, { ReactNode } from 'react';
import { ButtonPrimary, Link } from 'src/components/common';
import { icon } from 'src/components/icons';
import { ExternalCredentials } from 'src/libs/ajax/ExternalCredentials';
import { withErrorReporting } from 'src/libs/error';
import { useCancellation } from 'src/libs/react-utils';
import * as Utils from 'src/libs/utils';
import { OAuth2Provider } from 'src/profile/external-identities/OAuth2Providers';

interface LinkOAuth2AccountProps extends Omit<ClickableProps, 'onClick'> {
  linkText: string;
  provider: OAuth2Provider;
  button?: boolean;
}
export const LinkOAuth2Account = (props: LinkOAuth2AccountProps): ReactNode => {
  const signal = useCancellation();

  const { linkText, provider, button = true } = props;
  const Component = button ? ButtonPrimary : Link;
  const style = button ? {} : { display: 'inline-flex', alignItems: 'center' };

  const getAuthUrlAndRedirect = withErrorReporting(`Error getting Authorization URL for ${provider.short}`)(
    async () => {
      const url = await ExternalCredentials(signal)(provider).getAuthorizationUrl();
      window.open(url, Utils.newTabLinkProps.target, 'noopener,noreferrer');
    }
  );

  return (
    <Component
      style={style}
      onClick={getAuthUrlAndRedirect}
      target={Utils.newTabLinkProps.target}
      rel={Utils.newTabLinkProps.rel}
    >
      {linkText}
      {icon('pop-out', { size: 12, style: { marginLeft: '0.2rem' } })}
    </Component>
  );
};
