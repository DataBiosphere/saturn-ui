import _ from 'lodash/fp'
import { Fragment, useEffect, useState } from 'react'
import { div, fieldset, h, h1, legend, li, ol, p, span, ul } from 'react-hyperscript-helpers'
import { ButtonPrimary, ButtonSecondary, DeleteConfirmationModal, IdContainer, LabeledCheckbox, spinnerOverlay } from 'src/components/common'
import { parseGsUri } from 'src/components/data/data-utils'
import { icon, spinner } from 'src/components/icons'
import { TextInput } from 'src/components/input'
import Modal from 'src/components/Modal'
import { Ajax } from 'src/libs/ajax'
import colors from 'src/libs/colors'
import { tableNameForRestore } from 'src/libs/data-table-versions'
import { FormLabel } from 'src/libs/forms'
import { useCancellation } from 'src/libs/react-utils'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'


const DownloadVersionButton = ({ url }) => {
  const signal = useCancellation()
  const [downloadUrl, setDownloadUrl] = useState()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    const loadUrl = Utils.withBusyState(setLoading, async () => {
      try {
        setDownloadUrl(null)
        setError(false)
        const [bucket, object] = parseGsUri(url)
        const { url: signedUrl } = await Ajax(signal).DrsUriResolver.getSignedUrl({ bucket, object })
        setDownloadUrl(signedUrl)
      } catch (error) {
        setError(true)
      }
    })
    loadUrl()
  }, [signal, url])

  return h(ButtonPrimary, {
    disabled: !downloadUrl,
    href: downloadUrl,
    tooltip: !!error && 'Error generating download URL'
  }, [
    loading && icon('loadingSpinner', { size: 12, style: { marginRight: '1ch' } }),
    'Download'
  ])
}

export const DataTableVersion = ({ version, onDelete, onRestore }) => {
  const { entityType, includedSetEntityTypes, timestamp, description } = version

  const [showRestoreConfirmation, setShowRestoreConfirmation] = useState(false)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [busy, setBusy] = useState(false)

  return div({ style: { padding: '1rem' } }, [
    h1({
      style: {
        ...Style.elements.sectionHeader, fontSize: 20,
        paddingBottom: '0.5rem', borderBottom: Style.standardLine, marginBottom: '1rem'
      }
    }, [
      `${entityType} (${Utils.makeCompleteDate(timestamp)})`
    ]),
    _.size(includedSetEntityTypes) > 0 && h(IdContainer, [id => h(Fragment, [
      p({ id }, ['Included set tables:']),
      ul({ 'aria-labelledby': id, style: { margin: 0 } }, [
        _.map(type => li({ key: type }, [type]), includedSetEntityTypes)
      ])
    ])]),
    version.createdBy && p([`Created by: ${version.createdBy}`]),
    p([description || 'No description']),
    div({ style: { marginBottom: '1rem' } }, [
      h(DownloadVersionButton, { url: version.url })
    ]),
    div({ style: { marginBottom: '1rem' } }, [
      h(ButtonPrimary, {
        disabled: busy,
        onClick: () => setShowRestoreConfirmation(true)
      }, ['Restore'])
    ]),
    div({ style: { marginBottom: '1rem' } }, [
      h(ButtonPrimary, {
        danger: true,
        disabled: busy,
        onClick: () => setShowDeleteConfirmation(true)
      }, ['Delete'])
    ]),
    showRestoreConfirmation && h(DataTableRestoreVersionModal, {
      version,
      onConfirm: async () => {
        setShowRestoreConfirmation(false)
        setBusy(true)
        try {
          await onRestore()
        } catch (err) {
          setBusy(false)
        }
      },
      onDismiss: () => {
        setShowRestoreConfirmation(false)
      }
    }),
    showDeleteConfirmation && h(DeleteConfirmationModal, {
      objectType: 'version',
      objectName: Utils.makeCompleteDate(timestamp),
      onConfirm: async () => {
        setShowDeleteConfirmation(false)
        try {
          setBusy(true)
          await onDelete()
        } catch (err) {
          setBusy(false)
        }
      },
      onDismiss: () => {
        setShowDeleteConfirmation(false)
      }
    }),
    busy && spinnerOverlay
  ])
}

export const DataTableVersions = ({ loading, error, versions, savingNewVersion, onClickVersion }) => {
  return div({ style: { padding: '1rem 0.5rem 1rem 1.5rem', borderBottom: `1px solid ${colors.dark(0.2)}` } }, [
    Utils.cond(
      [loading, () => div({ style: { display: 'flex', alignItems: 'center' } }, [
        spinner({ size: 16, style: { marginRight: '1ch' } }),
        'Loading version history'
      ])],
      [error, () => div({ style: { display: 'flex', alignItems: 'center' } }, [
        'Error loading version history'
      ])],
      [_.isEmpty(versions) && !savingNewVersion, () => 'No versions saved'],
      () => h(IdContainer, [id => h(Fragment, [
        div({ id, style: { marginBottom: '0.5rem' } }, ['Version history']),
        savingNewVersion && div({ style: { display: 'flex', alignItems: 'center' } }, [
          spinner({ size: 16, style: { marginRight: '1ch' } }),
          'Saving new version'
        ]),
        ol({ 'aria-labelledby': id, style: { margin: savingNewVersion ? '0.5rem 0 0 ' : 0, padding: 0, listStyleType: 'none' } }, [
          _.map(([index, version]) => {
            return li({ key: version.url, style: { marginBottom: index < versions.length - 1 ? '0.5rem' : 0 } }, [
              h(ButtonSecondary, { style: { height: 'auto' }, onClick: () => onClickVersion(version) }, [Utils.makeCompleteDate(version.timestamp)]),
              div({ style: { ...Style.noWrapEllipsis } }, [version.description || 'No description'])
            ])
          }, Utils.toIndexPairs(versions))
        ])
      ])])
    )
  ])
}

export const DataTableSaveVersionModal = ({ entityType, allEntityTypes, onDismiss, onSubmit }) => {
  const relatedSetTables = _.flow(
    _.filter(t => (new RegExp(`^${entityType}(_set)+$`)).test(t)),
    _.sortBy(_.identity)
  )(allEntityTypes)

  const [description, setDescription] = useState('')
  const [selectedSetTables, setSelectedSetTables] = useState(_.fromPairs(_.map(table => [table, false], relatedSetTables)))

  return h(Modal, {
    onDismiss,
    title: `Save version of ${entityType}`,
    okButton: h(ButtonPrimary, {
      onClick: () => onSubmit({
        description,
        includedSetEntityTypes: _.keys(_.pickBy(_.identity, selectedSetTables))
      })
    }, ['Save'])
  }, [
    h(IdContainer, [id => h(Fragment, [
      h(FormLabel, { htmlFor: id }, ['Description']),
      h(TextInput, {
        id,
        placeholder: 'Enter a description',
        value: description,
        onChange: setDescription
      })
    ])]),
    _.size(relatedSetTables) > 0 && fieldset({ style: { border: 'none', margin: '1rem 0 0', padding: 0 } }, [
      legend({ style: { marginBottom: '0.25rem', fontSize: '16px', fontWeight: 600 } }, ['Include set tables?']),
      _.map(
        table => div({
          key: table,
          style: { marginBottom: '0.25rem' }
        }, [
          h(LabeledCheckbox, {
            checked: selectedSetTables[table],
            onChange: value => setSelectedSetTables(_.set(table, value))
          }, [table])
        ]),
        relatedSetTables
      )
    ])
  ])
}

export const DataTableRestoreVersionModal = ({ version, onDismiss, onConfirm }) => {
  return h(Modal, {
    onDismiss,
    title: `Restore version`,
    okButton: h(ButtonPrimary, { 'data-testid': 'confirm-restore', onClick: () => onConfirm() }, ['Restore'])
  }, [
    'This version will be restored to a new data table: ',
    span({ style: { fontWeight: 600 } }, [tableNameForRestore(version)])
  ])
}
