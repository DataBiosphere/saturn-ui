import filesize from 'filesize'
import _ from 'lodash/fp'
import { useState } from 'react'
import { div, h } from 'react-hyperscript-helpers'
import { ButtonPrimary, ButtonSecondary, Checkbox, Link } from 'src/components/common'
import FooterWrapper from 'src/components/FooterWrapper'
import { centeredSpinner, icon } from 'src/components/icons'
import { libraryTopMatter } from 'src/components/library-common'
import { MiniSortable, SimpleTable } from 'src/components/table'
import colors from 'src/libs/colors'
import * as Nav from 'src/libs/nav'
import * as StateHistory from 'src/libs/state-history'
import * as Utils from 'src/libs/utils'
import { SearchAndFilterComponent } from 'src/pages/library/common'
import { RequestDatasetAccessModal } from 'src/pages/library/RequestDatasetAccessModal'


const styles = {
  access: {
    open: colors.success(1.5),
    controlled: colors.accent()
  },
  table: {
    header: {
      color: colors.accent(),
      height: 16,
      textTransform: 'uppercase', fontWeight: 600, fontSize: '0.75rem'
    },
    row: {
      backgroundColor: '#ffffff',
      borderRadius: 5, border: '1px solid rgba(0,0,0,.15)',
      margin: '0 -15px 15px', padding: 15
    }
  }
}

// Description of the structure of the sidebar. Case is preserved when rendering but all matching is case-insensitive.
const sidebarSections = [{
  name: 'Access Type',
  labels: [
    'Controlled Access',
    'Open Access'
  ],
  labelDisplays: {
    'Controlled Access': [
      div({ style: { display: 'flex' } }, [
        icon('lock', { style: { color: styles.access.controlled, marginRight: 5 } }),
        div(['Controlled Access'])
      ])
    ],
    'Open Access': [
      div({ style: { display: 'flex' } }, [
        icon('unlock', { style: { color: styles.access.open, marginRight: 5 } }),
        div(['Open Access'])
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
    'HCA'
  ]
}, {
  name: 'Disease',
  labels: [
    'Alzheimer\'s disease',
    'asthma',
    'autism spectrum disorder'
  ]
},
{
  name: 'Data Type',
  labels: [
    'Exome',
    'Whole Genome'
  ]
}, {
  name: 'File type',
  labels: [
    'Rds', 'Robj',
    'bam', 'csv', 'csv.gz', 'fastq', 'fastq.gz',
    'h5', 'h5ad', 'loom', 'mtx', 'mtx.gz', 'pdf',
    'rds', 'rds.gz', 'tar', 'tar.gz', 'tsv',
    'tsv.gz', 'txt', 'txt.gz', 'xlsx', 'zip'
  ]
}]

const getRawList = () => new Promise(resolve => setTimeout(() => {
  fetch('hca-sample.json').then(response => {
    response.json().then(tempData => {
      resolve(tempData.data)
    })
  })
}, 1000))

const extractTags = snapshot => {
  return {
    itemsType: 'AttributeValue',
    items: [
      snapshot.locked ? 'controlled access' : 'open access',
      _.toLower(snapshot.project),
      ..._.map('dcat:mediaType', snapshot.files)
    ]
  }
}

const Browser = () => {
  const stateHistory = StateHistory.get()
  const [catalogSnapshots, setCatalogSnapshots] = useState(stateHistory.catalogSnapshots)
  const [sort, setSort] = useState({ field: 'created', direction: 'desc' })
  const [selectedData, setSelectedData] = useState([])
  const [requestDatasetAccessList, setRequestDatasetAccessList] = useState()

  Utils.useOnMount(() => {
    const loadData = async () => {
      const rawList = await getRawList()
      const normList = _.map(
        snapshot => ({ ...snapshot, tags: extractTags(snapshot) }),
        _.map(snapshot => ({
          ...snapshot,
          project: _.get('0.dct:title', snapshot['TerraDCAT_ap:hasDataCollection']),
          lowerName: _.toLower(snapshot['dct:title']), lowerDescription: _.toLower(snapshot['dct:description']),
          lastUpdated: new Date(snapshot['dct:modified'])
        }), rawList)
      )

      setCatalogSnapshots(normList)
      StateHistory.update({ catalogSnapshots })
    }
    loadData()
  })

  const toggleSelectedData = data => setSelectedData(_.xor([data]))

  const SelectedItemsDisplay = () => {
    const length = _.size(selectedData)
    const files = _.sumBy(data => _.sumBy('count', data.files), selectedData)
    const totalBytes = _.sumBy(data => _.sumBy('dcat:byteSize', data.files), selectedData)
    const fileSizeFormatted = filesize(totalBytes)

    return div({
      style: {
        display: selectedData.length > 0 ? 'block' : 'none',
        position: 'sticky', bottom: 0, marginTop: '20px',
        width: '100%', padding: '34px 60px',
        backgroundColor: 'white', boxShadow: 'rgb(0 0 0 / 30%) 0px 0px 8px 3px',
        fontSize: 17
      }
    }, [
      div({ style: { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' } }, [
        `${length} dataset${length > 1 ? 's' : ''} (${fileSizeFormatted} - ${files} bam files) selected to be saved to a Terra Workspace`,
        div([
          h(ButtonSecondary, {
            style: { fontSize: 16, marginRight: 40, textTransform: 'none' },
            onClick: () => setSelectedData([])
          }, 'Cancel'),
          h(ButtonPrimary, {
            style: { textTransform: 'none', fontSize: 14 },
            onClick: () => {}
          }, ['Save to a workspace'])
        ])
      ])
    ])
  }

  const DataTable = ({ listData }) => {
    return _.isEmpty(listData) ?
      centeredSpinner() :
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
            header: div({ style: styles.table.header }, [h(MiniSortable, { sort, field: 'project', onSort: setSort }, ['Project'])]),
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
          const { project, dataType, locked } = datum
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
            dataType,
            lastUpdated: Utils.makeStandardDate(datum['dct:modified']),
            underRow: div({ style: { display: 'flex', alignItems: 'flex-start', paddingTop: '1rem' } }, [
              div({ style: { display: 'flex', alignItems: 'center' } }, [
                locked ?
                  h(ButtonSecondary, {
                    style: { height: 'unset', textTransform: 'none' },
                    onClick: () => setRequestDatasetAccessList([datum])
                  }, [icon('lock'), div({ style: { paddingLeft: 10, paddingTop: 4, fontSize: 12 } }, ['Request Access'])]) :
                  div({ style: { color: styles.access.open, display: 'flex' } }, [
                    icon('unlock'),
                    div({ style: { paddingLeft: 10, paddingTop: 4, fontSize: 12 } }, ['Open Access'])
                  ])
              ])
            ])
          }
        }, listData)
      })])
  }

  return h(FooterWrapper, { alwaysShow: true }, [
    libraryTopMatter('browse & explore'),
    SearchAndFilterComponent({
      featuredList: catalogSnapshots, sidebarSections,
      customSort: true,
      searchType: 'Datasets',
      ListContent: DataTable
    }),
    h(SelectedItemsDisplay, []),
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
