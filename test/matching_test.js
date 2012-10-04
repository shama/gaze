'use strict';

var gaze = require('../lib/gaze.js');
var path = require('path');

exports.matching = {
  setUp: function(done) {
    process.chdir(path.resolve(__dirname, 'fixtures'));
    done();
  },
  globAll: function(test) {
    test.expect(1);
    gaze('**/*', function() {
      test.deepEqual(this.relative(), {'.': ['one.js'], 'sub': ['one.js', 'two.js']});
      this.close();
      test.done();
    });
  },
  relativeDir: function(test) {
    test.expect(1);
    gaze('**/*', function() {
      test.deepEqual(this.relative('sub'), ['one.js', 'two.js']);
      this.close();
      test.done();
    });
  },
  globArray: function(test) {
    test.expect(1);
    gaze(['*.js', 'sub/*.js'], function() {
      test.deepEqual(this.relative(), {'.': ['one.js'], 'sub': ['one.js', 'two.js']});
      this.close();
      test.done();
    });
  }
};
