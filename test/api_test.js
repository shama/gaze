'use strict';

var Gaze = require('../lib/gaze.js');
var path = require('path');
var gaze;

exports.api = {
  setUp: function(done) {
    process.chdir(path.resolve(__dirname, 'fixtures'));
    done();
  },
  tearDown: function(done) {
    gaze.close();
    gaze = null;
    done();
  },
  newGaze: function(test) {
    test.expect(2);
    gaze = new Gaze.Gaze('**/*', {}, function() {
      var result = this.relative(null, true);
      test.deepEqual(result['.'], ['Project (LO)/', 'nested/', 'one.js', 'sub/']);
      test.deepEqual(result['sub/'], ['one.js', 'two.js']);
      test.done();
    });
  },
  func: function(test) {
    test.expect(1);
    gaze = Gaze('**/*', function(err, watcher) {
      test.deepEqual(watcher.relative('sub', true), ['one.js', 'two.js']);
      test.done();
    });
  },
  ready: function(test) {
    test.expect(1);
    gaze = new Gaze.Gaze('**/*');
    gaze.on('ready', function(watcher) {
      test.deepEqual(watcher.relative('sub', true), ['one.js', 'two.js']);
      test.done();
    });
  }
};
