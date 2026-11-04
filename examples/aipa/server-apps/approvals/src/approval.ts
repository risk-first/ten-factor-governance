import { CONTEXT_TYPES, ordersFromContext } from '../../../common/src/contexts/types.ts';
import type { Context } from '@finos/fdc3';

export type ApprovalRecord = {
  type: 'fdc3.approval';
  id: { requestId?: string; approvalId?: string };
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  subject?: {
    type?: string;
    action?: string;
    intent?: string;
    context?: Context;
    app?: { appId?: string };
  };
  updatedAt?: string;
};

export const VIEW_APP_ID = 'aipa-approval-view';

export function keyOf(approval: { id?: { requestId?: string; approvalId?: string } }): string | undefined {
  return approval.id?.approvalId ?? approval.id?.requestId;
}

export function sameApproval(
  a: { id?: { requestId?: string; approvalId?: string } },
  b: { id?: { requestId?: string; approvalId?: string } }
): boolean {
  if (a.id?.approvalId && b.id?.approvalId && a.id.approvalId === b.id.approvalId) return true;
  if (a.id?.requestId && b.id?.requestId && a.id.requestId === b.id.requestId) return true;
  return false;
}

export function accept(incoming: ApprovalRecord): ApprovalRecord {
  const requestId = incoming.id?.requestId ?? crypto.randomUUID();
  const approvalId = incoming.id?.approvalId ?? crypto.randomUUID();
  return {
    ...incoming,
    type: CONTEXT_TYPES.approval,
    id: { requestId, approvalId },
    status: incoming.status ?? 'pending',
    updatedAt: incoming.updatedAt ?? new Date().toISOString(),
  };
}

export function summarizeSubject(record: ApprovalRecord): string {
  const intent = record.subject?.intent ?? 'action';
  const context = record.subject?.context;
  const orders = ordersFromContext(context);
  if (orders.length === 1) {
    const o = orders[0];
    const ticker = o.instrument?.id?.ticker ?? '';
    return `${intent} · ${o.side} ${o.quantity} ${ticker}`.trim();
  }
  if (orders.length > 1) {
    return `${intent} · ${orders.length} legs`;
  }
  const type = context && typeof context === 'object' ? (context as { type?: string }).type : undefined;
  return type ? `${intent} · ${type}` : intent;
}

export function formatWhen(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function statusLabel(status: ApprovalRecord['status']): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Denied';
    case 'cancelled':
      return 'Cancelled';
  }
}

export function outcomeClass(status: ApprovalRecord['status']): string {
  if (status === 'approved') return 'outcome outcome--ok';
  if (status === 'pending') return 'outcome';
  return 'outcome outcome--fail';
}
