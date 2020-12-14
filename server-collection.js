/* global Mongo */

const collectionRegistry = {}

export const createCollection = (name, schema, indexes = []) => {
  const Collection = new Mongo.Collection(name)
  if (schema) Collection.attachSchema(schema)
  collectionRegistry[name] = Collection
  if (indexes.length > 0) {
    const indexObj = {}
    for (const index of indexes) {
      indexObj[index] = 'text'
    }
    Collection.rawCollection().createIndex(indexObj)
  }
  return Collection
}

export const getCollectionByName = (name) => collectionRegistry[name]
