import React, { createContext, useContext, useMemo } from 'react';
import { useERPData } from './ERPDataContext';

const OrgContext = createContext(null);

export function OrgProvider({ children }) {
  const {
    rawData,
    accessibleEntities,
    scope,
    currentEntity,
    currentSite,
    currentSites,
    setEntityScope,
    setSiteScope,
    setGroupScope
  } = useERPData();

  const group = rawData.consolidationGroups.find((row) => row.id === scope.groupId) || rawData.consolidationGroups[0];
  const groupOption = group ? {
    id: `GROUP:${group.id}`,
    name: `${group.name} · Consolidated`,
    code: `◆ ${group.code}`,
    sites: [{ id: 'ALL', name: 'Group Consolidated', code: 'ALL' }],
    isGroup: true
  } : null;

  const legalEntityOptions = useMemo(() => (accessibleEntities || []).map((entity) => ({
    ...entity,
    sites: [{ id: 'ALL', name: 'All Sites', code: 'ALL' }, ...(rawData.sites || []).filter((site) => site.entityId === entity.id)]
  })), [accessibleEntities, rawData.sites]);

  const entities = useMemo(() => groupOption ? [groupOption, ...legalEntityOptions] : legalEntityOptions, [groupOption, legalEntityOptions]);
  const entity = scope.mode === 'GROUP' ? groupOption : (legalEntityOptions.find((row) => row.id === currentEntity?.id) || legalEntityOptions[0]);
  const site = scope.mode === 'GROUP'
    ? groupOption?.sites?.[0]
    : (scope.siteId === 'ALL'
      ? { id: 'ALL', name: 'All Sites', code: 'ALL' }
      : currentSite || currentSites[0] || { id: 'ALL', name: 'All Sites', code: 'ALL' });

  const changeEntity = (nextId) => {
    if (String(nextId).startsWith('GROUP:')) return setGroupScope(String(nextId).slice(6));
    return setEntityScope(nextId);
  };

  const changeSite = (nextSiteId) => {
    if (scope.mode === 'GROUP') return false;
    return setSiteScope(nextSiteId);
  };

  const value = useMemo(() => ({
    entities,
    entity,
    site,
    entityId: entity?.id,
    siteId: site?.id,
    setEntityId: changeEntity,
    setSiteId: changeSite,
    groupMode: scope.mode === 'GROUP',
    scopeMode: scope.mode,
    groupId: scope.groupId,
    currentEntity,
    currentSite
  }), [entities, entity, site, scope, currentEntity, currentSite]);

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const context = useContext(OrgContext);
  if (!context) throw new Error('useOrg must be used inside OrgProvider');
  return context;
}
