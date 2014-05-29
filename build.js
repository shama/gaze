#!/usr/bin/env node

// Checks if we have a pre-built binary, if not attempt to build one
// Usage: node build.js

var spawn = require('child_process').spawn;
var fs = require('fs');
var path = require('path');

var arch = process.arch;
var platform = process.platform;
var v8 = /[0-9]+\.[0-9]+/.exec(process.versions.v8)[0];

var args = process.argv.slice(2).filter(function(arg) {
  if (arg.substring(0, 13) === '--target_arch') {
    arch = arg.substring(14);
  }
  return true;
});

if (!{ia32: true, x64: true, arm: true}.hasOwnProperty(arch)) {
  console.error('Unsupported (?) architecture: `' + arch + '`');
  process.exit(1);
}

var binPath = path.join(__dirname, 'bin');
if (!fs.existsSync(binPath)) {
  fs.mkdirSync(binPath);
}

var installPath = path.join(binPath, platform + '-' + arch + '-v8-' + v8, 'pathwatcher.node');
if (!fs.existsSync(installPath)) {
  var child = spawn(process.platform === 'win32' ? 'node-gyp.cmd' : 'node-gyp', ['rebuild'].concat(args), {customFds: [0, 1, 2]});
  child.on('exit', function(err) {
    if (err) {
      if (err === 127) {
        console.error('node-gyp not found! Please npm install npm -g');
      } else {
        console.error('Build failed');
      }
      return process.exit(err);
    }

    var targetPath = path.join(__dirname, 'build', 'Release', 'pathwatcher.node');
    var installDir = path.dirname(installPath);
    if (!fs.existsSync(installDir)) {
      fs.mkdirSync(installDir);
    }

    try {
      fs.statSync(targetPath);
    } catch (err) {
      console.error('Build succeeded but target not found');
      process.exit(1);
    }
    fs.renameSync(targetPath, installPath);
  });
}
