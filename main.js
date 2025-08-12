import * as ChriscoursesPerlinNoise from "https://esm.sh/@chriscourses/perlin-noise";

// Editable values (let — щоб можна було змінювати через налаштування)
let showFPS = true;
let MAX_FPS = 0; // 0 = uncapped
let thresholdIncrement = 5; // cells range from 0-100, draw line for every step of this increment
let thickLineThresholdMultiple = 3; // every x steps draw a thicker line
let res = 16; // divide canvas width/height by this
let baseZOffset = 0.001; // how quickly the noise should move
let lineColor = 'rgb(255, 255, 255)';
let zoom = 1.5;

// Canvas state
let canvas, ctx;
let fpsCount;
let frameValues = [];
let inputValues = [];
let currentThreshold = 0;
let cols = 0;
let rows = 0;
let zOffset = 0;
let zBoostValues = [];
let noiseMin = 100;
let noiseMax = 0;
let mousePos = { x: -99, y: -99 };
let mouseDown = true;

// Wallpaper Engine listener
window.wallpaperPropertyListener = {
  applyUserProperties: function (props) {
    if (props.res) {
      res = Number(props.res.value);
      canvasSize();
    }
    if (props.thresholdIncrement) {
      thresholdIncrement = Number(props.thresholdIncrement.value);
    }
    if (props.zoom) {
      zoom = Number(props.zoom.value);
    }
  }
};

// Init
window.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('res-canvas');
  ctx = canvas.getContext('2d');
  fpsCount = document.getElementById('fps-count');
  setupCanvas();
  animate();
});

function setupCanvas() {
  canvasSize();
  window.addEventListener('resize', canvasSize);
  canvas.addEventListener('mousemove', (e) => {
    mousePos = { x: e.offsetX, y: e.offsetY };
  });
}

function canvasSize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  cols = Math.floor(canvas.width / res) + 1;
  rows = Math.floor(canvas.height / res) + 1;

  zBoostValues = [];
  for (let y = 0; y < rows; y++) {
    zBoostValues[y] = [];
    for (let x = 0; x <= cols; x++) {
      zBoostValues[y][x] = 0;
    }
  }
}

function animate() {
  const startTime = performance.now();
  setTimeout(() => {
    const endTime = performance.now();
    const frameDuration = endTime - startTime;
    frameValues.push(Math.round(1000 / frameDuration));
    if (frameValues.length > 60 && showFPS && fpsCount) {
      fpsCount.innerText = Math.round(frameValues.reduce((a, b) => a + b) / frameValues.length);
      frameValues = [];
    }
    requestAnimationFrame(animate);
  }, MAX_FPS > 0 ? 1000 / MAX_FPS : 0);

  if (mouseDown) {
    mouseOffset();
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  ctx.translate(cx, cy);
  ctx.scale(zoom, zoom);
  ctx.translate(-cx, -cy);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  zOffset += baseZOffset;
  generateNoise();

  const roundedNoiseMin = Math.floor(noiseMin / thresholdIncrement) * thresholdIncrement;
  const roundedNoiseMax = Math.ceil(noiseMax / thresholdIncrement) * thresholdIncrement;
  for (let threshold = roundedNoiseMin; threshold < roundedNoiseMax; threshold += thresholdIncrement) {
    currentThreshold = threshold;
    renderAtThreshold();
  }
  noiseMin = 100;
  noiseMax = 0;
}

function mouseOffset() {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const worldX = (mousePos.x - cx) / zoom + cx;
  const worldY = (mousePos.y - cy) / zoom + cy;

  let x = Math.floor(worldX / res);
  let y = Math.floor(worldY / res);
  if (!inputValues[y] || inputValues[y][x] === undefined) return;

  const incrementValue = 0.005;
  const radius = 18;
  for (let i = -radius; i <= radius; i++) {
    for (let j = -radius; j <= radius; j++) {
      const distance = Math.sqrt(i * i + j * j);
      if (distance <= radius && zBoostValues[y + i]?.[x + j] !== undefined) {
        const falloff = 0.5 * (1 + Math.cos(Math.PI * distance / radius));
        zBoostValues[y + i][x + j] += incrementValue * falloff;
      }
    }
  }
}

function generateNoise() {
  for (let y = 0; y < rows; y++) {
    inputValues[y] = [];
    for (let x = 0; x <= cols; x++) {
      inputValues[y][x] = ChriscoursesPerlinNoise.noise(x * 0.02, y * 0.02, zOffset + (zBoostValues[y]?.[x] || 0)) * 100;
      if (inputValues[y][x] < noiseMin) noiseMin = inputValues[y][x];
      if (inputValues[y][x] > noiseMax) noiseMax = inputValues[y][x];
      if (zBoostValues[y]?.[x] > 0) {
        zBoostValues[y][x] *= 0.99;
      }
    }
  }
}

function renderAtThreshold() {
  ctx.beginPath();
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = currentThreshold % (thresholdIncrement * thickLineThresholdMultiple) === 0 ? 2 : 1;

  for (let y = 0; y < inputValues.length - 1; y++) {
    for (let x = 0; x < inputValues[y].length - 1; x++) {
      if (allAbove(y, x) || allBelow(y, x)) continue;

      let gridValue = binaryToType(
        inputValues[y][x] > currentThreshold ? 1 : 0,
        inputValues[y][x + 1] > currentThreshold ? 1 : 0,
        inputValues[y + 1][x + 1] > currentThreshold ? 1 : 0,
        inputValues[y + 1][x] > currentThreshold ? 1 : 0
      );

      placeLines(gridValue, x, y);
    }
  }
  ctx.stroke();
}

function allAbove(y, x) {
  return inputValues[y][x] > currentThreshold &&
         inputValues[y][x + 1] > currentThreshold &&
         inputValues[y + 1][x + 1] > currentThreshold &&
         inputValues[y + 1][x] > currentThreshold;
}

function allBelow(y, x) {
  return inputValues[y][x] < currentThreshold &&
         inputValues[y][x + 1] < currentThreshold &&
         inputValues[y + 1][x + 1] < currentThreshold &&
         inputValues[y + 1][x] < currentThreshold;
}

function placeLines(gridValue, x, y) {
  let nw = inputValues[y][x];
  let ne = inputValues[y][x + 1];
  let se = inputValues[y + 1][x + 1];
  let sw = inputValues[y + 1][x];
  let a, b, c, d;

  switch (gridValue) {
    case 1:
    case 14:
      c = [x * res + res * linInterpolate(sw, se), y * res + res];
      d = [x * res, y * res + res * linInterpolate(nw, sw)];
      line(d, c);
      break;
    case 2:
    case 13:
      b = [x * res + res, y * res + res * linInterpolate(ne, se)];
      c = [x * res + res * linInterpolate(sw, se), y * res + res];
      line(b, c);
      break;
    case 3:
    case 12:
      b = [x * res + res, y * res + res * linInterpolate(ne, se)];
      d = [x * res, y * res + res * linInterpolate(nw, sw)];
      line(d, b);
      break;
    case 11:
    case 4:
      a = [x * res + res * linInterpolate(nw, ne), y * res];
      b = [x * res + res, y * res + res * linInterpolate(ne, se)];
      line(a, b);
      break;
    case 5:
      a = [x * res + res * linInterpolate(nw, ne), y * res];
      b = [x * res + res, y * res + res * linInterpolate(ne, se)];
      c = [x * res + res * linInterpolate(sw, se), y * res + res];
      d = [x * res, y * res + res * linInterpolate(nw, sw)];
      line(d, a);
      line(c, b);
      break;
    case 6:
    case 9:
      a = [x * res + res * linInterpolate(nw, ne), y * res];
      c = [x * res + res * linInterpolate(sw, se), y * res + res];
      line(c, a);
      break;
    case 7:
    case 8:
      a = [x * res + res * linInterpolate(nw, ne), y * res];
      d = [x * res, y * res + res * linInterpolate(nw, sw)];
      line(d, a);
      break;
    case 10:
      a = [x * res + res * linInterpolate(nw, ne), y * res];
      b = [x * res + res, y * res + res * linInterpolate(ne, se)];
      c = [x * res + res * linInterpolate(sw, se), y * res + res];
      d = [x * res, y * res + res * linInterpolate(nw, sw)];
      line(a, b);
      line(c, d);
      break;
  }
}

function line(from, to) {
  ctx.moveTo(from[0], from[1]);
  ctx.lineTo(to[0], to[1]);
}

function linInterpolate(x0, x1, y0 = 0, y1 = 1) {
  if (x0 === x1) return 0;
  return y0 + ((y1 - y0) * (currentThreshold - x0)) / (x1 - x0);
}

function binaryToType(nw, ne, se, sw) {
  return [nw, ne, se, sw].reduce((res, x) => (res << 1) | x);
}
