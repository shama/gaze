'use strict';

var chokidar = require('chokidar');
var path = require('path');
var fs = require('fs');
var Benchmarker = require('../benchmarker');

var filepath = path.resolve(__dirname, '..', 'tmp', 'test-0.txt');
var watcher = chokidar.watch(filepath, { persistent: true });
watcher.on('all', function() {
  console.log(arguments)
});

setTimeout(function() {
  fs.unlinkSync(filepath);
}, 1000)

/*
var b = new Benchmarker({ name: path.basename(__filename) });
b.table.setHeading('files', 'ms').setAlign(0, 2).setAlign(1, 2);
b.run(function(num, done) {
  var watcher = chokidar.watch('.');
  watcher.on('all', function() {
    console.log(arguments)
    //b.log(num, b.end());
    watcher.close();
    done();
  });
  b.start();
  b.files.forEach(function(file) {
    console.log(file)
    watcher.add(file);
  });
  process.nextTick(function() {
    var randFile = b.files[Math.floor(Math.random() * num)];
    //console.log(randFile)
    //done();
    fs.writeFileSync(randFile, '1234');
  });
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
  * /
}, function() {
  process.exit();
});
*/