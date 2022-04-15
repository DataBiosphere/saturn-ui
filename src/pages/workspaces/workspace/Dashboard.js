import _ from 'lodash/fp'
import { Fragment, useEffect, useImperativeHandle, useState } from 'react'
import { div, h, h2, i, span } from 'react-hyperscript-helpers'
import * as breadcrumbs from 'src/components/breadcrumbs'
import { requesterPaysWrapper, withRequesterPaysHandler } from 'src/components/bucket-utils'
import Collapse from 'src/components/Collapse'
import { ButtonPrimary, ButtonSecondary, ClipboardButton, Link, spinnerOverlay } from 'src/components/common'
import { centeredSpinner, icon } from 'src/components/icons'
import { MarkdownEditor, MarkdownViewer } from 'src/components/markdown'
import { InfoBox } from 'src/components/PopupTrigger'
import { getRegionInfo } from 'src/components/region-common'
import { SimpleTable, TooltipCell } from 'src/components/table'
import TooltipTrigger from 'src/components/TooltipTrigger'
import { WorkspaceTagSelect } from 'src/components/workspace-utils'
import { displayConsentCodes, displayLibraryAttributes } from 'src/data/workspace-attributes'
import { ReactComponent as GcpLogo } from 'src/images/gcp.svg'
import { Ajax } from 'src/libs/ajax'
import { bucketBrowserUrl } from 'src/libs/auth'
import colors from 'src/libs/colors'
import { reportError, withErrorReporting } from 'src/libs/error'
import { getAppName } from 'src/libs/logos'
import * as Nav from 'src/libs/nav'
import { getLocalPref, setLocalPref } from 'src/libs/prefs'
import { forwardRefWithName, useCancellation, useOnMount, useStore } from 'src/libs/react-utils'
import { authStore } from 'src/libs/state'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import SignIn from 'src/pages/SignIn'
import DashboardPublic from 'src/pages/workspaces/workspace/DashboardPublic'
import { wrapWorkspace } from 'src/pages/workspaces/workspace/WorkspaceContainer'


const styles = {
  authDomain: {
    padding: '0.5rem 0.25rem', marginBottom: '0.25rem',
    backgroundColor: colors.dark(0.15),
    ...Style.noWrapEllipsis
  },
  tag: {
    padding: '0.25rem', margin: '0.15rem',
    backgroundColor: colors.dark(0.15), borderRadius: 10,
    overflow: 'hidden', wordWrap: 'break-word'
  }
}

const roleString = {
  READER: 'Reader',
  WRITER: 'Writer',
  OWNER: 'Owner',
  PROJECT_OWNER: 'Project Owner'
}

const InfoRow = ({ title, subtitle, children }) => {
  return div({ role: 'row', style: { display: 'flex', justifyContent: 'space-between', margin: '1rem 0.5rem' } }, [
    div({ style: { width: 225 } }, [
      div({ style: { fontWeight: 500 } }, [title]),
      subtitle && div({ style: { fontWeight: 400, fontSize: 12 } }, [subtitle])
    ]),
    div({ style: { width: 225, display: 'flex', overflow: 'hidden' } }, [children])
  ])
}

const displayAttributeValue = v => {
  return Utils.cond(
    [_.isArray(v), () => v.join(', ')],
    [v?.items, () => v.items.join(', ')],
    [v === true, () => 'Yes'],
    [v === false, () => 'No'],
    () => v
  )
}

const DataUseLimitations = ({ attributes }) => {
  return _.map(({ key, title }) => {
    return div({ key, style: { display: 'inline-block', marginRight: '0.75rem' } }, [
      h(TooltipTrigger, { content: title }, [
        span({ style: { textDecoration: 'underline dotted' } }, [key.slice(8)])
      ]),
      ': ',
      displayAttributeValue(attributes[key])
    ])
  }, _.filter(({ key }) => _.has(key, attributes), displayConsentCodes))
}

const DashboardAuthContainer = props => {
  const { namespace, name } = props
  const { isSignedIn } = useStore(authStore)
  const [featuredWorkspaces, setFeaturedWorkspaces] = useState()

  const isGoogleAuthInitialized = isSignedIn !== undefined

  useEffect(() => {
    const fetchData = async () => {
      setFeaturedWorkspaces(await Ajax().FirecloudBucket.getFeaturedWorkspaces())
    }
    if (isSignedIn === false) {
      fetchData()
    }
  }, [isSignedIn])

  const isFeaturedWorkspace = () => _.some(ws => ws.namespace === namespace && ws.name === name, featuredWorkspaces)

  return Utils.cond(
    [!isGoogleAuthInitialized || (isSignedIn === false && featuredWorkspaces === undefined), () => h(centeredSpinner, { style: { position: 'fixed' } })],
    [isSignedIn === false && isFeaturedWorkspace(), () => h(DashboardPublic, props)],
    [isSignedIn === false, () => h(SignIn)],
    () => h(WorkspaceDashboard, props)
  )
}

const WorkspaceDashboard = _.flow(
  forwardRefWithName('WorkspaceDashboard'),
  requesterPaysWrapper({ onDismiss: () => Nav.history.goBack() }),
  wrapWorkspace({
    breadcrumbs: () => breadcrumbs.commonPaths.workspaceList(),
    activeTab: 'dashboard'
  })
)(({
  namespace, name,
  refreshWorkspace,
  workspace, workspace: {
    accessLevel,
    owners,
    workspace: {
      authorizationDomain, createdDate, lastModified, bucketName, googleProject,
      attributes, attributes: { description = '' }
    }
  },
  onRequesterPaysError
}, ref) => {
  // State
  const [submissionsCount, setSubmissionsCount] = useState(undefined)
  const [storageCostEstimate, setStorageCostEstimate] = useState(undefined)
  const [storageCostEstimateUpdated, setStorageCostEstimateUpdated] = useState(undefined)
  const [bucketSize, setBucketSize] = useState(undefined)
  const [editDescription, setEditDescription] = useState(undefined)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [consentStatus, setConsentStatus] = useState(undefined)
  const [tagsList, setTagsList] = useState(undefined)
  const [bucketLocation, setBucketLocation] = useState(undefined)
  const [bucketLocationType, setBucketLocationType] = useState(undefined)

  const persistenceId = `workspaces/${namespace}/${name}/dashboard`

  const signal = useCancellation()

  const refresh = () => {
    loadSubmissionCount()
    loadStorageCost()
    loadBucketSize()
    loadConsent()
    loadWsTags()
    loadBucketLocation()
  }

  useImperativeHandle(ref, () => ({ refresh }))

  const [workspaceInfoPanelOpen, setWorkspaceInfoPanelOpen] = useState(() => getLocalPref(persistenceId)?.workspaceInfoPanelOpen)
  const [cloudInfoPanelOpen, setCloudInfoPanelOpen] = useState(() => getLocalPref(persistenceId)?.cloudInfoPanelOpen || false)
  const [ownersPanelOpen, setOwnersPanelOpen] = useState(() => getLocalPref(persistenceId)?.ownersPanelOpen || false)
  const [authDomainPanelOpen, setAuthDomainPanelOpen] = useState(() => getLocalPref(persistenceId)?.authDomainPanelOpen || false)
  const [tagsPanelOpen, setTagsPanelOpen] = useState(() => getLocalPref(persistenceId)?.tagsPanelOpen || false)

  useEffect(() => {
    setLocalPref(persistenceId, { workspaceInfoPanelOpen, cloudInfoPanelOpen, ownersPanelOpen, authDomainPanelOpen, tagsPanelOpen })
  }, [workspaceInfoPanelOpen, cloudInfoPanelOpen, ownersPanelOpen, authDomainPanelOpen, tagsPanelOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Helpers
  const loadSubmissionCount = withErrorReporting('Error loading submission count data', async () => {
    const submissions = await Ajax(signal).Workspaces.workspace(namespace, name).listSubmissions()
    setSubmissionsCount(submissions.length)
  })

  const loadStorageCost = withErrorReporting('Error loading storage cost data', async () => {
    if (Utils.canWrite(accessLevel)) {
      const { estimate, lastUpdated } = await Ajax(signal).Workspaces.workspace(namespace, name).storageCostEstimate()
      setStorageCostEstimate(estimate)
      setStorageCostEstimateUpdated(lastUpdated)
    }
  })

  const loadBucketSize = withErrorReporting('Error loading bucket size.', async () => {
    if (Utils.canWrite(accessLevel)) {
      const { usageInBytes } = await Ajax(signal).Workspaces.workspace(namespace, name).bucketUsage()
      setBucketSize(Utils.formatBytes(usageInBytes))
    }
  })

  const loadBucketLocation = _.flow(
    withRequesterPaysHandler(onRequesterPaysError),
    withErrorReporting('Error loading bucket location data')
  )(async () => {
    const { location, locationType } = await Ajax(signal).Workspaces.workspace(namespace, name).checkBucketLocation(googleProject, bucketName)
    setBucketLocation(location)
    setBucketLocationType(locationType)
  })

  const loadConsent = withErrorReporting('Error loading data', async () => {
    const orspId = attributes['library:orsp']
    if (orspId) {
      try {
        const { translatedUseRestriction } = await Ajax(signal).Duos.getConsent(orspId)
        setConsentStatus(translatedUseRestriction)
      } catch (error) {
        switch (error.status) {
          case 400:
            setConsentStatus(`Structured Data Use Limitations are not approved for ${orspId}`)
            break
          case 404:
            setConsentStatus(`Structured Data Use Limitations are not available for ${orspId}`)
            break
          default:
            throw error
        }
      }
    }
  })

  const loadWsTags = withErrorReporting('Error loading workspace tags', async () => {
    setTagsList(await Ajax(signal).Workspaces.workspace(namespace, name).getTags())
  })

  const addTag = _.flow(
    withErrorReporting('Error adding tag'),
    Utils.withBusyState(setBusy)
  )(async tag => {
    setTagsList(await Ajax().Workspaces.workspace(namespace, name).addTag(tag))
  })

  const deleteTag = _.flow(
    withErrorReporting('Error removing tag'),
    Utils.withBusyState(setBusy)
  )(async tag => {
    setTagsList(await Ajax().Workspaces.workspace(namespace, name).deleteTag(tag))
  })

  const save = Utils.withBusyState(setSaving, async () => {
    try {
      await Ajax().Workspaces.workspace(namespace, name).shallowMergeNewAttributes({ description: editDescription })
      await refreshWorkspace()
    } catch (error) {
      reportError('Error saving workspace', error)
    } finally {
      setEditDescription(undefined)
    }
  })


  // Lifecycle
  useOnMount(() => {
    refresh()
  })


  // Render
  const isEditing = _.isString(editDescription)
  const { flag, regionDescription } = getRegionInfo(bucketLocation, bucketLocationType)

  return div({ style: { flex: 1, display: 'flex' } }, [
    div({ style: Style.dashboard.leftBox }, [
      div({ style: Style.dashboard.header }, [
        'About the workspace',
        !isEditing && h(Link, {
          style: { marginLeft: '0.5rem' },
          disabled: !!Utils.editWorkspaceError(workspace),
          tooltip: Utils.editWorkspaceError(workspace) || 'Edit description',
          onClick: () => setEditDescription(description?.toString())
        }, [icon('edit')])
      ]),
      Utils.cond(
        [
          isEditing, () => h(Fragment, [
            h(MarkdownEditor, {
              placeholder: 'Enter a description',
              value: editDescription,
              onChange: setEditDescription
            }),
            div({ style: { display: 'flex', justifyContent: 'flex-end', margin: '1rem' } }, [
              h(ButtonSecondary, { onClick: () => setEditDescription(undefined) }, 'Cancel'),
              h(ButtonPrimary, { style: { marginLeft: '1rem' }, onClick: save }, 'Save')
            ]),
            saving && spinnerOverlay
          ])
        ],
        [!!description, () => h(MarkdownViewer, [description?.toString()])],
        () => div({ style: { fontStyle: 'italic' } }, ['No description added'])),
      _.some(_.startsWith('library:'), _.keys(attributes)) && h(Fragment, [
        div({ style: Style.dashboard.header }, ['Dataset Attributes']),
        h(SimpleTable, {
          'aria-label': 'dataset attributes table',
          rows: _.flow(
            _.map(({ key, title }) => ({ name: title, value: displayAttributeValue(attributes[key]) })),
            Utils.append({
              name: 'Structured Data Use Limitations',
              value: attributes['library:orsp'] ? consentStatus : h(DataUseLimitations, { attributes })
            }),
            _.filter('value')
          )(displayLibraryAttributes),
          columns: [
            { key: 'name', size: { grow: 1 } },
            { key: 'value', size: { grow: 2 } }
          ]
        })
      ])
    ]),
    div({ style: Style.dashboard.rightBox }, [
      div({ style: { paddingTop: '1rem' } }, [
        div({ style: { borderRadius: 5, backgroundColor: 'white', padding: '0.5rem' } }, [
          h(Collapse, {
            title: h2({ style: Style.dashboard.collapsableHeader }, ['Workspace information']),
            initialOpenState: workspaceInfoPanelOpen !== undefined ? workspaceInfoPanelOpen : true,
            titleFirst: true,
            onClick: () => setWorkspaceInfoPanelOpen(workspaceInfoPanelOpen === undefined ? false : !workspaceInfoPanelOpen)
          }, [
            h(InfoRow, { title: 'Last Updated' }, [new Date(lastModified).toLocaleDateString()]),
            h(InfoRow, { title: 'Creation Date' }, [new Date(createdDate).toLocaleDateString()]),
            h(InfoRow, { title: 'Workflow Submissions' }, [submissionsCount]),
            h(InfoRow, { title: 'Access Level' }, [roleString[accessLevel]])
          ])
        ])
      ]),
      div({ style: { paddingTop: '1rem' } }, [
        div({ style: { borderRadius: 5, backgroundColor: 'white', padding: '0.5rem' } }, [
          h(Collapse, {
            title: h2({ style: Style.dashboard.collapsableHeader }, ['Cloud information']),
            initialOpenState: cloudInfoPanelOpen,
            titleFirst: true,
            onClick: () => setCloudInfoPanelOpen(!cloudInfoPanelOpen)
          }, [
            googleProject && h(InfoRow, { title: 'Cloud Name' }, [
              h(GcpLogo, { title: 'Google Cloud Platform', role: 'img', style: { height: 16, width: 132, marginLeft: -15 } })
            ]),
            h(InfoRow, { title: 'Location' }, [bucketLocation ? h(Fragment, [
              h(TooltipCell, [flag, ' ', regionDescription])
            ]) : 'Loading...']),
            h(InfoRow, { title: 'Google Project ID' }, [
              h(TooltipCell, [googleProject]),
              h(ClipboardButton, { text: googleProject, style: { marginLeft: '0.25rem' } })
            ]),
            h(InfoRow, { title: 'Bucket Name' }, [
              h(TooltipCell, [bucketName]),
              h(ClipboardButton, { text: bucketName, style: { marginLeft: '0.25rem' } })
            ]),
            Utils.canWrite(accessLevel) && h(InfoRow, {
              title: 'Estimated Storage Cost',
              subtitle: storageCostEstimate ? `Updated on ${new Date(storageCostEstimateUpdated).toLocaleDateString()}` : 'Loading last updated...'
            }, [storageCostEstimate || '$ ...']),
            Utils.canWrite(accessLevel) && h(InfoRow, { title: 'Bucket Size' }, [bucketSize]),
            div({ style: { paddingBottom: '0.5rem' } }, [h(Link, {
              style: { margin: '1rem 0.5rem', paddingBottom: '1rem' },
              ...Utils.newTabLinkProps,
              href: bucketBrowserUrl(bucketName)
            }, ['Open bucket in browser', icon('pop-out', { size: 12, style: { marginLeft: '0.25rem' } })])])
          ])
        ])
      ]),
      div({ style: { paddingTop: '1rem' } }, [
        div({ style: { borderRadius: 5, backgroundColor: 'white', padding: '0.5rem' } }, [
          h(Collapse, {
            title: h2({ style: Style.dashboard.collapsableHeader }, ['Owners']),
            initialOpenState: ownersPanelOpen,
            titleFirst: true,
            onClick: () => setOwnersPanelOpen(!ownersPanelOpen)
          }, [
            div({ style: { margin: '0.5rem' } },
              _.map(email => {
                return div({ key: email, style: { overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '0.5rem' } }, [
                  h(Link, { href: `mailto:${email}` }, [email])
                ])
              }, owners))
          ])
        ])
      ]),
      !_.isEmpty(authorizationDomain) && div({ style: { paddingTop: '1rem' } }, [
        div({ style: { borderRadius: 5, backgroundColor: 'white', padding: '0.5rem' } }, [
          h(Collapse, {
            title: h2({ style: Style.dashboard.collapsableHeader }, ['Authorization domain']),
            initialOpenState: authDomainPanelOpen,
            titleFirst: true,
            onClick: () => setAuthDomainPanelOpen(!authDomainPanelOpen)
          }, [
            div({ style: { margin: '0.5rem 0.5rem 1rem 0.5rem' } }, [
              'Collaborators must be a member of all of these ',
              h(Link, {
                href: Nav.getLink('groups'),
                ...Utils.newTabLinkProps
              }, 'groups'),
              ' to access this workspace.'
            ]),
            ..._.map(({ membersGroupName }) => div({ style: { margin: '0.5rem', fontWeight: 500 } }, [membersGroupName]), authorizationDomain)
          ])
        ])
      ]),
      div({ style: { paddingTop: '1rem' } }, [
        div({ style: { borderRadius: 5, backgroundColor: 'white', padding: '0.5rem' } }, [
          h(Collapse, {
            title: h2({ style: Style.dashboard.collapsableHeader }, ['Tags',
              h(InfoBox, { style: { marginLeft: '0.25rem' } }, [
                `${getAppName()} is not intended to host personally identifiable information. Do not use any patient identifier including name,
                social security number, or medical record number.`
              ])]),
            initialOpenState: tagsPanelOpen,
            titleFirst: true,
            onClick: () => setTagsPanelOpen(!tagsPanelOpen)
          }, [
            div({ style: { margin: '0.5rem 0.5rem 1rem 0.5rem' } }, [
              !Utils.editWorkspaceError(workspace) && div({ style: { marginBottom: '0.5rem' } }, [
                h(WorkspaceTagSelect, {
                  value: null,
                  placeholder: 'Add a tag',
                  'aria-label': 'Add a tag',
                  onChange: ({ value }) => addTag(value)
                })
              ]),
              div({ style: { display: 'flex', flexWrap: 'wrap', minHeight: '1.5rem' } }, [
                _.map(tag => {
                  return span({ key: tag, style: styles.tag }, [
                    tag,
                    !Utils.editWorkspaceError(workspace) && h(Link, {
                      tooltip: 'Remove tag',
                      disabled: busy,
                      onClick: () => deleteTag(tag),
                      style: { marginLeft: '0.25rem', verticalAlign: 'middle', display: 'inline-block' }
                    }, [icon('times', { size: 14 })])
                  ])
                }, tagsList),
                !!tagsList && _.isEmpty(tagsList) && i(['No tags yet'])
              ])
            ])
          ])
        ])
      ])
    ])
  ])
})

export const navPaths = [
  {
    name: 'workspace-dashboard',
    path: '/workspaces/:namespace/:name',
    component: DashboardAuthContainer,
    title: ({ name }) => `${name} - Dashboard`,
    public: true
  }
]
