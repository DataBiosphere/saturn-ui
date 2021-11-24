import _ from 'lodash/fp'
import { Fragment, useState } from 'react'
import { div, h, h2, p, span } from 'react-hyperscript-helpers'
import { Clickable, LabeledCheckbox, Link, spinnerOverlay } from 'src/components/common'
import FooterWrapper from 'src/components/FooterWrapper'
import { icon } from 'src/components/icons'
import Modal from 'src/components/Modal'
import { tools } from 'src/components/notebook-utils'
import PopupTrigger, { makeMenuIcon } from 'src/components/PopupTrigger'
import { SaveFilesHelp, SaveFilesHelpGalaxy } from 'src/components/runtime-common'
import { AppErrorModal, RuntimeErrorModal } from 'src/components/RuntimeManager'
import { SimpleFlexTable, Sortable } from 'src/components/table'
import TooltipTrigger from 'src/components/TooltipTrigger'
import TopBar from 'src/components/TopBar'
import { Ajax } from 'src/libs/ajax'
import { getUser } from 'src/libs/auth'
import colors from 'src/libs/colors'
import { withErrorIgnoring, withErrorReporting } from 'src/libs/error'
import {
  defaultComputeRegion,
  defaultComputeZone, getComputeStatusForDisplay, getCurrentAppForType, getCurrentRuntime, getGalaxyComputeCost, getGalaxyCost, getPersistentDiskCostMonthly,
  isApp, isComputePausable, isResourceDeletable, runtimeCost
} from 'src/libs/runtime-utils'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'


const DeleteRuntimeModal = ({ runtime: { googleProject, runtimeName, runtimeConfig: { persistentDiskId } }, onDismiss, onSuccess }) => {
  const [deleteDisk, setDeleteDisk] = useState(false)
  const [deleting, setDeleting] = useState()
  const deleteRuntime = _.flow(
    Utils.withBusyState(setDeleting),
    withErrorReporting('Error deleting cloud environment')
  )(async () => {
    await Ajax().Runtimes.runtime(googleProject, runtimeName).delete(deleteDisk)
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
      appType === tools.galaxy.appType && h(SaveFilesHelpGalaxy)
    ]),
    deleting && spinnerOverlay
  ])
}

const Environments = () => {
  const signal = Utils.useCancellation()
  const [runtimes, setRuntimes] = useState()
  const [apps, setApps] = useState()
  const [disks, setDisks] = useState()
  const [appDisks, setAppDisks] = useState()
  const [loading, setLoading] = useState(false)
  const [errorRuntimeId, setErrorRuntimeId] = useState()
  const getErrorRuntimeId = Utils.useGetter(errorRuntimeId)
  const [deleteRuntimeId, setDeleteRuntimeId] = useState()
  const getDeleteRuntimeId = Utils.useGetter(deleteRuntimeId)
  const [deleteDiskId, setDeleteDiskId] = useState()
  const getDeleteDiskId = Utils.useGetter(deleteDiskId)
  const [errorAppId, setErrorAppId] = useState()
  const [deleteAppId, setDeleteAppId] = useState()
  const [sort, setSort] = useState({ field: 'project', direction: 'asc' })
  const [diskSort, setDiskSort] = useState({ field: 'project', direction: 'asc' })

  const refreshData = Utils.withBusyState(setLoading, async () => {
    const creator = getUser().email
    const [newRuntimes, newDisks, galaxyDisks, cromwellDisks, newApps] = await Promise.all([
      Ajax(signal).Runtimes.list({ creator }),
      Ajax(signal).Disks.list({ creator }),
      Ajax(signal).Disks.list({ creator, saturnApplication: tools.galaxy.appType }),
      Ajax(signal).Disks.list({ creator, saturnApplication: tools.cromwell.appType }),
      Ajax(signal).Apps.listWithoutProject({ creator })
    ])
    setRuntimes(newRuntimes)
    setDisks(newDisks)
    setApps(newApps)

    _.forEach(disk => disk.appType = tools.galaxy.appType)(galaxyDisks)
    _.forEach(disk => disk.appType = tools.cromwell.appType)(cromwellDisks)
    setAppDisks(_.concat(galaxyDisks, cromwellDisks))

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

  Utils.useOnMount(() => { loadData() })
  Utils.usePollingEffect(withErrorIgnoring(refreshData), { ms: 30000 })

  const filteredRuntimes = _.orderBy([{
    project: 'googleProject',
    status: 'status',
    created: 'auditInfo.createdDate',
    accessed: 'auditInfo.dateAccessed',
    cost: runtimeCost
  }[sort.field]], [sort.direction], runtimes)

  const filteredDisks = _.orderBy([{
    project: 'googleProject',
    status: 'status',
    created: 'auditInfo.createdDate',
    accessed: 'auditInfo.dateAccessed',
    cost: getPersistentDiskCostMonthly,
    size: 'size'
  }[diskSort.field]], [diskSort.direction], disks)

  const filteredApps = _.orderBy([{
    project: 'googleProject',
    status: 'status',
    created: 'auditInfo.createdDate',
    accessed: 'auditInfo.dateAccessed',
    cost: getGalaxyCost
  }[sort.field]], [sort.direction], apps)

  const filteredCloudEnvironments = _.concat(filteredRuntimes, filteredApps)

  const totalRuntimeCost = _.sum(_.map(runtimeCost, runtimes))
  const totalAppCost = _.sum(_.map(getGalaxyComputeCost, apps))
  const totalCost = totalRuntimeCost + totalAppCost
  const totalDiskCost = _.sum(_.map(getPersistentDiskCostMonthly, disks))

  const runtimesByProject = _.groupBy('googleProject', runtimes)
  const disksByProject = _.groupBy('googleProject', disks)
  const appsByProject = _.groupBy('googleProject', apps)

  const renderBillingProjectApp = app => {
    const inactive = !_.includes(app.status, ['DELETING', 'ERROR', 'PREDELETING']) &&
      getCurrentAppForType(app.appType)(appsByProject[app.googleProject]) !== app
    return h(Fragment, [
      app.googleProject,
      inactive && h(TooltipTrigger, {
        content: 'This billing project has multiple active cloud environments. Only the most recently created one will be used.'
      }, [icon('warning-standard', { style: { marginLeft: '0.25rem', color: colors.warning() } })])
    ])
  }

  const renderBillingProjectRuntime = runtime => {
    const inactive = !_.includes(runtime.status, ['Deleting', 'Error']) &&
      getCurrentRuntime(runtimesByProject[runtime.googleProject]) !== runtime
    return h(Fragment, [
      runtime.googleProject,
      inactive && h(TooltipTrigger, {
        content: 'This billing project has multiple active cloud environments. Only the most recently created one will be used.'
      }, [icon('warning-standard', { style: { marginLeft: '0.25rem', color: colors.warning() } })])
    ])
  }

  const renderDetailsApp = (app, disks) => {
    const { appName, diskName } = app
    const disk = _.find({ name: diskName }, disks)
    return h(PopupTrigger, {
      content: div({ style: { padding: '0.5rem' } }, [
        div([span({ style: { fontWeight: '600' } }, ['Name: ']), appName]),
        disk && div([span({ style: { fontWeight: '600' } }, ['Persistent Disk: ']), disk.name])
      ])
    }, [h(Link, ['view'])])
  }

  const renderDetailsRuntime = (runtime, disks) => {
    const { runtimeName, runtimeConfig: { persistentDiskId } } = runtime
    const disk = _.find({ id: persistentDiskId }, disks)
    return h(PopupTrigger, {
      content: div({ style: { padding: '0.5rem' } }, [
        div([span({ style: { fontWeight: '600' } }, ['Name: ']), runtimeName]),
        disk && div([span({ style: { fontWeight: '600' } }, ['Persistent Disk: ']), disk.name])
      ])
    }, [h(Link, ['view'])])
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
    const isPausable = isComputePausable(computeType, compute)
    const app = _.find(tool => tool.appType && tool.appType === compute.appType)(tools)

    return !app?.isPauseUnsupported && h(Link, {
      style: { marginRight: '1rem' },
      disabled: !isPausable,
      tooltip: isPausable ?
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
      isGalaxyDisk: _.some({ appType: tools.galaxy.appType, name: disk.name }, appDisks),
      onDismiss: () => setDeleteDiskId(undefined),
      onSuccess: () => {
        setDeleteDiskId(undefined)
        loadData()
      }
    })
  }

  return h(FooterWrapper, [
    h(TopBar, { title: 'Cloud Environments' }),
    div({ role: 'main', style: { padding: '1rem', flexGrow: 1 } }, [
      h2({ style: { ...Style.elements.sectionHeader, textTransform: 'uppercase', margin: '0 0 1rem 0', padding: 0 } }, ['Your cloud environments']),
      runtimes && h(SimpleFlexTable, {
        'aria-label': 'cloud environments',
        sort,
        rowCount: filteredCloudEnvironments.length,
        columns: [
          {
            field: 'project',
            headerRenderer: () => h(Sortable, { sort, field: 'project', onSort: setSort }, ['Billing project']),
            cellRenderer: ({ rowIndex }) => {
              const cloudEnvironment = filteredCloudEnvironments[rowIndex]
              return cloudEnvironment.appName ? renderBillingProjectApp(cloudEnvironment) : renderBillingProjectRuntime(cloudEnvironment)
            }
          },
          {
            size: { basis: 100, grow: 0 },
            headerRenderer: () => h(Sortable, { sort, field: 'created', onSort: setSort }, ['Type']),
            cellRenderer: ({ rowIndex }) => {
              const cloudEnvironment = filteredCloudEnvironments[rowIndex]
              return isApp(cloudEnvironment) ?
                _.capitalize(cloudEnvironment.appType) :
                (cloudEnvironment.runtimeConfig.cloudService === 'DATAPROC' ? 'Dataproc' : cloudEnvironment.runtimeConfig.cloudService)
            }
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
              // This logic works under the assumption that all Galaxy apps get created in zone 'us-central1-a'
              // if zone or region are not present then cloudEnvironment is a Galaxy app so return 'us-central1-a'
              return zone || region || defaultComputeZone
            }
          },
          {
            size: { basis: 250, grow: 0 },
            field: 'created',
            headerRenderer: () => h(Sortable, { sort, field: 'created', onSort: setSort }, ['Created']),
            cellRenderer: ({ rowIndex }) => {
              return Utils.makeCompleteDate(filteredCloudEnvironments[rowIndex].auditInfo.createdDate)
            }
          },
          {
            size: { basis: 250, grow: 0 },
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
                Utils.formatUSD(runtimeCost(cloudEnvironment))
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
            field: 'project',
            headerRenderer: () => h(Sortable, { sort: diskSort, field: 'project', onSort: setDiskSort }, ['Billing project']),
            cellRenderer: ({ rowIndex }) => {
              const disk = filteredDisks[rowIndex]
              const appDiskNames = _.map(disk => disk.name, appDisks)
              const multipleRuntimeDisks = _.remove(disk => _.includes(disk.name, appDiskNames) || disk.status === 'Deleting',
                disksByProject[disk.googleProject]).length > 1
              const getAppType = diskName => {
                // appDisks has appType populated on it if the disk was related to an app, but
                // disksByProject (which is populated from disks) does not.
                return _.find({ name: diskName }, appDisks)?.appType
              }
              const hasMultipleAppDisks = diskName => {
                const desiredAppType = getAppType(diskName)
                const disks = _.remove(disk => getAppType(disk.name) !== desiredAppType || disk.status === 'Deleting',
                  disksByProject[disk.googleProject])
                return disks.length > 1
              }
              return h(Fragment, [
                disk.googleProject,
                disk.status !== 'Deleting' && (_.includes(disk.name, appDiskNames) ? hasMultipleAppDisks(disk.name) : multipleRuntimeDisks) &&
                h(TooltipTrigger, {
                  content: 'This billing project has multiple active persistent disks. Only one will be used.'
                }, [icon('warning-standard', { style: { marginLeft: '0.25rem', color: colors.warning() } })])
              ])
            }
          },
          {
            size: { basis: 90, grow: 0 },
            headerRenderer: () => 'Details',
            cellRenderer: ({ rowIndex }) => {
              const { name, id } = filteredDisks[rowIndex]
              const runtime = _.find({ runtimeConfig: { persistentDiskId: id } }, runtimes)
              const app = _.find({ diskName: name }, apps)
              return h(PopupTrigger, {
                content: div({ style: { padding: '0.5rem' } }, [
                  div([span({ style: { fontWeight: 600 } }, ['Name: ']), name]),
                  runtime && div([span({ style: { fontWeight: 600 } }, ['Runtime: ']), runtime.runtimeName]),
                  app && div([
                    span({ style: { fontWeight: 600 } },
                      [`${_.capitalize(app.appType)}: `]
                    ), app.appName
                  ])
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
              return disk.status
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
            size: { basis: 240, grow: 0 },
            field: 'created',
            headerRenderer: () => h(Sortable, { sort: diskSort, field: 'created', onSort: setDiskSort }, ['Created']),
            cellRenderer: ({ rowIndex }) => {
              return Utils.makeCompleteDate(filteredDisks[rowIndex].auditInfo.createdDate)
            }
          },
          {
            size: { basis: 240, grow: 0 },
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
              return Utils.formatUSD(getPersistentDiskCostMonthly(filteredDisks[rowIndex], defaultComputeRegion))
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
      loading && spinnerOverlay
    ])
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
