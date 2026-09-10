'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, FolderTree, Plus, Power, Search, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SiteHeader } from '@/components/site-header';
import { SelectField, TextField } from '@/components/ui/field';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { InlineLoader } from '@/components/ui/loader';
import { useToast } from '@/components/ui/toast';

type Category = { id: string; name: string; description: string | null; active: boolean };

const PAGE_SIZE = 8;
const STATUS_OPTIONS = [
  { value: 'all', label: 'Todas' },
  { value: 'active', label: 'Ativas' },
  { value: 'inactive', label: 'Inativas' },
];

export default function CategoriesAdminPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  async function load() {
    if (!supabase) return;
    setLoading(true);
    const { data, error: loadError } = await supabase.from('categories').select('id,name,description,active').order('name');
    if (loadError) toast.error('Não foi possível carregar as categorias', loadError.message);
    setItems((data ?? []) as Category[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!supabase || saving) return;
    const cleanName = name.trim();
    if (!cleanName) return setError('Informe o nome da categoria.');
    if (items.some((item) => item.name.toLowerCase() === cleanName.toLowerCase())) return setError('Já existe uma categoria com esse nome.');

    setError('');
    setSaving(true);
    const slug =
      cleanName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') + `-${Date.now()}`;

    const { error: insertError } = await supabase.from('categories').insert({ name: cleanName, description: description.trim(), slug });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      toast.error('Não foi possível criar a categoria', insertError.message);
      return;
    }
    toast.success('Categoria criada', cleanName);
    setName('');
    setDescription('');
    load();
  }

  async function toggle(category: Category) {
    if (!supabase) return;
    const { error: toggleError } = await supabase.from('categories').update({ active: !category.active }).eq('id', category.id);
    if (toggleError) return toast.error('Não foi possível alterar a categoria', toggleError.message);
    toast.success(category.active ? 'Categoria desativada' : 'Categoria ativada', category.name);
    load();
  }

  async function remove(category: Category) {
    if (!supabase) return;
    if (!confirm(`Excluir a categoria "${category.name}"?`)) return;
    const { error: deleteError } = await supabase.from('categories').delete().eq('id', category.id);
    if (deleteError) return toast.error('Não foi possível excluir', deleteError.message);
    toast.success('Categoria excluída', category.name);
    load();
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery = !query || item.name.toLowerCase().includes(query) || (item.description || '').toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? item.active : !item.active);
      return matchesQuery && matchesStatus;
    });
  }, [items, search, statusFilter]);

  const { page, setPage, totalPages, pageItems, from, to, total } = usePagination(filtered, PAGE_SIZE, `${search}|${statusFilter}`);

  return (
    <main className="admin-categories">
      <SiteHeader variant="admin" subtitle="CATEGORIAS" />
      <section className="cat-content">
        <div className="cat-breadcrumb">
          <Link href="/admin">Painel</Link>
          <span>/</span>
          <strong>Categorias</strong>
        </div>

        <div className="cat-heading">
          <div>
            <p className="cat-kicker">CATÁLOGO</p>
            <h1>Categorias</h1>
            <span>Organize os produtos da loja por departamentos.</span>
          </div>
          <div className="cat-count">
            <strong>{items.length}</strong>
            <span>categorias</span>
          </div>
        </div>

        <div className="cat-layout">
          <form onSubmit={add} className="cat-create">
            <div className="cat-card-icon">
              <FolderTree size={20} />
            </div>
            <p className="cat-kicker">NOVA CATEGORIA</p>
            <h2>Adicionar categoria</h2>
            <p className="cat-help">Crie uma categoria clara e fácil de encontrar no catálogo.</p>
            <TextField label="Nome" required placeholder="Ex.: Eletrônicos" value={name} onValueChange={setName} error={error} fullWidth />
            <TextField label="Descrição" optional placeholder="Breve descrição" value={description} onValueChange={setDescription} fullWidth />
            <button className="cat-primary" type="submit" disabled={saving}>
              {saving ? <InlineLoader label="Criando..." /> : <><Plus size={17} /> Criar categoria</>}
            </button>
          </form>

          <div className="cat-list-card" id="lista-categorias">
            <div className="cat-list-head">
              <div>
                <p className="cat-kicker">CATÁLOGO</p>
                <h2>Categorias cadastradas</h2>
              </div>
              <span>{items.filter((item) => item.active).length} ativas</span>
            </div>

            <div className="cat-filters">
              <TextField
                aria-label="Buscar categoria"
                placeholder="Buscar categoria..."
                value={search}
                icon={<Search size={16} />}
                onValueChange={setSearch}
                fullWidth
              />
              <SelectField aria-label="Filtrar por status" value={statusFilter} options={STATUS_OPTIONS} onValueChange={setStatusFilter} />
            </div>

            {loading ? (
              <div className="cat-empty">
                <InlineLoader label="Carregando categorias..." />
              </div>
            ) : pageItems.length === 0 ? (
              <div className="cat-empty">
                <FolderTree size={30} />
                <strong>{items.length ? 'Nenhuma categoria encontrada' : 'Nenhuma categoria'}</strong>
                <span>{items.length ? 'Ajuste a busca ou o filtro.' : 'Crie a primeira categoria ao lado.'}</span>
              </div>
            ) : (
              <>
                <div className="cat-list">
                  {pageItems.map((category) => (
                    <article className={`cat-item ${category.active ? '' : 'inactive'}`} key={category.id}>
                      <div className="cat-item-icon">
                        <FolderTree size={18} />
                      </div>
                      <div className="cat-item-copy">
                        <h3>{category.name}</h3>
                        <p>{category.description || 'Sem descrição cadastrada.'}</p>
                        <span>
                          <i className={category.active ? 'on' : ''} />
                          {category.active ? 'Ativa na loja' : 'Inativa'}
                        </span>
                      </div>
                      <div className="cat-actions">
                        <button type="button" onClick={() => toggle(category)} title={category.active ? 'Desativar' : 'Ativar'}>
                          {category.active ? <Power size={15} /> : <Check size={15} />}
                        </button>
                        <button type="button" className="danger" onClick={() => remove(category)} title="Excluir">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="cat-pagination">
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    from={from}
                    to={to}
                    total={total}
                    label="categorias"
                    scrollTargetId="lista-categorias"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <style jsx global>{`
        .admin-categories{min-height:100vh;background:#f6f6f3;color:#111;font-family:Inter,Arial,sans-serif}
        .cat-content{width:min(1180px,calc(100% - 40px));margin:auto;padding:30px 0 70px}
        .cat-breadcrumb{display:flex;gap:8px;color:#777;font-size:12px;margin-bottom:26px}
        .cat-breadcrumb a{color:#555;text-decoration:none}
        .cat-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:26px}
        .cat-kicker{margin:0 0 8px;color:#a07800;font-size:10px;font-weight:900;letter-spacing:.2em}
        .cat-heading h1{margin:0;font-family:'Barlow Condensed';font-size:64px;line-height:.88;font-style:italic;text-transform:uppercase}
        .cat-heading>div:first-child>span{display:block;color:#777;font-size:13px;margin-top:12px}
        .cat-count{background:#fff;border:1px solid #e1e1dd;border-radius:12px;padding:11px 15px;display:flex;align-items:baseline;gap:7px;flex:none}
        .cat-count strong{font-size:22px}
        .cat-count span{font-size:10px;color:#777}
        .cat-layout{display:grid;grid-template-columns:330px minmax(0,1fr);gap:18px;align-items:start}
        .cat-create,.cat-list-card{background:#fff;border:1px solid #e1e1dd;border-radius:18px;box-shadow:0 5px 18px rgba(0,0,0,.025)}
        .cat-create{padding:21px;display:grid;gap:16px}
        .cat-card-icon{width:42px;height:42px;border-radius:11px;background:#ffc400;display:grid;place-items:center}
        .cat-create h2,.cat-list-head h2{font-family:'Barlow Condensed';text-transform:uppercase;font-size:26px;margin:0}
        .cat-create .cat-kicker,.cat-create h2{margin-bottom:0}
        .cat-help{color:#777;font-size:11px;line-height:1.5;margin:0}
        .cat-primary{width:100%;min-height:48px;border:0;border-radius:10px;background:#111;color:#fff;display:inline-flex;align-items:center;justify-content:center;gap:7px;font:800 12px Inter,Arial,sans-serif;cursor:pointer}
        .cat-primary:disabled{opacity:.6;cursor:wait}
        .cat-list-card{overflow:hidden}
        .cat-list-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:21px;border-bottom:1px solid #eee}
        .cat-list-head h2{font-size:25px}
        .cat-list-head>span{font-size:10px;color:#777;background:#f3f3ef;padding:7px 9px;border-radius:999px;font-weight:800;white-space:nowrap}
        .cat-filters{display:grid;grid-template-columns:minmax(0,1fr) 170px;gap:10px;padding:16px 21px;border-bottom:1px solid #f0f0ec}
        .cat-list{padding:10px 18px}
        .cat-item{display:flex;align-items:center;gap:12px;padding:14px 4px;border-bottom:1px solid #eee}
        .cat-item:last-child{border-bottom:0}
        .cat-item.inactive{opacity:.62}
        .cat-item-icon{width:38px;height:38px;border-radius:10px;background:#f2f2ee;display:grid;place-items:center;flex:none;color:#555}
        .cat-item-copy{min-width:0;flex:1}
        .cat-item-copy h3{margin:0 0 3px;font-size:14px}
        .cat-item-copy p{margin:0;color:#777;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .cat-item-copy span{display:flex;align-items:center;gap:5px;color:#888;font-size:9px;margin-top:6px}
        .cat-item-copy i{width:6px;height:6px;border-radius:50%;background:#aaa}
        .cat-item-copy i.on{background:#31a258}
        .cat-actions{display:flex;gap:6px;flex:none}
        .cat-actions button{width:34px;height:34px;border:0;border-radius:8px;background:#eee;display:grid;place-items:center;cursor:pointer}
        .cat-actions button.danger{color:#a22}
        .cat-pagination{padding:0 21px 18px}
        .cat-pagination .ui-pagination{margin-top:14px}
        .cat-empty{min-height:190px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:#888;font-size:11px;padding:24px}
        .cat-empty strong{color:#333}
        @media(max-width:900px){
          .cat-content{width:min(100% - 28px,800px)}
          .cat-layout{grid-template-columns:1fr}
          .cat-heading{align-items:flex-start}
          .cat-create{order:2}
          .cat-list-card{order:1}
        }
        @media(max-width:560px){
          .cat-heading{flex-direction:column;gap:12px}
          .cat-heading h1{font-size:52px}
          .cat-count{align-self:flex-start}
          .cat-list-head{align-items:flex-start;gap:10px}
          .cat-list-head h2{font-size:23px}
          .cat-filters{grid-template-columns:1fr;padding:14px 16px}
          .cat-list{padding:6px 14px}
          .cat-item{align-items:flex-start}
          .cat-item-copy p{white-space:normal;line-height:1.4}
          .cat-pagination{padding:0 16px 16px}
        }
      `}</style>
    </main>
  );
}
