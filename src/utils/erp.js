export function money(value) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0));
}

export function number(value) {
  return new Intl.NumberFormat('id-ID').format(Number(value || 0));
}

export function dateLabel(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

export function dateTimeLabel(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export function docSequence(prefix, collection) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const base = `${prefix}-${yy}${mm}-`;
  const max = collection.reduce((acc, row) => {
    if (!row.id?.startsWith(base)) return acc;
    const n = Number(row.id.split('-').at(-1));
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  return `${base}${String(max + 1).padStart(4, '0')}`;
}

export function soTotal(order) {
  const subtotal = (order.lines || []).reduce((sum, line) => sum + Number(line.qty || 0) * Number(line.price || 0), 0);
  return Math.max(0, subtotal - Number(order.discount || 0));
}

export const statusTone = (status = '') => {
  const s = status.toLowerCase();
  if (s.includes('reject') || s.includes('cancel') || s.includes('critical') || s.includes('scrap') || s.includes('damaged')) return 'danger';
  if (s.includes('hold') || s.includes('pending') || s.includes('partial') || s.includes('loading') || s.includes('transit') || s.includes('quarantine') || s.includes('monitoring') || s.includes('recall')) return 'warning';
  if (s.includes('delivered') || s.includes('completed') || s.includes('approved') || s.includes('closed') || s.includes('received') || s.includes('put away') || s.includes('matched') || s.includes('posted') || s.includes('paid') || s.includes('invoiced') || s.includes('released')) return 'success';
  return 'info';
};
