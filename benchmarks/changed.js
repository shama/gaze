'use strict';

var gaze = require('../');
var path = require('path');
var fs = require('fs');
var Benchmarker = require('./benchmarker');

var b = new Benchmarker({ name: path.basename(__filename) });
b.table.setHeading('files', 'ms').setAlign(0, 2).setAlign(1, 2);
b.run(function(num, done) {
  gaze('**/*', {cwd: b.tmpDir, maxListeners:0}, function(err, watcher) {
    if (err) {
      console.error(err.code + ': ' + err.message);
      return process.exit();
    }
    watcher.on('changed', function() {
      b.log(num, b.end());
      watcher.close();
    });
    watcher.on('end', done);
    var randFile = path.join(b.tmpDir, 'test-' + Math.floor(Math.random() * num) + '.txt');
    b.start();
    fs.writeFileSync(randFile, '1234');
  });
}, function() {
  process.exit();
});
