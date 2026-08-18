// Minimal dependency-free SVG chart renderers. Each function returns an SVG
// markup string sized with a viewBox so it scales to its container.

import { formatMoneyCompact, escapeHtml } from './format.js';

const PALETTE = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#64748b'];

export function colorFor(index) {
  return PALETTE[index % PALETTE.length];
}

// Compact single-row stacked bar: data = [{ label, value, color }]. Made for
// glanceable "mix" previews (e.g. a Needs/Wants/Savings split on Home) where
// a full donut+legend would take up more room than the context deserves.
export function stackedBarHtml(data, { currency = 'SAR' } = {}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return `<div class="chart-empty">Not enough data yet</div>`;
  const segments = data
    .map((d, i) => {
      const pct = (d.value / total) * 100;
      const color = d.color || colorFor(i);
      return `<span style="width:${pct}%;background:${color}" title="${escapeHtml(d.label)}: ${escapeHtml(formatMoneyCompact(d.value, currency))}"></span>`;
    })
    .join('');
  const legend = data
    .map((d, i) => `
      <span class="mix-legend-item">
        <span class="legend-dot" style="background:${d.color || colorFor(i)}"></span>
        ${escapeHtml(d.label)} · ${Math.round((d.value / total) * 100)}%
      </span>`)
    .join('');
  return `
    <div class="mix-bar">${segments}</div>
    <div class="mix-legend">${legend}</div>
  `;
}

// Horizontal bar chart: data = [{ label, value }]
export function barChart(data, { currency = 'SAR', width = 600, barHeight = 28, gap = 12 } = {}) {
  if (!data.length) return emptyState();
  const max = Math.max(...data.map((d) => d.value), 1);
  const height = data.length * (barHeight + gap) + gap;
  const labelWidth = 130;
  const chartWidth = width - labelWidth - 90;

  const bars = data
    .map((d, i) => {
      const y = gap + i * (barHeight + gap);
      const w = Math.max((d.value / max) * chartWidth, 2);
      const color = d.color || colorFor(i);
      return `
        <text x="${labelWidth - 10}" y="${y + barHeight / 2 + 4}" text-anchor="end" class="chart-label">${escapeHtml(truncate(d.label, 16))}</text>
        <rect x="${labelWidth}" y="${y}" width="${w}" height="${barHeight}" rx="6" fill="${color}" />
        <text x="${labelWidth + w + 8}" y="${y + barHeight / 2 + 4}" class="chart-value">${escapeHtml(formatMoneyCompact(d.value, currency))}</text>
      `;
    })
    .join('');

  return `<svg viewBox="0 0 ${width} ${height}" class="chart chart-bar" role="img" aria-label="Bar chart">${bars}</svg>`;
}

// Line chart: data = [{ x: label, y: value }]
export function lineChart(series, { width = 600, height = 220, currency = 'SAR', color = '#10b981', fill = true } = {}) {
  if (!series.length) return emptyState();
  const padding = { top: 16, right: 16, bottom: 28, left: 60 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const values = series.map((p) => p.y);
  let min = Math.min(...values, 0);
  let max = Math.max(...values, 0);
  if (min === max) { min -= 1; max += 1; }
  const range = max - min;

  const xStep = series.length > 1 ? innerW / (series.length - 1) : 0;
  const pointFor = (p, i) => {
    const x = padding.left + i * xStep;
    const y = padding.top + innerH - ((p.y - min) / range) * innerH;
    return [x, y];
  };
  const points = series.map(pointFor);
  const pathD = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  const zeroY = padding.top + innerH - ((0 - min) / range) * innerH;

  const areaD = fill
    ? `${pathD} L${points[points.length - 1][0].toFixed(1)},${zeroY} L${points[0][0].toFixed(1)},${zeroY} Z`
    : '';

  const labelEvery = Math.max(1, Math.ceil(series.length / 6));
  const xLabels = series
    .map((p, i) => (i % labelEvery === 0 || i === series.length - 1
      ? `<text x="${points[i][0].toFixed(1)}" y="${height - 6}" text-anchor="middle" class="chart-label">${escapeHtml(p.x)}</text>`
      : ''))
    .join('');

  const yTop = `<text x="4" y="${padding.top + 4}" class="chart-label">${escapeHtml(formatMoneyCompact(max, currency))}</text>`;
  const yBottom = `<text x="4" y="${padding.top + innerH}" class="chart-label">${escapeHtml(formatMoneyCompact(min, currency))}</text>`;

  const dots = points
    .map(([x, y], i) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${color}"><title>${escapeHtml(series[i].x)}: ${escapeHtml(formatMoneyCompact(series[i].y, currency))}</title></circle>`)
    .join('');

  return `<svg viewBox="0 0 ${width} ${height}" class="chart chart-line" role="img" aria-label="Line chart">
    <line x1="${padding.left}" y1="${zeroY.toFixed(1)}" x2="${width - padding.right}" y2="${zeroY.toFixed(1)}" class="chart-axis" />
    ${fill ? `<path d="${areaD}" fill="${color}" fill-opacity="0.12" stroke="none" />` : ''}
    <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
    ${dots}
    ${xLabels}
    ${yTop}
    ${yBottom}
  </svg>`;
}

// Donut chart: data = [{ label, value }]
export function donutChart(data, { currency = 'SAR', size = 200, thickness = 28 } = {}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return emptyState();
  const r = size / 2 - thickness / 2;
  const cx = size / 2;
  const cy = size / 2;
  let angle = -90;

  const segments = data
    .map((d, i) => {
      const fraction = d.value / total;
      const startAngle = angle;
      const endAngle = angle + fraction * 360;
      angle = endAngle;
      const color = d.color || colorFor(i);
      return arcSegment(cx, cy, r, startAngle, endAngle, thickness, color, d.label, d.value, currency);
    })
    .join('');

  const legend = data
    .map((d, i) => `
      <div class="legend-row">
        <span class="legend-dot" style="background:${d.color || colorFor(i)}"></span>
        <span class="legend-label">${escapeHtml(d.label)}</span>
        <span class="legend-value">${escapeHtml(formatMoneyCompact(d.value, currency))}</span>
      </div>`)
    .join('');

  return `
    <div class="donut-wrap">
      <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="chart chart-donut" role="img" aria-label="Donut chart">${segments}</svg>
      <div class="legend">${legend}</div>
    </div>`;
}

function arcSegment(cx, cy, r, startAngle, endAngle, thickness, color, label, value, currency) {
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const d = `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${thickness}"><title>${escapeHtml(label)}: ${escapeHtml(formatMoneyCompact(value, currency))}</title></path>`;
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function truncate(str, n) {
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

function emptyState() {
  return `<div class="chart-empty">Not enough data yet</div>`;
}
