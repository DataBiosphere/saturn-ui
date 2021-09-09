import _ from 'lodash/fp'
import { Fragment } from 'react'
import { h } from 'react-hyperscript-helpers'
import { Ajax } from 'src/libs/ajax'
import { withErrorReporting } from 'src/libs/error'
import { clearNotification, notify } from 'src/libs/notifications'
import { pfbImportJobStore } from 'src/libs/state'
import * as Utils from 'src/libs/utils'


const ImportStatus = () => {
  const jobs = Utils.useStore(pfbImportJobStore)
  return h(Fragment, _.map(job => h(ImportStatusItem, {
    job,
    onDone: () => {
      pfbImportJobStore.update(_.reject({ jobId: job.jobId }))
    }
  }), jobs))
}

const ImportStatusItem = ({ job: { targetWorkspace, jobId }, onDone }) => {
  const signal = Utils.useCancellation()

  Utils.usePollingEffect(
    withErrorReporting('Problem checking status of PFB data import', async () => {
      await checkForCompletion(targetWorkspace, jobId)
    }), { ms: 5000 })

  const checkForCompletion = async ({ namespace, name }, jobId) => {
    const fetchImportStatus = async () => {
      try {
        return await Ajax(signal).Workspaces.workspace(namespace, name).importPFBStatus(jobId)
      } catch (error) {
        // Ignore 404; We're probably asking for status before the status endpoint knows about the job
        if (error.status === 404) {
          return { status: 'PENDING' }
        } else {
          onDone()
          throw error
        }
      }
    }

    const response = await fetchImportStatus()
    const { message, status } = response

    // avro-import statuses: PENDING, RUNNING, SUCCESS, ERROR
    // import service statuses: Pending, Translating, ReadyForUpsert, Upserting, Done, Error
    // TODO: only need to support both sets of statuses during the transition from avro-import to import service.
    // once import servie is fully adopted, we can/should remove the avro-import status values.

    const successNotify = () => notify('success', 'Data imported successfully.',
      {
        message: `Data import to workspace "${namespace} / ${name}" is complete, please refresh the Data view.
      Because this data comes from a PFB, you must include the namespace "pfb:" when referring to attribute names, 
      e.g. "this.pfb:consent_codes" instead of "this.consent_codes."`
      })

    const errorNotify = () => notify('error', 'Error importing PFB data.', message)

    if (!_.includes(status, ['PENDING', 'RUNNING', 'Pending', 'Translating', 'ReadyForUpsert', 'Upserting'])) {
      Utils.switchCase(status,
        ['SUCCESS', successNotify],
        ['Done', successNotify],
        ['ERROR', errorNotify],
        ['Error', errorNotify],
        [Utils.DEFAULT, () => notify('error', 'Unexpected error importing PFB data', response)]
      )
      clearNotification(jobId)
      onDone()
    }
  }

  return null
}

export default ImportStatus
