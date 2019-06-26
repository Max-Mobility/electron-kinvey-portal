var __assign = (this && this.__assign) || function () {
  __assign = Object.assign || function (t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
      s = arguments[i];
      for (const p in s) {
        if (Object.prototype.hasOwnProperty.call(s, p)) {
          t[p] = s[p];
        }
      }
    }

    return t;
  };

  return __assign.apply(this, arguments);
};

const defaults = {
  lines: 12,
  length: 7,
  width: 5,
  radius: 10,
  scale: 1.0,
  corners: 1,
  color: '#000',
  fadeColor: 'transparent',
  animation: 'spinner-line-fade-default',
  rotate: 0,
  direction: 1,
  speed: 1,
  zIndex: 2e9,
  className: 'spinner',
  top: '50%',
  left: '50%',
  shadow: '0 0 1px transparent',
  position: 'absolute'
};
const Spinner = /** @class */ (function () {
  function Spinner(opts) {
    if (opts === void 0) {
      opts = {};
    }

    this.opts = __assign({}, defaults, opts);
  }

  /**
     * Adds the spinner to the given target element. If this instance is already
     * spinning, it is automatically removed from its previous target by calling
     * stop() internally.
     */
  Spinner.prototype.spin = function (target) {
    this.stop();
    this.el = document.createElement('div');
    this.el.className = this.opts.className;
    this.el.setAttribute('role', 'progressbar');
    css(this.el, {
      position: this.opts.position,
      width: 0,
      zIndex: this.opts.zIndex,
      left: this.opts.left,
      top: this.opts.top,
      transform: 'scale(' + this.opts.scale + ')'
    });
    if (target) {
      target.insertBefore(this.el, target.firstChild || null);
    }

    drawLines(this.el, this.opts);
    return this;
  };

  /**
     * Stops and removes the Spinner.
     * Stopped spinners may be reused by calling spin() again.
     */
  Spinner.prototype.stop = function () {
    if (this.el) {
      if (typeof requestAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this.animateId);
      } else {
        clearTimeout(this.animateId);
      }

      if (this.el.parentNode) {
        this.el.parentNode.removeChild(this.el);
      }

      this.el = undefined;
    }

    return this;
  };

  return Spinner;
})();
// Export { Spinner };
/**
 * Sets multiple style properties at once.
 */
function css(el, props) {
  for (const prop in props) {
    el.style[prop] = props[prop];
  }

  return el;
}

/**
 * Returns the line color from the given string or array.
 */
function getColor(color, idx) {
  return typeof color === 'string' ? color : color[idx % color.length];
}

/**
 * Internal method that draws the individual lines.
 */
function drawLines(el, opts) {
  const borderRadius = (Math.round(opts.corners * opts.width * 500) / 1000) + 'px';
  let shadow = 'none';
  if (opts.shadow === true) {
    shadow = '0 2px 4px #000'; // Default shadow
  } else if (typeof opts.shadow === 'string') {
    shadow = opts.shadow;
  }

  const shadows = parseBoxShadow(shadow);
  for (let i = 0; i < opts.lines; i++) {
    const degrees = ~~(360 / opts.lines * i + opts.rotate);
    const backgroundLine = css(document.createElement('div'), {
      position: 'absolute',
      top: -opts.width / 2 + 'px',
      width: (opts.length + opts.width) + 'px',
      height: opts.width + 'px',
      background: getColor(opts.fadeColor, i),
      borderRadius,
      transformOrigin: 'left',
      transform: 'rotate(' + degrees + 'deg) translateX(' + opts.radius + 'px)'
    });
    let delay = i * opts.direction / opts.lines / opts.speed;
    delay -= 1 / opts.speed; // So initial animation state will include trail
    const line = css(document.createElement('div'), {
      width: '100%',
      height: '100%',
      background: getColor(opts.color, i),
      borderRadius,
      boxShadow: normalizeShadow(shadows, degrees),
      animation: 1 / opts.speed + 's linear ' + delay + 's infinite ' + opts.animation
    });
    backgroundLine.append(line);
    el.append(backgroundLine);
  }
}

function parseBoxShadow(boxShadow) {
  const regex = /^\s*([a-zA-Z]+\s+)?(-?\d+(\.\d+)?)([a-zA-Z]*)\s+(-?\d+(\.\d+)?)([a-zA-Z]*)(.*)$/;
  const shadows = [];
  for (let _i = 0, _a = boxShadow.split(','); _i < _a.length; _i++) {
    const shadow = _a[_i];
    const matches = shadow.match(regex);
    if (matches === null) {
      continue; // Invalid syntax
    }

    const x = Number(matches[2]);
    const y = Number(matches[5]);
    let xUnits = matches[4];
    let yUnits = matches[7];
    if (x === 0 && !xUnits) {
      xUnits = yUnits;
    }

    if (y === 0 && !yUnits) {
      yUnits = xUnits;
    }

    if (xUnits !== yUnits) {
      continue; // Units must match to use as coordinates
    }

    shadows.push({
      prefix: matches[1] || '',
      x,
      y,
      xUnits,
      yUnits,
      end: matches[8]
    });
  }

  return shadows;
}

/**
 * Modify box-shadow x/y offsets to counteract rotation
 */
function normalizeShadow(shadows, degrees) {
  const normalized = [];
  for (let _i = 0, shadows_1 = shadows; _i < shadows_1.length; _i++) {
    const shadow = shadows_1[_i];
    const xy = convertOffset(shadow.x, shadow.y, degrees);
    normalized.push(shadow.prefix + xy[0] + shadow.xUnits + ' ' + xy[1] + shadow.yUnits + shadow.end);
  }

  return normalized.join(', ');
}

function convertOffset(x, y, degrees) {
  const radians = degrees * Math.PI / 180;
  const sin = Math.sin(radians);
  const cos = Math.cos(radians);
  return [
    Math.round((x * cos + y * sin) * 1000) / 1000,
    Math.round((-x * sin + y * cos) * 1000) / 1000
  ];
}
