import { Modal } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import { useState } from 'react';
import { h } from 'react-hyperscript-helpers';
import { ButtonPrimary } from 'src/components/common';
import { ValidatedTextArea } from 'src/components/input';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';

/**
 * Stores the new comment, validating its length.
 *
 * @param {String} newComment the user-supplied comment
 * @param {Function} updateComment the method to store the comment
 * @param {Function} updateError the method to display or clear an error message
 */
export const commentValidation = (newComment, updateComment, updateError) => {
  // This is the server-side limit for the API. We are doing client-side validation also in order to present
  // a friendlier user experience (in particular for the Launch Workflows dialog, where a server-side error can
  // occur for a variety of reasons). If the server-side limit changes, it must also be updated here.
  const maxCommentLength = 1000;
  updateComment(newComment);
  updateError(newComment.length > maxCommentLength ? `The comment can be at most ${maxCommentLength} characters.` : undefined);
};

/**
 * A modal dialog for updating the Workspace Comment field.
 */
const UpdateUserCommentModal = ({ onDismiss, onSuccess, workspace: { namespace, name }, submissionId, userComment }) => {
  const [updating, setUpdating] = useState(undefined);
  const [updateComment, setUpdateComment] = useState(userComment);
  const [userCommentError, setUserCommentError] = useState(undefined);

  const doUpdate = async () => {
    try {
      const trimComment = _.trim(updateComment);
      await Workspaces().workspace(namespace, name).submission(submissionId).updateUserComment(trimComment);
      onSuccess(trimComment);
      onDismiss();
    } catch (error) {
      setUserCommentError(await (error instanceof Response ? error.json().then((data) => data.message) : error.message));
      setUpdating(false);
    }
  };

  return h(
    Modal,
    {
      title: !updating ? 'Comment' : 'Updating Comment',
      onDismiss,
      showCancel: !updating,
      okButton: h(
        ButtonPrimary,
        {
          disabled: updating || userCommentError,
          tooltip: userCommentError,
          onClick: () => {
            setUpdating(true);
            doUpdate();
          },
        },
        ['Save']
      ),
    },
    [
      ValidatedTextArea({
        inputProps: {
          value: updateComment,
          onChange: (v) => commentValidation(v, setUpdateComment, setUserCommentError),
          'aria-label': 'Enter comment for the submission',
          placeholder: 'Enter comment for the submission',
          style: { height: 100 },
        },
        error: userCommentError,
      }),
    ]
  );
};

export default UpdateUserCommentModal;
