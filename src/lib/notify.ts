import { supabase } from '@/lib/supabase';

export type NotifyTrigger =
  | 'account_created'
  | 'request_submitted'
  | 'proposal_sent'
  | 'contract_resubmitted'
  | 'contract_ready'
  | 'contract_signed'
  | 'contract_admin_signed'
  | 'contract_fully_executed'
  | 'contract_change_requested'
  | 'investigator_assigned'
  | 'documents_requested'
  | 'documents_uploaded'
  | 'contacts_added'
  | 'contact_edited'
  | 'contact_status_changed'
  | 'witness_statement_submitted'
  | 'witness_statement_completed'
  | 'investigation_complete'
  | 'status_changed';

export async function sendNotification(trigger: NotifyTrigger, requestId: string | null, extra?: Record<string, any>) {
  try {
    await supabase.functions.invoke('resolve360-notify', {
      body: { trigger, requestId, extra },
    });
  } catch (e) {
    console.error('Notification dispatch failed:', e);
  }
}
