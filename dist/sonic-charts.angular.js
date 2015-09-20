/**
 * sonic-charts.angular.js - D3 charting library made by UserVoice
 * @version v1.0.0
 * @link https://github.com/uservoice/sonic-charts
 * @license MIT
 */
!function(undefined) {

if (angular) {
  /* globals angular, Sonic */

  angular.module('sonic', []).directive('sonicLegend', function () {
    return {
      restrict: 'E',

      scope: {
        data: '='
      },

      link: function link($scope, $element) {
        $scope.$chart = Sonic.Legend($element[0], $scope.data, {});
        $scope.$watch('data', function (data) {
          return $scope.$chart.update(data, true);
        });
        $scope.$on('$destroy', function () {
          return $scope.$chart.destroy();
        });
      }
    };
  }).directive('sonicSeries', function () {
    return {
      restrict: 'E',

      scope: {
        data: '=',
        width: '=',
        height: '=',
        startTime: '=',
        endTime: '=',
        dateAxis: '=',
        dateAxisTicks: '=',
        axis: '=',
        yAxis: '=',
        xAxis: '=',
        tickFormat: '=',
        formatValue: '&'
      },

      link: function link($scope, $element) {
        // TODO: More options!
        var options = {
          width: $scope.width,
          height: $scope.height,
          startTime: $scope.startTime,
          endTime: $scope.endTime,
          dateAxis: $scope.dateAxis || 'none',
          dateAxisTicks: $scope.dateAxisTicks,
          axis: 'axis' in $scope ? $scope.axis : true,
          yAxis: $scope.yAxis,
          xAxis: $scope.xAxis,
          tickFormat: $scope.tickFormat
        };

        if ($scope.formatValue) {
          options.formatter = function (value) {
            return $scope.formatValue({ value: value });
          };
        }

        $scope.$chart = Sonic.Series($element[0], $scope.data, options);

        function update() {
          return function (data, old) {
            if (data !== old) {
              $scope.$chart.update(data, true);
            }
          };
        }
        function setOption(key) {
          return function (value, old) {
            if (value !== old) {
              $scope.$chart.setOption(key, value, true);
            }
          };
        }

        $scope.$watchCollection('data', update());

        $scope.$watch('width', setOption('width'));
        $scope.$watch('height', setOption('height'));
        $scope.$watch('startTime', setOption('startTime'));
        $scope.$watch('endTime', setOption('endTime'));
        $scope.$watch('dateAxis', setOption('dateAxis'));
        $scope.$watch('dateAxisTicks', setOption('dateAxisTicks'));
        $scope.$watch('axis', setOption('axis'));
        $scope.$watch('yAxis', setOption('yAxis'));
        $scope.$watch('xAxis', setOption('xAxis'));
        $scope.$watch('tickFormat', setOption('tickFormat'));
        $scope.$watch('formatValue', function (formatValue, old) {
          if (formatValue !== old) {
            $scope.$chart.setOption('formatter', function (value) {
              return formatValue({ value: value });
            });
          }
        });

        $scope.$on('$destroy', function () {
          return $scope.$chart.destroy();
        });
      }
    };
  }).directive('sonicSparkline', function () {
    return {
      restrict: 'E',

      scope: {
        data: '=',
        width: '=',
        height: '=',
        color: '@',
        strokeColor: '@',
        strokeWidth: '=',
        yGuide: '=',
        yGuides: '='
      },

      link: function link($scope, $element) {
        $scope.$chart = Sonic.Sparkline($element[0], $scope.data, {
          width: $scope.width,
          height: $scope.height,
          color: $scope.color,
          stroke_color: $scope.strokeColor,
          stroke_width: $scope.strokeWidth,
          y_guide: $scope.yGuide,
          y_guides: $scope.yGuides
        });
        $scope.$on('$destroy', function () {
          return $scope.$chart.destroy();
        });
      }
    };
  }).directive('sonicPie', function () {
    return {
      restrict: 'E',

      scope: {
        data: '=',
        size: '='
      },

      link: function link($scope, $element) {
        $scope.$chart = Sonic.Pie($element[0], $scope.data, {
          size: $scope.size
        });
        $scope.$on('$destroy', function () {
          return $scope.$chart.destroy();
        });
      }
    };
  }).directive('sonicDonut', function () {
    return {
      restrict: 'E',

      scope: {
        data: '=',
        label: '@',
        labelPosition: '@',
        value: '=',
        size: '=',
        type: '@'
      },

      link: function link($scope, $element) {
        $scope.$chart = Sonic.Donut($element[0], $scope.data, {
          type: $scope.type || false,
          label: $scope.label,
          label_position: $scope.labelPosition,
          value: $scope.value,
          size: $scope.size
        });
        $scope.$on('$destroy', function () {
          return $scope.$chart.destroy();
        });
      }
    };
  }).directive('sonicDonutStack', function () {
    return {
      restrict: 'E',

      scope: {
        data: '=',
        total: '=',
        labelSubtext: '@',
        thickness: '='
      },

      link: function link($scope, $element) {
        $scope.$chart = Sonic.DonutStack($element[0], $scope.data, {
          total: $scope.total,
          label_subtext: $scope.labelSubtext,
          thickness: $scope.thickness
        });
        $scope.$on('$destroy', function () {
          return $scope.$chart.destroy();
        });
      }
    };
  }).directive('sonicHorizontalBar', function () {
    return {
      restrict: 'E',

      scope: {
        data: '=',
        percentages: '='
      },

      link: function link($scope, $element) {
        $scope.$chart = Sonic.HorizontalBar($element[0], $scope.data, {
          percentages: $scope.percentages
        });
        $scope.$on('$destroy', function () {
          return $scope.$chart.destroy();
        });
      }
    };
  }).directive('sonicPipeline', function () {
    return {
      restrict: 'E',

      scope: {
        data: '='
      },

      link: function link($scope, $element) {
        // TODO: opts { colors, tooltip, formatter }
        $scope.$chart = Sonic.Pipeline($element[0], $scope.data, {});
        $scope.$on('$destroy', function () {
          return $scope.$chart.destroy();
        });
      }
    };
  });
}

}();