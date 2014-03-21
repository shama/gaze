'use strict';

var async = require('async');
var fs = require('fs');
var rimraf = require('rimraf');
var path = require('path');
var AsciiTable = require('ascii-table');
var readline = require('readline');

function Benchmarker(opts) {
  if (!(this instanceof Benchmarker)) return new Benchmarker(opts);
  opts = opts || {};
  this.table = new AsciiTable(opts.name || 'benchmark');
  this.tmpDir = opts.tmpDir || path.resolve(__dirname, 'tmp');
  var max = opts.max || 2000;
  var multiplesOf = opts.multiplesOf || 100;
  this.files = [];
  for (var i = 0; i <= max / multiplesOf; i++) {
    this.files.push(i * multiplesOf);
  }
  this.startTime = 0;
}
module.exports = Benchmarker;

Benchmarker.prototype.log = function() {
  readline.cursorTo(process.stdout, 0, 0);
  readline.clearScreenDown(process.stdout);
  this.table.addRow.apply(this.table, arguments);
  console.log(this.table.toString());
};

Benchmarker.prototype.setup = function(num) {
  this.teardown();
  fs.mkdirSync(this.tmpDir);
  for (var i = 0; i <= num; i++) {
    fs.writeFileSync(path.join(this.tmpDir, 'test-' + i + '.txt'), String(i));
  }
};

Benchmarker.prototype.teardown = function() {
  if (fs.existsSync(this.tmpDir)) {
    rimraf.sync(this.tmpDir);
  }
};

Benchmarker.prototype.run = function(fn, done) {
  var self = this;
  async.eachSeries(this.files, function(num, next) {
    self.setup(num);
    fn(num, next);
  }, function() {
    self.teardown();
    done();
  });
};

Benchmarker.prototype.start = function() {
  this.startTime = process.hrtime();
};

Benchmarker.prototype.end = function(radix) {
  var diff = process.hrtime(this.startTime);
  return ((diff[0] * 1e9 + diff[1]) * 0.000001).toFixed(radix || 2).replace(/\d(?=(\d{3})+\.)/g, '$&,') + 'ms';
};
