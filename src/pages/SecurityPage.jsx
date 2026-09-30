import React, { useMemo, useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  FileKey2,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  Plus,
  Search,
  ShieldCheck,
  UserCheck,
  UsersRound
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import SectionCard from '../components/SectionCard';
import DataTable from '../components/DataTable';
import StatusPill from '../components/StatusPill';
import Modal from '../components/Modal';
import { useERPData } from '../context/ERPDataContext';
import { dateTimeLabel, money, number, statusTone } from '../utils/erp';

const TABS = [
  ['users', 'Users'],
  ['roles', 'Roles & Permissions'],
  ['approvals', 'Approval Matrix'],
  ['numbering', 'Document Numbering'],
  ['delegation', 'Delegation'],
  ['audit', 'Audit Explorer'],
  ['notifications', 'Notifications'],
  ['policies', 'System Policies']
];

function UserModal({ open, onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', username: '', email: '', mfaEnabled: true });
  React.useEffect(() => { if (open) setForm({ name: '', username: '', email: '', mfaEnabled: true }); }, [open]);
  return <Modal open={open} onClose={onClose} title="Tambah User" subtitle="User baru dibuat tanpa role. Assign role/entity dilakukan terpisah." footer={<><button className="btn" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={!form.name || !form.username} onClick={() => { const id = onCreate(form); if (id) onClose(); }}>Create User</button></>}>
    <div className="form-grid">
      <label className="field"><span>Full Name</span><input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></label>
      <label className="field"><span>Username</span><input value={form.username} onChange={(e)=>setForm({...form,username:e.target.value})}/></label>
      <label className="field field--full"><span>Email</span><input value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})}/></label>
      <label className="governance-check field--full"><input type="checkbox" checked={form.mfaEnabled} onChange={(e)=>setForm({...form,mfaEnabled:e.target.checked})}/><span><strong>Enable MFA</strong><small>Direkomendasikan dan wajib untuk privileged role.</small></span></label>
    </div>
  </Modal>;
}

function RoleModal({ open, onClose, onCreate, permissions }) {
  const [form, setForm] = useState({ code: '', name: '', description: '', privileged: false, sodOverride: false, permissions: [] });
  React.useEffect(() => { if (open) setForm({ code: '', name: '', description: '', privileged: false, sodOverride: false, permissions: [] }); }, [open]);
  const toggle = (id) => setForm((prev)=>({...prev,permissions:prev.permissions.includes(id)?prev.permissions.filter((x)=>x!==id):[...prev.permissions,id]}));
  return <Modal wide open={open} onClose={onClose} title="Tambah Role" subtitle="Permission dibuat granular per module/action." footer={<><button className="btn" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={!form.code || !form.name} onClick={() => { const id=onCreate(form); if(id) onClose(); }}>Create Role</button></>}>
    <div className="form-grid">
      <label className="field"><span>Role Code</span><input value={form.code} onChange={(e)=>setForm({...form,code:e.target.value})} placeholder="BRANCH_FINANCE"/></label>
      <label className="field"><span>Role Name</span><input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></label>
      <label className="field field--full"><span>Description</span><textarea rows="2" value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})}/></label>
      <label className="governance-check"><input type="checkbox" checked={form.privileged} onChange={(e)=>setForm({...form,privileged:e.target.checked})}/><span><strong>Privileged Role</strong><small>MFA policy akan berlaku.</small></span></label>
      <label className="governance-check"><input type="checkbox" checked={form.sodOverride} onChange={(e)=>setForm({...form,sodOverride:e.target.checked})}/><span><strong>SoD Override</strong><small>Boleh override maker/checker dengan audit warning.</small></span></label>
    </div>
    <div className="governance-permission-grid">{permissions.map((perm)=><label key={perm.id} className={form.permissions.includes(perm.id)?'active':''}><input type="checkbox" checked={form.permissions.includes(perm.id)} onChange={()=>toggle(perm.id)}/><span><strong>{perm.module}</strong><small>{perm.action}</small></span></label>)}</div>
  </Modal>;
}

function AssignmentModal({ open, onClose, rawData, onAssign }) {
  const [form, setForm] = useState({ userId: rawData.users[0]?.id || '', roleId: rawData.roles[0]?.id || '', entityId: rawData.legalEntities[0]?.id || '', siteIds: ['ALL'] });
  React.useEffect(() => { if(open) setForm({ userId: rawData.users[0]?.id || '', roleId: rawData.roles[0]?.id || '', entityId: rawData.legalEntities[0]?.id || '', siteIds: ['ALL'] }); }, [open]);
  const sites=rawData.sites.filter((row)=>row.entityId===form.entityId);
  return <Modal open={open} onClose={onClose} title="Assign Role" subtitle="Role diberikan dalam boundary Legal Entity dan Site." footer={<><button className="btn" onClick={onClose}>Batal</button><button className="btn btn-primary" onClick={() => { const id=onAssign(form); if(id) onClose(); }}>Assign</button></>}>
    <div className="form-grid">
      <label className="field"><span>User</span><select value={form.userId} onChange={(e)=>setForm({...form,userId:e.target.value})}>{rawData.users.map((row)=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      <label className="field"><span>Role</span><select value={form.roleId} onChange={(e)=>setForm({...form,roleId:e.target.value})}>{rawData.roles.map((row)=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      <label className="field"><span>Entity</span><select value={form.entityId} onChange={(e)=>setForm({...form,entityId:e.target.value,siteIds:['ALL']})}>{rawData.legalEntities.map((row)=><option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></label>
      <label className="field"><span>Site Scope</span><select value={form.siteIds[0] || 'ALL'} onChange={(e)=>setForm({...form,siteIds:[e.target.value]})}><option value="ALL">All Sites</option>{sites.map((row)=><option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></label>
    </div>
  </Modal>;
}

function ApprovalPolicyModal({ open, onClose, rawData, onCreate }) {
  const [form, setForm] = useState({ name:'', documentType:'PURCHASE_ORDER', entityId:'ALL', minAmount:0, maxAmount:'', roleId:rawData.roles[0]?.id||'', allowSelfApproval:false });
  React.useEffect(()=>{if(open)setForm({ name:'', documentType:'PURCHASE_ORDER', entityId:'ALL', minAmount:0, maxAmount:'', roleId:rawData.roles[0]?.id||'', allowSelfApproval:false });},[open]);
  return <Modal open={open} onClose={onClose} title="Tambah Approval Rule" subtitle="Rule akan dipilih berdasarkan document type, entity, dan amount range." footer={<><button className="btn" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={!form.name||!form.roleId} onClick={()=>{const id=onCreate(form);if(id)onClose();}}>Create Rule</button></>}>
    <div className="form-grid">
      <label className="field field--full"><span>Rule Name</span><input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></label>
      <label className="field"><span>Document Type</span><select value={form.documentType} onChange={(e)=>setForm({...form,documentType:e.target.value})}><option value="SALES_ORDER">Sales Order</option><option value="CREDIT_OVERRIDE">Credit Override</option><option value="PURCHASE_REQUEST">Purchase Request</option><option value="PURCHASE_ORDER">Purchase Order</option><option value="STOCK_TAKE">Stock Take</option></select></label>
      <label className="field"><span>Entity</span><select value={form.entityId} onChange={(e)=>setForm({...form,entityId:e.target.value})}><option value="ALL">All Entities</option>{rawData.legalEntities.map((row)=><option key={row.id} value={row.id}>{row.code}</option>)}</select></label>
      <label className="field"><span>Min Amount</span><input type="number" min="0" value={form.minAmount} onChange={(e)=>setForm({...form,minAmount:e.target.value})}/></label>
      <label className="field"><span>Max Amount</span><input type="number" min="0" value={form.maxAmount} placeholder="Unlimited" onChange={(e)=>setForm({...form,maxAmount:e.target.value})}/></label>
      <label className="field field--full"><span>Approver Role</span><select value={form.roleId} onChange={(e)=>setForm({...form,roleId:e.target.value})}>{rawData.roles.map((row)=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      <label className="governance-check field--full"><input type="checkbox" checked={form.allowSelfApproval} onChange={(e)=>setForm({...form,allowSelfApproval:e.target.checked})}/><span><strong>Allow Self Approval</strong><small>Default-nya off untuk menjaga maker/checker separation.</small></span></label>
    </div>
  </Modal>;
}

function DelegationModal({ open, onClose, rawData, onCreate }) {
  const [form,setForm]=useState({fromUserId:rawData.users[0]?.id||'',toUserId:rawData.users[1]?.id||'',roleId:rawData.roles.find((r)=>r.id==='ROLE-FIN-MGR')?.id||rawData.roles[0]?.id||'',entityId:'ALL',startDate:'2026-09-09',endDate:'2026-09-15',reason:''});
  React.useEffect(()=>{if(open)setForm({fromUserId:rawData.users[0]?.id||'',toUserId:rawData.users[1]?.id||'',roleId:rawData.roles.find((r)=>r.id==='ROLE-FIN-MGR')?.id||rawData.roles[0]?.id||'',entityId:'ALL',startDate:new Date().toISOString().slice(0,10),endDate:new Date(Date.now()+7*86400000).toISOString().slice(0,10),reason:''});},[open]);
  return <Modal open={open} onClose={onClose} title="Approval Delegation" subtitle="Temporary approver substitute dengan periode dan role yang eksplisit." footer={<><button className="btn" onClick={onClose}>Batal</button><button className="btn btn-primary" onClick={()=>{const id=onCreate(form);if(id)onClose();}}>Create Delegation</button></>}>
    <div className="form-grid"><label className="field"><span>From</span><select value={form.fromUserId} onChange={(e)=>setForm({...form,fromUserId:e.target.value})}>{rawData.users.map((u)=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label><label className="field"><span>To</span><select value={form.toUserId} onChange={(e)=>setForm({...form,toUserId:e.target.value})}>{rawData.users.map((u)=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label><label className="field"><span>Role</span><select value={form.roleId} onChange={(e)=>setForm({...form,roleId:e.target.value})}>{rawData.roles.map((r)=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><label className="field"><span>Entity</span><select value={form.entityId} onChange={(e)=>setForm({...form,entityId:e.target.value})}><option value="ALL">All Entities</option>{rawData.legalEntities.map((e)=><option key={e.id} value={e.id}>{e.code}</option>)}</select></label><label className="field"><span>Start</span><input type="date" value={form.startDate} onChange={(e)=>setForm({...form,startDate:e.target.value})}/></label><label className="field"><span>End</span><input type="date" value={form.endDate} onChange={(e)=>setForm({...form,endDate:e.target.value})}/></label><label className="field field--full"><span>Reason</span><textarea rows="2" value={form.reason} onChange={(e)=>setForm({...form,reason:e.target.value})}/></label></div>
  </Modal>;
}

export default function SecurityPage() {
  const {
    rawData,
    currentUserId,
    currentUser,
    currentRoles,
    currentEntity,
    currentSite,
    createUser,
    updateUserSecurity,
    createRole,
    updateRolePermissions,
    assignUserRole,
    createApprovalPolicy,
    createDelegation,
    setDelegationStatus,
    updateDocumentNumberRule,
    previewDocumentNumber,
    updateSystemPolicy,
    markNotificationRead,
    markAllNotificationsRead
  } = useERPData();
  const [tab,setTab]=useState('users');
  const [modal,setModal]=useState(null);
  const [activeRoleId,setActiveRoleId]=useState(rawData.roles.find((row)=>!row.permissions?.includes('*'))?.id || rawData.roles[0]?.id);
  const [query,setQuery]=useState('');

  const activeUsers=rawData.users.filter((row)=>row.status==='Active').length;
  const mfaCoverage=activeUsers?Math.round(rawData.users.filter((row)=>row.status==='Active'&&row.mfaEnabled).length/activeUsers*100):100;
  const privilegedAssignments=rawData.userRoleAssignments.filter((a)=>a.status==='Active'&&rawData.roles.find((r)=>r.id===a.roleId)?.privileged);
  const mfaGaps=[...new Set(privilegedAssignments.filter((a)=>!rawData.users.find((u)=>u.id===a.userId)?.mfaEnabled).map((a)=>a.userId))];
  const selfApprovalAlerts=rawData.approvalRequests.filter((r)=>r.steps.some((step)=>step.actedByUserId&&step.actedByUserId===r.makerUserId)).length;
  const sodAlerts=mfaGaps.length+selfApprovalAlerts;
  const unread=rawData.notifications.filter((row)=>row.userId===currentUserId&&!row.readAt).length;

  const roleName=(id)=>rawData.roles.find((row)=>row.id===id)?.name||id;
  const userName=(id)=>rawData.users.find((row)=>row.id===id)?.name||id;
  const entityCode=(id)=>id==='ALL'?'ALL':rawData.legalEntities.find((row)=>row.id===id)?.code||id;
  const activeRole=rawData.roles.find((row)=>row.id===activeRoleId) || rawData.roles[0];
  const auditRows=useMemo(()=>rawData.auditEvents.filter((row)=>`${row.userName} ${row.module} ${row.documentType} ${row.documentId} ${row.action} ${row.field} ${row.oldValue} ${row.newValue}`.toLowerCase().includes(query.toLowerCase())),[rawData.auditEvents,query]);
  const notifications=rawData.notifications.filter((row)=>row.userId===currentUserId);

  const userRows=rawData.users.map((user)=>({
    ...user,
    roles: rawData.userRoleAssignments.filter((a)=>a.userId===user.id&&a.status==='Active').map((a)=>`${roleName(a.roleId)} · ${entityCode(a.entityId)}`).join(', ') || '-',
    mfa:user.mfaEnabled?'Enabled':'Missing'
  }));
  const policyRows=rawData.approvalPolicies.map((row)=>({...row,entity:entityCode(row.entityId),range:`${money(row.minAmount)} → ${row.maxAmount===null?'∞':money(row.maxAmount)}`,steps:(row.steps||[]).map((s)=>roleName(s.roleId)).join(' → ')}));
  const delegationRows=rawData.approvalDelegations.map((row)=>({...row,from:userName(row.fromUserId),to:userName(row.toUserId),role:roleName(row.roleId),entity:entityCode(row.entityId),period:`${row.startDate} → ${row.endDate}`}));
  const numberingRows=rawData.documentNumberRules.map((row)=>({...row,preview:previewDocumentNumber(row.documentType,currentEntity?.id,currentSite?.id||rawData.sites.find((s)=>s.entityId===currentEntity?.id)?.id)}));

  return <>
    <PageHeader eyebrow="08 · Enterprise Governance" title="Security, Governance & Control" description="RBAC, entity/site access, approval matrix, maker-checker, document numbering, delegation, immutable audit, notification, dan system policy." />
    <div className="stats-grid">
      <StatCard title="Active Users" value={String(activeUsers)} hint={`${rawData.loginSessions.filter((row)=>row.status==='Active').length} active sessions`} icon={UsersRound}/>
      <StatCard title="Roles" value={String(rawData.roles.length)} hint={`${rawData.roles.filter((row)=>row.privileged).length} privileged`} icon={KeyRound}/>
      <StatCard title="MFA Coverage" value={`${mfaCoverage}%`} hint={`${mfaGaps.length} privileged gap`} icon={Fingerprint}/>
      <StatCard title="SoD Alerts" value={String(sodAlerts)} hint="maker/checker + MFA controls" icon={LockKeyhole}/>
      <StatCard title="Pending Approval" value={String(rawData.approvalRequests.filter((row)=>row.status==='Pending').length)} hint="governed workflow" icon={ShieldCheck}/>
      <StatCard title="Unread Alerts" value={String(unread)} hint="notification center" icon={BellRing}/>
    </div>

    <section className="surface-card governance-identity-strip"><div><span><UserCheck size={17}/></span><div><strong>{currentUser?.name}</strong><small>{currentRoles.map((row)=>row.name).join(' · ') || 'No active role'} · {currentEntity?.code}{currentSite?` / ${currentSite.code}`:' / All Sites'}</small></div></div><StatusPill tone="success">Governance Active</StatusPill></section>

    <section className="surface-card governance-workbench">
      <div className="master-tabs">{TABS.map(([key,label])=><button key={key} className={tab===key?'active':''} onClick={()=>setTab(key)}>{label}{key==='notifications'&&<b>{unread}</b>}</button>)}</div>
      <div className="governance-workbench-body">
        {tab==='users'&&<><SectionCard title="User & Entity Access" subtitle="User lifecycle, MFA, session posture, role assignment, dan entity/site boundary." action={<div className="action-row"><button className="btn btn-sm" onClick={()=>setModal('assignment')}><KeyRound size={14}/> Assign Role</button><button className="btn btn-sm btn-primary" onClick={()=>setModal('user')}><Plus size={14}/> User</button></div>}><DataTable rows={userRows} columns={[{key:'username',label:'Username'},{key:'name',label:'User'},{key:'roles',label:'Role / Entity'},{key:'mfa',label:'MFA',render:(v)=><StatusPill tone={v==='Enabled'?'success':'danger'}>{v}</StatusPill>},{key:'sessionStatus',label:'Session',render:(v)=><StatusPill tone={v==='Online'?'success':'info'}>{v}</StatusPill>},{key:'lastLoginAt',label:'Last Login',render:(v)=>dateTimeLabel(v)},{key:'status',label:'Status',render:(v,row)=><button className="table-link" onClick={()=>updateUserSecurity(row.id,{status:v==='Active'?'Disabled':'Active'})}>{v}</button>},{key:'security',label:'Control',render:(_,row)=><button className="btn btn-sm" onClick={()=>updateUserSecurity(row.id,{mfaEnabled:!row.mfaEnabled})}>{row.mfaEnabled?'Disable MFA':'Enable MFA'}</button>}]}/></SectionCard><SectionCard title="Active Login Sessions" subtitle="Operational session visibility untuk review administrator dan security audit."><DataTable rows={rawData.loginSessions.map((row)=>({...row,user:userName(row.userId)}))} columns={[{key:'user',label:'User'},{key:'device',label:'Device'},{key:'ip',label:'IP'},{key:'startedAt',label:'Started',render:(v)=>dateTimeLabel(v)},{key:'lastSeenAt',label:'Last Seen',render:(v)=>dateTimeLabel(v)},{key:'status',label:'Status',render:(v)=><StatusPill tone={v==='Active'?'success':'info'}>{v}</StatusPill>}]}/></SectionCard></>}

        {tab==='roles'&&<div className="governance-two-column"><SectionCard title="Role Registry" subtitle="Privileged role dan SoD override terlihat eksplisit." action={<button className="btn btn-sm btn-primary" onClick={()=>setModal('role')}><Plus size={14}/> Role</button>}><div className="governance-role-list">{rawData.roles.map((role)=><button key={role.id} className={role.id===activeRole?.id?'active':''} onClick={()=>setActiveRoleId(role.id)}><div><strong>{role.name}</strong><small>{role.code} · {(role.permissions||[]).includes('*')?'All permissions':`${role.permissions.length} permissions`}</small></div><div>{role.privileged&&<StatusPill tone="warning">Privileged</StatusPill>}{role.sodOverride&&<StatusPill tone="danger">SoD Override</StatusPill>}</div></button>)}</div></SectionCard><SectionCard title={`Permission Matrix · ${activeRole?.name||'-'}`} subtitle="Perubahan permission langsung tercatat di global audit trail."><div className="governance-permission-grid">{rawData.permissionCatalog.map((perm)=>{const all=activeRole?.permissions?.includes('*');const checked=all||activeRole?.permissions?.includes(perm.id);return <label key={perm.id} className={checked?'active':''}><input type="checkbox" disabled={all} checked={Boolean(checked)} onChange={()=>{const next=checked?(activeRole.permissions||[]).filter((x)=>x!==perm.id):[...(activeRole.permissions||[]),perm.id];updateRolePermissions(activeRole.id,next);}}/><span><strong>{perm.module}</strong><small>{perm.action}</small></span></label>})}</div></SectionCard></div>}

        {tab==='approvals'&&<SectionCard title="Approval Matrix" subtitle="Threshold, legal entity, sequential role, dan self-approval policy." action={<button className="btn btn-sm btn-primary" onClick={()=>setModal('policy')}><Plus size={14}/> Rule</button>}><DataTable rows={policyRows} columns={[{key:'name',label:'Rule'},{key:'documentType',label:'Document'},{key:'entity',label:'Entity'},{key:'range',label:'Amount Range'},{key:'steps',label:'Approval Chain'},{key:'allowSelfApproval',label:'Self Approval',render:(v)=><StatusPill tone={v?'warning':'success'}>{v?'Allowed':'Blocked'}</StatusPill>},{key:'status',label:'Status',render:(v)=><StatusPill tone={statusTone(v)}>{v}</StatusPill>}]}/></SectionCard>}

        {tab==='numbering'&&<SectionCard title="Document Numbering Engine" subtitle="Internal ID tetap stabil; business document number memakai entity/site/year/month/sequence." action={<FileKey2 size={17}/>}><DataTable rows={numberingRows} columns={[{key:'documentType',label:'Document'},{key:'code',label:'Code'},{key:'template',label:'Template',render:(v,row)=><input className="table-input governance-template-input" defaultValue={v} onBlur={(e)=>{if(e.target.value!==v)updateDocumentNumberRule(row.id,{template:e.target.value});}}/>},{key:'reset',label:'Reset',render:(v,row)=><select className="table-input" value={v} onChange={(e)=>updateDocumentNumberRule(row.id,{reset:e.target.value})}><option>MONTHLY</option><option>YEARLY</option><option>NEVER</option></select>},{key:'lastNumber',label:'Last Seq',render:(v)=>number(v)},{key:'preview',label:'Next Preview',render:(v)=><strong>{v}</strong>},{key:'status',label:'Status',render:(v,row)=><button className="table-link" onClick={()=>updateDocumentNumberRule(row.id,{status:v==='Active'?'Inactive':'Active'})}>{v}</button>}]}/></SectionCard>}

        {tab==='delegation'&&<SectionCard title="Approval Delegation" subtitle="Temporary substitute tidak mengubah permanent role assignment." action={<button className="btn btn-sm btn-primary" onClick={()=>setModal('delegation')}><Plus size={14}/> Delegation</button>}><DataTable rows={delegationRows} columns={[{key:'from',label:'From'},{key:'to',label:'To'},{key:'role',label:'Role'},{key:'entity',label:'Entity'},{key:'period',label:'Period'},{key:'reason',label:'Reason'},{key:'status',label:'Status',render:(v,row)=><button className="table-link" disabled={v!=='Active'} onClick={()=>setDelegationStatus(row.id,'Revoked')}>{v}</button>}]}/></SectionCard>}

        {tab==='audit'&&<SectionCard title="Immutable Audit Explorer" subtitle="Who, when, entity/site, document, field, old value, new value, dan action."><div className="governance-search"><Search size={15}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Cari user, document, action, value..."/></div><DataTable rows={auditRows} columns={[{key:'at',label:'Timestamp',render:(v)=>dateTimeLabel(v)},{key:'userName',label:'User'},{key:'module',label:'Module'},{key:'documentType',label:'Type'},{key:'documentId',label:'Document'},{key:'action',label:'Action'},{key:'field',label:'Field'},{key:'oldValue',label:'Old Value'},{key:'newValue',label:'New Value'},{key:'severity',label:'Severity',render:(v)=><StatusPill tone={v==='Warning'?'warning':v==='Critical'?'danger':'info'}>{v}</StatusPill>}]}/></SectionCard>}

        {tab==='notifications'&&<SectionCard title="Notification Center" subtitle="Approval, security, finance, inventory, dan closing alerts." action={<button className="btn btn-sm" onClick={markAllNotificationsRead}><CheckCircle2 size={14}/> Mark All Read</button>}><div className="governance-notification-list">{notifications.map((row)=><button key={row.id} className={row.readAt?'read':''} onClick={()=>markNotificationRead(row.id)}><span className={`governance-priority p-${row.priority.toLowerCase()}`}/><div><div><strong>{row.title}</strong><StatusPill tone={row.priority==='High'?'danger':row.priority==='Medium'?'warning':'info'}>{row.priority}</StatusPill></div><p>{row.message}</p><small>{dateTimeLabel(row.createdAt)} · {row.type} · {row.readAt?'Read':'Unread'}</small></div></button>)}</div></SectionCard>}

        {tab==='policies'&&<><div className="governance-policy-grid">{rawData.systemPolicies.map((row)=><section key={row.id} className="surface-card governance-policy-card"><div><span>{row.category}</span><h4>{row.label}</h4><p>{row.description}</p></div>{typeof row.value==='boolean'?<button className={`governance-toggle ${row.value?'on':''}`} onClick={()=>updateSystemPolicy(row.id,!row.value)}><span/></button>:<input className="table-input" type="number" value={row.value} onChange={(e)=>updateSystemPolicy(row.id,Number(e.target.value))}/>}</section>)}</div><SectionCard title="Document Lock & Correction Policy" subtitle="Posted/closed document tidak diedit diam-diam. Koreksi diarahkan melalui reversal, credit/debit note, atau new count."><DataTable rows={rawData.documentControlPolicies} columns={[{key:'documentType',label:'Document'},{key:'lockedStatuses',label:'Locked Status',render:(v)=>(v||[]).join(', ')},{key:'postingField',label:'Posting Field',render:(v)=>v||'-'},{key:'postingValues',label:'Posting Values',render:(v)=>(v||[]).join(', ')||'-'},{key:'correctionMode',label:'Correction Mode',render:(v)=><StatusPill tone="info">{v}</StatusPill>},{key:'status',label:'Status',render:(v)=><StatusPill tone={statusTone(v)}>{v}</StatusPill>}]}/></SectionCard></>}
      </div>
    </section>

    <UserModal open={modal==='user'} onClose={()=>setModal(null)} onCreate={createUser}/>
    <RoleModal open={modal==='role'} onClose={()=>setModal(null)} onCreate={createRole} permissions={rawData.permissionCatalog}/>
    <AssignmentModal open={modal==='assignment'} onClose={()=>setModal(null)} rawData={rawData} onAssign={assignUserRole}/>
    <ApprovalPolicyModal open={modal==='policy'} onClose={()=>setModal(null)} rawData={rawData} onCreate={createApprovalPolicy}/>
    <DelegationModal open={modal==='delegation'} onClose={()=>setModal(null)} rawData={rawData} onCreate={createDelegation}/>
  </>;
}
