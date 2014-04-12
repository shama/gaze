'use strict';

var gaze = require('../');
var path = require('path');
var Benchmarker = require('./benchmarker');

var b = new Benchmarker({ name: path.basename(__filename) });
b.table.setHeading('files', 'ms').setAlign(0, 2).setAlign(1, 2);
b.run(function(num, done) {
  b.start();
  gaze('**/*', {cwd: b.tmpDir, maxListeners:0}, function(err, watcher) {
    if (err) {
      console.error(err.code + ': ' + err.message);
      return process.exit();
    }
    b.log(num, b.end());
    watcher.on('end', done);
    watcher.close();
  });
}, function() {
  process.exit();
});
