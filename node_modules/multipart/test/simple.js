var multipart = require('../')
  , fs        = require('fs')
  , mp        = multipart.createMultipartStream()
  , mp2       = multipart.createMultipartStream()
  , file

console.log = function () {}

process.stdout.write('HEADERS\r\n\r\n')
mp.pipe(process.stdout)

mp.writeForm(
  { data    :
    { key   : 'value'
    , test  : 'ing'
    }
  }
, function () {
    console.log('FORMWRITTEN')
  }
)

mp.write(
  { 'Content-Disposition' : 'form-data; name="files"'
  , 'Content-Type'        : mp2.contentType(mp)
  }
, mp2
, function () {
    console.log('FILESWRITTEN')
  }
)

mp2.writeFile({ filename : '/tmp/js.js' }, function () {
  console.log('FILEWRITTEN')
})

mp2.end(function () {
  console.log('DONE2')
})

mp.end(function () {
  console.log('DONE')
})
