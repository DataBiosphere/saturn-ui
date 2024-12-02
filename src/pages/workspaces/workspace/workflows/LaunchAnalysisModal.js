import { Modal, Spinner } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import { Fragment, useState } from 'react';
import { b, div, h, label, p, span } from 'react-hyperscript-helpers';
import { ButtonPrimary, IdContainer, Link } from 'src/components/common';
import { icon } from 'src/components/icons';
import { InfoBox } from 'src/components/InfoBox';
import { ValidatedTextArea } from 'src/components/input';
import { getRegionInfo } from 'src/components/region-common';
import { Ajax } from 'src/libs/ajax';
import { launch } from 'src/libs/analysis';
import colors from 'src/libs/colors';
import { withErrorReporting } from 'src/libs/error';
import { useCancellation, useOnMount } from 'src/libs/react-utils';
import { warningBoxStyle } from 'src/libs/style';
import * as Utils from 'src/libs/utils';
import { commentValidation } from 'src/pages/workspaces/workspace/jobHistory/UpdateUserCommentModal';
import { chooseBaseType, chooseRootType, chooseSetType, processSnapshotTable } from 'src/pages/workspaces/workspace/workflows/EntitySelectionType';

const LaunchAnalysisModal = ({
  onDismiss,
  entityMetadata,
  workspace,
  workspace: {
    workspace: { namespace, name: workspaceName, bucketName, googleProject },
  },
  processSingle,
  entitySelectionModel: { type, selectedEntities, newSetName },
  config,
  config: { rootEntityType },
  useCallCache,
  deleteIntermediateOutputFiles,
  useReferenceDisks,
  retryWithMoreMemory,
  retryMemoryFactor,
  ignoreEmptyOutputs,
  enableResourceMonitoring,
  monitoringScript,
  monitoringImage,
  monitoringImageScript,
  perWorkflowCostCap,
  onSuccess,
}) => {
  const [launching, setLaunching] = useState(undefined);
  const [message, setMessage] = useState(undefined);
  const [launchError, setLaunchError] = useState(undefined);
  const [bucketLocation, setBucketLocation] = useState({});
  const [userComment, setUserComment] = useState(undefined);
  const [userCommentError, setUserCommentError] = useState(undefined);
  const signal = useCancellation();

  useOnMount(() => {
    const loadBucketLocation = withErrorReporting('Error loading bucket location')(async () => {
      const { location, locationType } = await Ajax(signal)
        .Workspaces.workspace(namespace, workspaceName)
        .checkBucketLocation(googleProject, bucketName);
      setBucketLocation({ location, locationType });
    });

    loadBucketLocation();
  });

  const doLaunch = async () => {
    try {
      const baseEntityType = rootEntityType?.slice(0, -4);
      const { selectedEntityType, selectedEntityNames } = Utils.cond(
        [processSingle, () => ({})],
        [type === chooseRootType, () => ({ selectedEntityType: rootEntityType, selectedEntityNames: _.keys(selectedEntities) })],
        [
          type === chooseSetType,
          () => {
            return _.size(selectedEntities) === 1
              ? { selectedEntityType: `${rootEntityType}_set`, selectedEntityNames: _.keys(selectedEntities) }
              : {
                  selectedEntityType: rootEntityType,
                  selectedEntityNames: _.flow(_.flatMap(`attributes.${rootEntityType}s.items`), _.map('entityName'))(selectedEntities),
                };
          },
        ],
        [type === chooseBaseType, () => ({ selectedEntityType: baseEntityType, selectedEntityNames: _.keys(selectedEntities) })],
        [type === processSnapshotTable, () => ({ selectedEntityType: rootEntityType })]
      );
      const { submissionId } = await launch({
        isSnapshot: type === processSnapshotTable,
        workspace,
        config,
        selectedEntityType,
        selectedEntityNames,
        newSetName,
        useCallCache,
        deleteIntermediateOutputFiles,
        useReferenceDisks,
        memoryRetryMultiplier: retryWithMoreMemory ? retryMemoryFactor : undefined,
        userComment: _.trim(userComment),
        ignoreEmptyOutputs,
        // Send monitoring options if monitoring is enabled and the option value is truthy (nonempty string)
        monitoringScript: enableResourceMonitoring && monitoringScript ? monitoringScript : undefined,
        monitoringImage: enableResourceMonitoring && monitoringImage ? monitoringImage : undefined,
        monitoringImageScript: enableResourceMonitoring && monitoringImageScript ? monitoringImageScript : undefined,
        perWorkflowCostCap: perWorkflowCostCap || undefined,
        onProgress: (stage) => {
          setMessage({ createSet: 'Creating set...', launch: 'Launching analysis...', checkBucketAccess: 'Checking bucket access...' }[stage]);
        },
      });
      onSuccess(submissionId);
    } catch (error) {
      setLaunchError(await (error instanceof Response ? error.json().then((data) => data.message) : error.message));
      setMessage(undefined);
    }
  };

  const mergeSets = _.flatMap(`attributes.${rootEntityType}s.items`);
  const entityCount = Utils.cond(
    [processSingle, () => 1],
    [type === processSnapshotTable, () => entityMetadata[rootEntityType].count],
    [type === chooseRootType, () => _.size(selectedEntities)],
    [type === chooseBaseType, () => 1],
    [type === chooseSetType, () => _.flow(mergeSets, _.uniqBy('entityName'))(selectedEntities).length]
  );
  const { location, locationType } = bucketLocation;
  // us-central1 is always used for the location of the lifesciences api metadata.
  // This is separate from the location that the VMs will run in, which is what we're setting here with computeRegion.
  const { flag, regionDescription } = getRegionInfo(location, locationType);

  const onlyConstantInputs = _.every((i) => !i || Utils.maybeParseJSON(i) !== undefined, config.inputs);
  const warnDuplicateAnalyses = onlyConstantInputs && entityCount > 1;

  return h(
    Modal,
    {
      title: !launching ? 'Confirm launch' : 'Launching Analysis',
      onDismiss,
      showCancel: !launching,
      okButton: !launchError
        ? h(
            ButtonPrimary,
            {
              disabled: launching || userCommentError,
              tooltip: userCommentError,
              onClick: () => {
                setLaunching(true);
                doLaunch();
              },
            },
            ['Launch']
          )
        : h(ButtonPrimary, { onClick: onDismiss }, ['OK']),
    },
    [
      div(['Output files will be saved as workspace data in:']),
      div({ style: { margin: '0.5rem 0 1.5rem' } }, [
        location
          ? h(Fragment, [
              span({ style: { marginRight: '0.5rem' } }, [flag]),
              span({ style: { marginRight: '0.5rem' } }, [regionDescription]),
              h(InfoBox, [
                p(['Output (and intermediate) files will be written to your workspace bucket in this region.']),
                p([
                  'Tasks within your workflow might additionally move or copy the data elsewhere. You should carefully vet the workflows you run if region requirements are a concern.',
                ]),
                p(['Note that metadata about this run will be stored in the US.']),
              ]),
            ])
          : 'Loading...',
      ]),
      div([
        'Running workflows will generate cloud charges. ',
        h(InfoBox, [
          p([
            'If you run a large workflow or a large number of small workflows, you may generate significant cloud costs ',
            'for compute, disks, and network egress charges. When your workflow stages complete, the intermediate/output results ',
            'will generate storage costs.',
          ]),
        ]),
      ]),
      div({ style: { marginTop: '0.25rem' } }, [
        h(
          Link,
          {
            style: { verticalAlign: 'top' },
            href: 'https://support.terra.bio/hc/en-us/articles/360037862771',
            ...Utils.newTabLinkProps,
          },
          ['How much does my workflow cost?', icon('pop-out', { size: 12, style: { marginLeft: '0.25rem' } })]
        ),
      ]),
      div({ style: { marginTop: '0.25rem' } }, [
        h(
          Link,
          {
            style: { verticalAlign: 'top' },
            href: 'https://support.terra.bio/hc/en-us/articles/360057589931',
            ...Utils.newTabLinkProps,
          },
          ['Set up budget alert', icon('pop-out', { size: 12, style: { marginLeft: '0.25rem' } })]
        ),
      ]),
      h(IdContainer, [
        (id) =>
          div({ style: { margin: '1.5rem 0' } }, [
            label({ htmlFor: id, style: { display: 'block' } }, ['Describe your submission (optional):']),
            ValidatedTextArea({
              inputProps: {
                id,
                value: userComment,
                onChange: (v) => commentValidation(v, setUserComment, setUserCommentError),
                placeholder: 'Enter comment for the submission',
                style: { height: 100, marginTop: '0.5rem' },
              },
              error: userCommentError,
            }),
          ]),
      ]),
      warnDuplicateAnalyses
        ? div(
            {
              style: { ...warningBoxStyle, fontSize: 14, display: 'flex', flexDirection: 'column' },
            },
            [
              div({ style: { display: 'flex', flexDirection: 'row', alignItems: 'center' } }, [
                icon('warning-standard', { size: 19, style: { color: colors.warning(), flex: 'none', marginRight: '0.5rem' } }),
                'Duplicate Analysis Warning',
              ]),
              div({ style: { fontWeight: 'normal', marginTop: '0.5rem' } }, [
                'This will launch ',
                b([entityCount]),
                ' analyses, but all of the inputs are constant. This is likely to result in re-calculation of the same result multiple times.',
              ]),
            ]
          )
        : div({ style: { margin: '1rem 0' } }, ['This will launch ', b([entityCount]), entityCount === 1 ? ' analysis.' : ' analyses.']),
      type === chooseSetType &&
        entityCount !== mergeSets(selectedEntities).length &&
        div(
          {
            style: { fontStyle: 'italic', marginTop: '0.5rem' },
          },
          ['(Duplicate entities are only processed once.)']
        ),
      message && div({ style: { display: 'flex' } }, [h(Spinner, { style: { marginRight: '0.5rem' } }), message]),
      div(
        {
          style: { color: colors.danger(), overflowWrap: 'break-word' },
          'aria-live': 'assertive',
          'aria-relevant': 'all',
        },
        [launchError]
      ),
    ]
  );
};

export default LaunchAnalysisModal;
