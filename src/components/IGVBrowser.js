import _ from 'lodash/fp';
import { Fragment, useRef, useState } from 'react';
import { div, h } from 'react-hyperscript-helpers';
import { ButtonOutline, Link } from 'src/components/common';
import { getUserProjectForWorkspace, parseGsUri } from 'src/components/data/data-utils';
import { centeredSpinner, icon } from 'src/components/icons';
import IGVAddTrackModal from 'src/components/IGVAddTrackModal';
import { Ajax } from 'src/libs/ajax';
import { saToken } from 'src/libs/ajax/GoogleStorage';
import colors from 'src/libs/colors';
import { reportError, withErrorReporting } from 'src/libs/error';
import { useCancellation, useOnMount } from 'src/libs/react-utils';
import { knownBucketRequesterPaysStatuses, requesterPaysProjectStore } from 'src/libs/state';
import * as Utils from 'src/libs/utils';
import { RequesterPaysModal } from 'src/workspaces/common/requester-pays/RequesterPaysModal';

// format for selectedFiles prop: [{ filePath, indexFilePath } }]
const IGVBrowser = ({ selectedFiles, refGenome: { genome, reference }, workspace, onDismiss }) => {
  const [loadingIgv, setLoadingIgv] = useState(true);
  const [requesterPaysModal, setRequesterPaysModal] = useState(null);
  const [showAddTrackModal, setShowAddTrackModal] = useState(false);
  const containerRef = useRef();
  const igvLibrary = useRef();
  const igvBrowser = useRef();
  const signal = useCancellation();

  const addTracks = withErrorReporting('Unable to add tracks')(async (tracks) => {
    // Select one file per each bucket represented in the tracks list.
    const bucketExemplars = _.flow(
      _.map(_.get('url')),
      _.uniqBy((url) => {
        const [bucket] = parseGsUri(url);
        return bucket;
      })
    )(tracks);

    // Learn the requester pays status of each bucket.
    // Requesting a file will store its requester pays status in knownBucketRequesterPaysStatuses.
    const isRequesterPays = await Promise.all(
      _.map(async (url) => {
        const [bucket, file] = parseGsUri(url);

        if (knownBucketRequesterPaysStatuses.get()[bucket] === undefined) {
          try {
            await Ajax(signal).Buckets.getObject(workspace.workspace.googleProject, bucket, file, { fields: 'kind' });
          } catch (e) {
            if (!e.requesterPaysError) {
              throw e;
            }
          }
        }
        return knownBucketRequesterPaysStatuses.get()[bucket];
      }, bucketExemplars)
    );

    // If any bucket is requester pays, files in that bucket will need to have a user project included in the request.
    let userProject;
    if (_.some(_.identity, isRequesterPays)) {
      // Check if the user can bill to the current workspace.
      userProject = await getUserProjectForWorkspace(workspace);

      // If not, prompt to select a workspace to bill to.
      if (!userProject) {
        userProject = await new Promise((resolve, reject) => {
          setRequesterPaysModal(
            h(RequesterPaysModal, {
              onDismiss: () => {
                setRequesterPaysModal(null);
                reject(new Error('No billing workspace selected.'));
              },
              onSuccess: (selectedGoogleProject) => {
                setRequesterPaysModal(null);
                requesterPaysProjectStore.set(selectedGoogleProject);
                resolve(selectedGoogleProject);
              },
            })
          );
        });
      }
    }

    _.forEach(({ name, url, indexURL }) => {
      const [bucket] = parseGsUri(url);
      const userProjectParam = { userProject: knownBucketRequesterPaysStatuses.get()[bucket] ? userProject : undefined };

      igvBrowser.current.loadTrack({
        name: name || `${_.last(url.split('/'))} (${url})`,
        url: Utils.mergeQueryParams(userProjectParam, url),
        indexURL: indexURL ? Utils.mergeQueryParams(userProjectParam, indexURL) : undefined,
      });
    }, tracks);
  });

  useOnMount(() => {
    const igvSetup = async () => {
      try {
        const { default: igv } = await import('igv');
        igvLibrary.current = igv;

        const options = {
          genome,
          reference,
          tracks: [],
        };

        igv.setGoogleOauthToken(() => saToken(workspace.workspace.googleProject));
        igvBrowser.current = await igv.createBrowser(containerRef.current, options);

        const initialTracks = _.map(({ filePath, indexFilePath }) => ({ url: filePath, indexURL: indexFilePath }), selectedFiles);
        addTracks(initialTracks);
      } catch (e) {
        reportError('Error loading IGV.js', e);
      } finally {
        setLoadingIgv(false);
      }
    };

    igvSetup();

    return () => !!igvLibrary.current && igvLibrary.current.removeAllBrowsers();
  });

  return h(Fragment, [
    div({ style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.5rem 0' } }, [
      h(Link, { onClick: onDismiss }, [icon('arrowLeft', { style: { marginRight: '1ch' } }), 'Back to data table']),
      h(
        ButtonOutline,
        {
          disabled: loadingIgv,
          onClick: () => setShowAddTrackModal(true),
        },
        ['Add track']
      ),
    ]),
    div(
      {
        ref: containerRef,
        style: {
          overflowY: 'auto',
          padding: '10px 0',
          margin: 8,
          border: `1px solid ${colors.dark(0.25)}`,
        },
      },
      [loadingIgv && centeredSpinner()]
    ),
    requesterPaysModal,
    showAddTrackModal &&
      h(IGVAddTrackModal, {
        onDismiss: () => setShowAddTrackModal(false),
        onSubmitTrack: (track) => {
          setShowAddTrackModal(false);
          addTracks([track]);
        },
      }),
  ]);
};

export default IGVBrowser;
