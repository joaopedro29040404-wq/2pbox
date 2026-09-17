'use client';

import { useEffect, useMemo, useState } from 'react';
import { Ban, Check, Smartphone, Monitor, Tablet, X } from 'lucide-react';
import { usePathname } from 'next/navigation';

const SESSION_KEY = '2p-analytics-session';

type Device = { session_id: string; device_type: string; last_seen?: string; source?: string | null };
type ExcludedDevice = { session_id: string; label?: string | null; excluded_at: string };

const deviceLabel = (type: string) => type === 'mobile' ? 'Celular' : type === 'tablet' ? 'Tablet' : type === 'desktop' ? 'Computador' : 'Outro';
const DeviceIcon = ({ type }: { type: string }) => type === 'mobile' ? <Smartphone size={15} /> : type === 'tablet' ? <Tablet size={15} /> : <Monitor size={15} />;

export default function AnalyticsDeviceExclusion() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [currentId, setCurrentId] = useState('');
  const [excluded, setExcluded] = useState<ExcludedDevice[]>([]);
  const [detected, setDetected] = useState<Device[]>([]);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    try {
      const id = localStorage.getItem(SESSION_KEY) || '';
      setCurrentId(id);
      const response = await fetch(`/api/admin/analytics/devices?session_id=${encodeURIComponent(id)}`, { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      setExcluded(data.excluded_devices || []);
      setDetected(data.detected_devices || []);
    } catch {}
  };

  useEffect(() => { if (pathname === '/admin/analytics') void load(); }, [pathname]);

  const currentExcluded = useMemo(() => excluded.some((item) => item.session_id === currentId), [excluded, currentId]);

  async function toggle(sessionId: string, action: 'exclude' | 'include', deviceLabelText?: string) {
    setBusy(sessionId);
    try {
      const response = await fetch('/api/admin/analytics/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, action, label: deviceLabelText || null }),
      });
      if (!response.ok) throw new Error();
      await load();
    } catch {} finally { setBusy(null); }
  }

  if (pathname !== '/admin/analytics') return null;

  const allDetected = detected.filter((device) => !excluded.some((item) => item.session_id === device.session_id));

  return (
    <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 80, width: 'min(390px, calc(100vw - 36px))', background: '#fff', border: '1px solid #ddd', borderRadius: 16, boxShadow: '0 12px 35px rgba(0,0,0,.16)', overflow: 'hidden' }}>
      {!open ? (
        <button onClick={() => setOpen(true)} style={{ width: '100%', border: 0, background: '#111', color: '#fff', padding: '13px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontWeight: 800, fontSize: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Ban size={15} /> Controle de dispositivos</span>
          <span>{excluded.length} excluído(s)</span>
        </button>
      ) : (
        <div>
          <div style={{ padding: '13px 15px', background: '#111', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div><strong style={{ fontSize: 12 }}>Dispositivos excluídos</strong><div style={{ fontSize: 10, opacity: .7, marginTop: 3 }}>Esses dispositivos não entram no Analytics.</div></div>
            <button onClick={() => setOpen(false)} aria-label="Fechar" style={{ border: 0, background: 'transparent', color: '#fff', cursor: 'pointer' }}><X size={17} /></button>
          </div>
          <div style={{ padding: 14, maxHeight: 'min(62vh, 520px)', overflowY: 'auto' }}>
            <div style={{ border: '1px solid #e4e4e0', borderRadius: 12, padding: 11, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <div><strong style={{ fontSize: 12 }}>Este dispositivo</strong><div style={{ color: '#777', fontSize: 10, marginTop: 3 }}>{currentExcluded ? 'Já está excluído' : 'Ainda contabilizado'}</div></div>
                <button disabled={!currentId || busy === currentId} onClick={() => void toggle(currentId, currentExcluded ? 'include' : 'exclude', label || 'Meu dispositivo')} style={{ border: 0, borderRadius: 9, padding: '8px 10px', background: currentExcluded ? '#eee' : '#111', color: currentExcluded ? '#111' : '#fff', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>
                  {busy === currentId ? 'Salvando...' : currentExcluded ? 'Incluir novamente' : 'Excluir este dispositivo'}
                </button>
              </div>
              {!currentExcluded && <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Nome opcional: Meu iPhone" style={{ width: '100%', marginTop: 9, border: '1px solid #ddd', borderRadius: 8, padding: 8, fontSize: 11 }} />}
            </div>

            {allDetected.length > 0 && <div style={{ marginBottom: 13 }}><strong style={{ fontSize: 11 }}>Outros dispositivos detectados</strong>{allDetected.slice(0, 12).map((device) => (
              <div key={device.session_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 0', borderBottom: '1px solid #eee' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800 }}><DeviceIcon type={device.device_type} />{deviceLabel(device.device_type)}</div>
                  <div style={{ color: '#777', fontSize: 9, marginTop: 2 }}>{device.last_seen ? new Date(device.last_seen).toLocaleString('pt-BR') : ''} · {device.session_id.slice(0, 8)}</div>
                </div>
                <button disabled={busy === device.session_id} onClick={() => void toggle(device.session_id, 'exclude', deviceLabel(device.device_type))} style={{ border: '1px solid #ddd', borderRadius: 8, background: '#fff', padding: '7px 8px', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}>{busy === device.session_id ? '...' : 'Excluir'}</button>
              </div>
            ))}</div>}

            {excluded.length > 0 && <div><strong style={{ fontSize: 11 }}>Já excluídos</strong>{excluded.map((device) => (
              <div key={device.session_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 0', borderBottom: '1px solid #eee' }}>
                <div><div style={{ fontSize: 11, fontWeight: 800 }}>{device.label || 'Dispositivo'}</div><div style={{ color: '#777', fontSize: 9 }}>{device.session_id.slice(0, 8)} · {new Date(device.excluded_at).toLocaleString('pt-BR')}</div></div>
                <button disabled={busy === device.session_id} onClick={() => void toggle(device.session_id, 'include')} style={{ border: 0, borderRadius: 8, background: '#eee', padding: '7px 8px', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}>{busy === device.session_id ? '...' : <Check size={13} />}</button>
              </div>
            ))}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
