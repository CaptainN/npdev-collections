/* global Package */
Package.describe({
  name: 'npdev:collections',
  summary: 'An easy way to create offline collections with SSR',
  description: 'An easy way to create offline collections with SSR',
  version: '0.1.3',
  git: 'https://github.com/CaptainN/npdev-collections'
})

Package.onUse(function (api) {
  api.versionsFrom('METEOR@1.5')

  api.use(['check', 'ecmascript', 'ejson'])
  api.use('mdg:validated-method@1.2.0', ['client', 'server'])
  api.use('ground:db@2.0.0', 'client')
  api.use('mongo', 'server')

  api.mainModule('client.js', 'client', { lazy: true })
  api.mainModule('server.js', 'server', { lazy: true })
})
