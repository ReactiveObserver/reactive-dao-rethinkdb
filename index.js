const RethinkObservableValue = require('./lib/RethinkObservableValue.js')
const RethinkObservableList = require('./lib/RethinkObservableList.js')

class SimpleEndpoint {
  constructor({ get, observable }) {
    this.get = get
    this.observable = observable
  }
  next(fun) {
    return new SimpleEndpoint({
      get: (...args) => this.get(...args).then(fun),
      observable: (...args) => this.observable(...args).next(fun)
    })
  }
}

function promiseMap(promise, fn) {
  if(promise.then) return promise.then(fn)
  return fn(promise)
}

function getValue(db, requestPromise) {
  return Promise.all([db, requestPromise]).then(([conn, request]) => conn.run(request)).then(
      result => {
        console.log("RES", result)
        return result
      }
  )
}
function observableValue(db, requestPromise) {
  return new RethinkObservableValue(db, requestPromise)
}
function simpleValue(db, requestCallback) {
  return new SimpleEndpoint({
    get: (...args) => getValue(db,  requestCallback('get', ...args) ),
    observable: (...args) => observableValue(
        db, promiseMap(requestCallback('observe', ...args), req => req.changes({ includeInitial: true }))
    )
  })
}

function getList(db, requestPromise) {
  return Promise.all([db, requestPromise]).then(([conn, request]) => conn.run(request))
}
function observableList(db, requestPromise, idField, maxLength) {
  return new RethinkObservableList(db, requestPromise, idField, maxLength)
}
function simpleList(db, requestCallback, idField, maxLength) {
  return new SimpleEndpoint({
    get: (...args) => getList(db,  requestCallback('get', ...args) ),
    observable: (...args) => observableList(db,
        promiseMap(requestCallback('observe', ...args), req => req.changes({ includeInitial: true, includeStates: true })),
        idField, maxLength
    )
  })
}


module.exports = { 
  
  RethinkObservableList,
  RethinkObservableValue,
  
  getValue,
  observableValue,
  simpleValue,

  getList,
  observableList,
  simpleList,
  SimpleEndpoint
  
}