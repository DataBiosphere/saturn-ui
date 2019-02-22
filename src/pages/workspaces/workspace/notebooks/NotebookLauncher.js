import _ from 'lodash/fp'
import { createRef, Fragment } from 'react'
import { div, h, iframe } from 'react-hyperscript-helpers'
import * as breadcrumbs from 'src/components/breadcrumbs'
import { linkButton, spinnerOverlay, link } from 'src/components/common'
import { icon, spinner } from 'src/components/icons'
import { notify } from 'src/components/Notifications'
import { ajaxCaller } from 'src/libs/ajax'
import colors from 'src/libs/colors'
import { reportError } from 'src/libs/error'
import * as Nav from 'src/libs/nav'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import { Component } from 'src/libs/wrapped-components'
import ExportNotebookModal from 'src/pages/workspaces/workspace/notebooks/ExportNotebookModal'
import { wrapWorkspace } from 'src/pages/workspaces/workspace/WorkspaceContainer'

const getCluster = clusters => {
  return _.flow(
    _.remove({ status: 'Deleting' }), // do we want to have a specific message for when deleting a cluster?
    _.sortBy('createdDate'),
    _.first
  )(clusters)
}

const statusMessage = ({ clusters }) => {
  console.log({ clusters })
  const cluster = getCluster(clusters)
  const clusterStatus = cluster && cluster.status

  const creatingMessage = 'Creating notebook runtime. This can take several minutes. You may view a read-only version of your notebook and edit it once the cluster is ready.'
  const startingMessage = 'Waiting for notebook runtime to be ready. Loading notebook.'
  const runningMessage = 'Cluster is running'

  const isCreating = clusterStatus === 'Creating'
  const isStarting = clusterStatus === 'Starting'
  const isRunning = clusterStatus === 'Running'
  //const isStopping = clusterStatus === 'Stopping'
  //const isStopped = clusterStatus === 'Stopped'

  return Utils.cond(
    [isCreating, creatingMessage],
    [isStarting, startingMessage],
    [isRunning, runningMessage],
    'Something went wrong'
  )
}

class loadingMessage extends Component {
  render() {
    const { clusterError } = this.state
    const { clusters } = this.props
    const cluster = getCluster(clusters)
    const clusterStatus = cluster && cluster.status
    const isCreating = clusterStatus === 'Creating'
    const currentStep = clusterStatus !== 'Running' ? 1 : 2

    console.log(statusMessage({ clusters }))

    //console.log(clusters)
    // console.log(currentStep)
    // console.log(clusterStatus)

    const step = (index, text) => div({ style: { display: 'flex', alignItems: 'center', lineHeight: '2rem', margin: '0.5rem 0' } }, [
      div({ style: { flex: '0 0 30px' } }, [
        index < currentStep && icon('check', { size: 24, style: { color: colors.green[0] } }),
        index === currentStep && spinner()
      ]),
      div({ style: { flex: 1 } }, [text])
    ])

    return h(Fragment, [
      div({ style: { padding: '2rem' } }, [
        div({ style: Style.elements.sectionHeader }, ['Terra is preparing your notebook']),
        step(1,
          Utils.cond(
            [clusterError, clusterError],
            [isCreating, 'Creating notebook runtime'],
            'Waiting for notebook runtime to be ready.'
          )
        ),
        isCreating && (div({ style: { paddingLeft: '4rem' } }, [
          icon('info', { size: 24, style: { color: colors.orange[0] } }),
          'This can take several minutes. You may view a read-only version of your notebook and edit it once the cluster is ready.'
        ])
        ),
        step(2, 'Loading notebook')
      ])
    ])
  }
}

const NotebookLauncher = _.flow(
  wrapWorkspace({
    breadcrumbs: props => breadcrumbs.commonPaths.workspaceDashboard(props),
    title: ({ notebookName }) => `Notebooks - ${notebookName}`,
    topBarContent: ({ workspace, notebookName, queryParams = {} }) => {
      return workspace && (!(Utils.canWrite(workspace.accessLevel) && workspace.canCompute) || queryParams['read-only'])
        && h(ReadOnlyMessage, { notebookName, workspace })
    },
    showTabBar: false
  }),
  ajaxCaller
)(({ workspace, app, queryParams = {}, ...props }) => {
  return Utils.canWrite(workspace.accessLevel) && workspace.canCompute && !queryParams['read-only'] ?
    h(NotebookEditor, { workspace, app, ...props }) :
    h(NotebookViewer, { workspace, ...props })
})

class ReadOnlyMessage extends Component {
  constructor(props) {
    super(props)
    this.state = {
      copying: false
    }
  }

  render() {
    const { notebookName, workspace } = this.props
    const { copying } = this.state
    return div({ style: { marginLeft: 'auto' } }, [
      div({ style: { fontSize: 16, fontWeight: 'bold' } },
        ['Read-only']),
      workspace.canCompute ?
        div({ style: { fontSize: 14 } }, [link({ href: window.location.href.split('?')[0] }, 'Switch to edit')]) // TODO: how to remove query params
        : div({ style: { fontSize: 14 } }, ['To edit, ', link({ onClick: () => this.setState({ copying: true }) }, 'copy this notebook'), ' to another workspace']),
      copying && h(ExportNotebookModal, {
        printName: notebookName.slice(0, -6), workspace, fromLauncher: true,
        onDismiss: () => this.setState({ copying: false })
      })
    ])
  }
}

class NotebookViewer extends Component {
  constructor(props) {
    super(props)
    this.state = {
      preview: undefined,
      busy: false
    }
  }

  async componentDidMount() {
    try {
      const { namespace, notebookName, workspace: { workspace: { bucketName } }, ajax: { Buckets } } = this.props
      this.setState({ busy: true })
      const preview = await Buckets.notebook(namespace, bucketName, notebookName).preview()
      this.setState({ preview })
    } catch (error) {
      reportError('Error loading notebook', error)
    } finally {
      this.setState({ busy: false })
    }
  }

  render() {
    const { namespace, name } = this.props
    const { preview, busy } = this.state
    return h(Fragment, [
      preview && iframe({
        style: { border: 'none', flex: 1 },
        srcDoc: preview
      }),
      preview && linkButton({
        style: { position: 'absolute', top: 20, left: 'calc(50% + 570px)' },
        onClick: () => Nav.goToPath('workspace-notebooks', { namespace, name })
      }, [icon('times-circle', { size: 30 })]),
      busy && spinnerOverlay
    ])
  }
}

class NotebookEditor extends Component {
  saveNotebook() {
    this.notebookFrame.current.contentWindow.postMessage('save', '*')
  }

  constructor(props) {
    super(props)
    this.isSaved = Utils.atom(true)
    this.notebookFrame = createRef()
    this.beforeUnload = e => {
      if (!this.isSaved.get()) {
        this.saveNotebook()
        e.preventDefault()
      }
    }
    this.handleMessages = e => {
      const { namespace, name } = this.props

      switch (e.data) {
        case 'close':
          Nav.goToPath('workspace-notebooks', { namespace, name })
          break
        case 'saved':
          this.isSaved.set(true)
          break
        case 'dirty':
          this.isSaved.set(false)
          break
        default:
          console.log('Unrecognized message:', e.data)
      }
    }
  }

  async componentDidMount() {
    window.addEventListener('message', this.handleMessages)
    window.addEventListener('beforeunload', this.beforeUnload)

    try {
      const { clusterName, clusterUrl, error } = await this.startCluster()

      if (error) {
        reportError('There was an error', error)
        return
      }

      const { namespace, ajax: { Jupyter } } = this.props
      await Promise.all([
        this.localizeNotebook(clusterName),
        Jupyter.notebooks(namespace, clusterName).setCookie()
      ])

      const { workspace: { workspace: { bucketName } }, notebookName, ajax: { Buckets } } = this.props
      const { updated } = await Buckets.notebook(namespace, bucketName, notebookName.slice(0, -6)).getObject()
      const tenMinutesAgo = _.tap(d => d.setMinutes(d.getMinutes() - 10), new Date())
      const isRecent = new Date(updated) > tenMinutesAgo
      if (isRecent) {
        notify('warn', 'This notebook has been edited recently', {
          message: 'If you recently edited this notebook, disregard this message. If another user is editing this notebook, your changes may be lost.',
          timeout: 30000
        })
      }

      Nav.blockNav.set(() => new Promise(resolve => {
        if (this.isSaved.get()) {
          resolve()
        } else {
          this.saveNotebook()
          this.setState({ saving: true })
          this.isSaved.subscribe(resolve)
        }
      }))

      const { name: workspaceName, app } = this.props
      if (app === 'lab') {
        this.setState({ url: `${clusterUrl}/${app}/tree/${workspaceName}/${notebookName}` })
        notify('warn', 'Autosave occurs every 2 minutes', {
          message: 'Please remember to save your notebook by clicking the save icon before exiting the window. JupyterLab is new in Terra. We are working to improve its integration. ' +
            'Please contact us with any questions or feedback you may have.',
          timeout: 30000
        })
      } else this.setState({ url: `${clusterUrl}/notebooks/${workspaceName}/${notebookName}` })
    } catch (error) {
      reportError('Notebook cannot be launched', error)
    }
  }

  componentWillUnmount() {
    if (this.scheduledRefresh) {
      clearTimeout(this.scheduledRefresh)
    }

    window.removeEventListener('message', this.handleMessages)
    window.removeEventListener('beforeunload', this.beforeUnload)
    Nav.blockNav.reset()
  }

  componentDidUpdate(prevProps, prevState) {
    const oldClusters = prevProps.clusters
    const { clusters } = this.props
    const prevCluster = getCluster(oldClusters)
    const currCluster = getCluster(clusters)
    if (prevCluster && currCluster && prevCluster.id !== currCluster.id) {
      document.location.reload()
    }
  }

  async startCluster() {
    const { refreshClusters, workspace: { workspace: { namespace } }, ajax: { Jupyter } } = this.props
    await refreshClusters()
    const cluster = getCluster(this.props.clusters) // Note: reading up-to-date prop
    if (!cluster) {
      await Jupyter.cluster(namespace, Utils.generateClusterName()).create({
        machineConfig: Utils.normalizeMachineConfig({})
      })
    }

    while (true) {
      await refreshClusters()
      const cluster = getCluster(this.props.clusters) // Note: reading up-to-date prop
      const status = cluster && cluster.status

      if (status === 'Running') {
        return cluster
      } else if (status === 'Stopped') {
        const { googleProject, clusterName } = cluster
        await Jupyter.cluster(googleProject, clusterName).start()
        refreshClusters()
        await Utils.delay(10000)
      } else {
        await Utils.delay(3000)
      }
    }
  }

  async localizeNotebook(clusterName) {
    const { namespace, name: workspaceName, notebookName, workspace: { workspace: { bucketName } }, ajax: { Jupyter } } = this.props

    while (true) {
      try {
        await Promise.all([
          Jupyter.notebooks(namespace, clusterName).localize({
            [`~/${workspaceName}/.delocalize.json`]: `data:application/json,{"destination":"gs://${bucketName}/notebooks","pattern":""}`
          }),
          Jupyter.notebooks(namespace, clusterName).localize({
            [`~/${workspaceName}/${notebookName}`]: `gs://${bucketName}/notebooks/${notebookName}`
          })
        ])
        return
      } catch (error) {
        await reportError('Unable to copy notebook to cluster, was it renamed or deleted in the Workspace Bucket?', error)
      }
    }
  }

  render() {
    const { url, saving } = this.state
    const { namespace, clusters, name, app } = this.props

    if (url) {
      return h(Fragment, [
        iframe({
          src: url,
          style: { border: 'none', flex: 1 },
          ref: this.notebookFrame
        }),
        app === 'lab' && linkButton({
          style: { position: 'absolute', top: 1, right: 30 },
          onClick: () => Nav.goToPath('workspace-notebooks', { namespace, name })
        }, [icon('times-circle', { size: 25 })]),
        saving && spinnerOverlay
      ])
    }
    return h(loadingMessage, { clusters })
  }
}


export const addNavPaths = () => {
  Nav.defPath('workspace-notebook-launch', {
    path: '/workspaces/:namespace/:name/notebooks/launch/:notebookName/:app?',
    component: NotebookLauncher,
    title: ({ name, notebookName }) => `${name} - Notebooks - ${notebookName}`
  })
}
