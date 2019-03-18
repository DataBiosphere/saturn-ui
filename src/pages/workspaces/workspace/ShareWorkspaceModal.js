import _ from 'lodash/fp'
import { Component, Fragment } from 'react'
import { div, h } from 'react-hyperscript-helpers'
import { buttonPrimary, linkButton, Select, spinnerOverlay } from 'src/components/common'
import { centeredSpinner, icon } from 'src/components/icons'
import { AutocompleteSearch, textInput } from 'src/components/input'
import Modal from 'src/components/Modal'
import TooltipTrigger from 'src/components/TooltipTrigger'
import { ajaxCaller } from 'src/libs/ajax'
import { getUser } from 'src/libs/auth'
import colors from 'src/libs/colors'
import { reportError } from 'src/libs/error'
import * as Forms from 'src/libs/forms'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import validate from 'validate.js'


const styles = {
  searchArea: {
    margin: '0 -1.25rem',
    padding: '0 1.25rem 2rem',
    borderBottom: Style.standardLine
  },
  currentCollaboratorsArea: {
    margin: '0 -1.25rem',
    padding: '0.75rem 1.25rem',
    maxHeight: 550,
    overflowY: 'auto',
    borderBottom: Style.standardLine
  },
  pending: {
    textTransform: 'uppercase', fontWeight: 500,
    color: colors.orange[0]
  },
  roleSelect: base => ({
    ...base,
    width: 200,
    marginTop: '0.25rem'
  }),
  suggestionContainer: {
    display: 'flex', alignItems: 'center',
    padding: '0.5rem 1rem',
    borderBottom: `1px solid ${colors.gray[4]}`
  },
  suggestion: {
    flex: 1
  }
}


export default ajaxCaller(class ShareWorkspaceModal extends Component {
  constructor(props) {
    super(props)
    this.state = {
      shareSuggestions: undefined,
      originalAcl: [],
      acl: [],
      loaded: false,
      searchValue: ''
    }
  }

  render() {
    const { onDismiss } = this.props
    const { acl, shareSuggestions, groups, loaded, searchValue, working, updateError, accessLevel } = this.state
    const searchValueInvalid = !!validate({ searchValue }, { searchValue: { email: true } })

    const suggestions = _.flow(
      _.map('groupEmail'),
      _.concat(shareSuggestions),
      _.uniq
    )(groups)

    const canAdd = value => value !== searchValue || !searchValueInvalid

    return h(Modal, {
      title: 'Share Workspace',
      width: 550,
      okButton: buttonPrimary({ onClick: () => this.save() }, ['Save']),
      onDismiss
    }, [
      Forms.requiredFormLabel('User email'),
      h(AutocompleteSearch, {
        autoFocus: true,
        placeholder: 'Add people or groups',
        value: searchValue,
        onChange: v => this.setState({ searchValue: v }),
        renderSuggestion: suggestion => div({ style: styles.suggestionContainer }, [
          div({ style: { flex: 1 } }, [
            !canAdd(suggestion) && h(TooltipTrigger, {
              content: 'Not a valid email address'
            }, [
              icon('warning-standard', {
                style: { color: colors.red[0], marginRight: '0.5rem' }
              })
            ]),
            suggestion
          ])
        ]),
        onSuggestionSelected: selection => {
          this.setState({ searchValue: selection })
        },
        onKeyDown: e => {
          // 27 = Escape
          if (e.which === 27 && !!searchValue) {
            this.setState({ searchValue: '' })
            e.stopPropagation()
          }
        },
        suggestions: _.difference(suggestions, _.map('email', acl)),
        style: { fontSize: 16 },
        renderInputComponent: textInput,
        theme: { suggestion: { padding: 0 } }
      }),
      Forms.formLabel('Role'),
      div({ style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } }, [h(Select, {
        styles: { container: styles.roleSelect },
        isSearchable: false,
        getOptionLabel: ({ value }) => Utils.normalizeLabel(value),
        value: accessLevel,
        onChange: ({ value }) => this.setState({ accessLevel: value }),
        options: ['READER', 'WRITER', 'OWNER']
      }),
      h(buttonPrimary, {
        onClick: () => this.addAcl(searchValue, accessLevel),
        disabled: accessLevel === undefined || searchValue === undefined
      }, ['Add User'])]),
      div({ style: styles.currentCollaboratorsArea }, [
        div({ style: Style.elements.sectionHeader }, ['Current Collaborators']),
        ...acl.map(this.renderCollaborator),
        !loaded && centeredSpinner()
      ]),
      updateError && div({ style: { marginTop: '1rem' } }, [
        div({}, ['An error occurred:']),
        updateError
      ]),
      working && spinnerOverlay
    ])
  }

  addAcl(email, accessLevel) {
    const { acl } = this.state
    this.setState({ acl: _.concat(acl, [{ email, accessLevel, pending: false }]), searchValue: '' })
  }

  renderCollaborator = ({ email, accessLevel, pending }, index) => {
    const POAccessLevel = 'PROJECT_OWNER'
    const isPO = accessLevel === POAccessLevel
    const isMe = email === getUser().email
    const { acl } = this.state

    return div({
      style: { display: 'flex', padding: '0.5rem', borderTop: index && `1px solid ${colors.gray[4]}` }
    }, [
      div({
        style: { flex: 1 }
      }, [
        div({}, [email]),
        pending && div({ style: styles.pending }, ['Pending']),
        isPO ?
          h(Select, {
            styles: { container: styles.roleSelect },
            isDisabled: true,
            value: POAccessLevel,
            options: [{ value: POAccessLevel, label: Utils.normalizeLabel(POAccessLevel) }]
          }) :
          h(Select, {
            styles: { container: styles.roleSelect },
            isSearchable: false,
            isDisabled: isMe,
            menuPlacement: index < (acl.length - 2) ? 'bottom' : 'top',
            getOptionLabel: ({ value }) => Utils.normalizeLabel(value),
            value: accessLevel,
            onChange: ({ value }) => this.setState({ acl: _.set([index, 'accessLevel'], value, acl) }),
            options: ['READER', 'WRITER', 'OWNER']
          })
      ]),
      !isPO && !isMe && linkButton({
        onClick: () => this.setState({ acl: _.remove({ email }, acl) })
      }, [icon('minus-circle', { size: 24 })])
    ])
  }

  async componentDidMount() {
    const { namespace, name, onDismiss, ajax: { Workspaces, Groups } } = this.props

    try {
      const [{ acl }, shareSuggestions, groups] = await Promise.all([
        Workspaces.workspace(namespace, name).getAcl(),
        Workspaces.getShareLog(),
        Groups.list()
      ])

      const fixedAcl = _.flow(
        _.toPairs,
        _.map(([email, { pending, accessLevel }]) => ({ email, pending, accessLevel })),
        _.sortBy(x => -Utils.workspaceAccessLevels.indexOf(x.accessLevel))
      )(acl)

      this.setState({
        acl: fixedAcl,
        originalAcl: fixedAcl,
        groups,
        shareSuggestions,
        loaded: true
      })
    } catch (error) {
      onDismiss()
      reportError('Error looking up collaborators', error)
    }
  }

  async save() {
    const { namespace, name, onDismiss, ajax: { Workspaces } } = this.props
    const { acl, originalAcl } = this.state

    const aclEmails = _.map('email', acl)
    const needsDelete = _.remove(entry => aclEmails.includes(entry.email), originalAcl)

    const aclUpdates = _.concat(
      _.flow(
        _.remove({ accessLevel: 'PROJECT_OWNER' }),
        _.map(({ email, accessLevel }) => ({
          email, accessLevel,
          canShare: Utils.isOwner(accessLevel),
          canCompute: Utils.canWrite(accessLevel)
        }))
      )(acl),
      _.map(({ email }) => ({ email, accessLevel: 'NO ACCESS' }), needsDelete)
    )

    try {
      this.setState({ working: true })
      await Workspaces.workspace(namespace, name).updateAcl(aclUpdates)
      onDismiss()
    } catch (error) {
      this.setState({ updateError: await error.text(), working: false })
    }
  }
})
