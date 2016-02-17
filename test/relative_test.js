'use strict';

var Gaze = require('../lib/gaze.js').Gaze;
var helper = require('./helper.js');
var path = require('path');

exports.relative = {
  setUp: function (done) {
    process.chdir(path.resolve(__dirname, 'fixtures'));
    done();
  },
  relative: function (test) {
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
    var gaze = new Gaze('addnothingtowatch');
    gaze._addToWatched(files);
    helper.deepEqual(test, gaze.relative('.', true), ['Project (LO)/', 'nested/', 'one.js', 'sub/']);
    gaze.on('end', test.done);
    gaze.close();
  }
};
