'use strict';

var gaze = require('../../');
var path = require('path');
var fs = require('fs');
var touch = require('touch');

var fixtures = path.resolve(__dirname, '..', 'fixtures');

exports.touch = {
  setUp: function(done) {
    process.chdir(fixtures);
    done();
  },
  touch: function(test) {
    test.expect(1);
    gaze('**/*', function() {
      this.on('end', test.done);
      this.on('all', function(status, filepath) {
        test.equal(path.relative(fixtures, filepath), 'one.js');
        this.close();
      }.bind(this));
      var file = path.join(fixtures, 'one.js');
      touch.sync(file, { nocreate: true, time: new Date() });
      setTimeout(this.close.bind(this), 1000);
    });
    
  },
};
