/* global Package */
Package.describe({
  name: 'npdev:collections',
  summary: 'An easy way to create offline collections with SSR',
  description: 'An easy way to create offline collections with SSR',
  version: '0.1.0'
})

Package.onUse(function (api) {
  api.versionsFrom('METEOR@1.5')

  api.use('mdg:validated-method', ['client', 'server'])
  api.use('check', ['client', 'server'])
  api.use('ground:db', 'client')
  api.use('mongo', 'server')
  api.use('ecmascript')

  api.mainModule('client.js', 'client', { lazy: true })
  api.mainModule('server.js', 'server', { lazy: true })
})
