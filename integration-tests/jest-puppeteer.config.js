module.exports = {
  browserContext: 'incognito',
  launch: {
    devtools: process.env.DEVTOOLS === 'true',
    headless: process.env.HEADLESS !== 'false',
    slowMo: process.env.SLOW === 'true' ? 250 : undefined,
    defaultViewport: { width: 1200, height: 800 },
    protocolTimeout: 720_000, // 12 minutes
    // The below code explicitly allows third-party cookies in the Chrome used for integration tests.
    //    This is necessary to allow the `run-rstudio` and `run-analysis` tests to pass, which require 3p cookies.
    //    If Terra no longer requires third-party cookies, or if we upgrade puppeteer/Chrome to a version that
    //    allows 3p cookies, remove this exception.
    //    For flag info, see https://developers.google.com/privacy-sandbox/cookies/prepare/test-for-breakage
    args: ['--disable-features=TrackingProtection3pcd'],
  },
};
