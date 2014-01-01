'use strict';

var platform = require('../lib/platform.js');
var helper = require('../lib/helper.js');
var path = require('path');
var grunt = require('grunt');
var async = require('async');
var globule = require('globule');

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
    // Watch delays 10ms when adding, so delay double just in case
    setTimeout(cb, 20);
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
        test.equal(event, 'change', 'should have been a change event in ' + mode + ' mode.');
        test.equal(filepath, expectfilepath, 'should have triggered on the correct file in ' + mode + ' mode.');
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
        // Ignore change events on folders here as they're expected but should be ignored
        if (event === 'change' && grunt.file.isDir(filepath)) return;
        test.equal(event, 'delete', 'should have been a delete event in ' + mode + ' mode.');
        test.equal(filepath, expectfilepath, 'should have triggered on the correct file in ' + mode + ' mode.');
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
  getWatchedPaths: function(test) {
    test.expect(1);
    var expected = globule.find(['**/*.js'], { cwd: fixturesbase, prefixBase: fixturesbase });
    var len = expected.length;
    for (var i = 0; i < len; i++) {
      platform(expected[i], function() {});
      var parent = path.dirname(expected[i]);
      expected.push(parent + '/');
    }
    expected = helper.unique(expected);

    var actual = platform.getWatchedPaths();
    test.deepEqual(actual.sort(), expected.sort());
    test.done();
  },
};
