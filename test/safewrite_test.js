'use strict';

var gaze = require('../index.js');
var path = require('path');
var fs = require('fs');

// Intentional globals
var orgFilename = 'safewrite.js';
var backupFilename = 'safewrite.ext~';

// Clean up helper to call in setUp and tearDown
function cleanUp(done) {
  [
    orgFilename,
    backupFilename
  ].forEach(function(d) {
    var p = path.resolve(__dirname, 'fixtures', d);
    if (fs.existsSync(p)) { fs.unlinkSync(p); }
  });

  // Prevent bleeding
  if(done) {
    setTimeout(done, 500);
  }
}

exports.safewrite = {
  setUp: function(done) {
    process.chdir(path.resolve(__dirname, 'fixtures'));
    cleanUp(done);
  },
  tearDown: cleanUp,
  safewrite: function(test) {
    test.expect(2);

    var file = path.resolve(__dirname, 'fixtures', orgFilename);
    var backup = path.resolve(__dirname, 'fixtures', backupFilename);
    fs.writeFileSync(file, 'var safe = true;');

    function simSafewrite() {
      var content = fs.readFileSync(file);
      fs.unlinkSync(file);
      fs.writeFileSync(backup, content);
      fs.renameSync(backup, file);
    }

    gaze('**/*', function(err, watcher) {
      this.on('end', test.done);
      this.on('all', function(action, filepath) {
        test.equal(action, 'changed');
        test.equal(path.basename(filepath), orgFilename);
        watcher.close();
      });
      simSafewrite();
    });
  }
};

// :'| Ignoring these tests on linux for now
if (process.platform === 'linux') {
  exports.safewrite = {};
}
