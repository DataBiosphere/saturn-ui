import { Clickable, icon, Link } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import React from 'react';
import FooterWrapper from 'src/components/FooterWrapper';
import { libraryTopMatter } from 'src/components/library-common';
import terraLogo from 'src/images/brands/terra/logo.svg';
import dockstoreLogo from 'src/images/library/workflows/dockstore.svg';
import { Metrics } from 'src/libs/ajax/Metrics';
import colors from 'src/libs/colors';
import { getConfig } from 'src/libs/config';
import Events, { MetricsEventName } from 'src/libs/events';
import * as Nav from 'src/libs/nav';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';
import { CuratedWorkflowDetails, curatedWorkflowsList } from 'src/pages/library/workflows/curated-workflows-utils';

const styles = {
  header: {
    fontSize: 22,
    color: colors.dark(),
    fontWeight: 500,
    lineHeight: '22px',
    marginBottom: '1rem',
  },
};

interface LogoTileProps {
  logoFilePath: string;
  logoName: string;
}

const LogoTile = (props: LogoTileProps) => {
  return (
    <div
      style={{
        display: 'inline-flex',
        justifyContent: 'center',
        alignItems: 'center',
        flex: 'none',
        width: 52,
        height: 52,
        paddingBottom: '12px',
        marginTop: '10px',
      }}
    >
      <img src={props.logoFilePath} alt={props.logoName} />
    </div>
  );
};

interface WorkflowSourceBoxProps {
  title: string;
  description: string;
  url: string;
  logoFilePath: string;
  metricsEventName: MetricsEventName;
}

const WorkflowSourceBox = (props: WorkflowSourceBoxProps) => {
  const sendMetrics = () => {
    void Metrics().captureEvent(props.metricsEventName);
  };

  return (
    <Clickable href={props.url} {...Utils.newTabLinkProps} onClick={() => sendMetrics()}>
      <div
        style={{
          width: 400,
          height: 220,
          backgroundColor: colors.accent(0.08),
          padding: '0.8em',
          borderRadius: '8px',
          lineHeight: '18px',
          boxShadow: `3px 3px ${colors.grey(0.2)}`,
        }}
      >
        <div style={{ marginLeft: '10px', marginTop: '4px' }}>
          <LogoTile logoFilePath={props.logoFilePath} logoName={`${props.title} logo`} />
          <div style={{ fontSize: '1rem', fontWeight: 600, color: colors.accent(1.1), marginTop: '5px' }}>
            {props.title}
          </div>
          <p style={{ height: '55px' }}>{props.description}</p>
          <div style={{ bottom: 0 }}>
            {icon('pop-out', {
              size: 18,
              style: { color: colors.accent(1) },
            })}
          </div>
        </div>
      </div>
    </Clickable>
  );
};

const CuratedWorkflowsSection = () => {
  const dockstoreUrlRoot: string = getConfig().dockstoreUrlRoot;

  return (
    <div>
      <div style={{ marginTop: '25px' }}>
        <p style={{ fontSize: '1rem', fontWeight: 600 }}>Curated collections from our community:</p>
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          flexDirection: 'row',
          height: '100%',
          position: 'relative',
        }}
      >
        {_.map((wf: CuratedWorkflowDetails) => {
          return (
            <Clickable
              key={wf.key}
              href={wf.url}
              {...Utils.newTabLinkProps}
              style={{
                ...Style.elements.card.container,
                width: 150,
                height: 110,
                margin: '0 1rem 2rem 0',
                color: colors.accent(1),
              }}
            >
              <div>{wf.title}</div>
              <div style={{ bottom: 0 }}>{icon('pop-out', { size: 14, style: { marginLeft: '0.25rem' } })}</div>
            </Clickable>
          );
        }, curatedWorkflowsList(dockstoreUrlRoot))}
      </div>
    </div>
  );
};

export const WorkflowsLibrary = () => {
  const dockstoreUrl = `${getConfig().dockstoreUrlRoot}/search?_type=workflow&descriptorType=WDL&searchMode=files`;

  const workflowsRepoUrl: string = Nav.getLink('workflows');
  const workflowsRepoLogo = terraLogo;

  return (
    <FooterWrapper alwaysShow>
      {libraryTopMatter('workflows')}
      <main style={{ flexGrow: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'row', height: '100%', flex: 1 }}>
          <div style={{ width: '80%', display: 'flex' }}>
            <div style={{ flex: 1, margin: '30px 0 30px 40px' }}>
              <div style={styles.header}>Discover Workflows</div>
              <div style={{ display: 'flex', marginTop: '0.25rem' }}>
                <div>
                  <WorkflowSourceBox
                    title='Dockstore.org'
                    description='A community repository of public workflows that offers publishing features and automatic integration with GitHub.'
                    url={dockstoreUrl}
                    logoFilePath={dockstoreLogo}
                    metricsEventName={Events.libraryWorkflowsDockstore}
                  />
                </div>
                <div style={{ marginLeft: 20 }}>
                  <WorkflowSourceBox
                    title='Terra Workflow Repository'
                    description='A repository of WDL workflows that offers quick hosting of public and private workflows.'
                    url={workflowsRepoUrl}
                    logoFilePath={workflowsRepoLogo}
                    metricsEventName={Events.libraryWorkflowsTerraRepo}
                  />
                </div>
              </div>
              <CuratedWorkflowsSection />
            </div>
          </div>
          <div
            style={{
              width: '20%',
              padding: '25px 30px',
              backgroundColor: colors.light(0.7),
              lineHeight: '20px',
            }}
          >
            <div style={{ fontSize: '1rem', fontWeight: 600 }}>Helpful Workflow support links</div>
            <p>Learn how to configure your workflow analysis, including options to save time and money.</p>
            <div>
              <ul>
                <li>
                  <Link
                    style={{ color: colors.accent(1.1) }}
                    href='https://support.terra.bio/hc/en-us/articles/4411260552603'
                    {...Utils.newTabLinkProps}
                  >
                    Importing Workflows in Terra
                  </Link>
                </li>
                <li>
                  <Link
                    style={{ color: colors.accent(1.1) }}
                    href='https://support.terra.bio/hc/en-us/articles/360036379771'
                    {...Utils.newTabLinkProps}
                  >
                    Overview: Running Workflows in Terra
                  </Link>
                </li>
                <li>
                  <Link
                    style={{ color: colors.accent(1.1) }}
                    href='https://support.terra.bio/hc/en-us/sections/4408366335131'
                    {...Utils.newTabLinkProps}
                  >
                    Workflows setup
                  </Link>
                </li>
              </ul>
            </div>
            <p>
              For more documentation on Workflows, visit the
              <Link
                style={{ color: colors.accent(1.1) }}
                href='https://support.terra.bio/hc/en-us/sections/360004147011'
                {...Utils.newTabLinkProps}
              >
                {' '}
                Terra Support Site
              </Link>
              .
            </p>
          </div>
        </div>
      </main>
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
