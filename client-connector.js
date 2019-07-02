/* global Meteor */
import React, { createContext, useState, useContext, useRef } from 'react'
import { useTracker } from 'meteor/react-meteor-data'
import { EJSON } from 'meteor/ejson'
import { makePagedRun, makeDataMethod, makePruneMethod } from './both'
import { getCollectionByName } from './client-collection'

const ConnectorContext = createContext(false)
export const DataHydrationProvider = ({ handle, children }) => {
  // :TODO: Add some development mode checks to make sure user sets handle.isHydrating correctly
  /**
   * Handle should be passed by user in the shape of:
   * { isHydrating: true|false }
   */
  const ref = useRef(handle)
  return <ConnectorContext.Provider value={ref.current}>
    {children}
  </ConnectorContext.Provider>
}

let requestCounter = 0
export const createListHook = ({ name, propName, collection, validate, query }) => {
  const run = makePagedRun(collection, query)
  const dataMethod = makeDataMethod(name, validate, run, query)
  const pruneMethod = makePruneMethod(name, collection, validate, query)

  return (args = {}, onLoad = null) => {
    const hydrationContext = useContext(ConnectorContext)
    const [isLoading, setIsLoading] = useState(false)
    const requestRef = useRef(true)

    // If onLoad is defined inline in the user (likely) it's ref will change with each render pass,
    // so we need to make sure we always have the latest one in the effect callback - but we don't
    // want to re-invoke the effect every time the reference changes, which is every time.
    const onLoadRef = useRef()
    onLoadRef.current = onLoad

    // We only want to refetch data if `args` changes. We also need this to start synchronously,
    // so that we can correctly ascertain whether react is currently hydrating.
    const lastArgValues = useRef(null)
    const argValues = Object.values(args)

    // We don't need to load data, but we need to call onLoad with the correct documents from offline storage.
    // Data should already have been hydrated.
    if (hydrationContext.isHydrating) {
      if (onLoadRef.current) {
        const docs = run(args)
        onLoadRef.current(docs)
      }
    } else if (!isLoading && !isArgsEqual(argValues, lastArgValues.current)) {
      setIsLoading(true)

      deferPrune(pruneMethod, collection, query, args)

      // Capture requestId in scope, and compare to make sure a new request hasn't started before we're done
      const requestId = requestRef.current = requestCounter++
      dataMethod.call(args, (err, res) => {
        let docs
        if (err) {
          console.error(err)
          docs = []
        } else {
          docs = res
          for (let doc of docs) {
            collection.upsert(doc._id, doc)
          }
        }
        if (requestId === requestRef.current) {
          Meteor.defer(() => {
            if (requestId !== requestRef.current) {
              return
            }
            setIsLoading(false)
            if (onLoadRef.current) {
              onLoadRef.current(docs)
            }
          })
        }
      })
    }
    lastArgValues.current = argValues

    const pName = propName || name
    return useTracker(() => ({
      [pName + 'AreLoading']: isLoading,
      [pName]: run(args)
    }), [isLoading, ...Object.values(args)])
  }
}

const deferPrune = (pruneMethod, collection, query, args) => Meteor.defer(() => {
  const allLocal = collection.find(query(args)).fetch()
  const IDs = allLocal.map(doc => doc._id)
  pruneMethod.call({ ...args, IDs }, (err, res) => {
    if (err) {
      console.error(err)
      return
    }
    for (let id of res) {
      collection.remove(id)
    }
  })
})

// :TODO: use a prune method - probably store a lookup table like getCollectionByName
export const hydrateData = (id = '__NPCollectionCaptureData__') => {
  const collectionDataNode = document.getElementById(id)
  if (collectionDataNode) {
    const data = EJSON.parse(collectionDataNode.innerText)
    updateCollections(data)
    collectionDataNode.parentNode.removeChild(collectionDataNode)
  }
}
export const updateCollections = (data) => {
  const cols = []
  for (let collectionData of data) {
    const col = getCollectionByName(collectionData.name)
    for (let doc of collectionData.docs) {
      col.upsert(doc._id, doc)
    }
    cols.push(col)
  }
}

const is = (x, y) =>
  (x === y && (x !== 0 || 1 / x === 1 / y)) || (x !== x && y !== y) // eslint-disable-line no-self-compare

const isArgsEqual = (nextDeps, prevDeps) => {
  if (!nextDeps || !prevDeps) {
    return false
  }
  const len = nextDeps.length
  if (prevDeps.length !== len) {
    return false
  }
  for (let i = 0; i < len; i++) {
    if (!is(nextDeps[i], prevDeps[i])) {
      return false
    }
  }
  return true
}
