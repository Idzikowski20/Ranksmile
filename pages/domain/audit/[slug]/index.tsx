import React, { useMemo, useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useQuery } from 'react-query';
import { CSSTransition } from 'react-transition-group';
import AppShell from '../../../../components/common/AppShell';
import DomainHeader from '../../../../components/domains/DomainHeader';
import AddDomain from '../../../../components/domains/AddDomain';
import DomainSettings from '../../../../components/domains/DomainSettings';
import Settings from '../../../../components/settings/Settings';
import Footer from '../../../../components/common/Footer';
import AuditTable from '../../../../components/articles/AuditTable';
import AuditPanel from '../../../../components/articles/AuditPanel';
import { useFetchDomains } from '../../../../services/domains';
import { useFetchSettings } from '../../../../services/settings';
import type { AuditItem } from '../../../api/audit';

async function fetchAudit(domainSlug: string, scFilter: string) {
  const res = await fetch(`${window.location.origin}/api/audit?domain=${encodeURIComponent(domainSlug)}&scFilter=${scFilter}`);
  if (res.status >= 400) {
    if (res.status === 401) window.location.href = '/login';
    throw new Error('Bad response from server');
  }
  return res.json();
}

const AuditPage: NextPage = () => {
  const router = useRouter();
  const [showDomainSettings, setShowDomainSettings] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [scDateFilter, setSCDateFilter] = useState('thirtyDays');
  const [selectedItem, setSelectedItem] = useState<AuditItem | null>(null);
  const { data: appSettings } = useFetchSettings();
  const { data: domainsData } = useFetchDomains(router);

  const theDomains: DomainType[] = (domainsData && domainsData.domains) || [];

  const activDomain: DomainType | null = useMemo(() => {
    if (domainsData?.domains && router.query?.slug) {
      return domainsData.domains.find((x: DomainType) => x.slug === router.query.slug) || null;
    }
    return null;
  }, [router.query.slug, domainsData]);

  const domainHasScAPI = useMemo(() => {
    const domainSc = activDomain?.search_console ? JSON.parse(activDomain.search_console) : {};
    const hasOAuth = domainSc?.auth_type === 'oauth' && !!domainSc?.oauth_refresh_token;
    const hasServiceAccount = !!(domainSc?.client_email && domainSc?.private_key);
    return hasOAuth || hasServiceAccount;
  }, [activDomain]);

  const scConnected = !!(appSettings && appSettings?.settings?.search_console_integrated);

  const { data: auditData, isLoading } = useQuery(
    ['audit', activDomain?.slug, scDateFilter],
    () => fetchAudit(activDomain?.slug || '', scDateFilter),
    { enabled: !!activDomain?.slug },
  );

  const items: AuditItem[] = auditData?.items || [];
  const lastAnalysisAt: string | null = auditData?.lastAnalysisAt || null;
  const lastSCUpdate: string | null = auditData?.lastSCUpdate || null;

  return (
    <AppShell domains={theDomains} showAddModal={() => setShowAddDomain(true)} showSettings={() => setShowSettings(true)}>
        {activDomain && activDomain.domain && (
          <Head>
            <title>{`${activDomain.domain} - Content Audit - SerpBear`}</title>
          </Head>
        )}
        <div className="flex w-full">
          <div className="domain_keywords px-5 pt-6 lg:px-8 lg:pt-6 w-full">
            {activDomain && activDomain.domain ? (
              <DomainHeader
                domain={activDomain}
                domains={theDomains}
                showAddModal={() => {}}
                showSettingsModal={setShowDomainSettings}
                exportCsv={() => {}}
                scFilter={scDateFilter}
                setScFilter={(item: string) => setSCDateFilter(item)}
              />
            ) : (
              <div className="w-full lg:h-[100px]" />
            )}

            {/* Audit table */}
            <div style={{ marginTop: 21, borderRadius: 12, background: '#fff', border: '1px solid #e4e4e7', overflow: 'hidden' }}>
              <div style={{ padding: '14px 21px', borderBottom: '1px solid #f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 600, color: '#09090b' }}>Content Audit</h2>
                  <p style={{ fontSize: 12, color: '#71717a', marginTop: 2 }}>
                    {items.length} pages — identify content that needs improvement
                  </p>
                </div>
              </div>
              <AuditTable
                items={items}
                isLoading={isLoading}
                onSelect={setSelectedItem}
                selectedId={selectedItem?.id ?? null}
              />
            </div>
          </div>
        </div>

        {/* Slide-out panel */}
        <CSSTransition in={!!selectedItem} timeout={250} classNames="audit_panel_anim" unmountOnExit mountOnEnter>
          <AuditPanel
            item={selectedItem}
            lastAnalysisAt={lastAnalysisAt}
            lastSCUpdate={lastSCUpdate}
            onClose={() => setSelectedItem(null)}
          />
        </CSSTransition>

        <CSSTransition in={showAddDomain} timeout={300} classNames="modal_anim" unmountOnExit mountOnEnter>
          <AddDomain closeModal={() => setShowAddDomain(false)} domains={domainsData?.domains || []} />
        </CSSTransition>
        <CSSTransition in={showDomainSettings} timeout={300} classNames="modal_anim" unmountOnExit mountOnEnter>
          <DomainSettings
            domain={showDomainSettings && theDomains && activDomain && activDomain.domain ? activDomain : false}
            closeModal={setShowDomainSettings}
          />
        </CSSTransition>
        <CSSTransition in={showSettings} timeout={300} classNames="settings_anim" unmountOnExit mountOnEnter>
          <Settings closeSettings={() => setShowSettings(false)} />
        </CSSTransition>
        <Footer currentVersion={appSettings?.settings?.version || ''} />

      <style jsx global>{`
        .audit_panel_anim-enter { transform: translateX(100%); }
        .audit_panel_anim-enter-active { transform: translateX(0); transition: transform 250ms ease-out; }
        .audit_panel_anim-exit { transform: translateX(0); }
        .audit_panel_anim-exit-active { transform: translateX(100%); transition: transform 200ms ease-in; }
      `}</style>
    </AppShell>
  );
};

export default AuditPage;
