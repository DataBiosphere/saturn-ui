import ReactJson from '@microlink/react-json-view';
import { Modal } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import { Fragment, useState } from 'react';
import { div, h, hr, label } from 'react-hyperscript-helpers';
import { ButtonPrimary, IdContainer, Link, Select } from 'src/components/common';
import ErrorView from 'src/components/ErrorView';
import { icon } from 'src/components/icons';
import { TextInput } from 'src/components/input';
import { breadcrumbHistoryCaret } from 'src/components/job-common';
import colors from 'src/libs/colors';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';

const CallCacheWizard = ({ onDismiss, workflowId, callFqn, index, loadCallCacheDiff, loadCallCacheMetadata }) => {
  /*
   * State setup
   */

  const [otherWorkflowIdTextboxValue, setOtherWorkflowIdTextboxValue] = useState('');
  const [otherWorkflowId, setOtherWorkflowId] = useState();
  const [otherWorkflowMetadata, setOtherWorkflowMetadata] = useState();
  const [otherCallFqnDropdownValue, setOtherCallFqnDropdownValue] = useState();
  const [otherIndexDropdownValue, setOtherIndexDropdownValue] = useState();
  const [otherCallSelected, setOtherCallSelected] = useState(false);
  const [diff, setDiff] = useState();
  const [metadataFetchError, setMetadataFetchError] = useState();
  const [diffError, setDiffError] = useState();

  /*
   * Data Fetchers
   */

  const readCalls = async (otherWf) => {
    try {
      const includeKey = ['end', 'start', 'executionStatus'];
      const excludeKey = [];
      const wf = await loadCallCacheMetadata(otherWf, includeKey, excludeKey);
      setOtherWorkflowMetadata(wf);
    } catch (error) {
      if (error instanceof Response) setMetadataFetchError(await error.text());
      else setMetadataFetchError(error);
    }
  };

  const fetchDiff = async (otherWf, otherCall, otherIx) => {
    try {
      const diff = await loadCallCacheDiff(
        {
          workflowId,
          callFqn,
          index: Number(index),
        },
        {
          workflowId: otherWf,
          callFqn: otherCall,
          index: Number(otherIx),
        }
      );
      setDiff(diff);
    } catch (error) {
      if (error instanceof Response) setDiffError(await error.text());
      else setDiffError(error);
    }
  };

  const otherCallFqnSelectionOptions = _.flow(
    _.keys,
    _.map((name) => ({ value: name, label: name }))
  );

  const resetDiffResult = () => {
    setDiff(undefined);
    setDiffError(undefined);
  };

  const resetCallSelection = () => {
    resetDiffResult();
    setOtherCallFqnDropdownValue(undefined);
    setOtherIndexDropdownValue(undefined);
    setOtherCallSelected(false);
  };

  const resetWorkflowSelection = (value = undefined) => {
    resetCallSelection();
    setOtherWorkflowId(value);
    setOtherWorkflowIdTextboxValue(value);
    setMetadataFetchError(undefined);
  };

  const resetLink = (resetAction) => h(Link, { style: { fontSize: '14px', justifyContent: 'right' }, onClick: resetAction }, ['Reset']);

  /*
   * Page render
   */

  const divider = hr({ style: { width: '100%', marginTop: '2rem', marginBottom: '2rem', border: '1px ridge lightgray' } });

  const step1 = () => {
    return h(Fragment, [
      div({ style: { paddingTop: '0.5rem', fontSize: 16, fontWeight: 500 } }, ['Step 1: Select the workflow you expected to cache from']),
      div({ style: { marginTop: '0.5rem', marginBottom: '1rem', display: 'flex', flexDirection: 'row', alignItems: 'center' } }, [
        h(IdContainer, [
          (id) =>
            h(Fragment, [
              label({ htmlFor: id, style: { paddingRight: '0.5rem' } }, ['Workflow ID:']),
              div({ style: { paddingRight: '0.5rem', flex: '1' } }, [
                h(TextInput, {
                  id,
                  style: Style.codeFont,
                  value: otherWorkflowIdTextboxValue,
                  onChange: setOtherWorkflowIdTextboxValue,
                }),
              ]),
            ]),
        ]),
        h(
          ButtonPrimary,
          {
            disabled: _.isEmpty(otherWorkflowIdTextboxValue),
            onClick: () => {
              resetWorkflowSelection(otherWorkflowIdTextboxValue);
              readCalls(otherWorkflowIdTextboxValue);
            },
          },
          ['Continue']
        ),
      ]),
      metadataFetchError && ['Error loading workflow metadata', h(ErrorView, { error: metadataFetchError })],
    ]);
  };

  const step2 = () => {
    const selectedCallIndex = Utils.cond(
      [otherIndexDropdownValue !== undefined, () => otherIndexDropdownValue],
      [
        otherWorkflowMetadata && otherCallFqnDropdownValue && otherWorkflowMetadata.calls[otherCallFqnDropdownValue].length === 1,
        () => otherWorkflowMetadata.calls[otherCallFqnDropdownValue][0].shardIndex,
      ],
      () => undefined
    );

    const otherCallSucceeded =
      otherWorkflowMetadata &&
      otherCallFqnDropdownValue &&
      selectedCallIndex !== undefined &&
      _.some({ shardIndex: selectedCallIndex, executionStatus: 'Done' }, otherWorkflowMetadata.calls[otherCallFqnDropdownValue]);

    return h(Fragment, [
      div({ style: { display: 'flex', alignItems: 'center', fontSize: 16, fontWeight: 500 } }, [
        div(['Selected workflow B: ']),
        div({ style: { display: 'flex', flexDirection: 'row', alignItems: 'center', flex: '1' } }, [
          div({ style: { marginLeft: '0.5rem', ...Style.codeFont } }, otherWorkflowId),
        ]),
        (otherWorkflowMetadata || metadataFetchError) && resetLink(() => resetWorkflowSelection('')),
      ]),
      div({ style: { paddingTop: '0.5rem', fontSize: 16, fontWeight: 500 } }, [
        'Step 2: Select which call in that workflow you expected to cache from',
      ]),
      otherWorkflowMetadata
        ? div([
            div({ style: { marginTop: '1rem', display: 'flex', flexDirection: 'row', alignItems: 'center' } }, [
              h(IdContainer, [
                (id) =>
                  h(Fragment, [
                    label({ htmlFor: id, style: { paddingRight: '0.5rem' } }, ['Call name:']),
                    div({ style: { flex: '1' } }, [
                      h(Select, {
                        id,
                        isSearchable: false,
                        options: otherCallFqnSelectionOptions(otherWorkflowMetadata.calls),
                        value: otherCallFqnDropdownValue,
                        onChange: (v) => {
                          setOtherIndexDropdownValue(undefined);
                          setOtherCallFqnDropdownValue(v.value);
                        },
                      }),
                    ]),
                  ]),
              ]),
            ]),
            otherCallFqnDropdownValue &&
              div({ style: { marginTop: '0.25rem', marginBottom: '0.5rem', display: 'flex', flexDirection: 'row', alignItems: 'center' } }, [
                h(IdContainer, [
                  (id) =>
                    h(Fragment, [
                      label({ htmlFor: id, style: { paddingRight: '0.5rem' } }, ['Shard Index:']),
                      div({ style: { flex: '1' } }, [
                        Utils.cond(
                          [selectedCallIndex === -1, () => 'N/A (not scattered)'],
                          [
                            _.size(otherWorkflowMetadata.calls[otherCallFqnDropdownValue]) === 1,
                            () => `${otherWorkflowMetadata.calls[otherCallFqnDropdownValue][0].shardIndex} (exactly one shard in scatter)`,
                          ],
                          () => {
                            const options = _.uniqBy(
                              'value',
                              _.map(({ shardIndex: i }) => {
                                return { value: i, label: i };
                              }, otherWorkflowMetadata.calls[otherCallFqnDropdownValue])
                            );
                            return h(Select, {
                              id,
                              isSearchable: false,
                              options,
                              value: otherIndexDropdownValue,
                              onChange: (i) => {
                                setOtherIndexDropdownValue(i.value);
                              },
                            });
                          }
                        ),
                      ]),
                    ]),
                ]),
              ]),
            otherCallFqnDropdownValue &&
              selectedCallIndex !== undefined &&
              !otherCallSucceeded &&
              div({ style: { display: 'flex', alignItems: 'center', marginTop: '0.5rem' } }, [
                icon('warning-standard', { size: 24, style: { color: colors.warning(), marginRight: '0.5rem' } }),
                'This call B is ineligible to call cache from because it did not succeed.',
              ]),
            div({ style: { display: 'flex', justifyContent: 'flex-end' } }, [
              otherCallFqnDropdownValue &&
                selectedCallIndex !== undefined &&
                otherCallSucceeded &&
                h(
                  ButtonPrimary,
                  {
                    onClick: () => {
                      fetchDiff(otherWorkflowId, otherCallFqnDropdownValue, selectedCallIndex);
                      setOtherCallSelected(true);
                    },
                  },
                  ['Continue']
                ),
            ]),
          ])
        : "Loading workflow B's calls...",
    ]);
  };

  const compareDiffs = () => {
    return h(Fragment, [
      div({ style: { paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', fontSize: 16, fontWeight: 500 } }, [
        div(['Selected workflow B: ']),
        div({ style: { display: 'flex', flexDirection: 'row', alignItems: 'center', flex: '1' } }, [
          div({ style: { marginLeft: '0.5rem', ...Style.codeFont } }, otherWorkflowId),
        ]),
        (diff || diffError) && resetLink(() => resetWorkflowSelection('')),
      ]),
      div({ style: { display: 'flex', flexDirection: 'row', alignItems: 'center', fontSize: 16, fontWeight: 500 } }, [
        div(['Selected call B: ']),
        div({ style: { display: 'flex', flexDirection: 'row', alignItems: 'center', flex: '1 1 100px' } }, [
          div({ style: { marginLeft: '0.5rem', ...Style.codeFont } }, [
            otherCallFqnDropdownValue,
            otherIndexDropdownValue !== undefined &&
              h(Fragment, [breadcrumbHistoryCaret, div({ style: { marginLeft: '0.5rem', ...Style.codeFont } }, `index ${otherIndexDropdownValue}`)]),
          ]),
        ]),
        (diff || diffError) && resetLink(() => resetCallSelection()),
      ]),
      divider,
      div({ style: { display: 'flex', alignItems: 'center', fontSize: 16, fontWeight: 500 } }, ['Result: View cache diff']),
      // TODO: Remove nested ternary to align with style guide
      // eslint-disable-next-line no-nested-ternary
      diffError
        ? h(ErrorView, { error: diffError })
        : diff
        ? div({ style: { marginTop: '0.5rem', marginBottom: '0.5rem' } }, [
            'Note: the diff is expressed in terms of hashes of values rather than raw values because it is hashes that determine cache hits.',
            diff.callB &&
              diff.callB.allowResultReuse === false &&
              div({ style: { marginTop: '0.5rem', marginBottom: '0.5rem' } }, [
                icon('warning-standard', { size: 24, style: { color: colors.warning(), marginRight: '0.5rem' } }),
                'Note: call B has allowResultReuse: false, and is ineligible to call cache from.',
                " This can sometimes happen if the WDL task has a 'volatile' marker in its meta section.",
              ]),
            h(ReactJson, {
              style: { whiteSpace: 'pre-wrap', border: 'ridge', padding: '0.5rem' },
              name: false,
              shouldCollapse: ({ name }) => name === 'callA' || name === 'callB',
              enableClipboard: false,
              displayDataTypes: false,
              displayObjectSize: false,
              // This line is re-ordering the diff object to put the hashDifferential first:
              src: { hashDifferential: diff.hashDifferential, ...diff },
            }),
          ])
        : 'Cache diff loading...',
    ]);
  };

  const chooseStep = () => {
    if (!otherWorkflowId || metadataFetchError) {
      return step1();
    }
    if (!otherCallSelected) {
      return step2();
    }
    return compareDiffs();
  };

  return h(
    Modal,
    {
      title: ' Call Cache Miss Debugging Wizard',
      onDismiss,
      width: '850px',
      showButtons: false,
      showX: true,
    },
    [
      div({ style: { marginTop: '2rem', display: 'flex', alignItems: 'center', fontSize: 16, fontWeight: 500 } }, [
        div(['Debugging workflow A: ']),
        div({ style: { display: 'flex', flexDirection: 'row', alignItems: 'center', flex: '1 1 100px' } }, [
          div({ style: { marginLeft: '0.5rem', ...Style.noWrapEllipsis, ...Style.codeFont } }, workflowId),
        ]),
      ]),
      div({ style: { paddingTop: '0.5rem', display: 'flex', flexDirection: 'row', alignItems: 'center', fontSize: 16, fontWeight: 500 } }, [
        div(['Debugging call A: ']),
        div({ style: { display: 'flex', flexDirection: 'row', alignItems: 'center', flex: '1 1 100px' } }, [
          div({ style: { marginLeft: '0.5rem', ...Style.noWrapEllipsis, ...Style.codeFont } }, callFqn),
          index !== undefined &&
            index >= 0 &&
            h(Fragment, [
              breadcrumbHistoryCaret,
              div({ style: { marginLeft: '0.5rem', ...Style.noWrapEllipsis, ...Style.codeFont } }, `index ${index}`),
            ]),
        ]),
      ]),
      divider,
      chooseStep(),
    ]
  );
};

export default CallCacheWizard;
