import _ from 'lodash/fp'
import * as qs from 'qs'
import { Fragment, useEffect, useRef, useState } from 'react'
import { div, h, h2, p, span } from 'react-hyperscript-helpers'
import Collapse from 'src/components/Collapse'
import { ButtonOutline, ButtonPrimary, Clickable, Link, spinnerOverlay } from 'src/components/common'
import FooterWrapper from 'src/components/FooterWrapper'
import { icon, spinner } from 'src/components/icons'
import Modal from 'src/components/Modal'
import { InfoBox, MenuButton, MenuTrigger } from 'src/components/PopupTrigger'
import TopBar from 'src/components/TopBar'
import { ReactComponent as CloudAzureLogo } from 'src/images/cloud_azure_icon.svg'
import { ReactComponent as CloudGcpLogo } from 'src/images/cloud_google_icon.svg'
import { Ajax } from 'src/libs/ajax'
import * as Auth from 'src/libs/auth'
import colors from 'src/libs/colors'
import { getConfig } from 'src/libs/config'
import { reportError, reportErrorAndRethrow } from 'src/libs/error'
import Events from 'src/libs/events'
import * as Nav from 'src/libs/nav'
import { useCancellation, useOnMount } from 'src/libs/react-utils'
import * as StateHistory from 'src/libs/state-history'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import CreateAzureBillingProjectModal from 'src/pages/billing/CreateAzureBillingProjectModal'
import CreateGCPBillingProject from 'src/pages/billing/CreateGCPBillingProject'
import CreateNewBillingProjectWizard from 'src/pages/billing/CreateNewBillingProjectWizard'
import DeleteBillingProjectModal from 'src/pages/billing/DeleteBillingProjectModal'
import ProjectDetail from 'src/pages/billing/Project'
import { cloudProviders } from 'src/pages/workspaces/workspace/analysis/runtime-utils'
import validate from 'validate.js'


export const billingRoles = {
  owner: 'Owner',
  user: 'User'
}

const styles = {
  projectListItem: selected => {
    return {
      ...Style.navList.itemContainer(selected),
      ...Style.navList.item(selected),
      ...(selected ? { backgroundColor: colors.dark(0.1) } : {}),
      paddingLeft: '3rem'
    }
  }
}

const isCreatingStatus = status => _.includes(status, ['Creating', 'CreatingLandingZone'])

const CreateBillingProjectControl = ({ isAlphaAzureUser, showCreateProjectModal }) => {
  const createButton = (onClickCallback, type) => {
    return h(ButtonOutline, {
      'aria-label': 'Create new billing project',
      onClick: () => !!onClickCallback && onClickCallback(type)
    }, [span([icon('plus-circle', { style: { marginRight: '1ch' } }), 'Create'])])
  }

  if (!isAlphaAzureUser) {
    return createButton(showCreateProjectModal, cloudProviders.gcp)
  } else {
    return h(MenuTrigger, {
      side: 'bottom',
      closeOnClick: true,
      content: h(Fragment, [
        h(MenuButton, {
          'aria-haspopup': 'dialog',
          onClick: () => showCreateProjectModal(cloudProviders.azure)
        }, 'Azure Billing Project'),
        h(MenuButton, {
          'aria-haspopup': 'dialog',
          onClick: () => showCreateProjectModal(cloudProviders.gcp)
        }, 'GCP Billing Project')
      ])
    }, [createButton()])
  }
}

const BillingProjectActions = ({ project: { projectName }, loadProjects }) => {
  const [showDeleteProjectModal, setShowDeleteProjectModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  return h(Fragment, [
    h(MenuTrigger, {
      closeOnClick: true,
      side: 'right',
      style: { marginRight: '0.5rem' },
      content: h(Fragment, [
        h(MenuButton, {
          onClick: () => setShowDeleteProjectModal(true)
        }, ['Delete Billing Project'])
      ])
    }, [
      h(Link, { 'aria-label': 'Billing project menu', style: { display: 'flex', alignItems: 'center' } }, [
        icon('cardMenuIcon', { size: 16, 'aria-haspopup': 'menu' })
      ])
    ]),
    showDeleteProjectModal && h(DeleteBillingProjectModal, {
      projectName, deleting,
      onDismiss: () => setShowDeleteProjectModal(false),
      onConfirm: async () => {
        setDeleting(true)
        try {
          await Ajax().Billing.deleteProject(projectName)
          setShowDeleteProjectModal(false)
          loadProjects()
        } catch (err) {
          reportError('Error deleting billing project.', err)
          setShowDeleteProjectModal(false)
        }
        setDeleting(false)
      }
    })
  ])
}

const ProjectListItem = ({ project, project: { roles, status, cloudPlatform }, loadProjects, isActive }) => {
  const cloudContextIcon =
    div({ style: { display: 'flex', marginRight: '0.5rem' } }, [
      Utils.switchCase(cloudPlatform,
        [cloudProviders.gcp.label, () => h(CloudGcpLogo, { title: cloudProviders.gcp.iconTitle, role: 'img' })],
        [cloudProviders.azure.label, () => h(CloudAzureLogo, { title: cloudProviders.azure.iconTitle, role: 'img' })])
    ])

  const selectableProject = ({ projectName }, isActive) => h(Clickable, {
    style: { ...styles.projectListItem(isActive), color: isActive ? colors.accent(1.1) : colors.accent() },
    href: `${Nav.getLink('billing')}?${qs.stringify({ selectedName: projectName, type: 'project' })}`,
    onClick: () => Ajax().Metrics.captureEvent(Events.billingProjectOpenFromList, {
      billingProjectName: projectName
    }),
    hover: Style.navList.itemHover(isActive),
    'aria-current': isActive ? 'location' : false
  }, [cloudContextIcon, projectName])

  const unselectableProject = ({ projectName, status, message }, isActive, isOwner) => {
    const iconAndTooltip =
      isCreatingStatus(status) ? spinner({ size: 16, style: { color: colors.accent(), margin: '0 1rem 0 0.5rem' } }) :
        status === 'Error' ? h(Fragment, [
          h(InfoBox, { style: { color: colors.danger(), margin: '0 0.5rem 0 0.5rem' }, side: 'right' }, [
            div({ style: { wordWrap: 'break-word', whiteSpace: 'pre-wrap' } }, [
              message || 'Error during project creation.'
            ])
          ]),
          //Currently, only billing projects that failed to create can have actions performed on them.
          //If that changes in the future, this should be moved elsewhere
          isOwner && h(BillingProjectActions, { project, loadProjects })
        ]) : undefined

    return div({ style: { ...styles.projectListItem(isActive), color: colors.dark() } }, [
      cloudContextIcon, projectName, iconAndTooltip
    ])
  }

  const viewerRoles = _.intersection(roles, _.values(billingRoles))
  const isOwner = _.includes(billingRoles.owner, roles)

  return div({ role: 'listitem' }, [
    !_.isEmpty(viewerRoles) && status === 'Ready' ?
      selectableProject(project, isActive) :
      unselectableProject(project, isActive, isOwner)
  ])
}

export const billingProjectNameValidator = existing => ({
  length: { minimum: 6, maximum: 30 },
  format: {
    pattern: /(\w|-)+/,
    message: 'can only contain letters, numbers, underscores and hyphens.'
  },
  exclusion: {
    within: existing,
    message: 'already exists'
  }
})

const BillingProjectSubheader = ({ title, children }) => h(Collapse, {
  title: span({ style: { fontWeight: 'bold' } }, [title]),
  initialOpenState: true,
  titleFirst: true,
  summaryStyle: { padding: '1rem 1rem 1rem 2rem' }
}, [children])

const NewBillingProjectModal = ({ onSuccess, onDismiss, billingAccounts, loadAccounts }) => {
  const [billingProjectName, setBillingProjectName] = useState('')
  const [existing, setExisting] = useState([])
  const [isBusy, setIsBusy] = useState(false)
  const [chosenBillingAccount, setChosenBillingAccount] = useState('')

  const submit = _.flow(
    reportErrorAndRethrow('Error creating billing project'),
    Utils.withBusyState(setIsBusy)
  )(async () => {
    try {
      await Ajax().Billing.createGCPProject(billingProjectName, chosenBillingAccount.accountName)
      onSuccess(billingProjectName)
    } catch (error) {
      if (error.status === 409) {
        setExisting(_.concat(billingProjectName, existing))
      } else {
        throw error
      }
    }
  })

  const errors = validate({ billingProjectName }, { billingProjectName: billingProjectNameValidator(existing) })
  const billingLoadedAndEmpty = billingAccounts && _.isEmpty(billingAccounts)
  const billingPresent = !_.isEmpty(billingAccounts)

  return h(Modal, {
    onDismiss,
    shouldCloseOnOverlayClick: false,
    title: 'Create Terra Billing Project',
    showCancel: !billingLoadedAndEmpty,
    showButtons: !!billingAccounts,
    okButton: billingPresent ?
      h(ButtonPrimary, {
        disabled: errors || !chosenBillingAccount || !chosenBillingAccount.firecloudHasAccess,
        onClick: submit
      }, ['Create']) :
      h(ButtonPrimary, {
        onClick: onDismiss
      }, ['Ok'])
  }, [
    billingLoadedAndEmpty && h(Fragment, [
      'You don\'t have access to any billing accounts.  ',
      h(Link, {
        href: 'https://support.terra.bio/hc/en-us/articles/360026182251',
        ...Utils.newTabLinkProps
      }, ['Learn how to create a billing account.', icon('pop-out', { size: 12, style: { marginLeft: '0.5rem' } })])
    ]),
    billingPresent && h(Fragment, [
      CreateGCPBillingProject({ billingAccounts, chosenBillingAccount, setChosenBillingAccount, billingProjectName, setBillingProjectName, existing }),
      !!chosenBillingAccount && !chosenBillingAccount.firecloudHasAccess && div({ style: { fontWeight: 500, fontSize: 13 } }, [
        div({ style: { margin: '0.25rem 0 0.25rem 0', color: colors.danger() } },
          'Terra does not have access to this account. '),
        div({ style: { marginBottom: '0.25rem' } }, ['To grant access, add ', span({ style: { fontWeight: 'bold' } }, 'terra-billing@terra.bio'),
          ' as a ', span({ style: { fontWeight: 'bold' } }, 'Billing Account User'), ' on the ',
          h(Link, {
            href: `https://console.cloud.google.com/billing/${chosenBillingAccount.accountName.split('/')[1]}?authuser=${Auth.getUser().email}`,
            ...Utils.newTabLinkProps
          }, ['Google Cloud Console', icon('pop-out', { style: { marginLeft: '0.25rem' }, size: 12 })])]),
        div({ style: { marginBottom: '0.25rem' } }, ['Then, ',
          h(Link, { onClick: loadAccounts }, ['click here']), ' to refresh your billing accounts.']),
        div({ style: { marginTop: '0.5rem' } }, [
          h(Link, {
            href: 'https://support.terra.bio/hc/en-us/articles/360026182251',
            ...Utils.newTabLinkProps
          }, ['Need help?', icon('pop-out', { style: { marginLeft: '0.25rem' }, size: 12 })])
        ])
      ])
    ]),
    (isBusy || !billingAccounts) && spinnerOverlay
  ])
}

export const BillingList = ({ queryParams: { selectedName } }) => {
  // State
  const [billingProjects, setBillingProjects] = useState(StateHistory.get().billingProjects || [])
  const [creatingBillingProject, setCreatingBillingProject] = useState(null) // null or cloudProvider values
  const [billingAccounts, setBillingAccounts] = useState({})
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [isAuthorizing, setIsAuthorizing] = useState(false)
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false)
  const [isAlphaSpendReportUser, setIsAlphaSpendReportUser] = useState(false)
  const [isAlphaAzureUser, setIsAlphaAzureUser] = useState(false)

  const signal = useCancellation()
  const interval = useRef()

  // Helpers
  const loadProjects = _.flow(
    reportErrorAndRethrow('Error loading billing projects list'),
    Utils.withBusyState(setIsLoadingProjects)
  )(async () => setBillingProjects(_.sortBy('projectName', await Ajax(signal).Billing.listProjects())))

  const loadAlphaSpendReportMember = reportErrorAndRethrow('Error loading spend report group membership')(async () => {
    setIsAlphaSpendReportUser(await Ajax(signal).Groups.group(getConfig().alphaSpendReportGroup).isMember())
  })

  const loadAlphaAzureMember = reportErrorAndRethrow('Error loading azure alpha group membership')(async () => {
    setIsAlphaAzureUser(await Ajax(signal).Groups.group(getConfig().alphaAzureGroup).isMember())
  })

  const reloadBillingProject = _.flow(
    reportErrorAndRethrow('Error loading billing project'),
    Utils.withBusyState(setIsLoadingProjects)
  )(async ({ projectName }) => {
    const index = _.findIndex({ projectName }, billingProjects)
    // fetch the project to error if it doesn't exist/user can't access
    const project = await Ajax(signal).Billing.getProject(selectedName)
    setBillingProjects(_.set([index], project))
  })

  const authorizeAccounts = _.flow(
    reportErrorAndRethrow('Error setting up authorization'),
    Utils.withBusyState(setIsAuthorizing)
  )(Auth.ensureBillingScope)

  const tryAuthorizeAccounts = _.flow(
    reportErrorAndRethrow('Error setting up authorization'),
    Utils.withBusyState(setIsAuthorizing)
  )(Auth.tryBillingScope)

  const loadAccounts = _.flow(
    reportErrorAndRethrow('Error loading billing accounts'),
    Utils.withBusyState(setIsLoadingAccounts)
  )(() => {
    if (Auth.hasBillingScope()) {
      return Ajax(signal).Billing.listAccounts()
        .then(_.keyBy('accountName'))
        .then(setBillingAccounts)
    }
  })

  const authorizeAndLoadAccounts = () => authorizeAccounts().then(loadAccounts)

  const showCreateProjectModal = async type => {
    if (type === cloudProviders.azure) {
      setCreatingBillingProject(type)
    } else if (Auth.hasBillingScope()) {
      setCreatingBillingProject(type)
    } else {
      await authorizeAndLoadAccounts()
      Auth.hasBillingScope() && setCreatingBillingProject(type)
    }
  }


  // Lifecycle
  useOnMount(() => {
    loadProjects()
    tryAuthorizeAccounts().then(loadAccounts)
    loadAlphaSpendReportMember()
    loadAlphaAzureMember()
  })

  useEffect(() => {
    const anyProjectsCreating = _.some(({ status }) => isCreatingStatus(status), billingProjects)

    if (anyProjectsCreating && !interval.current) {
      interval.current = setInterval(loadProjects, 10000)
    } else if (!anyProjectsCreating && interval.current) {
      clearInterval(interval.current)
      interval.current = undefined
    }

    StateHistory.update({ billingProjects })

    return () => {
      clearInterval(interval.current)
      interval.current = undefined
    }
  })

  // Render
  const breadcrumbs = 'Billing > Billing Project'
  const billingProjectListWidth = 330
  const [projectsOwned, projectsShared] = _.partition(
    ({ roles }) => _.includes(billingRoles.owner, roles),
    billingProjects
  )

  return h(FooterWrapper, { fixedHeight: true }, [
    h(TopBar, { title: 'Billing' }, [
      !!selectedName && div({ style: Style.breadcrumb.breadcrumb }, [
        div({ style: Style.noWrapEllipsis }, breadcrumbs),
        div({ style: Style.breadcrumb.textUnderBreadcrumb }, [selectedName])
      ])
    ]),
    div({ role: 'main', style: { display: 'flex', flex: 1, height: `calc(100% - ${Style.topBarHeight}px)` } }, [
      div({
        style: {
          minWidth: billingProjectListWidth, maxWidth: billingProjectListWidth,
          boxShadow: '0 2px 5px 0 rgba(0,0,0,0.25)', overflowY: 'auto'
        }
      }, [
        div({
          role: 'navigation',
          style: {
            fontSize: 16, fontWeight: 600, padding: '2rem 1rem 1rem', display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', textTransform: 'uppercase', color: colors.dark()
          }
        }, [
          h2({ style: { fontSize: 16 } }, 'Billing Projects'),
          h(CreateBillingProjectControl, { isAlphaAzureUser, showCreateProjectModal })
        ]),
        h(BillingProjectSubheader, { title: 'Owned by You' }, [
          div({ role: 'list' }, [
            _.map(project => h(ProjectListItem, {
              project, key: project.projectName, loadProjects,
              isActive: !!selectedName && project.projectName === selectedName
            }), projectsOwned)
          ])
        ]),
        h(BillingProjectSubheader, { title: 'Shared with You' }, [
          div({ role: 'list' }, [
            _.map(project => h(ProjectListItem, {
              project, key: project.projectName, loadProjects,
              isActive: !!selectedName && project.projectName === selectedName
            }), projectsShared)
          ])
        ])
      ]),
      creatingBillingProject === cloudProviders.gcp && h(NewBillingProjectModal, {
        billingAccounts,
        loadAccounts,
        onDismiss: () => setCreatingBillingProject(null),
        onSuccess: billingProjectName => {
          Ajax().Metrics.captureEvent(Events.billingCreationGCPBillingProjectCreated, { billingProject: billingProjectName })
          setCreatingBillingProject(null)
          loadProjects()
        }
      }),
      creatingBillingProject === cloudProviders.azure && isAlphaAzureUser && h(CreateAzureBillingProjectModal, {
        onDismiss: () => setCreatingBillingProject(null),
        onSuccess: billingProjectName => {
          Ajax().Metrics.captureEvent(Events.billingCreationAzureBillingProjectCreated, { billingProject: billingProjectName })
          setCreatingBillingProject(null)
          loadProjects()
        },
        billingProjectNameValidator
      }),
      div({
        style: {
          overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column'
        }
      }, [Utils.cond(
        [selectedName && !_.some({ projectName: selectedName }, billingProjects),
          () => div({
            style: {
              margin: '1rem auto 0 auto'
            }
          }, [
            div([
              h2(['Error loading selected billing project.']),
              p(['It may not exist, or you may not have access to it.'])
            ])
          ])],
        [!isLoadingProjects && _.isEmpty(billingProjects), () => h(CreateNewBillingProjectWizard, {
          billingAccounts,
          onSuccess: billingProjectName => {
            Ajax().Metrics.captureEvent(Events.billingCreationGCPBillingProjectCreated, { billingProject: billingProjectName })
            setCreatingBillingProject(null)
            loadProjects()
            Nav.history.push({
              pathname: Nav.getPath('billing'),
              search: qs.stringify({ selectedName: billingProjectName, type: 'project' })
            })
          },
          authorizeAndLoadAccounts
        })],
        [selectedName && _.some({ projectName: selectedName }, billingProjects), () => {
          const billingProject = _.find({ projectName: selectedName }, billingProjects)
          return h(ProjectDetail, {
            key: selectedName,
            billingProject,
            billingAccounts,
            authorizeAndLoadAccounts,
            reloadBillingProject: () => reloadBillingProject(billingProject).catch(loadProjects),
            isAlphaSpendReportUser,
            isOwner: _.find({ projectName: selectedName }, projectsOwned)
          })
        }],
        [!_.isEmpty(projectsOwned) && !selectedName, () => {
          return div({ style: { margin: '1rem auto 0 auto' } }, [
            'Select a Billing Project'
          ])
        }]
      )]),
      (isLoadingProjects || isAuthorizing || isLoadingAccounts) && spinnerOverlay
    ])
  ])
}


export const navPaths = [
  {
    name: 'billing',
    path: '/billing',
    component: BillingList,
    title: 'Billing'
  }
]
