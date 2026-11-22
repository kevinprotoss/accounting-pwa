import { useTranslation } from 'react-i18next';
import { presetI18nKey, type FilterSummary } from '../lib/listFilter';

export function useFilterSummaryText(summary: FilterSummary): string {
  const { t } = useTranslation();
  const parts: string[] = [];

  if (summary.timePreset !== 'all') {
    if (summary.timePreset === 'custom') {
      if (summary.customFrom && summary.customTo) {
        parts.push(`${summary.customFrom} ~ ${summary.customTo}`);
      }
    } else {
      parts.push(t(presetI18nKey(summary.timePreset)));
    }
  }
  if (summary.statusLabel) parts.push(summary.statusLabel);
  if (summary.keyword) parts.push(`"${summary.keyword}"`);

  return parts.length > 0 ? parts.join(' · ') : t('filter.all');
}