/* globals d3, Sonic */

//
// Sonic
//

// Main configuration
var config = {};

// Format an integer with commas.
function formatInt(number) {
  var int = parseInt("0" + number, 10);
  return String(int).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Calculate an element's offset. Based on: http://www.quirksmode.org/js/findpos.html
function getOffset(el) {
  var obj = el
  ,   left = 0
  ,   top = 0
  ;
  if (obj.offsetParent) {
    do {
      left += obj.offsetLeft;
      top += obj.offsetTop;
      obj = obj.offsetParent;
    } while (obj);
  }
  return { left: left, top: top };
}

// Create a throttling function that will fire the callback immediately
// but swallow subsequent calls until delay has passed.
function throttle(callback, delay) {
  var lasttime = 0;

  return function() {
    var elapsed = +new Date() - lasttime
    ,   self    = this
    ;

    if (elapsed > delay) {
      lasttime = +new Date();
      callback.apply(self, arguments);
    }
  };
}

// Create a debounce function that will fire the callback only after
// delay has passed with no further calls to the function.
function debounce(callback, delay) {
  var timeout;

  return function() {
    var self = this;

    function exec() {
      callback.apply(self, arguments);
      timeout = null;
    }

    clearTimeout(timeout);
    timeout = setTimeout(exec, delay);
  };
}

// Create a new array that is the set of unique values in array.
// Based on: https://github.com/jashkenas/underscore/blob/master/underscore.js#L465
function uniq(array, isSorted, iterator, context) {
  if (array === null) { return []; }
  var result = [];
  var seen = [];
  for (var i = 0, length = array.length; i < length; i++) {
    var value = array[i];
    if (iterator) { value = iterator.call(context, value, i, array); }
    if (isSorted ? (!i || seen !== value) : seen.indexOf(value) === -1) {
      if (isSorted) {
        seen = value;
      } else {
        seen.push(value);
      }
      result.push(array[i]);
    }
  }
  return result;
}

// Extend an object with the properties of another object.
// Based on: https://github.com/jashkenas/underscore/blob/master/underscore.js#L843
function extend(obj) {
  Array.prototype.slice.call(arguments, 1).forEach(function(source) {
    for (var prop in source) {
      if (source.hasOwnProperty(prop)) {
        obj[prop] = source[prop];
      }
    }
  });
  return obj;
}

// Predict the next value in a series.
function predictNextValue(values_y) {
  var sum_x = 0
  ,   sum_y = 0
  ,   sum_xy = 0
  ,   sum_xx = 0
  ,   count = 0
  ,   x = 0
  ,   y = 0
  ,   values_x = []
  ,   values_length = values_y.length
  ,   v, m, b, ret
  ;

  if (!values_length) {
    return null;
  }

  for (v = 0; v < values_length; v++) {
    values_x.push(v);
  }

  // Calculate the sum for each of the parts necessary
  for (v = 0; v < values_length; v++) {
    x = values_x[v];
    y = values_y[v];
    sum_x += x;
    sum_y += y;
    sum_xx += x * x;
    sum_xy += x * y;
    count++;
  }

  // Calculate m and b for the formula: y = x * m + b
  m = (count * sum_xy - sum_x * sum_y) / (count * sum_xx - sum_x * sum_x);
  b = (sum_y / count) - (m * sum_x) / count;
  ret = Math.round(values_length * m + b);

  return ret >= 0 ? ret : 0;
}


// Given a series, extract the individual segements.
function flattenSeries(data) {
  var results = [];

  data.forEach(function(series) {
    var datum = extend({}, series)
    ,   segments = datum.segments
    ;

    delete datum.segments;

    results.push(datum);

    if (segments && segments.length) {
      segments.forEach(function(segment) {
        results.push(extend({}, segment));
      });
    }

  });

  return results;
}

// Given a series, extract the cross section of values at a given index (i).
function extractSeriesCrossSection(chart, data, i) {
  var segment_seq_totals
  ,   results = []
  ,   segments = []
  ,   datum
  ,   formatter
  ;

  if (data.sequence) {
    var value = data.sequence[i];

    datum = {};
    formatter = data.formatter || chart.formatter || config.formatter;

    datum.key = data.key;
    datum.label = data.label;
    datum.value = value;
    datum.formatted_value = formatter(value);

    if (data.color) { datum.color = data.color; }

    results.push(datum);
  }

  if (data.segments) {
    segment_seq_totals = d3.zip.apply(null, data.segments.map(function(seg) { return seg.sequence })).map(function(seg) { return d3.sum(seg) });

    data.segments.forEach(function(segment, segment_i) {
      if (data.topSegments.indexOf(segment) !== -1 && !segment.hide_tooltip) {
        var value = segment.sequence[i];

        datum = {};
        formatter = segment.formatter || data.formatter || config.formatter;

        extend(datum, segment); // Make sure the data included in the segment is merged into the datum

        datum.label = segment.label;
        datum.value = value;
        datum.formatted_value = formatter(value);
        datum.percentage = (Math.round((value / segment_seq_totals[i]) * 100) || 0);
        datum.color = segment.color || data.colors(segment_i).toString();

        segments.push(datum);
      }
    });

    if (segments.length && data.length) {
      results[0].segments = segments;
    } else {
      results = results.concat(segments);
    }
  }

  return results;
}

function setNestedKey(object, key, value) {
  var o = object
  ,   parts = key.split('.')
  ,   last = parts.pop()
  ,   part = parts.shift()
  ;
  while (part) {
    if (!o.hasOwnProperty(part)) {
      o[part] = {};
    }
    o = o[part];
    part = parts.shift();
  }
  o[last] = value;
  return value;
}


//
// Graph - abstract base class from which all graphs inherit
//

class Graph {

  // Create a new Graph.
  constructor(el, data, options) {
    Graph.instances.push(this);
    this.options = options || {};
    this.id = Graph.lastUniqueId++;
    this.el = d3.select(el);
    this.data = data || [];
    this.autosize = false;
    this.activeTips = [];
    Graph.installResizeListener();
  }

  // This method is responsible for drawing the chart. Override this in a
  // subclass to create your own chart.
  draw(/* animate */) {
    // abstract: draw the chart, if animate is true optionally use animation
  }

  // Wait until the el is in DOM and visible before drawing
  drawWhenReady() {
    var graph = this
    ,   el = graph.el[0][0]
    ,   delay = 100
    ;

    function wait() {
      if (!graph.destroyed) {
        if (el.offsetParent !== null) {
          graph.draw();
        } else {
          setTimeout(wait, delay);
        }
      }
    }

    setTimeout(wait, 0);
  }

  // If the autoresize property is true, this method will be called whenever
  // the window is resized. By default, this method will call draw(), but you
  // can override it in a subclass to provide more intelligent behaivor.
  resize() {
    this.draw();
  }

  // Update the chart.
  update(data, animate) {
    this.data = data;
    this.draw(animate);
  }

  // Destroy the chart. Perform any cleanup on the chart that is necessary
  // before removing the DOM. (Note that if event listners were attached with
  // d3 for child elements of the chart they will be automatically removed
  // by the browser when the elements are removed by this method.)
  destroy() {
    var index = Graph.instances.indexOf(this);
    if (index > -1) { Graph.instances.splice(index, 1); }
    if (this.activeTip) { this.hideTooltip(this.activeTip); }
    this.el.html('');
    this.destroyed = true;
  }

  showTooltip(tip) {
    this.activeTips.push(tip);
    return config.showTooltip(tip);
  }

  hideTooltip(tip) {
    var result = config.hideTooltip(tip)
    ,   index = this.activeTips.indexOf(tip)
    ;
    if (index > -1) { this.activeTips.splice(index, 1); }
    return result;
  }

  // Install the global resize listner. Sonic only uses one for all charts.
  // This method is called once for every chart, yet only initializes the
  // listener on the first call.
  static installResizeListener() {
    if (!Graph.resizeListenerInstalled) {
      d3.select(window).on('resize.sonic', debounce(function() {
        Graph.instances
          .filter(g => g.autosize)
          .forEach(g => g.resize());
      }, 50));
      Graph.resizeListenerInstalled = true;
    }
  }
}
Graph.lastUniqueId = 0;
Graph.instances = [];
Graph.resizeListenerInstalled = false;


//
// Band
//

class Band {
  constructor(data) {
    this.data = data;
  }
  draw(chart) {
    var data = this.data;

    chart.svg.append('svg:rect')
      .attr('x', chart.x(data.x))
      .attr('y', chart.y(data.y))
      .attr('width', chart.x(data.w - 1) - SeriesGraph.xPadding)
      .attr('height', chart.y(0) - chart.y(data.h))
      .attr('stroke', data.color)
      .attr('fill', data.color)
    ;
  }
}


//
// Invisible
//

class Invisible {
  constructor(data, i, c) {
    this.key = data.key;
    this.label = data.label;
    this.color = data.color;
    this.sequence = data.sequence;
    this.segments = data.segments;
    this.invisible = true;
    this.formatter = data.formatter || c.formatter;
  }
  draw() {
    // Invisible chart elements do not draw themselves on the chart. Instead,
    // they can be used to display additional stats in the Tooltip.
  }
}


//
// Line
//

class Line {
  constructor(data, i, c) {
    var self = this;

    this.key = data.key;
    this.label = data.label;
    this.color = data.color;
    this.sequence = data.sequence;
    this.segments = data.segments;

    this.lineSegments = this.segments || [data];

    this.colors = c.colors || config.colors;
    this.formatter = data.formatter || c.formatter;

    this.lineSegments.forEach(function(segment){
      if (segment.sequence[segment.sequence.length - 1] === 0 && data.extrapolate_last) {
        segment.sequence.pop();
        segment.sequence.push(predictNextValue(segment.sequence));
      }

      segment.label = segment.label;
      segment.dasharray = segment.dasharray || data.dasharray;
      segment.strokewidth = segment.strokewidth || data.strokewidth || 2;
      segment.interpolate = segment.interpolate || data.interpolate;

      if (self.interpolate) {
        segment.sequence.map(function(d, i) {
          if (d === 0) {
            segment.sequence[i] = predictNextValue(segment.sequence.slice(0, i));
          }
        }, segment);
      }

      segment.cardinality = data.sequence.length;
      self.cardinality = d3.max([self.cardinality || 0, segment.cardinality]);
    });

    if (this.lineSegments) {
      this.topSegments = this.lineSegments.slice(0).sort(function(a, b) {
        return d3.descending(d3.sum(a.sequence), d3.sum(b.sequence));
      }).slice(0, 10);
    }
  }

  max() {
    return d3.max(this.lineSegments.map(function(segment){ return d3.max(segment.sequence); }));
  }

  draw(chart) {
    var self = this;

    this.lineSegments.forEach(function(segment, i){
      // Only show top segments
      if (self.topSegments.indexOf(segment) === -1) {
        return;
      }

      var sequence = segment.sequence.map(function(val, i) {
        return { x: i, y: val };
      });

      var line
      ,   area
      ,   path
      ,   fill
      ,   color
      ;

      color = segment.color || self.colors(i).toString();

      if (segment.fill) {
        area = d3.svg.area()
          .x(function(d) { return chart.x(d.x) })
          .y0(chart.y(chart.yRange[0]))
          .y1(function(d) { return chart.y(d.y) })
        ;

        fill = chart.svg.append('svg:path')
          .attr('d', area(sequence))
          .attr('transform', 'translate(0,-1)')
        ;

        if (typeof segment.fill === "boolean") {
          fill
            .attr('fill', color)
            .attr('fill-opacity', 0.3)
          ;
        } else {
          fill
            .attr('fill', segment.fill)
          ;
        }
      }

      line = d3.svg.line()
        .x(function(d) { return chart.x(d.x) })
        .y(function(d) { return chart.y(d.y) })
      ;

      path = chart.svg.append('svg:path')
        .attr('d', line(sequence))
        .attr('transform', 'translate(0,-1)')
        .attr('stroke', color)
        .attr('stroke-width', segment.strokewidth || self.strokewidth)
        .attr('fill', 'transparent')
      ;

      if (segment.dasharray || self.dasharray) {
        path.attr('stroke-dasharray', segment.dasharray || self.dasharray);
      }
    });
  }
}


//
// Area
//

class Area {
  constructor(data, i, c) {
    this.key = data.key;

    this.label = data.label;
    this.color = data.color;
    this.sequence = data.sequence;
    this.cardinality = data.sequence.length;
    this.percent = data.percent;
    this.interpolate = data.interpolate;

    this.segments = data.segments;

    this.formatter = data.formatter || c.formatter;

    if (this.segments) {
      this.topSegments = this.segments.slice(0).sort(function(a, b) {
        return d3.descending(d3.sum(a.sequence), d3.sum(b.sequence));
      }).slice(0, 10);
    }

    if (this.interpolate) {
      // find the zero values and store their indices
      var zeros = [];

      var columns = this.segments ? d3.zip.apply(null, this.segments.map(function(area) {
        return area.sequence;
      })) : d3.zip(this.sequence);

      columns.forEach(function(a, i) {
        if (d3.sum(a) === 0) {
          zeros.push(i);
        }
      }, this);

      if (this.segements) {
        this.segments.map(function(area, ai) {
          area.sequence.map(function(a, i) {
            if (zeros.indexOf(i) !== -1) {
              this.segments[ai].sequence[i] = predictNextValue(this.segments[ai].sequence.slice(0, i));
            }
          }, this);
        }, this);
      } else {
        this.sequence.map(function(a, i) {
          if (zeros.indexOf(i) !== -1) {
            this.sequence[i] = predictNextValue(this.sequence.slice(0, i));
          }
        }, this);
      }
    }
  }

  max() {
    if (this.percent) { return 100; }

    var columns = this.segments ? d3.zip.apply(null, this.segments.map(function(area) {
      return area.sequence;
    })) : d3.zip(this.sequence);

    return d3.max(columns.map(function(col) { return d3.sum(col) }));
  }

  sequenceData() {
    var data = this.segments ? this.segments.map(function(area, seg_i) {
      var cooler = (area.color || config.colors(seg_i).toString());

      return area.sequence.map(function(a, i) {
        return { x: i, y: a, value: a, label: area.label, color: cooler};
      });
    }) : [this.sequence.map(function(a, i) {
      return { x: i, y: a, value: a, label: this.label, color: (this.color || config.colors(i).toString()) };
    }, this)];

    data = d3.layout.stack().offset(this.percent ? 'expand' : 'zero').order('reverse')(data);

    this.sequenceData = function() { return data };
    return data;
  }

  draw(chart) {
    var sequence = this.sequenceData()
    ,   area
    ,   instance = this
    ;

    area = d3.svg.area().x(function(d) {
      return chart.x(d.x);
    }).y0(function(d) {
      if (instance.percent) {
        var y = chart.yAxis ? (chart.y(0) - SeriesGraph.yPadding) : chart.y(0);
        return chart.y(0) - (y * d.y0);
      } else {
        return chart.y(d.y0);
      }
    }).y1(function(d) {
      if (instance.percent) {
        var y = chart.yAxis ? (chart.y(0) - SeriesGraph.yPadding) : chart.y(0);
        return chart.y(0) - (y * (d.y0 + d.y));
      } else {
        return chart.y(d.y0 + d.y);
      }
    });

    sequence.forEach(function(seq) {
      chart.svg.append('svg:path')
        .attr('d', area(seq))
        .attr('fill', seq[0].color)
        .attr('stroke-width', 0)
        .attr('stroke', seq[0].color)
      ;
    });
  }
}


//
// Column
//

class Column {
  constructor(data, i, c) {
    this.key = data.key;

    this.label = data.label;
    this.sequence = data.sequence;
    this.percent = data.percent;
    this.color = data.color || config.colors(i).toString();
    this.cardinality = data.sequence.length;
    this.spacing = data.spacing || 8;
    this.col_width = data.col_width;

    this.segments = data.segments;

    this.formatter = data.formatter || c.formatter;

    if (this.segments) {
      this.topSegments = this.segments.slice(0).sort(function(a, b) {
        return d3.descending(d3.sum(a.sequence), d3.sum(b.sequence));
      }).slice(0, 10);
    }
  }

  max() {
    return Area.prototype.max.apply(this, arguments);
  }

  sequenceData() {
    var data = this.segments ? this.segments.map(function(area, seg_i) {
      var cooler = (area.color || config.colors(seg_i).toString());

      return area.sequence.map(function(a, i) {
        return { x: i, y: a, value: a, label: area.label, color: cooler};
      }).sort(function(){});
    }) : [this.sequence.map(function(a, i) {
      return { x: i, y: a, value: a, label: this.label, color: (this.color || config.colors(i).toString()) };
    }, this)];

    data = d3.layout.stack().offset(this.percent ? 'expand' : 'zero')(data);

    // memoize it
    this.sequenceData = function() { return data };
    return data;
  }

  draw(chart) {
    var sequence = this.sequenceData()
    ,   cw //Math.max((chart.x.range()[1] / sequence.length) - this.spacing, 2) - 15
    ,   ch
    ,   cx
    ,   cy
    ,   ratio
    ,   max
    ;

    var seq_totals = this.sequence;
    var percent = this.percent;

    if (this.col_width) {
      cw = this.col_width;
    } else {
      // Set column width; equally divide chart width minus spacing
      cw = chart.getWidth();
      cw = Math.floor((cw - (this.spacing * sequence[0].length)) / sequence[0].length);
    }

    // Set ratio to use to determine column height
    // If percent: the ratio is just the chart height minus ypadding * 2
    // If no percent: the ratio is the (chart height minus (ypadding * 2)) / max column total
    var chart_height = chart.getHeight() - (SeriesGraph.yPadding * 2);
    ratio = chart_height;

    if (!percent) {
      max = 1;
      this.sequence.forEach(function(s){
        if (s > max) {
          max = s;
        }
      });
      ratio = chart_height / max;
    }

    var drawData = function(d) {
      // Don't draw data points if this column has a total of 0
      if(seq_totals[d.x] === 0) { return; }

      // Determine how high to start drawing the column
      cy = (d.y0 * ratio) + SeriesGraph.yPadding;
      if(!percent) {
        cy += (chart_height - (seq_totals[d.x] * ratio));
      }

      ch = d.y * ratio;
      cx = chart.x(d.x) - (cw / 2);

      chart.svg.append('svg:rect')
        .attr('x', cx)
        .attr('y', cy)
        .attr('width', cw)
        .attr('height', ch)
        .attr('stroke-width', 0)
        .attr('fill', d.color)
      ;
    };

    sequence.forEach(function(seg){
      seg.forEach(drawData, this);
    });
  }
}


//
// Series Graph
//

class SeriesGraph extends Graph {
  constructor(el, data, options) {
    super(el, data, options);
    this.autosize = true;
    this.loadOptions();
    this.attachMouseEvents();
  }
  
  setOption(key, value, animate) {
    setNestedKey(this.options, key, value);
    this.loadOptions();
    this.draw(animate);
  }

  loadOptions() {
    var opts = this.options;

    this.width = opts.width || 'auto';
    this.height = opts.height || 'auto';

    this.axis = opts.axis !== undefined ? opts.axis : true;
    this.dateAxis = opts.dateAxis || 'daily';
    this.dateAxisTicks = opts.dateAxisTicks;
    this.yAxis = opts.yAxis;
    this.xAxis = opts.xAxis;

    this.colors = opts.colors || config.colors;

    this.el.style('position', 'relative');

    if (this.dateAxis !== 'none') {
      this.startTime = new Date(opts.startTime);
      this.endTime = new Date(opts.endTime);
    } else if (this.xAxis) {
      this.startTime = 1;
      this.endTime = this.xAxis.length;

      this.ticks = { x: this.xAxis.length };
    } else {
      this.startTime = opts.startTime;
      this.endTime = opts.endTime;
    }

    if(this.dateAxisTicks) {
      this.ticks = { x: this.dateAxisTicks };
    }

    this.ticks = this.ticks || {
      x: SeriesGraph.timeScales[opts.dateAxis].ticks
    };

    this.ruleTicks = {
      x: opts.ruleTicks || SeriesGraph.timeScales[opts.dateAxis].ruleTicks
    };

    this.dateFormatter = SeriesGraph.timeScales[opts.dateAxis].formatter;

    this.formatter = opts.formatter || config.formatter;

    // same with bands
    this.bands = (opts.bands || []).map(function(bands_s) {
      return new Band(bands_s);
    });

    this.tickFormat = opts.tickFormat || ',';

    this.xTickPadding = opts.xTickPadding || 0;

    this.tooltip = opts.tooltip || config.tooltip;
  }
  
  get data() {
    return this._data;
  }
  set data(data) {
    var chart = this
    ,   opts = this.options
    ,   yMax
    ;

    this._data = data;

    // turn our data into proper functions
    this.elements = data.map(function(series_s, index_s) {
      return new SeriesGraph.elementTypes[series_s.type](series_s, index_s, chart);
    });

    // Figure out our yMax. We need to find the largest value across all series
    // (including grouped 'stack' series but not 'invisible' series).
    yMax = d3.max(this.elements.map(function(series_s) {
      return series_s.invisible ? 0 : series_s.max();
    })) || 1;

    // figure out the yRange, which is opts.yBase || 0 ... yMax
    this.yRange = opts.yRange || [opts.yBase || 0, yMax];

    return data;
  }

  attachMouseEvents() {
    var chart = this;
    if (this.tooltip) {
      this.el.on('mousemove', throttle(function() {
        if (!chart.x) { return }

        var el = this
        ,   offset = getOffset(el)
        ,   series_i
        ,   x_pos
        ,   data
        ,   body
        ;

        // This retrieves our index value for the mouse position
        series_i = Math.round(chart.x.invert(d3.event.pageX - offset.left));

        // Add lower/upper bounds to series index
        var max_i = chart.timeScaleTicks && (chart.timeScaleTicks.length - 1);
        if(max_i){
          series_i = Math.min(Math.max(series_i, 0), max_i);
        }

        // Find snapping point
        x_pos = chart.x(series_i);

        // Get the data for the tooltip
        data = chart.tooltipData(series_i);

        if (data.segments) {
          // Format the tip body
          body = chart.tooltip(chart, data);
        }

        if (body) {
          chart.scrubber.style({
            position: 'absolute',
            height: (chart.y.range()[0] - chart.y.range()[1]) + 'px',
            visibility: 'visible',
            left: x_pos  + 'px',
            top: chart.y.range()[1] + 'px'
          });

          chart.showTooltip({
            body: body,
            target: chart.scrubber.node(),
            chart: chart.el.node()
          });
        }
      }, 50));

      this.el.on('mouseleave', debounce(function() {
        chart.hideTooltip({
          target: chart.scrubber.node()
        });
        chart.scrubber.style('visibility', 'hidden');
      }, 100));
    }
  }

  getWidth() {
    var w = this.el[0][0].offsetWidth;
    return this.width !== 'auto' ? this.width : (w === undefined ? 600 : w);
  }

  getHeight() {
    var h = this.el[0][0].offsetHeight;
    return this.height !== 'auto' ? this.height : (h === 0 ? 180 : h);
  }

  draw() {
    var chart = this
    ,   line = d3.svg.line().x(function(d) { return d.x }).y(function(d) { return d.y }).interpolate("linear")
    ,   axis_pad = 4.5
    ,   tick_length = 5
    ,   width
    ,   height
    ,   _xRange
    ,   _yRange
    ,   _xAxisRange
    ,   scale
    ,   p1
    ,   p2
    ;

    this.el
      .html('') // need to clear out existing stuff
      .classed('sonic-series-graph', true)
      .style('width', '')
      .style('height', '')
    ;

    width = this.getWidth();
    height = this.getHeight();

    this.el
      .style('width', width + 'px')
      .style('height', height + 'px')
    ;

    if (this.axis && (this.dateAxis || this.xAxis)) {
      this.el.classed('x-axis', true);
    }

    if (this.dateAxis || this.xAxis) {
      _xRange = [SeriesGraph.xPadding + this.xTickPadding, width - SeriesGraph.xPadding - this.xTickPadding];
      _xAxisRange = [SeriesGraph.xPadding, width - SeriesGraph.xPadding];
    } else {
      _xRange = [this.xTickPadding, width - this.xTickPadding];
      _xAxisRange = [0, width];
    }

    if (this.yAxis) {
      this.el.classed('y-axis', true);
      _yRange = [height - SeriesGraph.yPadding, SeriesGraph.yPadding];
    } else {
      _yRange = [height, 0];
    }

    if (this.dateAxis !== 'none') {
      scale = d3.time.scale;
    } else {
      scale = d3.scale.linear;
    }

    this.svg = this.el
      .append('svg:svg')
      .attr('width', width)
      .attr('height', height)
    ;

    this.x = d3.scale.linear().domain([0, this.elements[0].cardinality - 1]).rangeRound(_xRange);
    this.x_axis = d3.scale.linear().domain([0, this.elements[0].cardinality - 1]).rangeRound(_xAxisRange);
    this.y = d3.scale.linear().domain(this.yRange).rangeRound(_yRange);
    this.timeScale = scale().domain([this.startTime, this.endTime]).range(_xRange);
    this.timeScaleTicks = uniq(this.timeScale.ticks(this.ticks.x).concat([this.endTime]), true, function(d){ return d.valueOf(); });

    if (this.axis && (this.dateAxis || this.xAxis)) {
      var xAxis = this.svg.append('svg:g');

      p1 = {x: this.x_axis(0), y: this.y(this.yRange[0]) + axis_pad};
      p2 = {x: this.x_axis.range()[1] + axis_pad, y: p1.y};

      xAxis.append('svg:path')
        .attr('d', line([p1, p2]))
        .attr({'stroke-width': 1, 'stroke': '#aaaaaa'})
      ;

      this.timeScaleTicks.forEach(function(t, i) {
        if (this.xAxis) {
          t = this.xAxis[i];
        }

        var draw;
        if (this.dateAxis === 'daily' && t.getDay) {
          draw = (t.getDay() === 1);
        } else {
          draw = (i % this.ruleTicks.x === 0);
        }

        if (draw) {
          var xpos = Math.round(this.x(i)) + 0.5
          ,   p1 = {x: xpos, y: (this.y(this.yRange[0]) + tick_length + axis_pad)}
          ,   p2 = {x: xpos, y: (this.y(this.yRange[0]) + axis_pad)}
          ;

          xAxis.append('svg:path')
            .attr('d', line([p1, p2]))
            .attr('stroke-width', 1)
            .attr('stroke', '#aaaaaa')
          ;

          xAxis.append('svg:text')
            .text(this.dateFormatter(t))
            .attr('x', xpos)
            .attr('y', p1.y + 6)
            .attr('font-size', 9)
            .attr('text-anchor', 'middle')
            .attr('fill', '#333')
          ;
        }
      }, this);
    }

    if (this.axis && this.yAxis) {
      var ordinal = this.yAxis instanceof Array
      ,   tickScale = d3.scale.linear().domain([0, this.y.domain()[1] - this.y.domain()[0]]).range(this.y.range())
      ,   yAxis = this.svg.append('svg:g')
      ,   ticks
      ;

      if (ordinal) {
        ticks = this.yAxis;
        p1 = {x: (this.x_axis.range()[1] + axis_pad), y: (tickScale(0) + axis_pad)};
        p2 = {x: p1.x, y: tickScale.range()[1]};
        yAxis.append('svg:path').attr('d', line([p1, p2]));
      } else {
        var dom = this.y.domain();
        if ((d3.max(dom) - d3.min(dom) < 2) && this.tickFormat !== '%') {
          ticks = dom;
        } else {
          ticks = [this.y.domain()[0], Math.round((this.y.domain()[1] / 2) * 100) / 100, this.y.domain()[1]];
        }

        p1 = {x: (this.x_axis.range()[1] + axis_pad), y: (this.y(0) + axis_pad)};
        p2 = {x: p1.x, y: this.y.range()[1]};
      }

      yAxis.append('svg:path')
        .attr('d', line([p1, p2]))
        .attr('stroke-width', 1)
        .attr('stroke', '#aaaaaa')
      ;

      var interval = Math.floor((this.y.domain()[1] - this.y.domain()[0]) / (ticks.length - 1));

      ticks.forEach(function(d, i) {
        if (d === null) { return }

        var ypos
        ,   tick
        ,   tickFormatter = d3.format(this.tickFormat)
        ,   formatted
        ;

        if (ordinal) {
          ypos = Math.round(tickScale(i * interval)) + 0.5;
        } else {
          ypos = Math.round(this.y(d)) + 0.5;
        }

        p1 = {x: this.x_axis.range()[1] + axis_pad, y: ypos};
        p2 = {x: p1.x + tick_length, y: p1.y};

        tick = yAxis.append('svg:path')
          .attr('d', line([p1, p2]))
          .attr('stroke-width', 1)
          .attr('stroke', '#aaaaaa')
        ;

        if (typeof d === 'string') {
          formatted = d3.requote(d);
        } else {
          formatted = tickFormatter(d);
        }

        yAxis.append('svg:text').text(formatted)
          .attr('x', p2.x + 2)
          .attr('y', ypos)
          .attr('font-size', 9)
          .attr('text-anchor', 'right')
          .attr('alignment-baseline', 'middle')
          .attr('fill', '#333')
        ;

      }, this);
    }

    this.bands.forEach(function(bands_s) {
      bands_s.draw(this);
    }, this);

    this.elements.forEach(function(series_s) {
      series_s.draw(this);
    }, this);

    this.scrubber = this.el.append('div')
      .classed('sonic-scrubber', true)
    ;

    return chart;
  }

  tooltipData(i) {
    var chart = this
    ,   data = {}
    ,   segments = []
    ,   date
    ;

    try {
      date = this.timeScaleTicks[i];
    } catch(e) {}

    if (date) {
      data.date = date;
      data.formatted_date = this.dateFormatter(data.date);
    }

    this.elements.forEach(function(s) {
      segments = segments.concat(extractSeriesCrossSection(chart, s, i));
    });

    data.segments = segments;

    return data;
  }
}

SeriesGraph.xPadding = 40;
SeriesGraph.yPadding = 20;

SeriesGraph.timeScales = {
  hourly: {
    ticks: 24,
    formatter: d3.time.format('%I%p'),
    ruleTicks: 3
  },

  daily: {
    ticks: 30,
    formatter: d3.time.format('%b %e'),
    ruleTicks: 7
  },

  weekly: {
    ticks: 8,
    formatter: d3.time.format('%x'),
    ruleTicks: 1
  },

  monthly: {
    ticks: 6,
    formatter: d3.time.format('%m/%y'),
    ruleTicks: 1
  },

  none: {
    ticks: 0,
    formatter: function(d){return d;},
    ruleTicks: 0
  }
};

SeriesGraph.elementTypes = {
  invisible: Invisible,
  line: Line,
  area: Area,
  column: Column
};


//
// Sparkline Graph
//
class SparklineGraph extends Graph {
  constructor(el, data, options) {
    super(el, data, options);
    var opts = this.options;

    this.width = opts.width || 120;
    this.height = opts.height || 40;

    this.yGuides = opts.y_guides || [];
    if (opts.y_guide) { this.yGuides.push(opts.y_guide) }

    this.strokeColor = opts.stroke_color || opts.color || 'blue';
    this.strokeWidth = opts.stroke_width || 1;
  }

  draw() {
    var padding = {left: 0, top: 2, right: 0, bottom: 2}
    ,   width = this.width
    ,   height = this.height
    ,   yGuides = this.yGuides
    ,   data = this.data
    ,   strokeColor = this.strokeColor
    ,   strokeWidth = this.strokeWidth
    ,   max = d3.max(data)
    ,   min = d3.min([0].concat(data))
    ,   length = data.length
    ,   x = d3.scale.linear().domain([0, length - 1]).range([padding.left, width - padding.left - padding.right])
    ,   y = d3.scale.linear().domain([min, max]).range([height - padding.top - padding.bottom, padding.top])
    ,   line = d3.svg.line().x(function(d,i) { return x(i) }).y(function(d) { return y(d) })
    ;

    var chart = this.el
      .classed('sonic-sparkline-graph', true)
      .html('')
    ;

    var svg = chart.append('svg')
      .attr('width', width)
      .attr('height', height)
    ;

    svg.append('clipPath')
      .attr('id', 'clip')
      .append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', width)
        .attr('height', height)
    ;

    svg
      .selectAll('.sonic-sparkline-graph-y-guide')
        .data(yGuides)
        .enter()
          .append('line').classed('sonic-sparkline-graph-y-guide', true)
            .attr('clip-path', 'url(#clip)')
            .attr('x1', x(0))
            .attr('y1', function(d) { return Math.floor(y(d)) + 0.5; })
            .attr('x2', x(length - 1))
            .attr('y2', function(d) { return Math.floor(y(d)) + 0.5; })
            .attr('fill', 'none')
            .attr('stroke', '#ddd')
            .attr('stroke-width', 1)
            .attr('stroke-linecap', 'butt')
    ;

    svg.append('path').classed('sonic-sparkline-graph-stroke', true)
      .attr('clip-path', 'url(#clip)')
      .attr('d', line(data))
      .attr('fill', 'none')
      .attr('stroke', strokeColor)
      .attr('stroke-width', strokeWidth)
      .attr('stroke-linecap', 'butt')
    ;
  }
}


//
// Pie Graph
//

class PieGraph extends Graph {
  constructor(el, data, options) {
    super(el, data, options);
    var opts = this.options;
    this.size = opts.size || 50;
  }

  sequenceData() {
    var data = d3.layout.pie().value(function(d) { return d.value })(this.data);

    this.sequenceData = function() { return data };
    return data;
  }

  draw() {
    var diameter = this.size
    ,   radius  = (diameter / 2) - 1
    ,   arc     = d3.svg.arc().outerRadius(radius)
    ,   data    = this.sequenceData()
    ;

    var chart = this.el
      .classed('sonic-pie-graph', true)
      .style({
        'position': 'relative',
        'width': this.size + 'px',
        'height': 0,
        'padding-bottom': this.size + 'px'
      })
      .html('')
    ;

    var svg = chart.append('svg:svg')
      .attr('width', this.size)
      .attr('height', this.size)
      .attr('viewBox', [0, 0, diameter, diameter].join(' '))
      .style({
        'position': 'absolute',
        'left': 0,
        'top': 0
      })
    ;

    data.forEach(function(slice, i) {
      // Don't draw anything if the value is 0
      if (slice.value === 0) { return; }

      var cooler = this.data[i].color || config.colors(i).toString();

      svg.append('svg:path')
        .attr('d', arc(slice))
        .attr('transform', 'translate(' + (radius + 1) + ',' + (radius + 1) + ')')
        .attr('fill', cooler)
        .attr('stroke', cooler)
      ;

    }, this);
  }
}


//
// Donut Graph
//

class DonutGraph extends Graph {
  constructor(el, data, options) {
    super(el, data, options);
    var opts = options;

    this.size = opts.size || parseInt(this.el.style('width'), 10);
    this.radius = this.size / 2;
    this.thickness = opts.thickness || Math.round(this.radius / 7);

    this.value = opts.value;
    this.value_text = typeof(opts.value_text) === "undefined" ? formatInt(this.value) : opts.value_text;
    this.value_color = opts.value_color;

    this.label = opts.label;
    this.label_position = opts.label_position || 'center';
    this.label_color = opts.label_color;

    this.label_subtext = opts.label_subtext;

    this.color = opts.color || 'gray';
    this.total = opts.total;

    if (!this.data.length) {
      this.data = [{ value: this.value, color: this.color }];
    }

    this.type = opts.type || 'small';
  }

  draw() {
    var pie = d3.layout.pie().sort(null).startAngle(0).value(function(d){ return d.value; })
    ,   data = this.data
    ,   total = this.total
    ,   innerRadius = this.radius - this.thickness
    ,   outerRadius = this.radius
    ,   arc = function() { return d3.svg.arc().innerRadius(innerRadius).outerRadius(outerRadius) }
    ,   sum = 0
    ,   value
    ,   label
    ;

    for (var i = 0; i < data.length; i++) {
      sum += data[i].value;
    }

    if (this.total) {
      pie.endAngle(2.0 * Math.PI * sum / total);
    } else {
      total = sum;
    }

    this.el
      .classed('sonic-donut-graph', true)
      .style('width', this.size + 'px')
      .style('height', this.size + 'px')
      .html('')
    ;

    if (this.type) { this.el.classed(this.type, true); }

    var graph = this.el.append('div')
      .style('position', 'relative')
      .style('width', this.size + 'px')
      .style('height', this.size + 'px')
    ;

    var svg = graph
      .append('svg:svg')
      .attr('width', this.size)
      .attr('height', this.size)
    ;

    svg.append('svg:path')
      .classed('sonic-donut-graph-background', true)
      .attr('fill', '#e5e5e5')
      .attr('transform', 'translate(' + this.radius + ',' + this.radius + ')')
      .attr('d', arc().startAngle(0).endAngle(2 * Math.PI)())
    ;

    svg.append('svg:g')
      .selectAll('.sonic-donut-graph-arc')
      .data(pie(this.data))
      .enter()
        .append('svg:path')
          .classed('sonic-donut-graph-arc', true)
          .attr('transform', 'translate(' + this.radius + ',' + this.radius + ')')
          .attr('fill', function(d) { return d.data.color; })
          .attr('d', arc())
    ;

    if (this.label && this.label_position === 'center') {

      var label_group = graph.append("div")
        .style("position", "absolute")
        .style("display", "table")
        .style("top", this.thickness + "px")
        .style("left", this.thickness + "px")
        .style("width", this.size - (this.thickness * 2) + "px")
        .style("height", this.size - (this.thickness * 2) + "px")
      ;

      var label_group_inner = label_group.append("div")
        .style("display", "table-cell")
        .style("text-align", "center")
        .style("vertical-align", "middle")
      ;

      value = label_group_inner.append("div")
        .classed('sonic-donut-graph-value', true)
        .text(this.value_text)
      ;

      label = label_group_inner.append("div")
        .classed("sonic-donut-graph-label", true)
        .style("text-align", "center")
        .text(this.label)
      ;

    } else {

      value = graph.append('div')
        .classed("sonic-donut-graph-value", true)
        .style("white-space", "nowrap")
        .style("overflow", "visible")
        .style("display", "inline-block")
        .text(this.value_text)
      ;

      var value_rect = {
        width: parseInt(value.style('width'), 10),
        height: parseInt(value.style('height'), 10)
      };

      value
        .style('position', 'absolute')
        .style('left', ((this.size - value_rect.width) / 2) + 'px')
        .style('top', ((this.size - value_rect.height) / 2) + 'px');

      if (this.label) {
        var width = this.size;

        label = graph.append('div')
          .classed("sonic-donut-graph-label", true)
          .style("white-space", "nowrap")
          .style("overflow", "visible")
          .style("display", "inline-block")
          .text(this.label)
        ;

        if (this.label_subtext) {
          label.node().appendChild(document.createTextNode(" "));

          label.append('span')
            .classed("sonic-donut-graph-label-subtext", true)
            .text(this.label_subtext)
          ;
        }

        var label_rect = {
          width: parseInt(label.style('width'), 10),
          height: parseInt(label.style('height'), 10)
        };
        var space = (label_rect.height / 2);

        label
          .style('position', 'absolute')
          .style('left', this.size + space + 'px')
          .style('top', ((this.size - label_rect.height) / 2) + 'px');

        width += space + label_rect.width;

        svg.attr('width', width + 'px');
        this.el.style('width', width + 'px');
      }

      if (value && this.value_color) {
        value.style('color', this.value_color);
      }
      if (label && this.label_color) {
        label.style('color', this.label_color);
      }
    }
  }
}


//
// Donut Stack Graph
//

class DonutStackGraph extends Graph {
  constructor(el, data, options) {
    super(el, data, options);
    var opts = this.options;

    this.size = opts.size || 44;
    this.thickness = opts.thickness;
    this.total = opts.total;
    this.label_subtext = opts.label_subtext || '';
  }

  draw() {
    var data = this.data
    ,   total = this.total
    ,   i
    ;

    if (!total) {
      total = 0;
      for (i = 0; i < data.length; i++) {
        total += data[i].value;
      }
    }

    this.el
      .classed('sonic-donut-stack-graph', true)
      .html('') // Clear out contents
    ;

    for (i = 0; i < data.length; i++) {
      var item = this.el.append('div')
        .classed('sonic-donut-stack-graph-item', true)
      ;

      var subtext = formatInt(data[i].value);
      if (this.label_subtext) { subtext += ' ' + this.label_subtext; }

      var donut = new DonutGraph(item.node(), [], {
        total: total,
        value: data[i].value,
        value_text: formatInt(Math.round(100 * data[i].value / total)) + '%',
        value_color: data[i].color,
        label: data[i].label,
        label_position: 'right',
        label_subtext: subtext,
        color: data[i].color,
        size: this.size,
        thickness: this.thickness
      });

      donut.el
        .classed('sonic-donut-stack-graph-item-donut-graph');

      donut.draw();
    }
  }
}


//
// Horizontal Bar Graph
//

class HorizontalBarGraph extends Graph {
  constructor(el, data, options) {
    super(el, data, options);
    var opts = this.options;
    this.percentages = opts.percentages;
  }

  draw() {
    var total = d3.sum(this.data, function(d) { return d.value });

    var x = d3.scale.linear()
      .domain([0, d3.max(this.data, function(d) { return d.value })])
      .range([0, 100]);

    var percentage = d3.scale.linear()
      .domain([0, total])
      .range([0, 100]);

    this.el
      .classed("sonic-horizontal-bar-graph", true);

    var segment = this.el
      .selectAll(".sonic-horizontal-bar-graph-segment")
        .data(this.data)
      .enter()
        .append("div")
          .classed("sonic-horizontal-bar-graph-segment", true)
    ;

    var label = segment
      .append("div")
        .classed("sonic-horizontal-bar-graph-label", true)
    ;

    if (this.percentages) {
      label
        .text(function(d) {
          var percent_label = Math.round(percentage(d.value || 0));
          if (total === 0) { percent_label = '--'; }
          return percent_label + "% " + d.label;
        });
    } else {
      label
        .text(function(d) { return d.label });
    }

    label
      .append("span")
        .classed("sonic-horizontal-bar-graph-label-subtext", true)
        .text(function(d) { return d.label_subtext })
    ;

    segment
      .append("div")
        .classed("sonic-horizontal-bar-graph-value", true)
        .append("div")
          .classed("sonic-horizontal-bar-graph-value-bar", true)
          .style("background-color", function(d) { return d.color })
          .style("width", function(d) { return x(d.value || 0) + "%" })
          .style("min-width", "1px")
    ;
  }
}


//
// Pipeline Graph
//

class PipelineGraph extends Graph {
  constructor(el, data, options) {
    super(el, data, options);
    this.autosize = true;
    var opts = this.options;

    this.svg = this.el.append('svg');
    this.labels = !!data[0].label;
    this.label_subtext = !!data[0].label_subtext;
    this.colors = opts.colors || config.colors;
    this.tooltip = opts.tooltip || config.tooltip;
    this.formatter = opts.formatter || config.formatter;
  }

  draw() {
    var chart = this
    ,   svg = chart.svg
    ,   barHeight = 35
    ,   baselines = {label: 18, label_subtext: 16, bar: barHeight + 8}
    ,   total = d3.sum(this.data, function(d) { return d.value })
    ,   isEmpty = (total === 0)
    ,   formatPercentage = function(v) { return d3.format('%')(v) }
    ,   width
    ,   height
    ;

    // Class the element
    this.el.classed('sonic-pipeline-graph', true);

    // Calculate svg size
    svg.attr('width', 0); // Reset svg width to calculate width correctly
    width = chart.width = parseInt(this.el.style('width'), 10);
    height = chart.height = baselines.label + baselines.label_subtext + baselines.bar;

    // Set svg size
    svg
      .attr('width', width)
      .attr('height', height)
    ;

    if (isEmpty) {
      svg.attr('opacity', '0.25');
    }

    // Clear out existing stuff. Makes resize work for now...
    this.svg.html('');

    // Caclulate x and width for each datum
    var currentX = 0
    ,   lastIndex = this.data.length - 1
    ;
    this.data.forEach(function(d, i, data) {
      d.x = currentX;
      d.percentage = isEmpty ? (1 / data.length) : (d.value / total);
      if (i === lastIndex) {
        d.width = chart.width - currentX;
      } else {
        d.width = Math.floor(d.percentage * chart.width);
      }
      d.color = d.color || chart.colors(i);
      currentX += d.width;
    });

    // Create clip paths for each datum
    var clipPath = svg.append("defs")
      .selectAll('clipPath')
      .data(this.data)
    ;
    clipPath.enter()
      .append("clipPath")
      .attr("id", function(d, i) { return "clip-" + chart.id + '-' + i })
      .append("rect")
        .attr("width", function(d) { return d.width })
        .attr("height", height)
    ;
    clipPath.exit()
      .remove()
    ;

    // Items
    var item = svg
      .selectAll('.sonic-pipeline-graph-item')
      .data(this.data)
    ;

    item.exit()
      .remove()
    ;

    var enter = item.enter()
      .append('g')
       .attr('class', 'sonic-pipeline-graph-item')
       .attr('transform', function(d) { return 'translate(' + d.x + ',0)' })
       .attr('clip-path', function(d, i) { return 'url(#clip-' + chart.id + '-' + i + ')' })
    ;

    if (this.labels) {
      enter.append('text')
        .attr('class', 'sonic-pipeline-graph-item-label')
        .attr('x', 2)
        .attr('y', baselines.label)
        .text(function(d) {
          var percentage_label = formatPercentage(d.percentage);
          if (isEmpty) { percentage_label = '--' + '%'; }
          return percentage_label + ' ' + d.label;
        })
      ;
    } else {
      baselines.label = 0;
    }

    if (this.label_subtext) {
      enter.append('text')
        .attr('class', 'sonic-pipeline-graph-item-label-subtext')
        .attr('x', 2)
        .attr('y', baselines.label + baselines.label_subtext)
        .text(function(d) { return d.label_subtext })
      ;
    } else {
      baselines.label_subtext = 0;
    }

    this.height = height = baselines.label + baselines.label_subtext + baselines.bar;
    svg.attr("height", height);

    enter.append('rect')
      .attr('class', 'sonic-pipeline-graph-item-bar')
      .attr('fill', function(d) { return d.color })
      .attr('y', baselines.label + baselines.label_subtext + baselines.bar - barHeight)
      .attr('width', function(d) { return d.width })
      .attr('height', barHeight)
    ;

    this.attachMouseEvents();
  }

  attachMouseEvents() {
    var chart = this
    ,   svg = chart.svg
    ,   hovered = -1
    ;

    this.el.on('mousemove', throttle(function() {
      var mouseX = d3.mouse(svg.node())[0]
      ,   items = svg.selectAll('.sonic-pipeline-graph-item')
      ;

      items.each(function(d, i) {
        var el = d3.select(this)
        ,   bar = el.select('rect')
        ,   x = parseInt((/\d+/.exec(el.attr('transform')) || ['0'])[0], 10)
        ,   width = parseInt(bar.attr('width'), 10)
        ;

        if ( (i !== hovered) && (mouseX >= x) && (mouseX < x + width) ) {

          // Fire mouseleave if hovered
          if (hovered > -1) {
            var oldItem = items.filter(function(d, i) { return i === hovered });
            chart.mouseleave(oldItem, oldItem.datum(), hovered);
          }

          // Fire mouseenter
          chart.mouseenter(el, d, i);

          // Set hovered to current index
          hovered = i;

        }
      });

    }, 40));

    this.el.on('mouseleave', function() {
      if (hovered > -1) {
        var items = svg.selectAll('.sonic-pipeline-graph-item')
        ,   oldItem = items.filter(function(d, i) { return i === hovered })
        ;

        chart.mouseleave(oldItem, oldItem.datum(), hovered);

        hovered = -1;
      }
    });

    // Because we are attaching to the main element we only need to attach events
    // once, so zero out the function...
    this.attachMouseEvents = function() {};
  }

  mouseenter(el, datum, index) {
    var chart = this
    ,   svg = this.svg
    ,   color = datum.color
    ,   margin = 10
    ,   newWidth = 0
    ,   tip
    ;

    el.select('rect').attr('fill', d3.lab(color).brighter(0.3).toString());

    if (this.labels && this.label_subtext) {
      newWidth = Math.max(el.select('.sonic-pipeline-graph-item-label').node().getComputedTextLength(), el.select('.sonic-pipeline-graph-item-label-subtext').node().getComputedTextLength()) + margin;
    } else {
      if (this.labels) {
        newWidth = el.select('.sonic-pipeline-graph-item-label').node().getComputedTextLength() + margin;
      }
      if (this.label_subtext) {
        newWidth = el.select('.sonic-pipeline-graph-item-label-subtext').node().getComputedTextLength() + margin;
      }
    }

    newWidth = Math.ceil(newWidth);

    if (datum.width < newWidth) {
      var originalWidth = datum.width
      ,   additionalWidth = newWidth - originalWidth
      ,   item = svg.selectAll('.sonic-pipeline-graph-item')
      ,   currentX = 0
      ,   lastIndex = item[0].length - 1
      ;

      item.each(function(d, i) {
        var el = d3.select(this)
        ,   rect = el.select('rect')
        ,   clip = svg.select('#clip-' + chart.id + '-' + i).select('rect')
        ,   width = (i === index) ? newWidth : Math.floor(d.percentage * (chart.width - additionalWidth))
        ;

        if (i === lastIndex ) {
          width = chart.width - currentX;
        }

        el
          .transition().duration(200)
          .attr('transform', 'translate(' + currentX + ',0)')
        ;

        rect
          .transition().duration(200)
          .attr('width', width)
        ;

        clip
          .transition().duration(200)
          .attr('width', width)
        ;

        currentX += width;
      });

    }

    if (!datum.formatted_value) {
      datum.formatted_value = this.formatter(datum.value);
    }

    tip = chart.tooltip(chart, {segments: [datum]});
    if (tip) {
      chart.showTooltip({
        body: tip,
        position: 'bottom',
        target: el.select('rect').node(),
        chart: chart.el.node()
      });
    }
  }

  mouseleave(el, datum, index) {
    var chart = this
    ,   svg = this.svg
    ,   currentWidth = parseInt(svg.select('#clip-' + chart.id + '-' + index).select('rect').attr('width'), 10)
    ,   color = datum.color
    ;

    if (datum.width < currentWidth) {
      var item = svg.selectAll('.sonic-pipeline-graph-item');

      item.each(function(d, i) {
        var el = d3.select(this)
        ,   rect = el.select('rect')
        ,   clip = svg.select('#clip-' + chart.id + '-' + i).select('rect')
        ;

        el
          .transition().duration(200)
          .attr('transform', 'translate(' + d.x + ',0)')
        ;

        rect
          .transition().duration(200)
          .attr('width', d.width)
        ;

        clip
          .transition().duration(200)
          .attr('width', d.width)
        ;
      });
    }

    el.select('rect').attr('fill', color);

    chart.hideTooltip({
      target: el.select('rect').node()
    });
  }
}


//
// Legend
//

class Legend extends Graph {
  draw(animate) {
    var color = function(d) { return d.color }
    ,   label = function(d) { return d.label }
    ,   value = function(d) { return d.formatted_value || formatInt(d.value) }
    ;

    this.el.classed("sonic-legend", true);

    var item = this.el.selectAll(".sonic-legend-item")
      .data(this.data)
    ;
    
    // Update existing items
    item
      .select(".sonic-legend-item-swatch")
        .style("background-color", color)
    ;
    item
      .select(".sonic-legend-item-label")
        .text(label)
    ;
    item
      .select(".sonic-legend-item-value")
        .text(value)
    ;

    // Add new items
    var enter = item.enter()
      .append("div")
        .classed("sonic-legend-item", true)
      ;
    enter
      .filter(function(d) { return !!d.color })
      .append("span")
        .classed("sonic-swatch sonic-legend-item-swatch", true)
        .style("background-color", color)
    ;
    enter.append("span")
      .classed("sonic-legend-item-label", true)
      .text(label)
    ;
    enter.append("span")
      .classed("sonic-legend-item-value", true)
      .text(value)
    ;

    var exit = item.exit();

    if (animate) {
      // If animate, setup transitions
      enter
        .style('opacity', 0)
        .transition()
          .duration(1000)
          .style('opacity', 1)
      ;

      // Remove extra items with transition
      exit
        .transition()
          .style('opacity', 0)
          .remove()
      ;
    } else {
      // When not animating, just remove extra items without transition
      exit
        .remove()
      ;
    }
  }
}


//
// Exports
//

config.colors = d3.scale.category10();

var d3_number_formatter = d3.format(',');
config.formatter = function(value) {
  if(!(value || value === 0)){ return '--'; }
  return d3_number_formatter(value);
};

config.showTooltip = function() {};
config.hideTooltip = function() {};
config.tooltip = function(chart, data) {
  var el = d3.select(document.createElement('div'))
  ,   segments = flattenSeries(data.segments)
  ,   placard
  ,   legendEl
  ,   legend
  ,   date
  ;

  if (segments.length === 1) {
    var datum = segments[0];

    placard = el.append('div')
      .classed('sonic-tip-placard', true)
    ;

    placard.append('div')
      .classed('sonic-tip-placard-value', true)
      .text(datum.formatted_value || datum.value)
    ;

    placard.append('div')
      .classed('sonic-tip-placard-label', true)
      .text(datum.tip_label || datum.label)
    ;

  } else {
    legendEl = el.append('div');

    legend = new Legend(legendEl.node(), segments);
    legend.draw();
  }

  if (data.date) {
    date = el.append('div')
      .classed('sonic-tip-date', true)
      .text(chart.dateFormatter(data.date))
    ;
  }

  return el.node();
};

Sonic.configure = function(callback) {
  var opts = {};
  callback(opts);
  config.colors = opts.colors || config.colors;
  config.showTooltip = opts.showTooltip || config.showTooltip;
  config.hideTooltip = opts.hideTooltip || config.hideTooltip;
  config.tooltip = opts.tooltip || config.tooltip;
  config.formatter = opts.formatter || config.formatter;
};

Sonic.Legend = function(el, data, opts) {
  var chart = new Legend(el, data, opts);
  chart.drawWhenReady();
  return chart;
};

Sonic.Series = function(el, data, opts) {
  var chart = new SeriesGraph(el, data, opts);
  chart.drawWhenReady();
  return chart;
};

Sonic.Sparkline = function(el, data, opts) {
  var chart = new SparklineGraph(el, data, opts);
  chart.drawWhenReady();
  return chart;
};

Sonic.Pie = function(el, data, opts) {
  var chart = new PieGraph(el, data, opts);
  chart.drawWhenReady();
  return chart;
};

Sonic.Donut = function(el, data, opts) {
  var chart = new DonutGraph(el, data, opts);
  chart.drawWhenReady();
  return chart;
};

Sonic.DonutStack = function(el, data, opts) {
  var chart = new DonutStackGraph(el, data, opts);
  chart.drawWhenReady();
  return chart;
};

Sonic.HorizontalBar = function(el, data, opts) {
  var chart = new HorizontalBarGraph(el, data, opts);
  chart.drawWhenReady();
  return chart;
};

Sonic.Pipeline = function(el, data, opts) {
  var chart = new PipelineGraph(el, data, opts);
  chart.drawWhenReady();
  return chart;
};
