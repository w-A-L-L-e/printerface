var Stream = require('stream').Stream
  , fs     = require('fs')
  , path   = require('path')
  , mime   = require('mime')
  , noop   = function () {}
  , mp

/**
 * Merge an object into another 1 layer deep
 *
 * @param {Object} subject
 * @param {Object} source
 * @return {Object}
 */
function defaults (subject, source) {
  var keys   = Object.keys(source)
    , s_keys = Object.keys(subject)
    , key

  for (var i = 0, il = keys.length; i < il; i++) {
    key = keys[i]

    if (-1 !== s_keys.indexOf(key)) {
      continue
    }

    subject[key] = source[key]
  }

  return subject
}

// Queue class adapted from Tim Caswell's pattern library
// http://github.com/creationix/pattern/blob/master/lib/pattern/queue.js
function Queue () {
  this.array  = Array.prototype.slice.call(arguments)
  this.offset = 0
}

Queue.prototype.shift = function shift () {
  if (this.array.length === 0) return

  var ret                   = this.array[this.offset]
  this.array[this.offset++] = undefined

  if (this.offset === this.array.length) {
    this.array.length       = 0
    this.offset             = 0
  }

  return ret
}

Queue.prototype.push = function (item) {
  return this.array.push(item)
}

Object.defineProperty(
  Queue.prototype
, 'length'
, { get : function () {
      return this.array.length
    }
  }
)

/**
 * Multipart stream
 */
function MultipartStream (options) {
  Stream.call(this)
  var mps              = this
  options             || (options = {})

  mps.mp_level         = 1
  mps.prefix           = options.prefix || 'NODEmpLEVEL'
  mps.boundary         = mps.prefix + mps.mp_level
  mps._first_boundary  = true
  mps._done_boundary   = false
  mps._current_stream  = null
  mps.readable         = true
  mps.writable         = true
  mps.paused           = false
  mps.waiting          = false
  mps._emit_drain      = false
  mps._tick_flush      = false
  mps._tick_running    = false
  mps._flush_callbacks = []
  mps._queue           = new Queue()
  mps._buffer          = []
}

// prototype shortcut
mp = MultipartStream.prototype

mp.__proto__ = Stream.prototype

// Export
exports.MultipartStream = MultipartStream
exports.createMultipartStream = function createMultipartStream (options) {
  return new MultipartStream(options)
}

/**
 * Create content-type header and find out if nested or not.
 *
 * @param {MultipartStream} @optional parent
 * @param {String} @optional mime
 */
mp.contentType = function contentType (parent, mime) {
  mime || (mime = 'multipart/mixed')

  if (parent && parent.mp_level) {
    this.mp_level += parent.mp_level
    this.boundary  = this.prefix + this.mp_level
  }

  return mime + '; boundary=' + this.boundary
}

/**
 * Stop yo horses!
 */
mp.pause = function pause () {
  this.paused  = true
  this.waiting = true

  if (this._current_stream && this._current_stream.pause) {
    this._current_stream.pause()
  }

  return true
}

/**
 * Start yo horses.
 */
mp.resume = function resume () {
  this.paused = false

  if (this._queue.length <= 0) {
    this.waiting = false
  }

  if (this._current_stream && this._current_stream.resume) {
    this._current_stream.resume()
    return true
  }

  this._next()

  return true
}

/**
 * Incoming!
 *
 * @param {Object} headers
 * @param {Mixed} data
 * @param {Function} @optional callback
 */
mp.write = function write (headers, data, callback) {
  if (this.waiting) {
    this._emit_drain = true
    this._queue.push([headers, data, callback])
    return false
  }

  this._write([headers, data, callback])
  return true
}

/**
 * Headers to lower case array + map.
 *
 * @param {Object} headers
 * @return {Array} [array, map]
 */
function headersToMap (headers) {
  var keys = Object.keys(headers)
    , map  = {}
    , arr  = []
    , key, l_key

  for (var i = 0, il = keys.length; i < il; i++) {
    key        = keys[i]
    l_key      = key.toLowerCase()

    map[l_key] = key
    arr.push(l_key)
  }

  return [arr, map]
}

/**
 * Incoming file
 *
 * @param {Object} details
 * @param {String} filename
 */
mp.writeFile = function writeFile (details, callback) {
  var file                      = details.file
    , headers                   = details.headers || {}
    , filename                  = details.filename
    , header_keys, header_map, value, key, found, short_filename

  defaults(headers, { 'Content-Disposition' : ['file'] })
  header_map                    = headersToMap(headers)
  header_keys                   = header_map[0]
  header_map                    = header_map[1]

  // TODO : Encode filename at all?
  if (filename) {
    key                         = header_map['content-disposition']
    value                       = headers[key]
    short_filename              = path.basename(filename)

    if (Array.isArray(value)) {
      found                     = false

      for (var i = 0, il = value.length; i < il; i++) {
        if (~value[i].indexOf('filename')) {
          found                 = true
          break
        }
      }

      if (!found) {
        headers[key].push('filename="' + short_filename + '"')
      }
    } else if (-1 === value.indexOf('filename')) {
      headers[key]              = value + '; filename="' + short_filename + '"'
    }

    // Content type
    if (!header_map['content-type']) {
      value                     = mime.lookup(filename)

      if (value) {
        headers['Content-Type'] = value
      }
    }

    key = value = undefined

    if (!file) {
      file = fs.createReadStream(filename)
      file.pause()
    }
  }

  header_map = header_keys = undefined

  return this.write(headers, file, callback)
}

/**
 * Incoming form
 *
 * @param {Object} @optional headers
 * @param {Object} data
 */
mp.writeForm = function writeForm (details, callback) {
  var headers   = details.headers
    , data      = details.data
    , keys, key, header_map, value, tmp_headers

  if (headers) {
    header_map  = headersToMap(headers)[1]
    key         = header_map['content-disposition']

    if (key) {
      delete headers[key]
    }
  }

  keys          = Object.keys(data)

  for (var i = 0, il = keys.length - 1; i < il; i++) {
    key         = keys[i]
    value       = data[key]

    tmp_headers = { 'Content-Disposition' : 'form-data; name="' + key + '"' }
    if (headers) {
      defaults(tmp_headers, headers)
    }

    this.write(tmp_headers, value)
  }

  key           = keys[i]
  value         = data[key]

  tmp_headers   = { 'Content-Disposition' : 'form-data; name="' + key + '"' }
  if (headers) {
    defaults(tmp_headers, headers)
  }

  value = this.write(tmp_headers, value, callback)

  key = tmp_headers = header_map = headers = undefined
  return value
}

/**
 * Turns header object into string
 *
 * @param {Object} mps
 * @param {Object} headers
 */
function makeHeaders (mps, headers) {
  var keys = Object.keys(headers)
    , out  = []
    , key, value

  for (var i = 0, il = keys.length; i < il; i++) {
    key   = keys[i]
    value = headers[key]

    if (Array.isArray(value)) {
      value = value.join('; ')
    } else {
      value = '' + value
    }

    out.push(key + ': ' + value)
  }

  out.push("\r\n")

  return '\r\n' + out.join("\r\n")
}

/**
 * Write the boundary
 */
mp._writeBoundary = function _writeBoundary (prev) {
  if (this._done_boundary) {
    return false
  }

  var prefix = '\r\n--'

  if (this._first_boundary) {
    prefix = '--'
    this._first_boundary = false
  }

  this._buffer.push(prefix + this.boundary)
  this._done_boundary = true
}

/**
 * Write to buffer
 */
mp._writeBuffer = function _writeBuffer (data) {
  if (Buffer.isBuffer(data)) {
    this._flush()
    return this.emit('data', data)
  }

  this._buffer.push(data)

  if (!this._tick_flush) {
    this._setupTick()
  }
}

/**
 * Flush out buffer
 */
mp._flush = function _flush () {
  var ret                 = false
  this._tick_flush        = false

  if (0 < this._buffer.length) {
    this.emit('data', this._buffer.join(''))
    this._buffer          = []
    ret                   = true
  }

  if (0 < this._flush_callbacks.length) {
    for (var i = 0, il = this._flush_callbacks.length; i < il; i++) {
      this._flush_callbacks[i].call(null, this)
    }

    this._flush_callbacks = []
  }

  return ret
}

/**
 * Setup tick flush
 */
mp._setupTick = function _setupTick () {
  var mps = this

  if (mps._tick_flush && mps._tick_running) {
    return false
  }

  if (mps._tick_running) {
    mps._tick_flush = true
    return true
  }

  process.nextTick(function nextTickCallback () {
    if (!mps._tick_flush) {
      return
    }

    mps._tick_running = false
    mps._tick_flush   = false
    mps._flush()
  })

  mps._tick_running = true
  mps._tick_flush   = true

  return true
}

/**
 * Where data meets the emitter.
 *
 * @param {Array} data : [headers, body, callback]
 */
mp._write = function _write (data) {
  var mps        = this
    , headers, callback, stream, first

  callback = data[2] || noop
  headers  = data[0] || {}
  data     = data[1]

  if ('function' === typeof data) {
    data = data(mps)
  }

  // Directly writable?
  if ( 'number' === typeof data
    || 'string' === typeof data
    || Buffer.isBuffer(data)
     ) {
    mps._writeBoundary(true)
    mps._writeBuffer(makeHeaders(mps, headers))
    mps._writeBuffer(data)
    mps._done_boundary = false
    return mps._next(callback)
  }

  // Successfull write, even though it failed really.
  if (!data || 'function' !== typeof data.resume) {
    return mps._next(callback, new Error('Data was not a valid type'))
  }

  // We have a stream!
  mps._current_stream = stream = data
  first  = true
  stream.resume()

  function onError (error) {
    cleanup()
    mps._next(callback, error)
  }
  function onData (data) {
    if (first) {
      mps._writeBoundary(true)
      mps._writeBuffer(makeHeaders(mps, headers))
      first = false
    }
    mps._writeBuffer(data)
  }
  function onEnd () {
    cleanup()
    mps._next(callback)
  }
  function cleanup () {
    stream.removeListener('error', onError)
    stream.removeListener('data', onData)
    stream.removeListener('end', onEnd)
    mps._current_stream = null
    mps._done_boundary  = false
  }

  stream.once('error', onError)
  stream.on('data', onData)
  stream.once('end', onEnd)
}

/**
 * Do next item in queue.
 *
 * @param {Function} @optional callback
 * @param {Error} @optional error
 */
mp._next = function _next (callback, error) {
  this._writeBoundary()

  if (callback) {
    this._flush_callbacks.push(callback)
  }

  if (this._current_stream || this.paused) {
    return false
  }

  if (this._queue.length <= 0) {
    if (this._emit_drain) {
      this.emit('drain')
      this._emit_drain = false
    }

    this.waiting = false

    if (this._ending) {
      this._writeBuffer('--')
      this._flush()
      if ('function' === typeof this._ending) {
        this._ending.call(null, this)
      }
      this.readable = false
      this.emit('end')
    }

    return false
  }

  this._write(this._queue.shift())

  return true
}

/**
 * End
 *
 * @param {Function} @optional callback
 */
mp.end = function end (callback) {
  this._ending  = callback || true
  this.writable = false

  this._next()
  return true
}

/**
 * Destroy
 */
mp.destroy = function destroy () {
  if (this._current_stream) {
    this._current_stream.destroy()
    this._current_stream = null
  }

  this._queue      = new Queue()
  this._buffer     = []
  this.readable    = false
  this.writable    = false
  this.paused      = false
  this.waiting     = false
  this._emit_drain = false
  this._tick_flush = false

  return true
}

/**
 * Utility to create some form data
 *
 * @param {Object} data
 * @return {String}
 */
exports.createForm = function createForm (data, callback) {
  var mp  = new MultipartStream()
    , buf = []

  mp.on('data', function (chunk) {
    buf.push(chunk.toString())
  })

  mp.on('end', function () {
    buf = buf.join('')
    callback(null, buf, mp)
  })

  mp.writeForm({ data : data })

  mp.end()
}
