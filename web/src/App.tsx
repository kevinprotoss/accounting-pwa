import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users,
  PackagePlus,
  PackageMinus,
  Boxes,
  MoreHorizontal,
  Landmark,
  Receipt,
  CarFront,
  ClipboardCheck,
  Building2,
} from 'lucide-react';

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
import { ScanTaskProvider } from './providers/ScanTaskProvider';
import LanguageSwitcher from './components/LanguageSwitcher';

const navIcons = {
  customers: Users,
  receipts: PackagePlus,
  issues: PackageMinus,
  stock: Boxes,
  tax: Landmark,
  expenses: Receipt,
  cars: CarFront,
  audit: ClipboardCheck,
  company: Building2,
};

export default function App() {
  const [active, setActive] = useState('customers');
  const [moreOpen, setMoreOpen] = useState(false);
  const { t } = useTranslation();

  const navItems = useMemo(
    () => [
      { key: 'customers', label: t('nav.customers') },
      { key: 'receipts', label: t('nav.receipts') },
      { key: 'issues', label: t('nav.issues') },
      { key: 'stock', label: t('nav.stock') },
      { key: 'tax', label: t('nav.tax') },
      { key: 'expenses', label: t('nav.expenses') },
      { key: 'cars', label: t('nav.cars') },
      { key: 'audit', label: t('nav.audit') },
      { key: 'company', label: t('nav.company') },
    ],
    [t]
  );

  const primaryTabs = useMemo(
    () => [
      {
        key: 'customers',
        label: t('nav.customers'),
        mobileLabel: t('nav_mobile.customers'),
        icon: Users,
      },
      {
        key: 'receipts',
        label: t('nav.receipts'),
        mobileLabel: t('nav_mobile.receipts'),
        icon: PackagePlus,
      },
      {
        key: 'issues',
        label: t('nav.issues'),
        mobileLabel: t('nav_mobile.issues'),
        icon: PackageMinus,
      },
      {
        key: 'stock',
        label: t('nav.stock'),
        mobileLabel: t('nav_mobile.stock'),
        icon: Boxes,
      },
      {
        key: 'more',
        label: t('nav.more'),
        mobileLabel: t('nav_mobile.more'),
        icon: MoreHorizontal,
      },
    ],
    [t]
  );

  const moreItems = useMemo(
    () =>
      navItems.filter(
        (i) => !['customers', 'receipts', 'issues', 'stock'].includes(i.key)
      ),
    [navItems]
  );

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
        return null;
    }
  }

  return (
    <ScanTaskProvider>
      <div className="min-h-full bg-slate-50 text-slate-900">
        {/* 桌面侧边栏 */}
        <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:w-56 border-r border-slate-200 bg-white">
          <div className="px-4 py-5 flex items-center justify-between">
            <div className="text-lg font-semibold">
              {t('app.title')}
            </div>

            <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              v{__APP_VERSION__}
            </span>
          </div>

          <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = navIcons[item.key as keyof typeof navIcons];

              return (
                <button
                  key={item.key}
                  onClick={() => select(item.key)}
                  className={cn(
                    'w-full min-h-[44px] flex items-center gap-3 text-left px-3 rounded-md text-sm transition-colors',
                    active === item.key
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  )}
                >
                  <Icon
                    size={19}
                    strokeWidth={1.8}
                    className={cn(
                      'shrink-0',
                      active === item.key
                        ? 'text-white'
                        : 'text-slate-500'
                    )}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="px-2 py-3 border-t border-slate-200">
            <div className="text-[10px] font-medium text-slate-500 mb-1.5 px-1">
              {t('language.label')}
            </div>
            <LanguageSwitcher />
          </div>
        </aside>

        {/* 主内容 */}
        <main className="md:pl-56 pb-[calc(env(safe-area-inset-bottom)+60px)] md:pb-0">
          <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200 px-4 py-3">
            <h1 className="text-base font-semibold">
              {navItems.find((n) => n.key === active)?.label ?? t('app.title')}
            </h1>
          </header>

          <section className="p-4 md:p-6">
            {renderPage()}
          </section>
        </main>

        {/* 手机底部 Tab */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 border-t border-slate-200 bg-white grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
          {primaryTabs.map((tab) => {
            const isActive =
              tab.key === 'more' ? moreOpen : active === tab.key;

            const Icon = tab.icon;

            return (
              <button
                key={tab.key}
                onClick={() => {
                  if (tab.key === 'more') {
                    setMoreOpen((v) => !v);
                  } else {
                    select(tab.key);
                  }
                }}
                aria-label={tab.label}
                aria-current={
                  tab.key !== 'more' && active === tab.key
                    ? 'page'
                    : undefined
                }
                className={cn(
                  'min-h-[56px] flex flex-col items-center justify-center gap-1 px-1',
                  'text-[11px] leading-tight whitespace-nowrap',
                  isActive
                    ? 'text-slate-900 font-medium'
                    : 'text-slate-500'
                )}
              >
                <Icon size={21} strokeWidth={isActive ? 2.2 : 1.8} />
                <span>{tab.mobileLabel}</span>
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
                {t('nav.more')}
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
              <div className="px-4 py-3 border-t border-slate-200">
                <div className="text-xs font-medium text-slate-500 mb-2">
                  {t('language.label')}
                </div>
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        )}
      </div>
    </ScanTaskProvider>
  );
}