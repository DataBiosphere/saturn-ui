import { icon, Link, Modal } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import React from 'react';
import { Metrics } from 'src/libs/ajax/Metrics';
import colors from 'src/libs/colors';
import { getConfig } from 'src/libs/config';
import Events, { MetricsEventName } from 'src/libs/events';
import * as Nav from 'src/libs/nav';
import * as Utils from 'src/libs/utils';
import { CuratedWorkflowDetails, curatedWorkflowsList } from 'src/pages/library/workflows/curated-workflows-utils';

interface WorkflowSourceCardProps {
  title: string;
  description: string;
  url: string;
  openInNewTab: boolean;
  metricsEventName: MetricsEventName;
}

const WorkflowSourceCard = (props: WorkflowSourceCardProps) => {
  const sendMetrics = () => {
    void Metrics().captureEvent(props.metricsEventName);
  };

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
          <Link href={props.url} {...(props.openInNewTab ? Utils.newTabLinkProps : {})} onClick={() => sendMetrics()}>
            {props.title}
            {props.openInNewTab && icon('pop-out', { size: 12, style: { marginLeft: '0.25rem', marginBottom: '1px' } })}
          </Link>
        </h4>
        <p>{props.description}</p>
      </div>
    </div>
  );
};

const CuratedDockstoreWorkflowsSection = () => {
  const dockstoreUrlRoot: string = getConfig().dockstoreUrlRoot;

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
        }, curatedWorkflowsList(dockstoreUrlRoot))}
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
  const workflowsRepoUrl = Nav.getLink('workflows');

  return (
    <Modal onDismiss={onDismiss} title='Find a workflow' showCancel okButton={false} showX width={870}>
      <div style={{ display: 'flex', padding: '0.5rem', marginTop: '0.25rem' }}>
        <div style={{ flex: 1 }}>
          <WorkflowSourceCard
            title='Dockstore.org'
            description=' A community repository of best practice workflows that offers integration with GitHub.'
            url={dockstoreUrl}
            openInNewTab
            metricsEventName={Events.workspaceFindWorkflowDockstore}
          />
        </div>
        <div style={{ flex: 1, marginLeft: 20 }}>
          <WorkflowSourceCard
            title='Terra Workflow Repository'
            description='A repository of WDL workflows that offers private workflows hosted in the platform.'
            url={workflowsRepoUrl}
            openInNewTab={false}
            metricsEventName={Events.workspaceFindWorkflowTerraRepo}
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
