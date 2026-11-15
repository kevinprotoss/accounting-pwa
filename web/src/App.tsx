import { useState } from 'react';
import { cn } from './lib/utils';
import CustomersPage from './pages/CustomersPage';
import ReceiptsPage from './pages/ReceiptsPage';
import IssuesPage from './pages/IssuesPage';
import StockPage from './pages/StockPage';
import TaxPage from './pages/TaxPage';
import ExpensesPage from './pages/ExpensesPage';
import CarsPage from './pages/CarsPage';
import AuditPage from './pages/AuditPage';
import CompanyPage from './pages/CompanyPage';

const navItems = [
  { key: 'customers', label: '客户' },
  { key: 'receipts', label: '进货' },
  { key: 'issues', label: '销售' },
  { key: 'stock', label: '库存' },
  { key: 'tax', label: '税务' },
  { key: 'expenses', label: '支出' },
  { key: 'cars', label: '车辆' },
  { key: 'audit', label: '审计' },
  { key: 'company', label: '公司' },
];

const primaryTabs = [
  { key: 'customers', label: '客户' },
  { key: 'receipts', label: '进货' },
  { key: 'issues', label: '销售' },
  { key: 'stock', label: '库存' },
  { key: 'more', label: '更多' },
];

const moreItems = navItems.filter(
  (i) => !['customers', 'receipts', 'issues', 'stock'].includes(i.key)
);

export default function App() {
  const [active, setActive] = useState('customers');
  const [moreOpen, setMoreOpen] = useState(false);

  function select(key: string) {
    setActive(key);
    setMoreOpen(false);
  }

  function renderPage() {
    switch (active) {
      case 'customers':
        return <CustomersPage />;
      case 'receipts':
        return <ReceiptsPage />;
      case 'issues':
        return <IssuesPage />;
      case 'stock':
        return <StockPage />;
      case 'tax':
        return <TaxPage />;
      case 'expenses':
        return <ExpensesPage />;
      case 'cars':
        return <CarsPage />;
      case 'audit':
          return <AuditPage />;
      case 'company':
        return <CompanyPage />;
      default:
        return (
          <p className="text-sm text-slate-500">
            「{navItems.find((n) => n.key === active)?.label ?? active}」模块待实现。
          </p>
        );
    }
  }

  return (
    <div className="min-h-full bg-slate-50 text-slate-900">
      {/* 桌面侧边栏 */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:w-56 border-r border-slate-200 bg-white">
        <div className="px-4 py-5 text-lg font-semibold">Accounting</div>
        <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => select(item.key)}
              className={cn(
                'w-full min-h-[44px] flex items-center text-left px-3 rounded-md text-sm',
                active === item.key
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* 主内容 */}
      <main className="md:pl-56 pb-[calc(env(safe-area-inset-bottom)+60px)] md:pb-0">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200 px-4 py-3">
          <h1 className="text-base font-semibold">
            {navItems.find((n) => n.key === active)?.label ?? 'Accounting'}
          </h1>
        </header>

        <section className="p-4 md:p-6">{renderPage()}</section>
      </main>

      {/* 手机底部 Tab */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 border-t border-slate-200 bg-white grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {primaryTabs.map((tab) => {
          const isActive = tab.key === 'more' ? moreOpen : active === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                if (tab.key === 'more') setMoreOpen((v) => !v);
                else select(tab.key);
              }}
              className={cn(
                'min-h-[56px] flex flex-col items-center justify-center text-xs',
                isActive ? 'text-slate-900 font-medium' : 'text-slate-500'
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* 手机「更多」抽屉 */}
      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/40"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] bg-white rounded-t-2xl pb-[env(safe-area-inset-bottom)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-200 text-sm font-semibold text-slate-700">
              更多
            </div>
            <div className="py-1">
              {moreItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => select(item.key)}
                  className={cn(
                    'w-full text-left px-4 py-3.5 text-sm',
                    active === item.key
                      ? 'bg-slate-100 text-slate-900 font-medium'
                      : 'text-slate-800 hover:bg-slate-50'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}