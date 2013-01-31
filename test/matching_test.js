'use strict';

var Gaze = require('../lib/gaze.js');
var path = require('path');
var gaze;

exports.matching = {
  setUp: function(done) {
    process.chdir(path.resolve(__dirname, 'fixtures'));
    done();
  },
  tearDown: function(done) {
    gaze.close();
    gaze = null;
    done();
  },
  globAll: function(test) {
    test.expect(2);
    gaze = Gaze('**/*', function(err, watcher) {
      var result = watcher.relative(null, true);
      test.deepEqual(result['.'], ['Project (LO)/', 'nested/', 'one.js', 'sub/']);
      test.deepEqual(result['sub/'], ['one.js', 'two.js']);
      test.done();
    });
  },
  relativeDir: function(test) {
    test.expect(1);
    gaze = Gaze('**/*', function(err, watcher) {
      test.deepEqual(watcher.relative('sub', true), ['one.js', 'two.js']);
      test.done();
    });
  },
  globArray: function(test) {
    test.expect(2);
    gaze = Gaze(['*.js', 'sub/*.js'], function(err, watcher) {
      var result = watcher.relative(null, true);
      test.deepEqual(result['.'], ['one.js']);
      test.deepEqual(result['sub/'], ['one.js', 'two.js']);
      test.done();
    });
  },
  globArrayDot: function(test) {
    test.expect(1);
    gaze = Gaze(['sub/*.js'], function(err, watcher) {
      var result = watcher.relative(null, true);
      test.deepEqual(result['sub/'], ['one.js', 'two.js']);
      test.done();
    });
  },
  oddName: function(test) {
    test.expect(1);
    gaze = Gaze(['Project (LO)/*.js'], function(err, watcher) {
      var result = watcher.relative(null, true);
      test.deepEqual(result['Project (LO)/'], ['one.js']);
      test.done();
    });
  }
};
