import * as _ from 'lodash/fp';
import { useState } from 'react';
import { a, div, h } from 'react-hyperscript-helpers';
import { CloudProviderIcon } from 'src/components/CloudProviderIcon';
import FooterWrapper from 'src/components/FooterWrapper';
import { libraryTopMatter } from 'src/components/library-common';
import { FirstParagraphMarkdownViewer } from 'src/components/markdown';
import covidBg from 'src/images/library/showcase/covid-19.jpg';
import featuredBg from 'src/images/library/showcase/featured-workspace.svg';
import gatkLogo from 'src/images/library/showcase/gatk-logo-light.svg';
import { FirecloudBucket } from 'src/libs/ajax/firecloud/FirecloudBucket';
import colors from 'src/libs/colors';
import { withErrorReporting } from 'src/libs/error';
import * as Nav from 'src/libs/nav';
import { useOnMount } from 'src/libs/react-utils';
import * as StateHistory from 'src/libs/state-history';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';
import { SearchAndFilterComponent } from 'src/pages/library/SearchAndFilterComponent';
import { cloudProviderLabels, cloudProviderTypes } from 'src/workspaces/utils';

// Description of the structure of the sidebar. Case is preserved when rendering but all matching is case-insensitive.
// All workspaces match by their tags
export const sidebarSections = _.map(
  (section) => ({ matchBy: (workspace, value) => _.contains(_.toLower(value), workspace.tags.items), ...section }),
  [
    {
      header: 'Cloud Platform',
      values: [cloudProviderLabels.GCP, cloudProviderLabels.AZURE],
    },
    {
      header: 'Getting Started',
      values: ['Workflow Tutorials', 'Notebook Tutorials', 'Data Tutorials', 'RStudio Tutorials', 'Galaxy Tutorials'],
    },
    {
      header: 'Analysis Tools',
      values: ['WDLs', 'Jupyter Notebooks', 'RStudio', 'Galaxy', 'Hail', 'Bioconductor', 'GATK', 'Cumulus', 'Spark'],
    },
    {
      header: 'Experimental Strategy',
      values: [
        'GWAS',
        'Exome Analysis',
        'Whole Genome Analysis',
        'Fusion Transcript Detection',
        'RNA Analysis',
        'Machine Learning',
        'Variant Discovery',
        'Epigenomics',
        'DNA Methylation',
        'Copy Number Variation',
        'Structural Variation',
        'Functional Annotation',
      ],
    },
    {
      header: 'Data Generation Technology',
      values: ['10x analysis', 'Bisulfate Sequencing'],
    },
    {
      header: 'Scientific Domain',
      values: ['Cancer', 'Infectious Diseases', 'MPG', 'Single-cell', 'Immunology', 'Neurodegenerative Diseases'],
    },
    {
      header: 'Datasets',
      values: [
        'AnVIL',
        'CMG',
        'CCDG',
        'TopMed',
        'HCA',
        'TARGET',
        'ENCODE',
        'BioData Catalyst',
        'TCGA',
        '1000 Genomes',
        'BRAIN Initiative',
        'gnomAD',
        'NCI',
        'COVID-19',
        'AMP PD',
      ],
    },
    {
      header: 'Utilities',
      values: ['Format Conversion', 'Developer Tools'],
    },
    {
      header: 'Projects',
      values: ['HCA', 'AnVIL', 'BRAIN Initiative', 'BioData Catalyst', 'NCI', 'AMP PD'],
    },
  ]
);

const WorkspaceCard = ({ workspace }) => {
  const { namespace, name, cloudPlatform, created, description } = workspace;

  return a(
    {
      href: Nav.getLink('workspace-dashboard', { namespace, name }),
      style: {
        backgroundColor: 'white',
        height: 175,
        borderRadius: 5,
        display: 'flex',
        marginBottom: '1rem',
        boxShadow: Style.standardShadow,
      },
    },
    [
      div({
        style: {
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundSize: 'auto 100%',
          borderRadius: '5px 0 0 5px',
          width: 87,
          ...Utils.cond(
            [name.toLowerCase().includes('covid'), () => ({ backgroundImage: `url(${covidBg})` })],
            [namespace === 'help-gatk', () => ({ backgroundColor: '#333', backgroundImage: `url(${gatkLogo})`, backgroundSize: undefined })],
            () => ({ backgroundImage: `url(${featuredBg})`, opacity: 0.75 })
          ),
        },
      }),
      div({ style: { flex: 1, minWidth: 0, padding: '15px 20px', overflow: 'hidden' } }, [
        div({ style: { display: 'flex' } }, [
          div({ style: { flex: 1, color: colors.accent(), fontSize: 16, lineHeight: '20px', height: 40, marginBottom: 7 } }, [name]),
          created && div([Utils.makeStandardDate(created)]),
          (cloudPlatform === 'Azure' || cloudPlatform === 'Gcp') &&
            h(CloudProviderIcon, {
              cloudProvider: {
                Azure: cloudProviderTypes.AZURE,
                Gcp: cloudProviderTypes.GCP,
              }[cloudPlatform],
              style: { marginLeft: '1ch' },
            }),
        ]),
        h(
          FirstParagraphMarkdownViewer,
          {
            style: { margin: 0, fontSize: '14px', lineHeight: '20px', height: 100, overflow: 'hidden' },
          },
          [description?.toString()]
        ),
      ]),
    ]
  );
};

export const Showcase = () => {
  const stateHistory = StateHistory.get();
  const [fullList, setFullList] = useState(stateHistory.featuredWorkspaces);

  useOnMount(() => {
    const loadData = withErrorReporting('Error loading showcase')(async () => {
      const showcase = await FirecloudBucket().getShowcaseWorkspaces();

      const featuredWorkspaces = _.map((workspace) => {
        // SearchAndFilterComponent compares lowercased filters from the sidebar to
        // unmodified tags. Thus, tags must be lowercased for SearchAndFilterComponent
        // to work properly.
        const tags = _.map(_.toLower, workspace.tags.items);

        // Add cloud provider tag to allow filtering by cloud provider.
        if (workspace.cloudPlatform === 'Azure') {
          tags.push(_.toLower(cloudProviderLabels.AZURE));
        } else if (workspace.cloudPlatform === 'Gcp') {
          tags.push(_.toLower(cloudProviderLabels.GCP));
        }

        return _.set('tags.items', tags, workspace);
      }, showcase);

      setFullList(featuredWorkspaces);

      // Saves in Session Storage so there is no loading spinner while awaiting fresh data
      // when user returns via back button
      StateHistory.update({ featuredWorkspaces });
    });

    loadData();
  });

  return h(FooterWrapper, { alwaysShow: true }, [
    libraryTopMatter('featured workspaces'),
    h(SearchAndFilterComponent, {
      fullList,
      sidebarSections,
      searchType: 'Featured Workspaces',
      getLowerName: (workspace) => _.toLower(workspace.name),
      getLowerDescription: (workspace) => _.toLower(workspace.description),
      listView: (filteredList) => {
        return _.map((workspace) => {
          const { namespace, name } = workspace;
          return h(WorkspaceCard, { key: `${namespace}:${name}`, workspace });
        }, filteredList);
      },
    }),
  ]);
};

export const navPaths = [
  {
    name: 'library-showcase',
    path: '/library/showcase',
    component: Showcase,
    title: 'Featured Workspaces',
    public: true,
  },
];
