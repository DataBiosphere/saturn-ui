import { Modal, TooltipTrigger } from '@terra-ui-packages/components';
import { Fragment, useState } from 'react';
import { b, div, h, img, p, span } from 'react-hyperscript-helpers';
import { ButtonPrimary, Link } from 'src/components/common';
import FooterWrapper from 'src/components/FooterWrapper';
import { libraryTopMatter } from 'src/components/library-common';
import { Browser } from 'src/data-catalog/DataBrowser';
import thousandGenomesAnvil from 'src/images/library/datasets/1000Genome-Anvil-logo.png';
import thousandGenomesLogo from 'src/images/library/datasets/1000Genome-logo.png';
import amppdLogo from 'src/images/library/datasets/Amp@2x.png';
import anvilLogo from 'src/images/library/datasets/Anvil-logo.svg';
import baselineLogo from 'src/images/library/datasets/baseline.jpg';
import broadLogo from 'src/images/library/datasets/broad_logo.png';
import encodeLogo from 'src/images/library/datasets/ENCODE@2x.png';
import framinghamLogo from 'src/images/library/datasets/framingham.jpg';
import gp2Logo from 'src/images/library/datasets/GP2_logo.png';
import hcaLogo from 'src/images/library/datasets/HCA@2x.png';
import nemoLogo from 'src/images/library/datasets/nemo-logo.svg';
import rareXLogo from 'src/images/library/datasets/rare-x-logo.svg';
import targetLogo from 'src/images/library/datasets/target_logo.jpeg';
import tcgaLogo from 'src/images/library/datasets/TCGALogo.jpg';
import topMedLogo from 'src/images/library/datasets/TopMed@2x.png';
import { Ajax } from 'src/libs/ajax';
import { getEnabledBrand } from 'src/libs/brand-utils';
import colors from 'src/libs/colors';
import { getConfig } from 'src/libs/config';
import Events from 'src/libs/events';
import { isFeaturePreviewEnabled } from 'src/libs/feature-previews';
import { COHORT_BUILDER_CARD } from 'src/libs/feature-previews-config';
import * as Nav from 'src/libs/nav';
import { getLocalPref, setLocalPref } from 'src/libs/prefs';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';
import { DataBrowserPreviewToggler } from 'src/pages/library/DataBrowserToggler';

const styles = {
  header: {
    ...Style.elements.sectionHeader,
    textTransform: 'uppercase',
  },
  content: {
    display: 'flex',
    flexWrap: 'wrap',
    margin: '2.5rem',
  },
  participant: {
    container: {
      margin: '0 4rem 5rem 0',
      width: 350,
    },
    title: {
      marginTop: '1rem',
      fontSize: 20,
      color: colors.dark(),
    },
    description: {
      marginTop: '1rem',
      minHeight: 125,
    },
    sizeText: {
      marginTop: '1rem',
      height: '1rem',
    },
  },
};

const logoBox = ({ src, alt, height }) =>
  div(
    {
      style: {
        display: 'inline-flex',
        justifyContent: 'center',
        alignItems: 'center',
        flex: 'none',
        height: 150,
        width: 'auto',
        border: `1px solid ${colors.dark(0.55)}`,
        borderRadius: 5,
        backgroundColor: 'white',
      },
    },
    [
      img({
        src,
        alt,
        role: 'img',
        height: height || '60%',
        width: 'auto',
      }),
    ]
  );

const Participant = ({ logo, title, shortDescription, description, sizeText, modalLogoHeight = 150, children }) => {
  const [showingModal, setShowingModal] = useState(false);

  const titleElement = div({ style: styles.participant.title }, [title]);

  return div(
    {
      style: styles.participant.container,
    },
    [
      div({ style: { display: 'flex', flexDirection: 'column' } }, [
        logoBox(logo),
        titleElement,
        div({ style: styles.participant.description }, [
          shortDescription || description,
          shortDescription &&
            h(
              Link,
              {
                style: { marginLeft: '0.5rem' },
                onClick: () => setShowingModal(true),
              },
              ['READ MORE']
            ),
        ]),
        div({ style: styles.participant.sizeText }, [sizeText]),
        div({ style: { marginTop: '1rem' } }, [children]),
      ]),
      showingModal &&
        h(
          Modal,
          {
            contentLabel: title,
            onDismiss: () => setShowingModal(false),
            width: 880,
            showCancel: false,
          },
          [img({ src: logo.src, alt: logo.alt, height: modalLogoHeight, width: 'auto' }), titleElement, description, sizeText && p([sizeText])]
        ),
    ]
  );
};

const browseTooltip = 'Look for the Export to Terra icon to export data from this provider.';

const captureBrowseDataEvent = (datasetName) => Ajax().Metrics.captureEvent(Events.datasetLibraryBrowseData, { datasetName });

const thousandGenomesHighCoverage = () =>
  h(
    Participant,
    {
      logo: { src: thousandGenomesAnvil, alt: '1000 Genomes and AnVIL', height: '55%' },
      title: '1000 Genomes High Coverage presented by NHGRI AnVIL',
      description:
        '1000 Genomes project phase 3 samples sequenced to 30x coverage. This dataset is delivered as a workspace. You may clone ' +
        'this workspace to run analyses or copy specific samples to a workspace of your choice.',
      sizeText: 'Participants: 3,202',
    },
    [
      h(
        ButtonPrimary,
        {
          'aria-label': 'Browse 1000 Genomes High Coverage data',
          tooltip: 'Visit the workspace',
          href: Nav.getLink('workspace-dashboard', { namespace: 'anvil-datastorage', name: '1000G-high-coverage-2019' }),
          onClick: () => captureBrowseDataEvent('1000 Genomes High Coverage'),
        },
        ['Browse data']
      ),
    ]
  );

const thousandGenomesLowCoverage = () =>
  h(
    Participant,
    {
      logo: { src: thousandGenomesLogo, alt: '1000 Genomes logo', height: '55%' },
      title: '1000 Genomes Low Coverage',
      description: h(Fragment, [
        h(Link, { href: 'http://www.internationalgenome.org/about', ...Utils.newTabLinkProps }, 'The 1000 Genomes Project'),
        ` ran between 2008 and 2015, creating the largest public catalogue of
  human variation and genotype data. The goal of the 1000 Genomes Project was to find most genetic variants
  with frequencies of at least 1% in the populations studied.`,
      ]),
      sizeText: 'Participants: 3,500',
    },
    [
      h(
        ButtonPrimary,
        {
          'aria-label': 'Browse 1000 Genomes Low Coverage data',
          tooltip: browseTooltip,
          href: Nav.getLink('data-explorer-public', { dataset: '1000 Genomes' }),
          onClick: () => captureBrowseDataEvent('1000 Genomes Low Coverage'),
        },
        ['Browse data']
      ),
    ]
  );

const amppd = () =>
  h(
    Participant,
    {
      logo: { src: amppdLogo, alt: 'AMP-PD logo', height: '100%' },
      title: "AMP Parkinson's Disease",
      shortDescription: `The Accelerating Medicines Partnership (AMP) is a public-private partnership between the National
  Institutes of Health (NIH), multiple biopharmaceutical and life sciences companies, and non-profit organizations to
  identify...`,
      description: h(Fragment, [
        p([
          `The Accelerating Medicines Partnership (AMP) is a public-private partnership between the National Institutes of
    Health (NIH), multiple biopharmaceutical and life sciences companies, and non-profit organizations to identify and
    validate the most promising biomarkers and biological targets for therapeutics.`,
        ]),
        p(['Includes data from the following studies:']),
        div({ style: { margin: '0.4rem 0', fontWeight: 'bold', lineHeight: '150%' } }, [
          div({ style: { display: 'flex' } }, [
            div({ style: { width: 410 } }, ["• Parkinson's Disease Biomarkers Program (PDBP)"]),
            div(['• BioFIND']),
          ]),
          div({ style: { display: 'flex' } }, [
            div({ style: { width: 410 } }, ["• Parkinson's Progression Markers Initiative (PPMI)"]),
            div(['• Harvard Biomarkers Study (HBS)']),
          ]),
          div({ style: { display: 'flex' } }, [
            div({ style: { width: 410 } }, ['• Lewy Body Dementia Study (LBD)']),
            div(['• LRRK2 Cohort Consortium (LCC)']),
          ]),
          div({ style: { display: 'flex' } }, [div({ style: { width: 410 } }, ['• STEADY-PD3 Study']), div(['• SURE-PD3 Study'])]),
        ]),
        p([
          "Global Parkinson's Genetics Program (GP2) data is accessible through an approved single AMP PD-GP2 DUA, ",
          h(Link, { href: 'https://www.amp-pd.org/form/update-amp-pd-application', ...Utils.newTabLinkProps }, ['here.']),
        ]),
      ]),
      sizeText: 'Participants: 10,772',
    },
    [
      h(
        ButtonPrimary,
        {
          'aria-label': 'Learn about AMP PD data',
          tooltip: 'Visit the Featured Workspace',
          href: 'https://app.terra.bio/#workspaces/amp-pd-public/AMP-PD-In-Terra',
          onClick: () => captureBrowseDataEvent('AMP PD Featured Workspace'),
        },
        ['Explore AMP PD']
      ),
    ]
  );

const cohortBuilder = () =>
  h(
    Participant,
    {
      logo: { src: broadLogo, alt: 'Broad logo', height: '40%' },
      title: 'Cohort Builder Demo',
      description: h(Fragment, [
        'The cohort builder is an alpha feature in Terra, currently being designed and build for use to help with subsetting large datasets. This card takes you to a demo dataset for use in demoing and exploring the alpha cohort builder.',
      ]),
      sizeText: 'Participants: > 35,000',
    },
    [
      h(
        ButtonPrimary,
        {
          'aria-label': 'View Cohort Builder Demo',
          tooltip: 'View details about this dataset',
          href: Nav.getLink('dataset-builder-details', {
            snapshotId: getConfig().terraDeploymentEnv === 'dev' ? '83c121aa-ce3f-4bf7-9084-28d1e5a0387f' : '52d133b0-100b-4b92-b7e1-c5d3c37171cf',
          }),
          onClick: () => captureBrowseDataEvent('Cohort Builder'),
        },
        ['View Cohort Builder Demo']
      ),
    ]
  );

const baseline = () =>
  h(
    Participant,
    {
      logo: { src: baselineLogo, alt: 'Project Baseline logo', height: '55%' },
      title: 'Baseline Health Study',
      description: h(Fragment, [
        h(Link, { href: 'https://www.projectbaseline.com/study/project-baseline/', ...Utils.newTabLinkProps }, 'Baseline Health Study'),
        ` is a longitudinal study that will collect broad phenotypic health data
    from approximately 10,000 participants, who will each be followed over the
    course of at least four years. The study is part of a broader effort
    designed to develop a well-defined reference, or “baseline,” of health.`,
      ]),
      sizeText: 'Participants: > 2,500',
    },
    [
      h(
        ButtonPrimary,
        {
          'aria-label': 'Browse Baseline Health Study data',
          href: Nav.getLink('data-explorer-private', { dataset: 'Baseline Health Study' }),
          onClick: () => captureBrowseDataEvent('Baseline Health Study'),
        },
        ['Browse Data']
      ),
    ]
  );

const ccdg = () =>
  h(
    Participant,
    {
      logo: { src: anvilLogo, alt: 'CCDG logo' },
      title: 'CCDG presented by NHGRI AnVIL',
      description:
        'The Centers for Common Disease Genomics (CCDG) are a collaborative large-scale genome sequencing ' +
        'effort to comprehensively identify rare risk and protective variants contributing to multiple common disease phenotypes.',
      sizeText: 'Participants: > 65,000',
    },
    [
      h(
        ButtonPrimary,
        {
          'aria-label': 'Browse CCDG data',
          href: 'https://anvilproject.org/data/consortia/CCDG',
          onClick: () => captureBrowseDataEvent('CCDG'),
          ...Utils.newTabLinkProps,
        },
        ['Browse data']
      ),
    ]
  );

const cmg = () =>
  h(
    Participant,
    {
      logo: { src: anvilLogo, alt: 'CMG logo' },
      title: 'CMG presented by NHGRI AnVIL',
      description:
        'The National Human Genome Research Institute funded the Centers for Mendelian Genomics (CMG) with the charge ' +
        'to discover as many genes underlying human Mendelian disorders as possible.',
      sizeText: 'Participants: > 5,000',
    },
    [
      h(
        ButtonPrimary,
        {
          'aria-label': 'Browse CMG data',
          href: 'https://anvilproject.org/data/consortia/CMG',
          onClick: () => captureBrowseDataEvent('CMG'),
          ...Utils.newTabLinkProps,
        },
        ['Browse Data']
      ),
    ]
  );

const encode = () =>
  h(
    Participant,
    {
      logo: { src: encodeLogo, alt: 'ENCODE Project logo' },
      title: 'ENCODE Project',
      description: h(Fragment, [
        'The ',
        b('Enc'),
        'yclopedia ',
        b('O'),
        'f ',
        b('D'),
        'NA ',
        b('E'),
        `lements (ENCODE)
    project aims to delineate all functional elements encoded in the human genome. To this end, ENCODE has
    systematically mapped regions of transcription, transcription factor association, chromatin structure
    and histone modification.`,
      ]),
      sizeText: 'Donors: > 650 ; Files: > 158,000',
    },
    [
      h(
        ButtonPrimary,
        {
          'aria-label': 'Browse ENCODE data',
          tooltip: browseTooltip,
          href: 'https://broad-gdr-encode.appspot.com/',
          onClick: () => captureBrowseDataEvent('ENCODE'),
          ...Utils.newTabLinkProps,
        },
        ['Browse Data']
      ),
    ]
  );

const fcDataLib = () =>
  h(
    Participant,
    {
      logo: { src: broadLogo, alt: 'Broad logo', height: '40%' },
      title: 'Broad Dataset Workspace Library',
      description: `Search for datasets sequenced at the Broad Institute, or public datasets hosted at the Broad. Datasets
   are pre-loaded as workspaces. You can clone these, or copy data into the workspace of your choice.`,
      sizeText: h(TooltipTrigger, { content: 'As of October 2018' }, [span('Samples: > 158,629')]),
    },
    [
      h(
        ButtonPrimary,
        {
          'aria-label': 'Browse Broad Institute datasets',
          tooltip: 'Search for dataset workspaces',
          href: `${getConfig().firecloudUrlRoot}/?return=${getEnabledBrand().queryName}#library`,
          onClick: () => captureBrowseDataEvent('Broad Institute Datasets'),
          ...Utils.newTabLinkProps,
        },
        ['Browse Datasets']
      ),
    ]
  );

const framingham = () =>
  h(
    Participant,
    {
      logo: { src: framinghamLogo, alt: 'Framingham Heart Study logo', height: '70%' },
      title: 'Framingham Heart Study Teaching Dataset',
      description: h(Fragment, [
        'Since 1948, the ',
        h(Link, { href: 'https://www.framinghamheartstudy.org/', ...Utils.newTabLinkProps }, 'Framingham Heart Study'),
        ` has been committed to identifying the common factors or characteristics that contribute to cardiovascular disease,
    over three generations of participants. This is a `,
        h(Link, { href: 'https://biolincc.nhlbi.nih.gov/teaching/', ...Utils.newTabLinkProps }, 'teaching dataset'),
        ' and may not be used for publication purposes.',
      ]),
      sizeText: 'Participants: 4,400',
    },
    [
      h(
        ButtonPrimary,
        {
          'aria-label': 'Browse Framingham Heart Study dataset',
          tooltip: browseTooltip,
          href: Nav.getLink('data-explorer-public', { dataset: 'Framingham Heart Study Teaching Dataset' }),
          onClick: () => captureBrowseDataEvent('Framingham Heart Study'),
        },
        ['Browse data']
      ),
    ]
  );

const gp2 = () =>
  h(
    Participant,
    {
      logo: { src: gp2Logo, alt: 'GP2 logo', height: '40%' },
      modalLogoHeight: 100,
      title: 'GP2',
      shortDescription: `The Global Parkinson's Genetics Program (GP2) aims to transform our understanding
    of the genetic basis of Parkinson’s disease (PD) across diverse populations, including those
    underserved in biomedical...`,
      description: p([
        `The Global Parkinson's Genetics Program (GP2) aims to transform our understanding of the genetic
    basis of Parkinson’s disease (PD) across diverse populations, including those underserved in
    biomedical research. This program includes targeted collection and analysis of data and samples
    from Africa, Asia, Europe and the Americas toward genetic insights that will broaden biomarker and
    therapeutic discovery and development. GP2 is a resource of the Aligning Science Across
    Parkinson’s (ASAP) initiative, which has developed an ambitious roadmap to tackle key scientific
    challenges in PD by supporting meaningful, multidisciplinary collaboration; generating
    research-enabling resources; and sharing data.`,
      ]),
    },
    [
      h(
        ButtonPrimary,
        {
          'aria-label': 'Browse GP2 Tier 1 data',
          style: { marginBottom: '1rem' },
          tooltip: 'Visit the workspace',
          href: Nav.getLink('workspace-dashboard', { namespace: 'cardterra', name: 'GP2_Tier1' }),
          onClick: () => captureBrowseDataEvent('GP2 Tier 1 data'),
        },
        ['Browse Tier 1 Data']
      ),
      h(
        ButtonPrimary,
        {
          'aria-label': 'Browse GP2 Tier 2 data',
          tooltip: 'Visit the workspace',
          href: Nav.getLink('workspace-dashboard', { namespace: 'cardterra', name: 'GP2_Tier2' }),
          onClick: () => captureBrowseDataEvent('GP2 Tier 2 data'),
        },
        ['Browse Tier 2 Data']
      ),
    ]
  );

const hca = () =>
  h(
    Participant,
    {
      logo: { src: hcaLogo, alt: 'Human Cell Atlas logo' },
      title: 'Human Cell Atlas',
      description: `The Human Cell Atlas (HCA) is made up of comprehensive reference maps of all human cells — the
  fundamental units of life — as a basis for understanding fundamental human biological processes and diagnosing,
  monitoring, and treating disease.`,
    },
    [
      h(
        ButtonPrimary,
        {
          'aria-label': 'Browse Human Cell Atlas data',
          tooltip: 'Look for the Export Selected Data button to export data from this provider.',
          href: 'https://data.humancellatlas.org/explore/projects',
          onClick: () => captureBrowseDataEvent('Human Cell Atlas'),
          ...Utils.newTabLinkProps,
        },
        ['Browse Data']
      ),
    ]
  );

const nemo = () =>
  h(
    Participant,
    {
      logo: { src: nemoLogo, alt: 'NeMO logo', height: '40%' },
      title: 'Neuroscience Multi-Omic Archive',
      description: `The Neuroscience Multi-Omic (NeMO) Archive is a data repository specifically focused on the
  storage and dissemination of omic data from the BRAIN Initiative and related brain research projects. NeMO
  operates in close partnership with the Broad Single Cell Portal, Terra, and the Brain Cell Data Center (BCDC).`,
      sizeText: h(TooltipTrigger, { content: 'As of March 2019' }, [span('Files: >= 210,000; Projects >= 5; Species >= 3')]),
    },
    [
      h(
        ButtonPrimary,
        {
          'aria-label': 'Browse Neuroscience Multi-Omic Archive data',
          tooltip: 'Look for the Export to Terra option in the Download Cart to export data.',
          href: 'http://portal.nemoarchive.org/',
          onClick: () => captureBrowseDataEvent('Nemo Archive'),
          ...Utils.newTabLinkProps,
        },
        ['Browse Data']
      ),
    ]
  );

const target = () =>
  h(
    Participant,
    {
      logo: { src: targetLogo, alt: 'TARGET logo', height: '85%' },
      title: `Therapeutically Applicable Research to Generate Effective Treatments (TARGET) presented by the National
  Cancer Institute`,
      description: `The TARGET initiative employed comprehensive molecular characterization to determine the genetic
  changes that drive the initiation and progression of hard-to-treat childhood cancers. TARGET makes the data generated
  available to the research community with a goal to identify therapeutic targets and prognostic markers so that novel,
  more effective treatment strategies can be developed and applied.`,
      sizeText: 'Participants: 1,324',
    },
    [
      h(
        ButtonPrimary,
        {
          'aria-label': 'Browse TARGET data',
          href: `${getConfig().firecloudUrlRoot}/?return=${getEnabledBrand().queryName}&project=TARGET#library`,
          onClick: () => captureBrowseDataEvent('TARGET'),
          ...Utils.newTabLinkProps,
        },
        ['Browse Data']
      ),
    ]
  );

const tcga = () =>
  h(
    Participant,
    {
      logo: { src: tcgaLogo, alt: 'TCGA logo', height: '80%' },
      title: 'The Cancer Genome Atlas Presented by the National Cancer Institute',
      description: h(Fragment, [
        'The Cancer Genome Atlas (TCGA), a landmark ',
        h(Link, { href: 'https://www.cancer.gov/about-nci/organization/ccg/cancer-genomics-overview', ...Utils.newTabLinkProps }, 'cancer genomics'),
        ` program, molecularly characterized over 20,000 primary cancer and matched normal samples spanning 33 cancer types.
    This joint effort between the National Cancer Institute and the National Human Genome Research Institute began in 2006,
    bringing together researchers from diverse disciplines and multiple institutions.`,
      ]),
      sizeText: 'Participants: 11,000',
    },
    [
      h(
        ButtonPrimary,
        {
          'aria-label': 'Browse Cancer Genome Atlas data',
          href: `${getConfig().firecloudUrlRoot}/?return=${getEnabledBrand().queryName}&project=TCGA#library`,
          onClick: () => captureBrowseDataEvent('Cancer Genome Atlas'),
          ...Utils.newTabLinkProps,
        },
        ['Browse Data']
      ),
    ]
  );

const topMed = () =>
  h(
    Participant,
    {
      logo: { src: topMedLogo, alt: 'TopMed logo' },
      title: 'TopMed presented by NHLBI BioData Catalyst',
      description: `Trans-Omics for Precision Medicine (TOPMed), sponsored by the National Institutes of Health's National
  Heart, Lung, and Blood Institute (NHLBI), is a program to generate scientific resources to enhance our understanding
  of fundamental biological processes that underlie heart, lung, blood, and sleep disorders (HLBS).`,
      sizeText: h(TooltipTrigger, { content: 'As of November 2016' }, [span('Participants: > 54,000')]),
    },
    [
      h(
        ButtonPrimary,
        {
          'aria-label': 'Browse TopMed data',
          tooltip: browseTooltip,
          href: 'https://gen3.biodatacatalyst.nhlbi.nih.gov/explorer',
          onClick: () => captureBrowseDataEvent('TopMed'),
          ...Utils.newTabLinkProps,
        },
        ['Browse Data']
      ),
    ]
  );

const rareX = () =>
  h(
    Participant,
    {
      logo: { src: rareXLogo, alt: 'RareX logo' },
      title: 'RARE-X Data Analysis Platform',
      description: h(Fragment, [
        h(Link, { href: 'https://rare-x.org', ...Utils.newTabLinkProps }, 'The RARE-X Data Analysis Platform'),
        ` is a federated data repository of rare disease patient health data.
    Data on the RARE-X Data Analysis Platform is patient-owned and patient-consented
    for sharing with researchers worldwide. RARE-X operates in close partnership with
    rare disease communities around the globe.`,
      ]),
      sizeText: h(TooltipTrigger, { content: 'As of June 2022' }, [span('Participants: > 700')]),
    },
    [
      h(
        ButtonPrimary,
        {
          'aria-label': 'Request access to RareX data',
          tooltip: 'View details on data and request access',
          href: 'https://rare-x.terra.bio/#workspaces/rare-x_gg/RAREX_Researcher_Dashboard',
          onClick: () => captureBrowseDataEvent('RARE-X'),
        },
        ['Access Data']
      ),
    ]
  );

export const Datasets = () => {
  const [catalogShowing, setCatalogShowing] = useState(!!getLocalPref('catalog-toggle'));
  return h(FooterWrapper, { alwaysShow: true }, [
    libraryTopMatter('datasets'),
    h(DataBrowserPreviewToggler, {
      onChange: (value) => {
        setCatalogShowing(value);
        Ajax().Metrics.captureEvent(Events.catalogToggle, { enabled: value });
        setLocalPref('catalog-toggle', value);
      },
      catalogShowing,
    }),
    catalogShowing
      ? h(Browser)
      : div({ role: 'main', style: styles.content }, [
          // Put datasets in alphabetical order
          thousandGenomesHighCoverage(),
          thousandGenomesLowCoverage(),
          amppd(),
          isFeaturePreviewEnabled(COHORT_BUILDER_CARD) && cohortBuilder(),
          baseline(),
          ccdg(),
          cmg(),
          encode(),
          fcDataLib(),
          framingham(),
          gp2(),
          hca(),
          nemo(),
          rareX(),
          target(),
          tcga(),
          topMed(),
        ]),
  ]);
};

export const navPaths = [
  {
    name: 'library-datasets',
    path: '/library/datasets',
    component: Datasets,
    public: false,
    title: 'Data Browser',
  },
];
