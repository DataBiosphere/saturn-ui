import { Clickable } from '@terra-ui-packages/components';
import { div, h } from 'react-hyperscript-helpers';
import { CloudProviderIcon } from 'src/components/CloudProviderIcon';
import { Ajax } from 'src/libs/ajax';
import colors from 'src/libs/colors';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import * as Nav from 'src/libs/nav';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';
import { getCloudProviderFromWorkspace } from 'src/workspaces/utils';

export const RecentlyViewedWorkspaceCard = ({ workspace, timestamp }) => {
  const {
    workspace: { namespace, name },
  } = workspace;

  const dateViewed = Utils.makeCompleteDate(new Date(parseInt(timestamp)).toString());

  return h(
    Clickable,
    {
      style: {
        ...Style.elements.card.container,
        maxWidth: 'calc(25% - 10px)',
        margin: '0 0.25rem',
        lineHeight: '1.5rem',
        flex: '0 1 calc(25% - 10px)',
      },
      href: Nav.getLink('workspace-dashboard', { namespace, name }),
      onClick: () => {
        Ajax().Metrics.captureEvent(Events.workspaceOpenFromRecentlyViewed, extractWorkspaceDetails(workspace.workspace));
      },
    },
    [
      div({ style: { flex: 'none' } }, [
        div({ style: { color: colors.accent(), ...Style.noWrapEllipsis, fontSize: 16, marginBottom: 7 } }, name),
        div({ style: { display: 'flex', justifyContent: 'space-between' } }, [
          div({ style: { ...Style.noWrapEllipsis, whiteSpace: 'pre-wrap', fontStyle: 'italic' } }, [`Viewed ${dateViewed}`]),
          div({ style: { display: 'flex', alignItems: 'center' } }, [
            h(CloudProviderIcon, { cloudProvider: getCloudProviderFromWorkspace(workspace), style: { marginLeft: 5 } }),
          ]),
        ]),
      ]),
    ]
  );
};
