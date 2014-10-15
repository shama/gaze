'use strict';

var gaze = require('../../');
var path = require('path');
var fs = require('fs');
var Benchmarker = require('../benchmarker');

var b = new Benchmarker({ name: path.basename(__filename) });
b.table.setHeading('files', 'ms').setAlign(0, 2).setAlign(1, 2);
b.run(function(num, done) {
  var watchers = [];
  function changed() {
    b.log(num, b.end());
    for (var i = 0; i < watchers.length; i++) {
      watchers[i].close();
    }
    process.nextTick(done);
  }
  for (var i = 0; i < b.files.length; i++) {
    fs.watch(b.files[i], changed);
  }
  console.log(b.files.length)
  var randFile = b.files[Math.floor(Math.random() * b.files.length)];
  b.start();
  process.nextTick(function() {
    console.log('write', randFile)
    fs.writeFileSync(randFile, '1234');
  });

  //fs.watch()
  /*
  gaze('** /*', {cwd: b.tmpDir, maxListeners:0}, function(err, watcher) {
    watcher.on('changed', function() {
      b.log(num, b.end());
      watcher.close();
    });
    watcher.on('end', done);
    var randFile = path.join(b.tmpDir, 'test-' + Math.floor(Math.random() * num) + '.txt');
    b.start();
    fs.writeFileSync(randFile, '1234');
  });
  */
}, function() {
  process.exit();
});
