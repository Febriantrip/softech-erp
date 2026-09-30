import React, { useMemo, useState } from 'react';
import { BookOpenText, Building, Landmark, Scale } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import SectionCard from '../components/SectionCard';
import DataTable from '../components/DataTable';
import StatusPill from '../components/StatusPill';
import { useERPData } from '../context/ERPDataContext';
import { dateLabel, money } from '../utils/erp';

const sum = (rows, key) => rows.reduce((total, row) => total + Number(row[key] || 0), 0);

export default function FinancePage() {
  const { data } = useERPData();
  const [selectedId, setSelectedId] = useState(data.journals[0]?.id);
  const journals = useMemo(() => data.journals.map((journal) => {
    const debit = sum(journal.lines || [], 'debit');
    const credit = sum(journal.lines || [], 'credit');
    return { ...journal, debit, credit, dateLabel: dateLabel(journal.date), debitLabel: money(debit), creditLabel: money(credit) };
  }), [data.journals]);
  const selected = journals.find((row) => row.id === selectedId) || journals[0];
  const cashBank = data.bankAccounts.reduce((total, row) => total + Number(row.balance || 0), 0);
  const ar = data.arOpenItems.reduce((total, row) => total + Number(row.outstanding || 0), 0);
  const ap = data.apOpenItems.reduce((total, row) => total + Number(row.outstanding || 0), 0);
  const revenue = data.journals.flatMap((j) => j.lines || []).filter((l) => l.account === '410100').reduce((s,l)=>s+Number(l.credit||0)-Number(l.debit||0),0);
  const cogs = data.journals.flatMap((j) => j.lines || []).filter((l) => l.account === '510100').reduce((s,l)=>s+Number(l.debit||0)-Number(l.credit||0),0);
  const inventoryAdjustments = data.journals.filter((j)=>['Inventory Adjustment','Stock Take'].includes(j.source)).length;

  return (
    <>
      <PageHeader eyebrow="Record to Report" title="Finance & Accounting" description="General ledger, journal, cash & bank, tax, sub-ledger control, period gating, dan financial traceability." />
      <div className="stats-grid">
        <StatCard title="Cash & Bank" value={money(cashBank)} hint={`${data.bankAccounts.length} account`} trend={0} icon={Landmark} />
        <StatCard title="Accounts Receivable" value={money(ar)} hint={`${data.arOpenItems.filter((r)=>Number(r.outstanding)>0).length} open item`} trend={0} icon={Building} />
        <StatCard title="Accounts Payable" value={money(ap)} hint={`${data.apOpenItems.filter((r)=>Number(r.outstanding)>0).length} open bill`} trend={0} icon={Scale} />
        <StatCard title="Posted Revenue" value={money(revenue)} hint="from sales invoice journals" trend={0} icon={BookOpenText} />
        <StatCard title="Posted COGS" value={money(cogs)} hint="from shipment inventory issue" trend={0} icon={Scale} />
        <StatCard title="Inventory Adj Journal" value={String(inventoryAdjustments)} hint="stock take & manual adjustment" trend={0} icon={BookOpenText} />
      </div>
      <div className="dashboard-grid">
        <SectionCard title="General Journal Register" subtitle="System-generated and financial posting entries" className="span-2">
          <DataTable columns={[
            { key: 'id', label: 'Journal No.', render: (value) => <button className="table-link" onClick={() => setSelectedId(value)}>{value}</button> },
            { key: 'dateLabel', label: 'Date' }, { key: 'source', label: 'Source' }, { key: 'reference', label: 'Reference' }, { key: 'debitLabel', label: 'Debit' }, { key: 'creditLabel', label: 'Credit' },
            { key: 'status', label: 'Status', render: (value) => <StatusPill tone={value === 'Posted' ? 'success' : 'warning'}>{value}</StatusPill> }
          ]} rows={journals} />
        </SectionCard>
        <SectionCard title="Selected Journal" subtitle={selected ? `${selected.id} · ${selected.source}` : 'No journal'}>
          {!selected ? <div className="empty-state-inline">Belum ada journal.</div> : <>
            <div className="journal-head"><div><span>Reference</span><strong>{selected.reference}</strong></div><div><span>Date</span><strong>{selected.dateLabel}</strong></div><div><span>Description</span><strong>{selected.description}</strong></div></div>
            <div className="journal-lines">{selected.lines.map((line,index)=><div key={`${line.account}-${index}`} className="journal-line"><div><span>{line.account}</span><strong>{line.accountName}</strong></div><b className={Number(line.debit)>0?'positive-number':''}>{Number(line.debit)>0?money(line.debit):'-'}</b><b>{Number(line.credit)>0?money(line.credit):'-'}</b></div>)}</div>
            <div className="journal-balance"><span>Debit = Credit</span><strong>{money(selected.debit)}</strong></div>
          </>}
        </SectionCard>
      </div>
      <section className="surface-card document-section"><header><div><h3>Cash & Bank Accounts</h3><p>Balance bergerak otomatis saat customer receipt atau supplier disbursement diposting.</p></div><span>{data.bankAccounts.length} accounts</span></header><div className="table-wrap"><table className="data-table"><thead><tr><th>Code</th><th>Account</th><th>Type</th><th>COA</th><th>Balance</th></tr></thead><tbody>{data.bankAccounts.map((row)=><tr key={row.id}><td><strong>{row.code}</strong></td><td>{row.name}</td><td>{row.type}</td><td>{row.coa}</td><td>{money(row.balance)}</td></tr>)}</tbody></table></div></section>
    </>
  );
}
