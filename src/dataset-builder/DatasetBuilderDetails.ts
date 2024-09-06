import { useLoadedData } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import { div, h, h1, h3 } from 'react-hyperscript-helpers';
import { ButtonOutline, spinnerOverlay } from 'src/components/common';
import FooterWrapper from 'src/components/FooterWrapper';
import { MarkdownViewer } from 'src/components/markdown';
import { TopBar } from 'src/components/TopBar';
import { DataRepo, SnapshotBuilderSettings } from 'src/libs/ajax/DataRepo';
import colors from 'src/libs/colors';
import { withErrorReporting } from 'src/libs/error';
import * as Nav from 'src/libs/nav';
import { useOnMount } from 'src/libs/react-utils';

import { DatasetBuilderBreadcrumbs } from './Breadcrumbs';

interface DomainDisplayProps {
  title: string;
  displayInformation: {
    name: string;
    participantCount?: number;
    conceptCount?: number;
  }[];
}

const TileDisplay = (props: DomainDisplayProps) => {
  const { title, displayInformation } = props;
  return div([
    h3([title]),
    div({ style: { display: 'flex', flexWrap: 'wrap' } }, [
      _.map(
        (displayTile) =>
          div(
            {
              style: {
                width: '30%',
                height: '10rem',
                backgroundColor: 'white',
                padding: '0.5rem 2rem',
                marginTop: '1rem',
                marginRight: '1rem',
                border: `1px solid ${colors.light()}`,
              },
              key: displayTile.name,
            },
            [
              h3([displayTile.name]),
              div({ style: { display: 'flex', alignItems: 'baseline' } }, [
                div({ style: { fontSize: 30, fontWeight: 600 } }, [
                  displayTile.conceptCount ? `${displayTile.conceptCount / 1000}K` : 'UNKNOWN',
                ]),
                div({ style: { fontSize: 20, marginLeft: '0.5rem' } }, ['concepts']),
              ]),
              div({ style: { fontSize: 20, marginTop: '0.5rem' } }, [
                displayTile.participantCount ? `${displayTile.participantCount} participants` : 'UNKNOWN',
              ]),
            ]
          ),
        displayInformation
      ),
    ]),
  ]);
};

interface DatasetBuilderDetailsProps {
  snapshotId: string;
}

export const DatasetBuilderDetails = ({ snapshotId }: DatasetBuilderDetailsProps) => {
  const [snapshotBuilderSettings, loadSnapshotBuilderSettings] = useLoadedData<SnapshotBuilderSettings>();
  const [snapshotRoles, loadSnapshotRoles] = useLoadedData<string[]>();
  const hasAggregateDataViewerAccess =
    snapshotRoles.status === 'Ready'
      ? _.intersection(['aggregate_data_reader'], snapshotRoles.state).length > 0
      : false;

  useOnMount(() => {
    void loadSnapshotRoles(
      withErrorReporting(`Error loading roles for snapshot ${snapshotId}`)(() =>
        DataRepo().snapshot(snapshotId).roles()
      )
    );
    void loadSnapshotBuilderSettings(
      withErrorReporting(`Error loading snapshot builder settings for ${snapshotId}`)(() =>
        DataRepo().snapshot(snapshotId).getSnapshotBuilderSettings()
      )
    );
  });

  return snapshotBuilderSettings.status === 'Ready' && snapshotRoles.status === 'Ready'
    ? h(FooterWrapper, [
        h(TopBar, { title: 'Preview', href: '' }, []),
        div({ style: { padding: '2rem' } }, [
          h(DatasetBuilderBreadcrumbs, {
            breadcrumbs: [{ link: Nav.getLink('library-datasets'), title: 'Data Browser' }],
          }),
          h1({ style: { marginTop: '0.75rem' } }, [snapshotBuilderSettings.state.name]),
          div({ style: { display: 'flex', justifyContent: 'space-between' } }, [
            h(MarkdownViewer, [snapshotBuilderSettings.state.description]),
            div({ style: { width: '22rem', backgroundColor: 'white', padding: '1rem', marginLeft: '1rem' } }, [
              div([
                'Use the Data Explorer to create specific tailored data snapshots for analysis in a Terra Workspace',
              ]),
              h(
                ButtonOutline,
                {
                  style: { width: '100%', borderRadius: 0, marginTop: '1rem', textTransform: 'none' },
                  // TODO: Get link for learn how to get access
                  href: !hasAggregateDataViewerAccess
                    ? encodeURIComponent(Nav.getLink('root'))
                    : Nav.getLink('dataset-builder', { snapshotId }),
                },
                [hasAggregateDataViewerAccess ? 'Create data snapshots' : 'Learn how to gain access']
              ),
              div({ style: { marginTop: '1rem', color: colors.dark(), fontStyle: 'italic' } }, [
                '* All data snapshots will need to be reviewed and approved before any analyses can be done',
              ]),
            ]),
          ]),
          h(TileDisplay, {
            title: 'EHR Domains',
            displayInformation: snapshotBuilderSettings.state.domainOptions,
          }),
        ]),
      ])
    : spinnerOverlay;
};
