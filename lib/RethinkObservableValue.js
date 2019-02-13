const ReactiveDao = require("reactive-dao")

class RethinkObservableValue extends ReactiveDao.ObservableValue {

  constructor(databasePromise, requestPromise) {
    super()

    this.disposed = false

    Promise.all([databasePromise, requestPromise]).then(([conn, request]) => {
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
              this.error(err)
              return false
            }
            this.set(change.new_val)
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
  }

}

module.exports = RethinkObservableValue