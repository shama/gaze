'use strict';

var platform = require('../lib/platform.js');
var path = require('path');
var grunt = require('grunt');
var async = require('async');

var fixturesbase = path.resolve(__dirname, 'fixtures');

// Start the poller
var interval = setInterval(platform.tick.bind(platform), 200);

// helpers
function cleanUp() {
  ['add.js'].forEach(function(file) {
    grunt.file.delete(path.join(fixturesbase, file));
  });
}
function runWithPoll(mode, cb) {
  if (mode === 'poll') {
    // Polling unfortunately needs time to pick up stat
    setTimeout(cb, 1000);
  } else {
    cb();
  }
}

exports.platform = {
  setUp: function(done) {
    cleanUp();
    done();
  },
  tearDown: function(done) {
    platform.closeAll();
    cleanUp();
    done();
  },
  change: function(test) {
    test.expect(4);
    var expectfilepath = null;

    function runtest(file, mode, done) {
      var filename = path.join(fixturesbase, file);
      platform.mode = mode;

      platform(filename, function(error, event, filepath) {
        test.equal(event, 'change', 'should have been a change event.');
        test.equal(filepath, expectfilepath, 'should have triggered on the correct file.');
        platform.close(filepath, done);
      });

      runWithPoll(mode, function() {
        expectfilepath = filename;
        grunt.file.write(filename, grunt.file.read(filename));
      });
    }

    async.series([
      function(next) { runtest('one.js', 'auto', next); },
      function(next) { runtest('one.js', 'poll', next); },
    ], test.done);
  },
  delete: function(test) {
    test.expect(4);
    var expectfilepath = null;

    function runtest(file, mode, done) {
      var filename = path.join(fixturesbase, file);
      platform.mode = mode;

      platform(filename, function(error, event, filepath) {
        test.equal(event, 'delete', 'should have been a delete event.');
        test.equal(filepath, expectfilepath, 'should have triggered on the correct file.');
        platform.close(filepath, done);
      });

      runWithPoll(mode, function() {
        expectfilepath = filename;
        grunt.file.delete(filename);
      });
    }

    async.series([
      function(next) {
        grunt.file.write(path.join(fixturesbase, 'add.js'), 'var test = true;');
        runtest('add.js', 'auto', next);
      },
      function(next) {
        grunt.file.write(path.join(fixturesbase, 'add.js'), 'var test = true;');
        runtest('add.js', 'poll', next);
      },
    ], test.done);
  },
};
