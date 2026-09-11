'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import { InlineLoader } from '@/components/ui/loader';

export type AddressValue = {
  line: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  zip: string;
  placeId: string | null;
  lat: number | null;
  lng: number | null;
};

type Suggestion = { placeId: string; label: string; secondary: string };

type Props = {
  label?: string;
  hint?: string;
  value: AddressValue;
  onChange: (value: AddressValue) => void;
  onUnavailable?: (unavailable: boolean) => void;
};

const DEBOUNCE_MS = 350;

export function AddressAutocomplete({ label = 'Endereço', hint, value, onChange, onUnavailable }: Props) {
  const [term, setTerm] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const session = useRef(Math.random().toString(36).slice(2));
  const wrap = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (available === null) return;
    onUnavailable?.(!available);
  }, [available, onUnavailable]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    const query = term.trim();
    if (query.length < 4) {
      setSuggestions([]);
      return;
    }

    let active = true;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/enderecos?q=${encodeURIComponent(query)}&session=${session.current}`, { cache: 'no-store' });
        const data = await response.json();
        if (!active) return;
        setAvailable(Boolean(data?.available));
        setError(data?.error ? String(data.error) : '');
        setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []);
        setOpen(true);
      } catch {
        if (active) setError('Não foi possível buscar o endereço agora.');
      } finally {
        if (active) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [term]);

  const select = useCallback(
    async (suggestion: Suggestion) => {
      setOpen(false);
      setLoading(true);
      try {
        const response = await fetch(`/api/enderecos?placeId=${encodeURIComponent(suggestion.placeId)}&session=${session.current}`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || !data?.address) throw new Error(data?.error || 'Endereço não encontrado.');
        const address = data.address;
        onChange({
          line: address.street || suggestion.label,
          number: address.number || '',
          complement: value.complement,
          district: address.district || '',
          city: address.city || '',
          state: address.state || '',
          zip: address.zip || '',
          placeId: address.placeId || suggestion.placeId,
          lat: address.lat ?? null,
          lng: address.lng ?? null,
        });
        setTerm('');
        session.current = Math.random().toString(36).slice(2);
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : 'Endereço não encontrado.');
      } finally {
        setLoading(false);
      }
    },
    [onChange, value.complement],
  );

  const filled = Boolean(value.line || value.city);

  return (
    <div className="addr" ref={wrap}>
      <label className="addr-label">
        <MapPin size={15} /> {label}
      </label>

      {available === false ? (
        <p className="addr-manual">A busca do Google não está ativa neste ambiente. Preencha o endereço nos campos abaixo.</p>
      ) : (
        <div className="addr-search">
          <Search size={16} />
          <input
            type="text"
            value={term}
            placeholder={filled ? 'Buscar outro endereço...' : 'Digite rua e número'}
            onChange={(event) => setTerm(event.target.value)}
            onFocus={() => suggestions.length && setOpen(true)}
            autoComplete="off"
          />
          {loading && <InlineLoader />}
          {!loading && term && (
            <button type="button" onClick={() => setTerm('')} aria-label="Limpar busca">
              <X size={15} />
            </button>
          )}

          {open && suggestions.length > 0 && (
            <ul className="addr-list">
              {suggestions.map((suggestion) => (
                <li key={suggestion.placeId}>
                  <button type="button" onClick={() => void select(suggestion)}>
                    <strong>{suggestion.label}</strong>
                    <span>{suggestion.secondary}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {hint && !error && <small className="addr-hint">{hint}</small>}
      {error && <small className="addr-error">{error}</small>}

      {filled && value.lat != null && (
        <p className="addr-selected">
          <MapPin size={13} /> {value.line}
          {value.number ? `, ${value.number}` : ''}. {value.district ? `${value.district}, ` : ''}
          {value.city}/{value.state}
        </p>
      )}

      <style jsx>{`
        .addr{grid-column:1/-1;display:grid;gap:8px;position:relative}
        .addr-label{display:flex;align-items:center;gap:7px;font:800 10px Inter,Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#555}
        .addr-search{position:relative;display:flex;align-items:center;gap:9px;padding:0 13px;min-height:50px;border:1px solid #dcdcd6;border-radius:10px;background:#fff}
        .addr-search:focus-within{border-color:#111}
        .addr-search svg{flex:none;color:#8a8a86}
        .addr-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;font:500 13.5px Inter,Arial,sans-serif;color:#111}
        .addr-search > button{display:grid;place-items:center;width:26px;height:26px;flex:none;border:0;border-radius:50%;background:#f2f2ef;color:#666;cursor:pointer}
        .addr-list{position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:30;margin:0;padding:6px;list-style:none;background:#fff;border:1px solid #e0e0da;border-radius:12px;box-shadow:0 18px 44px rgba(0,0,0,.13);max-height:290px;overflow-y:auto}
        .addr-list button{display:grid;gap:3px;width:100%;padding:11px 12px;border:0;border-radius:8px;background:transparent;text-align:left;cursor:pointer}
        .addr-list button:hover{background:#faf8ef}
        .addr-list strong{font:800 13px Inter,Arial,sans-serif;color:#111}
        .addr-list span{font:400 11.5px Inter,Arial,sans-serif;color:#8a8a86}
        .addr-manual{margin:0;padding:12px 14px;background:#fff9d9;border:1px solid #f0d65b;border-radius:10px;font-size:12px;line-height:1.5;color:#5c5000}
        .addr-hint,.addr-error{font-size:11px;line-height:1.45}
        .addr-hint{color:#8a8a86}
        .addr-error{color:#c62828}
        .addr-selected{display:flex;align-items:center;gap:6px;margin:0;font:700 12px Inter,Arial,sans-serif;color:#3f7a4d}
      `}</style>
    </div>
  );
}
