import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';

const LANGUAGES = [
  { code: 'zh', label: '中文' },
  { code: 'de', label: 'Deutsch' },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language;

  return (
    <div className="flex gap-1">
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => i18n.changeLanguage(l.code)}
          className={cn(
            'h-8 px-2 text-xs rounded',
            current === l.code
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          )}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}