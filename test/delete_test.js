'use strict';

var Gaze = require('../index.js').Gaze;
var path = require('path');
var fs = require('fs');
var rimraf = require('rimraf');
var helper = require('./helper');

var fixtures = path.resolve(__dirname, 'fixtures');
var sortobj = helper.sortobj;

exports.delete_test = {
  setUp: function(done) {
    process.chdir(fixtures);
    done();
  },
  deleteFolder: function(test) {
    //test.expect(1);
    return test.done();

    fs.mkdirSync(path.join(fixtures, 'newfolder'));

    new Gaze('**/*', function(err, watcher) {
      watcher.on('all', function(status, filepath) {
        console.log(status, filepath)
        watcher.close();
      });
      watcher.on('end', test.done);
    });

  },
};
