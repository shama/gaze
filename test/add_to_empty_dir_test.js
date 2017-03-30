'use strict';

var Gaze = require('../lib/gaze.js').Gaze;
var path = require('path');
var fs = require('fs');
var helper = require('./helper');
var globule = require('globule');

var fixtures = path.resolve(__dirname, 'fixtures');

exports.add_to_empty_dir = {
  setUp: function (done) {
    process.chdir(fixtures);
    done();
  },
  addToEmpty: function (test) {
    var gaze = new Gaze('*', {cwd: 'empty'});
    fs.writeFileSync('empty/foo');
    gotAddEvent = false;
    gaze.on('added', function () {
      gotAddEvent = true;
    });
    gaze.on('end', function () {
      test.expect(gotAddEvent);
      test.done();
    });
    // hopefully this will let the 'file added' event be reported
    // in time...
    setTimeout( () => gaze.close(), 200);
  },
};
