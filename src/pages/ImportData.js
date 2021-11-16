import _ from 'lodash/fp'
import { Fragment, useState } from 'react'
import { div, h, h2, img, li, p, strong, ul } from 'react-hyperscript-helpers'
import Collapse from 'src/components/Collapse'
import { backgroundLogo, ButtonPrimary, ButtonSecondary, Clickable, IdContainer, RadioButton, spinnerOverlay } from 'src/components/common'
import { notifyDataImportProgress } from 'src/components/data/data-utils'
import FooterWrapper from 'src/components/FooterWrapper'
import { icon, wdlIcon } from 'src/components/icons'
import NewWorkspaceModal from 'src/components/NewWorkspaceModal'
import TopBar from 'src/components/TopBar'
import { useWorkspaces, WorkspaceSelector } from 'src/components/workspace-utils'
import jupyterLogo from 'src/images/jupyter-logo.svg'
import { Ajax } from 'src/libs/ajax'
import colors from 'src/libs/colors'
import { getConfig } from 'src/libs/config'
import { withErrorReporting } from 'src/libs/error'
import Events, { extractWorkspaceDetails } from 'src/libs/events'
import { FormLabel } from 'src/libs/forms'
import * as Nav from 'src/libs/nav'
import { notify } from 'src/libs/notifications'
import { asyncImportJobStore } from 'src/libs/state'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import { useDataCatalog } from 'src/pages/library/dataBrowser-utils'


const styles = {
  container: {
    display: 'flex', alignItems: 'flex-start', flex: 'auto',
    position: 'relative', padding: '2rem'
  },
  title: {
    fontSize: 24, fontWeight: 600, color: colors.dark(), margin: '0 0 1rem 0'
  },
  card: {
    borderRadius: 5, backgroundColor: 'white', padding: '2rem',
    flex: 1, minWidth: 0, boxShadow: Style.standardShadow
  }
}

const ChoiceButton = ({ iconName, title, detail, style, ...props }) => {
  return h(Clickable, {
    style: {
      ...style,
      padding: '1rem', marginTop: '1rem',
      display: 'flex', alignItems: 'center',
      border: `1px solid ${colors.accent(1)}`, borderRadius: 4
    },
    hover: { backgroundColor: colors.accent(0.1) },
    ...props
  }, [
    icon(iconName, { size: 29, style: { flex: 'none', marginRight: '1rem', color: colors.accent(1) } }),
    div({ style: { flex: 1 } }, [
      div({ style: { fontWeight: 'bold', color: colors.accent(1) } }, [title]),
      div([detail])
    ]),
    icon('angle-right', { size: 32, style: { flex: 'none', marginLeft: '1rem', color: colors.accent(1) } })
  ])
}

const ImportData = () => {
  const { workspaces, refresh: refreshWorkspaces, loading: loadingWorkspaces } = useWorkspaces()
  const [isImporting, setIsImporting] = useState(false)
  const { query: { url, format, ad, wid, template, snapshotId, snapshotName, snapshotIds, referrer } } = Nav.useRoute()
  const [mode, setMode] = useState(wid ? 'existing' : undefined)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isCloneOpen, setIsCloneOpen] = useState(false)
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(wid)
  const [selectedTemplateWorkspaceKey, setSelectedTemplateWorkspaceKey] = useState()
  const [allTemplates, setAllTemplates] = useState()

  const { dataCatalog } = useDataCatalog()
  const snapshots = _.flow(
    _.filter(snapshot => _.includes(snapshot['dct:identifier'], snapshotIds)),
    _.map(snapshot => ({ id: snapshot['dct:identifier'], title: snapshot['dct:title'], description: snapshot['dct:description'] }))
  )(dataCatalog)
  const [snapshotResponses, setSnapshotResponses] = useState()

  const isDataset = format !== 'snapshot'
  const noteMessage = 'Note that the import process may take some time after you are redirected into your destination workspace.'
  const [title, header] = Utils.cond(
    [referrer === 'data-catalog', () => ['Catalog', 'Linking data to a workspace']],
    [isDataset, () => ['Import Data', `Dataset ${snapshotName}`]],
    [Utils.DEFAULT, () => ['Import Snapshot', `Snapshot ${snapshotName}`]]
  )

  const selectedWorkspace = _.find({ workspace: { workspaceId: selectedWorkspaceId } }, workspaces)

  const filteredTemplates =
    _.flow(
      _.flatMap(id => (allTemplates && allTemplates[id]) || []),
      _.filter(({ name, namespace }) => _.some({ workspace: { namespace, name } }, workspaces))
    )(_.castArray(template))

  Utils.useOnMount(() => {
    const loadTemplateWorkspaces = _.flow(
      Utils.withBusyState(setIsImporting),
      withErrorReporting('Error loading templates')
    )(async () => {
      setAllTemplates(await fetch(`${getConfig().firecloudBucketRoot}/template-workspaces.json`).then(res => res.json()))
    })
    loadTemplateWorkspaces()
  })

  const onImport = _.flow(
    Utils.withBusyState(setIsImporting),
    withErrorReporting('Import Error')
  )(async workspace => {
    const namespace = workspace.namespace
    const name = workspace.name
    let success = true
    await Utils.switchCase(format,
      ['PFB', async () => {
        const { jobId } = await Ajax().Workspaces.workspace(namespace, name).importPFB(url)
        asyncImportJobStore.update(Utils.append({ targetWorkspace: { namespace, name }, jobId }))
        notifyDataImportProgress(jobId)
      }],
      ['entitiesJson', async () => {
        await Ajax().Workspaces.workspace(namespace, name).importJSON(url)
        notify('success', 'Data imported successfully.', { timeout: 3000 })
      }],
      ['snapshot', async () => {
        snapshots && snapshots.length > 0 ?
          await Promise.allSettled(
            _.map(({ title, id, description }) => {
              // Replace all whitespace characters with _
              // Then replace all non alphanumeric characters with nothing
              const normalizedTitle = title.replace(/\s/g, '_').replace(/[^A-Za-z0-9\s-_]/g, '')
              return Ajax().Workspaces.workspace(namespace, name).importSnapshot(id, normalizedTitle, description)
            }, snapshots)
          ).then(async responses => {
            success = !_.some(({ status }) => status === 'rejected', responses)

            if (!success) {
              const normalizedResponses = await Promise.all(_.map(async ({ status, reason }) => {
                const reasonJson = reason ? await reason.json() : '{}'
                const message = JSON.parse(reasonJson.message || '{}').message
                return { status, message }
              }, responses))
              setSnapshotResponses(normalizedResponses)
              notify('error', `There was a problem importing ${snapshots.length > 1 ? 'some of these snapshots' : 'this snapshot'}`, { timeout: 3000 })
            }
          }) :
          await Ajax().Workspaces.workspace(namespace, name).importSnapshot(snapshotId, snapshotName).then(() => {
            notify('success', 'Snapshot imported successfully.', { timeout: 3000 })
          })
      }],
      [Utils.DEFAULT, async () => {
        await Ajax().Workspaces.workspace(namespace, name).importBagit(url)
        notify('success', 'Data imported successfully.', { timeout: 3000 })
      }]
    )
    Ajax().Metrics.captureEvent(Events.workspaceDataImport, { format, ...extractWorkspaceDetails(workspace) })

    if (success) {
      Nav.goToPath('workspace-data', { namespace, name })
    }
  })

  return h(FooterWrapper, [
    h(TopBar, { title }),
    div({ role: 'main', style: styles.container }, [
      backgroundLogo,
      div({ style: styles.card }, [
        h2({ style: styles.title }, [header]),
        snapshots && snapshots.length > 0 ?
          div({ style: { marginTop: 20, marginBottom: 60 } }, [
            'Dataset(s):',
            ul({ style: { listStyle: 'none', position: 'relative', marginLeft: 0, paddingLeft: '2rem' } }, [
              _.flow(
                Utils.toIndexPairs,
                _.map(([mapindex, { title, id }]) => li({
                  key: `snapshot_${id}`,
                  style: {
                    fontSize: 16,
                    fontWeight: 'bold',
                    marginTop: 20,
                    paddingTop: mapindex ? 20 : 0,
                    borderTop: `${mapindex ? 1 : 0}px solid #AAA`
                  }
                }, [
                  !snapshotResponses ?
                    div([
                      icon('success-standard', { size: 18, style: { position: 'absolute', left: 0, color: colors.primary() } }),
                      title
                    ]) :
                    Utils.switchCase(snapshotResponses[mapindex].status,
                      ['fulfilled', () => {
                        return h(Fragment, [
                          icon('success-standard', { size: 18, style: { position: 'absolute', left: 0, color: colors.primary() } }),
                          title,
                          div({ style: { color: colors.primary(), fontWeight: 'normal', fontSize: '0.625rem', marginTop: 5 } }, [
                            strong(['Success: ']), 'Snapshot successfully imported' ]
                          )
                        ])
                      }],
                      ['rejected', () => {
                        return h(Fragment, [
                          icon('warning-standard', { size: 18, style: { position: 'absolute', left: 0, color: colors.danger() } }),
                          title,
                          div({ style: { color: colors.danger(), fontWeight: 'normal', fontSize: '0.625rem', marginTop: 5, wordBreak: 'break-word' } }, [
                            strong(['Error: ']),
                            snapshotResponses[mapindex].message
                          ])
                        ])
                      }
                    ])
                ])))(snapshots)
            ])
          ]) :
          div({ style: { fontSize: 16 } }, ['From: ', new URL(url).hostname]),
        div({ style: { marginTop: '1rem' } }, [
          `The ${isDataset ? 'dataset' : 'snapshot'}(s) you just chose to import to Terra will be made available to you `,
          'within a workspace of your choice where you can then perform analysis.'
        ])
      ]),
      div({ style: { ...styles.card, marginLeft: '2rem' } }, [
        Utils.switchCase(mode,
          ['existing', () => {
            return h(Fragment, [
              h2({ style: styles.title }, ['Start with an existing workspace']),
              h(IdContainer, [id => h(Fragment, [
                h(FormLabel, { htmlFor: id, style: { marginBottom: '0.25rem' } }, ['Select one of your workspaces']),
                h(WorkspaceSelector, {
                  id,
                  workspaces: _.filter(ws => {
                    return Utils.canWrite(ws.accessLevel) &&
                      (!ad || _.some({ membersGroupName: ad }, ws.workspace.authorizationDomain))
                  }, workspaces),
                  value: selectedWorkspaceId,
                  onChange: setSelectedWorkspaceId
                })
              ])]),
              isDataset && div({ style: { marginTop: '0.5rem', lineHeight: '1.5' } }, [noteMessage]),
              div({ style: { display: 'flex', alignItems: 'center', marginTop: '1rem' } }, [
                h(ButtonSecondary, { onClick: setMode, style: { marginLeft: 'auto' } }, ['Back']),
                h(ButtonPrimary, {
                  style: { marginLeft: '2rem' },
                  disabled: !selectedWorkspace,
                  onClick: () => onImport(selectedWorkspace.workspace)
                }, ['Import'])
              ])
            ])
          }],
          ['template', () => {
            return h(Fragment, [
              h2({ style: styles.title }, ['Start with a template']),
              isDataset && div({ style: { marginBottom: '1rem', lineHeight: '1.5' } }, [noteMessage]),
              div({
                role: 'radiogroup',
                'aria-label': 'choose a template',
                style: { overflow: 'auto', maxHeight: '25rem' }
              }, [
                _.map(([i, ws]) => {
                  const { name, namespace, description, hasNotebooks, hasWorkflows } = ws
                  const isSelected = _.isEqual({ name, namespace }, selectedTemplateWorkspaceKey)

                  return div({
                    key: `${name}/${namespace}`,
                    style: {
                      display: 'flex', alignItems: 'baseline',
                      marginBottom: '1rem', paddingLeft: '0.25rem',
                      ...(i > 0 ? { borderTop: Style.standardLine, paddingTop: '1rem' } : {})
                    }
                  }, [
                    h(RadioButton, {
                      name: 'select-template',
                      checked: isSelected,
                      onChange: () => setSelectedTemplateWorkspaceKey({ namespace, name }),
                      text: h(Collapse, {
                        buttonStyle: { color: colors.dark(), fontWeight: 600 },
                        style: { fontSize: 14, marginLeft: '0.5rem' },
                        title: h(Fragment, [
                          name,
                          hasNotebooks && img({ src: jupyterLogo, style: { height: 23, width: 23, marginLeft: '0.5rem' } }),
                          hasWorkflows &&
                            wdlIcon({ style: { height: 23, width: 23, marginLeft: '0.5rem', borderRadius: 3, padding: '8px 4px 7px 4px' } })
                        ])
                      }, [p({ style: { fontSize: 14, lineHeight: '1.5', marginRight: '1rem' } }, [description])])
                    })
                  ]
                  )
                }, Utils.toIndexPairs(filteredTemplates))
              ]),
              div({ style: { display: 'flex', alignItems: 'center', marginTop: '1rem' } }, [
                h(ButtonSecondary, { style: { marginLeft: 'auto' }, onClick: setMode }, ['Back']),
                h(ButtonPrimary, {
                  style: { marginLeft: '2rem' },
                  disabled: !selectedTemplateWorkspaceKey,
                  onClick: () => setIsCloneOpen(true)
                }, ['Import'])
              ])
            ])
          }],
          [Utils.DEFAULT, () => {
            return h(Fragment, [
              h2({ style: styles.title }, ['Destination Workspace']),
              div({ style: { marginTop: '0.5rem' } }, ['Choose the option below that best suits your needs.']),
              !!filteredTemplates.length && h(ChoiceButton, {
                onClick: () => setMode('template'),
                iconName: 'copySolid',
                title: 'Start with a template',
                detail: 'Clone from one of our template workspaces that has analyses ready for use'
              }),
              h(ChoiceButton, {
                onClick: () => setMode('existing'),
                iconName: 'fileSearchSolid',
                title: 'Start with an existing workspace',
                detail: 'Select one of your workspaces'
              }),
              h(ChoiceButton, {
                onClick: () => setIsCreateOpen(true),
                iconName: 'plus-circle',
                title: 'Start with a new workspace',
                detail: 'Set up an empty workspace that you will configure for analysis',
                'aria-haspopup': 'dialog'
              }),
              isCreateOpen && h(NewWorkspaceModal, {
                requiredAuthDomain: ad,
                customMessage: isDataset && noteMessage,
                onDismiss: () => setIsCreateOpen(false),
                onSuccess: w => {
                  setMode('existing')
                  setIsCreateOpen(false)
                  setSelectedWorkspaceId(w.workspaceId)
                  refreshWorkspaces()
                  onImport(w)
                }
              })
            ])
          }]
        ),
        isCloneOpen && h(NewWorkspaceModal, {
          cloneWorkspace: _.find({ workspace: selectedTemplateWorkspaceKey }, workspaces),
          title: `Clone ${selectedTemplateWorkspaceKey.name} and Import Data`,
          buttonText: 'Clone and Import',
          customMessage: isDataset && noteMessage,
          onDismiss: () => setIsCloneOpen(false),
          onSuccess: w => {
            setMode('existing')
            setIsCloneOpen(false)
            setSelectedWorkspaceId(w.workspaceId)
            refreshWorkspaces()
            onImport(w)
          }
        }),
        (isImporting || loadingWorkspaces) && spinnerOverlay
      ])
    ])
  ])
}

export const navPaths = [
  {
    name: 'import-data',
    path: '/import-data',
    component: ImportData,
    title: 'Import Data'
  }
]
