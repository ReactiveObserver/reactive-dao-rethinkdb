const ReactiveDao = require("reactive-dao")

class RethinkObservableValue extends ReactiveDao.ObservableValue {

  constructor(databasePromise, requestPromise) {
    super()

    if(!databasePromise) throw new Error("no database promise")
    if(!requestPromise) throw new Error("no request promise")
    
    this.disposed = false

    this.dbReqPromise = Promise.all([databasePromise, requestPromise])

    this.startObservation()
  }

  startObservation() {
    this.dbReqPromise.then(([conn, request]) => {
      if(this.disposed) return;
      console.log("REQ", request)
      request.run(conn).then(
          changesStream => {
            this.changesStream = changesStream
            if(this.disposed) {
              changesStream.close()
              return false
            }
            changesStream.each((err, change) => {
              if(this.disposed) {
                changesStream.close()
                return false
              }
              if(err) {
                changesStream.close()
                this.error(err)
                return false
              }
              this.set(change.new_val)
            })
          }
      )
    }).catch(error => {
      this.error(error.message ? error.message : error)
    })
  }

  respawn() {
    super.respawn()
    this.startObservation()
  }

  dispose() {
    this.disposed = true
    if(this.changesStream) this.changesStream.close()
  }

}

module.exports = RethinkObservableValue