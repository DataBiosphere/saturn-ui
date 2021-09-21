import _ from 'lodash/fp'
import { h } from 'react-hyperscript-helpers'
import { SearchAndFilterComponent } from 'src/pages/library/common'


// Description of the structure of the sidebar. Case is preserved when rendering but all matching is case-insensitive.
const sidebarSections = [{
  name: 'Access Type',
  labels: ['Controlled Access', 'Open Access']
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
    'WGSPD1'
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
}]


const DataBrowser = () => {
  const featuredList = [
    {
      namespace: 'test-test',
      name: 'This is a really really long name that should wrap onto another line',
      created: '2020-01-13T18:25:28.340Z',
      lastUpdated: '2020-01-13T18:25:28.340Z',
      tags: {
        itemsType: 'AttributeValue',
        items: ['1000 Genomes', 'CMG', 'Open Access', 'Exome']
      },
      description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
      lowerName: 'this is a really really long name that should wrap onto another line',
      lowerDescription: 'test desc',
      project: {
        id: '112',
        name: 'NIH'
      },
      subjects: 123,
      dataType: 'RNA Seq',
      keepCollapsed: true,
      locked: true,
      files: 45,
      fileSize: 12345
    },
    {
      namespace: 'harry-potter',
      name: 'Harry Potter',
      created: '2020-01-07T18:25:28.340Z',
      lastUpdated: '2020-01-07T18:25:28.340Z',
      tags: {
        itemsType: 'AttributeValue',
        items: ['1000 Genomes', 'CMG', 'Open Access', 'Exome']
      },
      description: 'The boy who lived',
      lowerName: 'harry potter',
      lowerDescription: 'lower description',
      project: {
        id: '112',
        name: 'CDC'
      },
      subjects: 10,
      dataType: 'RNA Seq',
      keepCollapsed: true,
      locked: false,
      files: 15,
      fileSize: 4432
    },
    {
      namespace: 'star-wars',
      name: 'Luke Skywalker',
      created: '2020-01-07T18:25:28.340Z',
      lastUpdated: '2020-01-07T18:25:28.340Z',
      tags: {
        itemsType: 'AttributeValue',
        items: ['1000 Genomes', 'CMG', 'Open Access', 'Exome']
      },
      description: 'force sensitive',
      lowerName: 'luke skywalker',
      lowerDescription: 'lower description',
      project: {
        id: '123',
        name: 'CDC'
      },
      subjects: 10,
      dataType: '',
      keepCollapsed: true,
      locked: false,
      files: 10,
      fileSize: 550
    },
    {
      namespace: 'star-wars',
      name: 'Darth Vader',
      created: '2020-01-07T18:25:28.340Z',
      lastUpdated: '2020-01-07T18:25:28.340Z',
      tags: {
        itemsType: 'AttributeValue',
        items: ['1000 Genomes', 'CCDG', 'Controlled Access', 'Whole Genome', 'asthma']
      },
      description: 'force sensitive',
      lowerName: 'darth vader',
      lowerDescription: 'lower description',
      project: {
        id: '123',
        name: 'CDC2'
      },
      subjects: 10,
      dataType: 'Data',
      keepCollapsed: true,
      locked: true,
      files: 10,
      fileSize: 2200000000
    }
  ]

  const snapshots = _.map(snapshot => ({
    ...snapshot,
    tags: _.update(['items'], _.map(_.toLower), snapshot.tags),
    lowerName: _.toLower(snapshot.name), lowerDescription: _.toLower(snapshot.description)
  }), featuredList)

  return h(SearchAndFilterComponent, { featuredList: snapshots, sidebarSections, activeTab: 'browse & explore', listDataType: 'Datasets' })
}

export const navPaths = [{
  name: 'library-browser',
  path: '/library/browser',
  component: DataBrowser,
  title: 'Browse & Explore'
}]
