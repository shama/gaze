'use strict';

var Gaze = require('../lib/gaze.js');
var path = require('path');
var gaze;

exports.relative = {
  setUp: function(done) {
    process.chdir(path.resolve(__dirname, 'fixtures'));
    done();
  },
  tearDown: function(done) {
    gaze.close();
    gaze = null;
    done();
  },
  relative: function(test) {
    test.expect(1);
    gaze = Gaze(['**/*.js'], function(err, watcher) {
      test.deepEqual(watcher.relative(null, true), { 
        'Project (LO)/': ['one.js'],
        'nested/': ['one.js', 'three.js'],
        'nested/sub/': ['two.js'],
        '.': ['one.js'],
        'sub/': ['one.js', 'two.js']
      });
      test.done();
    });
  }
};
