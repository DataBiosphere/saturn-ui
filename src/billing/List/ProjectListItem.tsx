import { Clickable, Icon } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import * as qs from 'qs';
import React, { useState } from 'react';
import { BillingProjectActions, BillingProjectActionsProps } from 'src/billing/List/BillingProjectActions';
import { billingRoles, isCreating, isDeleting, isErrored } from 'src/billing/utils';
import { BillingProject } from 'src/billing-core/models';
import { CloudProviderIcon } from 'src/components/CloudProviderIcon';
import { InfoBox } from 'src/components/InfoBox';
import { Metrics } from 'src/libs/ajax/Metrics';
import colors from 'src/libs/colors';
import Events, { extractBillingDetails } from 'src/libs/events';
import * as Nav from 'src/libs/nav';
import * as Style from 'src/libs/style';
import { isKnownCloudProvider } from 'src/workspaces/utils';

const listItemStyle = (selected, hovered) => {
  const style = {
    ...Style.navList.itemContainer(selected),
    ...Style.navList.item(selected),
    ...(selected ? { backgroundColor: colors.dark(0.1) } : {}),
    paddingLeft: '2rem',
  };
  if (hovered) {
    return {
      ...style,
      ...Style.navList.itemHover(selected),
    };
  }
  return style;
};

export interface ProjectListItemProps {
  project: BillingProject;
  isActive: boolean;
  billingProjectActionsProps: BillingProjectActionsProps;
}

export const ProjectListItem = (props: ProjectListItemProps) => {
  const [hovered, setHovered] = useState<boolean>();

  const { projectName, roles, status, message, cloudPlatform } = props.project;
  const viewerRoles = _.intersection(roles, _.values(billingRoles));
  const isOwner = _.includes(billingRoles.owner, roles);

  // Billing projects in an error status may have UNKNOWN for the cloudPlatform.
  const cloudContextIcon = isKnownCloudProvider(cloudPlatform) && (
    <span style={{ marginRight: '0.5rem' }}>
      <CloudProviderIcon cloudProvider={cloudPlatform} />
    </span>
  );

  const projectNameElement = <span style={{ wordBreak: 'break-all' }}>{projectName}</span>;

  const actionElement = isOwner && <BillingProjectActions {...props.billingProjectActionsProps} />;

  const renderSelectableProject = () => (
    <div
      style={{ ...listItemStyle(props.isActive, hovered) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Clickable
        style={{
          display: 'flex',
          alignItems: 'center',
          color: props.isActive ? colors.accent(1.1) : colors.accent(),
        }}
        href={`${Nav.getLink('billing')}?${qs.stringify({ selectedName: projectName, type: 'project' })}`}
        onClick={() =>
          void Metrics().captureEvent(Events.billingProjectOpenFromList, extractBillingDetails(props.project))
        }
        aria-current={props.isActive ? 'location' : false}
      >
        {cloudContextIcon}
        {projectNameElement}
      </Clickable>
      {actionElement}
    </div>
  );

  const renderUnselectableProject = () => {
    const isCreatingOrDeleting = isCreating(props.project) || isDeleting(props.project);

    const iconAndTooltip = (
      <>
        {isCreatingOrDeleting && (
          <>
            <Icon
              icon='syncAlt'
              size={14}
              style={{
                color: isCreating(props.project) ? colors.success() : colors.warning(),
                animation: 'rotation 2s infinite linear',
                marginLeft: 'auto',
                marginRight: '0.25rem',
              }}
            />
            <span style={{ paddingLeft: '0.25rem', fontSize: 12, fontStyle: 'italic' }}>
              {isCreating(props.project) ? 'Creating' : 'Deleting'}
            </span>
          </>
        )}
        {isErrored(props.project) && (
          <>
            <InfoBox style={{ color: colors.danger(), marginLeft: '0.5rem' }} side='right'>
              <div style={{ wordWrap: 'break-word', whiteSpace: 'pre-wrap' }}>
                {message || `Error during billing project ${status === 'DeletionFailed' ? 'deletion' : 'creation'}.`}
              </div>
            </InfoBox>
            {actionElement}
          </>
        )}
      </>
    );

    return (
      <div style={{ ...listItemStyle(props.isActive, false), color: colors.dark() }}>
        {cloudContextIcon}
        {projectNameElement}
        {iconAndTooltip}
      </div>
    );
  };

  return (
    <div role='listitem'>
      {!_.isEmpty(viewerRoles) && status === 'Ready' ? renderSelectableProject() : renderUnselectableProject()}
    </div>
  );
};
