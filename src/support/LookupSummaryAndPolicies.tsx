import { ButtonPrimary } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import React, { useState } from 'react';
import { TextInput } from 'src/components/input';
import colors from 'src/libs/colors';
import * as Nav from 'src/libs/nav';
import { ResourcePolicies } from 'src/support/ResourcePolicies';
import { ResourceTypeSummaryProps, supportResources } from 'src/support/SupportResourceType';
import { SupportSummary } from 'src/support/SupportSummary';

export const LookupSummaryAndPolicies = (props: ResourceTypeSummaryProps) => {
  const { query } = Nav.useRoute();
  const [resourceId, setResourceId] = useState<string>(props.fqResourceId.resourceId);

  function submit() {
    Nav.updateSearch({ ...query, resourceId: resourceId || undefined });
  }

  // event hook to clear the resourceId when resourceType changes
  React.useEffect(() => {
    setResourceId('');
  }, [props.fqResourceId.resourceTypeName]);

  // the resourceType may be configured to skip policy retrieval/display
  const displayPolicies = !_.find((res) => res.resourceType === props.fqResourceId.resourceTypeName, supportResources)
    ?.skipPolicies;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div
          style={{
            color: colors.dark(),
            fontSize: 18,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            marginLeft: '1rem',
          }}
        >
          {props.displayName}
        </div>
        <TextInput
          style={{ marginRight: '1rem', marginLeft: '1rem' }}
          placeholder={`Enter ${props.displayName} ID`}
          onChange={(newResourceId) => {
            setResourceId(newResourceId);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              submit();
            }
          }}
          value={resourceId}
        />
        <ButtonPrimary onClick={() => submit()}>Load</ButtonPrimary>
      </div>
      {!!props.loadSupportSummaryFn && <SupportSummary {...props} />}
      {displayPolicies && <ResourcePolicies {...props} />}
    </>
  );
};
