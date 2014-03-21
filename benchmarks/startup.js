'use strict';

var gaze = require('../lib/gaze');
var async = require('async');
var fs = require('fs');
var rimraf = require('rimraf');
var path = require('path');
var AsciiTable = require('ascii-table');
var readline = require('readline');
var table = new AsciiTable(path.basename(__filename));

// Folder to watch
var watchDir = path.resolve(__dirname, 'watch');
var multiplesOf = 100;
var max = 2000;
var numFiles = [];
for (var i = 0; i <= max / multiplesOf; i++) {
  numFiles.push(i * multiplesOf);
}

var modFile = path.join(watchDir, 'test-' + numFiles + '.txt');

function logRow() {
  readline.cursorTo(process.stdout, 0, 0);
  readline.clearScreenDown(process.stdout);
  table.addRow.apply(table, arguments);
  console.log(table.toString());
}

// Helper for creating mock files
function createFiles(num, dir) {
  for (var i = 0; i <= num; i++) {
    fs.writeFileSync(path.join(dir, 'test-' + i + '.txt'), String(i));
  }
}

function teardown(){
  if (fs.existsSync(watchDir)) {
    rimraf.sync(watchDir);
  }
}

function setup(num){
  teardown();
  fs.mkdirSync(watchDir);
  createFiles(num, watchDir);
}

function bench(num, done) {
  setup(num);
  var start = process.hrtime();
  gaze('**/*', {cwd: watchDir, maxListeners:0}, function(err, watcher) {
    var diff = process.hrtime(start);
    var time = ((diff[0] * 1e9 + diff[1]) * 0.000001).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
    logRow(num, time + 'ms');
    watcher.on('end', done);
    watcher.close();
  });
}

table.setHeading('files', 'ms')
  .setAlign(0, AsciiTable.RIGHT)
  .setAlign(1, AsciiTable.RIGHT);
async.eachSeries(numFiles, bench, function(){
  teardown();
  process.exit();
});