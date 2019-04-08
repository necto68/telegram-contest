// Detecting browsers
var isOpera = (!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;
var isSafari = /constructor/i.test(window.HTMLElement) || (function (p) { return p.toString() === "[object SafariRemoteNotification]"; })(!window.safari || (typeof safari !== 'undefined' && safari.pushNotification)) || navigator.userAgent.indexOf('Safari') != -1;
var isChrome = !!window.chrome && (!!window.chrome.webstore || !!window.chrome.runtime);


function getNormalizedValue(from, to, valueMin, valueMax, value) {
  return (to - from) * ((value - valueMin) / (valueMax - valueMin)) + from;
}
// Utility functions
function createEl(parent, name, tag) {
  var el;
  if (tag == 'svg') {
    el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('class', 'a-chart__' + name);
    parent.appendChild(el);
    return el;
  } else {
    el = document.createElement(tag || 'div');
    el.className = 'a-chart__' + name;
    parent.appendChild(el);
    return el;
  }
}

function createPath(svg, xs, series, width) {
  var line, i, d = [];
  line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  line.setAttribute('stroke', series.color);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke-width', width + 'px');
  line.setAttribute('vector-effect', 'non-scaling-stroke');
  line.setAttribute('stroke-linejoin', 'round');

  for (i = 0; i < series.pts.length; i++) {
    d.push(i == 0 ? 'M' : 'L');
    d.push((xs[i] - xs[0]) / 1e7 + ',' + series.pts[i]);
  }
  line.setAttribute('d', d.join(' '));

  svg.appendChild(line);
  return line;
}

function createPath1(svg, xs, series, width) {
  var g, i, d = [];
  g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  // g.setAttribute('stroke', 'white');
  g.setAttribute('fill', series.color);

  for (i = 0; i < series.pts.length; i++) {
    var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', (xs[i] - xs[0]) / 1e7);
    rect.setAttribute('y', series.pts[i] - 100);
    rect.setAttribute('width', xs[xs.length - 1] / 1e7 / 17650);
    rect.setAttribute('height', 100);
    g.appendChild(rect);
  }

  svg.appendChild(g);
  return g;
}

function getElementData(el, name) {
  if ('dataset' in el) {
    if (name in el.dataset) {
      return el.dataset[name];
    } else {
      return null;
    }
  }

  if (el.hasAttribute('data-' + name)) {
    return el.getAttribute('data-' + name);
  } else {
    return null;
  }
}

function setElementData(el, name, value) {
  if ('dataset' in el) {
    el.dataset[name] = value;
  } else {
    el.setAttribute('data-' + name, value);
  }
}

function animateTransform(el, scale, translate) {
  var sourceTime, sourceValue, targetValue;
  function update() {
    var step = Math.min(1, (Date.now() - sourceTime) / 300);
    step = step * step;
    setElementData(el, 'scaleY', scale[1] = sourceValue * (1 - step) + targetValue * step);
    el.setAttribute('transform', (translate ? 'translate(' + translate.join(',') + ') ' : '') + 'scale(' + scale.join(',') + ')');
    if (Math.abs(scale[1] - targetValue) > 1e-7) {
      setElementData(el, 'anim', requestAnimationFrame(update));
    }
  }

  // SVG in Chrome animates transforms both in styles and in attributes (via transitions)
  if (isChrome || isOpera) {
    el.setAttribute('transform', (translate ? 'translate(' + translate.join(',') + ') ' : '') + 'scale(' + scale.join(',') + ')');
  } else
  // SVG in Safari animates transforms only if it specified as style
  if (isSafari) {
    el.style.transform = (translate ? 'translate(' + translate.join('px,') + 'px) ' : '') + 'scale(' + scale.join(',') + ')';
  } else {
  // Firefox ignores non-scaling-stroke if transform is specified as style
  // It also means that we are forced to animate scale transitions by hand
    el.style.transition = '';
    if (getElementData(el, 'scaleY') === null) {
      setElementData(el, 'scaleY', scale[1]);
      el.setAttribute('transform', (translate ? 'translate(' + translate.join(',') + ') ' : '') + 'scale(' + scale.join(',') + ')');
      return;
    }

    // Manually animate scaleY
    if (getElementData(el, 'anim') !== null) {
      if (Math.abs(parseFloat(getElementData(el, 'scaleY1')) - scale[1]) < 1e-7) {
        return;
      }
      cancelAnimationFrame(getElementData(el, 'anim'));
    }

    sourceTime = Date.now();
    sourceValue = parseFloat(getElementData(el, 'scaleY'));
    setElementData(el, 'scaleY1', targetValue = scale[1]);
    update();
  }
}

function createDraggableBehavior(chart, el, handler, endHandler, attachToWrapper, hover) {
  var startX, oldMinX, oldMaxX, drag;
  function onDragStart(e) {
    if (!attachToWrapper || e.target === el) {
      var touch = e.touches ? e.touches[0] : e;
      startX = touch.pageX;
      oldMinX = chart.minX;
      oldMaxX = chart.maxX;
      drag = hover && (e.type == 'mousedown');

      document.body.addEventListener(e.touches ? 'touchmove' : 'mousemove', onDrag, false);
      document.body.addEventListener(e.touches ? 'touchend' : 'mouseup', onDragEnd, false);
      onDrag(e);

      if (attachToWrapper) {
        e.preventDefault && e.preventDefault();
        e.stopPropagation && e.stopPropagation();
        return false;
      }
    }
  }

  function onDrag(e) {
    var touch = e.touches ? e.touches[0] : e;
    handler(e, touch.pageX - startX, {
      minX: oldMinX,
      maxX: oldMaxX,
    }, drag);
  }

  function onDragEnd(e) {
    endHandler && endHandler(e, drag);
    if (drag) {
      drag = false;
    } else {
      document.body.removeEventListener('touchmove', onDrag, false);
      document.body.removeEventListener('touchend', onDragEnd, false);
      document.body.removeEventListener('mousemove', onDrag, false);
      document.body.removeEventListener('mouseup', onDragEnd, false);
    }
  }

  if (attachToWrapper) {
    chart.wrapperEl.addEventListener('touchstart', onDragStart, false);
    chart.wrapperEl.addEventListener('mousedown', onDragStart, false);
  } else {
    el.addEventListener('touchstart', onDragStart, false);
    el.addEventListener('mousedown', onDragStart, false);
    if (hover) {
      el.addEventListener('mouseenter', onDragStart, false);
      el.addEventListener('mouseleave', onDragEnd, false);
    }
  }
}

var WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatDate(date, showWeekday, showDay, showYear) {
  var result = [];
  date = new Date(date);
  if (showWeekday) {
    result.push(WEEKDAYS[date.getDay()], ', ');
  }
  if (showDay) {
    result.push(' ', date.getDate());
  }
  result.push(' ', MONTHS[date.getMonth()]);
  if (showYear) {
    result.push(' ', date.getFullYear());
  }
  return result.join('');
}

function formatNumber(n, shorten) {
  if (shorten) {
    if (n >= 1000000) {
      // Allow 1 decimal digit max
      return Math.floor(n / 100000) / 10 + 'M';
    }
    if (n >= 1000) {
      return Math.floor(n / 100) / 10 + 'K';
    }
  }
  return n.toLocaleString();
}

function AChart(wrapperId, data) {
  var i, j, k, pts, label, icon;
  // Constants
  this.MIN_WINDOW_SIZE = 40; // px
  this.MIN_DAY_SIZE = 70; // px
  this.SIDE_PADDING = 18; // px


  // Convert input data to more usable format
  this.recalculatePoints = function(data) {
    this.series = [];

    for (k in data.types) {
      for (j = 0; j < data.columns.length; j++) {
        if (data.columns[j][0] == k) {
          pts = data.columns[j].slice(1);
        }
      }

      if (data.types[k] == 'x') {
        this.xs = pts;
      } else
      if (data.types[k] == 'line') {
        this.series.push({
          isActive: true,
          ptsLabels: pts,
          pts: data.y_scaled && k === 'y1' ? 
            pts.map(p => getNormalizedValue(
              Math.min(...this.series[this.series.length - 1].pts),
              Math.max(...this.series[this.series.length - 1].pts),
              Math.min(...pts),
              Math.max(...pts),
              p
            )) : pts,
          name: data.names[k],
          color: data.colors[k],
          doubleY: Boolean(data.y_scaled),
          minY: Math.min(...pts),
          maxY: Math.max(...pts),
        });
      } else {
        throw new Error('Unsupported series type: "' + data.types[k] + '"');
      }
    }

    this.gminX = this.xs[0];
    this.gmaxX = this.xs[this.xs.length - 1];
    this.minX = this.gmaxX - 4e9;
    this.maxX = this.gmaxX;
    this.selectionIndex = null;

  }.bind(this);

  // Event handlers
  this.onLegendLabelToggle = function(index) {
    this.series[index].isActive = !this.series[index].isActive;
    this.updateView();
  }

  this.onYLineTransitionEnd = function(e) {
    for (var i = 0; i < this.yLines.length; i++) {
      if (this.yLines[i].lineEl == e.target) {
        e.target.removeEventListener('transitionend', this.onYLineTransitionEnd, true);
        this.gridContainerEl.removeChild(this.yLines[i].labelEl);
        this.gridContainerEl.removeChild(this.yLines[i].lineEl);
        this.yLines.splice(i, 1);
        return;
      }
    }
  }.bind(this);

  this.onXLabelTransitionEnd = function(e) {
    for (var i = 0; i < this.xLabels.length; i++) {
      if (this.xLabels[i].el == e.target) {
        e.target.removeEventListener('transitionend', this.onXLabelTransitionEnd, true);
        this.xAxisEl.removeChild(this.xLabels[i].el);
        this.xLabels.splice(i, 1);
        return;
      }
    }
  }.bind(this);

  // calculate initial points
  this.recalculatePoints(data);

  // Build static DOM structure
  this.wrapperEl = document.getElementById(wrapperId);
  this.wrapperEl.classList.add('a-chart');
  this.viewEl = createEl(this.wrapperEl, 'view');
  createDraggableBehavior(this, this.viewEl, function(e, delta, old, drag) {
    var i, touch, x;
    if (drag) {
      delta = -delta / this.scaleX;
      delta = Math.max(delta, this.gminX - old.minX);
      delta = Math.min(delta, this.gmaxX - old.maxX);
      this.minX = old.minX + delta;
      this.maxX = old.maxX + delta;
      //this.selectionIndex = null;
      for (i = 0; i < this.selectionBubbleEls.length; i++) {
        this.selectionBubbleEls[i].classList.add('is-animated');
      }
      this.updateView();
      return;
    }

    touch = e.touches ? e.touches[0] : e;
    x = this.minX + (touch.pageX - this.viewEl.getBoundingClientRect().left - window.pageXOffset - this.SIDE_PADDING) / this.scaleX;
    this.selectionIndex = 0;
    for (i = 1; i < this.xs.length; i++) {
      if (this.xs[i] < this.minX || this.xs[i] > this.maxX) {
        continue;
      }
      if (Math.abs(this.xs[i] - x) < Math.abs(this.xs[this.selectionIndex] - x)) {
        this.selectionIndex = i;
      }
    }

    for (i = 0; i < this.selectionBubbleEls.length; i++) {
      this.selectionBubbleEls[i].classList.remove('is-animated');
    }
    this.updateView();
  }.bind(this), function(e, drag) {
    for (var i = 0; i < this.selectionBubbleEls.length; i++) {
      this.selectionBubbleEls[i].classList.toggle('is-animated', !drag);
    }
    if (!e.touches && !drag) {
      this.selectionIndex = null;
      this.updateView();
    }
  }.bind(this), false, true);
  document.body.addEventListener('touchstart', function(e) {
    var el = e.target;
    while (el !== document.body) {
      if (el === this.wrapperEl) {
        return;
      }
      el = el.parentNode;
    }

    this.selectionIndex = null;
    this.updateView();
  }.bind(this), true);

  this.gridContainerEl = createEl(this.viewEl, 'grid-container');
  this.yLines = [];

  this.selectionLineEl = createEl(this.viewEl, 'selection-line');

  this.viewSvg = createEl(this.viewEl, 'view-svg', 'svg');
  this.viewLineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  this.viewLineGroup.setAttribute('vector-effect', 'non-scaling-stroke');
  this.viewSvg.appendChild(this.viewLineGroup);
  this.viewPaths = [];
  for (i = 0; i < this.series.length; i++) {
    this.viewPaths.push(createPath(this.viewLineGroup, this.xs, this.series[i], 2.2));
  }

  this.topOverlayEl = createEl(this.viewEl, 'top-overlay');

  this.selectionBubbleEls = [];
  for (i = 0; i < this.series.length; i++) {
    this.selectionBubbleEls.push(createEl(this.viewEl, 'selection-bubble is-series-' + i));
  }
  this.selectionBoxEl = createEl(this.viewEl, 'selection-box');

  this.xAxisEl = createEl(this.wrapperEl, 'x-axis');
  this.xLabels = [];

  this.overviewEl = createEl(this.wrapperEl, 'overview');
  this.overviewSvg = createEl(this.overviewEl, 'overview-svg', 'svg');
  this.overviewPaths = [];
  for (i = 0; i < this.series.length; i++) {
    this.overviewPaths.push(createPath(this.overviewSvg, this.xs, this.series[i], 1.2));
  }

  this.overviewWindowEl = createEl(this.overviewEl, 'overview-window');
  createDraggableBehavior(this, this.overviewWindowEl, function(e, delta, old) {
    delta = delta / this.gscaleX;
    delta = Math.max(delta, this.gminX - old.minX);
    delta = Math.min(delta, this.gmaxX - old.maxX);
    this.minX = old.minX + delta;
    this.maxX = old.maxX + delta;
    this.selectionIndex = null;
    this.updateView();
  }.bind(this), false, true);
  this.overviewHandleLeftEl = createEl(this.overviewWindowEl, 'overview-handle is-left');
  createDraggableBehavior(this, this.overviewHandleLeftEl, function(e, delta, old) {
    delta = delta / this.gscaleX;
    this.minX = Math.max(this.gminX, old.minX + delta);
    this.minX = Math.min(this.minX, this.maxX - this.MIN_WINDOW_SIZE / this.gscaleX);
    this.selectionIndex = null;
    this.updateView();
  }.bind(this), false, true);
  this.overviewHandleRightEl = createEl(this.overviewWindowEl, 'overview-handle is-right');
  createDraggableBehavior(this, this.overviewHandleRightEl, function(e, delta, old) {
    delta = delta / this.gscaleX;
    this.maxX = Math.max(this.minX + this.MIN_WINDOW_SIZE / this.gscaleX, old.maxX + delta);
    this.maxX = Math.min(this.maxX, this.gmaxX);
    this.selectionIndex = null;
    this.updateView();
  }.bind(this), false, true);
  createDraggableBehavior(this, this.overviewSvg, function(e, delta) {
    var touch = e.touches ? e.touches[0] : e,
        sz = Math.max(Math.abs(delta), this.MIN_WINDOW_SIZE) / this.gscaleX,
        x1 = touch.pageX - this.overviewSvg.getBoundingClientRect().left - window.pageXOffset,
        mid = this.gminX + (x1 - delta / 2) / this.gscaleX;
    mid = Math.max(this.gminX + this.MIN_WINDOW_SIZE / this.gscaleX / 2, mid);
    mid = Math.min(this.gmaxX - this.MIN_WINDOW_SIZE / this.gscaleX / 2, mid);
    this.minX = Math.max(this.gminX, mid - sz / 2);
    this.maxX = Math.min(mid + sz / 2, this.gmaxX);
    this.selectionIndex = null;
    this.updateView();
  }.bind(this));
  this.overviewWindowEl.addEventListener('dblclick', function(e) {
    if (Math.abs(this.minX - this.gminX) < 1e-7 && Math.abs(this.maxX - this.gmaxX) < 1e-7) {
      var mid = this.gminX + (e.pageX - this.overviewEl.getBoundingClientRect().left - window.pageXOffset) / this.gscaleX;
      mid = Math.max(this.gminX + this.MIN_WINDOW_SIZE / this.gscaleX / 2, mid);
      mid = Math.min(this.gmaxX - this.MIN_WINDOW_SIZE / this.gscaleX / 2, mid);
      this.minX = mid - this.MIN_WINDOW_SIZE / this.gscaleX / 2;
      this.maxX = mid + this.MIN_WINDOW_SIZE / this.gscaleX / 2;
    } else {
      this.minX = this.gminX;
      this.maxX = this.gmaxX;
    }
    this.selectionIndex = null;
    this.updateView();
  }.bind(this), false);
  this.overviewEl.addEventListener('wheel', function(e) {
    if (!e.ctrlKey) {
      // To allow scrolling
      return;
    }
    
    var pos = 0.5, mid = (this.minX + this.maxX) / 2,
        x = this.gminX + (e.pageX - this.overviewEl.getBoundingClientRect().left - window.pageXOffset) / this.gscaleX,
        sz = this.maxX - this.minX;
    if (x >= this.minX && x <= this.maxX) {
      pos = (x - this.gminX) / (this.gmaxX - this.gminX);
      mid = x;
    }
    sz = Math.max(sz - e.deltaY / this.gscaleX, this.MIN_WINDOW_SIZE / this.gscaleX);
    if (mid - sz * (1 - pos) <= this.gminX) {
      this.minX = this.gminX;
      this.maxX = Math.min(this.minX + sz, this.gmaxX);
    } else
    if (mid + sz * pos >= this.gmaxX) {
      this.maxX = this.gmaxX;
      this.minX = Math.max(this.maxX - sz, this.gminX);
    } else {
      this.minX = mid - sz * (1 - pos);
      this.maxX = mid + sz * pos;
    }
    e.preventDefault();
    this.updateView();
  }.bind(this), false);

  this.legendEl = createEl(this.wrapperEl, 'legend');
  this.legendLabelEls = [];
  for (i = 0; i < this.series.length; i++) {
    label = createEl(this.legendEl, 'legend-label is-series-' + i + ' is-active');
    label.innerText = this.series[i].name;
    label.style.setProperty('--shadow-color', this.series[i].color);
    icon = createEl(label, 'legend-checkmark');
    // icon.style.color = this.series[i].color;
    label.addEventListener('click', this.onLegendLabelToggle.bind(this, i), true);
    this.legendLabelEls.push(label);
  }

  this.noDataEl = createEl(this.viewEl, 'no-data');
  this.noDataEl.innerText = 'No data';

  this.updateView();

  setTimeout(function() {
    this.wrapperEl.classList.add('is-animated');
  }.bind(this), 0);

  window.addEventListener('resize', this.updateView.bind(this), true);
  this.initialized = true;
}

AChart.prototype.updateView = function() {
  var W = this.viewEl.offsetWidth - this.SIDE_PADDING * 2,
      H = this.viewEl.offsetHeight,
      oH = this.overviewEl.offsetHeight,
      maxY = 0, gmaxY = 0,
      maxYRight = 0,
      firstX = null, noData = true, i, j, x, y,
      scaleX = W / (this.maxX - this.minX),
      gscaleX = W / (this.gmaxX - this.gminX),
      order, orderRight,
      scaleX, gscaleX, scaleY, gscaleY, series,
      oldScaleY = this.scaleY, 
      add, addRight,
      line, updateLine, updateLabel,
      stepX,
      stepY, stepYRight, 
      day, label, left, percent, highest, windowL, windowR, html;

  for (i = 0; i < this.series.length; i++) {
    series = this.series[i];
    if (series.isActive || series.doubleY) {
      for (j = 0; j < this.xs.length; j++) {
        noData = false;
        if (this.minX <= this.xs[j] && this.xs[j] <= this.maxX) {
          maxY = Math.max(maxY, series.ptsLabels[j]);
          // if (series.doubleY && i === 1) {
          //   maxYRight = Math.max(maxYRight, series.ptsLabels[j]);
          // }
          if (firstX === null) {
            firstX = this.xs[j];
          }
        }
        gmaxY = Math.max(gmaxY, series.ptsLabels[j]);
      }
    }
  }

  this.noDataEl.style.display = noData ? 'block' : 'none';

  order = Math.pow(10, Math.floor(Math.log(maxY) * Math.LOG10E)) / 2;
  maxY = Math.ceil(maxY / order) * order;
  stepY = maxY / 5;
  scaleY = (H - 30) / maxY;
  gscaleY = (oH - 4) / gmaxY;
  oldScaleY = this.scaleY;

  // orderRight = Math.pow(10, Math.floor(Math.log(maxYRight) * Math.LOG10E)) / 2;
  // maxYRight = Math.ceil(maxYRight / orderRight) * orderRight;
  // stepYRight = maxYRight / 5;

  // Update horizontal grid lines & labels
  add = {};
  if (!noData) {
    for (i = 0; i <= 5; i++) {
      add[stepY * i] = true;
    }
  }

  addRight = {0: true};
  if (!noData) {
    for (i = 1; i <= 5; i++) {
      addRight[getNormalizedValue(
        this.series[1].minY,
        this.series[1].maxY,
        this.series[0].minY,
        this.series[0].maxY,
        Object.keys(add)[i])
      ] = true;
    }
  }

  for (i = 0; i < this.yLines.length; i++) {
    line = this.yLines[i];
    if (add[line.y]) {
      line.lineEl.style.opacity = 1;
      line.labelEl.style.opacity = 1;
      delete add[line.y];
      delete addRight[line.yRight];
      line.lineEl.removeEventListener('transitionend', this.onYLineTransitionEnd, true);
    } else {
      line.lineEl.style.opacity = 0;
      line.labelEl.style.opacity = 0;
      line.lineEl.addEventListener('transitionend', this.onYLineTransitionEnd, true);
    }
    line.lineEl.style.bottom = line.y * scaleY + 'px';
    line.labelEl.style.bottom = line.y * scaleY + 'px';
  }

  Object.keys(add).forEach((y, index) => {
    const yRight = Object.keys(addRight)[index];

    line = {
      y: y,
      yRight: yRight,
      lineEl: createEl(this.gridContainerEl, 'y-line'),
      labelEl: createEl(this.gridContainerEl, 'y-label'),
    };
    line.labelEl.innerHTML = this.series[0].doubleY 
      ? `<div style="color:${this.series[0].color}">${this.series[0].isActive ? formatNumber(y, true) : ''}</div>` + `<div style="color:${this.series[1].color}">${this.series[1].isActive ? formatNumber(yRight, true) : ''}</div>`
      : formatNumber(y, true);

    if (this.scaleY !== undefined) {
      line.lineEl.style.bottom = line.y * oldScaleY + 'px';
      line.labelEl.style.bottom = line.y * oldScaleY + 'px';
    }

    updateLine = function(line) {
      line.lineEl.style.opacity = 1;
      line.lineEl.style.bottom = line.y * scaleY + 'px';
      line.labelEl.style.opacity = 1;
      line.labelEl.style.bottom = line.y * scaleY + 'px';
    }.bind(this, line);

    if (this.initialized) {
      setTimeout(updateLine, 0);
    } else {
      updateLine();
    }
    this.yLines.push(line);
  })

  // Update horizontal axis labels
  stepX = 1000 * 60 * 60 * 24;
  while (stepX * scaleX < this.MIN_DAY_SIZE) {
    stepX *= 2;
  }
  day = Math.floor(firstX / stepX) * stepX;

  add = {};
  if (!noData) {
    while ((day - this.minX - stepX) * scaleX < W && day <= this.gmaxX) {
      if (day >= this.gminX) {
        add[day] = true;
      }
      day += stepX;
    }
  }

  for (i = 0; i < this.xLabels.length; i++) {
    label = this.xLabels[i];
    if (add[label.x]) {
      label.el.style.opacity = 1;
      delete add[label.x];
      label.el.removeEventListener('transitionend', this.onXLabelTransitionEnd, true);
    } else {
      label.el.style.opacity = 0;
      label.el.addEventListener('transitionend', this.onXLabelTransitionEnd, true);
    }
    label.el.style.left = ((label.x - this.minX) * scaleX + this.SIDE_PADDING * 2 - 50) + 'px';
  }

  for (x in add) {
    label = {
      x: x,
      el: createEl(this.xAxisEl, 'x-label'),
    };
    label.el.innerText = formatDate(parseFloat(x), false, true);
    label.el.style.left = ((label.x - this.minX) * scaleX + this.SIDE_PADDING * 2 - 50) + 'px';
    updateLabel = function(label) {
      label.el.style.opacity = 1;
    }.bind(this, label);

    if (this.initialized) {
      setTimeout(updateLabel, 0);
    } else {
      updateLabel();
    }
    this.xLabels.push(label);
  }

  // Update main view paths
  if (!noData) {
    animateTransform(this.viewLineGroup, [scaleX * 1e7, 1], [(this.gminX - this.minX) * scaleX + this.SIDE_PADDING, 0]);
    for (i = 0; i < this.overviewPaths.length; i++) {
      animateTransform(this.viewPaths[i], [1, scaleY]);
    }
  }
  for (i = 0; i < this.overviewPaths.length; i++) {
    this.viewPaths[i].style.opacity = this.series[i].isActive ? 1 : 0;
  }

  // Update selection
  if (this.selectionIndex === null || noData) {
    this.selectionLineEl.style.display = 'none';
    for (i = 0; i < this.selectionBubbleEls.length; i++) {
      this.selectionBubbleEls[i].style.display = 'none';
    }
    this.selectionBoxEl.style.display = 'none';
  } else {
    left = (this.xs[this.selectionIndex] - this.minX) * scaleX + this.SIDE_PADDING;
    percent = (this.xs[this.selectionIndex] - this.minX) / (this.maxX - this.minX);
    highest = 0;
    this.selectionLineEl.style.display = 'block';
    this.selectionLineEl.style.left = left + 'px';
    for (i = 0; i < this.selectionBubbleEls.length; i++) {
      y = this.series[i].pts[this.selectionIndex] * scaleY;
      this.selectionBubbleEls[i].style.display = 'block';
      this.selectionBubbleEls[i].style.opacity = this.series[i].isActive ? 1 : 0;
      this.selectionBubbleEls[i].style.borderColor = this.series[i].color;
      this.selectionBubbleEls[i].style.left = left + 'px';
      this.selectionBubbleEls[i].style.bottom = y + 'px';
      if (this.series[i].isActive) {
        highest = Math.min(highest, H - y - this.selectionBoxEl.offsetHeight - 15);
      }
    }

    html = [formatDate(this.xs[this.selectionIndex], true, true, true)];
    html.push('<div class="a-chart__selection-box-labels">');
    for (i = 0; i < this.series.length; i++) {
      if (this.series[i].isActive) {
        html.push('<div style="color: ', this.series[i].color, '">',
          '<b>', formatNumber(this.series[i].ptsLabels[this.selectionIndex]), '</b>', this.series[i].name,
        '</div>');
      }
    }
    html.push('</div>');
    this.selectionBoxEl.innerHTML = html.join('');

    this.selectionBoxEl.style.display = 'block';
    this.selectionBoxEl.style.left =
      Math.max(this.SIDE_PADDING / 2,
        Math.min(W - this.selectionBoxEl.offsetWidth + this.SIDE_PADDING * 3 / 2,
          left - (this.selectionBoxEl.offsetWidth - this.SIDE_PADDING) * percent - this.SIDE_PADDING / 2)) + 'px';
    this.selectionBoxEl.style.top = highest + 'px';
  }

  // Update overview paths
  for (i = 0; i < this.overviewPaths.length; i++) {
    this.overviewPaths[i].style.opacity = this.series[i].isActive ? 1 : 0;
    if (!noData) {
      animateTransform(this.overviewPaths[i], [gscaleX * 1e7, gscaleY]);
    }
  }

  // Update overview window
  windowL = (this.minX - this.gminX) / (this.gmaxX - this.gminX);
  windowR = (this.maxX - this.gminX) / (this.gmaxX - this.gminX);
  this.overviewWindowEl.style.left = (windowL * 100) + '%';
  this.overviewWindowEl.style.right = (100 - windowR * 100) + '%';

  // Update legend labels
  for (i = 0; i < this.series.length; i++) {
    this.legendLabelEls[i].classList.toggle('is-active', this.series[i].isActive);
  }

  this.scaleX = scaleX;
  this.scaleY = scaleY;
  this.gscaleX = gscaleX;
  this.gscaleY = gscaleY;
}
