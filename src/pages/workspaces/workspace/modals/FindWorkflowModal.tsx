import { icon, Link, Modal } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import React from 'react';
import { getEnabledBrand } from 'src/libs/brand-utils';
import colors from 'src/libs/colors';
import { getConfig } from 'src/libs/config';
import { isFeaturePreviewEnabled } from 'src/libs/feature-previews';
import { FIRECLOUD_UI_MIGRATION } from 'src/libs/feature-previews-config';
import * as Nav from 'src/libs/nav';
import * as Utils from 'src/libs/utils';

interface WorkflowSourceCardProps {
  title: string;
  description: string;
  url: string;
  openInNewTab: boolean;
}

const WorkflowSourceCard = (props: WorkflowSourceCardProps) => {
  return (
    <div
      style={{
        backgroundColor: colors.accent(0.1),
        padding: '0.8em',
        borderRadius: '8px',
        lineHeight: '18px',
      }}
    >
      <div style={{ marginLeft: '10px' }}>
        <h4>
          <Link href={props.url} {...(props.openInNewTab ? Utils.newTabLinkProps : {})}>
            {props.title}
            {props.openInNewTab && icon('pop-out', { size: 12, style: { marginLeft: '0.25rem', marginBottom: '1px' } })}
          </Link>
        </h4>
        <p>{props.description}</p>
      </div>
    </div>
  );
};

interface CuratedWorkflowDetails {
  key: string; // used as a key for list items
  title: string;
  url: string;
}

const CuratedDockstoreWorkflowsSection = () => {
  const dockstoreUrlRoot: string = getConfig().dockstoreUrlRoot;

  const curatedWorkflowsList: Array<CuratedWorkflowDetails> = [
    {
      key: 'gatk',
      title: 'GATK Best Practices',
      url: `${dockstoreUrlRoot}/organizations/BroadInstitute/collections/GATKWorkflows`,
    },
    {
      key: 'longRead',
      title: 'Long Read Pipelines',
      url: `${dockstoreUrlRoot}/organizations/BroadInstitute/collections/LongReadPipelines`,
    },
    {
      key: 'warp',
      title: 'WDL Analysis Research Pipelines',
      url: `${dockstoreUrlRoot}/organizations/BroadInstitute/collections/WARPpipelines`,
    },
    {
      key: 'vg',
      title: 'Viral Genomics',
      url: `${dockstoreUrlRoot}/organizations/BroadInstitute/collections/pgs`,
    },
  ];

  return (
    <div>
      <strong>Curated collections from our community:</strong>
      <div style={{ display: 'flex', flexWrap: 'wrap', paddingTop: 5 }}>
        {_.map((wf: CuratedWorkflowDetails) => {
          return (
            <div key={wf.key} style={{ width: 350, height: 20 }}>
              <Link href={wf.url} {...Utils.newTabLinkProps}>
                {wf.title}
                {icon('pop-out', { size: 12, style: { marginLeft: '0.25rem', marginBottom: '1px' } })}
              </Link>
            </div>
          );
        }, curatedWorkflowsList)}
      </div>
    </div>
  );
};

interface FindWorkflowModalProps {
  onDismiss: () => void;
}

export const FindWorkflowModal = (props: FindWorkflowModalProps) => {
  const { onDismiss } = props;

  const dockstoreUrl = `${getConfig().dockstoreUrlRoot}/search?_type=workflow&descriptorType=WDL&searchMode=files`;
  const workflowsRepoUrl: string = isFeaturePreviewEnabled(FIRECLOUD_UI_MIGRATION)
    ? Nav.getLink('workflows')
    : `${getConfig().firecloudUrlRoot}/?return=${getEnabledBrand().queryName}#methods`;

  return (
    <Modal onDismiss={onDismiss} title='Find a workflow' showCancel okButton={false} showX width={870}>
      <div style={{ display: 'flex', padding: '0.5rem', marginTop: '0.25rem' }}>
        <div style={{ flex: 1 }}>
          <WorkflowSourceCard
            title='Dockstore.org'
            description=' A community repository of best practice workflows that offers integration with GitHub.'
            url={dockstoreUrl}
            openInNewTab
          />
        </div>
        <div style={{ flex: 1, marginLeft: 20 }}>
          <WorkflowSourceCard
            title='Terra Workflow Repository'
            description='A repository of WDL workflows that offers private workflows hosted in the platform.'
            url={workflowsRepoUrl}
            openInNewTab={false}
          />
        </div>
      </div>
      <div style={{ marginTop: '2rem' }}>
        <CuratedDockstoreWorkflowsSection />
      </div>
      <div style={{ marginTop: '2rem' }}>
        <p>
          Visit
          <Link href='https://support.terra.bio/hc/en-us/sections/360004147011' {...Utils.newTabLinkProps}>
            {' '}
            our documentation{' '}
          </Link>
          to learn how to import and configure your workflow, as well as how to save time and money.
        </p>
      </div>
    </Modal>
  );
};
