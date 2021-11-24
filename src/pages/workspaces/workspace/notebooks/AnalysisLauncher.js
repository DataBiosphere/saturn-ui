import * as clipboard from 'clipboard-polyfill/text'
import _ from 'lodash/fp'
import * as qs from 'qs'
import { Fragment, useEffect, useRef, useState } from 'react'
import { b, div, h, iframe, p, span } from 'react-hyperscript-helpers'
import * as breadcrumbs from 'src/components/breadcrumbs'
import { requesterPaysWrapper, withRequesterPaysHandler } from 'src/components/bucket-utils'
import { ButtonPrimary, ButtonSecondary, Clickable, LabeledCheckbox, Link, spinnerOverlay } from 'src/components/common'
import { ComputeModal } from 'src/components/ComputeModal'
import { icon } from 'src/components/icons'
import Modal from 'src/components/Modal'
import {
  AnalysisDuplicator, findPotentialNotebookLockers, getDisplayName, getTool,
  getToolFromRuntime, notebookLockHash, tools
} from 'src/components/notebook-utils'
import { makeMenuIcon, MenuButton, MenuTrigger } from 'src/components/PopupTrigger'
import {
  analysisLauncherTabName, analysisTabName,
  appLauncherTabName,
  ApplicationHeader,
  PlaygroundHeader,
  RuntimeKicker,
  RuntimeStatusMonitor,
  StatusMessage
} from 'src/components/runtime-common'
import { dataSyncingDocUrl } from 'src/data/machines'
import { Ajax } from 'src/libs/ajax'
import colors from 'src/libs/colors'
import { withErrorReporting } from 'src/libs/error'
import Events from 'src/libs/events'
import * as Nav from 'src/libs/nav'
import { notify } from 'src/libs/notifications'
import { getLocalPref, setLocalPref } from 'src/libs/prefs'
import { defaultLocation, getConvertedRuntimeStatus, getCurrentRuntime, usableStatuses } from 'src/libs/runtime-utils'
import { authStore, cookieReadyStore } from 'src/libs/state'
import * as Utils from 'src/libs/utils'
import ExportAnalysisModal from 'src/pages/workspaces/workspace/notebooks/ExportNotebookModal'
import { wrapWorkspace } from 'src/pages/workspaces/workspace/WorkspaceContainer'


const chooseMode = mode => {
  Nav.history.replace({ search: qs.stringify({ mode }) })
}

const AnalysisLauncher = _.flow(
  Utils.forwardRefWithName('AnalysisLauncher'),
  requesterPaysWrapper({
    onDismiss: ({ namespace, name }) => Nav.goToPath('workspace-dashboard', { namespace, name })
  }),
  wrapWorkspace({
    breadcrumbs: props => breadcrumbs.commonPaths.workspaceTab(props, 'analyses'),
    title: _.get('analysisName'),
    showTabBar: false,
    activeTab: analysisLauncherTabName
  })
)(
  ({
    queryParams, analysisName, workspace, workspace: { workspace: { bucketName, googleProject, namespace, name }, accessLevel, canCompute }, runtimes, persistentDisks,
    refreshRuntimes
  },
  ref) => {
    const [createOpen, setCreateOpen] = useState(false)
    const runtime = getCurrentRuntime(runtimes)
    const { runtimeName, labels } = runtime || {}
    const status = getConvertedRuntimeStatus(runtime)
    const [busy, setBusy] = useState()
    const [location, setLocation] = useState(defaultLocation)
    const { mode } = queryParams
    const toolLabel = getTool(analysisName)
    const iframeStyles = { height: '100%', width: '100%' }

    useEffect(() => {
      const loadBucketLocation = _.flow(
        Utils.withBusyState(setBusy),
        withErrorReporting('Error loading bucket location')
      )(async () => {
        const { location } = await Ajax()
          .Workspaces
          .workspace(namespace, name)
          .checkBucketLocation(googleProject, bucketName)
        setLocation(location)
      })
      loadBucketLocation()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [googleProject, bucketName])

    return h(Fragment, [

      div({ style: { flex: 1, display: 'flex' } }, [
        div({ style: { flex: 1 } }, [
          (Utils.canWrite(accessLevel) && canCompute && !!mode && _.includes(status, usableStatuses) && labels.tool === 'Jupyter') ?
            h(labels.welderInstallFailed ? WelderDisabledNotebookEditorFrame : AnalysisEditorFrame,
              { key: runtimeName, workspace, runtime, analysisName, mode, toolLabel, styles: iframeStyles }) :
            h(Fragment, [
              h(PreviewHeader, {
                styles: iframeStyles, queryParams, runtime, analysisName, toolLabel, workspace, setCreateOpen,
                readOnlyAccess: !(Utils.canWrite(accessLevel) && canCompute), onCreateRuntime: () => setCreateOpen(true)
              }),
              h(AnalysisPreviewFrame, { styles: iframeStyles, analysisName, toolLabel, workspace })
            ])
        ]),
        mode && h(RuntimeKicker, { runtime, refreshRuntimes, onNullRuntime: () => setCreateOpen(true) }),
        mode && h(RuntimeStatusMonitor, { runtime, onRuntimeStoppedRunning: () => chooseMode(undefined) }),
        h(ComputeModal, {
          isOpen: createOpen,
          tool: toolLabel,
          isAnalysisMode: true,
          workspace,
          runtimes,
          persistentDisks,
          location,
          onDismiss: () => {
            chooseMode(undefined)
            setCreateOpen(false)
          },
          onSuccess: _.flow(
            withErrorReporting('Error creating cloud compute'),
            Utils.withBusyState(setBusy)
          )(async () => {
            setCreateOpen(false)
            await refreshRuntimes(true)
          })
        }),
        busy && spinnerOverlay
      ])
    ])
  })

const FileInUseModal = ({ onDismiss, onCopy, onPlayground, namespace, name, bucketName, lockedBy, canShare }) => {
  const [lockedByEmail, setLockedByEmail] = useState()

  Utils.useOnMount(() => {
    const findLockedByEmail = withErrorReporting('Error loading locker information', async () => {
      const potentialLockers = await findPotentialNotebookLockers({ canShare, namespace, wsName: name, bucketName })
      const currentLocker = potentialLockers[lockedBy]
      setLockedByEmail(currentLocker)
    })
    findLockedByEmail()
  })

  return h(Modal, {
    width: 530,
    title: 'Notebook Is In Use',
    onDismiss,
    showButtons: false
  }, [
    p(lockedByEmail ?
      `This notebook is currently being edited by ${lockedByEmail}.` :
      `This notebook is currently locked because another user is editing it.`),
    p('You can make a copy, or run it in Playground Mode to explore and execute its contents without saving any changes.'),
    div({ style: { marginTop: '2rem' } }, [
      h(ButtonSecondary, {
        style: { padding: '0 1rem' },
        onClick: () => onDismiss()
      }, ['Cancel']),
      h(ButtonSecondary, {
        style: { padding: '0 1rem' },
        onClick: () => onCopy()
      }, ['Make a copy']),
      h(ButtonPrimary, {
        onClick: () => onPlayground()
      }, ['Run in playground mode'])
    ])
  ])
}

const EditModeDisabledModal = ({ onDismiss, onRecreateRuntime, onPlayground }) => {
  return h(Modal, {
    width: 700,
    title: 'Cannot Edit Notebook',
    onDismiss,
    showButtons: false
  }, [
    p('We’ve released important updates that are not compatible with the older cloud environment associated with this workspace. To enable Edit Mode, please delete your existing cloud environment and create a new cloud environment.'),
    p('If you have any files on your old cloud environment that you want to keep, you can access your old cloud environment using the Playground Mode option.'),
    h(Link, {
      'aria-label': 'Data syncing doc',
      href: dataSyncingDocUrl,
      ...Utils.newTabLinkProps
    }, ['Read here for more details.']),
    div({ style: { marginTop: '2rem' } }, [
      h(ButtonSecondary, {
        'aria-label': 'Launcher dismiss',
        style: { padding: '0 1rem' },
        onClick: () => onDismiss()
      }, ['Cancel']),
      h(ButtonSecondary, {
        'aria-label': 'Launcher playground',
        style: { padding: '0 1rem', marginLeft: '1rem' },
        onClick: () => onPlayground()
      }, ['Run in playground mode']),
      h(ButtonPrimary, {
        'aria-label': `Launcher create`,
        style: { padding: '0 1rem', marginLeft: '2rem' },
        onClick: () => onRecreateRuntime()
      }, ['Recreate cloud environment'])
    ])
  ])
}

const PlaygroundModal = ({ onDismiss, onPlayground }) => {
  const [hidePlaygroundMessage, setHidePlaygroundMessage] = useState(false)
  return h(Modal, {
    width: 530,
    title: 'Playground Mode',
    onDismiss,
    okButton: h(ButtonPrimary, {
      onClick: () => {
        setLocalPref('hidePlaygroundMessage', hidePlaygroundMessage)
        onPlayground()
      }
    },
    'Continue')
  }, [
    p(['Playground mode allows you to explore, change, and run the code, but your edits will not be saved.']),
    p(['To save your work, choose ', span({ style: { fontWeight: 600 } }, ['Download ']), 'from the ',
      span({ style: { fontWeight: 600 } }, ['File ']), 'menu.']),
    h(LabeledCheckbox, {
      checked: hidePlaygroundMessage,
      onChange: setHidePlaygroundMessage
    }, [span({ style: { marginLeft: '0.5rem' } }, ['Do not show again '])])
  ])
}

const HeaderButton = ({ children, ...props }) => h(ButtonSecondary, {
  'aria-label': `analysis header button`,
  style: { padding: '1rem', backgroundColor: colors.dark(0.1), height: '100%', marginRight: 2 }, ...props
}, [children])

const PreviewHeader = ({
  queryParams, runtime, readOnlyAccess, onCreateRuntime, analysisName, toolLabel, workspace, setCreateOpen,
  workspace: { canShare, workspace: { namespace, name, bucketName, googleProject } }
}) => {
  const signal = Utils.useCancellation()
  const { user: { email } } = Utils.useStore(authStore)
  const [fileInUseOpen, setFileInUseOpen] = useState(false)
  const [editModeDisabledOpen, setEditModeDisabledOpen] = useState(false)
  const [playgroundModalOpen, setPlaygroundModalOpen] = useState(false)
  const [locked, setLocked] = useState(false)
  const [lockedBy, setLockedBy] = useState(null)
  const [exportingAnalysis, setExportingAnalysis] = useState(false)
  const [copyingAnalysis, setCopyingAnalysis] = useState(false)
  const runtimeStatus = getConvertedRuntimeStatus(runtime)
  const welderEnabled = runtime && !runtime.labels.welderInstallFailed
  const { mode } = queryParams
  const analysisLink = Nav.getLink(analysisLauncherTabName, { namespace, name, analysisName })
  const currentRuntimeTool = getToolFromRuntime(runtime)

  const checkIfLocked = withErrorReporting('Error checking analysis lock status', async () => {
    const { metadata: { lastLockedBy, lockExpiresAt } = {} } = await Ajax(signal)
      .Buckets
      .analysis(googleProject, bucketName, getDisplayName(analysisName), toolLabel)
      .getObject()
    const hashedUser = await notebookLockHash(bucketName, email)
    const lockExpirationDate = new Date(parseInt(lockExpiresAt))

    if (lastLockedBy && (lastLockedBy !== hashedUser) && (lockExpirationDate > Date.now())) {
      setLocked(true)
      setLockedBy(lastLockedBy)
    }
  })

  Utils.useOnMount(() => { checkIfLocked() })

  return h(ApplicationHeader, {
    label: 'PREVIEW (READ-ONLY)',
    labelBgColor: colors.dark(0.2)
  }, [
    Utils.cond(
      [readOnlyAccess, () => h(HeaderButton, { onClick: () => setExportingAnalysis(true) }, [
        makeMenuIcon('export'), 'Copy to another workspace'
      ])],
      [!mode || [null, 'Stopped'].includes(runtimeStatus), () => h(Fragment, [
        ...(toolLabel === tools.Jupyter.label ? [
          Utils.cond(
            [runtime && !welderEnabled, () => h(HeaderButton, { onClick: () => setEditModeDisabledOpen(true) }, [
              makeMenuIcon('warning-standard'), 'Edit (Disabled)'
            ])],
            [locked, () => h(HeaderButton, { onClick: () => setFileInUseOpen(true) }, [
              makeMenuIcon('lock'), 'Edit (In use)'
            ])],
            () => h(HeaderButton, { onClick: () => currentRuntimeTool !== tools.Jupyter.label ? setCreateOpen(true) : chooseMode('edit') }, [
              makeMenuIcon('edit'), 'Edit'
            ])
          ),
          h(HeaderButton, {
            onClick: () => getLocalPref('hidePlaygroundMessage') ? chooseMode('playground') : setPlaygroundModalOpen(true)
          }, [
            makeMenuIcon('chalkboard'), 'Playground mode'
          ])
        ] : [
          h(HeaderButton, {
            onClick: () => {
              if (currentRuntimeTool !== tools.RStudio.label) {
                setCreateOpen(true)
              } else {
                runtimeStatus === 'Running' ? Nav.goToPath(appLauncherTabName, { namespace, name, application: 'RStudio' }) : setCreateOpen(true)
              }
            }
          }, [
            makeMenuIcon('rocket'), 'Launch'
          ])
        ]),
        h(MenuTrigger, {
          closeOnClick: true,
          content: h(Fragment, [
            h(MenuButton, { 'aria-label': `Copy analysis`, onClick: () => setCopyingAnalysis(true) }, ['Make a Copy']),
            h(MenuButton, { onClick: () => setExportingAnalysis(true) }, ['Copy to another workspace']),
            h(MenuButton, {
              onClick: withErrorReporting('Error copying to clipboard', async () => {
                await clipboard.writeText(`${window.location.host}/${analysisLink}`)
                notify('success', 'Successfully copied URL to clipboard', { timeout: 3000 })
              })
            }, ['Copy URL to clipboard'])
          ]),
          side: 'bottom'
        }, [
          h(HeaderButton, {}, [icon('ellipsis-v')])
        ])
      ])],
      [_.includes(runtimeStatus, usableStatuses), () => {
        console.assert(false, `Expected cloud environment to NOT be one of: [${usableStatuses}]`)
        return null
      }],
      [runtimeStatus === 'Creating', () => h(StatusMessage, [
        'Creating cloud environment. You can navigate away and return in 3-5 minutes.'
      ])],
      [runtimeStatus === 'Starting', () => h(StatusMessage, [
        'Starting cloud environment, this may take up to 2 minutes.'
      ])],
      [runtimeStatus === 'Stopping', () => h(StatusMessage, [
        'Cloud environment is stopping, which takes ~4 minutes. You can restart it after it finishes.'
      ])],
      [runtimeStatus === 'LeoReconfiguring', () => h(StatusMessage, [
        'Cloud environment is updating, please wait.'
      ])],
      [runtimeStatus === 'Error', () => h(StatusMessage, { hideSpinner: true }, ['Cloud environment error.'])]
    ),
    div({ style: { flexGrow: 1 } }),
    div({ style: { position: 'relative' } }, [
      h(Clickable, {
        'aria-label': 'Exit preview mode',
        style: { opacity: 0.65, marginRight: '1.5rem' },
        hover: { opacity: 1 }, focus: 'hover',
        onClick: () => Nav.goToPath(analysisTabName, { namespace, name })
      }, [icon('times-circle', { size: 30 })])
    ]),
    editModeDisabledOpen && h(EditModeDisabledModal, {
      onDismiss: () => setEditModeDisabledOpen(false),
      onRecreateRuntime: () => {
        setEditModeDisabledOpen(false)
        onCreateRuntime()
      },
      onPlayground: () => {
        setEditModeDisabledOpen(false)
        chooseMode('playground')
      }
    }),
    fileInUseOpen && h(FileInUseModal, {
      namespace, name, lockedBy, canShare, bucketName,
      onDismiss: () => setFileInUseOpen(false),
      onCopy: () => {
        setFileInUseOpen(false)
        setCopyingAnalysis(true)
      },
      onPlayground: () => {
        setFileInUseOpen(false)
        chooseMode('playground')
      }
    }),
    copyingAnalysis && h(AnalysisDuplicator, {
      printName: getDisplayName(analysisName),
      toolLabel: getTool(analysisName),
      fromLauncher: true,
      wsName: name, googleProject, namespace, bucketName, destroyOld: false,
      onDismiss: () => setCopyingAnalysis(false),
      onSuccess: () => setCopyingAnalysis(false)
    }),
    exportingAnalysis && h(ExportAnalysisModal, {
      printName: getDisplayName(analysisName),
      toolLabel: getTool(analysisName), workspace,
      fromLauncher: true,
      onDismiss: () => setExportingAnalysis(false)
    }),
    playgroundModalOpen && h(PlaygroundModal, {
      onDismiss: () => setPlaygroundModalOpen(false),
      onPlayground: () => {
        setPlaygroundModalOpen(false)
        chooseMode('playground')
      }
    })
  ])
}

const AnalysisPreviewFrame = ({ analysisName, toolLabel, workspace: { workspace: { googleProject, bucketName } }, onRequesterPaysError, styles }) => {
  const signal = Utils.useCancellation()
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState()
  const frame = useRef()

  const loadPreview = _.flow(
    Utils.withBusyState(setBusy),
    withRequesterPaysHandler(onRequesterPaysError),
    withErrorReporting('Error previewing analysis')
  )(async () => {
    setPreview(await Ajax(signal).Buckets.analysis(googleProject, bucketName, analysisName, toolLabel).preview())
  })
  Utils.useOnMount(() => {
    loadPreview()
  })

  return h(Fragment, [
    preview && h(Fragment, [
      iframe({
        ref: frame,
        onLoad: () => {
          const doc = frame.current.contentWindow.document
          doc.head.appendChild(Utils.createHtmlElement(doc, 'base', Utils.newTabLinkProps))
          doc.addEventListener('mousedown', () => window.document.dispatchEvent(new MouseEvent('mousedown')))
        },
        style: { border: 'none', flex: 1, ...styles },
        srcDoc: preview,
        title: 'Preview for analysis'
      })
    ]),
    busy && div({ style: { margin: '0.5rem 2rem' } }, ['Generating preview...'])
  ])
}

// TODO: this ensures that navigating away from the Jupyter iframe results in a save via a custom extension located in `jupyter-iframe-extension`
// See this ticket for RStudio impl discussion: https://broadworkbench.atlassian.net/browse/IA-2947
const JupyterFrameManager = ({ onClose, frameRef, details = {} }) => {
  Utils.useOnMount(() => {
    Ajax()
      .Metrics
      .captureEvent(Events.notebookLaunch,
        { 'Notebook Name': details.notebookName, 'Workspace Name': details.name, 'Workspace Namespace': details.namespace })

    const isSaved = Utils.atom(true)
    const onMessage = e => {
      switch (e.data) {
        case 'close':
          return onClose()
        case 'saved':
          return isSaved.set(true)
        case 'dirty':
          return isSaved.set(false)
        default:
      }
    }
    const saveNotebook = () => {
      frameRef.current.contentWindow.postMessage('save', '*')
    }
    const onBeforeUnload = e => {
      if (!isSaved.get()) {
        saveNotebook()
        e.preventDefault()
      }
    }
    window.addEventListener('message', onMessage)
    window.addEventListener('beforeunload', onBeforeUnload)
    Nav.blockNav.set(() => new Promise(resolve => {
      if (isSaved.get()) {
        resolve()
      } else {
        saveNotebook()
        isSaved.subscribe(resolve)
      }
    }))
    return () => {
      window.removeEventListener('message', onMessage)
      window.removeEventListener('beforeunload', onBeforeUnload)
      Nav.blockNav.reset()
    }
  })
  return null
}

const copyingAnalysisMessage = div({ style: { paddingTop: '2rem' } }, [
  h(StatusMessage, ['Copying analysis to cloud environment, almost ready...'])
])

const AnalysisEditorFrame = ({
  styles, mode, analysisName, toolLabel, workspace: { workspace: { googleProject, namespace, name, bucketName } },
  runtime: { runtimeName, proxyUrl, status, labels }
}) => {
  console.assert(_.includes(status, usableStatuses), `Expected cloud environment to be one of: [${usableStatuses}]`)
  console.assert(!labels.welderInstallFailed, 'Expected cloud environment to have Welder')
  const frameRef = useRef()
  const [busy, setBusy] = useState(false)
  const [analysisSetupComplete, setAnalysisSetupComplete] = useState(false)
  const cookieReady = Utils.useStore(cookieReadyStore)

  const localBaseDirectory = Utils.switchCase(toolLabel,
    [tools.Jupyter.label, () => `${name}/edit`],
    [tools.RStudio.label, () => ''])

  const localSafeModeBaseDirectory = Utils.switchCase(toolLabel,
    [tools.Jupyter.label, () => `${name}/safe`],
    [tools.RStudio.label, () => '']
  )

  Utils.useOnMount(() => {
    const cloudStorageDirectory = `gs://${bucketName}/notebooks`

    const pattern = Utils.switchCase(toolLabel,
      [tools.RStudio.label, () => '.*\\.Rmd'],
      [tools.Jupyter.label, () => '.*\\.ipynb']
    )

    const setUpAnalysis = _.flow(
      Utils.withBusyState(setBusy),
      withErrorReporting('Error setting up analysis')
    )(async () => {
      await Ajax()
        .Runtimes
        .fileSyncing(googleProject, runtimeName)
        .setStorageLinks(localBaseDirectory, localSafeModeBaseDirectory, cloudStorageDirectory, pattern)
      if (mode === 'edit' && !(await Ajax().Runtimes.fileSyncing(googleProject, runtimeName).lock(`${localBaseDirectory}/${analysisName}`))) {
        notify('error', 'Unable to Edit Analysis', {
          message: 'Another user is currently editing this analysis. You can run it in Playground Mode or make a copy.'
        })
        chooseMode(undefined)
      } else {
        await Ajax().Runtimes.fileSyncing(googleProject, runtimeName).localize([{
          sourceUri: `${cloudStorageDirectory}/${analysisName}`,
          localDestinationPath: mode === 'edit' ? `${localBaseDirectory}/${analysisName}` : `${localSafeModeBaseDirectory}/${analysisName}`
        }])
        setAnalysisSetupComplete(true)
      }
    })

    setUpAnalysis()
  })

  return h(Fragment, [
    analysisSetupComplete && cookieReady && h(Fragment, [
      iframe({
        src: `${proxyUrl}/notebooks/${mode === 'edit' ? localBaseDirectory : localSafeModeBaseDirectory}/${analysisName}`,
        style: { border: 'none', flex: 1, ...styles },
        ref: frameRef
      }),
      h(JupyterFrameManager, {
        frameRef,
        onClose: () => Nav.goToPath(analysisTabName, { namespace, name }),
        details: { analysisName, name, namespace }
      })
    ]),
    busy && copyingAnalysisMessage
  ])
}

//TODO: this originally was designed to handle VMs that didn't have welder deployed on them
// do we need this anymore? (can be queried in prod DB to see if there are any VMs with welderEnabled=false with a `recent` dateAccessed
// do we need to support this for rstudio? I don't think so because welder predates RStudio support, but not 100%
const WelderDisabledNotebookEditorFrame = ({
  styles, mode, notebookName, workspace: { workspace: { googleProject, namespace, name, bucketName } },
  runtime: { runtimeName, proxyUrl, status, labels }
}) => {
  console.assert(status === 'Running', 'Expected cloud environment to be running')
  console.assert(!!labels.welderInstallFailed, 'Expected cloud environment to not have Welder')
  const frameRef = useRef()
  const signal = Utils.useCancellation()
  const [busy, setBusy] = useState(false)
  const [localized, setLocalized] = useState(false)
  const cookieReady = Utils.useStore(cookieReadyStore)

  const localizeNotebook = _.flow(
    Utils.withBusyState(setBusy),
    withErrorReporting('Error copying notebook')
  )(async () => {
    if (mode === 'edit') {
      notify('error', 'Cannot Edit Notebook', {
        message: h(Fragment, [
          p(['Recent updates to Terra are not compatible with the older cloud environment in this workspace. Please recreate your cloud environment in order to access Edit Mode for this notebook.']),
          h(Link, { href: dataSyncingDocUrl, ...Utils.newTabLinkProps }, ['Read here for more details.'])
        ])
      })
      chooseMode(undefined)
    } else {
      await Ajax(signal).Runtimes.fileSyncing(googleProject, runtimeName).oldLocalize({
        [`~/${name}/${notebookName}`]: `gs://${bucketName}/notebooks/${notebookName}`
      })
      setLocalized(true)
    }
  })

  Utils.useOnMount(() => {
    localizeNotebook()
  })

  return h(Fragment, [
    h(PlaygroundHeader, [
      'Edits to this notebook are ',
      b(['NOT ']),
      'being saved to the workspace. To save your changes, download the notebook using the file menu.',
      h(Link, {
        style: { marginLeft: '0.5rem' },
        href: dataSyncingDocUrl,
        ...Utils.newTabLinkProps
      }, ['Read here for more details.'])
    ]),
    localized && cookieReady && h(Fragment, [
      iframe({
        src: `${proxyUrl}/notebooks/${name}/${notebookName}`,
        style: { border: 'none', flex: 1, ...styles },
        ref: frameRef
      }),
      h(JupyterFrameManager, {
        frameRef,
        onClose: () => Nav.goToPath(analysisTabName, { namespace, name }),
        details: { notebookName, name, namespace }
      })
    ]),
    busy && copyingAnalysisMessage
  ])
}

export const navPaths = [
  {
    name: analysisLauncherTabName,
    path: '/workspaces/:namespace/:name/analysis/launch/:analysisName',
    component: AnalysisLauncher,
    title: ({ name, analysisName }) => `${analysisName} - ${name}`
  }
]
