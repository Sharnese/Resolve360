import React, { useEffect, useRef, useState } from 'react';
import { Bell, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Link } from 'react-router-dom';

interface AlertRow {
  id: string;
  title: string | null;
  message: string | null;
  is_read: boolean | null;
  created_at: string;
  request_id: string | null;
  trigger: string;
}

const NotificationsBell: React.FC = () => {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!user) return;
    let query = supabase
      .from('notifications')
      .select('id, title, message, is_read, created_at, request_id, trigger')
      .order('created_at', { ascending: false })
      .limit(15);
    if (profile?.role === 'admin') {
      query = query.eq('role_target', 'admin');
    } else {
      query = query.eq('user_id', user.id);
    }
    const { data } = await query;
    setAlerts((data || []).filter((r) => r.title));
  };

  useEffect(() => {
    if (!user) return;
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!user) return null;

  const unread = alerts.filter((a) => !a.is_read).length;

  const markAllRead = async () => {
    const ids = alerts.filter((a) => !a.is_read).map((a) => a.id);
    if (!ids.length) return;
    await supabase.from('notifications').update({ is_read: true }).in('id', ids);
    load();
  };

  const linkFor = (a: AlertRow) => {
    if (!a.request_id) return null;
    return profile?.role === 'admin' ? `/admin/request/${a.request_id}` : `/portal/request/${a.request_id}`;
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 rounded-lg border border-[#C9A961]/40 text-[#F5EFE0] hover:bg-[#D4AF37]/10 flex items-center justify-center transition"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#D4AF37] text-[10px] font-bold text-black flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-xl border border-[#C0C0C0]/40 shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#C0C0C0]/40 bg-[#FAF6EC]">
            <p className="text-sm font-semibold text-black">Notifications</p>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-[#A8871F] hover:text-[#D4AF37] inline-flex items-center gap-1">
                <Check className="w-3 h-3" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {alerts.length === 0 ? (
              <p className="px-4 py-6 text-sm text-black/60 text-center">No notifications yet.</p>
            ) : (
              alerts.map((a) => {
                const href = linkFor(a);
                const Body = (
                  <div className={`px-4 py-3 border-b border-[#C0C0C0]/30 hover:bg-[#FAF6EC] transition ${!a.is_read ? 'bg-[#D4AF37]/5' : ''}`}>
                    <div className="flex items-start gap-2">
                      {!a.is_read && <span className="w-2 h-2 rounded-full bg-[#D4AF37] mt-1.5 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-black truncate">{a.title}</p>
                        {a.message && <p className="text-xs text-black/60 line-clamp-2 mt-0.5">{a.message}</p>}
                        <p className="text-[11px] text-black/40 mt-1">{new Date(a.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                );
                return href ? (
                  <Link key={a.id} to={href} onClick={() => setOpen(false)}>{Body}</Link>
                ) : (
                  <div key={a.id}>{Body}</div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsBell;
