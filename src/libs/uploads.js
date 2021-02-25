import _ from 'lodash/fp'
import { useReducer } from 'react'
import { Ajax } from 'src/libs/ajax'

const init = () => {
  return {
    active: false,
    totalFiles: 0,
    totalBytes: 0,
    uploadedBytes: 0,
    currentFileNum: 0,
    currentFile: null,
    files: [],
    completedFiles: [],
    errors: [],
    aborted: false,
    done: false
  }
}

export const useUploader = () => {
  return useReducer((state, update) => {
    switch(update.action) {
      // Calculate how many files and how many bytes we are working with
      case 'start':
        state = init()
        state.active = true
        state.files = update.files
        state.totalFiles = update.files.length
        state.totalBytes = _.reduce((total, file) => total += file.size, 0, update.files)
        break

      case 'startFile':
        state.currentFile = update.file
        state.currentFileNum = update.fileNum
        break

      case 'finishFile':
        state.uploadedBytes += update.file.size
        state.completedFiles.push(update.file)
        break

      case 'error':
        state.errors.push(update.error)
        break

      case 'abort':
        state.active = false
        state.aborted = true
        break

      case 'finish':
        state.active = false
        state.done = true
        break
    }
    return state
  }, null, init)
}

export const uploadFiles = async ({ namespace, bucketName, prefix, files, status, setStatus, signal }) => {
  // Only one instance of this should be running at a time, so exit out if we're not the one
  if (status.active) {
    return
  }
  setStatus({ action: 'start', files })

  let i = 0;
  for (const file of files) {
    setStatus({ action: 'startFile', file, fileNum: i++})

    if (signal && signal.aborted) {
      setStatus({ action: 'abort' })
      return
    }
    try {
      await Ajax(signal).Buckets.upload(namespace, bucketName, prefix, file)
      setStatus({ action: 'finishFile', file })
    }
    catch (error) {
      setStatus({ action: 'error', error })
    }
  }
  setStatus({ action: 'finish' });
}

export const friendlyFileSize = (bytes) => {
  const bins = [
    { pow: 5, fixed: 3, text: 'PB' },
    { pow: 4, fixed: 3, text: 'TB' },
    { pow: 3, fixed: 2, text: 'GB' },
    { pow: 2, fixed: 1, text: 'MB' },
    { pow: 1, fixed: 0, text: 'kB' },
  ]
  for (const bin of bins) {
    const pow = Math.pow(1024, bin.pow)
    if (bytes > pow) {
      return (bytes / pow).toFixed(bin.fixed) + ' ' + bin.text;
    }
  }
  return bytes + ' bytes'
}
