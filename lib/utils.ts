import { type ClassValue, clsx } from 'clsx';
import { differenceInCalendarDays, parseISO, format } from 'date-fns';
import type { BidStatus } from './types';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function getDaysLeft(dueDateStr: string | null): number | null {
  if (!dueDateStr) return null;
  try {
    const due = parseISO(dueDateStr);
    return differenceInCalendarDays(due, new Date());
  } catch {
    return null;
  }
}

export function formatDate(dateStr: string | null, fmt = 'MMM d, yyyy'): string {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), fmt);
  } catch {
    return dateStr;
  }
}

export function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export const STATUS_COLORS: Record<BidStatus, { bg: string; text: string; border?: string }> = {
  New:       { bg: 'bg-blue-50',   text: 'text-navy-600' },
  Reviewing: { bg: 'bg-cyan-50',   text: 'text-cyan-800' },
  Active:    { bg: 'bg-green-50',  text: 'text-green-800' },
  Submitted: { bg: 'bg-yellow-50', text: 'text-yellow-800' },
  Won:       { bg: 'bg-green-500', text: 'text-white' },
  Lost:      { bg: 'bg-gray-500',  text: 'text-white' },
  Declined:  { bg: 'bg-gray-100',  text: 'text-gray-500', border: 'border border-gray-300' },
  Expired:   { bg: 'bg-gray-100',  text: 'text-gray-400' },
};

export const URGENCY_COLORS = {
  today:    'bg-red-600 text-white animate-pulse',
  critical: 'bg-red-600 text-white',
  warning:  'bg-orange-500 text-white',
  week:     'bg-yellow-400 text-gray-800',
  ok:       'bg-green-50 text-green-800 border border-green-200',
  expired:  'bg-gray-100 text-gray-400',
  unknown:  'bg-gray-100 text-gray-400',
};

export function getUrgencyClass(days: number | null): string {
  if (days === null) return URGENCY_COLORS.unknown;
  if (days < 0)  return URGENCY_COLORS.expired;
  if (days === 0) return URGENCY_COLORS.today;
  if (days === 1) return URGENCY_COLORS.critical;
  if (days <= 3)  return URGENCY_COLORS.critical;
  if (days <= 7)  return URGENCY_COLORS.week;
  return URGENCY_COLORS.ok;
}

export function getUrgencyLabel(days: number | null): string {
  if (days === null) return 'No Date';
  if (days < 0) return 'Expired';
  if (days === 0) return 'TODAY';
  if (days === 1) return 'Tomorrow';
  return `${days} days`;
}

export const TRADES = [
  'Concrete', 'Earthwork', 'Asphalt', 'Paving', 'Grading',
  'Drainage', 'Utilities', 'Masonry', 'MEP', 'Sitework',
  'Renovation', 'Landscaping', 'Structural Steel', 'Striping',
] as const;

export const BID_STATUSES: BidStatus[] = [
  'New', 'Reviewing', 'Active', 'Submitted', 'Won', 'Lost', 'Declined', 'Expired',
];
