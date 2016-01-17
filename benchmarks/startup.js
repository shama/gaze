'use strict';

var gaze = require('../lib/gaze');
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
function createFiles (num, dir) {
  for (var i = 0; i <= num; i++) {
    fs.writeFileSync(path.join(dir, 'test-' + i + '.txt'), String(i));
  }
}

function teardown () {
  if (fs.existsSync(watchDir)) {
    rimraf.sync(watchDir);
  }
}

function setup (num) {
  teardown();
  fs.mkdirSync(watchDir);
  createFiles(num, watchDir);
}

function measureStart (cb) {
  var start = Date.now();
  var blocked, ready, watcher;
  // workaround #77
  var check = function () {
    if (ready && blocked) {
      cb(ready, blocked, watcher);
    }
  };
  gaze(watchDir + '/**/*', {maxListeners: 0}, function (err) {
    ready = Date.now() - start;
    watcher = this;
    check();
  });
  blocked = Date.now() - start;
  check();
}

function bench (num, cb) {
  setup(num);
  measureStart(function (time, blocked, watcher) {
    console.log(num, time);
    watcher.close();
    cb();
  });
}

console.log('numFiles startTime');
async.eachSeries(numFiles, bench, function () {
  teardown();
  console.log('done!');
  process.exit();
});
