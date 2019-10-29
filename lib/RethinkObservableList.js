const ReactiveDao = require("reactive-dao")

class RethinkObservableList extends ReactiveDao.ObservableList {

  constructor(database, requestPromise, idField = null, maxLength = Infinity, valueMapper = v=>v) {
    super()

    if(!database) {
      console.trace("NO DATABASE")
      throw new Error("no database")
    }
    if(!requestPromise) throw new Error("no request promise")

    this.disposed = false
    this.ready = false
    this.idField = idField
    this.maxLength = maxLength

    this.respawnId = 0
    
    this.valueMapper = valueMapper

    this.database = database
    this.requestPromise = requestPromise

    this.startReading()

  }

  startReading() {
    let loadingList = []
    const changeStreamId = this.respawnId

    let databasePromise
    if(this.database.connect) {
      databasePromise = this.database.connect()
    } else {
      databasePromise = this.database
      throw new Error("old database type")
    }

    Promise.all([databasePromise, this.requestPromise]).then(([conn, request]) => {
      if(!request) throw new Error("empty request")
      if(changeStreamId != this.respawnId) return;
      request.run(conn).then(
        changesStream => {
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
              if(this.database.handleDisconnectError && this.database.handleDisconnectError(err))
                return this.reconnect()
              changesStream.close()
              this.error(err.toString())
              return false
            }

            if(!this.ready) {
              if(!change.state) {
                loadingList.push(change.new_val)
              } else if(change.state == 'ready') {
                this.set(loadingList)
                this.ready = true
              }
            } else {
              if(change.state) return
              if(change.old_val && change.new_val) {
                let old_val = this.valueMapper(change.old_val)
                let new_val = this.valueMapper(change.new_val)
                if(this.idField) this.updateByField(this.idField, old_val[this.idField], new_val)
                  else this.update(old_val, new_val)
              } else if(change.new_val) {
                let new_val = this.valueMapper(change.new_val)
                this.push(new_val)
                while(this.list.length > this.maxLength) this.list.shift()
              } else if(change.old_val) {
                let old_val = this.valueMapper(change.old_val)
                if(this.idField) this.removeByField(this.idField, old_val[this.idField])
                  else this.remove(old_val)
              }
            }
          })
        }
      )
    }).catch(error => {
      if(this.database.handleDisconnectError && this.database.handleDisconnectError(error))
        return this.reconnect()
      this.error(error.message ? error.message : error)
    })
  }

  reconnect() {
    this.changesStream.close()
    this.changesStream = null
    return this.database.connect().then(db => this.respawn())
  }

  dispose() {
    this.disposed = true
    this.respawnId++
    if(this.changesStream) this.changesStream.close()
    this.changesStream = null
  }

  respawn() {
    this.respawnId++
    if(this.changesStream) this.changesStream.close()
    this.ready = false
    this.disposed = false
    this.startReading()
  }

}

module.exports = RethinkObservableList
