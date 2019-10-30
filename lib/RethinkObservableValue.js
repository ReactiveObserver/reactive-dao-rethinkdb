const ReactiveDao = require("reactive-dao")

class RethinkObservableValue extends ReactiveDao.ObservableValue {

  constructor(database, requestPromise) {
    super()

    if(!database) {
      console.trace("NO DATABASE")
      throw new Error("no database")
    }
    if(!requestPromise) throw new Error("no request promise")
    
    this.disposed = false

    this.respawnId = 0

    this.database = database
    this.requestPromise = requestPromise

    this.startObservation()
  }

  startObservation() {
    const changeStreamId = this.respawnId

    let databasePromise
    if(this.database.connect) {
      databasePromise = this.database.connect()
    } else {
      databasePromise = this.database
      throw new Error("old database type")
    }

    Promise.all([databasePromise, this.requestPromise]).then(([conn, request]) => {
      if(changeStreamId != this.respawnId) return;
      if(!request) throw new Error("empty request")
      if(request.toString() == 'null') {
        this.set(null)
        return;
      }
      //console.log("START OBSERVATION", request)
      request.run(conn).then(
        changesStream => {
          if(!changesStream) throw new Error("no change stream", request)
          this.changesStream = changesStream
          if(changeStreamId != this.respawnId) {
            changesStream.close()
            return false
          }
          changesStream.each((err, change) => {
            if(changeStreamId != this.respawnId) {
              changesStream.close()
              return false
            }
            if(err) {
              if(this.database.handleDisconnectError && this.database.handleDisconnectError(err)) {
                //console.log("OBSERVABLE RECONNECT", request)
                return this.reconnect()
              }
              changesStream.close()
              this.error(err)
              return false
            }
            this.set(change.new_val)
          })
        }
      )
    }).catch(error => {
      if(this.database.handleDisconnectError && this.database.handleDisconnectError(error)) return this.reconnect()
      this.error(error.message ? error.message : error)
    })
  }

  reconnect() {
    this.changesStream.close()
    this.changesStream = null
    return this.database.connect().then(db => this.respawn())
  }

  respawn() {
    if(this.changesStream) this.changesStream.close()
    this.respawnId++
    super.respawn()
    this.startObservation()
  }

  dispose() {
    this.disposed = true
    this.respawnId++
    if(this.changesStream) this.changesStream.close()
    this.changesStream = null
  }

}

module.exports = RethinkObservableValue