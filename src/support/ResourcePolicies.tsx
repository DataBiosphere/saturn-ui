import ReactJson from '@microlink/react-json-view';
import React, { useEffect, useState } from 'react';
import { SamResources } from 'src/libs/ajax/SamResources';
import colors from 'src/libs/colors';
import { reportError } from 'src/libs/error';
import { ResourceTypeSummaryProps } from 'src/support/SupportResourceType';

export const ResourcePolicies = (props: ResourceTypeSummaryProps) => {
  const [resourcePolicies, setResourcePolicies] = useState<object>();
  const [errorMessage, setErrorMessage] = useState<string>('');

  function clear() {
    setErrorMessage('');
    setResourcePolicies(undefined);
  }

  useEffect(() => {
    const loadResourcePolicies = async () => {
      clear();
      if (props.fqResourceId.resourceId) {
        try {
          const policies = await SamResources().getResourcePolicies(props.fqResourceId);
          Array.isArray(policies) && policies.length === 0
            ? setErrorMessage('No policies found')
            : setResourcePolicies(policies);
        } catch (e) {
          if (e instanceof Response && (e.status === 404 || e.status === 403)) {
            setErrorMessage(`You do not have permission to view ${props.displayName} policies or are not on VPN`);
          } else {
            await reportError('Error loading resource policies', e);
          }
        }
      }
    };

    loadResourcePolicies();
  }, [props.fqResourceId, props.displayName]);

  return (
    <>
      {!!errorMessage && <div style={{ color: colors.danger(), marginLeft: '1rem' }}>{errorMessage}</div>}
      {!!resourcePolicies && (
        <>
          <div
            style={{
              color: colors.dark(),
              fontSize: 18,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              marginLeft: '1rem',
              marginTop: '1rem',
            }}
          >
            Sam Policies
          </div>
          <ReactJson
            src={resourcePolicies}
            name={false}
            style={{ marginLeft: '1rem', border: '1px solid black', padding: '1rem' }}
          />
        </>
      )}
    </>
  );
};
