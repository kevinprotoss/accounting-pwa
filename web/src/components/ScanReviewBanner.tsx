import { useScanTasks } from '../providers/ScanTaskProvider';

type Props = {
  recordType: 'goods_receipts' | 'other_expenses';
  recordId: number | null;
};

export default function ScanReviewBanner({ recordType, recordId }: Props) {
  const { tasks } = useScanTasks();
  if (!recordId) return null;

  const job = tasks.find(
    (t) =>
      t.status === 'consumed' &&
      t.record_type === recordType &&
      t.record_id === recordId
  );
  if (!job) return null;

  const uncertainCount = job.uncertain_count;

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
      <div className="font-medium">
        ⚠ 此记录由扫描自动生成，请核对内容后保存。
      </div>
      <div className="text-xs mt-1 text-amber-700">
        保存后此提示消失，扫描任务自动清理。
        {uncertainCount > 0 && (
          <>
            {' '}
            本次识别有 {uncertainCount} 个不确定项，建议重点检查。
          </>
        )}
      </div>
    </div>
  );
}