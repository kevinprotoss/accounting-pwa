export type TimePreset =
  | 'all'
  | 'today'
  | 'week'
  | 'month'
  | 'lastMonth'
  | 'year'
  | 'custom';

export type ListFilter = {
  keyword: string;
  timePreset: TimePreset;
  customFrom: string;
  customTo: string;
  status: string;
};

export const defaultFilter: ListFilter = {
  keyword: '',
  timePreset: 'month',
  customFrom: '',
  customTo: '',
  status: 'all',
};

export const TIME_PRESETS: { value: TimePreset; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'today', label: '今天' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
  { value: 'lastMonth', label: '上月' },
  { value: 'year', label: '本年' },
  { value: 'custom', label: '自定义' },
];

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getDateRange(
  filter: ListFilter
): { from: string; to: string } | null {
  const now = new Date();
  const today = toDateString(now);
  switch (filter.timePreset) {
    case 'all':
      return null;
    case 'today':
      return { from: today, to: today };
    case 'week': {
      const day = now.getDay() || 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - (day - 1));
      return { from: toDateString(monday), to: today };
    }
    case 'month': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toDateString(first), to: today };
    }
    case 'lastMonth': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: toDateString(first), to: toDateString(last) };
    }
    case 'year': {
      const first = new Date(now.getFullYear(), 0, 1);
      return { from: toDateString(first), to: today };
    }
    case 'custom':
      if (!filter.customFrom || !filter.customTo) return null;
      return { from: filter.customFrom, to: filter.customTo };
    default:
      return null;
  }
}

export function isDefaultFilter(filter: ListFilter): boolean {
  return (
    filter.timePreset === 'month' &&
    filter.status === 'all' &&
    filter.keyword === '' &&
    filter.customFrom === '' &&
    filter.customTo === ''
  );
}

export function filterSummary(
  filter: ListFilter,
  statusOptions: { value: string; label: string }[]
): string {
  const parts: string[] = [];
  const preset = TIME_PRESETS.find((p) => p.value === filter.timePreset);
  if (preset && preset.value !== 'all') {
    if (preset.value === 'custom') {
      if (filter.customFrom && filter.customTo) {
        parts.push(`${filter.customFrom} ~ ${filter.customTo}`);
      }
    } else {
      parts.push(preset.label);
    }
  }
  if (filter.status !== 'all') {
    const s = statusOptions.find((o) => o.value === filter.status);
    if (s) parts.push(s.label);
  }
  if (filter.keyword.trim()) {
    parts.push(`"${filter.keyword.trim()}"`);
  }
  return parts.length > 0 ? parts.join(' · ') : '全部';
}

export function groupByMonth<T extends { date: string }>(
  items: T[]
): { month: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const month = item.date.slice(0, 7);
    if (!map.has(month)) map.set(month, []);
    map.get(month)!.push(item);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, items]) => ({ month, items }));
}

export function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-');
  return `${y}年${parseInt(m, 10)}月`;
}

export function currentMonth(): string {
  return toDateString(new Date()).slice(0, 7);
}

export function filterItems<T extends { date: string }>(
  items: T[],
  filter: ListFilter,
  matchKeyword: (item: T, kw: string) => boolean,
  matchStatus: (item: T, status: string) => boolean
): T[] {
  const range = getDateRange(filter);
  const kw = filter.keyword.trim().toLowerCase();
  return items.filter((item) => {
    if (kw && !matchKeyword(item, kw)) return false;
    if (range && (item.date < range.from || item.date > range.to)) return false;
    if (filter.status !== 'all' && !matchStatus(item, filter.status)) return false;
    return true;
  });
}

export function filterItemsIgnoreStatus<T extends { date: string }>(
  items: T[],
  filter: ListFilter,
  matchKeyword: (item: T, kw: string) => boolean
): T[] {
  const range = getDateRange(filter);
  const kw = filter.keyword.trim().toLowerCase();
  return items.filter((item) => {
    if (kw && !matchKeyword(item, kw)) return false;
    if (range && (item.date < range.from || item.date > range.to)) return false;
    return true;
  });
}

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}