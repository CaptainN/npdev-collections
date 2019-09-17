import { EJSON } from 'meteor/ejson'
import React, { createContext, useContext, useRef } from 'react'
import { makePagedRun, makeDataMethod, makePruneMethod, makeSingleRun } from './both'

const ConnectorContext = createContext()
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

export const createConnector = ({ name, collection, validate, query, single = false }) => {
  const run = single
    ? makeSingleRun(collection, query)
    : makePagedRun(collection, query)
  makeDataMethod(name, validate, run)
  makePruneMethod(name, collection, validate, query)
  return (args = {}) => {
    validate(args)
    const captureData = useContext(ConnectorContext)
    const docs = run(args)
    captureData.push({ name: collection._name, docs: single ? [docs] : docs })
    return [docs, false]
  }
}
