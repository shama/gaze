'use strict';

var Gaze = require('../lib/gaze.js').Gaze;
var path = require('path');

exports.add = {
  setUp: function(done) {
    process.chdir(path.resolve(__dirname, 'fixtures'));
    done();
  },
  addToWatched: function(test) {
    test.expect(1);
    var files = [
      'Project (LO)/',
      'Project (LO)/one.js',
      'nested/',
      'nested/one.js',
      'nested/three.js',
      'nested/sub/',
      'nested/sub/two.js',
      'one.js'
    ];
    var expected = {
      'Project (LO)/': ['one.js'],
      '.': ['Project (LO)/', 'nested/', 'one.js'],
      'nested/': ['one.js', 'three.js', 'sub/'],
      'nested/sub/': ['two.js']
    };
    var gaze = new Gaze('addnothingtowatch');
    gaze._addToWatched(files);
    test.deepEqual(gaze.relative(null, true), expected);
    test.done();
  }
};
