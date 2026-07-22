function setupCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 320;
  const height = 220;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const context = canvas.getContext('2d');
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { context, width, height };
}

function linePath(context, values, bounds, color, dashed = false) {
  const { left, top, width, height, min, max } = bounds;
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 3;
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.setLineDash(dashed ? [7, 7] : []);
  context.beginPath();
  let started = false;
  values.forEach((value, index) => {
    if (value == null) return;
    const x = left + index * width / Math.max(1, values.length - 1);
    const y = top + (max - value) * height / Math.max(1, max - min);
    started ? context.lineTo(x, y) : context.moveTo(x, y);
    started = true;
  });
  context.stroke();
  context.restore();
}

export function drawChart(canvas, primary, secondary = null) {
  const { context, width, height } = setupCanvas(canvas);
  context.clearRect(0, 0, width, height);
  const values = [...primary, ...(secondary || [])].filter(value => value != null);
  if (!values.length) {
    context.fillStyle = '#9099ad';
    context.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    context.fillText('Encara no hi ha prou dades', 16, height / 2);
    return;
  }

  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const padding = { top: 18, right: 8, bottom: 24, left: 42 };
  const bounds = { left: padding.left, top: padding.top, width: width - padding.left - padding.right, height: height - padding.top - padding.bottom, min, max };

  context.strokeStyle = 'rgba(255,255,255,.07)';
  context.lineWidth = 1;
  for (let row = 0; row < 4; row += 1) {
    const y = padding.top + row * bounds.height / 3;
    context.beginPath(); context.moveTo(padding.left, y); context.lineTo(width - padding.right, y); context.stroke();
  }

  context.fillStyle = '#9099ad';
  context.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
  context.fillText(Math.round(max), 4, padding.top + 4);
  context.fillText(Math.round(min), 4, height - padding.bottom + 4);

  linePath(context, primary, bounds, '#b36cff');
  if (secondary) linePath(context, secondary, bounds, '#3d8cff', true);
}
