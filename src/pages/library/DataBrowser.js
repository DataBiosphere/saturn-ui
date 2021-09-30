import filesize from 'filesize'
import _ from 'lodash/fp'
import { useState } from 'react'
import { div, h, label } from 'react-hyperscript-helpers'
import { ButtonPrimary, ButtonSecondary, Checkbox, Link } from 'src/components/common'
import FooterWrapper from 'src/components/FooterWrapper'
import { centeredSpinner, icon } from 'src/components/icons'
import { libraryTopMatter } from 'src/components/library-common'
import { MiniSortable, SimpleTable } from 'src/components/table'
import colors from 'src/libs/colors'
import { getConfig } from 'src/libs/config'
import * as Nav from 'src/libs/nav'
import * as StateHistory from 'src/libs/state-history'
import * as Utils from 'src/libs/utils'
import { SearchAndFilterComponent } from 'src/pages/library/common'
import { RequestDatasetAccessModal } from 'src/pages/library/RequestDatasetAccessModal'
import { normalizeSnapshot, snapshotStyles } from 'src/pages/library/Snapshots'


const styles = {
  ...snapshotStyles,
  table: {
    header: {
      color: colors.accent(),
      height: '1rem',
      textTransform: 'uppercase', fontWeight: 600, fontSize: '0.75rem'
    },
    row: {
      backgroundColor: '#ffffff',
      borderRadius: 5, border: '1px solid rgba(0,0,0,.15)',
      margin: '0 -1rem 1rem', padding: '1rem'
    }
  }
}

// Description of the structure of the sidebar. Case is preserved when rendering but all matching is case-insensitive.
const sidebarSections = [{
  name: 'Access Type',
  labels: [
    'Controlled',
    'Open',
    'Pending'
  ],
  labelDisplays: {
    Controlled: [
      div({ style: { display: 'flex' } }, [
        icon('lock', { style: { color: styles.access.controlled, marginRight: 5 } }),
        div(['Controlled'])
      ])
    ],
    Open: [
      div({ style: { display: 'flex' } }, [
        icon('unlock', { style: { color: styles.access.open, marginRight: 5 } }),
        div(['Open'])
      ])
    ],
    Pending: [
      div({ style: { display: 'flex' } }, [
        icon('lock', { style: { color: styles.access.pending, marginRight: 5 } }),
        div(['Pending'])
      ])
    ]
  }
}, {
  name: 'Consortium',
  labels: [
    '1000 Genomes',
    'CCDG',
    'CMG',
    'Convergent Neuro',
    'GTEx (v8)',
    'HPRC',
    'PAGE',
    'WGSPD1',
    'Human Cell Atlas'
  ]
}, {
  name: 'Data modality',
  labels: ['Proteomic', 'Transcriptomic', 'Epigenomic', 'Genomic']
}, {
  name: 'Data Type',
  labels: ['scRNA-seq', 'snRNA-seq', 'RNA-seq', 'nuc-seq', 'N/A']
}, {
  name: 'File type',
  labels: [
    'Rds', 'Robj',
    'bam', 'csv', 'csv.gz', 'fastq', 'fastq.gz',
    'h5', 'h5ad', 'loom', 'mtx', 'mtx.gz', 'pdf',
    'rds', 'rds.gz', 'tar', 'tar.gz', 'tsv',
    'tsv.gz', 'txt', 'txt.gz', 'xlsx', 'zip'
  ]
}, {
  name: 'Disease',
  labels: [
    'brain cancer', 'normal', 'cardiovascular disease', 'epilepsy', 'hepatocellular carcinoma',
    'cystic fibrosis', 'asymptomatic COVID-19 infection', 'critical COVID-19 infection', 'mild COVID-19 infection',
    'moderate COVID-19 infection', 'severe COVID-19 infection', 'Enterococcus faecalis infection', 'Lyme disease',
    'acoustic neuroma', 'acute kidney tubular necrosis', 'adrenal cortex adenoma', 'anxiety disorder', 'arthritis',
    'benign prostatic hyperplasia (disease)', 'depressive disorder', 'diverticulitis', 'essential hypertension',
    'gastroesophageal reflux disease', 'hereditary hemochromatosis', 'hiatus hernia (disease)', 'hyperlipidemia (disease)',
    'irritable bowel syndrome', 'kidney cancer', 'non-alcoholic fatty liver disease', 'obstructive sleep apnea syndrome',
    'pericardial effusion (disease)', 'prostate cancer', 'pure autonomic failure', 'syndromic dyslipidemia',
    'type 2 diabetes mellitus', 'ventricular tachycardia', 'GATA2 deficiency with susceptibility to MDS/AML',
    'colitis (disease)', 'ulcerative colitis (disease)', 'allergic asthma', 'hyperlipidemia', 'hypertensive disorder',
    'atypical chronic myeloid leukemia', 'chronic obstructive pulmonary disease', 'lung cancer', 'measles', 'mumps infectious disease',
    'tongue cancer', 'Warthin tumor', 'breast cancer', 'oncocytic adenoma', 'cancer', 'Crohn disease', 'cervical cancer',
    'glaucoma (disease)', 'clear cell renal carcinoma', 'renal pelvis papillary urothelial carcinoma', 'Alzheimer disease',
    'cognitive impairment with or without cerebellar ataxia', 'glioblastoma (disease)', 'HIV infectious disease',
    'benign prostatic hyperplasia', 'pericardial effusion', 'type 1 diabetes mellitus', 'plasma cell myeloma', 'end stage renal failure',
    'hemolytic-uremic syndrome', 'orofaciodigital syndrome VIII', 'asymptomatic dengue', 'multiple sclerosis', 'lupus erythematosus',
    'melanoma (disease)', 'renal cell carcinoma (disease)', 'colorectal cancer', 'lung adenocarcinoma', 'intracranial hypertension',
    'atopic eczema', 'psoriasis', 'pulmonary fibrosis', 'osteoarthritis, hip', 'bacterial infectious disease with sepsis',
    'bronchopneumonia', 'heart failure', 'intestinal obstruction', 'ovarian cancer', 'rheumatoid arthritis', 'tongue squamous cell carcinoma',
    'cataract (disease)', 'testicular cancer'
  ]
}, {
  name: 'Species',
  labels: ['Homo sapiens', 'Mus musculus']
}]

const getRawList = async () => {
  const list = await fetch('hca-sample.json').then(res => res.json())
  return new Promise(resolve => setTimeout(resolve(list.data), 1000))
}

const extractTags = ({ samples: { genus, disease }, dataType, dataModality, access, project, files }) => {
  return {
    itemsType: 'AttributeValue',
    items: [
      ..._.map('dcat:mediaType', files),
      _.map(_.toLower, [...genus, ...disease, ...dataType, ...dataModality, access, project])
    ]
  }
}

const SelectedItemsDisplay = ({ selectedData, setSelectedData }) => {
  const length = _.size(selectedData).toLocaleString()
  const files = _.sumBy(data => _.sumBy('count', data.files), selectedData).toLocaleString()
  const totalBytes = _.sumBy(data => _.sumBy('dcat:byteSize', data.files), selectedData)
  const fileSizeFormatted = filesize(totalBytes)

  return !_.isEmpty(selectedData) && div({
    style: {
      display: selectedData.length > 0 ? 'block' : 'none',
      position: 'sticky', bottom: 0, marginTop: 20,
      width: '100%', padding: '34px 60px',
      backgroundColor: 'white', boxShadow: 'rgb(0 0 0 / 30%) 0 0 8px 3px',
      fontSize: 17
    }
  }, [
    div({ style: { display: 'flex', alignItems: 'center' } }, [
      div({ style: { flexGrow: 1 } }, [
        `${length} dataset${length > 1 ? 's' : ''} (${fileSizeFormatted} - ${files} files) selected to be saved to a Terra Workspace`
      ]),
      h(ButtonSecondary, {
        style: { fontSize: 16, marginRight: 40, textTransform: 'none' },
        onClick: () => setSelectedData([])
      }, 'Cancel'),
      h(ButtonPrimary, {
        style: { textTransform: 'none', fontSize: 14 },
        onClick: () => {
          Nav.history.push({
            pathname: Nav.getPath('import-data'),
            search: `?url=${getConfig().dataRepoUrlRoot}&snapshotId=REPLACE_ME&snapshotName=${selectedData[0]['dct:title']}&format=snapshot`
          })
        }
      }, ['Save to a workspace'])
    ])
  ])
}


const DataBrowserTable = ({ sort, setSort, selectedData, toggleSelectedData, setRequestDatasetAccessList, showProjectFilters, setShowProjectFilters }) => {
  return ({ fullList, filteredList, setSelectedTags, selectedTags, sections }) => {
    if (_.isEmpty(fullList)) {
      return centeredSpinner()
    }

    return _.isEmpty(filteredList) ?
      div({ style: { margin: 'auto', textAlign: 'center' } }, ['No Results Found']) :
      div({ style: { margin: '0 15px' } }, [h(SimpleTable, {
        'aria-label': 'dataset list',
        columns: [
          {
            header: div({ className: 'sr-only' }, ['Select dataset']),
            size: { basis: 37, grow: 0 }, key: 'checkbox'
          }, {
            header: div({ style: styles.table.header }, [h(MiniSortable, { sort, field: 'dct:title', onSort: setSort }, ['Dataset Name'])]),
            size: { grow: 2.2 }, key: 'name'
          }, {
            header: div({ style: styles.table.header }, [
              h(ButtonSecondary, {
                style: { height: '1rem', fontSize: '.75rem', fontWeight: 600, position: 'relative' },
                onClick: () => setShowProjectFilters(!showProjectFilters)
              }, ['Project', icon('caretDown')]),
              showProjectFilters && div({
                style: {
                  backgroundColor: 'white', width: 380, height: 280, overflowY: 'auto',
                  border: '1px solid', borderColor: colors.accent(), borderRadius: 3,
                  position: 'absolute', padding: 15, marginTop: 4, boxShadow: 'rgb(0 0 0 / 5%) 0 0 8px 5px',
                  textTransform: 'none', color: 'gray', fontSize: '.9rem', fontWeight: 400
                }
              }, _.map(tag => {
                return div({ key: `project-filter-dropdown_${tag}`, style: { height: '3rem' } }, [
                  h(Checkbox, {
                    style: { marginRight: 10 },
                    'aria-label': tag,
                    checked: _.includes(tag.toLowerCase(), selectedTags),
                    onChange: () => setSelectedTags(_.xor([tag.toLowerCase()]))
                  }),
                  label([tag])
                ])
              }, sections[1].labels))
            ]),
            size: { grow: 1 }, key: 'project'
          }, {
            header: div({ style: styles.table.header }, [h(MiniSortable, { sort, field: 'counts.donors', onSort: setSort }, ['No. of Subjects'])]),
            size: { grow: 1 }, key: 'subjects'
          }, {
            header: div({ style: styles.table.header }, [h(MiniSortable, { sort, field: 'dataType', onSort: setSort }, ['Data Type'])]),
            size: { grow: 1 }, key: 'dataType'
          }, {
            header: div({ style: styles.table.header }, [h(MiniSortable, { sort, field: 'lastUpdated', onSort: setSort }, ['Last Updated'])]),
            size: { grow: 1 }, key: 'lastUpdated'
          }
        ],
        rowStyle: styles.table.row,
        cellStyle: { border: 'none', paddingRight: 15 },
        useHover: false,
        underRowKey: 'underRow',
        rows: _.map(datum => {
          const { project, dataType, access } = datum

          return {
            checkbox: h(Checkbox, {
              'aria-label': datum['dct:title'],
              checked: _.includes(datum, selectedData),
              onChange: () => toggleSelectedData(datum)
            }),
            name: h(Link,
              { onClick: () => Nav.goToPath('library-details', { id: datum['dct:identifier'] }) },
              [datum['dct:title']]
            ),
            project,
            subjects: datum?.counts?.donors,
            dataType: dataType.join(', '),
            lastUpdated: datum.lastUpdated ? Utils.makeStandardDate(datum.lastUpdated) : null,
            underRow: div({ style: { display: 'flex', alignItems: 'flex-start', paddingTop: '1rem' } }, [
              div({ style: { display: 'flex', alignItems: 'center' } }, [
                Utils.switchCase(access,
                  ['Controlled', () => h(ButtonSecondary, {
                    style: { height: 'unset', textTransform: 'none' },
                    onClick: () => setRequestDatasetAccessList([datum])
                  }, [icon('lock'), div({ style: { paddingLeft: 10, paddingTop: 4, fontSize: 12 } }, ['Request Access'])])],
                  ['Pending', () => div({ style: { color: styles.access.pending, display: 'flex' } }, [
                    icon('lock'),
                    div({ style: { paddingLeft: 10, paddingTop: 4, fontSize: 12 } }, ['Pending Access'])
                  ])],
                  [Utils.DEFAULT, () => div({ style: { color: styles.access.open, display: 'flex' } }, [
                    icon('unlock'),
                    div({ style: { paddingLeft: 10, paddingTop: 4, fontSize: 12 } }, ['Open Access'])
                  ])])
              ])
            ])
          }
        }, filteredList)
      })])
  }
}

const Browser = () => {
  const [fullList, setFullList] = useState(() => StateHistory.get().catalogSnapshots)
  const [sort, setSort] = useState({ field: 'created', direction: 'desc' })
  const [showProjectFilters, setShowProjectFilters] = useState(false)
  const [selectedData, setSelectedData] = useState([])
  const [requestDatasetAccessList, setRequestDatasetAccessList] = useState()

  Utils.useOnMount(() => {
    const loadData = async () => {
      const rawList = await getRawList()
      const normList = _.map(snapshot => {
        const normalizedSnapshot = normalizeSnapshot(snapshot)
        return _.set(['tags'], extractTags(normalizedSnapshot), normalizedSnapshot)
      }, rawList)

      setFullList(normList)
      StateHistory.update({ catalogSnapshots: fullList })
    }
    loadData()
  })

  const toggleSelectedData = data => setSelectedData(_.xor([data]))

  return h(FooterWrapper, { alwaysShow: true }, [
    libraryTopMatter('browse & explore'),
    h(SearchAndFilterComponent, {
      fullList, sidebarSections,
      customSort: sort,
      searchType: 'Datasets',
      ListContent: DataBrowserTable({ sort, setSort, selectedData, toggleSelectedData, setRequestDatasetAccessList, showProjectFilters, setShowProjectFilters })
    }),
    h(SelectedItemsDisplay, { selectedData, setSelectedData }, []),
    !!requestDatasetAccessList && h(RequestDatasetAccessModal, {
      datasets: requestDatasetAccessList,
      onDismiss: () => setRequestDatasetAccessList()
    })
  ])
}

export const navPaths = [
  {
    name: 'library-browser',
    path: '/library/browser',
    component: Browser,
    title: 'Datasets',
    public: true
  }
]
