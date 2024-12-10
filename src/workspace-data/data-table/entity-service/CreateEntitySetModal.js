import { Modal } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import { Fragment, useState } from 'react';
import { div, h, label } from 'react-hyperscript-helpers';
import { ButtonPrimary, IdContainer, spinnerOverlay } from 'src/components/common';
import { icon } from 'src/components/icons';
import { TextInput } from 'src/components/input';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import colors from 'src/libs/colors';
import { reportError } from 'src/libs/error';
import * as Utils from 'src/libs/utils';

export const CreateEntitySetModal = ({ entityType, entityNames, workspaceId: { namespace, name: workspaceName }, onDismiss, onSuccess }) => {
  const [name, setName] = useState('');
  const [nameInputTouched, setNameInputTouched] = useState(false);
  const nameError =
    nameInputTouched &&
    Utils.cond(
      [!name, () => 'A name for the set is required.'],
      [!/^[A-Za-z0-9_-]+$/.test(name), () => 'Set name may only contain alphanumeric characters, underscores, dashes, and periods.']
    );

  const [isBusy, setIsBusy] = useState();

  const createSet = async () => {
    setIsBusy(true);
    try {
      await Workspaces()
        .workspace(namespace, workspaceName)
        .createEntity({
          name,
          entityType: `${entityType}_set`,
          attributes: {
            [`${entityType}s`]: {
              itemsType: 'EntityReference',
              items: _.map((entityName) => ({ entityType, entityName }), entityNames),
            },
          },
        });
      onSuccess();
    } catch (e) {
      onDismiss();
      reportError('Unable to create set.', e);
    }
  };

  return h(
    Modal,
    {
      title: `Create a ${entityType} set`,
      onDismiss,
      okButton: h(
        ButtonPrimary,
        {
          disabled: !name || nameError,
          tooltip: nameError,
          onClick: createSet,
        },
        ['Save']
      ),
    },
    [
      div({ style: { display: 'flex', flexDirection: 'column', marginBottom: '1rem' } }, [
        h(IdContainer, [
          (id) =>
            h(Fragment, [
              label({ htmlFor: id, style: { fontWeight: 'bold', marginBottom: '0.5rem' } }, 'Set name (required)'),
              div({ style: { position: 'relative', display: 'flex', alignItems: 'center' } }, [
                h(TextInput, {
                  id,
                  value: name,
                  placeholder: 'Enter a name for the set',
                  style: nameError
                    ? {
                        paddingRight: '2.25rem',
                        border: `1px solid ${colors.danger()}`,
                      }
                    : undefined,
                  onChange: (value) => {
                    setName(value);
                    setNameInputTouched(true);
                  },
                }),
                nameError &&
                  icon('error-standard', {
                    size: 24,
                    style: {
                      position: 'absolute',
                      right: '0.5rem',
                      color: colors.danger(),
                    },
                  }),
              ]),
              nameError &&
                div(
                  {
                    'aria-live': 'assertive',
                    'aria-relevant': 'all',
                    style: {
                      marginTop: '0.5rem',
                      color: colors.danger(),
                    },
                  },
                  nameError
                ),
            ]),
        ]),
      ]),
      isBusy && spinnerOverlay,
    ]
  );
};
