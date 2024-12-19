import { icon, Link } from '@terra-ui-packages/components';
import React from 'react';
import FooterWrapper from 'src/components/FooterWrapper';
import { libraryTopMatter } from 'src/components/library-common';
import { getEnabledBrand } from 'src/libs/brand-utils';
import colors from 'src/libs/colors';
import { getConfig } from 'src/libs/config';
import { isFeaturePreviewEnabled } from 'src/libs/feature-previews';
import { FIRECLOUD_UI_MIGRATION } from 'src/libs/feature-previews-config';
import * as Nav from 'src/libs/nav';
import * as Utils from 'src/libs/utils';

const styles = {
  header: {
    fontSize: 22,
    color: colors.dark(),
    fontWeight: 500,
    lineHeight: '22px',
    marginBottom: '1rem',
  },
};

interface WorkflowSourceBoxProps {
  title: string;
  description: string;
  url: string;
}

const WorkflowSourceBox = (props: WorkflowSourceBoxProps) => {
  return (
    <div
      style={{
        width: 400,
        height: 150,
        backgroundColor: colors.accent(0.08),
        padding: '0.8em',
        borderRadius: '8px',
        lineHeight: '18px',
        boxShadow: `3px 3px ${colors.grey(0.2)}`,
      }}
    >
      <div style={{ marginLeft: '10px', marginTop: '10px' }}>
        {/* <LogoTile /> // ???? */}
        <div style={{ fontSize: '1rem', fontWeight: 600, color: colors.accent(1) }}>{props.title}</div>
        <p>{props.description}</p>
        <p style={{ marginBottom: '-10px' }}>
          <Link href={props.url} {...Utils.newTabLinkProps}>
            {icon('pop-out', { size: 18, style: { marginLeft: '0.25rem', marginBottom: '1px' } })}
          </Link>
        </p>
      </div>
    </div>
  );
};

export const WorkflowsLibrary = () => {
  const dockstoreUrl = `${getConfig().dockstoreUrlRoot}/search?_type=workflow&descriptorType=WDL&searchMode=files`;
  const workflowsRepoUrl: string = isFeaturePreviewEnabled(FIRECLOUD_UI_MIGRATION)
    ? Nav.getLink('workflows')
    : `${getConfig().firecloudUrlRoot}/?return=${getEnabledBrand().queryName}#methods`;

  return (
    <FooterWrapper alwaysShow>
      {libraryTopMatter('workflows')}
      <div role='main' style={{ flexGrow: 1 }}>
        <div style={{ display: 'flex', flex: 1 }}>
          <div style={{ flex: 1, margin: '30px 0 30px 40px' }}>
            <div style={styles.header}>Discover Workflows</div>
            <div style={{ display: 'flex', padding: '0.5rem', marginTop: '0.25rem' }}>
              <div style={{ flex: 1 }}>
                <WorkflowSourceBox
                  title='Dockstore.org'
                  description='A community repository of public workflows that offers automatic integration with GitHub and publishing features.'
                  url={dockstoreUrl}
                />
              </div>
              <div style={{ flex: 1, marginLeft: 20 }}>
                <WorkflowSourceBox
                  title='Broad Methods Repository'
                  description='A repository of WDL workflows that offers quick hosting of public and private workflows.'
                  url={workflowsRepoUrl}
                />
              </div>
            </div>
          </div>
          <div style={{ width: 385, padding: '25px 30px', backgroundColor: colors.light(0.7), lineHeight: '20px' }}>
            <div style={{ flex: 1, fontSize: '1rem', fontWeight: 600 }}>Helpful Workflow support links</div>
            <p>Learn how to configure your workflow analysis, including options to save time and money.</p>
            <p>
              <ul>
                <li>
                  <Link href='https://support.terra.bio/hc/en-us/articles/4411260552603' {...Utils.newTabLinkProps}>
                    Importing Workflows in Terra
                  </Link>
                </li>
                <li>
                  <Link href='https://support.terra.bio/hc/en-us/articles/360036379771' {...Utils.newTabLinkProps}>
                    Overview: Running Workflows in Terra
                  </Link>
                </li>
                <li>
                  <Link href='https://support.terra.bio/hc/en-us/sections/4408366335131' {...Utils.newTabLinkProps}>
                    Workflows setup
                  </Link>
                </li>
              </ul>
            </p>
            <p>
              For more documentation on Workflows, visit the
              <Link href='https://support.terra.bio/hc/en-us/sections/360004147011' {...Utils.newTabLinkProps}>
                {' '}
                Terra Support Site
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </FooterWrapper>
  );
};

export const navPaths = [
  {
    name: 'library-workflows',
    path: '/library/workflows',
    component: WorkflowsLibrary,
    public: false,
    title: 'Workflows',
  },
];
