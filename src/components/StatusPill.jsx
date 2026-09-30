import React from 'react';

const toneMap = {
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
  neutral: 'neutral'
};

export default function StatusPill({ children, tone = 'neutral' }) {
  return <span className={`status-pill ${toneMap[tone] ?? 'neutral'}`}>{children}</span>;
}
