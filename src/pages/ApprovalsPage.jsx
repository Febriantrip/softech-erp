import React from 'react';
import { BadgeCheck, Clock3, GitPullRequestArrow, ShieldAlert, UserCheck } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import ModuleCatalog from '../components/ModuleCatalog';
import SectionCard from '../components/SectionCard';
import DataTable from '../components/DataTable';
import StatusPill from '../components/StatusPill';
import { pendingApprovals } from '../data/erpModules';
import { useERPData } from '../context/ERPDataContext';
import { money, statusTone } from '../utils/erp';

export default function ApprovalsPage() {
  const { data, rawData, currentUserId, currentRoles, actOnApprovalRequest, rejectApprovalRequest } = useERPData();
  const userName=(id)=>rawData.users.find((row)=>row.id===id)?.name||id;
  const roleName=(id)=>rawData.roles.find((row)=>row.id===id)?.name||id;
  const entityCode=(id)=>rawData.legalEntities.find((row)=>row.id===id)?.code||id;
  const adminOverride=currentRoles.some((role)=>role.permissions?.includes('*')||role.sodOverride);
  const today=new Date().toISOString().slice(0,10);

  const requests=data.approvalRequests.filter((row)=>row.status==='Pending').map((request)=>{
    const step=request.steps.find((row)=>Number(row.sequence)===Number(request.currentStep)&&row.status==='Pending');
    const policy=rawData.approvalPolicies.find((row)=>row.id===request.policyId);
    const direct=rawData.userRoleAssignments.some((row)=>row.userId===currentUserId&&row.status==='Active'&&row.entityId===request.entityId&&(row.roleId===step?.roleId||rawData.roles.find((role)=>role.id===row.roleId)?.permissions?.includes('*')));
    const delegated=rawData.approvalDelegations.find((row)=>row.status==='Active'&&row.toUserId===currentUserId&&row.roleId===step?.roleId&&(row.entityId==='ALL'||row.entityId===request.entityId)&&today>=row.startDate&&today<=row.endDate);
    const selfBlocked=request.makerUserId===currentUserId&&policy?.allowSelfApproval===false&&!adminOverride;
    const canAct=(direct||delegated||adminOverride)&&!selfBlocked;
    let party='-';
    if(['SALES_ORDER','CREDIT_OVERRIDE'].includes(request.documentType)){
      const doc=rawData.salesOrders.find((row)=>row.id===request.documentId);
      party=rawData.customers.find((row)=>row.id===doc?.customerId)?.name||doc?.customerId||'-';
    }
    if(request.documentType==='PURCHASE_REQUEST') party=rawData.purchaseRequests.find((row)=>row.id===request.documentId)?.requester||'-';
    if(request.documentType==='PURCHASE_ORDER'){
      const doc=rawData.purchaseOrders.find((row)=>row.id===request.documentId);
      party=rawData.suppliers.find((row)=>row.id===doc?.supplierId)?.name||doc?.supplierId||'-';
    }
    if(request.documentType==='STOCK_TAKE'){
      const doc=rawData.stockTakes.find((row)=>row.id===request.documentId);
      party=rawData.warehouses.find((row)=>row.id===doc?.warehouseId)?.name||doc?.warehouseId||'-';
    }
    if(request.documentType==='SALES_RETURN'){
      const doc=rawData.salesReturns.find((row)=>row.id===request.documentId);
      party=rawData.customers.find((row)=>row.id===doc?.customerId)?.name||doc?.customerId||'-';
    }
    if(request.documentType==='PURCHASE_RETURN'){
      const doc=rawData.purchaseReturns.find((row)=>row.id===request.documentId);
      party=rawData.suppliers.find((row)=>row.id===doc?.supplierId)?.name||doc?.supplierId||'-';
    }
    return {...request,party,entity:entityCode(request.entityId),maker:userName(request.makerUserId),currentApprover:step?.label||roleName(step?.roleId),canAct,delegated:Boolean(delegated),selfBlocked,flow:request.steps};
  });

  const delegatedCount=requests.filter((row)=>row.delegated).length;
  const selfBlockedCount=requests.filter((row)=>row.selfBlocked).length;
  const highValue=requests.filter((row)=>Number(row.amount)>=100000000).length;

  return <>
    <PageHeader eyebrow="02 · Governed Approval" title="Pending Approval" description="Central approval inbox dengan threshold matrix, role authorization, maker/checker separation, delegation, dan immutable approval audit." />
    <div className="stats-grid">
      <StatCard title="Total Queue" value={String(requests.length)} hint="governance approval requests" icon={Clock3}/>
      <StatCard title="High Value" value={String(highValue)} hint="≥ Rp100 juta" icon={ShieldAlert}/>
      <StatCard title="Delegated" value={String(delegatedCount)} hint="temporary approver coverage" icon={GitPullRequestArrow}/>
      <StatCard title="Self Approval Block" value={String(selfBlockedCount)} hint="maker/checker policy" icon={UserCheck}/>
      <StatCard title="Approved History" value={String(rawData.approvalRequests.filter((row)=>row.status==='Approved').length)} hint="completed governed requests" icon={BadgeCheck}/>
    </div>

    <SectionCard title="Governed Approval Queue" subtitle="Tombol Approve hanya efektif bila user memiliki required role, delegation aktif, atau SoD override yang tercatat.">
      <DataTable rows={requests} emptyText="Tidak ada governed approval yang menunggu." columns={[
        {key:'documentType',label:'Document Type',render:(v)=>String(v).replaceAll('_',' ')},
        {key:'documentId',label:'Document',render:(v)=><strong>{v}</strong>},
        {key:'entity',label:'Entity'},
        {key:'party',label:'Party / Requester'},
        {key:'maker',label:'Maker'},
        {key:'amount',label:'Amount',render:(v)=>money(v)},
        {key:'currentApprover',label:'Current Step',render:(v,row)=><div className="governance-approval-step"><b>{v}</b>{row.delegated&&<StatusPill tone="warning">Delegated</StatusPill>}{row.selfBlocked&&<StatusPill tone="danger">Self Block</StatusPill>}</div>},
        {key:'flow',label:'Approval Flow',render:(steps,row)=><div className="governance-approval-flow">{steps.map((step)=><span key={step.sequence} className={step.status==='Approved'?'done':Number(step.sequence)===Number(row.currentStep)?'current':''}>{step.sequence}. {step.label||roleName(step.roleId)} · {step.status}</span>)}</div>},
        {key:'status',label:'Status',render:(v)=><StatusPill tone={statusTone(v)}>{v}</StatusPill>},
        {key:'action',label:'Action',render:(_,row)=><div className="governance-approval-actions"><button className="btn btn-sm btn-primary" disabled={!row.canAct} onClick={()=>actOnApprovalRequest(row.id,'APPROVE')}>Approve</button><button className="btn btn-sm" disabled={!row.canAct} onClick={()=>{const reason=window.prompt('Alasan reject approval:', 'Needs correction');if(reason)rejectApprovalRequest(row.id,reason);}}>Reject</button></div>}
      ]}/>
    </SectionCard>

    <SectionCard title="Approval Control Notes" subtitle="V8 menjaga transactional page tetap ringan; policy dan security dikelola dari Security & Governance.">
      <div className="governance-policy-grid">
        <section className="surface-card governance-policy-card"><div><span>Maker / Checker</span><h4>Self Approval Protection</h4><p>Maker tidak dapat menjadi checker/approver sendiri kecuali role mempunyai SoD override. Override selalu masuk global audit sebagai Warning.</p></div><StatusPill tone="success">Active</StatusPill></section>
        <section className="surface-card governance-policy-card"><div><span>Delegation</span><h4>Temporary Substitute</h4><p>Delegation hanya berlaku pada role, entity, dan tanggal yang ditentukan tanpa mengubah permanent user-role assignment.</p></div><StatusPill tone="success">Active</StatusPill></section>
      </div>
    </SectionCard>

    <ModuleCatalog groups={[{ title: 'Approval Queues', description: 'Queue domain legacy tetap tercatat sebagai scope modular, sementara transaksi aktif memakai V8 governed approval engine.', items: pendingApprovals }]} compact />
  </>;
}
