import { EJSON } from 'meteor/ejson'
import React, { createContext, useContext, useRef } from 'react'
import { useTracker } from './meteor-hook'
import { makePagedRun, makeDataMethod, makePruneMethod } from './both'

const ConnectorContext = createContext([])
export const DataCaptureProvider = ({ handle, children }) => {
  const ref = useRef([])
  handle.data = ref.current
  handle.toEJSON = () => (
    EJSON.stringify(ref.current)
  )
  handle.toScriptTag = () => (
    `<script type="text/ejson" id="__NPCollectionCaptureData__">${EJSON.stringify(ref.current)}</script>`
  )
  return <ConnectorContext.Provider value={ref.current}>
    {children}
  </ConnectorContext.Provider>
}

export const createListHook = ({ name, collection, validate, query }) => {
  const run = makePagedRun(collection, query)
  makeDataMethod(name, validate, run)
  makePruneMethod(name, collection, validate, query)
  return (args = {}) => {
    const captureData = useContext(ConnectorContext)
    return useTracker(() => {
      const docs = run(args)
      captureData.push({ name: collection._name, docs })
      return [ docs, false ]
    }, Object.values(args))
  }
}
