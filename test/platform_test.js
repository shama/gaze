'use strict';

var platform = require('../lib/platform.js');
var helper = require('./helper.js');
var path = require('path');
var grunt = require('grunt');
var async = require('async');
var globule = require('globule');

var fixturesbase = path.resolve(__dirname, 'fixtures');

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
    platform.mode = 'auto';
    this.interval = setInterval(platform.tick.bind(platform), 200);
    cleanUp();
    done();
  },
  tearDown: function(done) {
    clearInterval(this.interval);
    platform.closeAll();
    cleanUp();
    done();
  },
  watchSameFile: function(test) {
    test.expect(2);
    var count = 0;
    function done() {
      if (count > 0) {
        test.done();
      } else {
        count++;
      }
    }
    var filename = path.join(fixturesbase, 'one.js');
    platform(filename, function(err, event, filepath) {
      test.equal(filepath, filename);
      done();
    });
    platform(filename, function(err, event, filepath) {
      test.equal(filepath, filename);
      done();
    });
    setTimeout(function() {
      grunt.file.write(filename, grunt.file.read(filename));
    }, 200);
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
        platform.closeAll();
        done();
      });

      runWithPoll(mode, function() {
        expectfilepath = filename;
        grunt.file.write(filename, grunt.file.read(filename));
      });
    }

    async.series([
      function(next) { runtest('one.js', 'auto', next); },
      function(next) {
        // Polling needs a minimum of 500ms to pick up changes.
        setTimeout(function() {
          runtest('one.js', 'poll', next);
        }, 500);
      },
    ], test.done);
  },
  delete: function(test) {
    test.expect(4);
    var expectfilepath = null;

    function runtest(file, mode, done) {
      var filename = path.join(fixturesbase, file);
      platform.mode = mode;

      platform(filename, function(error, event, filepath) {
        // Ignore change events from dirs. This is handled outside of the platform and are safe to ignore here.
        if (event === 'change' && grunt.file.isDir(filepath)) {
          return;
        }
        test.equal(event, 'delete', 'should have been a delete event in ' + mode + ' mode.');
        test.equal(filepath, expectfilepath, 'should have triggered on the correct file in ' + mode + ' mode.');
        platform.closeAll();
        done();
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
        // Polling needs a minimum of 500ms to pick up changes.
        setTimeout(function() {
          runtest('add.js', 'poll', next);
        }, 500);
      },
    ], test.done);
  },
  getWatchedPaths: function(test) {
    test.expect(1);
    var expected = globule.find(['**/*.js'], { cwd: fixturesbase, prefixBase: fixturesbase });
    var len = expected.length;
    var emptyFunc = function() {};

    for (var i = 0; i < len; i++) {
      platform(expected[i], emptyFunc);
      var parent = path.dirname(expected[i]);
      expected.push(parent + '/');
    }
    expected = helper.unixifyobj(helper.lib.unique(expected));

    var actual = helper.unixifyobj(platform.getWatchedPaths());
    test.deepEqual(actual.sort(), expected.sort());
    test.done();
  },
};

// Ignore this test if node v0.8 as platform will never be used there
var version = process.versions.node.split('.');
if (version[0] === '0' && version[1] === '8') {
  exports.platform = {};
}

// :'| Ignoring these tests on linux for now
if (process.platform === 'linux') {
  exports.platform = {};
}
