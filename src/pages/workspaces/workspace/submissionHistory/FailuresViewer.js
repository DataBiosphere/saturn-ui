import ReactJson from '@microlink/react-json-view';
import { Modal } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import { h } from 'react-hyperscript-helpers';

export const FailuresViewer = ({ failures }) => {
  const restructureFailures = (failuresArray) => {
    const filtered = _.filter(({ message }) => !_.isEmpty(message) && !message.startsWith('Will not start job'), failuresArray);
    const sizeDiff = failuresArray.length - filtered.length;
    const newMessage =
      sizeDiff > 0
        ? [
            {
              message: `${sizeDiff} jobs were queued in Cromwell but never sent to the cloud backend due to failures elsewhere in the workflow`,
            },
          ]
        : [];
    const simplifiedFailures = [...filtered, ...newMessage];

    return _.map(
      ({ message, causedBy }) => ({
        message,
        ...(!_.isEmpty(causedBy) ? { causedBy: restructureFailures(causedBy) } : {}),
      }),
      simplifiedFailures
    );
  };

  return h(ReactJson, {
    style: { whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
    name: false,
    collapsed: 4,
    enableClipboard: false,
    displayDataTypes: false,
    displayObjectSize: false,
    src: restructureFailures(failures),
  });
};

export const FailuresModal = ({ callFqn, index, attempt, failures, onDismiss }) => {
  return h(
    Modal,
    {
      title: 'Messages',
      onDismiss,
      showButtons: false,
      showX: true,
      width: '800px',
    },
    [`Failures in ${callFqn} / index ${index} / attempt ${attempt}`, h(FailuresViewer, { failures })]
  );
};
