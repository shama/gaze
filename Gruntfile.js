module.exports = function(grunt) {
  'use strict';

  grunt.option('stack', true);

  grunt.initConfig({
    nodeunit: {
      files: ['test/*_test.js'],
    },
    jshint: {
      options: { jshintrc: true },
      all: ['Gruntfile.js', 'lib/**/*.js', 'test/*.js', 'benchmarks/*.js', '!lib/pathwatcher.js'],
    },
  });

  // Dynamic alias task to nodeunit. Run individual tests with: grunt test:events
  grunt.registerTask('test', function(file) {
    grunt.config('nodeunit.files', String(grunt.config('nodeunit.files')).replace('*', file || '*'));
    grunt.task.run('nodeunit');
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-nodeunit');
  grunt.registerTask('default', ['jshint', 'nodeunit']);
};
