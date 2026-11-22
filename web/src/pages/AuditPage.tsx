import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AuditIssueTab from '../components/audit/AuditIssueTab';
import AuditReceiptTab from '../components/audit/AuditReceiptTab';
import AuditExpenseTab from '../components/audit/AuditExpenseTab';
import AuditCarTab from '../components/audit/AuditCarTab';

export default function AuditPage() {
  const { t } = useTranslation();
  const [active, setActive] = useState('issues');

  const tabs = [
    { key: 'issues', label: t('audit.tab_issues') },
    { key: 'receipts', label: t('audit.tab_receipts') },
    { key: 'expenses', label: t('audit.tab_expenses') },
    { key: 'cars', label: t('audit.tab_cars') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={
              'h-10 px-4 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ' +
              (active === tab.key
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700')
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === 'issues' && <AuditIssueTab />}
      {active === 'receipts' && <AuditReceiptTab />}
      {active === 'expenses' && <AuditExpenseTab />}
      {active === 'cars' && <AuditCarTab />}
    </div>
  );
}