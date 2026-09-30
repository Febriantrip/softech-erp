import React, { useLayoutEffect, useRef } from 'react';

// Form state stays API-friendly ("200000.00"); this component formats only the text field.
export function parseReceiptAmount(display) {
  const input = String(display ?? '').replace(/[^0-9.,]/g, '');
  if (!input) return '';
  const commaIndex = input.indexOf(',');
  const dotParts = input.split('.');
  const dotIsDecimal = commaIndex < 0 && dotParts.length === 2 &&
    dotParts[1].length <= 2 && dotParts[1].length > 0;
  const separatorIndex = commaIndex >= 0 ? commaIndex : (dotIsDecimal ? input.indexOf('.') : -1);
  const integer = (separatorIndex < 0 ? input : input.slice(0, separatorIndex))
    .replace(/\D/g, '').replace(/^0+(?=\d)/, '') || '0';
  if (separatorIndex < 0) return integer;
  const fraction = input.slice(separatorIndex + 1).replace(/\D/g, '').slice(0, 2);
  return `${integer}.${fraction}`;
}

export function formatReceiptAmount(raw) {
  if (raw === null || raw === undefined || raw === '') return '';
  const [integer = '0', fraction] = String(raw).split('.');
  const grouped = (integer.replace(/\D/g, '') || '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return fraction === undefined ? grouped : `${grouped},${fraction}`;
}

const significant = text => (text.match(/[0-9,]/g) || []).length;
function nextCaret(display, count) {
  if (count <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < display.length; index += 1) {
    if (/[0-9,]/.test(display[index])) seen += 1;
    if (seen === count) return index + 1;
  }
  return display.length;
}

export default function ReceiptAmountInput({ value, onChange, disabled = false }) {
  const inputRef = useRef(null);
  const pendingCaret = useRef(null);
  const shown = formatReceiptAmount(value);

  useLayoutEffect(() => {
    if (pendingCaret.current === null || !inputRef.current) return;
    const position = nextCaret(shown, pendingCaret.current);
    inputRef.current.setSelectionRange(position, position);
    pendingCaret.current = null;
  }, [shown]);

  return <input
    ref={inputRef}
    type="text"
    inputMode="decimal"
    autoComplete="off"
    placeholder="0,00"
    disabled={disabled}
    value={shown}
    onChange={event => {
      const next = parseReceiptAmount(event.target.value);
      pendingCaret.current = significant(event.target.value.slice(0, event.target.selectionStart ?? event.target.value.length));
      onChange(next);
    }}
    onBlur={() => {
      if (value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value))) {
        onChange(Number(value).toFixed(2));
      }
    }}
  />;
}
