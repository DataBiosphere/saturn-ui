import _ from 'lodash/fp'

import { EntityMetadata, EntityQueryOptions, EntityQueryResponse } from './DataTableProvider'
import { RecordQueryResponse, RecordTypeSchema, WDSDataTableProvider } from './WDSDataTableProvider'


const uuid = '123e4567-e89b-12d3-a456-426614174000' // value doesn't matter for these tests

const provider = new WDSDataTableProvider(uuid)

const recordType: string = 'mytype'

const queryOptions: EntityQueryOptions = {
  pageNumber: 2,
  itemsPerPage: 50,
  sortField: 'stringAttr',
  sortDirection: 'desc'
}


describe('WDSDataTableProvider', () => {
  describe('transformPage', () => {
    it('restructures a WDS response', () => {
      // example response from WDS, copy-pasted from a WDS swagger call
      const wdsPage: RecordQueryResponse = {
        searchRequest: {
          limit: 50,
          offset: 50,
          sort: 'DESC',
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
            },
            metadata: {
              provenance: 'UNUSED'
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
            },
            metadata: {
              provenance: 'UNUSED'
            }
          }
        ],
        totalRecords: 52
      }

      // calling transformPage() on the WDS input should produce this result
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
          unfilteredCount: ,
          filteredPageCount: -1
        }
      }

      // transformPage() is the method under test
      const actual: EntityQueryResponse = provider.transformPage(wdsPage, recordType, queryOptions)

      expect(actual).toStrictEqual(expected)
    })
  })

  describe('transformMetadata', () => {
    it('restructures a WDS response', () => {
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

      // calling transformMetadata() on the WDS input should produce this result
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

      // transformMetadata() is the method under test
      const actual: EntityMetadata = provider.transformMetadata(wdsSchema)

      expect(actual).toStrictEqual(expected)
    })
  })
})

export {}
