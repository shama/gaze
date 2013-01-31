'use strict';

var Gaze = require('../lib/gaze.js');
var path = require('path');
var fs = require('fs');
var gaze;

// Node v0.6 compat
fs.existsSync = fs.existsSync || path.existsSync;

// Clean up helper to call in setUp and tearDown
function deleteFiles(done) {
  [
    'safewrite.js'
  ].forEach(function(d) {
    var p = path.resolve(__dirname, 'fixtures', d);
    if (fs.existsSync(p)) { fs.unlinkSync(p); }
  });
  done();
}

exports.safewrite = {
  setUp: function(done) {
    process.chdir(path.resolve(__dirname, 'fixtures'));
    deleteFiles(done);
  },
  tearDown: function(done) {
    gaze.close();
    gaze = null;
    deleteFiles(done);
  },
  safewrite: function(test) {
    test.expect(4);

    var times = 0;
    var file = path.resolve(__dirname, 'fixtures', 'safewrite.js');
    var backup = path.resolve(__dirname, 'fixtures', 'safewrite.ext~');
    fs.writeFileSync(file, 'var safe = true;');

    function simSafewrite() {
      fs.writeFileSync(backup, fs.readFileSync(file));
      fs.unlinkSync(file);
      fs.renameSync(backup, file);
      times++;
    }

    gaze = Gaze('**/*', function(err, watcher) {
      watcher.on('all', function(action, filepath) {
        test.equal(action, 'changed');
        test.equal(path.basename(filepath), 'safewrite.js');

        if (times < 2) {
          setTimeout(simSafewrite, 1000);
        } else {
          test.done();
        }
      });

      setTimeout(function() {
        simSafewrite();
      }, 1000);
    });
  }
};
