/* global Meteor */
import React, { createContext, useState, useContext, useRef } from 'react'
import { EJSON } from 'meteor/ejson'
import { useTracker } from 'meteor/react-meteor-data'
import { makePagedRun, makeSingleRun, makeDataMethod, makePruneMethod } from './both'
import { getCollectionByName } from './client-collection'

const ConnectorContext = createContext(false)
export const DataHydrationProvider = ({ handle, children }) => {
  // :TODO: Add some development mode checks to make sure user sets handle.isHydrating correctly
  /**
   * Handle should be passed by user in the shape of:
   * { isHydrating: true|false }
   */
  return <ConnectorContext.Provider value={handle}>
    {children}
  </ConnectorContext.Provider>
}

let requestCounter = 0
export const createConnector = ({ name, collection, validate, query, single = false }) => {
  const run = single
    ? makeSingleRun(collection, query)
    : makePagedRun(collection, query)
  const dataMethod = makeDataMethod(name, validate, run, query)
  const pruneMethod = makePruneMethod(name, collection, validate, query)

  return (args = {}, onLoad = null) => {
    const hydrationContext = useContext(ConnectorContext)
    const [isLoading, setIsLoading] = useState(false)
    const { current: refs } = useRef({
      requestId: requestCounter,
      onLoad: null,
      lastArgValues: null
    })

    // If onLoad is defined inline in the user (likely) it's ref will change with each render pass,
    // so we need to make sure we always have the latest one in the effect callback - but we don't
    // want to re-invoke the effect every time the reference changes, which is every time.
    refs.onLoad = onLoad

    // We only want to refetch data if `args` changes. We also need this to start synchronously,
    // so that we can correctly ascertain whether react is currently hydrating.
    const argValues = Object.values(args)

    // We don't need to load data, but we need to call onLoad with the correct documents from offline storage.
    // Data should already have been hydrated.
    if (hydrationContext.isHydrating) {
      if (refs.onLoad) {
        validate(args)
        const docs = run(args)
        refs.onLoad(docs)
      }
    } else if (!isLoading && !isArgsEqual(argValues, refs.lastArgValues)) {
      setIsLoading(true)

      deferPrune(pruneMethod, collection, query, args)

      // Capture requestId in scope, and compare to make sure a new request hasn't started before we're done
      const requestId = refs.requestId = requestCounter++
      dataMethod.call(args, (err, res) => {
        let docs
        if (err) {
          console.error(err)
          docs = []
        } else {
          docs = res
          if (single) {
            collection.upsert(docs._id, docs)
          } else {
            for (const doc of docs) {
              collection.upsert(doc._id, doc)
            }
          }
        }
        if (requestId === refs.requestId) {
          Meteor.defer(() => {
            if (requestId !== refs.requestId) {
              return
            }
            setIsLoading(false)
            if (refs.onLoad) {
              refs.onLoad(docs)
            }
          })
        }
      })
    }
    refs.lastArgValues = argValues

    return useTracker(() => {
      validate(args)
      return [run(args), isLoading]
    }, [isLoading, ...Object.values(args)])
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
    for (const id of res) {
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
  for (const collectionData of data) {
    const col = getCollectionByName(collectionData.name)
    for (const doc of collectionData.docs) {
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
