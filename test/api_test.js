'use strict';

var gaze = require('../lib/gaze.js');
var path = require('path');

exports.api = {
  setUp: function(done) {
    process.chdir(path.resolve(__dirname, 'fixtures'));
    done();
  },
  newGaze: function(test) {
    test.expect(1);
    new gaze.Gaze('**/*', {}, function() {
      test.deepEqual(this.relative(), {'.': ['one.js'], 'sub': ['one.js', 'two.js']});
      this.close();
      test.done();
    });
  },
  func: function(test) {
    test.expect(1);
    var g = gaze('**/*', function(err, watcher) {
      test.deepEqual(watcher.relative('sub'), ['one.js', 'two.js']);
      g.close();
      test.done();
    });
  },
  ready: function(test) {
    test.expect(1);
    var g = new gaze.Gaze('**/*');
    g.on('ready', function(watcher) {
      test.deepEqual(watcher.relative('sub'), ['one.js', 'two.js']);
      this.close();
      test.done();
    });
  }
};
