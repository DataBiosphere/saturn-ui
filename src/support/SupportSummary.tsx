import ReactJson from '@microlink/react-json-view';
import React, { useEffect, useState } from 'react';
import { FullyQualifiedResourceId } from 'src/libs/ajax/SamResources';
import colors from 'src/libs/colors';
import { reportError } from 'src/libs/error';
import { ResourceTypeSummaryProps } from 'src/support/SupportResourceType';

export const SupportSummary = (props: ResourceTypeSummaryProps) => {
  const [summaryInfo, setSummaryInfo] = useState<object>();
  const [errorMessage, setErrorMessage] = useState<string>('');

  const resourceId = props.fqResourceId.resourceId;
  const fqResourceId = props.fqResourceId;
  const loadSupportSummaryFn = props.loadSupportSummaryFn;
  const displayName = props.displayName;

  function clear() {
    setErrorMessage('');
    setSummaryInfo(undefined);
  }

  useEffect(() => {
    async function loadSupportSummary(id: FullyQualifiedResourceId) {
      if (loadSupportSummaryFn) {
        return loadSupportSummaryFn(id);
      }
      // throw error here because this component should not be used without a summary function
      throw new Error('No support summary function provided');
    }

    const loadSummary = async () => {
      clear();
      if (resourceId) {
        try {
          setSummaryInfo(await loadSupportSummary(fqResourceId));
        } catch (e) {
          if (e instanceof Response && e.status === 404) {
            setErrorMessage(`${displayName} not found`);
          } else if (e instanceof Response && e.status === 403) {
            setErrorMessage(`You do not have permission to view ${displayName} summary information or are not on VPN`);
          } else {
            await reportError(`Error loading ${displayName} summary`, e);
          }
        }
      }
    };

    loadSummary();
  }, [fqResourceId, resourceId, loadSupportSummaryFn, displayName]);

  return (
    <>
      {!!errorMessage && <div style={{ color: colors.danger(), marginLeft: '1rem' }}>{errorMessage}</div>}
      {!!summaryInfo && (
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
            {props.displayName} Summary
          </div>
          <ReactJson
            src={summaryInfo}
            name={false}
            style={{ marginLeft: '1rem', border: '1px solid black', padding: '1rem' }}
          />
        </>
      )}
    </>
  );
};
