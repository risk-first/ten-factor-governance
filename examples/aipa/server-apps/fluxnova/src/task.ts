import { ordersFromContext } from '../../../common/src/contexts/types.ts';
import type { TaskSnapshot, TaskStatus } from './types.ts';

export function taskKey(task: { id?: { taskId?: string; processInstanceId?: string }; processInstanceId?: string }): string | undefined {
  return task.id?.taskId ?? task.id?.processInstanceId ?? task.processInstanceId;
}

export function formatWhen(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function statusLabel(status: TaskStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Denied';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
  }
}

export function outcomeClass(status: TaskStatus): string {
  if (status === 'approved' || status === 'completed') return 'outcome outcome--ok';
  if (status === 'pending') return 'outcome';
  return 'outcome outcome--fail';
}

export function badgeClass(status: TaskStatus): string {
  if (status === 'approved' || status === 'completed') return 'badge badge--ok';
  if (status === 'pending') return 'badge badge--pending';
  return 'badge badge--fail';
}

export function summarizeTask(task: TaskSnapshot): string {
  if (task.orderSummary?.trim()) return task.orderSummary.trim();
  const approval = task.approval;
  const context = approval?.subject?.context;
  const orders = ordersFromContext(context);
  if (orders.length === 1) {
    const order = orders[0];
    const ticker = order.instrument?.id?.ticker ?? '';
    return `${order.side} ${order.quantity} ${ticker}`.trim();
  }
  if (orders.length > 1) return `${orders.length} order legs`;
  return task.name?.trim() || 'Untitled task';
}

export function actionLabel(task: TaskSnapshot): string {
  const subject = task.approval?.subject;
  if (!subject) return '—';
  if (subject.action === 'broadcast') {
    return subject.channelId ? `broadcast · ${subject.channelId}` : 'broadcast';
  }
  const intent = subject.intent ?? 'raiseIntent';
  const appId = subject.app?.appId;
  return appId ? `${intent} → ${appId}` : intent;
}
