import _ from 'lodash/fp';
import { useState } from 'react';
import { div, h, h2 } from 'react-hyperscript-helpers';
import FooterWrapper from 'src/components/FooterWrapper';
import { MarkdownViewer } from 'src/components/markdown';
import SignInButton from 'src/components/SignInButton';
import { TopBar } from 'src/components/TopBar';
import { FirecloudBucket } from 'src/libs/ajax/firecloud/FirecloudBucket';
import { useOnMount } from 'src/libs/react-utils';
import * as StateHistory from 'src/libs/state-history';
import * as Style from 'src/libs/style';

const signInStyle = {
  backgroundColor: 'white',
  padding: '1rem 1rem',
  marginTop: '2rem',
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 5,
  textAlign: 'center',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: 20,
};

const DashboardPublic = ({ namespace, name }) => {
  const stateHistory = StateHistory.get();
  const [showcaseList, setShowcaseList] = useState(stateHistory.featuredList);

  useOnMount(() => {
    const loadData = async () => {
      const showcaseList = await FirecloudBucket().getShowcaseWorkspaces();
      setShowcaseList(showcaseList);
      StateHistory.update({ showcaseList });
    };

    loadData();
  });

  const workspace = _.find({ namespace, name }, showcaseList);

  return h(FooterWrapper, [
    h(TopBar, [div({ style: Style.breadcrumb.breadcrumb }, [h2({ style: Style.breadcrumb.textUnderBreadcrumb }, [`${namespace}/${name}`])])]),
    div({ style: { flex: 1, display: 'flex' } }, [
      div({ style: Style.dashboard.leftBox }, [
        div({ style: Style.dashboard.header }, ['About the workspace']),
        workspace?.description && h(MarkdownViewer, [workspace.description]),
      ]),
      div({ style: Style.dashboard.rightBox }, [
        div({ style: signInStyle }, [div(['Sign in to view full workspace']), div([h(SignInButton, { theme: 'dark' })])]),
      ]),
    ]),
  ]);
};

export default DashboardPublic;
