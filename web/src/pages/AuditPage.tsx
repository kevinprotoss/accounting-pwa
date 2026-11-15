import { useState } from 'react';
import AuditIssueTab from '../components/audit/AuditIssueTab';
import AuditReceiptTab from '../components/audit/AuditReceiptTab';
import AuditExpenseTab from '../components/audit/AuditExpenseTab';
import AuditCarTab from '../components/audit/AuditCarTab';

const tabs = [
  { key: 'issues', label: '销售单' },
  { key: 'receipts', label: '进货单' },
  { key: 'expenses', label: '支出' },
  { key: 'cars', label: '公司车' },
];

export default function AuditPage() {
  const [active, setActive] = useState('issues');

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={
              'h-10 px-4 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ' +
              (active === t.key
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700')
            }
          >
            {t.label}
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