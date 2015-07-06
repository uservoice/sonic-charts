var gulp = require('gulp')
,   shell = require('gulp-shell')
,   uglify = require('gulp-uglify')
,   concat = require('gulp-concat')
;

gulp.task('clean', function(done) {
  gulp.src('')
    .pipe(shell('rm -Rf ./dist/*'))
  ;
  done();
});

gulp.task('scripts', function () {
  return gulp.src('./src/*.js')
    .pipe(concat('sharts.js'))
      .pipe(gulp.dest('./dist'))
    .pipe(concat('sharts.min.js'))
      .pipe(uglify())
      .pipe(gulp.dest('./dist'))
  ;
});

gulp.task('build', ['clean', 'scripts']);

gulp.task('default', ['build']);
