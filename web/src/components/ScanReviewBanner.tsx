import { useTranslation } from 'react-i18next';
import { useScanTasks } from '../providers/ScanTaskProvider';

type Props = {
  recordType: 'goods_receipts' | 'other_expenses';
  recordId: number | null;
};

export default function ScanReviewBanner({ recordType, recordId }: Props) {
  const { t } = useTranslation();
  const { tasks } = useScanTasks();
  if (!recordId) return null;

  const job = tasks.find(
    (task) =>
      task.status === 'consumed' &&
      task.record_type === recordType &&
      task.record_id === recordId
  );
  if (!job) return null;

  const uncertainCount = job.uncertain_count;

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
      <div className="font-medium">{t('scan.review_banner_title')}</div>
      <div className="text-xs mt-1 text-amber-700">
        {t('scan.review_banner_hint')}
        {uncertainCount > 0 && (
          <>
            {' '}
            {t('scan.review_banner_uncertain', { count: uncertainCount })}
          </>
        )}
      </div>
    </div>
  );
}