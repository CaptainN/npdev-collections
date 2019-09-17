/* global check, ValidatedMethod */

export const makePagedRun = (collection, query) => ({ limit = 5, offset = 0, order = -1, orderBy = 'createdAt', ...rest }) => (
  collection.find(query(rest), {
    limit,
    skip: offset,
    sort: {
      [orderBy]: order
    }
  }).fetch()
)

export const makeSingleRun = (collection, query) => (args) => (
  collection.findOne(query(args))
)

export const makeDataMethod = (name, validate, run) => new ValidatedMethod({
  name: 'pixdata:' + name,
  validate ({ limit = 5, offset = 0, order = -1, orderBy = 'createdAt', ...rest }) {
    check(limit, Number)
    check(offset, Number)
    check(order, Number)
    check(orderBy, String)
    validate(rest)
  },
  run
})

export const makePruneMethod = (name, collection, validate, query) => new ValidatedMethod({
  name: `pixdata:${name}:checkExtant`,
  validate ({ IDs, limit = 5, offset = 0, order = -1, orderBy = 'createdAt', ...rest }) {
    // We're mostly pulling out the
    check(limit, Number)
    check(offset, Number)
    check(order, Number)
    check(orderBy, String)
    check(IDs, [String])
    validate(rest)
  },
  run (args) {
    const { IDs } = args
    // Find all documents in provided list, then match the missing ones
    const extantDocs = collection.find({
      $and: [
        { _id: { $in: IDs } },
        query(args)
      ]
    }, { fields: { _id: 1 } }).fetch()
    const extantIDs = extantDocs.map(doc => doc._id)
    const deletedIDs = IDs.filter((idToCheck) => !extantIDs.includes(idToCheck))
    return deletedIDs
  }
})
