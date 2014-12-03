'use strict';

var gaze = require('../index.js');
var grunt = require('grunt');
var path = require('path');
var fs = require('fs');
var helper = require('./helper.js');

// Clean up helper to call in setUp and tearDown
function cleanUp(done) {
  [
    'sub/tmp.js',
    'sub/tmp',
    'sub/renamed.js',
    'added.js',
    'nested/added.js',
    'nested/.tmp',
    'nested/sub/added.js',
    'new_dir',
    'edited.js',
  ].forEach(function(d) {
    grunt.file.delete(path.resolve(__dirname, 'fixtures', d));
  });

  // Delay between tests to prevent bleed
  setTimeout(done, 500);
}

exports.watch = {
  setUp: function(done) {
    process.chdir(path.resolve(__dirname, 'fixtures'));
    cleanUp(done);
  },
  tearDown: cleanUp,
  remove: function(test) {
    test.expect(2);
    gaze('**/*', function() {
      this.remove(path.resolve(__dirname, 'fixtures', 'sub', 'two.js'));
      this.remove(path.resolve(__dirname, 'fixtures'));
      this.relative(null, true, function(err, result) {
        test.deepEqual(result['sub/'], ['one.js']);
        test.notDeepEqual(result['./'], ['one.js']);
        this.on('end', test.done);
        this.close();
      }.bind(this));
    });
  },
  changed: function(test) {
    test.expect(1);
    gaze('**/*', function(err, watcher) {
      watcher.on('changed', function(filepath) {
        var expected = path.relative(process.cwd(), filepath);
        test.equal(path.join('sub', 'one.js'), expected);
        watcher.close();
      });
      this.on('added', function() { test.ok(false, 'added event should not have emitted.'); });
      this.on('deleted', function() { test.ok(false, 'deleted event should not have emitted.'); });
      fs.writeFileSync(path.resolve(__dirname, 'fixtures', 'sub', 'one.js'), 'var one = true;');
      watcher.on('end', test.done);
    });
  },
  added: function(test) {
    test.expect(1);
    gaze('**/*', function(err, watcher) {
      this.on('added', function(filepath) {
        var expected = path.relative(process.cwd(), filepath);
        test.equal(path.join('sub', 'tmp.js'), expected);
        watcher.close();
      });
      this.on('changed', function() { test.ok(false, 'changed event should not have emitted.'); });
      this.on('deleted', function() { test.ok(false, 'deleted event should not have emitted.'); });
      fs.writeFileSync(path.resolve(__dirname, 'fixtures', 'sub', 'tmp.js'), 'var tmp = true;');
      watcher.on('end', test.done);
    });
  },
  dontAddUnmatchedFiles: function(test) {
    // TODO: Code smell
    test.expect(3);
    gaze('**/*.js', function(err, watcher) {
      setTimeout(function() {
        test.ok(true, 'Ended without adding a file.');
        watcher.close();
      }, 1000);
      this.on('added', function(filepath) {
        test.equal(path.relative(process.cwd(), filepath), path.join('sub', 'tmp.js'));
      });
      fs.writeFileSync(path.resolve(__dirname, 'fixtures', 'sub', 'tmp'), 'Dont add me!');
      fs.writeFileSync(path.resolve(__dirname, 'fixtures', 'sub', 'tmp.js'), 'add me!');
      watcher.on('end', test.done);
    });
  },
  dontAddCwd: function(test) {
    test.expect(2);
    gaze('nested/**', function(err, watcher) {
      setTimeout(function() {
        test.ok(true, 'Ended without adding a file.');
        watcher.close();
      }, 1000);
      this.on('all', function(ev, filepath) {
        test.equal(path.relative(process.cwd(), filepath), path.join('nested', 'sub', 'added.js'));
      });
      fs.mkdirSync(path.resolve(__dirname, 'fixtures', 'new_dir'));
      fs.writeFileSync(path.resolve(__dirname, 'fixtures', 'added.js'), 'Dont add me!');
      fs.writeFileSync(path.resolve(__dirname, 'fixtures', 'nested', 'sub', 'added.js'), 'add me!');
      watcher.on('end', test.done);
    });
  },
  dontAddMatchedDirectoriesThatArentReallyAdded: function(test) {
    // This is a regression test for a bug I ran into where a matching directory would be reported
    // added when a non-matching file was created along side it.  This only happens if the
    // directory name doesn't occur in $PWD.
    test.expect(1);
    gaze('**/*', function(err, watcher) {
      setTimeout(function() {
        test.ok(true, 'Ended without adding a file.');
        watcher.close();
      }, 1000);
      this.on('added', function(filepath) {
        test.notEqual(path.relative(process.cwd(), filepath), path.join('nested', 'sub2'));
      });
      fs.writeFileSync(path.resolve(__dirname, 'fixtures', 'nested', '.tmp'), 'Wake up!');
      watcher.on('end', test.done);
    });
  },
  deleted: function(test) {
    test.expect(1);
    var tmpfile = path.resolve(__dirname, 'fixtures', 'sub', 'deleted.js');
    fs.writeFileSync(tmpfile, 'var tmp = true;');
    // TODO: This test fails on travis (but not on my local ubuntu) so use polling here
    // as a way to ignore until this can be fixed
    var mode = (process.platform === 'linux') ? 'poll' : 'auto';
    gaze('**/*', { mode: mode }, function(err, watcher) {
      watcher.on('deleted', function(filepath) {
        test.equal(path.join('sub', 'deleted.js'), path.relative(process.cwd(), filepath));
        watcher.close();
      });
      this.on('changed', function() { test.ok(false, 'changed event should not have emitted.'); });
      this.on('added', function() { test.ok(false, 'added event should not have emitted.'); });
      fs.unlinkSync(tmpfile);
      watcher.on('end', test.done);
    });
  },
  dontEmitTwice: function(test) {
    test.expect(2);
    gaze('**/*', function(err, watcher) {
      watcher.on('all', function(status, filepath) {
        var expected = path.relative(process.cwd(), filepath);
        test.equal(path.join('sub', 'one.js'), expected);
        test.equal(status, 'changed');
        fs.readFileSync(path.resolve(__dirname, 'fixtures', 'sub', 'one.js'));
        setTimeout(function() {
          fs.readFileSync(path.resolve(__dirname, 'fixtures', 'sub', 'one.js'));
        }, 1000);
        // Give some time to accidentally emit before we close
        setTimeout(function() { watcher.close(); }, 5000);
      });
      setTimeout(function() {
        fs.writeFileSync(path.resolve(__dirname, 'fixtures', 'sub', 'one.js'), 'var one = true;');
      }, 1000);
      watcher.on('end', test.done);
    });
  },
  emitTwice: function(test) {
    test.expect(2);
    var times = 0;
    gaze('**/*', function(err, watcher) {
      watcher.on('all', function(status, filepath) {
        test.equal(status, 'changed');
        times++;
        setTimeout(function() {
          if (times < 2) {
            fs.writeFileSync(path.resolve(__dirname, 'fixtures', 'sub', 'one.js'), 'var one = true;');
          } else {
            watcher.close();
          }
        }, 1000);
      });
      setTimeout(function() {
        fs.writeFileSync(path.resolve(__dirname, 'fixtures', 'sub', 'one.js'), 'var one = true;');
      }, 1000);
      watcher.on('end', test.done);
    });
  },
  nonExistent: function(test) {
    test.expect(1);
    gaze('non/existent/**/*', function(err, watcher) {
      test.ok(true);
      watcher.on('end', test.done);
      watcher.close();
    });
  },
  differentCWD: function(test) {
    test.expect(1);
    var cwd = path.resolve(__dirname, 'fixtures', 'sub');
    gaze('two.js', {
      cwd: cwd
    }, function(err, watcher) {
      watcher.on('changed', function(filepath) {
        this.relative(function(err, result) {
          test.deepEqual(result, {'./':['two.js']});
          watcher.close();
        });
      });
      fs.writeFileSync(path.resolve(cwd, 'two.js'), 'var two = true;');
      watcher.on('end', test.done);
    });
  },
  addedEmitInSubFolders: function(test) {
    test.expect(4);
    var adds = [
      { pattern: '**/*', file: path.resolve(__dirname, 'fixtures', 'nested', 'sub', 'added.js') },
      { pattern: '**/*', file: path.resolve(__dirname, 'fixtures', 'added.js') },
      { pattern: 'nested/**/*', file: path.resolve(__dirname, 'fixtures', 'nested', 'added.js') },
      { pattern: 'nested/sub/*.js', file: path.resolve(__dirname, 'fixtures', 'nested', 'sub', 'added.js') },
    ];
    grunt.util.async.forEachSeries(adds, function(add, next) {
      new gaze.Gaze(add.pattern, function(err, watcher) {
        watcher.on('added', function(filepath) {
          test.equal('added.js', path.basename(filepath));
          fs.unlinkSync(filepath);
          watcher.close();
          next();
        });
        watcher.on('changed', function() { test.ok(false, 'changed event should not have emitted.'); });
        watcher.on('deleted', function() { test.ok(false, 'deleted event should not have emitted.'); });
        fs.writeFileSync(add.file, 'var added = true;');
      });
    }, function() {
      test.done();
    });
  },
  multipleWatchersSimultaneously: function(test) {
    test.expect(2);
    var did = 0;
    var ready = 0;
    var cwd = path.resolve(__dirname, 'fixtures', 'sub');
    var watchers = [];
    var timeout = setTimeout(function() {
      for (var i = 0; i < watchers.length; i++) {
        watchers[i].close();
        delete watchers[i];
      }
      test.done();
    }, 1000);

    function isReady() {
      ready++;
      if (ready > 1) {
        fs.writeFileSync(path.resolve(cwd, 'one.js'), 'var one = true;');
      }
    }
    function changed(filepath) {
      test.equal(path.join('sub', 'one.js'), path.relative(process.cwd(), filepath));
    }
    for (var i = 0; i < 2; i++) {
      watchers[i] = new gaze.Gaze('sub/one.js');
      watchers[i].on('changed', changed);
      watchers[i].on('ready', isReady);
    }
  },
  mkdirThenAddFile: function(test) {
    var expected = [
      'new_dir/first.js',
      'new_dir/other.js',
    ];
    test.expect(expected.length);

    gaze('**/*.js', function(err, watcher) {
      watcher.on('all', function(status, filepath) {
        var expect = expected.shift();
        var actual = helper.unixifyobj(path.relative(process.cwd(), filepath));
        test.equal(actual, expect);

        if (expected.length === 1) {
          // Ensure the new folder is being watched correctly after initial add
          setTimeout(function() {
            fs.writeFileSync('new_dir/dontmatch.txt', '');
            setTimeout(function() {
              fs.writeFileSync('new_dir/other.js', '');
            }, 1000);
          }, 1000);
        }

        if (expected.length < 1) { watcher.close(); }
      });

      fs.mkdirSync('new_dir'); //fs.mkdirSync([folder]) seems to behave differently than grunt.file.write('[folder]/[file]')
      fs.writeFileSync(path.join('new_dir', 'first.js'), '');

      watcher.on('end', test.done);
    });
  },
  mkdirThenAddFileWithGruntFileWrite: function(test) {
    var expected = [
      'new_dir/tmp.js',
      'new_dir/other.js',
    ];
    test.expect(expected.length);

    gaze('**/*.js', function(err, watcher) {
      watcher.on('all', function(status, filepath) {
        var expect = expected.shift();
        var actual = helper.unixifyobj(path.relative(process.cwd(), filepath));
        test.equal(actual, expect);

        if (expected.length === 1) {
          // Ensure the new folder is being watched correctly after initial add
          setTimeout(function() {
            fs.writeFileSync('new_dir/dontmatch.txt', '');
            setTimeout(function() {
              fs.writeFileSync('new_dir/other.js', '');
            }, 1000);
          }, 1000);
        }

        if (expected.length < 1) { watcher.close(); }
      });

      grunt.file.write('new_dir/tmp.js', '');

      watcher.on('end', test.done);
    });
  },
  enoentSymlink: function(test) {
    test.expect(1);
    fs.mkdirSync(path.resolve(__dirname, 'fixtures', 'new_dir'));
    try {
      fs.symlinkSync(path.resolve(__dirname, 'fixtures', 'not-exists.js'), path.resolve(__dirname, 'fixtures', 'new_dir', 'not-exists-symlink.js'));
    } catch (err) {
      // If we cant create symlinks, just ignore this tests (likely needs admin on win)
      test.ok(true);
      return test.done();
    }
    gaze('**/*', function() {
      test.ok(true);
      this.on('end', test.done);
      this.close();
    });
  },
  debounceTiming: function(test) {
    test.expect(1);
    gaze('**/*', function(err, watcher) {
      var lastContent = '';
      watcher.on('all', function(filepath) {
        lastContent = fs.readFileSync(path.resolve(__dirname, 'fixtures', 'edited.js')).toString();
      });
      watcher.on('end', function() {
        test.equal(lastContent, '4', 'should catch the last changed event.');
        test.done();
      });

      var count = 0;
      var timer = setInterval(function() {
        fs.writeFileSync(path.resolve(__dirname, 'fixtures', 'edited.js'), count);
        count++;
        if (count > 4) {
          clearTimeout(timer);
          setTimeout(function () { watcher.close(); }, 1000);
        }
      }, 100);
    });
  },
};

// Ignore these tests if node v0.8
var version = process.versions.node.split('.');
if (version[0] === '0' && version[1] === '8') {
  // gaze v0.4 needs to watch the cwd to function
  delete exports.watch.dontAddCwd;
  // gaze 0.4 incorrecly matches folders, wontfix
  delete exports.watch.mkdirThenAddFileWithGruntFileWrite;
  delete exports.watch.mkdirThenAddFile;
}
