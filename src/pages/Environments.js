import _ from 'lodash/fp'
import { Fragment, useState } from 'react'
import { div, h, h2, li, p, span, strong, ul } from 'react-hyperscript-helpers'
import { AutoSizer } from 'react-virtualized'
import { ButtonPrimary, Clickable, LabeledCheckbox, Link, spinnerOverlay } from 'src/components/common'
import FooterWrapper from 'src/components/FooterWrapper'
import { icon } from 'src/components/icons'
import Modal from 'src/components/Modal'
import { getToolFromRuntime, isPauseSupported, tools } from 'src/components/notebook-utils'
import PopupTrigger, { makeMenuIcon } from 'src/components/PopupTrigger'
import { SaveFilesHelp, SaveFilesHelpGalaxy } from 'src/components/runtime-common'
import { AppErrorModal, RuntimeErrorModal } from 'src/components/RuntimeManager'
import SupportRequest from 'src/components/SupportRequest'
import { SimpleFlexTable, Sortable } from 'src/components/table'
import TooltipTrigger from 'src/components/TooltipTrigger'
import TopBar from 'src/components/TopBar'
import { useWorkspaces } from 'src/components/workspace-utils'
import { Ajax } from 'src/libs/ajax'
import { getUser } from 'src/libs/auth'
import colors from 'src/libs/colors'
import { withErrorIgnoring, withErrorReporting, withErrorReportingInModal } from 'src/libs/error'
import Events from 'src/libs/events'
import * as Nav from 'src/libs/nav'
import { useCancellation, useGetter, useOnMount, usePollingEffect } from 'src/libs/react-utils'
import {
  defaultComputeZone, getAppCost, getComputeStatusForDisplay, getCurrentRuntime, getDiskAppType, getGalaxyComputeCost,
  getPersistentDiskCostMonthly, getRegionFromZone, getRuntimeCost,
  isApp, isComputePausable, isGcpContext, isResourceDeletable, mapToPdTypes, workspaceHasMultipleApps,
  workspaceHasMultipleDisks
} from 'src/libs/runtime-utils'
import { topBarHeight } from 'src/libs/style'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'


const DeleteRuntimeModal = ({ runtime: { cloudContext, googleProject, runtimeName, runtimeConfig: { persistentDiskId }, workspace }, onDismiss, onSuccess }) => {
  const [deleteDisk, setDeleteDisk] = useState(false)
  const [deleting, setDeleting] = useState()
  const deleteRuntime = _.flow(
    Utils.withBusyState(setDeleting),
    withErrorReporting('Error deleting cloud environment')
  )(async () => {
    isGcpContext(cloudContext) ?
      await Ajax().Runtimes.runtime(googleProject, runtimeName).delete(deleteDisk) :
      await Ajax().Runtimes.runtimeV2(workspace.workspace.workspaceId, runtimeName).delete(deleteDisk)
    onSuccess()
  })
  return h(Modal, {
    title: 'Delete cloud environment?',
    onDismiss,
    okButton: deleteRuntime
  }, [
    div({ style: { lineHeight: 1.5 } }, [
      persistentDiskId ?
        h(LabeledCheckbox, { checked: deleteDisk, onChange: setDeleteDisk }, [
          span({ style: { fontWeight: 600 } }, [' Also delete the persistent disk and all files on it'])
        ]) :
        p([
          'Deleting this cloud environment will also ', span({ style: { fontWeight: 600 } }, ['delete any files on the associated hard disk.'])
        ]),
      h(SaveFilesHelp),
      p([
        'Deleting your cloud environment will stop all running notebooks and associated costs. You can recreate your cloud environment later, ',
        'which will take several minutes.'
      ])
    ]),
    deleting && spinnerOverlay
  ])
}

const DeleteDiskModal = ({ disk: { googleProject, name }, isGalaxyDisk, onDismiss, onSuccess }) => {
  const [busy, setBusy] = useState(false)
  const deleteDisk = _.flow(
    Utils.withBusyState(setBusy),
    withErrorReporting('Error deleting persistent disk')
  )(async () => {
    await Ajax().Disks.disk(googleProject, name).delete()
    onSuccess()
  })
  return h(Modal, {
    title: 'Delete persistent disk?',
    onDismiss,
    okButton: deleteDisk
  }, [
    p([
      'Deleting the persistent disk will ', span({ style: { fontWeight: 600 } }, ['delete all files on it.'])
    ]),
    isGalaxyDisk && h(SaveFilesHelp, [false]),
    busy && spinnerOverlay
  ])
}

const DeleteAppModal = ({ app: { googleProject, appName, diskName, appType }, onDismiss, onSuccess }) => {
  const [deleteDisk, setDeleteDisk] = useState(false)
  const [deleting, setDeleting] = useState()
  const deleteApp = _.flow(
    Utils.withBusyState(setDeleting),
    withErrorReporting('Error deleting cloud environment')
  )(async () => {
    await Ajax().Apps.app(googleProject, appName).delete(deleteDisk)
    onSuccess()
  })
  return h(Modal, {
    title: 'Delete cloud environment?',
    onDismiss,
    okButton: deleteApp
  }, [
    div({ style: { lineHeight: 1.5 } }, [
      diskName ?
        h(LabeledCheckbox, { checked: deleteDisk, onChange: setDeleteDisk }, [
          span({ style: { fontWeight: 600 } }, [' Also delete the persistent disk and all files on it'])
        ]) :
        p([
          'Deleting this cloud environment will also ', span({ style: { fontWeight: 600 } }, ['delete any files on the associated hard disk.'])
        ]),
      appType === tools.Galaxy.appType && h(SaveFilesHelpGalaxy)
    ]),
    deleting && spinnerOverlay
  ])
}

const MigratePersistentDisksBanner = ({ count }) => {
  const deadline = new Date('01 January 2023 00:00 UTC')
  return count > 0 && div({
    style: {
      position: 'absolute', top: topBarHeight, left: '50%', transform: 'translate(-50%, -50%)',
      backgroundColor: colors.warning(0.15),
      border: '2px solid', borderRadius: '12px', borderColor: colors.warning(),
      zIndex: 9999
    }
  }, [
    div({ style: { display: 'flex', alignItems: 'center', margin: '0.75rem 1.5rem 0.75rem 1.5rem' } }, [
      icon('warning-standard', { size: 32, style: { color: colors.warning(), marginRight: '0.25rem' } }),
      div([
        strong([`You have ${Math.floor((deadline - Date.now()) / 86400000)} days to migrate ${count} shared persistent ${count > 1 ? 'disks' : 'disk'}. `]),
        `Un-migrated disks will be DELETED after ${Utils.makeCompleteDate(deadline)}.`
      ])
    ])
  ])
}

const MigratePersistentDiskCell = ({ disk, setMigrateDisk }) => div({
  style: {
    display: 'flex', flex: 1, flexDirection: 'column',
    height: '100%', margin: '-1rem', padding: '0.5rem 0 0 1rem',
    backgroundColor: colors.danger(0.15), color: colors.danger()
  }
}, [
  div({ style: { display: 'flex', alignItems: 'center' } }, [
    'Offline',
    h(TooltipTrigger, {
      content: `This disk is shared between workspaces, which is no longer supported. Click "migrate" to make copies for relevant workspaces.`
    }, [icon('warning-standard', { style: { marginLeft: '0.25rem', color: colors.danger() } })])
  ]),
  h(Link, { onClick: () => setMigrateDisk(disk), style: { wordBreak: 'break-word' } },
    ['Migrate']
  )
])

const MigratePersistentDiskModal = ({ disk, workspaces, onSuccess, onDismiss, contactSupport, deleteDiskId }) => {
  const [migrating, setMigrating] = useState()
  const [isSelected, setIsSelected] = useState({ })
  const [deleteDisk, setDeleteDisk] = useState(false)

  const migrateDisk = _.flow(
    withErrorReportingInModal('Error migrating persistent disk.', onDismiss),
    Utils.withBusyState(setMigrating)
  )(() => { throw Error('Not implemented.'); onSuccess() })

  const WorkspaceSelection = ({ accessLevel, public: isPublic, workspace: { authorizationDomain, name, workspaceId } }) => {
    const authDomains = _.map('membersGroupName', authorizationDomain)?.join(", ")
    return div({ style: { display: 'flex', flexDirection: 'row', alignItems: 'center', margin: '0.5rem' } }, [
      h(LabeledCheckbox, {
          style: { marginRight: '0.25rem' },
          disabled: !(Utils.canWrite(accessLevel) || isPublic),
          checked: isSelected[workspaceId],
          onChange: selected => setIsSelected(previousState => _.set(workspaceId, selected, previousState))
        }, [div({ style: { width: '100%', ...Style.noWrapEllipsis } }, [name]), Utils.cond(
          [authorizationDomain.length === 1, () => ` (Authorization Domain: ${authDomains})`],
          [authorizationDomain.length > 1, () => ` (Authorization Domains: ${authDomains})`]
        )]
      )
    ])
  }

  const DeleteDiskSelection = ({ text }) => div({
    style: {
      display: 'flex', flexDirection: 'row', alignItems: 'center',
      margin: '0.5rem'
    }
  }, [
    h(LabeledCheckbox, {
      style: { display: 'flex' },
      checked: deleteDisk,
      onChange: setDeleteDisk
    }, [text])
  ])

  const costPerCopy = getPersistentDiskCostMonthly(disk, getRegionFromZone(disk.zone))
  const numberOfCopies = _.flow(_.values, _.filter(_.identity), _.size)(isSelected)

  return h(Modal, {
    title: `Migrate ${disk.name}`,
    okButton: deleteDisk || workspaces.length === 0 ?
      h(ButtonPrimary, { disabled: !deleteDisk, onClick: () => { onDismiss(); deleteDiskId(disk.id); } }, 'Delete') :
      h(ButtonPrimary, { onClick: migrateDisk }, 'Migrate'),
    onDismiss
  }, [
    'Due to data security policies, persistent disks can no longer be shared between workspaces.',
    workspaces.length > 0 ?
      div({ style: { display: 'flex', flexDirection: 'column' } }, [
        strong(['Select workspaces where you what to use a copy of this disk.']),
        div({ style: { width: '100%', padding: '0', overflowX: 'hidden', overflowY: 'scroll' } },
          _.map(workspace => h(WorkspaceSelection, workspace, []), workspaces)
        ),
        'OR',
        h(DeleteDiskSelection, { text: 'Do not copy. Delete this disk for all users.' }, []),
        div({ style: { display: 'flex', flexDirection: 'column' } }, [
          strong(['Cost']),
          `${Utils.formatUSD(costPerCopy)}/month per copy. (${Utils.formatUSD(costPerCopy * numberOfCopies)}/month total after migration)`
        ])
      ]) :
      div({ style: { display: 'flex', flexDirection: 'column' } }, [
        strong(['You own this disk but do not have access to any workspaces where it can be shared.']),
        h(DeleteDiskSelection, { text: 'Delete this disk for all users.' }, []),
        'OR',
        div([h(Link, { onClick: () => { onDismiss(); contactSupport() } }, ['Contact Terra Support']),
          ' to have it transferred to another user'
        ])
      ]),
    migrating && spinnerOverlay
  ])
}

const Environments = () => {
  const signal = useCancellation()
  const { workspaces, refresh: refreshWorkspaces, loading: loadingWorkspaces } = _.flow(
    useWorkspaces,
    _.update('workspaces',
      _.flow(
        _.groupBy('workspace.namespace'),
        _.mapValues(_.keyBy('workspace.name'))
      )
    )
  )()

  const getWorkspaces = useGetter(workspaces)
  const [runtimes, setRuntimes] = useState()
  const [apps, setApps] = useState()
  const [disks, setDisks] = useState()
  const [loading, setLoading] = useState(false)
  const [errorRuntimeId, setErrorRuntimeId] = useState()
  const getErrorRuntimeId = useGetter(errorRuntimeId)
  const [deleteRuntimeId, setDeleteRuntimeId] = useState()
  const getDeleteRuntimeId = useGetter(deleteRuntimeId)
  const [deleteDiskId, setDeleteDiskId] = useState()
  const getDeleteDiskId = useGetter(deleteDiskId)
  const [errorAppId, setErrorAppId] = useState()
  const [deleteAppId, setDeleteAppId] = useState()
  const [sort, setSort] = useState({ field: 'project', direction: 'asc' })
  const [diskSort, setDiskSort] = useState({ field: 'project', direction: 'asc' })
  const [shouldFilterRuntimesByCreator, setShouldFilterRuntimesByCreator] = useState(true)
  const [migrateDisk, setMigrateDisk] = useState()
  const [contactSupport, setContactSupport] = useState()

  const refreshData = Utils.withBusyState(setLoading, async () => {
    const creator = getUser().email

    const getWorkspace = (ws => (namespace, name) => _.get(`${namespace}.${name}`, ws))(
      getWorkspaces()
    )

    const startTimeForLeoCallsEpochMs = Date.now()
    const [newRuntimes, newDisks, newApps] = await Promise.all([
      Ajax(signal).Runtimes.listV2(shouldFilterRuntimesByCreator ? { creator, includeLabels: 'saturnWorkspaceNamespace,saturnWorkspaceName' } : { includeLabels: 'saturnWorkspaceNamespace,saturnWorkspaceName' }),
      Ajax(signal).Disks.list({ creator, includeLabels: 'saturnApplication,saturnWorkspaceNamespace,saturnWorkspaceName' }),
      Ajax(signal).Apps.listWithoutProject({ creator, includeLabels: 'saturnWorkspaceNamespace,saturnWorkspaceName' })
    ])
    const endTimeForLeoCallsEpochMs = Date.now()

    const leoCallTimeTotalMs = endTimeForLeoCallsEpochMs - startTimeForLeoCallsEpochMs
    Ajax().Metrics.captureEvent(Events.cloudEnvironmentDetailsLoad, { leoCallTimeMs: leoCallTimeTotalMs, totalCallTimeMs: leoCallTimeTotalMs })

    const cloudObjectNeedsMigration = (cloudContext, status, workspace) => //status === 'Ready' &&
      isGcpContext(cloudContext) && cloudContext.cloudResource !== workspace?.workspace.googleProject

    const decorateLabeledCloudObjWithWorkspace = cloudObject => {
      const { labels: { saturnWorkspaceNamespace, saturnWorkspaceName } } = cloudObject
      const workspace = getWorkspace(saturnWorkspaceNamespace, saturnWorkspaceName)
      const requiresMigration = cloudObjectNeedsMigration(cloudObject.cloudContext, cloudObject.status, workspace)
      return { ...cloudObject, workspace, requiresMigration }
    }

    const [decoratedRuntimes, decoratedDisks, decoratedApps] =
      _.map(_.map(decorateLabeledCloudObjWithWorkspace), [newRuntimes, newDisks, newApps])

    setRuntimes(decoratedRuntimes)
    setDisks(decoratedDisks)
    setApps(decoratedApps)

    if (!_.some({ id: getErrorRuntimeId() }, newRuntimes)) {
      setErrorRuntimeId(undefined)
    }
    if (!_.some({ id: getDeleteRuntimeId() }, newRuntimes)) {
      setDeleteRuntimeId(undefined)
    }
    if (!_.some({ id: getDeleteDiskId() }, newDisks)) {
      setDeleteDiskId(undefined)
    }
    if (!_.some({ appName: errorAppId }, newApps)) {
      setErrorAppId(undefined)
    }
    if (!_.some({ appName: deleteAppId }, newApps)) {
      setDeleteAppId(undefined)
    }
  })

  const loadData = withErrorReporting('Error loading cloud environments', refreshData)

  const pauseComputeAndRefresh = Utils.withBusyState(setLoading, async (computeType, compute) => {
    const wrappedPauseCompute = withErrorReporting('Error pausing compute', () => computeType === 'runtime' ?
      Ajax().Runtimes.runtime(compute.googleProject, compute.runtimeName).stop() :
      Ajax().Apps.app(compute.googleProject, compute.appName).pause())
    await wrappedPauseCompute()
    await loadData()
  })

  useOnMount(async () => { await refreshWorkspaces(); await loadData() })
  usePollingEffect(withErrorIgnoring(refreshData), { ms: 30000 })

  const getCloudProvider = cloudEnvironment => Utils.cond(
    [isApp(cloudEnvironment), () => 'Kubernetes'],
    [cloudEnvironment?.runtimeConfig?.cloudService === 'DATAPROC', () => 'Dataproc'],
    [Utils.DEFAULT, () => cloudEnvironment?.runtimeConfig?.cloudService])

  const getCloudEnvTool = cloudEnvironment => isApp(cloudEnvironment) ?
    _.capitalize(cloudEnvironment.appType) :
    _.capitalize(cloudEnvironment.labels.tool)

  const filteredRuntimes = _.orderBy([{
    project: 'labels.saturnWorkspaceNamespace',
    workspace: 'labels.saturnWorkspaceName',
    type: getCloudProvider,
    tool: getCloudEnvTool,
    status: 'status',
    created: 'auditInfo.createdDate',
    accessed: 'auditInfo.dateAccessed',
    cost: getRuntimeCost
  }[sort.field]], [sort.direction], runtimes)

  const filteredDisks = mapToPdTypes(_.orderBy([{
    project: 'googleProject',
    workspace: 'labels.saturnWorkspaceName',
    status: 'status',
    created: 'auditInfo.createdDate',
    accessed: 'auditInfo.dateAccessed',
    cost: getPersistentDiskCostMonthly,
    size: 'size'
  }[diskSort.field]], [diskSort.direction], disks))

  const filteredApps = _.orderBy([{
    project: 'googleProject',
    workspace: 'labels.saturnWorkspaceName',
    status: 'status',
    created: 'auditInfo.createdDate',
    accessed: 'auditInfo.dateAccessed',
    cost: getAppCost
  }[sort.field]], [sort.direction], apps)

  const filteredCloudEnvironments = _.concat(filteredRuntimes, filteredApps)

  const totalRuntimeCost = _.sum(_.map(getRuntimeCost, runtimes))
  const totalAppCost = _.sum(_.map(getGalaxyComputeCost, apps))
  const totalCost = totalRuntimeCost + totalAppCost
  const totalDiskCost = _.sum(_.map(disk => getPersistentDiskCostMonthly(disk, getRegionFromZone(disk.zone)), mapToPdTypes(disks)))

  const runtimesByProject = _.groupBy('googleProject', runtimes)
  const disksByProject = _.groupBy('googleProject', disks)
  const appsByProject = _.groupBy('googleProject', apps)

  // We start the first output string with an empty space because empty space would
  // not apply to the case where appType is not defined (e.g. Jupyter, RStudio).
  const forAppText = appType => !!appType ? ` for ${_.capitalize(appType)}` : ''

  const getWorkspaceCell = (namespace, name, appType, shouldWarn) => {
    return !!name ?
      h(Fragment, [
        h(Link, { href: Nav.getLink('workspace-dashboard', { namespace, name }), style: { wordBreak: 'break-word' } }, [name]),
        shouldWarn && h(TooltipTrigger, {
          content: `This workspace has multiple active cloud environments${forAppText(appType)}. Only the latest one will be used.`
        }, [icon('warning-standard', { style: { marginLeft: '0.25rem', color: colors.warning() } })])
      ]) :
      'information unavailable'
  }

  // Old apps, runtimes and disks may not have 'saturnWorkspaceNamespace' label defined. When they were
  // created, workspace namespace (a.k.a billing project) value used to equal the google project.
  // Therefore we use google project if the namespace label is not defined.
  const renderWorkspaceForApps = app => {
    const { appType, googleProject, labels: { saturnWorkspaceNamespace = googleProject, saturnWorkspaceName } } = app
    const multipleApps = workspaceHasMultipleApps(appsByProject[googleProject], appType)
    return getWorkspaceCell(saturnWorkspaceNamespace, saturnWorkspaceName, appType, multipleApps)
  }

  const renderWorkspaceForRuntimes = runtime => {
    const { status, googleProject, labels: { saturnWorkspaceNamespace = googleProject, saturnWorkspaceName } } = runtime
    const shouldWarn = !_.includes(status, ['Deleting', 'Error']) &&
      getCurrentRuntime(runtimesByProject[googleProject]) !== runtime
    return getWorkspaceCell(saturnWorkspaceNamespace, saturnWorkspaceName, null, shouldWarn)
  }

  const getDetailsPopup = (cloudEnvName, billingId, disk, creator, workspace) => {
    return h(PopupTrigger, {
      content: div({ style: { padding: '0.5rem' } }, [
        div([strong(['Name: ']), cloudEnvName]),
        div([strong(['Billing ID: ']), billingId]),
        workspace && div([strong(['Workspace ID: ']), workspace.workspace.workspaceId]),
        !shouldFilterRuntimesByCreator && div([strong(['Creator: ']), creator]),
        !!disk && div([strong(['Persistent Disk: ']), disk.name])
      ])
    }, [h(Link, ['view'])])
  }

  const renderDetailsApp = (app, disks) => {
    const { appName, diskName, googleProject, auditInfo: { creator }, workspace } = app
    const disk = _.find({ name: diskName }, disks)
    return getDetailsPopup(appName, googleProject, disk, creator, workspace?.workspaceId)
  }

  const renderDetailsRuntime = (runtime, disks) => {
    const { runtimeName, cloudContext, runtimeConfig: { persistentDiskId }, auditInfo: { creator }, workspace } = runtime
    const disk = _.find({ id: persistentDiskId }, disks)
    return getDetailsPopup(runtimeName, cloudContext?.cloudResource, disk, creator, workspace?.workspaceId)
  }

  const renderDeleteButton = (resourceType, resource) => {
    const isDeletable = isResourceDeletable(resourceType, resource)
    const resourceId = resourceType === 'app' ? resource.appName : resource.id
    const action = Utils.switchCase(resourceType,
      ['runtime', () => setDeleteRuntimeId],
      ['app', () => setDeleteAppId],
      ['disk', () => setDeleteDiskId]
    )

    return h(Link, {
      disabled: !isDeletable,
      tooltip: isDeletable ?
        'Delete cloud environment' :
        `Cannot delete a cloud environment while in status ${_.upperCase(getComputeStatusForDisplay(resource.status))}.`,
      onClick: () => action(resourceId)
    }, [makeMenuIcon('trash'), 'Delete'])
  }

  const renderPauseButton = (computeType, compute) => {
    const { status } = compute

    const shouldShowPauseButton = isApp(compute) ?
      !_.find(tool => tool.appType && tool.appType === compute.appType)(tools)?.isPauseUnsupported :
      isPauseSupported(getToolFromRuntime(compute))

    return shouldShowPauseButton && h(Link, {
      style: { marginRight: '1rem' },
      disabled: !isComputePausable(computeType, compute),
      tooltip: isComputePausable(computeType, compute) ?
        'Pause cloud environment' :
        `Cannot pause a cloud environment while in status ${_.upperCase(getComputeStatusForDisplay(status))}.`,
      onClick: () => pauseComputeAndRefresh(computeType, compute)
    }, [makeMenuIcon('pause'), 'Pause'])
  }

  const renderErrorApps = app => {
    const convertedAppStatus = getComputeStatusForDisplay(app.status)
    return h(Fragment, [
      convertedAppStatus,
      convertedAppStatus === 'Error' && h(Clickable, {
        tooltip: 'View error',
        onClick: () => setErrorAppId(app.appName)
      }, [icon('warning-standard', { style: { marginLeft: '0.25rem', color: colors.danger() } })])
    ])
  }

  const renderErrorRuntimes = runtime => {
    const convertedRuntimeStatus = getComputeStatusForDisplay(runtime.status)
    return h(Fragment, [
      convertedRuntimeStatus,
      convertedRuntimeStatus === 'Error' && h(Clickable, {
        tooltip: 'View error',
        onClick: () => setErrorRuntimeId(runtime.id)
      }, [icon('warning-standard', { style: { marginLeft: '0.25rem', color: colors.danger() } })])
    ])
  }

  const renderDeleteDiskModal = disk => {
    return h(DeleteDiskModal, {
      disk,
      isGalaxyDisk: getDiskAppType(disk) === tools.Galaxy.appType,
      onDismiss: () => setDeleteDiskId(undefined),
      onSuccess: () => {
        setDeleteDiskId(undefined)
        loadData()
      }
    })
  }

  const multipleDisksError = (disks, appType) => {
    // appType is undefined for runtimes (ie Jupyter, RStudio) so the first part of the ternary is for processing app
    // disks. the second part is for processing runtime disks so it filters out app disks
    return !!appType ? workspaceHasMultipleDisks(disks, appType) : _.remove(disk => getDiskAppType(disk) !== appType || disk.status === 'Deleting',
      disks).length > 1
  }

  return h(FooterWrapper, [
    h(TopBar, { title: 'Cloud Environments' }),
    div({ role: 'main', style: { padding: '1rem', flexGrow: 1 } }, [
      h2({ style: { ...Style.elements.sectionHeader, textTransform: 'uppercase', margin: '0 0 1rem 0', padding: 0 } }, ['Your cloud environments']),
      div({ style: { marginBottom: '.5rem' } }, [
        h(LabeledCheckbox, { checked: shouldFilterRuntimesByCreator, onChange: setShouldFilterRuntimesByCreator }, [
          span({ style: { fontWeight: 600 } }, [' Hide cloud environments you have access to but didn\'t create'])
        ])
      ]),
      runtimes && h(SimpleFlexTable, {
        'aria-label': 'cloud environments',
        sort,
        rowCount: filteredCloudEnvironments.length,
        columns: [
          {
            size: { basis: 250 },
            field: 'project',
            headerRenderer: () => h(Sortable, { sort, field: 'project', onSort: setSort }, ['Billing project']),
            cellRenderer: ({ rowIndex }) => {
              const { googleProject, labels: { saturnWorkspaceNamespace = googleProject } } = filteredCloudEnvironments[rowIndex]
              return saturnWorkspaceNamespace
            }
          },
          {
            size: { basis: 250 },
            field: 'workspace',
            headerRenderer: () => h(Sortable, { sort, field: 'workspace', onSort: setSort }, ['Workspace']),
            cellRenderer: ({ rowIndex }) => {
              const cloudEnvironment = filteredCloudEnvironments[rowIndex]
              return !!cloudEnvironment.appName ? renderWorkspaceForApps(cloudEnvironment) : renderWorkspaceForRuntimes(cloudEnvironment)
            }
          },
          {
            size: { basis: 125, grow: 0 },
            headerRenderer: () => h(Sortable, { sort, field: 'type', onSort: setSort }, ['Type']),
            cellRenderer: ({ rowIndex }) => getCloudProvider(filteredCloudEnvironments[rowIndex])
          },
          {
            size: { basis: 125, grow: 0 },
            headerRenderer: () => h(Sortable, { sort, field: 'tool', onSort: setSort }, ['Tool']),
            cellRenderer: ({ rowIndex }) => getCloudEnvTool(filteredCloudEnvironments[rowIndex])
          },
          {
            size: { basis: 90, grow: 0 },
            headerRenderer: () => 'Details',
            cellRenderer: ({ rowIndex }) => {
              const cloudEnvironment = filteredCloudEnvironments[rowIndex]
              return cloudEnvironment.appName ? renderDetailsApp(cloudEnvironment, disks) : renderDetailsRuntime(cloudEnvironment, disks)
            }
          },
          {
            size: { basis: 150, grow: 0 },
            field: 'status',
            headerRenderer: () => h(Sortable, { sort, field: 'status', onSort: setSort }, ['Status']),
            cellRenderer: ({ rowIndex }) => {
              const cloudEnvironment = filteredCloudEnvironments[rowIndex]
              return cloudEnvironment.appName ? renderErrorApps(cloudEnvironment) : renderErrorRuntimes(cloudEnvironment)
            }
          },
          {
            size: { basis: 120, grow: 0.2 },
            headerRenderer: () => 'Location',
            cellRenderer: ({ rowIndex }) => {
              const cloudEnvironment = filteredCloudEnvironments[rowIndex]
              const zone = cloudEnvironment?.runtimeConfig?.zone
              const region = cloudEnvironment?.runtimeConfig?.region
              // We assume that all apps get created in zone 'us-central1-a'.
              // If zone or region is not present then cloudEnvironment is an app so we return 'us-central1-a'.
              return zone || region || defaultComputeZone.toLowerCase()
            }
          },
          {
            size: { basis: 220, grow: 0 },
            field: 'created',
            headerRenderer: () => h(Sortable, { sort, field: 'created', onSort: setSort }, ['Created']),
            cellRenderer: ({ rowIndex }) => {
              return Utils.makeCompleteDate(filteredCloudEnvironments[rowIndex].auditInfo.createdDate)
            }
          },
          {
            size: { basis: 220, grow: 0 },
            field: 'accessed',
            headerRenderer: () => h(Sortable, { sort, field: 'accessed', onSort: setSort }, ['Last accessed']),
            cellRenderer: ({ rowIndex }) => {
              return Utils.makeCompleteDate(filteredCloudEnvironments[rowIndex].auditInfo.dateAccessed)
            }
          },
          {
            size: { basis: 240, grow: 0 },
            field: 'cost',
            headerRenderer: () => h(Sortable, { sort, field: 'cost', onSort: setSort }, [`Cost / hr (${Utils.formatUSD(totalCost)} total)`]),
            cellRenderer: ({ rowIndex }) => {
              const cloudEnvironment = filteredCloudEnvironments[rowIndex]
              return cloudEnvironment.appName ?
                Utils.formatUSD(getGalaxyComputeCost(cloudEnvironment)) :
                Utils.formatUSD(getRuntimeCost(cloudEnvironment))
            }
          },
          {
            size: { basis: 200, grow: 0 },
            headerRenderer: () => 'Actions',
            cellRenderer: ({ rowIndex }) => {
              const cloudEnvironment = filteredCloudEnvironments[rowIndex]
              const computeType = isApp(cloudEnvironment) ? 'app' : 'runtime'
              return h(Fragment, [
                renderPauseButton(computeType, cloudEnvironment),
                renderDeleteButton(computeType, cloudEnvironment)
              ])
            }
          }
        ]
      }),
      h2({ style: { ...Style.elements.sectionHeader, textTransform: 'uppercase', margin: '1rem 0', padding: 0 } }, ['Your persistent disks']),
      disks && h(SimpleFlexTable, {
        'aria-label': 'persistent disks',
        sort: diskSort,
        rowCount: filteredDisks.length,
        columns: [
          {
            size: { basis: 250 },
            field: 'project',
            headerRenderer: () => h(Sortable, { sort: diskSort, field: 'project', onSort: setDiskSort }, ['Billing project']),
            cellRenderer: ({ rowIndex }) => {
              const { googleProject, labels: { saturnWorkspaceNamespace = googleProject } } = filteredDisks[rowIndex]
              return saturnWorkspaceNamespace
            }
          },
          {
            size: { basis: 250 },
            field: 'workspace',
            headerRenderer: () => h(Sortable, { sort: diskSort, field: 'workspace', onSort: setDiskSort }, ['Workspace']),
            cellRenderer: ({ rowIndex }) => {
              const { status: diskStatus, googleProject, workspace } = filteredDisks[rowIndex]
              const appType = getDiskAppType(filteredDisks[rowIndex])
              const multipleDisks = multipleDisksError(disksByProject[googleProject], appType)
              return !!workspace ?
                h(Fragment, [
                  h(Link, { href: Nav.getLink('workspace-dashboard', workspace.workspace), style: { wordBreak: 'break-word' } },
                    [workspace.workspace.name]),
                  diskStatus !== 'Deleting' && multipleDisks &&
                  h(TooltipTrigger, {
                    content: `This workspace has multiple active persistent disks${forAppText(appType)}. Only the latest one will be used.`
                  }, [icon('warning-standard', { style: { marginLeft: '0.25rem', color: colors.warning() } })])
                ]) :
                'information unavailable'
            }
          },
          {
            size: { basis: 90, grow: 0 },
            headerRenderer: () => 'Details',
            cellRenderer: ({ rowIndex }) => {
              const { name, id, cloudContext, workspace } = filteredDisks[rowIndex]
              const runtime = _.find({ runtimeConfig: { persistentDiskId: id } }, runtimes)
              const app = _.find({ diskName: name }, apps)
              return h(PopupTrigger, {
                content: div({ style: { padding: '0.5rem' } }, [
                  div([strong(['Name: ']), name]),
                  div([strong(['Billing ID: ']), cloudContext.cloudResource]),
                  workspace && div([strong(['Workspace ID: ']), workspace.workspace.workspaceId]),
                  runtime && div([strong(['Runtime: ']), runtime.runtimeName]),
                  app && div([strong([`${_.capitalize(app.appType)}: `]), app.appName])
                ])
              }, [h(Link, ['view'])])
            }
          },
          {
            size: { basis: 120, grow: 0 },
            field: 'size',
            headerRenderer: () => h(Sortable, { sort: diskSort, field: 'size', onSort: setDiskSort }, ['Size (GB)']),
            cellRenderer: ({ rowIndex }) => {
              const disk = filteredDisks[rowIndex]
              return disk.size
            }
          },
          {
            size: { basis: 130, grow: 0 },
            field: 'status',
            headerRenderer: () => h(Sortable, { sort: diskSort, field: 'status', onSort: setDiskSort }, ['Status']),
            cellRenderer: ({ rowIndex }) => {
              const disk = filteredDisks[rowIndex]
              return disk.requiresMigration ? h(MigratePersistentDiskCell, { disk, setMigrateDisk }, []) : disk.status
            }
          },
          {
            size: { basis: 120, grow: 0.2 },
            headerRenderer: () => 'Location',
            cellRenderer: ({ rowIndex }) => {
              const disk = filteredDisks[rowIndex]
              return disk.zone
            }
          },
          {
            size: { basis: 220, grow: 0 },
            field: 'created',
            headerRenderer: () => h(Sortable, { sort: diskSort, field: 'created', onSort: setDiskSort }, ['Created']),
            cellRenderer: ({ rowIndex }) => {
              return Utils.makeCompleteDate(filteredDisks[rowIndex].auditInfo.createdDate)
            }
          },
          {
            size: { basis: 220, grow: 0 },
            field: 'accessed',
            headerRenderer: () => h(Sortable, { sort: diskSort, field: 'accessed', onSort: setDiskSort }, ['Last accessed']),
            cellRenderer: ({ rowIndex }) => {
              return Utils.makeCompleteDate(filteredDisks[rowIndex].auditInfo.dateAccessed)
            }
          },
          {
            size: { basis: 250, grow: 0 },
            field: 'cost',
            headerRenderer: () => {
              return h(Sortable, { sort: diskSort, field: 'cost', onSort: setDiskSort }, [`Cost / month (${Utils.formatUSD(totalDiskCost)} total)`])
            },
            cellRenderer: ({ rowIndex }) => {
              const disk = filteredDisks[rowIndex]
              const diskRegion = getRegionFromZone(disk.zone)
              return Utils.formatUSD(getPersistentDiskCostMonthly(disk, diskRegion))
            }
          },
          {
            size: { basis: 200, grow: 0 },
            headerRenderer: () => 'Action',
            cellRenderer: ({ rowIndex }) => {
              const { id, status, name } = filteredDisks[rowIndex]
              const error = Utils.cond(
                [status === 'Creating', () => 'Cannot delete this disk because it is still being created.'],
                [status === 'Deleting', () => 'The disk is being deleted.'],
                [_.some({ runtimeConfig: { persistentDiskId: id } }, runtimes) || _.some({ diskName: name }, apps),
                  () => 'Cannot delete this disk because it is attached. You must delete the cloud environment first.']
              )
              return h(Link, {
                disabled: !!error,
                tooltip: error || 'Delete persistent disk',
                onClick: () => setDeleteDiskId(id)
              }, [makeMenuIcon('trash'), 'Delete'])
            }
          }
        ]
      }),
      errorRuntimeId && h(RuntimeErrorModal, {
        runtime: _.find({ id: errorRuntimeId }, runtimes),
        onDismiss: () => setErrorRuntimeId(undefined)
      }),
      deleteRuntimeId && h(DeleteRuntimeModal, {
        runtime: _.find({ id: deleteRuntimeId }, runtimes),
        onDismiss: () => setDeleteRuntimeId(undefined),
        onSuccess: () => {
          setDeleteRuntimeId(undefined)
          loadData()
        }
      }),
      deleteDiskId && renderDeleteDiskModal(_.find({ id: deleteDiskId }, disks)),
      deleteAppId && h(DeleteAppModal, {
        app: _.find({ appName: deleteAppId }, apps),
        onDismiss: () => setDeleteAppId(undefined),
        onSuccess: () => {
          setDeleteAppId(undefined)
          loadData()
        }
      }),
      errorAppId && h(AppErrorModal, {
        app: _.find({ appName: errorAppId }, apps),
        onDismiss: () => setErrorAppId(undefined),
        onSuccess: () => {
          setErrorAppId(undefined)
          loadData()
        }
      }),
      migrateDisk && h(MigratePersistentDiskModal, {
        disk: migrateDisk,
        workspaces: _.flow(_.get(migrateDisk.googleProject), _.values)(workspaces),
        onDismiss: () => setMigrateDisk(undefined),
        onSuccess: () => { setMigrateDisk(undefined); loadData() },
        contactSupport: () => setContactSupport(true),
        deleteDiskId: setDeleteDiskId
      })
    ]),
    h(MigratePersistentDisksBanner, { count: _.countBy('requiresMigration', disks).true }, []),
    contactSupport && h(SupportRequest),
    (loadingWorkspaces || loading) && spinnerOverlay
  ])
}

export const navPaths = [
  {
    name: 'environments',
    path: '/clusters', // NB: This path name is a holdover from a previous naming scheme
    component: Environments,
    title: 'Cloud environments'
  }
]
