import { chartData } from './chart_data';

const isOpera =
    (Boolean(window.opr) && Boolean(opr.addons)) || Boolean(window.opera) || navigator.userAgent.indexOf(' OPR/') >= 0,
  isSafari =
    /constructor/i.test(window.HTMLElement) ||
    (function(p) {
      return p.toString() === '[object SafariRemoteNotification]';
    })(!window.safari || (typeof safari !== 'undefined' && safari.pushNotification)) ||
    navigator.userAgent.indexOf('Safari') != -1,
  isChrome = Boolean(window.chrome) && (Boolean(window.chrome.webstore) || Boolean(window.chrome.runtime));

function getNormalizedValue(from, to, valueMin, valueMax, value) {
  return (to - from) * ((value - valueMin) / (valueMax - valueMin)) + from;
}

function createEl(parent, name, tag) {
  let el;

  if (tag == 'svg') {
    el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('class', `tg-ch--${name}`);
    parent.appendChild(el);

    return el;
  }
  el = document.createElement(tag || 'div');
  el.className = `tg-ch--${name}`;
  parent.appendChild(el);

  return el;
}

function buildPathString(series, xs) {
  const { isActive } = series,
    d = [],
    width = xs[xs.length - 1] / 1e7 / 17992;

  d.push(`0,${0}`);

  for (let i = 0; i < series.pts.length; i++) {
    d.push(`${(xs[i] - xs[0]) / 1e7},${series.pts[i]}`);

    if (!series.isPercentage) {
      d.push(`${(xs[i] - xs[0]) / 1e7 + width},${series.pts[i]}`);
    }
  }

  const lastP = xs[xs.length - 1];

  if (!series.isPercentage) {
    d.push(`${(lastP - xs[0]) / 1e7 + width},${0}`);
  } else {
    d.push(`${(lastP - xs[0]) / 1e7},${0}`);
  }

  return d.join(' ');
}

function createPath(svg, xs, seriesArr, index, width) {
  const series = seriesArr[index];

  if (series.isBar) {
    var animate, d, i, polygon;

    polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    animate = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    polygon.setAttribute('stroke', 'none');
    polygon.setAttribute('fill', series.color);
    polygon.classList.add('animatable');

    d = buildPathString(series, xs);

    animate.setAttribute('attributeName', 'points');
    animate.setAttribute('from', d);
    animate.setAttribute('to', d);
    animate.setAttribute('dur', '300ms');
    animate.setAttribute('fill', 'freeze');
    animate.setAttribute('begin', 'indefinite');

    polygon.appendChild(animate);

    polygon.setAttribute('points', d);

    svg.appendChild(polygon);

    return polygon;
  }

  var line,
    i,
    d = [];

  line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  line.setAttribute('stroke', series.color);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke-width', `${width}px`);
  line.setAttribute('vector-effect', 'non-scaling-stroke');
  line.setAttribute('stroke-linejoin', 'round');
  line.classList.add('animatable');

  for (i = 0; i < series.pts.length; i++) {
    d.push(i == 0 ? 'M' : 'L');
    d.push(`${(xs[i] - xs[0]) / 1e7},${series.pts[i]}`);
  }
  line.setAttribute('d', d.join(' '));

  svg.appendChild(line);

  return line;
}

function getElementData(el, name) {
  if ('dataset' in el) {
    if (name in el.dataset) {
      return el.dataset[name];
    }

    return null;
  }

  if (el.hasAttribute(`data-${name}`)) {
    return el.getAttribute(`data-${name}`);
  }

  return null;
}

function setElementData(el, name, value) {
  if ('dataset' in el) {
    el.dataset[name] = value;
  } else {
    el.setAttribute(`data-${name}`, value);
  }
}

function animateTransform(el, scale, translate) {
  let sourceTime, sourceValue, targetValue;

  function update() {
    let step = Math.min(1, (Date.now() - sourceTime) / 200);

    step *= step;
    setElementData(el, 'scaleY', (scale[1] = sourceValue * (1 - step) + targetValue * step));
    el.setAttribute('transform', `${translate ? `translate(${translate.join(',')}) ` : ''}scale(${scale.join(',')})`);
    if (Math.abs(scale[1] - targetValue) > 1e-7) {
      setElementData(el, 'anim', requestAnimationFrame(update));
    }
  }

  if (isChrome || isOpera) {
    el.setAttribute('transform', `${translate ? `translate(${translate.join(',')}) ` : ''}scale(${scale.join(',')})`);
  } else if (isSafari) {
    el.style.transform = `${translate ? `translate(${translate.join('px,')}px) ` : ''}scale(${scale.join(',')})`;
  } else {
    el.style.transition = '';
    if (getElementData(el, 'scaleY') === null) {
      setElementData(el, 'scaleY', scale[1]);
      el.setAttribute('transform', `${translate ? `translate(${translate.join(',')}) ` : ''}scale(${scale.join(',')})`);

      return;
    }

    if (getElementData(el, 'anim') !== null) {
      if (Math.abs(parseFloat(getElementData(el, 'scaleY1')) - scale[1]) < 1e-7) {
        return;
      }
      cancelAnimationFrame(getElementData(el, 'anim'));
    }

    sourceTime = Date.now();
    sourceValue = parseFloat(getElementData(el, 'scaleY'));
    setElementData(el, 'scaleY1', (targetValue = scale[1]));
    update();
  }
}

function createDraggableBehavior(chart, el, handler, endHandler, attachToWrapper, hover) {
  let drag, oldMaxX, oldMinX, startX;

  function onDragStart(e) {
    if (!attachToWrapper || e.target === el) {
      const touch = e.touches ? e.touches[0] : e;

      startX = touch.pageX;
      oldMinX = chart.minX;
      oldMaxX = chart.maxX;
      drag = hover && e.type == 'mousedown';

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
    const touch = e.touches ? e.touches[0] : e;

    handler(
      e,
      touch.pageX - startX,
      {
        minX: oldMinX,
        maxX: oldMaxX
      },
      drag
    );
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

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(date, showWeekday, showDay, showYear) {
  const result = [];

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
      return `${Math.floor(n / 100000) / 10}M`;
    }
    if (n >= 1000) {
      return `${Math.floor(n / 100) / 10}K`;
    }
  }

  return n.toLocaleString();
}

function TGChart(wrapperId, data) {
  let i, icon, j, k, label, pts;

  this.MIN_WINDOW_SIZE = 40;
  this.MIN_DAY_SIZE = 70;
  this.SIDE_PADDING = 18;

  this.initPoints = function(data) {
    this.series = [];

    for (k in data.types) {
      for (j = 0; j < data.columns.length; j++) {
        if (data.columns[j][0] == k) {
          pts = data.columns[j].slice(1);
        }
      }

      if (data.types[k] == 'x') {
        this.xs = pts;
      } else if (data.types[k] == 'line') {
        this.series.push({
          isActive: true,
          ptsLabels: pts,
          pts:
            data.y_scaled && k === 'y1'
              ? pts.map(p =>
                  getNormalizedValue(
                    Math.min(...this.series[this.series.length - 1].pts),
                    Math.max(...this.series[this.series.length - 1].pts),
                    Math.min(...pts),
                    Math.max(...pts),
                    p
                  )
                )
              : pts,
          name: data.names[k],
          color: data.colors[k],
          doubleY: Boolean(data.y_scaled),
          minY: Math.min(...pts),
          maxY: Math.max(...pts)
        });
      } else if (data.types[k] == 'bar') {
        this.series.push({
          isActive: true,
          isBar: true,
          isStacked: Boolean(data.stacked),
          ptsLabels: pts,
          pts: pts.map(
            (currPts, index) =>
              currPts * (data.stacked ? 1 : 0.1) +
              (this.series[this.series.length - 1] ? this.series[this.series.length - 1].pts[index] : 0)
          ),
          name: data.names[k],
          color: data.colors[k],
          minY: Math.min(...pts),
          maxY: Math.max(...pts)
        });
      } else if (data.types[k] == 'area') {
        this.series.push({
          isActive: true,
          isBar: true,
          isPercentage: Boolean(data.percentage),
          isStacked: Boolean(data.stacked),
          ptsLabels: pts,
          pts: pts.map(
            (currPts, index) =>
              currPts + (this.series[this.series.length - 1] ? this.series[this.series.length - 1].pts[index] : 0)
          ),
          name: data.names[k],
          color: data.colors[k],
          minY: Math.min(...pts),
          maxY: Math.max(...pts)
        });
      } else {
        throw new Error(`type = ${data.types[k]}`);
      }
    }

    if (this.series[0].isPercentage) {
      this.series = this.series.map(s => ({
        ...s,
        pts: s.pts.map((p, pIndex) => {
          const maxY = this.series[this.series.length - 1].pts[pIndex];

          return (p / maxY) * 100;
        })
      }));
    }

    this.series = this.series.reverse();
  }.bind(this);

  this.getRecalculatedPointsForSeries = function(index) {
    this.series = this.series.reverse();
    let nextSeries = [];

    const getPrevVisibleLine = (index, seriesArr) => {
        for (index--; index >= 0; index--) {
          if (seriesArr[index] && seriesArr[index].isActive) {
            return seriesArr[index];
          }
        }

        return null;
      },
      visibleSeries = this.series.filter(s => s.isActive);

    this.series.forEach((s, sIndex) => {
      const { isActive, ptsLabels } = s,
        prevVisibleLine = getPrevVisibleLine(sIndex, nextSeries);

      if (isActive) {
        nextSeries.push({
          ...s,
          pts: ptsLabels.map((currPts, index) => {
            const nextValue = currPts + (prevVisibleLine ? prevVisibleLine.pts[index] : 0);

            return nextValue;
          })
        });
      } else {
        nextSeries.push({
          ...s,
          pts: prevVisibleLine ? prevVisibleLine.pts : Array(s.pts.length).fill(0)
        });
      }
    });

    if (nextSeries[0].isPercentage) {
      nextSeries = nextSeries.map(s => ({
        ...s,
        pts: s.pts.map((p, pIndex) => {
          const visibleNextSeries = nextSeries.filter(s => s.isActive),
            maxY = nextSeries[nextSeries.length - 1].pts[pIndex];

          return (p / maxY) * 100;
        })
      }));
    }

    this.series = this.series.reverse();

    return nextSeries.reverse()[index].pts;
  };

  this.initPoints(data);

  this.gminX = this.xs[0];
  this.gmaxX = this.xs[this.xs.length - 1];
  this.minX = this.xs[Math.round(this.xs.length / 3)];
  this.maxX = this.xs[Math.round((this.xs.length / 3) * 2)];
  this.selectionIndex = null;

  this.dateRangeEl = document.querySelector(`#tg-ch-range-${wrapperId.replace(/\D/g, '')}`);

  this.onLegendLabelToggle = function(index) {
    this.series[index].isActive = !this.series[index].isActive;
    this.updateView();

    if (this.series[0].isStacked) {
      const getNextVisibleLine = (index, seriesArr) => {
        for (let i = index + 1; i < seriesArr.length; i++) {
          if (seriesArr[i] && seriesArr[i].isActive) {
            return seriesArr[i];
          }
        }

        return null;
      };

      this.series.forEach((currSeries, currIndex) => {
        const nextPath = buildPathString(
          {
            ...currSeries,
            pts: this.getRecalculatedPointsForSeries(currIndex)
          },
          this.xs
        );

        [this.viewLineGroup.children[currIndex], this.overviewSvg.children[currIndex]].forEach(path => {
          const animate = path.children[0],
            { animatedPoints } = path,
            prevAnimatedPoints = Array(animatedPoints.numberOfItems)
              .fill()
              .map((_, index) => {
                const { x, y } = animatedPoints.getItem(index);

                return `${x},${y}`;
              })
              .join(' ');

          animate.setAttribute('from', prevAnimatedPoints);
          animate.setAttribute('to', nextPath);
        });
      });

      this.series.forEach((_, currIndex) => {
        [this.viewLineGroup.children[currIndex], this.overviewSvg.children[currIndex]].forEach(path => {
          const animate = path.children[0];

          animate.beginElement();
        });
      });
    }

    if (this.series[0].doubleY) {
      this.yLines.forEach(line => {
        line.labelEl.children[this.series.length - index - 1].style.opacity = this.series[index].isActive ? 1 : 0;
      });
    }
  };

  this.onYLineTransitionEnd = function(e) {
    for (let i = 0; i < this.yLines.length; i++) {
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
    for (let i = 0; i < this.xLabels.length; i++) {
      if (this.xLabels[i].el == e.target) {
        e.target.removeEventListener('transitionend', this.onXLabelTransitionEnd, true);
        this.xAxisEl.removeChild(this.xLabels[i].el);
        this.xLabels.splice(i, 1);

        return;
      }
    }
  }.bind(this);

  this.wrapperEl = document.getElementById(wrapperId);
  this.wrapperEl.classList.add('tg-ch');
  this.viewEl = createEl(this.wrapperEl, 'view');
  createDraggableBehavior(
    this,
    this.viewEl,
    (e, delta, old, drag) => {
      let i, touch, x;

      if (drag) {
        delta = -delta / this.scaleX;
        delta = Math.max(delta, this.gminX - old.minX);
        delta = Math.min(delta, this.gmaxX - old.maxX);
        this.minX = old.minX + delta;
        this.maxX = old.maxX + delta;

        for (i = 0; i < this.selectionBubbleEls.length; i++) {
          this.selectionBubbleEls[i].classList.add('is-animated');
        }
        this.updateView();

        return;
      }

      touch = e.touches ? e.touches[0] : e;
      x =
        this.minX +
        (touch.pageX - this.viewEl.getBoundingClientRect().left - window.pageXOffset - this.SIDE_PADDING) / this.scaleX;
      this.selectionIndex = 0;
      for (i = 1; i < this.xs.length; i++) {
        if (this.xs[i] < this.minX || this.xs[i] > this.maxX) {
          continue;
        }
        if (this.series[0].isBar && x <= this.xs[i]) {
          this.selectionIndex = i - 1;
          break;
        } else if (Math.abs(this.xs[i] - x) < Math.abs(this.xs[this.selectionIndex] - x)) {
          this.selectionIndex = i;
        }
      }

      for (i = 0; i < this.selectionBubbleEls.length; i++) {
        this.selectionBubbleEls[i].classList.remove('is-animated');
      }
      this.updateView();
    },
    (e, drag) => {
      for (let i = 0; i < this.selectionBubbleEls.length; i++) {
        this.selectionBubbleEls[i].classList.toggle('is-animated', !drag);
      }
      if (!e.touches && !drag) {
        this.selectionIndex = null;
        this.updateView();
      }
    },
    false,
    true
  );
  document.body.addEventListener(
    'touchstart',
    e => {
      let el = e.target;

      while (el !== document.body) {
        if (el === this.wrapperEl) {
          return;
        }
        el = el.parentNode;
      }

      this.selectionIndex = null;
      this.updateView();
    },
    true
  );

  this.gridContainerEl = createEl(this.viewEl, 'grid-container');
  this.yLines = [];

  this.selectionLineEl = createEl(this.viewEl, 'selection-line');

  this.viewSvg = createEl(this.viewEl, 'view-svg', 'svg');
  this.viewLineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  this.viewLineGroup.setAttribute('vector-effect', 'non-scaling-stroke');
  this.viewSvg.appendChild(this.viewLineGroup);
  this.viewPaths = [];

  for (i = 0; i < this.series.length; i++) {
    this.viewPaths.push(createPath(this.viewLineGroup, this.xs, this.series, i, 2));
  }

  this.topOverlayEl = createEl(this.viewEl, 'top-overlay');

  this.selectionBubbleEls = [];
  for (i = 0; i < this.series.length; i++) {
    this.selectionBubbleEls.push(createEl(this.viewEl, `selection-bubble is-series-${i}`));
  }
  this.selectionBoxEl = createEl(this.viewEl, 'selection-box');
  this.leftCover = createEl(this.viewEl, 'cover left');
  this.rightCover = createEl(this.viewEl, 'cover right');

  this.xAxisEl = createEl(this.wrapperEl, 'x-axis');
  this.xLabels = [];

  this.overviewEl = createEl(this.wrapperEl, 'overview');
  this.overviewSvg = createEl(this.overviewEl, 'overview-svg', 'svg');
  this.overviewPaths = [];

  for (i = 0; i < this.series.length; i++) {
    this.overviewPaths.push(createPath(this.overviewSvg, this.xs, this.series, i, 1));
  }

  this.overviewWindowEl = createEl(this.overviewEl, 'overview-window');
  createDraggableBehavior(
    this,
    this.overviewWindowEl,
    (e, delta, old) => {
      delta /= this.gscaleX;
      delta = Math.max(delta, this.gminX - old.minX);
      delta = Math.min(delta, this.gmaxX - old.maxX);
      this.minX = old.minX + delta;
      this.maxX = old.maxX + delta;
      this.selectionIndex = null;
      this.updateView();
    },
    false,
    true
  );
  this.overviewHandleLeftEl = createEl(this.overviewWindowEl, 'overview-handle is-left');
  createDraggableBehavior(
    this,
    this.overviewHandleLeftEl,
    (e, delta, old) => {
      delta /= this.gscaleX;
      this.minX = Math.max(this.gminX, old.minX + delta);
      this.minX = Math.min(this.minX, this.maxX - this.MIN_WINDOW_SIZE / this.gscaleX);
      this.selectionIndex = null;
      this.updateView();
    },
    false,
    true
  );
  this.overviewHandleRightEl = createEl(this.overviewWindowEl, 'overview-handle is-right');
  createDraggableBehavior(
    this,
    this.overviewHandleRightEl,
    (e, delta, old) => {
      delta /= this.gscaleX;
      this.maxX = Math.max(this.minX + this.MIN_WINDOW_SIZE / this.gscaleX, old.maxX + delta);
      this.maxX = Math.min(this.maxX, this.gmaxX);
      this.selectionIndex = null;
      this.updateView();
    },
    false,
    true
  );
  createDraggableBehavior(this, this.overviewSvg, (e, delta) => {
    let touch = e.touches ? e.touches[0] : e,
      sz = Math.max(Math.abs(delta), this.MIN_WINDOW_SIZE) / this.gscaleX,
      x1 = touch.pageX - this.overviewSvg.getBoundingClientRect().left - window.pageXOffset,
      mid = this.gminX + (x1 - delta / 2) / this.gscaleX;

    mid = Math.max(this.gminX + this.MIN_WINDOW_SIZE / this.gscaleX / 2, mid);
    mid = Math.min(this.gmaxX - this.MIN_WINDOW_SIZE / this.gscaleX / 2, mid);
    this.minX = Math.max(this.gminX, mid - sz / 2);
    this.maxX = Math.min(mid + sz / 2, this.gmaxX);
    this.selectionIndex = null;
    this.updateView();
  });

  this.legendEl = createEl(this.wrapperEl, 'legend');
  this.legendLabelEls = [];
  let longTapTimeout = null;

  for (let i = 0; i < this.series.length; i++) {
    label = createEl(this.legendEl, `legend-label is-series-${i} is-active`);
    label.innerText = this.series[i].name;
    label.style.setProperty('--shadow-color', this.series[i].color);
    label.style.order = i;
    icon = createEl(label, 'legend-checkmark');
    label.addEventListener('click', this.onLegendLabelToggle.bind(this, i), true);
    label.addEventListener(
      'touchstart',
      () => {
        longTapTimeout = setTimeout(() => {
          navigator.vibrate(70);
          this.series.forEach((s, sIndex) => {
            if (s.isActive && sIndex !== i) {
              this.onLegendLabelToggle.call(this, sIndex);
            } else if (!s.isActive && sIndex === i) {
              this.onLegendLabelToggle.call(this, sIndex);
            }
          });
        }, 500);
      },
      true
    );
    label.addEventListener('touchend', () => {
      clearTimeout(longTapTimeout);
    });
    this.legendLabelEls.push(label);
  }

  this.noDataEl = createEl(this.viewEl, 'no-data');
  this.noDataEl.innerText = 'No data';

  this.updateView();

  setTimeout(() => {
    this.wrapperEl.classList.add('is-animated');
  }, 0);

  window.addEventListener('resize', this.updateView.bind(this), true);
  this.initialized = true;
}

TGChart.prototype.updateView = function() {
  var W = this.viewEl.offsetWidth - this.SIDE_PADDING * 2,
    H = this.viewEl.offsetHeight,
    oH = this.overviewEl.offsetHeight,
    maxY = 0,
    gmaxY = 0,
    firstX = null,
    noData = true,
    i,
    j,
    x,
    y,
    scaleX = W / (this.maxX - this.minX),
    gscaleX = W / (this.gmaxX - this.gminX),
    orderMax,
    orderMin,
    scaleX,
    gscaleX,
    scaleY,
    gscaleY,
    series,
    oldScaleY = this.scaleY,
    add,
    addRight,
    line,
    updateLine,
    updateLabel,
    stepX,
    stepY,
    stepYRight,
    day,
    label,
    left,
    right,
    percent,
    highest,
    windowL,
    windowR,
    html;

  this.inactiveBarsPtsLabelsAcc = Array(this.series[0].pts.length).fill(0);

  for (i = this.series.length - 1; i >= 0; i--) {
    series = this.series[i];
    if (series.isActive) {
      for (j = 0; j < this.xs.length; j++) {
        noData = false;

        if (this.minX <= this.xs[j] && this.xs[j] <= this.maxX) {
          maxY = series.isPercentage ? 100 : Math.max(maxY, series.pts[j] - this.inactiveBarsPtsLabelsAcc[j]);

          if (firstX === null) {
            firstX = this.xs[j];
          }
        }
        gmaxY = series.isPercentage ? 100 : Math.max(gmaxY, series.pts[j] - this.inactiveBarsPtsLabelsAcc[j]);
      }
    } else if (!series.isActive && series.isBar) {
      this.inactiveBarsPtsLabelsAcc = this.inactiveBarsPtsLabelsAcc.map(
        (curr, index) => curr + series.ptsLabels[index]
      );
    }
  }

  this.noDataEl.style.display = noData ? 'block' : 'none';
  orderMax = Math.pow(10, Math.floor(Math.log(maxY) * Math.LOG10E)) / 2;
  maxY = Math.ceil(maxY / orderMax) * orderMax;
  stepY = maxY / 5;
  scaleY = (H - 30) / maxY;
  gscaleY = (oH - 4) / gmaxY;
  oldScaleY = this.scaleY;

  add = {};
  if (!noData) {
    for (i = 0; i <= 5; i++) {
      add[stepY * i] = true;
    }
  }

  addRight = { '0': true };
  if (!noData && this.series[0].doubleY) {
    for (i = 1; i <= 5; i++) {
      addRight[
        getNormalizedValue(
          this.series[0].minY,
          this.series[0].maxY,
          this.series[1].minY,
          this.series[1].maxY,
          Object.keys(add)[i]
        )
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
    line.lineEl.style.bottom = `${line.y * scaleY}px`;
    line.labelEl.style.bottom = `${line.y * scaleY}px`;
  }

  Object.keys(add).forEach((y, index) => {
    const yRight = Object.keys(addRight)[index],
      [firstSeries, secondSeries] = this.series;

    line = {
      y,
      yRight,
      lineEl: createEl(this.gridContainerEl, 'y-line'),
      labelEl: createEl(this.gridContainerEl, 'y-label')
    };
    line.labelEl.innerHTML = firstSeries.doubleY
      ? `<div style="color:${secondSeries.color}; opacity: ${secondSeries.isActive ? 1 : 0}">${formatNumber(
          y,
          true
        )}</div>` +
        `<div style="color:${firstSeries.color}; opacity:${firstSeries.isActive ? 1 : 0}">${formatNumber(
          yRight,
          true
        )}</div>`
      : formatNumber(y * (firstSeries.isBar && !firstSeries.isStacked ? 10 : 1), true);

    if (this.scaleY !== undefined) {
      line.lineEl.style.bottom = `${line.y * oldScaleY}px`;
      line.labelEl.style.bottom = `${line.y * oldScaleY}px`;
    }

    updateLine = function(line) {
      line.lineEl.style.opacity = 1;
      line.lineEl.style.bottom = `${line.y * scaleY}px`;
      line.labelEl.style.opacity = 1;
      line.labelEl.style.bottom = `${line.y * scaleY}px`;
    }.bind(this, line);

    if (this.initialized) {
      setTimeout(updateLine, 0);
    } else {
      updateLine();
    }
    this.yLines.push(line);
  });

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
    label.el.style.left = `${(label.x - this.minX) * scaleX + this.SIDE_PADDING * 2 - 50}px`;
  }

  for (x in add) {
    label = {
      x,
      el: createEl(this.xAxisEl, 'x-label')
    };
    label.el.innerText = formatDate(parseFloat(x), false, true);
    label.el.style.left = `${(label.x - this.minX) * scaleX + this.SIDE_PADDING * 2 - 50}px`;
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

  if (!noData) {
    animateTransform(this.viewLineGroup, [scaleX * 1e7, 1], [(this.gminX - this.minX) * scaleX + this.SIDE_PADDING, 0]);
    for (i = 0; i < this.overviewPaths.length; i++) {
      animateTransform(this.viewPaths[i], [1, scaleY]);
    }
  }
  for (i = 0; i < this.overviewPaths.length; i++) {
    this.viewPaths[i].style.opacity = this.series[i].isActive || this.series[i].isStacked ? 1 : 0;
  }

  this.dateRangeEl.innerHTML = `${formatDate(this.minX, false, true, true)} – ${formatDate(
    this.maxX,
    false,
    true,
    true
  )}`;

  if (this.selectionIndex === null || noData) {
    this.selectionLineEl.style.display = 'none';
    for (i = 0; i < this.selectionBubbleEls.length; i++) {
      this.selectionBubbleEls[i].style.display = 'none';
    }
    this.selectionBoxEl.style.display = 'none';
    this.leftCover.style.width = 0;
    this.rightCover.style.width = 0;
  } else {
    left = (this.xs[this.selectionIndex] - this.minX) * scaleX + this.SIDE_PADDING;
    right = (this.maxX - this.xs[this.selectionIndex + 1]) * scaleX + this.SIDE_PADDING;
    percent = (this.xs[this.selectionIndex] - this.minX) / (this.maxX - this.minX);
    highest = 0;

    if (!this.series[0].isBar || this.series[0].isPercentage) {
      this.selectionLineEl.style.display = 'block';
      this.selectionLineEl.style.left = `${left}px`;
    }

    for (i = 0; i < this.selectionBubbleEls.length; i++) {
      y = this.series[i].pts[this.selectionIndex] * scaleY;

      if (!this.series[i].isBar) {
        this.selectionBubbleEls[i].style.display = 'block';
        this.selectionBubbleEls[i].style.opacity = this.series[i].isActive ? 1 : 0;
        this.selectionBubbleEls[i].style.borderColor = this.series[i].color;
        this.selectionBubbleEls[i].style.left = `${left}px`;
        this.selectionBubbleEls[i].style.bottom = `${y}px`;
      }

      if (this.series[i].isActive) {
        highest = H - 320;
      }
    }

    html = [formatDate(this.xs[this.selectionIndex], true, true, true)];
    html.push('<div class="tg-ch--selection-box-labels">');
    const sumPtslabels = this.series
      .filter(s => s.isActive)
      .map(s => s.ptsLabels[this.selectionIndex])
      .reduce((acc, curr) => acc + curr, 0);

    for (i = 0; i < this.series.length; i++) {
      const currSeries = this.series[i];

      if (currSeries.isActive) {
        html.push('<div>');
        currSeries.isPercentage &&
          html.push(
            '<span>',
            `${Math.round((currSeries.ptsLabels[this.selectionIndex] / sumPtslabels) * 100)}%`,
            '</span>'
          );
        html.push(
          '<span>',
          currSeries.name,
          '</span>',
          '<b style="color: ',
          currSeries.color,
          '">',
          formatNumber(currSeries.ptsLabels[this.selectionIndex]),
          '</b>',
          '</div>'
        );
      }
    }
    html.push('</div>');
    this.selectionBoxEl.innerHTML = html.join('');

    this.selectionBoxEl.style.display = 'block';
    this.selectionBoxEl.style.left = `${Math.max(
      this.SIDE_PADDING / 2,
      Math.min(
        W - this.selectionBoxEl.offsetWidth + (this.SIDE_PADDING * 3) / 2,
        left - (this.selectionBoxEl.offsetWidth - this.SIDE_PADDING) * percent - this.SIDE_PADDING / 2
      )
    )}px`;
    this.selectionBoxEl.style.top = `${highest}px`;

    this.selectionBoxEl.style.left =
      percent < 0.5 ? W - right + 3 * this.SIDE_PADDING : left - this.selectionBoxEl.offsetWidth - this.SIDE_PADDING;

    if (this.series[0].isBar && !this.series[0].isPercentage) {
      this.leftCover.style.width = left + 0.3;
      this.rightCover.style.width = right + 0.3;
    }
  }

  for (i = 0; i < this.overviewPaths.length; i++) {
    this.overviewPaths[i].style.opacity = this.series[i].isActive ? 1 : 0;
    if (!noData) {
      animateTransform(this.overviewPaths[i], [gscaleX * 1e7, gscaleY]);
    }
  }

  windowL = (this.minX - this.gminX) / (this.gmaxX - this.gminX);
  windowR = (this.maxX - this.gminX) / (this.gmaxX - this.gminX);
  this.overviewWindowEl.style.left = `${windowL * 100}%`;
  this.overviewWindowEl.style.right = `${100 - windowR * 100}%`;

  for (i = 0; i < this.series.length; i++) {
    this.legendLabelEls[i].classList.toggle('is-active', this.series[i].isActive);
  }

  this.scaleX = scaleX;
  this.scaleY = scaleY;
  this.gscaleX = gscaleX;
  this.gscaleY = gscaleY;
};

for (let i = 0; i < 5; i++) {
  new TGChart(`tg-ch-${i}`, chartData[i]);
}

document.querySelector('#toggle-mode').addEventListener('click', () => {
  document.body.classList.toggle('theme-day');
  document.body.classList.toggle('theme-night');
  if (document.body.classList.contains('theme-day')) {
    document.getElementById('toggle-mode').innerText = 'Switch to Dark Mode';
  } else {
    document.getElementById('toggle-mode').innerText = 'Switch to Light Mode';
  }
});
