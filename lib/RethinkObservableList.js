const ReactiveDao = require("reactive-dao")

class RethinkObservableList extends ReactiveDao.ObservableList {

  constructor(databasePromise, requestPromise, idField, maxLength = Infinity) {
    super()

    this.disposed = false
    this.ready = false
    this.idField = idField
    this.maxLength = maxLength

    this.requestPromise = requestPromise

    this.startReading()

  }

  startReading() {
    let loadingList = []
    Promise.all([databasePromise, this.requestPromise]).then(([conn, request]) => {
      if(this.disposed) return;
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
              if(change.state) return;
              if(change.old_val && change.new_val) {
                if(this.idField) this.updateByField(this.idField, change.old_val[this.idField], change.new_val)
                else this.update(change.old_val, change.new_val)
              } else if(change.new_val) {
                this.push(change.new_val)
                while(this.list.length > this.maxLength) this.list.shift()
              } else if(change.old_val) {
                if(this.idField) this.removeByField(this.idField, change.old_val[this.idField])
                else this.remove(change.old_val)
              }
            }

          })
        }
      )
    }).catch(error => {
      this.error(error)
    })
  }
  
  dispose() {
    this.disposed = true
    if(this.changesStream) this.changesStream.close()
    this.changesStream = null
  }

  respawn() {
    this.ready = false
    this.disposed = false
    this.startReading()
  }

}

module.exports = RethinkObservableList
