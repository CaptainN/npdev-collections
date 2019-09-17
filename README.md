NP Dev Collections
==========================

Foundational code for NP Dev Collections was generously donated by [PixStori](https://www.pixstoriplus.com), an aural history social media tool built on Meteor. Tell your stori.

NPDev Collections combines a mix of technologies to facilitate the creation of offline first collections, data over methods with pagination, and support for SSR out of the box.

Install with:

`$ meteor add npdev:collections`

[Check out my starter](https://github.com/CaptainN/meteor-react-starter) for a complete example site using NP Dev Collections and other server-render tools.

Why
---

Basically, I like Mongo and MiniMongo for it's low bar for entry, and it's simple iteration. It's great for starting new projects and prototyping early and rapidly. I wanted to create something that added a few of the modern touches, like offline-first data, and server side rendering, while retaining that wonderful simplicity as much as possible.

What
----

There are a lot moving parts involved getting all the parts working together. Here are some of the hurdles:

- Use offline storage client side by default. `ground:db` is a great solution.
- SSR - for SSR, we have a number of tricky parts to choreograph.
  - Query Mongo directly, and avoid setting up subscriptions.
  - Capture the results of queries on the server during SSR, and serialize that data to send to the client.
  - Hydrate the data from the server on the client, before rendering the react tree.
  - On first render, don't fetch remote data - we just got that through hydration.
  - Those same queries must work in an isomorphic way - on the server they must run against mongo directly, on the client, they must fetch data.
- Use methods for data transfer by default, instead of reactive pub/sub (on the list of TODOs is to allow pub/sub instead of methods).
  - Also provide a method of pagination by default in the methods.

That's a lot of stuff to keep track of, and it's kind of a pain to do it manually. NPDev;Collections keep track of all that for you, and provides the tools to easily set it all up.

How
---

- We'll use mongo queries on the server and client, in an isomorphic way. NPDev:Collections provides a createCollection method with a single import location, which delivers Mongo on the server, and GroundDB on the client. This keeps the code isomorphic, and canonical. The server will use Mongo directly, and never display a loading screen.
- On the server, during SSR, we'll capture all query data, and output it as JSON (actually, EJSON) for hydration to use. This is done with a Context Provider, and a utility method, which must be configured in SSR code using Meteor's `server-render` package.
- On the client, that data gets hydrated before React is hydrated. We also have to make sure there is no attempt to hit the server to grab data in the first render, since we already got the data. This is accomplished through another simple Provider, and a utility method, which must be configured in the client side React startup code. First hydrate the data, then hydrate react.
- After the first run (during hydration), the client will fetch data via meteor methods. The isLoading property will only be true during syncing (loading) events.

Quick Start!
------------

Install with:

`meteor add npdev:collections`

We also need react and react-dom npm packages of course. These are not defined in this package, so that the version can be kept up to date in the main project. This package requires a version of react which contains support for hooks - 16.8+.

The first thing we need are our collections. They can be created using the simple `createCollection` method. All this is does is create a Meteor Collection on the server, or a Ground:DB server on the client, and connect the schema using `aldeed:collection2`'s attachSchema (on the server). It's necessary to use this method to create your collections to register them with NPDev:Collections. I'll probably add some facilities to allow more granular control over these in the future. Of course, these collections should all be included in the server bundle.

```js
import { createCollection } from 'meteor/npdev:collections'
import { CommentSchema } from './CommentSchema'

const Comments = createCollection('comments', CommentSchema)

export default Comments
```

Basic use requires the creation of custom hooks for each query you want to set up. The `createConnector` utility function accept a set of properties - name, collection, an isomorphic validation method, and an isomorphic query generator. This API is inspired by, and builds on the API of mdg:validated-method. Here is an example from PixStori:

```js
import { createListHood } from 'meteor/npdev:collections'

// getPublicQuery builds a query which selects the appropriate public documents
const getPublicQuery = () => ({
  public: true
})

export const useComments = createConnector({
  name: 'tiles',
  collection: Comments,
  // This runs on client and server, and in both methods and SSR contexts.
  validate () {},
  // So does this! Be careful with security.
  query () {
    return getPublicQuery()
  }
})

export const useGroupComments = createConnector({
  name: 'groupComments',
  collection: Comments,
  validate ({ groupId }) {
    // Here we could use SimpleSchema and/or throw a validated-error, etc.
    // See the ValidateMethod documentation for more.
    check(groupId, String)
  },
  query: ({ groupId }) => ({
    $and: [
      { groupId },
      getPublicQuery()
    ]
  })
})

```

**NOTE:** *These hooks must be included in the server build, not just in the react tree, but somewhere statically, so they can set up the necessary methods. They don't need to be included statically in the client bundle, which allows for code splitting using the `dynamic-import` package.*

Using this, along with `createConnector`, it sets up everything we need on the server, and on the client to do offline-first, data-over-methods, with pagination, and SSR, with data hydration, etc. (along with using a set of providers in SSR and hydration code). Super spiffy! In use, it looks like this:

```js
// Here we use the group comments.
const GroupFeedPage = ({ limit, offset, order, orderBy, groupId }) => {
  const { groupComments, groupCommentsAreLoading } = useGroupComments({ groupId, limit, offset, order, orderBy })
  return <FeedPage tiles={groupComments} isLoading={groupCommentsAreLoading} />
}
```

That's already a pretty easy way to grab data! But we also want to have SSR with data hydration.

```js
import React from 'react'
import { StaticRouter } from 'react-router'
import { renderToString } from 'react-dom/server'
import { onPageLoad } from 'meteor/server-render'
import App from '/imports/App'
import { DataCaptureProvider } from 'meteor/npdev:collections'

onPageLoad(sink => {
  const context = {}

  // use the DataCaptureProvider with a scoped dataHandle
  const dataHandle = {}
  const app = <DataCaptureProvider handle={dataHandle}>
    <StaticRouter location={sink.request.url} context={context}>
      <App />
    </StaticRouter>
  </DataCaptureProvider>

  // render the app to html
  const content = renderToString(app)

  // render out the html
  sink.renderIntoElementById('root', content)

  // render out the captured data
  sink.appendToBody(dataHandle.toScriptTag())
})
```

Behind the scenes this provider is watching for all the queries that happen during rendering of the current route, and captures that data in a property on `dataHandle`. Then the `toScriptTag` method is used to render out a `<script>` tag which contains an EJSON encoded copy of all that data. This will be hydrated on the client side, like so:

```js
import { onPageLoad } from 'meteor/server-render'

onPageLoad(sink => {
  import React from 'react'
  import { hydrate } from 'react-dom'
  import { BrowserRouter } from 'react-router-dom'
  import { DataHydrationProvider, hydrateData } from 'meteor/npdev:collections'
  import App from '/imports/App'

  // Load the data into offline storage
  hydrateData()

  // The isHydrating flag basically tells the hooks not to bother loading data
  // over methods, since we just hydrated all the data above.
  const hydrationHandle = { isHydrating: true }

  const app = <DataHydrationProvider handle={hydrationHandle}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </DataHydrationProvider>

  // hydrate the app using React.hydrate (<div id="root"></div> defined using
  // static-html package in /client/main.html)
  hydrate(app, document.getElementById('root'), () => {
    // set the isHydrating flag to false, so that subsequent renders will know
    // to fetch data.
    hydrationHandle.isHydrating = false
  })
})
```

TODOS:
------

- Optimize the sync algorithm. It's not much of an algorithm at all right now - it just does a simple load on mount, with no real smarts. At the very least it'd be a good idea to use a Flux patterned, global action controller, which would limit the frequency of similar remote queries.
  - If we have offline data already, maybe we can send a list of lastModified timestamps, and only return changed documents.
- Use a Provider/Consumer for cases where the same connector is used in multiple spots in the tree. This could reduce the stress on mini mongo.
  - This might be easy enough for an end user to set up that an example is all that we need.
- Figure out a way to anchor the pagination off the first doc we get back on the first page.
  - After the above, also figure out a way to get notice of newer documents (add some meta data to a paged dataset).
- Add an offline property to the connector config object. If it's set to false, it would use an in memory cache only, and no Ground DB.
- Add a live property to the connector config object. If set, it would set up a pub/sub connection (with a monitoring Ground DB) instead of data over methods.
- Add a pagination property to the connector config object. If set to false, we'll skip pagination flags altogether.
  - Maybe we can just set the limit prop to -1 for this case.
- Add tools (maybe in a sibling package) to enable accounts in SSR.

You can find some of the SSR stuff here (without the data part for now), in [my starter repo](https://github.com/CaptainN/meteor-react-starter).
