var gulp = require('gulp')
,   shell = require('gulp-shell')
,   babel = require('gulp-babel')
,   uglify = require('gulp-uglify')
,   concat = require('gulp-concat')
,   jshint = require('gulp-jshint')
,   jstylish = require('jshint-stylish')
,   data = require('gulp-data')
,   frontmatter = require('front-matter')
,   path = require('path')
,   fs = require('fs')
,   handlebars = require('gulp-compile-handlebars')
,   runSequence = require('run-sequence')
,   webserver = require('gulp-webserver')
;

gulp.task('clean', shell.task('rm -Rf ./dist/*'));

gulp.task('scripts:lint', function() {
  return gulp.src('src/*.js')
    .pipe(jshint())
    .pipe(jshint.reporter(jstylish))
    .pipe(jshint.reporter('fail'))
  ;
});

gulp.task('scripts:core', function () {
  return gulp.src('src/scripts/shart.js')
    .pipe(concat('shart.js'))
      .pipe(babel())
      .pipe(gulp.dest('dist'))
    .pipe(concat('shart.min.js'))
      .pipe(uglify())
      .pipe(gulp.dest('dist'))
  ;
});

gulp.task('scripts:angular', function () {
  return gulp.src('src/scripts/*.js')
    .pipe(concat('shart.angular.js'))
      .pipe(babel())
      .pipe(gulp.dest('dist'))
    .pipe(concat('shart.angular.min.js'))
      .pipe(uglify())
      .pipe(gulp.dest('dist'))
  ;
});

gulp.task('scripts', ['scripts:core', 'scripts:angular']);

gulp.task('examples:html', function() {
  var meta = { title: 'Examples' };
  return gulp.src('src/examples/**/*.html')
    .pipe(data(function(file) {
      var content = frontmatter(String(file.contents))
      ,   filename = path.join(__dirname, 'src', 'layouts', (content.attributes['layout'] || 'example') + '.handlebars')
      ,   layout = fs.readFileSync(filename)
      ;
      content.attributes['contents'] = content.body;
      file.contents = new Buffer(layout);
      return content.attributes;
    }))
    .pipe(handlebars(meta))
    .pipe(gulp.dest('dist/examples'))
  ;
});
gulp.task('examples:styles', function() {
  return gulp.src('src/styles/example.css')
    .pipe(gulp.dest('dist/examples'))
  ;
});
gulp.task('examples', ['examples:html', 'examples:styles']);

gulp.task('build', function(done) {
  runSequence(
    'clean',
    ['scripts:lint', 'scripts', 'examples'],
    done
  );
});

gulp.task('watch', ['build'], function() {
  gulp.watch('src/scripts/*', ['scripts']);
  gulp.watch('src/styles/*', ['examples:styles']);
  gulp.watch(['src/examples/**/*', 'src/layouts/*'], ['examples:html']);
});

gulp.task('server', ['watch'], function() {
  return gulp.src('dist')
    .pipe(webserver({
      livereload: true,
      directoryListing: true,
      open: false,
      port: 5000
    }))
  ;
});

gulp.task('deploy:divshot', shell.task([
  'divshot push',
  'divshot promote development production'
]));

gulp.task('deploy', function(done) {
  runSequence('build', 'deploy:divshot', done);
});

gulp.task('default', ['build']);
