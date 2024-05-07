import { ButtonPrimary } from '@terra-ui-packages/components';
import { Fragment, useState } from 'react';
import { div, h } from 'react-hyperscript-helpers';
import { TextArea, TextInput } from 'src/components/input';
import { Ajax } from 'src/libs/ajax';
import colors from 'src/libs/colors';
import * as Nav from 'src/libs/nav';
import { useOnMount } from 'src/libs/react-utils';
import { ResourceTypeSummaryProps } from 'src/support/SupportResourceType';

export const ManagedGroupSummary = (props: ResourceTypeSummaryProps) => {
  const { query } = Nav.useRoute();
  const [groupName, setGroupName] = useState(props.fqResourceId.resourceId || '');
  const [groupSummaryInfo, setGroupSummaryInfo] = useState(undefined);
  const [groupPolicies, setGroupPolicies] = useState(undefined);

  const submit = async (): Promise<void> => {
    const groupSummaryInfo = await Ajax().Groups.group(groupName).getSupportSummary();
    const groupPolicies = await Ajax().SamResources.getResourcePolicies(props.fqResourceId);
    setGroupSummaryInfo(groupSummaryInfo);
    setGroupPolicies(groupPolicies);
  };

  useOnMount(() => {
    !!props.fqResourceId.resourceId && submit();
  });

  return h(Fragment, [
    div({ style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' } }, [
      div(
        {
          style: {
            color: colors.dark(),
            fontSize: 18,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            marginLeft: '1rem',
          },
        },
        [props.displayName]
      ),
      h(TextInput, {
        placeholder: 'Enter group name',
        'aria-label': 'Enter group name',
        onChange: (newFilter) => {
          Nav.updateSearch({ ...query, resourceName: newFilter || undefined });
          setGroupName(newFilter);
        },
        value: props.fqResourceId.resourceId || '',
      }),
      h(ButtonPrimary, { onClick: () => submit() }, ['Load']),
    ]),
    div(
      {
        style: {
          color: colors.dark(),
          fontSize: 18,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          marginLeft: '1rem',
        },
      },
      'Summary'
    ),
    h(TextArea, { value: JSON.stringify(groupSummaryInfo, null, 2), readOnly: true, autosize: true }),
    div(
      {
        style: {
          color: colors.dark(),
          fontSize: 18,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          marginLeft: '1rem',
        },
      },
      'Sam Policies'
    ),
    h(TextArea, { value: JSON.stringify(groupPolicies, null, 2), readOnly: true, autosize: true }),
  ]);
};
