NP Dev Collections
==========================

Foundational code for NP Dev Collections was generously donated by PixStori, an aural history social media tool built on Meteor. Tell your stori.

Install with (not published yet):

`$ meteor add npdev:collections`

NPDev Collections combines a mix of technologies to facilitate the creation of offline first collections, data over methods with pagination, and support for SSR out of the box.

Why
---

To come. Basically, I like Mongo and MiniMongo, and wanted to fill in some gaps, and improve some of the performance characteristics of the existing system.

What
----

Here is a list of requirements:

- For scale and performance, don't use pub/sub. Use methods to serve and deliver data instead. This is not strictly necessary, but I've found pub/sub to be slow, even just for a single user in many cases. Future versions may have the option to enable pub/sub instead of using methods.
- Use offline storage client side, instead of temporary in-memory storage (the default for pub/sub).
- Make it easy to set up the various parts - setup server methods, SSR with data capture, data hydration, and remote syncing over methods.
- We may also create a way to create non-offline collections easily, and and even pub/sub based solutions for live data sources.

To do this, we need to keep track of a bunch of tricky things:

- We'll use mongo queries on the server and client, in an isomorphic way. We have a single location, that let's us create an instance of the collection, which is Mongo on the server, and GroundDB on the client. This keeps the code isomorphic, and canonical. The server will use Mongo directly, and never display a loading screen.
- On the server, during SSR, we'll capture all query data, and output it as JSON (actually, EJSON) for hydration to use. This is done with a Context Provider, which must be configured in the SSR code.
- The same goes for first-render after hydration on the client - no need to wait for a server round trip, since we already got the data. Instead, hydrate the data, then render the react tree. This is accomplished through a simple Provider, which must be configured in the client side React startup code.
- Client will fetch data via meteor methods, but will also provide data which may already be in the caches. The isLoading property will only be true during syncing (loading) events.
- The API should ask for as little code as possible, and set everything up automagically.

All of this takes a lot of coordination. To accomplish that, we have an abstraction which hides that complexity. Here's a high level description of the process.

We use a pattern of "connectors". These accept a set of properties - name, collection, an isomorphic validation method, and an isomorphic query generator. Here is an example from PixStori:

```js

export const useMyTiles = createListHook({
  name: 'myTiles',
  collection: Tiles,
  validate () {
    if (!Meteor.userId()) {
      throw new Meteor.Error('access-denied', 'Access Denied')
    }
  },
  query: () => ({ owner: Meteor.isClient && Meteor.userId() })
})

export const useGroupTiles = createListHook({
  name: 'groupTiles',
  collection: Tiles,
  validate () {},
  query: ({ groupId }) => ({
    $and: [
      { groupId },
      getAccessQuery()
    ]
  })
})

```

That's it! Using this, along with `createListHook`, it sets up everything we need on the server, and on the client to do offline-first, data-over-methods, with pagination, and SSR, with data hydration, etc. (along with using a set of providers in SSR and hydration code). Super spiffy! In use, it looks like this:

```js
// Here we use the group tiles with its consistent props contract built off the name prop
const GroupFeedPage = ({ limit, offset, order, orderBy, ...props }) => {
  const { groupTiles, groupTilesAreLoading } = useGroupTiles({ limit, offset, order, orderBy })
  return <FeedPage tiles={groupTiles} isLoading={groupTilesAreLoading} />
}

// PagedFeed is a generic component which handles pagination and infinite scrolling - example to come...
const GroupFeed = ({ groupId }) => (
  <PagedFeed FeedPageComponent={GroupFeedPage} feedPageProps={{ groupId }} />
)

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
