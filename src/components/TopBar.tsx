import { FocusTrap, Icon, IconId, Modal, SpinnerOverlay, useUniqueId } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import React, { CSSProperties, PropsWithChildren, ReactNode, useRef, useState } from 'react';
import { UnmountClosed as RCollapse } from 'react-collapse';
import { Transition } from 'react-transition-group';
import { AlertsIndicator } from 'src/alerts/Alerts';
import { RequiredUpdateAlert } from 'src/alerts/RequiredUpdateAlert';
import { signIn } from 'src/auth/auth';
import { signOut } from 'src/auth/signout/sign-out';
import { Clickable, LabeledCheckbox, Link } from 'src/components/common';
import { TextArea } from 'src/components/input';
import ProfilePicture from 'src/components/ProfilePicture';
import { SkipNavLink, SkipNavTarget } from 'src/components/skipNavLink';
import fcIconWhite from 'src/images/brands/firecloud/FireCloud-icon-white.svg';
import headerRightHexes from 'src/images/brands/terra/header-right-hexes.svg';
import { Support } from 'src/libs/ajax/Support';
import { User } from 'src/libs/ajax/User';
import { isBaseline, isBioDataCatalyst, isDatastage, isFirecloud, isTerra } from 'src/libs/brand-utils';
import colors from 'src/libs/colors';
import { getConfig } from 'src/libs/config';
import { withErrorReporting } from 'src/libs/error';
import { FormLabel } from 'src/libs/forms';
import { topBarLogo } from 'src/libs/logos';
import * as Nav from 'src/libs/nav';
import { useStore } from 'src/libs/react-utils';
import { authStore, contactUsActive, userStore } from 'src/libs/state';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';

const topBarStyle: CSSProperties = {
  flex: 'none',
  height: Style.topBarHeight,
  display: 'flex',
  alignItems: 'center',
  borderBottom: `2px solid ${colors.primary(0.55)}`,
  zIndex: 2,
  boxShadow: '3px 0 13px 0 rgba(0,0,0,0.3)',
};

const pageTitleStyles: CSSProperties = {
  color: isTerra() ? 'white' : colors.dark(),
  fontSize: 22,
  fontWeight: 500,
  textTransform: 'uppercase',
};

const navSectionStyles: CSSProperties = {
  flex: 'none',
  height: 70,
  padding: '0 28px',
  fontWeight: 600,
  borderTop: `1px solid ${colors.dark(0.55)}`,
  color: 'white',
};

const navBackgroundStyles: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  overflow: 'auto',
  cursor: 'pointer',
  zIndex: 2,
};

const navIconStyles: CSSProperties = {
  marginRight: 12,
  flex: 'none',
};

const navContainerStyles = (state: string): CSSProperties => ({
  ...(state === 'entered' ? {} : { opacity: 0, transform: 'translate(-2rem)' }),
  transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
  paddingTop: Style.topBarHeight,
  width: 290,
  color: 'white',
  position: 'absolute',
  cursor: 'default',
  backgroundColor: colors.dark(0.8),
  height: '100%',
  boxShadow: '3px 0 13px 0 rgba(0,0,0,0.3)',
  zIndex: 2,
  display: 'flex',
  flexDirection: 'column',
});

const NavItem = ({ children, ...props }): ReactNode => (
  <Clickable
    {..._.merge(
      {
        style: { display: 'flex', alignItems: 'center', color: 'white', outlineOffset: -4 },
        hover: { backgroundColor: colors.dark(0.55) },
      },
      props
    )}
  >
    {children}
  </Clickable>
);

const NavSection = ({ children, ...props }): ReactNode => (
  <div role='listitem'>
    <NavItem {..._.merge({ style: navSectionStyles }, props)}>{children}</NavItem>
  </div>
);

const DropDownSubItem = ({ children, ...props }): ReactNode => (
  <div role='listitem'>
    <NavItem {..._.merge({ style: { padding: '0 3rem', height: 40, fontWeight: 500 } }, props)}>{children}</NavItem>
  </div>
);

interface DropDownSectionProps extends PropsWithChildren {
  titleIcon?: IconId;
  title: ReactNode;
  isOpened: boolean;
  onClick: () => void;
}

const DropDownSection = (props: DropDownSectionProps): ReactNode => {
  const { titleIcon, title, isOpened, onClick, children } = props;
  return (
    <div role='group'>
      <NavItem onClick={onClick} aria-expanded={isOpened} aria-haspopup='menu' style={navSectionStyles}>
        {titleIcon && <Icon icon={titleIcon} size={24} style={navIconStyles} />}
        {title}
        <div style={{ flexGrow: 1 }} />
        <Icon icon={isOpened ? 'angle-up' : 'angle-down'} size={18} style={{ flex: 'none' }} />
      </NavItem>
      <div style={{ flex: 'none' }}>
        <RCollapse isOpened={isOpened}>{children}</RCollapse>
      </div>
    </div>
  );
};

interface TopBarProps extends PropsWithChildren {
  title: string;
  showMenu?: boolean;
  href?: string;
}

export const TopBar = (props: TopBarProps): ReactNode => {
  const { showMenu = true, title, href, children } = props;
  const [navShown, setNavShown] = useState(false);
  const [openUserMenu, setOpenUserMenu] = useState(false);
  const [openLibraryMenu, setOpenLibraryMenu] = useState(false);
  const [openSupportMenu, setOpenSupportMenu] = useState(false);
  const [openPlatformNewsMenu, setOpenPlatformNewsMenu] = useState(false);
  const [openFirecloudModal, setOpenFirecloudModal] = useState(false);

  const authState = useStore(authStore);
  const userState = useStore(userStore);

  const showNav = () => {
    setNavShown(true);
    document.body.classList.add('overlayOpen');
    if (document.body.scrollHeight > window.innerHeight) {
      document.body.classList.add('overHeight');
    }
  };

  const hideNav = () => {
    setNavShown(false);
    setOpenUserMenu(false);
    setOpenLibraryMenu(false);
    setOpenSupportMenu(false);
    setOpenPlatformNewsMenu(false);
    document.body.classList.remove('overlayOpen', 'overHeight');
  };

  const buildNav = (transitionState: string) => {
    const { signInStatus } = authState;
    const {
      profile: { firstName = 'Loading...', lastName = '' },
    } = userState;

    return (
      <FocusTrap
        onEscape={() => setNavShown(false)}
        role='navigation'
        aria-label='Main menu'
        style={navShown ? navBackgroundStyles : undefined}
        onClick={hideNav}
      >
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions  */}
        <div style={navContainerStyles(transitionState)} onClick={(e) => e.stopPropagation()}>
          <div role='list' style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1 }}>
            {signInStatus === 'userLoaded' || signInStatus === 'authenticated' ? (
              <DropDownSection
                title={
                  <>
                    <ProfilePicture size={32} style={{ marginRight: 12, flex: 'none' }} />
                    <div style={{ ...Style.noWrapEllipsis }}>
                      {firstName} {lastName}
                    </div>
                  </>
                }
                onClick={() => setOpenUserMenu(!openUserMenu)}
                isOpened={openUserMenu}
              >
                <DropDownSubItem href={Nav.getLink('profile')} onClick={hideNav}>
                  Profile
                </DropDownSubItem>
                <DropDownSubItem href={Nav.getLink('groups')} onClick={hideNav}>
                  Groups
                </DropDownSubItem>
                <DropDownSubItem href={Nav.getLink('billing')} onClick={hideNav}>
                  Billing
                </DropDownSubItem>
                <DropDownSubItem href={Nav.getLink('environments')} onClick={hideNav}>
                  Cloud Environments
                </DropDownSubItem>
                <DropDownSubItem onClick={() => signOut('requested')}>Sign Out</DropDownSubItem>
              </DropDownSection>
            ) : (
              <div
                style={{
                  flex: 'none',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: 95,
                }}
                role='listitem'
              >
                <Clickable
                  {...(isDatastage() || isBioDataCatalyst()
                    ? { href: Nav.getLink('workspaces') }
                    : { onClick: () => signIn(false) })}
                  style={{
                    backgroundColor: 'white',
                    fontSize: 18,
                    fontWeight: 500,
                    color: colors.accent(),
                    borderRadius: 5,
                    boxShadow: '0 2px 4px 0 rgba(0,0,0,.25)',
                    width: 250,
                    height: 56,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textTransform: 'capitalize',
                  }}
                >
                  Sign In
                </Clickable>
              </div>
            )}
            <NavSection href={Nav.getLink('workspaces')} onClick={hideNav}>
              <Icon icon='view-cards' size={24} style={navIconStyles} />
              Workspaces
            </NavSection>
            <DropDownSection
              titleIcon='library'
              title='Library'
              onClick={() => setOpenLibraryMenu(!openLibraryMenu)}
              isOpened={openLibraryMenu}
            >
              <DropDownSubItem href={Nav.getLink('library-datasets')} onClick={hideNav}>
                Datasets
              </DropDownSubItem>
              <DropDownSubItem href={Nav.getLink('library-showcase')} onClick={hideNav}>
                Featured Workspaces
              </DropDownSubItem>
              <DropDownSubItem href={Nav.getLink('library-code')} onClick={hideNav}>
                Workflows
              </DropDownSubItem>
            </DropDownSection>
            <DropDownSection
              titleIcon='newspaper'
              title='Platform News'
              onClick={() => setOpenPlatformNewsMenu(!openPlatformNewsMenu)}
              isOpened={openPlatformNewsMenu}
            >
              <DropDownSubItem
                href='https://support.terra.bio/hc/en-us/sections/30968105851931-Terra-Roadmap'
                onClick={hideNav}
                {...Utils.newTabLinkProps}
              >
                Terra Roadmap
              </DropDownSubItem>
              <DropDownSubItem href='#feature-preview' onClick={hideNav}>
                Feature Preview
              </DropDownSubItem>
              <DropDownSubItem
                href='https://support.terra.bio/hc/en-us/community/topics/360000500452'
                onClick={hideNav}
                {...Utils.newTabLinkProps}
              >
                Request a Feature
              </DropDownSubItem>
              <DropDownSubItem
                href='https://support.terra.bio/hc/en-us/sections/4414878945819'
                onClick={hideNav}
                {...Utils.newTabLinkProps}
              >
                Release Notes
              </DropDownSubItem>
            </DropDownSection>
            <DropDownSection
              titleIcon='help'
              title='Support'
              onClick={() => setOpenSupportMenu(!openSupportMenu)}
              isOpened={openSupportMenu}
            >
              <DropDownSubItem
                href={window.Appcues ? undefined : 'https://support.terra.bio/hc/en-us/categories/360005881492'}
                onClick={() => {
                  hideNav();
                  window.Appcues?.show('-M3lNP6ncNr-42_78TOX');
                }}
                {...Utils.newTabLinkProps}
              >
                Quickstart Guide
              </DropDownSubItem>
              <DropDownSubItem href='https://support.terra.bio/' onClick={hideNav} {...Utils.newTabLinkProps}>
                Terra Support Home
              </DropDownSubItem>
              {isBaseline() && (
                <DropDownSubItem
                  href='https://support.terra.bio/hc/en-us/sections/360010495892-Baseline'
                  onClick={hideNav}
                  {...Utils.newTabLinkProps}
                >
                  Baseline Documentation
                </DropDownSubItem>
              )}
              <DropDownSubItem
                href='https://support.terra.bio/hc/en-us/community/topics'
                onClick={hideNav}
                {...Utils.newTabLinkProps}
              >
                Community Forum
              </DropDownSubItem>
              {isFirecloud() && (
                <DropDownSubItem
                  href='https://support.terra.bio/hc/en-us/articles/360022694271'
                  onClick={hideNav}
                  {...Utils.newTabLinkProps}
                >
                  What&apos;s different in Terra
                </DropDownSubItem>
              )}
              <DropDownSubItem
                onClick={() => {
                  hideNav();
                  contactUsActive.set(true);
                }}
              >
                Contact Us
              </DropDownSubItem>
              <DropDownSubItem
                href='https://support.terra.bio/hc/en-us/sections/4415104213787'
                onClick={hideNav}
                {...Utils.newTabLinkProps}
              >
                Service Notifications
              </DropDownSubItem>
            </DropDownSection>
            {isFirecloud() && (
              <NavSection
                disabled={signInStatus !== 'userLoaded'}
                tooltip={signInStatus === 'userLoaded' ? undefined : 'Please sign in'}
                onClick={() => {
                  hideNav();
                  setOpenFirecloudModal(true);
                }}
              >
                <div style={navIconStyles}>
                  <img src={fcIconWhite} alt='' style={{ height: 20, width: 20 }} />
                </div>
                Use Classic FireCloud
              </NavSection>
            )}
            <div style={{ borderTop: `1px solid ${colors.dark(0.55)}` }} />
            <div style={{ flex: 'none', padding: 28, marginTop: 'auto' }}>
              {isBioDataCatalyst() && (
                <>
                  <Link
                    variant='light'
                    style={{ display: 'block', textDecoration: 'underline', color: colors.light() }}
                    href={Nav.getLink('privacy')}
                    onClick={hideNav}
                  >
                    Terra Privacy Policy
                  </Link>
                  <Link
                    variant='light'
                    href={Nav.getLink('terms-of-service')}
                    style={{ display: 'block', textDecoration: 'underline', color: colors.light() }}
                    onClick={hideNav}
                  >
                    Terra Terms of Service
                  </Link>
                </>
              )}
              <div style={{ color: 'white', fontSize: 10, fontWeight: 600, marginTop: '0.5rem' }}>
                Built on:
                <Clickable
                  href={`https://github.com/DataBiosphere/terra-ui/commits/${getConfig().gitRevision}`}
                  {...Utils.newTabLinkProps}
                  style={{ textDecoration: 'underline', marginLeft: '0.25rem' }}
                >
                  {new Date(parseInt(getConfig().buildTimestamp, 10)).toLocaleString()}
                </Clickable>
              </div>
            </div>
          </div>
        </div>
      </FocusTrap>
    );
  };

  const mainRef = useRef();

  return (
    <div role='banner' style={{ flex: 'none', display: 'flex', flexFlow: 'column nowrap' }}>
      <SkipNavLink ref={mainRef} />
      <Transition in={navShown} timeout={{ exit: 200 }} mountOnEnter unmountOnExit>
        {(transitionState) => buildNav(transitionState)}
      </Transition>
      <div
        style={{
          ...topBarStyle,
          // This div contains the primary fallback color for a11y which will be used to calculate color contrast when the background is manually hidden
          // A 1.47 intensity results in precisely a 4.5:1 ratio against the white text
          backgroundColor: isTerra() ? colors.primary(1.47) : colors.light(1),
        }}
      >
        <div
          style={{
            background: isTerra() ? `right url(${headerRightHexes})` : undefined,
            backgroundRepeat: 'no-repeat',
            flex: '1 1 auto',
            display: 'flex',
            alignSelf: 'stretch',
            width: '100%',
            alignItems: 'center',
          }}
        >
          {
            showMenu ? (
              <Clickable
                style={{
                  alignSelf: 'stretch',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 1rem',
                  margin: '2px 1rem 0 2px',
                }}
                onClick={navShown ? hideNav : showNav}
                aria-expanded={navShown}
                aria-label='Toggle main menu'
              >
                <Icon
                  icon='bars'
                  size={36}
                  style={{
                    color: isTerra() ? 'white' : colors.accent(),
                    flex: 'none',
                    transform: navShown ? 'rotate(90deg)' : undefined,
                    transition: 'transform 0.1s ease-out',
                  }}
                />
              </Clickable>
            ) : (
              <div style={{ width: 'calc(1rem + 1rem + 1rem + 2px + 36px)' }} />
            ) // padding (l+r) + margin (l+r) + icon size
          }
          <a style={{ ...pageTitleStyles, display: 'flex', alignItems: 'center' }} href={href || Nav.getLink('root')}>
            {topBarLogo()}
            <div>{title && <h1 style={{ fontSize: '1em', fontWeight: 500, padding: 0, margin: 0 }}>{title}</h1>}</div>
          </a>
          <div style={{ display: 'flex', flexGrow: 1 }}>{children}</div>
          <AlertsIndicator
            style={{
              margin: '0 1rem 0 0.5rem',
              color: isTerra() ? 'white' : colors.dark(),
            }}
          />
          {openFirecloudModal && <PreferFirecloudModal onDismiss={() => setOpenFirecloudModal(false)} />}
        </div>
      </div>
      <RequiredUpdateAlert />
      <SkipNavTarget ref={mainRef} />
    </div>
  );
};

const PreferFirecloudModal = ({ onDismiss }) => {
  const [emailAgreed, setEmailAgreed] = useState<boolean>(true);
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const user = useStore(userStore);
  const {
    profile: { firstName, lastName },
  } = user;
  const email = user.profile.contactEmail ?? user.terraUser.email ?? '';
  const currUrl = window.location.href;

  const returnToLegacyFC = _.flow(
    withErrorReporting('Error opting out of Terra'),
    Utils.withBusyState(setSubmitting)
  )(async () => {
    await User().profile.preferLegacyFirecloud();
    if (emailAgreed === true || reason.length !== 0) {
      await Support().createSupportRequest({
        name: `${firstName} ${lastName}`,
        email,
        description: reason,
        subject: 'Opt out of Terra',
        type: 'survey',
        attachmentToken: '',
        emailAgreed,
        currUrl,
      });
    }
    onDismiss();
    window.location.assign(getConfig().firecloudUrlRoot);
  });

  const reasonContainerId = useUniqueId();
  return (
    <Modal onDismiss={onDismiss} title='Return to classic FireCloud' okButton={returnToLegacyFC}>
      Are you sure you would prefer the previous FireCloud interface?
      <FormLabel htmlFor={reasonContainerId}>Please tell us why</FormLabel>
      <TextArea
        id={reasonContainerId}
        style={{ height: 100, marginBottom: '0.5rem' }}
        placeholder='Enter your reason'
        value={reason}
        onChange={setReason}
      />
      <LabeledCheckbox checked={emailAgreed} onChange={setEmailAgreed}>
        <span style={{ marginLeft: '0.5rem' }}>You can follow up with me by email.</span>
      </LabeledCheckbox>
      {submitting && <SpinnerOverlay />}
    </Modal>
  );
};
