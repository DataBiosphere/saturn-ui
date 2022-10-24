import filesize from 'filesize'
import { div, h } from 'react-hyperscript-helpers'
import { AutoSizer } from 'react-virtualized'
import { Link } from 'src/components/common'
import { basename } from 'src/components/file-browser/file-browser-utils'
import { FlexTable, HeaderCell, TextCell } from 'src/components/table'
import { FileBrowserFile } from 'src/libs/ajax/file-browser-providers/FileBrowserProvider'
import * as Utils from 'src/libs/utils'


interface FilesTableProps {
  files: FileBrowserFile[]
  noFilesMessage: string
  onClickFile: (file: FileBrowserFile) => void
}

const FilesTable = (props: FilesTableProps) => {
  const { files, noFilesMessage, onClickFile } = props

  return div({ style: { display: 'flex', flex: '1 1 auto' } }, [
    h(AutoSizer, {}, [
      /* @ts-expect-error */
      ({ width, height }) => h(FlexTable, {
        'aria-label': 'File browser',
        width,
        height,
        rowCount: files.length,
        noContentMessage: noFilesMessage,
        styleCell: () => ({ padding: '0.5em', borderRight: 'none', borderLeft: 'none' }),
        styleHeader: () => ({ padding: '0.5em', borderRight: 'none', borderLeft: 'none' }),
        hoverHighlight: true,
        border: false,
        columns: [
          {
            size: { min: 100, grow: 1 },
            headerRenderer: () => h(HeaderCell, ['Name']),
            cellRenderer: ({ rowIndex }) => {
              const file = files[rowIndex]
              return h(TextCell, [
                h(Link, {
                  href: file.url,
                  style: { textDecoration: 'underline' },
                  onClick: e => {
                    e.preventDefault()
                    onClickFile(file)
                  }
                }, [basename(file.path)])
              ])
            }
          },
          {
            size: { min: 150, grow: 0 },
            headerRenderer: () => h(HeaderCell, ['Size']),
            cellRenderer: ({ rowIndex }) => {
              const file = files[rowIndex]
              return h(TextCell, [filesize(file.size, { round: 0 })])
            }
          },
          {
            size: { min: 200, grow: 0 },
            headerRenderer: () => h(HeaderCell, ['Last modified']),
            cellRenderer: ({ rowIndex }) => {
              const file = files[rowIndex]
              return h(TextCell, [Utils.makePrettyDate(file.updatedAt)])
            }
          }
        ]
      })
    ])
  ])
}

export default FilesTable
