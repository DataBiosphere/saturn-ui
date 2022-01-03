import _ from 'lodash/fp'
import { useEffect, useState } from 'react'
import { div, h } from 'react-hyperscript-helpers'
import { Clickable, Link } from 'src/components/common'
import FooterWrapper from 'src/components/FooterWrapper'
import { centeredSpinner, wdlIcon } from 'src/components/icons'
import { libraryTopMatter } from 'src/components/library-common'
import broadSquare from 'src/images/library/code/broad-square.svg'
import dockstoreLogo from 'src/images/library/code/dockstore.svg'
import { Ajax } from 'src/libs/ajax'
import colors from 'src/libs/colors'
import { getConfig } from 'src/libs/config'
import { withErrorReporting } from 'src/libs/error'
import { getAppName, returnParam } from 'src/libs/logos'
import { useCancellation, useOnMount } from 'src/libs/react-utils'
import * as StateHistory from 'src/libs/state-history'
import * as Style from 'src/libs/style'
import { withBusyState } from 'src/libs/utils'


const styles = {
  header: {
    fontSize: 22, color: colors.dark(), fontWeight: 500, lineHeight: '22px',
    marginBottom: '1rem'
  }
}

export const MethodCard = ({ method: { name, synopsis }, ...props }) => {
  return h(Clickable, {
    ...props,
    style: {
      ...Style.elements.card.container,
      backgroundColor: 'white',
      width: 390, height: 140,
      padding: undefined,
      margin: '0 30px 27px 0',
      position: 'relative'
    }
  }, [
    div({ style: { flex: 'none', padding: '15px 20px', height: 140 } }, [
      div({ style: { color: colors.accent(), fontSize: 16, lineHeight: '20px', height: 40, marginBottom: 7 } }, [name]),
      div({ style: { lineHeight: '20px', ...Style.noWrapEllipsis, whiteSpace: 'pre-wrap', height: 60 } }, [synopsis])
    ]),
    wdlIcon({ style: { position: 'absolute', top: 0, right: 8 } })
  ])
}

const LogoTile = ({ logoFile, ...props }) => {
  return div(_.merge({
    style: {
      flexShrink: 0,
      backgroundImage: `url(${logoFile})`,
      backgroundRepeat: 'no-repeat', backgroundPosition: 'center',
      backgroundSize: 27,
      width: 37, height: 37,
      marginRight: 13
    }
  }, props))
}

export const DockstoreTile = () => {
  return div({ style: { display: 'flex' } }, [
    h(LogoTile, { logoFile: dockstoreLogo, style: { backgroundColor: 'white' } }),
    div([
      h(Link, {
        href: `${getConfig().dockstoreUrlRoot}/search?_type=workflow&descriptorType=WDL&searchMode=files`,
        style: { color: colors.accent(1.1) } // For a11y, we need at least 4.5:1 contrast against the gray background
      }, 'Dockstore'),
      div(['Browse WDL workflows in Dockstore, an open platform used by the GA4GH for sharing Docker-based workflows'])
    ])
  ])
}

export const MethodRepoTile = () => {
  return div({ style: { display: 'flex' } }, [
    h(LogoTile, { logoFile: broadSquare, style: { backgroundSize: 37 } }),
    div([
      h(Link, {
        href: `${getConfig().firecloudUrlRoot}/?return=${returnParam()}#methods`,
        style: { color: colors.accent(1.1) } // For a11y, we need at least 4.5:1 contrast agaisnst the gray background
      }, 'Broad Methods Repository'),
      div([`Use Broad workflows in ${getAppName()}. Share your own, or choose from > 700 public workflows`])
    ])
  ])
}

const Code = () => {
  const signal = useCancellation()
  const stateHistory = StateHistory.get()
  const [featuredList, setFeaturedList] = useState(stateHistory.featuredList)
  const [methods, setMethods] = useState(stateHistory.methods)
  const [loading, setLoading] = useState(false)
  useOnMount(() => {
    const loadData = _.flow(
      withErrorReporting('Error loading workflows'),
      withBusyState(setLoading)
    )(async () => {
      const [newFeaturedList, newMethods] = await Promise.all([
        fetch(`${getConfig().firecloudBucketRoot}/featured-methods.json`, { signal }).then(res => res.json()),
        Ajax(signal).Methods.list({ namespace: 'gatk' })
      ])
      setFeaturedList(newFeaturedList)
      setMethods(newMethods)
    })
    loadData()
  })
  useEffect(() => {
    StateHistory.update({ featuredList, methods })
  }, [featuredList, methods])

  const featuredMethods = _.flow(
    _.map(({ namespace, name }) => _.maxBy('snapshotId', _.filter({ namespace, name }, methods))),
    _.compact
  )(featuredList)

  return h(FooterWrapper, { alwaysShow: true }, [
    libraryTopMatter('code & workflows'),
    div({ role: 'main', style: { flexGrow: 1 } }, [
      div({ style: { display: 'flex', flex: 1 } }, [
        div({ style: { flex: 1, margin: '30px 0 30px 40px' } }, [
          div({ style: styles.header }, 'GATK4 Best Practices workflows'),
          div({ style: { display: 'flex', flexWrap: 'wrap' } }, [
            _.map(method => {
              const { namespace, name } = method
              return h(MethodCard, {
                key: `${namespace}/${name}`,
                href: `${getConfig().firecloudUrlRoot}/?return=${returnParam()}#methods/${namespace}/${name}/`,
                method
              })
            }, featuredMethods)
          ])
        ]),
        div({ style: { width: 385, padding: '25px 30px', backgroundColor: colors.light(), lineHeight: '20px' } }, [
          div({ style: { ...styles.header, fontSize: 16 } }, 'FIND ADDITIONAL WORKFLOWS'),
          h(DockstoreTile),
          div({ style: { marginTop: 40 } }, [
            h(MethodRepoTile)
          ])
        ])
      ]),
      loading && centeredSpinner()
    ])
  ])
}


export const navPaths = [
  {
    name: 'library-code',
    path: '/library/code',
    component: Code,
    public: false,
    title: 'Code & Workflows'
  }
]
