import _ from 'lodash/fp'
import { Fragment, useState } from 'react'
import { b, br, code, div, fieldset, h, label, legend, li, p, span, ul } from 'react-hyperscript-helpers'
import {
  ButtonOutline, ButtonPrimary, ButtonSecondary, GroupedSelect, IdContainer, LabeledCheckbox, Link, Select, spinnerOverlay, WarningTitle
} from 'src/components/common'
import { icon } from 'src/components/icons'
import { ImageDepViewer } from 'src/components/ImageDepViewer'
import { NumberInput, TextInput, ValidatedInput } from 'src/components/input'
import { withModalDrawer } from 'src/components/ModalDrawer'
import { tools } from 'src/components/notebook-utils'
import { InfoBox } from 'src/components/PopupTrigger'
import { SaveFilesHelp, SaveFilesHelpRStudio } from 'src/components/runtime-common'
import TitleBar from 'src/components/TitleBar'
import TooltipTrigger from 'src/components/TooltipTrigger'
import { cloudServices, machineTypes } from 'src/data/machines'
import { Ajax } from 'src/libs/ajax'
import colors from 'src/libs/colors'
import { withErrorReporting } from 'src/libs/error'
import Events, { extractWorkspaceDetails } from 'src/libs/events'
import { versionTag } from 'src/libs/logos'
import * as Nav from 'src/libs/nav'
import {
  defaultDataprocDiskSize, defaultDataprocMachineType, defaultGceBootDiskSize, defaultGceMachineType, defaultGcePersistentDiskSize, defaultGpuType,
  defaultNumDataprocPreemptibleWorkers, defaultNumDataprocWorkers, defaultNumGpus, displayNameForGpuType, findMachineType, getCurrentRuntime,
  getDefaultMachineType, getValidGpuTypes, persistentDiskCostMonthly, RadioBlock, runtimeConfigBaseCost, runtimeConfigCost, styles
} from 'src/libs/runtime-utils'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import validate from 'validate.js'


// Change to true to enable a debugging panel (intended for dev mode only)
const showDebugPanel = false
const titleId = 'cloud-compute-modal-title'

const customMode = '__custom_mode__'
const terraDockerBaseGithubUrl = 'https://github.com/databiosphere/terra-docker'
const terraBaseImages = `${terraDockerBaseGithubUrl}#terra-base-images`
const safeImageDocumentation = 'https://support.terra.bio/hc/en-us/articles/360034669811'

// Distilled from https://github.com/docker/distribution/blob/95daa793b83a21656fe6c13e6d5cf1c3999108c7/reference/regexp.go
const imageValidationRegexp = /^[A-Za-z0-9]+[\w./-]+(?::\w[\w.-]+)?(?:@[\w+.-]+:[A-Fa-f0-9]{32,})?$/

const WorkerSelector = ({ value, machineTypeOptions, onChange }) => {
  const { cpu: currentCpu, memory: currentMemory } = findMachineType(value)
  return h(Fragment, [
    h(IdContainer, [
      id => h(Fragment, [
        label({ htmlFor: id, style: styles.label }, ['CPUs']),
        div([
          h(Select, {
            id,
            isSearchable: false,
            value: currentCpu,
            onChange: option => onChange(_.find({ cpu: option.value }, machineTypeOptions)?.name || value),
            options: _.flow(_.map('cpu'), _.union([currentCpu]), _.sortBy(_.identity))(machineTypeOptions)
          })
        ])
      ])
    ]),
    h(IdContainer, [
      id => h(Fragment, [
        label({ htmlFor: id, style: styles.label }, ['Memory (GB)']),
        div([
          h(Select, {
            id,
            isSearchable: false,
            value: currentMemory,
            onChange: option => onChange(_.find({ cpu: currentCpu, memory: option.value }, machineTypeOptions)?.name || value),
            options: _.flow(_.filter({ cpu: currentCpu }), _.map('memory'), _.union([currentMemory]), _.sortBy(_.identity))(machineTypeOptions)
          })
        ])
      ])
    ])
  ])
}

const DataprocDiskSelector = ({ value, onChange }) => {
  return h(IdContainer, [
    id => h(Fragment, [
      label({ htmlFor: id, style: styles.label }, ['Disk size (GB)']),
      h(NumberInput, {
        id,
        min: 80, // less than this size causes failures in cluster creation
        max: 64000,
        isClearable: false,
        onlyInteger: true,
        value,
        onChange
      })
    ])
  ])
}

const SparkInterface = ({ interfaceName, synopsisLines, namespace, name, onDismiss }) => {
  const interfaceDisplayName = Utils.switchCase(interfaceName,
    ['yarn', () => 'YARN Resource Manager'],
    ['apphistory', () => 'YARN Application Timeline'],
    ['hdfs', () => 'HDFS NameNode'],
    ['sparkhistory', () => 'Spark History Server'],
    ['jobhistory', () => 'MapReduce History Server']
  )

  return div({ style: { ...styles.whiteBoxContainer, marginBottom: '1rem', backgroundColor: colors.accent(0.1), boxShadow: Style.standardShadow } }, [
    div({ style: { flex: '1', lineHeight: '1.5rem', minWidth: 0, display: 'flex' } }, [
      div([
        div({ style: { ...styles.headerText, marginTop: '0.5rem' } }, [interfaceDisplayName]),
        div({ style: { lineHeight: 1.5 } }, _.map(line => div([line]), synopsisLines)),
        div({ style: { display: 'flex', marginTop: '1rem' } }, [
          h(ButtonOutline, {
            disabled: false,
            href: Nav.getLink('workspace-spark-interface-launch', { namespace, name, application: 'spark', sparkInterface: interfaceName }),
            style: { marginRight: 'auto' },
            onClick: onDismiss,
            ...Utils.newTabLinkProps
          }, ['Launch'])
        ])
      ])
    ])
  ])
}

const getImageUrl = runtimeDetails => {
  return _.find(({ imageType }) => _.includes(imageType, ['Jupyter', 'RStudio']), runtimeDetails?.runtimeImages)?.imageUrl
}

const getCurrentPersistentDisk = (runtimes, persistentDisks) => {
  const currentRuntime = getCurrentRuntime(runtimes)
  const id = currentRuntime?.runtimeConfig.persistentDiskId
  const attachedIds = _.without([undefined], _.map(runtime => runtime.runtimeConfig.persistentDiskId, runtimes))

  return id ?
    _.find({ id }, persistentDisks) :
    _.last(_.sortBy('auditInfo.createdDate', _.filter(({ id, status }) => status !== 'Deleting' && !_.includes(id, attachedIds), persistentDisks)))
}

const shouldUsePersistentDisk = (sparkMode, runtimeDetails, upgradeDiskSelected) => !sparkMode &&
  (!runtimeDetails?.runtimeConfig?.diskSize || upgradeDiskSelected)

export const ComputeModalBase = ({ onDismiss, onSuccess, runtimes, persistentDisks, tool, workspace, isAnalysisMode = false }) => {
  // State -- begin
  const [showDebugger, setShowDebugger] = useState(false)
  const [loading, setLoading] = useState(false)
  const [currentRuntimeDetails, setCurrentRuntimeDetails] = useState(() => getCurrentRuntime(runtimes))
  const [currentPersistentDiskDetails, setCurrentPersistentDiskDetails] = useState(() => getCurrentPersistentDisk(runtimes, persistentDisks))
  const [viewMode, setViewMode] = useState(undefined)
  const [deleteDiskSelected, setDeleteDiskSelected] = useState(false)
  const [upgradeDiskSelected, setUpgradeDiskSelected] = useState(false)
  const [simplifiedForm, setSimplifiedForm] = useState(!currentRuntimeDetails)
  const [leoImages, setLeoImages] = useState([])
  const [selectedLeoImage, setSelectedLeoImage] = useState(undefined)
  const [customEnvImage, setCustomEnvImage] = useState('')
  const [jupyterUserScriptUri, setJupyterUserScriptUri] = useState('')
  const [sparkMode, setSparkMode] = useState(false)
  const [computeConfig, setComputeConfig] = useState({
    selectedPersistentDiskSize: defaultGcePersistentDiskSize,
    masterMachineType: defaultGceMachineType,
    masterDiskSize: defaultGceBootDiskSize,
    numberOfWorkers: defaultNumDataprocWorkers,
    numberOfPreemptibleWorkers: defaultNumDataprocPreemptibleWorkers,
    workerMachineType: defaultDataprocMachineType,
    workerDiskSize: defaultDataprocDiskSize,
    componentGatewayEnabled: true, // We enable web interfaces (aka Spark console) for all new Dataproc clusters.
    gpuEnabled: false,
    hasGpu: false,
    gpuType: defaultGpuType,
    numGpus: defaultNumGpus
  })
  // State -- end

  const isPersistentDisk = shouldUsePersistentDisk(sparkMode, currentRuntimeDetails, upgradeDiskSelected)

  const isCustomImage = selectedLeoImage === customMode
  const { version, updated, packages, requiresSpark, label: packageLabel } = _.find({ image: selectedLeoImage }, leoImages) || {}

  const minRequiredMemory = sparkMode ? 7.5 : 3.75
  const validMachineTypes = _.filter(({ memory }) => memory >= minRequiredMemory, machineTypes)
  const mainMachineType = _.find({ name: computeConfig.masterMachineType }, validMachineTypes)?.name || getDefaultMachineType(sparkMode)
  const machineTypeConstraints = { inclusion: { within: _.map('name', validMachineTypes), message: 'is not supported' } }

  const errors = validate(
    { mainMachineType, workerMachineType: computeConfig.workerMachineType, customEnvImage },
    {
      masterMachineType: machineTypeConstraints,
      workerMachineType: machineTypeConstraints,
      customEnvImage: isCustomImage ? { format: { pattern: imageValidationRegexp } } : {}
    },
    {
      prettify: v => ({ customEnvImage: 'Container image', masterMachineType: 'Main CPU/memory', workerMachineType: 'Worker CPU/memory' }[v] ||
        validate.prettify(v))
    }
  )

  // Helper functions -- begin
  const applyChanges = _.flow(
    Utils.withBusyState(setLoading),
    withErrorReporting('Error creating cloud environment')
  )(async () => {
    const { runtime: existingRuntime, persistentDisk: existingPersistentDisk } = getExistingEnvironmentConfig()
    const { runtime: desiredRuntime, persistentDisk: desiredPersistentDisk } = getDesiredEnvironmentConfig()
    const shouldUpdatePersistentDisk = canUpdatePersistentDisk() && !_.isEqual(desiredPersistentDisk, existingPersistentDisk)
    const shouldDeletePersistentDisk = existingPersistentDisk && !canUpdatePersistentDisk()
    const shouldUpdateRuntime = canUpdateRuntime() && !_.isEqual(desiredRuntime, existingRuntime)
    const shouldDeleteRuntime = existingRuntime && !canUpdateRuntime()
    const shouldCreateRuntime = !canUpdateRuntime() && desiredRuntime
    const { namespace, name, bucketName, googleProject } = getWorkspaceObject()

    const runtimeConfig = desiredRuntime && {
      cloudService: desiredRuntime.cloudService,
      ...(desiredRuntime.cloudService === cloudServices.GCE ? {
        machineType: desiredRuntime.machineType || defaultGceMachineType,
        ...(desiredRuntime.diskSize ? {
          diskSize: desiredRuntime.diskSize
        } : {
          persistentDisk: existingPersistentDisk && !shouldDeletePersistentDisk ? {
            name: currentPersistentDiskDetails.name
          } : {
            name: Utils.generatePersistentDiskName(),
            size: desiredPersistentDisk.size,
            labels: { saturnWorkspaceNamespace: namespace, saturnWorkspaceName: name }
          }
        }),
        ...(computeConfig.gpuEnabled && { gpuConfig: { gpuType: computeConfig.gpuType, numOfGpus: computeConfig.numGpus } })
      } : {
        masterMachineType: desiredRuntime.masterMachineType || defaultDataprocMachineType,
        masterDiskSize: desiredRuntime.masterDiskSize,
        numberOfWorkers: desiredRuntime.numberOfWorkers,
        componentGatewayEnabled: desiredRuntime.componentGatewayEnabled,
        ...(desiredRuntime.numberOfWorkers && {
          numberOfPreemptibleWorkers: desiredRuntime.numberOfPreemptibleWorkers,
          workerMachineType: desiredRuntime.workerMachineType,
          workerDiskSize: desiredRuntime.workerDiskSize
        })
      })
    }

    const customEnvVars = {
      WORKSPACE_NAME: name,
      WORKSPACE_NAMESPACE: namespace,
      WORKSPACE_BUCKET: `gs://${bucketName}`,
      GOOGLE_PROJECT: googleProject
    }

    sendCloudEnvironmentMetrics()

    if (shouldDeleteRuntime) {
      await Ajax().Runtimes.runtime(googleProject, currentRuntimeDetails.runtimeName).delete(hasAttachedDisk() && shouldDeletePersistentDisk)
    }
    if (shouldDeletePersistentDisk && !hasAttachedDisk()) {
      await Ajax().Disks.disk(googleProject, currentPersistentDiskDetails.name).delete()
    }
    if (shouldUpdatePersistentDisk) {
      await Ajax().Disks.disk(googleProject, currentPersistentDiskDetails.name).update(desiredPersistentDisk.size)
    }
    if (shouldUpdateRuntime) {
      await Ajax().Runtimes.runtime(googleProject, currentRuntimeDetails.runtimeName).update({ runtimeConfig })
    }
    if (shouldCreateRuntime) {
      await Ajax().Runtimes.runtime(googleProject, Utils.generateRuntimeName()).create({
        runtimeConfig,
        toolDockerImage: desiredRuntime.toolDockerImage,
        labels: { saturnWorkspaceNamespace: namespace, saturnWorkspaceName: name },
        customEnvironmentVariables: customEnvVars,
        ...(desiredRuntime.jupyterUserScriptUri ? { jupyterUserScriptUri: desiredRuntime.jupyterUserScriptUri } : {})
      })
    }

    onSuccess()
  })

  const canUpdateNumberOfWorkers = () => {
    return !currentRuntimeDetails || currentRuntimeDetails.status === 'Running'
  }

  const canUpdateRuntime = () => {
    const { runtime: existingRuntime } = getExistingEnvironmentConfig()
    const { runtime: desiredRuntime } = getDesiredEnvironmentConfig()

    return !(
      !existingRuntime ||
      !desiredRuntime ||
      desiredRuntime.cloudService !== existingRuntime.cloudService ||
      desiredRuntime.toolDockerImage !== existingRuntime.toolDockerImage ||
      desiredRuntime.jupyterUserScriptUri !== existingRuntime.jupyterUserScriptUri ||
      (desiredRuntime.cloudService === cloudServices.GCE ? (
        desiredRuntime.persistentDiskAttached !== existingRuntime.persistentDiskAttached ||
        (desiredRuntime.persistentDiskAttached ? !canUpdatePersistentDisk() : desiredRuntime.diskSize < existingRuntime.diskSize)
      ) : (
        desiredRuntime.masterDiskSize < existingRuntime.masterDiskSize ||
        (desiredRuntime.numberOfWorkers > 0 && existingRuntime.numberOfWorkers === 0) ||
        (desiredRuntime.numberOfWorkers === 0 && existingRuntime.numberOfWorkers > 0) ||
        desiredRuntime.workerMachineType !== existingRuntime.workerMachineType ||
        desiredRuntime.workerDiskSize !== existingRuntime.workerDiskSize
      ))
    )
  }

  const canUpdatePersistentDisk = () => {
    const { persistentDisk: existingPersistentDisk } = getExistingEnvironmentConfig()
    const { persistentDisk: desiredPersistentDisk } = getDesiredEnvironmentConfig()

    return !(
      !existingPersistentDisk ||
      !desiredPersistentDisk ||
      desiredPersistentDisk.size < existingPersistentDisk.size
    )
  }

  const getCurrentMountDirectory = currentRuntimeDetails => {
    const rstudioMountPoint = '/home/rstudio'
    const jupyterMountPoint = '/home/jupyter/notebooks'
    const noMountDirectory = `${jupyterMountPoint} for Jupyter environments and ${rstudioMountPoint} for RStudio environments`
    return currentRuntimeDetails?.labels.tool ?
      (currentRuntimeDetails?.labels.tool === 'RStudio' ? rstudioMountPoint : jupyterMountPoint) :
      noMountDirectory
  }

  const getExistingEnvironmentConfig = () => {
    const runtimeConfig = currentRuntimeDetails?.runtimeConfig
    const cloudService = runtimeConfig?.cloudService
    const numberOfWorkers = runtimeConfig?.numberOfWorkers || 0
    const gpuConfig = runtimeConfig?.gpuConfig
    const tool = currentRuntimeDetails?.labels?.tool

    return {
      hasGpu: computeConfig.hasGpu,
      runtime: currentRuntimeDetails ? {
        cloudService,
        toolDockerImage: getImageUrl(currentRuntimeDetails),
        tool,
        ...(currentRuntimeDetails?.jupyterUserScriptUri && { jupyterUserScriptUri: currentRuntimeDetails?.jupyterUserScriptUri }),
        ...(cloudService === cloudServices.GCE ? {
          machineType: runtimeConfig.machineType || defaultGceMachineType,
          ...(computeConfig.hasGpu && gpuConfig ? { gpuConfig } : {}),
          bootDiskSize: runtimeConfig.bootDiskSize,
          ...(runtimeConfig.persistentDiskId ? {
            persistentDiskAttached: true
          } : {
            diskSize: runtimeConfig.diskSize
          })
        } : {
          masterMachineType: runtimeConfig.masterMachineType || defaultDataprocMachineType,
          masterDiskSize: runtimeConfig.masterDiskSize || 100,
          numberOfWorkers,
          componentGatewayEnabled: runtimeConfig.componentGatewayEnabled || !!sparkMode,
          ...(numberOfWorkers && {
            numberOfPreemptibleWorkers: runtimeConfig.numberOfPreemptibleWorkers || 0,
            workerMachineType: runtimeConfig.workerMachineType || defaultDataprocMachineType,
            workerDiskSize: runtimeConfig.workerDiskSize || 100
          })
        })
      } : undefined,
      persistentDisk: currentPersistentDiskDetails ? { size: currentPersistentDiskDetails.size } : undefined
    }
  }

  const getDesiredEnvironmentConfig = () => {
    const { persistentDisk: existingPersistentDisk, runtime: existingRuntime } = getExistingEnvironmentConfig()
    const cloudService = sparkMode ? cloudServices.DATAPROC : cloudServices.GCE
    const desiredNumberOfWorkers = sparkMode === 'cluster' ? computeConfig.numberOfWorkers : 0

    return {
      hasGpu: computeConfig.hasGpu,
      runtime: Utils.cond(
        [(viewMode !== 'deleteEnvironmentOptions'), () => {
          return {
            cloudService,
            toolDockerImage: selectedLeoImage === customMode ? customEnvImage : selectedLeoImage,
            ...(jupyterUserScriptUri && { jupyterUserScriptUri }),
            ...(cloudService === cloudServices.GCE ? {
              machineType: computeConfig.masterMachineType || defaultGceMachineType,
              ...(computeConfig.gpuEnabled ? { gpuConfig: { gpuType: computeConfig.gpuType, numOfGpus: computeConfig.numGpus } } : {}),
              bootDiskSize: existingRuntime?.bootDiskSize,
              ...(shouldUsePersistentDisk(sparkMode, currentRuntimeDetails, upgradeDiskSelected) ? {
                persistentDiskAttached: true
              } : {
                diskSize: computeConfig.masterDiskSize
              })
            } : {
              masterMachineType: computeConfig.masterMachineType || defaultDataprocMachineType,
              masterDiskSize: computeConfig.masterDiskSize,
              numberOfWorkers: desiredNumberOfWorkers,
              componentGatewayEnabled: computeConfig.componentGatewayEnabled,
              ...(desiredNumberOfWorkers && {
                numberOfPreemptibleWorkers: computeConfig.numberOfPreemptibleWorkers,
                workerMachineType: computeConfig.workerMachineType || defaultDataprocMachineType,
                workerDiskSize: computeConfig.workerDiskSize
              })
            })
          }
        }],
        [!deleteDiskSelected || existingRuntime?.persistentDiskAttached, () => undefined],
        () => existingRuntime
      ),
      persistentDisk: Utils.cond(
        [deleteDiskSelected, () => undefined],
        [viewMode !== 'deleteEnvironmentOptions' && shouldUsePersistentDisk(sparkMode, currentRuntimeDetails, upgradeDiskSelected),
          () => ({ size: computeConfig.selectedPersistentDiskSize })],
        () => existingPersistentDisk
      )
    }
  }

  /**
   * Transforms the new environment config into the shape of a disk returned
   * from leonardo. The cost calculation functions expect that shape, so this
   * is necessary to compute the cost for potential new disk configurations.
   */
  const getPendingDisk = () => {
    const { persistentDisk: desiredPersistentDisk } = getDesiredEnvironmentConfig()
    return { size: desiredPersistentDisk.size, status: 'Ready' }
  }

  /**
   * Transforms the new environment config into the shape of runtime config
   * returned from leonardo. The cost calculation functions expect that shape,
   * so this is necessary to compute the cost for potential new configurations.
   */
  const getPendingRuntimeConfig = () => {
    const { runtime: desiredRuntime } = getDesiredEnvironmentConfig()

    return {
      cloudService: desiredRuntime.cloudService,
      ...(desiredRuntime.cloudService === cloudServices.GCE ? {
        machineType: desiredRuntime.machineType || defaultGceMachineType,
        bootDiskSize: desiredRuntime.bootDiskSize,
        ...(desiredRuntime.gpuConfig ? { gpuConfig: desiredRuntime.gpuConfig } : {}),
        ...(desiredRuntime.diskSize ? { diskSize: desiredRuntime.diskSize } : {})
      } : {
        masterMachineType: desiredRuntime.masterMachineType || defaultDataprocMachineType,
        masterDiskSize: desiredRuntime.masterDiskSize,
        numberOfWorkers: desiredRuntime.numberOfWorkers,
        componentGatewayEnabled: computeConfig.componentGatewayEnabled,
        ...(desiredRuntime.numberOfWorkers && {
          numberOfPreemptibleWorkers: desiredRuntime.numberOfPreemptibleWorkers,
          workerMachineType: desiredRuntime.workerMachineType,
          workerDiskSize: desiredRuntime.workerDiskSize
        })
      })
    }
  }

  const getWorkspaceObject = () => workspace?.workspace

  const handleLearnMoreAboutPersistentDisk = () => {
    setViewMode('aboutPersistentDisk')
    Ajax().Metrics.captureEvent(Events.aboutPersistentDiskView, {
      ...extractWorkspaceDetails(getWorkspaceObject()), currentlyHasAttachedDisk: !!hasAttachedDisk()
    })
  }

  const hasAttachedDisk = () => {
    const { runtime: existingRuntime } = getExistingEnvironmentConfig()
    return existingRuntime?.persistentDiskAttached
  }

  const hasChanges = () => {
    const existingConfig = getExistingEnvironmentConfig()
    const desiredConfig = getDesiredEnvironmentConfig()

    return !_.isEqual(existingConfig, desiredConfig)
  }

  /**
   * Original diagram (without PD) for update runtime logic:
   * https://drive.google.com/file/d/1mtFFecpQTkGYWSgPlaHksYaIudWHa0dY/view
   */
  const isStopRequired = () => {
    const { runtime: existingRuntime } = getExistingEnvironmentConfig()
    const { runtime: desiredRuntime } = getDesiredEnvironmentConfig()

    return canUpdateRuntime() &&
      (existingRuntime.cloudService === cloudServices.GCE ?
        existingRuntime.machineType !== desiredRuntime.machineType :
        existingRuntime.masterMachineType !== desiredRuntime.masterMachineType)
  }

  const makeImageInfo = style => div({ style: { whiteSpace: 'pre', ...style } }, [
    div({ style: Style.proportionalNumbers }, ['Updated: ', updated ? Utils.makeStandardDate(updated) : null]),
    div(['Version: ', version || null])
  ])

  const sendCloudEnvironmentMetrics = () => {
    const { runtime: desiredRuntime, persistentDisk: desiredPersistentDisk } = getDesiredEnvironmentConfig()
    const { runtime: existingRuntime, persistentDisk: existingPersistentDisk } = getExistingEnvironmentConfig()
    const desiredMachineType = desiredRuntime &&
      (desiredRuntime.cloudService === cloudServices.GCE ? desiredRuntime.machineType : desiredRuntime.masterMachineType)
    const existingMachineType = existingRuntime &&
      (existingRuntime?.cloudService === cloudServices.GCE ? existingRuntime.machineType : existingRuntime.masterMachineType)
    const { cpu: desiredRuntimeCpus, memory: desiredRuntimeMemory } = findMachineType(desiredMachineType)
    const { cpu: existingRuntimeCpus, memory: existingRuntimeMemory } = findMachineType(existingMachineType)
    const metricsEvent = Utils.cond(
      [(viewMode === 'deleteEnvironmentOptions'), () => 'cloudEnvironmentDelete'],
      [(!!existingRuntime), () => 'cloudEnvironmentUpdate'],
      () => 'cloudEnvironmentCreate'
    )

    Ajax().Metrics.captureEvent(Events[metricsEvent], {
      ...extractWorkspaceDetails(getWorkspaceObject()),
      ..._.mapKeys(key => `desiredRuntime_${key}`, desiredRuntime),
      desiredRuntime_exists: !!desiredRuntime,
      desiredRuntime_cpus: desiredRuntime && desiredRuntimeCpus,
      desiredRuntime_memory: desiredRuntime && desiredRuntimeMemory,
      desiredRuntime_costPerHour: desiredRuntime && runtimeConfigCost(getPendingRuntimeConfig()),
      desiredRuntime_pausedCostPerHour: desiredRuntime && runtimeConfigBaseCost(getPendingRuntimeConfig()),
      ..._.mapKeys(key => `existingRuntime_${key}`, existingRuntime),
      existingRuntime_exists: !!existingRuntime,
      existingRuntime_cpus: existingRuntime && existingRuntimeCpus,
      existingRuntime_memory: existingRuntime && existingRuntimeMemory,
      ..._.mapKeys(key => `desiredPersistentDisk_${key}`, desiredPersistentDisk),
      desiredPersistentDisk_costPerMonth: (desiredPersistentDisk && persistentDiskCostMonthly(getPendingDisk())),
      ..._.mapKeys(key => `existingPersistentDisk_${key}`, existingPersistentDisk),
      isDefaultConfig: !!simplifiedForm
    })
  }

  const updateComputeConfig = _.curry((key, value) => setComputeConfig(_.set(key, value)))

  const willDeleteBuiltinDisk = () => {
    const { runtime: existingRuntime } = getExistingEnvironmentConfig()
    return (existingRuntime?.diskSize || existingRuntime?.masterDiskSize) && !canUpdateRuntime()
  }

  const willDeletePersistentDisk = () => {
    const { persistentDisk: existingPersistentDisk } = getExistingEnvironmentConfig()
    return existingPersistentDisk && !canUpdatePersistentDisk()
  }

  const willDetachPersistentDisk = () => {
    const { runtime: desiredRuntime } = getDesiredEnvironmentConfig()
    return desiredRuntime.cloudService === cloudServices.DATAPROC && hasAttachedDisk()
  }

  const willRequireDowntime = () => {
    const { runtime: existingRuntime } = getExistingEnvironmentConfig()
    return existingRuntime && (!canUpdateRuntime() || isStopRequired())
  }
  // Helper functions -- end

  // Lifecycle
  Utils.useOnMount(() => {
    // Can't pass an async function into useEffect so we define the function in the body and then call it
    const doUseOnMount = _.flow(
      withErrorReporting('Error loading cloud environment'),
      Utils.withBusyState(setLoading)
    )(async () => {
      const { googleProject } = getWorkspaceObject()
      const currentRuntime = getCurrentRuntime(runtimes)
      const currentPersistentDisk = getCurrentPersistentDisk(runtimes, persistentDisks)

      Ajax().Metrics.captureEvent(Events.cloudEnvironmentConfigOpen, {
        existingConfig: !!currentRuntime, ...extractWorkspaceDetails(getWorkspaceObject())
      })
      const [currentRuntimeDetails, newLeoImages, currentPersistentDiskDetails] = await Promise.all([
        currentRuntime ? Ajax().Runtimes.runtime(currentRuntime.googleProject, currentRuntime.runtimeName).details() : null,
        Ajax()
          .Buckets
          .getObjectPreview(googleProject, 'terra-docker-image-documentation', 'terra-docker-versions.json', true)
          .then(res => res.json()),
        currentPersistentDisk ? Ajax().Disks.disk(currentPersistentDisk.googleProject, currentPersistentDisk.name).details() : null
      ])
      const filteredNewLeoImages = !!tool ? _.filter(image => _.includes(image.id, tools[tool].imageIds), newLeoImages) : newLeoImages

      const imageUrl = currentRuntimeDetails ? getImageUrl(currentRuntimeDetails) : _.find({ id: 'terra-jupyter-gatk' }, newLeoImages).image
      const foundImage = _.find({ image: imageUrl }, newLeoImages)

      /* eslint-disable indent */
        // TODO: open to feedback and still thinking about this...
        // Selected Leo image uses the following logic (psuedoCode not written in same way as code for clarity)
        // if found image (aka image associated with user's runtime) NOT in newLeoImages (the image dropdown list from bucket)
        //   user is using custom image
        // else if found Image NOT in filteredNewLeoImages (filtered based on analysis tool selection) and isAnalysisMode
        //   use default image for selected tool
        // else
        //   use imageUrl derived from users current runtime
        /* eslint-disable indent */
        const getSelectedImage = () => {
          if (foundImage) {
            if (!_.includes(foundImage, filteredNewLeoImages) && isAnalysisMode) {
              return _.find({ id: tools[tool].defaultImageId }, newLeoImages).image
            } else {
              return imageUrl
            }
          } else {
            return customMode
          }
        }

        setSelectedLeoImage(getSelectedImage())
        setLeoImages(filteredNewLeoImages)
        setCurrentRuntimeDetails(currentRuntimeDetails)
        setCurrentPersistentDiskDetails(currentPersistentDiskDetails)
        setCustomEnvImage(!foundImage ? imageUrl : '')
        setJupyterUserScriptUri(currentRuntimeDetails?.jupyterUserScriptUri || '')

        const isDataproc = (sparkMode, runtimeConfig) => !sparkMode && !runtimeConfig?.diskSize
        const runtimeConfig = currentRuntimeDetails?.runtimeConfig
        const gpuConfig = runtimeConfig?.gpuConfig
        const newSparkMode = runtimeConfig?.cloudService === cloudServices.DATAPROC ?
          (runtimeConfig.numberOfWorkers === 0 ? 'master' : 'cluster') :
          false

        setSparkMode(newSparkMode)
        setComputeConfig({
          selectedPersistentDiskSize: currentPersistentDiskDetails?.size || defaultGcePersistentDiskSize,
          masterMachineType: runtimeConfig?.masterMachineType || runtimeConfig?.machineType,
          masterDiskSize: runtimeConfig?.masterDiskSize || runtimeConfig?.diskSize ||
            (isDataproc ? defaultDataprocDiskSize : defaultGceBootDiskSize),
          numberOfWorkers: runtimeConfig?.numberOfWorkers || 2,
          componentGatewayEnabled: runtimeConfig?.componentGatewayEnabled || !!newSparkMode,
          numberOfPreemptibleWorkers: runtimeConfig?.numberOfPreemptibleWorkers || 0,
          workerMachineType: runtimeConfig?.workerMachineType || defaultDataprocMachineType,
          workerDiskSize: runtimeConfig?.workerDiskSize || defaultDataprocDiskSize,
          gpuEnabled: (!!gpuConfig && !sparkMode) || false,
          hasGpu: !!gpuConfig,
          gpuType: gpuConfig?.gpuType || defaultGpuType,
          numGpus: gpuConfig?.numOfGpus || defaultNumGpus
        })
      })

      doUseOnMount()
    }
  )

  // Render functions -- begin
  const renderAboutPersistentDisk = () => {
    return div({ style: styles.drawerContent }, [
      h(TitleBar, {
        id: titleId,
        style: styles.titleBar,
        title: 'About persistent disk',
        hideCloseButton: isAnalysisMode,
        onDismiss,
        onPrevious: () => setViewMode()
      }),
      div({ style: { lineHeight: 1.5 } }, [
        p(['Your persistent disk is mounted in the directory ',
          code({ style: { fontWeight: 600 } }, [getCurrentMountDirectory(currentRuntimeDetails)]), br(),
          'Please save your analysis data in this directory to ensure it’s stored on your disk.']),
        p(['Terra attaches a persistent disk (PD) to your cloud compute in order to provide an option to keep the data on the disk after you delete your compute. PDs also act as a safeguard to protect your data in the case that something goes wrong with the compute.']),
        p(['A minimal cost per hour is associated with maintaining the disk even when the cloud compute is paused or deleted.']),
        p(['If you delete your cloud compute, but keep your PD, the PD will be reattached when creating the next cloud compute.']),
        h(Link, { href: 'https://support.terra.bio/hc/en-us/articles/360047318551', ...Utils.newTabLinkProps }, [
          'Learn more about persistent disks',
          icon('pop-out', { size: 12, style: { marginLeft: '0.25rem' } })
        ])
      ])
    ])
  }

  const renderActionButton = () => {
    const { runtime: existingRuntime, hasGpu } = getExistingEnvironmentConfig()
    const { runtime: desiredRuntime } = getDesiredEnvironmentConfig()
    const commonButtonProps = hasGpu && viewMode !== 'deleteEnvironmentOptions' ?
      { disabled: true, tooltip: 'Cloud compute with GPU(s) cannot be updated. Please delete it and create a new one.' } :
      { disabled: !hasChanges() || !!errors, tooltip: Utils.summarizeErrors(errors) }
    const canShowCustomImageWarning = viewMode === undefined
    const canShowEnvironmentWarning = _.includes(viewMode, [undefined, 'customImageWarning'])

    return Utils.cond([
        canShowCustomImageWarning && isCustomImage && existingRuntime?.toolDockerImage !== desiredRuntime?.toolDockerImage,
        () => h(ButtonPrimary, { ...commonButtonProps, onClick: () => setViewMode('customImageWarning') }, ['Next'])
      ], [
        canShowEnvironmentWarning && (willDeleteBuiltinDisk() || willDeletePersistentDisk() || willRequireDowntime() || willDetachPersistentDisk()),
        () => h(ButtonPrimary, { ...commonButtonProps, onClick: () => setViewMode('environmentWarning') }, ['Next'])
      ],
      () => h(ButtonPrimary, {
        ...commonButtonProps,
        onClick: () => {
          applyChanges()
        }
      }, [
        Utils.cond(
          [viewMode === 'deleteEnvironmentOptions', () => 'Delete'],
          [existingRuntime, () => 'Update'],
          () => 'Create'
        )
      ])
    )
  }

  const renderApplicationConfigurationSection = () => {
    return div({ style: styles.whiteBoxContainer }, [
      h(IdContainer, [
        id => h(Fragment, [
          div({ style: { marginBottom: '0.5rem' } }, [
            label({ htmlFor: id, style: styles.label }, ['Application configuration']),
            h(InfoBox, { style: { marginLeft: '0.5rem' } }, [
              'The software application + programming languages + packages used when you create your cloud environment. '
            ])
          ]),
          div({ style: { height: 45 } }, [renderImageSelect({ id, includeCustom: true })])
        ])
      ]),
      Utils.switchCase(selectedLeoImage,
        [customMode, () => {
          return h(Fragment, [
            h(IdContainer, [
              id => h(Fragment, [
                label({ htmlFor: id, style: { ...styles.label, display: 'block', margin: '0.5rem 0' } }, ['Container image']),
                div({ style: { height: 52 } }, [
                  h(ValidatedInput, {
                    inputProps: {
                      id,
                      placeholder: '<image name>:<tag>',
                      value: customEnvImage,
                      onChange: setCustomEnvImage
                    },
                    error: Utils.summarizeErrors(customEnvImage && errors?.customEnvImage)
                  })
                ])
              ])
            ]),
            div([
              'Custom environments ', b(['must ']), 'be based off one of the ',
              h(Link, { href: terraBaseImages, ...Utils.newTabLinkProps }, ['Terra Jupyter Notebook base images'])
            ])
          ])
        }],
        [Utils.DEFAULT, () => {
          return h(Fragment, [
            div({ style: { display: 'flex' } }, [
              h(Link, { onClick: () => setViewMode('packages') }, ['What’s installed on this environment?']),
              makeImageInfo({ marginLeft: 'auto' })
            ])
          ])
        }]
      )
    ])
  }

  const renderComputeProfileSection = computeExists => {
    const { cpu: currentNumCpus, memory: currentMemory } = findMachineType(mainMachineType)
    const validGpuOptions = getValidGpuTypes(currentNumCpus, currentMemory)
    const validGpuNames = _.flow(_.map('name'), _.uniq, _.sortBy('price'))(validGpuOptions)
    const validGpuName = _.includes(displayNameForGpuType(computeConfig.gpuType), validGpuNames) ?
      displayNameForGpuType(computeConfig.gpuType) :
      _.head(validGpuNames)
    const validNumGpusOptions = _.flow(_.filter({ name: validGpuName }), _.map('numGpus'))(validGpuOptions)
    const validNumGpus = _.includes(computeConfig.numGpus, validNumGpusOptions) ? computeConfig.numGpus : _.head(validNumGpusOptions)
    const gpuCheckboxDisabled = computeExists ? !computeConfig.gpuEnabled : sparkMode
    const enableGpusSpan = span(
      ['Enable GPUs ', versionTag('Beta', { color: colors.primary(1.5), backgroundColor: 'white', border: `1px solid ${colors.primary(1.5)}` })])
    const gridStyle = { display: 'grid', gridGap: '1.3rem', alignItems: 'center', marginTop: '1rem' }

    return div({ style: { ...styles.whiteBoxContainer, marginTop: '1rem' } }, [
      div({ style: { fontSize: '0.875rem', fontWeight: 600 } }, ['Cloud compute profile']),
      div([
        div({ style: { ...gridStyle, gridTemplateColumns: '0.25fr 4.5rem 1fr 5.5rem 1fr 5rem' } }, [
          // CPU & Memory Selection
          h(IdContainer, [
            id => h(Fragment, [
              label({ htmlFor: id, style: styles.label }, ['CPUs']),
              div([
                h(Select, {
                  id,
                  isSearchable: false,
                  value: currentNumCpus,
                  onChange: ({ value }) => updateComputeConfig('masterMachineType',
                    _.find({ cpu: value }, validMachineTypes)?.name || mainMachineType),
                  options: _.flow(_.map('cpu'), _.union([currentNumCpus]), _.sortBy(_.identity))(validMachineTypes)
                })
              ])
            ])
          ]),
          h(IdContainer, [
            id => h(Fragment, [
              label({ htmlFor: id, style: styles.label }, ['Memory (GB)']),
              div([
                h(Select, {
                  id,
                  isSearchable: false,
                  value: currentMemory,
                  onChange: ({ value }) => updateComputeConfig('masterMachineType',
                    _.find({ cpu: currentNumCpus, memory: value }, validMachineTypes)?.name || mainMachineType),
                  options: _.flow(_.filter({ cpu: currentNumCpus }), _.map('memory'), _.union([currentMemory]), _.sortBy(_.identity))(
                    validMachineTypes)
                })
              ])
            ])
          ]),
          // Disk Selection
          !isPersistentDisk ?
            h(DataprocDiskSelector, { value: computeConfig.masterDiskSize, onChange: updateComputeConfig('masterDiskSize') }) :
            div({ style: { gridColumnEnd: 'span 2' } })
        ]),
        // GPU Enabling
        !sparkMode && div({ style: { gridColumnEnd: 'span 6', marginTop: '1.5rem' } }, [
          h(LabeledCheckbox, {
            checked: computeConfig.gpuEnabled,
            disabled: gpuCheckboxDisabled,
            onChange: v => updateComputeConfig('gpuEnabled', v || computeConfig.hasGpu)
          }, [
            span({ style: { marginLeft: '0.5rem', ...styles.label, verticalAlign: 'top' } }, [
              gpuCheckboxDisabled ?
                h(TooltipTrigger, { content: ['GPUs can be added only to Standard VM compute at creation time.'], side: 'right' }, [enableGpusSpan]) :
                enableGpusSpan
            ]),
            h(Link, {
              style: { marginLeft: '1rem', verticalAlign: 'top' },
              href: 'https://support.terra.bio/hc/en-us/articles/4403006001947', ...Utils.newTabLinkProps
            }, [
              'Learn more about GPU cost and restrictions.',
              icon('pop-out', { size: 12, style: { marginLeft: '0.25rem' } })
            ])
          ])
        ]),
        // GPU Selection
        computeConfig.gpuEnabled && !sparkMode && div({ style: { ...gridStyle, gridTemplateColumns: '0.75fr 12rem 1fr 5.5rem 1fr 5.5rem' } }, [
          h(Fragment, [
            h(IdContainer, [
              id => h(Fragment, [
                label({ htmlFor: id, style: styles.label }, ['GPU type']),
                div({ style: { height: 45 } }, [
                  h(Select, {
                    id,
                    isSearchable: false,
                    value: validGpuName,
                    onChange: ({ value }) => updateComputeConfig('gpuType', _.find({ name: value }, validGpuOptions)?.type),
                    options: validGpuNames
                  })
                ])
              ])
            ]),
            h(IdContainer, [
              id => h(Fragment, [
                label({ htmlFor: id, style: styles.label }, ['GPUs']),
                div([
                  h(Select, {
                    id,
                    isSearchable: false,
                    value: validNumGpus,
                    onChange: ({ value }) => updateComputeConfig('numGpus',
                      _.find({ type: computeConfig.gpuType, numGpus: value }, validGpuOptions)?.numGpus),
                    options: validNumGpusOptions
                  })
                ])
              ])
            ])
          ])
        ]),
        div({ style: gridStyle }, [
          h(IdContainer, [
            id => div({ style: { gridColumnEnd: 'span 6', marginTop: '0.5rem' } }, [
              label({ htmlFor: id, style: styles.label }, ['Startup script']),
              div({ style: { marginTop: '0.5rem' } }, [
                h(TextInput, {
                  id,
                  placeholder: 'URI',
                  value: jupyterUserScriptUri,
                  onChange: setJupyterUserScriptUri
                })
              ])
            ])
          ]),
          h(IdContainer, [
            id => div({ style: { gridColumnEnd: 'span 4', marginTop: '0.5rem' } }, [
              label({ htmlFor: id, style: styles.label }, ['Compute type']),
              div({ style: { marginTop: '0.5rem' } }, [
                h(Select, {
                  id,
                  isSearchable: false,
                  value: sparkMode,
                  onChange: ({ value }) => {
                    setSparkMode(value)
                    updateComputeConfig('componentGatewayEnabled', !!value)
                  },
                  options: [
                    { value: false, label: 'Standard VM', isDisabled: requiresSpark },
                    { value: 'master', label: 'Spark master node' },
                    { value: 'cluster', label: 'Spark cluster' }
                  ]
                })
              ])
            ])
          ]),
          // TODO: Is there a more robust way to center Link vertically wrt. the Select component above?
          span({ style: { paddingTop: '2rem' } }, [
            h(Link, {
              disabled: !sparkMode,
              tooltip: !sparkMode && 'You must have a Spark cluster or a master node.',
              onClick: () => setViewMode('sparkConsole')
            }, ['Manage and monitor Spark console'])
          ])
        ])
      ]),
      sparkMode === 'cluster' && fieldset({ style: { margin: '1.5rem 0 0', border: 'none', padding: 0 } }, [
        legend({ style: { padding: 0, ...styles.label } }, ['Worker config']),
        // grid styling in a div because of display issues in chrome: https://bugs.chromium.org/p/chromium/issues/detail?id=375693
        div({ style: { ...gridStyle, gridTemplateColumns: '0.75fr 4.5rem 1fr 5rem 1fr 5rem', marginTop: '0.75rem' } }, [
          h(IdContainer, [
            id => h(Fragment, [
              label({ htmlFor: id, style: styles.label }, ['Workers']),
              h(NumberInput, {
                id,
                min: 2,
                isClearable: false,
                onlyInteger: true,
                value: computeConfig.numberOfWorkers,
                disabled: !canUpdateNumberOfWorkers(),
                tooltip: !canUpdateNumberOfWorkers() ? 'Cloud Compute must be in Running status to change number of workers.' : undefined,
                onChange: updateComputeConfig('numberOfWorkers')
              })
            ])
          ]),
          h(IdContainer, [
            id => h(Fragment, [
              label({ htmlFor: id, style: styles.label }, ['Preemptibles']),
              h(NumberInput, {
                id,
                min: 0,
                isClearable: false,
                onlyInteger: true,
                value: computeConfig.numberOfPreemptibleWorkers,
                disabled: !canUpdateNumberOfWorkers(),
                tooltip: !canUpdateNumberOfWorkers() ? 'Cloud Compute must be in Running status to change number of preemptibles' : undefined,
                onChange: updateComputeConfig('numberOfPreemptibleWorkers')
              })
            ])
          ]),
          div({ style: { gridColumnEnd: 'span 2' } }),
          h(WorkerSelector, {
            value: computeConfig.workerMachineType, machineTypeOptions: validMachineTypes, onChange: updateComputeConfig('workerMachineType')
          }),
          h(DataprocDiskSelector, { value: computeConfig.workerDiskSize, onChange: updateComputeConfig('workerDiskSize') })
        ])
      ])
    ])
  }

  const renderCostBreakdown = () => {
    return div({
      style: {
        backgroundColor: colors.accent(0.2),
        display: 'flex',
        borderRadius: 5,
        padding: '0.5rem 1rem',
        marginTop: '1rem'
      }
    }, [
      _.map(({ cost, label, unitLabel }) => {
        return div({ key: label, style: { flex: 1, ...styles.label } }, [
          div({ style: { fontSize: 10 } }, [label]),
          div({ style: { color: colors.accent(1.1), marginTop: '0.25rem' } }, [
            span({ style: { fontSize: 20 } }, [cost]),
            span([' ', unitLabel])
          ])
        ])
      }, [
        { label: 'Running cloud compute cost', cost: Utils.formatUSD(runtimeConfigCost(getPendingRuntimeConfig())), unitLabel: 'per hr' },
        { label: 'Paused cloud compute cost', cost: Utils.formatUSD(runtimeConfigBaseCost(getPendingRuntimeConfig())), unitLabel: 'per hr' },
        {
          label: 'Persistent disk cost', cost: isPersistentDisk ? Utils.formatUSD(persistentDiskCostMonthly(getPendingDisk())) : 'N/A',
          unitLabel: isPersistentDisk ? 'per month' : ''
        }
      ])
    ])
  }

  const renderCustomImageWarning = () => {
    return div({ style: { ...styles.drawerContent, ...styles.warningView } }, [
      h(TitleBar, {
        id: titleId,
        hideCloseButton: isAnalysisMode,
        style: styles.titleBar,
        title: h(WarningTitle, ['Unverified Docker image']),
        onDismiss,
        onPrevious: () => setViewMode(undefined)
      }),
      div({ style: { lineHeight: 1.5 } }, [
        p([
          'You are about to create a virtual machine using an unverified Docker image. ',
          'Please make sure that it was created by you or someone you trust, using one of our ',
          h(Link, { href: terraBaseImages, ...Utils.newTabLinkProps }, ['base images.']),
          ' Custom Docker images could potentially cause serious security issues.'
        ]),
        h(Link, { href: safeImageDocumentation, ...Utils.newTabLinkProps }, ['Learn more about creating safe and secure custom Docker images.']),
        p(['If you\'re confident that your image is safe, you may continue using it. Otherwise, go back to select another image.'])
      ]),
      div({ style: { display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' } }, [
        renderActionButton()
      ])
    ])
  }

  const renderDebugger = () => {
    const makeHeader = text => div({ style: { fontSize: 20, margin: '0.5rem 0' } }, [text])
    const makeJSON = value => div({ style: { whiteSpace: 'pre-wrap', fontFamily: 'Menlo, monospace' } }, [JSON.stringify(value, null, 2)])
    return showDebugger ?
      div({ style: { position: 'fixed', top: 0, left: 0, bottom: 0, right: '50vw', backgroundColor: 'white', padding: '1rem', overflowY: 'auto' } }, [
        h(Link, { onClick: () => setShowDebugger(false), style: { position: 'absolute', top: 0, right: 0 } }, ['x']),
        makeHeader('Old Environment Config'),
        makeJSON(getExistingEnvironmentConfig()),
        makeHeader('New Environment Config'),
        makeJSON(getDesiredEnvironmentConfig()),
        makeHeader('Misc'),
        makeJSON({
          canUpdateRuntime: !!canUpdateRuntime(),
          willDeleteBuiltinDisk: !!willDeleteBuiltinDisk(),
          willDeletePersistentDisk: !!willDeletePersistentDisk(),
          willRequireDowntime: !!willRequireDowntime()
        })
      ]) :
      h(Link, { onClick: () => setShowDebugger(true), style: { position: 'fixed', top: 0, left: 0, color: 'white' } }, ['D'])
  }

  const renderDeleteDiskChoices = () => {
    const { runtime: existingRuntime } = getExistingEnvironmentConfig()

    return h(Fragment, [
      h(RadioBlock, {
        name: 'keep-persistent-disk',
        labelText: 'Keep persistent disk, delete application configuration and compute profile',
        checked: !deleteDiskSelected,
        onChange: () => setDeleteDiskSelected(false)
      }, [
        p(['Please save your analysis data in the directory ',
          code({ style: { fontWeight: 600 } }, [getCurrentMountDirectory(currentRuntimeDetails)]), ' to ensure it’s stored on your disk.']),
        p([
          'Deletes your application configuration and cloud compute profile, but detaches your persistent disk and saves it for later. ',
          'The disk will be automatically reattached the next time you create a cloud environment using the standard VM compute type.'
        ]),
        p({ style: { marginBottom: 0 } }, [
          'You will continue to incur persistent disk cost at ',
          span({ style: { fontWeight: 600 } }, [Utils.formatUSD(persistentDiskCostMonthly(currentPersistentDiskDetails)), ' per month.'])
        ])
      ]),
      h(RadioBlock, {
        name: 'delete-persistent-disk',
        labelText: 'Delete everything, including persistent disk',
        checked: deleteDiskSelected,
        onChange: () => setDeleteDiskSelected(true),
        style: { marginTop: '1rem' }
      }, [
        p([
          'Deletes your persistent disk, which will also ', span({ style: { fontWeight: 600 } }, ['delete all files on the disk.'])
        ]),
        p({ style: { marginBottom: 0 } }, [
          'Also deletes your application configuration and cloud compute profile.'
        ])
      ]),
      existingRuntime.tool === 'RStudio' ? h(SaveFilesHelpRStudio) : h(SaveFilesHelp)
    ])
  }

  const renderDeleteEnvironmentOptions = () => {
    const { runtime: existingRuntime, persistentDisk: existingPersistentDisk } = getExistingEnvironmentConfig()
    return div({ style: { ...styles.drawerContent, ...styles.warningView } }, [
      h(TitleBar, {
        id: titleId,
        style: styles.titleBar,
        title: h(WarningTitle, ['Delete environment options']),
        hideCloseButton: isAnalysisMode,
        onDismiss,
        onPrevious: () => {
          setViewMode(undefined)
          setDeleteDiskSelected(false)
        }
      }),
      div({ style: { lineHeight: '1.5rem' } }, [
        Utils.cond(
          [existingRuntime && existingPersistentDisk && !existingRuntime.persistentDiskAttached, () => {
            return h(Fragment, [
              h(RadioBlock, {
                name: 'delete-persistent-disk',
                labelText: 'Delete application configuration and cloud compute profile',
                checked: !deleteDiskSelected,
                onChange: () => setDeleteDiskSelected(false)
              }, [
                p({ style: { marginBottom: 0 } }, [
                  'Deletes your application configuration and cloud compute profile. This will also ',
                  span({ style: { fontWeight: 600 } }, ['delete all files on the built-in hard disk.'])
                ])
              ]),
              h(RadioBlock, {
                name: 'delete-persistent-disk',
                labelText: 'Delete persistent disk',
                checked: deleteDiskSelected,
                onChange: () => setDeleteDiskSelected(true),
                style: { marginTop: '1rem' }
              }, [
                p([
                  'Deletes your persistent disk, which will also ', span({ style: { fontWeight: 600 } }, ['delete all files on the disk.'])
                ]),
                p({ style: { marginBottom: 0 } }, [
                  'Since the persistent disk is not attached, the application configuration and cloud compute profile will remain.'
                ])
              ]),
              existingRuntime.tool === 'RStudio' ? h(SaveFilesHelpRStudio) : h(SaveFilesHelp)
            ])
          }],
          [existingRuntime && existingPersistentDisk, () => renderDeleteDiskChoices()],
          [!existingRuntime && existingPersistentDisk, () => {
            return h(Fragment, [
              h(RadioBlock, {
                name: 'delete-persistent-disk',
                labelText: 'Delete persistent disk',
                checked: deleteDiskSelected,
                onChange: () => setDeleteDiskSelected(true)
              }, [
                p([
                  'Deletes your persistent disk, which will also ', span({ style: { fontWeight: 600 } }, ['delete all files on the disk.'])
                ]),
                p({ style: { marginBottom: 0 } }, [
                  'If you want to permanently save some files from the disk before deleting it, you will need to create a new cloud environment to access it.'
                ])
              ]),
              existingRuntime.tool === 'RStudio' ? h(SaveFilesHelpRStudio) : h(SaveFilesHelp)
            ])
          }],
          () => {
            return h(Fragment, [
              p([
                'Deleting your application configuration and cloud compute profile will also ',
                span({ style: { fontWeight: 600 } }, ['delete all files on the built-in hard disk.'])
              ]),
              existingRuntime.tool === 'RStudio' ? h(SaveFilesHelpRStudio) : h(SaveFilesHelp)
            ])
          }
        )
      ]),
      div({ style: { display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' } }, [
        renderActionButton()
      ])
    ])
  }

  const renderEnvironmentWarning = () => {
    const { runtime: existingRuntime } = getExistingEnvironmentConfig()

    return div({ style: { ...styles.drawerContent, ...styles.warningView } }, [
      h(TitleBar, {
        id: titleId,
        style: styles.titleBar,
        hideCloseButton: isAnalysisMode,
        title: h(WarningTitle, [
          Utils.cond(
            [willDetachPersistentDisk(), () => 'Replace application configuration and cloud compute profile for Spark'],
            [willDeleteBuiltinDisk() || willDeletePersistentDisk(), () => 'Data will be deleted'],
            [willRequireDowntime(), () => 'Downtime required']
          )
        ]),
        onDismiss,
        onPrevious: () => {
          setViewMode(undefined)
          setDeleteDiskSelected(false)
        }
      }),
      div({ style: { lineHeight: 1.5 } }, [
        Utils.cond(
          [willDetachPersistentDisk(), () => h(Fragment, [
            div([
              'You have requested to replace your existing application configuration and cloud compute profile to ones that support Spark. ',
              'This type of cloud compute does not support the persistent disk feature.'
            ]),
            div({ style: { margin: '1rem 0 0.5rem', fontSize: 16, fontWeight: 600 } }, ['What would you like to do with your disk?']),
            renderDeleteDiskChoices()
          ])],
          [willDeleteBuiltinDisk(), () => h(Fragment, [
            p([
              'This change requires rebuilding your cloud environment, which will ',
              span({ style: { fontWeight: 600 } }, ['delete all files on built-in hard disk.'])
            ]),
            existingRuntime.tool === 'RStudio' ? h(SaveFilesHelpRStudio) : h(SaveFilesHelp)
          ])],
          [willDeletePersistentDisk(), () => h(Fragment, [
            p([
              'To reduce the size of the PD, the existing PD will be deleted and a new one will be created and attached to your virtual machine instance. This will ',
              span({ style: { fontWeight: 600 } }, ['delete all files on the disk.'])
            ]),
            existingRuntime.tool === 'RStudio' ? h(SaveFilesHelpRStudio) : h(SaveFilesHelp)
          ])],
          [willRequireDowntime(), () => h(Fragment, [
            p(['This change will require temporarily shutting down your cloud environment. You will be unable to perform analysis for a few minutes.']),
            p(['Your existing data will be preserved during this update.'])
          ])]
        )
      ]),
      div({ style: { display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' } }, [
        renderActionButton()
      ])
    ])
  }

  const renderImageSelect = ({ includeCustom, ...props }) => {
    const getImages = predicate => _.flow(
      _.filter(predicate),
      _.map(({ label, image }) => ({ label, value: image }))
    )(leoImages)

    return h(GroupedSelect, {
      ...props,
      maxMenuHeight: '25rem',
      value: selectedLeoImage,
      onChange: ({ value }) => {
        const requiresSpark = _.find({ image: value }, leoImages)?.requiresSpark
        const newSparkMode = requiresSpark ? (sparkMode || 'master') : false
        setSelectedLeoImage(value)
        setCustomEnvImage('')
        setSparkMode(newSparkMode)
        updateComputeConfig('componentGatewayEnabled', !!newSparkMode)
      },
      isSearchable: true,
      isClearable: false,
      options: [
        {
          label: 'TERRA-MAINTAINED JUPYTER ENVIRONMENTS',
          options: getImages(({ isCommunity, isRStudio }) => (!isCommunity && !isRStudio))
        },
        {
          label: 'COMMUNITY-MAINTAINED JUPYTER ENVIRONMENTS (verified partners)',
          options: getImages(_.get(['isCommunity']))
        },
        {
          label: 'COMMUNITY-MAINTAINED RSTUDIO ENVIRONMENTS (verified partners)',
          options: getImages(_.get(['isRStudio']))
        },
        ...(includeCustom ? [{
          label: 'OTHER ENVIRONMENTS',
          options: [{ label: 'Custom Environment', value: customMode }]
        }] : [])
      ]
    })
  }

  const renderMainForm = () => {
    const { runtime: existingRuntime, persistentDisk: existingPersistentDisk } = getExistingEnvironmentConfig()
    const { cpu, memory } = findMachineType(mainMachineType)
    const renderTitleAndTagline = () => {
      return h(Fragment, [
        h(TitleBar, {
          id: titleId,
          style: { marginBottom: '0.5rem' },
          title: 'Cloud Environment',
          hideCloseButton: isAnalysisMode,
          onDismiss
        }),
        div(['A cloud environment consists of application configuration, cloud compute and persistent disk(s).'])
      ])
    }
    const renderBottomButtons = () => {
      return div({ style: { display: 'flex', marginTop: '2rem' } }, [
        (!!existingRuntime || !!existingPersistentDisk) && h(ButtonSecondary, {
          onClick: () => setViewMode('deleteEnvironmentOptions')
        }, [
          Utils.cond(
            [!!existingRuntime && !existingPersistentDisk, () => 'Delete Runtime'],
            [!existingRuntime && !!existingPersistentDisk, () => 'Delete Persistent Disk'],
            () => 'Delete Environment Options'
          )
        ]),
        div({ style: { flex: 1 } }),
        !simplifiedForm && renderActionButton()
      ])
    }
    const renderDiskText = () => {
      return span({ style: { fontWeight: 600 } }, [computeConfig.selectedPersistentDiskSize, ' GB persistent disk'])
    }
    return simplifiedForm ?
      div({ style: styles.drawerContent }, [
        renderTitleAndTagline(),
        div({ style: { ...styles.whiteBoxContainer, marginTop: '1rem' } }, [
          div({ style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' } }, [
            div({ style: { marginRight: '2rem' } }, [
              div({ style: { fontSize: 16, fontWeight: 600 } }, ['Use default environment']),
              ul({ style: { paddingLeft: '1rem', marginBottom: 0, lineHeight: 1.5 } }, [
                li([
                  div([packageLabel]),
                  h(Link, { onClick: () => setViewMode('packages') }, ['What’s installed on this environment?'])
                ]),
                li({ style: { marginTop: '1rem' } }, [
                  'Default compute size of ', span({ style: { fontWeight: 600 } }, [cpu, ' CPU(s)']), ', ',
                  span({ style: { fontWeight: 600 } }, [memory, ' GB memory']), ', and ',
                  existingPersistentDisk ?
                    h(Fragment, ['your existing ', renderDiskText()]) :
                    h(Fragment, ['a ', renderDiskText(), ' to keep your data even after you delete your compute'])
                ]),
                li({ style: { marginTop: '1rem' } }, [
                  h(Link, { onClick: handleLearnMoreAboutPersistentDisk }, ['Learn more about Persistent disks and where your disk is mounted'])
                ])
              ])
            ]),
            renderActionButton()
          ]),
          renderCostBreakdown()
        ]),
        div({ style: { ...styles.whiteBoxContainer, marginTop: '1rem' } }, [
          div({ style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } }, [
            div({ style: { fontSize: 16, fontWeight: 600 } }, ['Create custom environment']),
            h(ButtonOutline, { onClick: () => setSimplifiedForm(false) }, ['Customize'])
          ])
        ]),
        renderBottomButtons()
      ]) :
      h(Fragment, [
        div({ style: { padding: '1.5rem', borderBottom: `1px solid ${colors.dark(0.4)}` } }, [
          renderTitleAndTagline(),
          renderCostBreakdown()
        ]),
        div({ style: { padding: '1.5rem', overflowY: 'auto', flex: 'auto' } }, [
          renderApplicationConfigurationSection(),
          renderComputeProfileSection(existingRuntime),
          !!isPersistentDisk && renderPersistentDiskSection(),
          !sparkMode && !isPersistentDisk && div({ style: { ...styles.whiteBoxContainer, marginTop: '1rem' } }, [
            div([
              'Time to upgrade your cloud environment. Terra’s new persistent disk feature will safeguard your work and data. ',
              h(Link, { onClick: handleLearnMoreAboutPersistentDisk }, ['Learn more about Persistent disks and where your disk is mounted'])
            ]),
            h(ButtonOutline, {
              style: { marginTop: '1rem' },
              tooltip: 'Upgrade your environment to use a persistent disk. This will require a one-time deletion of your current built-in disk, but after that your data will be stored and preserved on the persistent disk.',
              onClick: () => setUpgradeDiskSelected(true)
            }, ['Upgrade'])
          ]),
          renderBottomButtons()
        ])
      ])
  }

  const renderPackages = () => {
    return div({ style: styles.drawerContent }, [
      h(TitleBar, {
        id: titleId,
        style: styles.titleBar,
        title: 'Installed packages',
        hideCloseButton: isAnalysisMode,
        onDismiss,
        onPrevious: () => setViewMode(undefined)
      }),
      renderImageSelect({ 'aria-label': 'Select Environment' }),
      makeImageInfo({ margin: '1rem 0 0.5rem' }),
      packages && h(ImageDepViewer, { packageLink: packages })
    ])
  }

  const renderSparkConsole = () => {
    const { namespace, name } = getWorkspaceObject()

    return div({ style: styles.drawerContent }, [
      h(TitleBar, {
        id: titleId,
        title: 'Spark Console',
        style: { marginBottom: '0.5rem' },
        hideCloseButton: isAnalysisMode,
        onDismiss,
        onPrevious: () => setViewMode(undefined)
      }),
      div({ style: { marginBottom: '1rem' } }, [
        div(['Some of the Spark cluster components such as Apache Hadoop and Apache Spark']),
        div(['provide web interfaces. These interfaces can be used to manage and monitor cluster']),
        div(['resources and facilities, such as the YARN resource manager, the Hadoop Distributed']),
        div(['File System (HDFS), MapReduce, and Spark.'])
      ]),
      h(SparkInterface, {
        interfaceName: 'yarn',
        synopsisLines: [
          'YARN Resource Manager provides information about cluster status and metrics',
          'as well as information about the scheduler, nodes, and applications on the cluster.'
        ],
        namespace,
        name,
        onDismiss
      }),
      h(SparkInterface, {
        interfaceName: 'apphistory',
        synopsisLines: [
          'YARN Application Timeline provides information about current and historic',
          'applications executed on the cluster.'
        ],
        namespace,
        name,
        onDismiss
      }),
      h(SparkInterface, {
        interfaceName: 'hdfs',
        synopsisLines: [
          'A NameNode is a main daemon that maintains and manages DataNodes.',
          'This interface can be used to view summary and detailed information',
          'on name and data nodes.'
        ],
        namespace,
        name,
        onDismiss
      }),
      h(SparkInterface, {
        interfaceName: 'sparkhistory',
        synopsisLines: [
          'Spark History Server provides information about completed Spark applications',
          'on the cluster.'
        ],
        namespace,
        name,
        onDismiss
      }),
      h(SparkInterface, {
        interfaceName: 'jobhistory',
        synopsisLines: [
          'MapReduce History Server displays information about completed MapReduce',
          'applications on a cluster.'
        ],
        namespace,
        name,
        onDismiss
      })
    ])
  }

  const renderPersistentDiskSection = () => {
    return div({ style: { ...styles.whiteBoxContainer, marginTop: '1rem' } }, [
      h(IdContainer, [
        id => h(div, { style: { display: 'flex', flexDirection: 'column' } }, [
          label({ htmlFor: id, style: styles.label }, ['Persistent disk size (GB)']),
          div({ style: { marginTop: '0.5rem' } }, [
            'Persistent disks store analysis data. ',
            h(Link, { onClick: handleLearnMoreAboutPersistentDisk }, ['Learn more about persistent disks and where your disk is mounted.'])
          ]),
          h(NumberInput, {
            id,
            min: 10,
            max: 64000,
            isClearable: false,
            onlyInteger: true,
            value: computeConfig.selectedPersistentDiskSize,
            style: { marginTop: '0.5rem', width: '5rem' },
            onChange: updateComputeConfig('selectedPersistentDiskSize')
          })
        ])
      ])
    ])
  }
  // Render functions -- end

  // Render
  return h(Fragment, [
    Utils.switchCase(viewMode,
      ['packages', renderPackages],
      ['aboutPersistentDisk', renderAboutPersistentDisk],
      ['sparkConsole', renderSparkConsole],
      ['customImageWarning', renderCustomImageWarning],
      ['environmentWarning', renderEnvironmentWarning],
      ['deleteEnvironmentOptions', renderDeleteEnvironmentOptions],
      [Utils.DEFAULT, renderMainForm]
    ),
    loading && spinnerOverlay,
    showDebugPanel && renderDebugger()
  ])
}

export const ComputeModal = withModalDrawer({ width: 675, 'aria-labelledby': titleId })(
  ComputeModalBase
)
