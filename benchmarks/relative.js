'use strict';

var gaze = require('../');
var async = require('async');
var fs = require('fs');
var rimraf = require('rimraf');
var path = require('path');

// Folder to watch
var watchDir = path.resolve(__dirname, 'watch');
var multiplesOf = 100;
var max = 2000;
var numFiles = [];
for (var i = 0; i <= max / multiplesOf; i++) {
  numFiles.push(i * multiplesOf);
}

var modFile = path.join(watchDir, 'test-' + numFiles + '.txt');

// Helper for creating mock files
function createFiles(num, dir) {
  for (var i = 0; i <= num; i++) {
    fs.writeFileSync(path.join(dir, 'test-' + i + '.txt'), String(i));
  }
}

function teardown() {
  if (fs.existsSync(watchDir)) {
    rimraf.sync(watchDir);
  }
}

function setup(num) {
  teardown();
  fs.mkdirSync(watchDir);
  createFiles(num, watchDir);
}

function bench(num, done) {
  setup(num);
  gaze('**/*', {cwd: watchDir, maxListeners:0}, function(err, watcher) {
    var start = process.hrtime();
    var files = this.relative('.');
    var diff = process.hrtime(start);
    var time = ((diff[0] * 1e9 + diff[1]) * 0.000001).toString().slice(0, 5);
    console.log(num + '\t\t' + time + 'ms');
    watcher.on('end', done);
    watcher.close();
  });
}

console.log('numFiles\ttime');
async.eachSeries(numFiles, bench, function() {
  teardown();
  console.log('done!');
  process.exit();
});