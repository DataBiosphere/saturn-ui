import { Ajax } from 'src/libs/ajax'
import { asMockedFn } from 'src/test-utils'

import { EntityMetadata, EntityQueryOptions, EntityQueryResponse } from './DataTableProvider'
import { RecordQueryResponse, RecordTypeSchema, SearchRequest, WdsDataTableProvider, wdsToEntityServiceMetadata } from './WdsDataTableProvider'


jest.mock('src/libs/ajax')

const uuid = '123e4567-e89b-12d3-a456-426614174000' // value doesn't matter for these tests

// shell class that extends WdsDataTableProvider to allow testing protected methods
class TestableWdsProvider extends WdsDataTableProvider {
  transformPageOverride(wdsPage: RecordQueryResponse, recordType: string, queryOptions: EntityQueryOptions): EntityQueryResponse {
    return this.transformPage(wdsPage, recordType, queryOptions)
  }
}

const recordType: string = 'mytype'

const queryOptions: EntityQueryOptions = {
  pageNumber: 2,
  itemsPerPage: 50,
  sortField: 'stringAttr',
  sortDirection: 'desc',
  snapshotName: '',
  googleProject: '',
  activeTextFilter: '',
  filterOperator: ''
}


describe('WdsDataTableProvider', () => {
  let getRecords
  let deleteTable
  let downloadTsv

  beforeEach(() => {
    getRecords = jest.fn().mockImplementation((_instanceId: string, _recordType: string, _parameters: SearchRequest) => {
      const recordQueryResponse: RecordQueryResponse = {
        searchRequest: {
          limit: 10,
          offset: 0,
          sort: 'desc',
          sortAttribute: 'numericAttr'
        },
        records: [
          {
            id: '2',
            type: 'item',
            attributes: {
              arrayBoolean: [
                true,
                false
              ],
              arrayDate: [
                '2022-11-03'
              ],
              arrayDateTime: [
                '2022-11-03T04:36:20'
              ],
              arrayNumber: [
                12821.112,
                0.12121211,
                11
              ],
              arrayString: [
                'green',
                'red'
              ],
              booleanAttr: true,
              numericAttr: 2,
              stringAttr: 'string'
            }
          },
          {
            id: '1',
            type: 'item',
            attributes: {
              arrayBoolean: [
                true,
                false
              ],
              arrayDate: [
                '2022-11-03'
              ],
              arrayDateTime: [
                '2022-11-03T04:36:20'
              ],
              arrayNumber: [
                12821.112,
                0.12121211,
                11
              ],
              arrayString: [
                'green',
                'red'
              ],
              booleanAttr: true,
              numericAttr: 1,
              stringAttr: 'string'
            }
          }
        ],
        totalRecords: 2
      }
      return Promise.resolve(recordQueryResponse)
    })
    deleteTable = jest.fn().mockImplementation((_instanceId: string, _recordType: string) => {
      return Promise.resolve(new Response('', { status: 204 }))
    })
    downloadTsv = jest.fn().mockImplementation((_instanceId: string, _recordType: string) => {
      return Promise.resolve(new Blob(['hello']))
    })

    asMockedFn(Ajax).mockImplementation(() => ({ WorkspaceData: { getRecords, deleteTable, downloadTsv } } as ReturnType<typeof Ajax>))
  })

  describe('transformPage', () => {
    it('restructures a WDS response', () => {
      // ====== Arrange
      const provider = new TestableWdsProvider(uuid)

      // example response from WDS, copy-pasted from a WDS swagger call
      const wdsPage: RecordQueryResponse = {
        searchRequest: {
          limit: 50,
          offset: 50,
          sort: 'desc',
          sortAttribute: 'stringAttr'
        },
        records: [
          {
            id: '1',
            type: 'item',
            attributes: {
              booleanAttr: true,
              numericAttr: 11,
              stringAttr: 'string',
              timestamp: '2022-10-19T17:39:03.274+00:00'
            }
          },
          {
            id: '2',
            type: 'item',
            attributes: {
              booleanAttr: true,
              numericAttr: 22,
              stringAttr: 'string',
              timestamp: '2022-10-19T17:39:03.274+00:00'
            }
          }
        ],
        totalRecords: 52
      }

      // ====== Act
      const actual: EntityQueryResponse = provider.transformPageOverride(wdsPage, recordType, queryOptions)

      // ====== Assert
      const expected: EntityQueryResponse = {
        results: [
          {
            entityType: recordType,
            attributes: {
              booleanAttr: true,
              numericAttr: 11,
              stringAttr: 'string',
              timestamp: '2022-10-19T17:39:03.274+00:00'
            },
            name: '1'
          },
          {
            entityType: recordType,
            attributes: {
              booleanAttr: true,
              numericAttr: 22,
              stringAttr: 'string',
              timestamp: '2022-10-19T17:39:03.274+00:00'
            },
            name: '2'
          }
        ],
        parameters: {
          page: 2,
          pageSize: 50,
          sortField: 'stringAttr',
          sortDirection: 'desc',
          filterTerms: '',
          filterOperator: 'and'
        },
        resultMetadata: {
          filteredCount: 52,
          unfilteredCount: 52,
          filteredPageCount: -1
        }
      }

      expect(actual).toStrictEqual(expected)
    })
  })
  describe('getPage', () => {
    it('restructures a WDS response', () => {
      // ====== Arrange
      const provider = new TestableWdsProvider(uuid)
      const signal = new AbortController().signal
      // ====== Act
      return provider.getPage(signal, recordType, queryOptions).then(actual => {
        // ====== Assert
        expect(getRecords.mock.calls.length).toBe(1)
        expect(actual.resultMetadata.unfilteredCount).toBe(2)
      })
    })
  })
  describe('deleteTable', () => {
    it('restructures a WDS response', () => {
      // ====== Arrange
      const provider = new TestableWdsProvider(uuid)
      // ====== Act
      return provider.deleteTable(recordType).then(actual => {
        // ====== Assert
        expect(deleteTable.mock.calls.length).toBe(1)
        expect(actual.status).toBe(204)
      })
    })
  })
  describe('downloadTsv', () => {
    it('restructures a WDS response', () => {
      // ====== Arrange
      const provider = new TestableWdsProvider(uuid)
      const signal = new AbortController().signal
      // ====== Act
      return provider.downloadTsv(signal, recordType).then(actual => {
        // ====== Assert
        expect(downloadTsv.mock.calls.length).toBe(1)
        actual.text().then(txt => {
          expect(txt).toBe('hello')
        })
      })
    })
  })
})

describe('transformMetadata', () => {
  it('restructures a WDS response', () => {
    // ====== Arrange
    // example response from WDS, copy-pasted from a WDS swagger call
    const wdsSchema: RecordTypeSchema[] = [
      {
        name: 'item',
        attributes: [
          {
            name: 'booleanAttr',
            datatype: 'BOOLEAN'
          },
          {
            name: 'stringAttr',
            datatype: 'STRING'
          }
        ],
        count: 7
      },
      {
        name: 'thing',
        attributes: [
          {
            name: 'numericAttr',
            datatype: 'NUMBER'
          },
          {
            name: 'stringAttr',
            datatype: 'STRING'
          },
          {
            name: 'timestamp',
            datatype: 'STRING'
          }
        ],
        count: 4
      }
    ]

    // ====== Act
    const actual: EntityMetadata = wdsToEntityServiceMetadata(wdsSchema)

    // ====== Assert
    const expected: EntityMetadata = {
      item: {
        count: 7,
        attributeNames: ['booleanAttr', 'stringAttr'],
        idName: 'sys_name'
      },
      thing: {
        count: 4,
        attributeNames: ['numericAttr', 'stringAttr', 'timestamp'],
        idName: 'sys_name'
      }
    }

    expect(actual).toStrictEqual(expected)
  })
})
