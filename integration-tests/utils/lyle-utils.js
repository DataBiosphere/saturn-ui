const _ = require('lodash/fp')
const { JWT } = require('google-auth-library')
const fetch = require('node-fetch')
const { getSecrets, lyleUrl } = require('./integration-config')


const makeAuthClient = _.once(async () => {
  const { lyleKey } = await getSecrets()
  const { client_email: email, private_key: key } = JSON.parse(lyleKey)

  return new JWT({
    email,
    key,
    additionalClaims: { target_audience: lyleUrl }
  })
})

const fetchLyle = async (path, email) => {
  const url = `${lyleUrl}/api/${path}`
  const authClient = await makeAuthClient()

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authClient.getRequestHeaders(url)) },
      body: JSON.stringify({ email })
    })
    console.log(`fetchLyle: ${res.status}, ${url}`)
    if (res.ok) {
      // response.status >= 200 && response.status < 300
      return res.json()
    }
    // delegate non-2xx response to enclosing try/catch
    const error = new Error()
    Object.assign(error, { response: res })
    throw error
  } catch (err) {
    console.error(err)
    const errorBody = await err.response.text()
    console.error(`fetchLyle response: ${errorBody}`)
    throw err
  }
}

module.exports = {
  fetchLyle
}
