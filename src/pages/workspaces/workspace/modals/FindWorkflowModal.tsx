import { icon, Link, Modal } from '@terra-ui-packages/components';
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
  link: string;
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
          <Link href={props.link} {...(props.openInNewTab ? Utils.newTabLinkProps : {})}>
            {props.title}
            {props.openInNewTab
              ? icon('pop-out', { size: 12, style: { marginLeft: '0.25rem', marginBottom: '1px' } })
              : ''}
          </Link>
        </h4>
        <p>{props.description}</p>
        <p>{props.openInNewTab}</p>
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
  const workflowsRepoUrl = isFeaturePreviewEnabled(FIRECLOUD_UI_MIGRATION)
    ? Nav.getLink('workflows')
    : `${getConfig().firecloudUrlRoot}/?return=${getEnabledBrand().queryName}#methods`;

  return (
    <Modal onDismiss={onDismiss} title='Find a workflow' showCancel okButton={false} showX width={900}>
      <div style={{ display: 'flex', padding: '0.5rem', marginTop: '0.25rem' }}>
        <div style={{ flex: 1 }}>
          <WorkflowSourceCard
            title='Dockstore.org'
            description=' A community repository of best practice workflows that offers integration with GitHub.'
            link={dockstoreUrl}
            openInNewTab
          />
        </div>
        <div style={{ flex: 1, marginLeft: 20 }}>
          <WorkflowSourceCard
            title='Broad Methods Repository'
            description='A repository of WDL workflows that offers private workflows hosted in the platform.'
            link={workflowsRepoUrl}
            openInNewTab={false}
          />
        </div>
      </div>
      <div style={{ marginTop: '2rem' }}>
        <strong>Curated collections from our community:</strong>
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
