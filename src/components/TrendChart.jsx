import React from 'react';

export default function TrendChart({ data }) {
  const width = 700;
  const height = 240;
  const padding = 18;
  const values = data.map((item) => item.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = Math.max(max - min, 1);
  const points = data.map((item, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(data.length - 1, 1);
    const y = height - padding - ((item.value - min) / span) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="trend-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Grafik tren">
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <polygon points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`} fill="url(#trendFill)" />
      </svg>
      <div className="trend-chart__labels">
        {data.map((item) => <span key={item.label}>{item.label}</span>)}
      </div>
    </div>
  );
}
