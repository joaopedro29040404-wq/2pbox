import { getAdminSupabase } from './supabase-admin';

const BUCKET = 'print-files';
const PENDING_PREFIX = 'pending';
const LIST_PAGE_SIZE = 100;
const MAX_DELETE_PER_RUN = 500;
const REFERENCE_BATCH_SIZE = 50;

type CleanupOptions = {
  retentionHours?: number;
  maxDelete?: number;
};

type CleanupResult = {
  scanned: number;
  eligible: number;
  referenced: number;
  deleted: number;
};

function objectTimestamp(value: { created_at?: string | null; updated_at?: string | null }) {
  const raw = value.updated_at || value.created_at || '';
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function dateFolderTimestamp(name: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(name)) return null;
  const timestamp = Date.parse(`${name}T00:00:00.000Z`);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export async function cleanupPendingPrintUploads(options: CleanupOptions = {}): Promise<CleanupResult> {
  const client = getAdminSupabase();
  if (!client) throw new Error('Storage não configurado.');

  const retentionHours = Math.max(24, Number(options.retentionHours || 30 * 24));
  const maxDelete = Math.max(1, Math.min(Number(options.maxDelete || MAX_DELETE_PER_RUN), 1000));
  const cutoff = Date.now() - retentionHours * 60 * 60 * 1000;
  const result: CleanupResult = { scanned: 0, eligible: 0, referenced: 0, deleted: 0 };

  const { data: folders, error: folderError } = await client.storage.from(BUCKET).list(PENDING_PREFIX, {
    limit: 1000,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (folderError) throw new Error(`Falha ao listar uploads pendentes: ${folderError.message}`);

  const candidates: string[] = [];

  for (const folder of folders || []) {
    if (candidates.length >= maxDelete) break;

    const folderStart = dateFolderTimestamp(folder.name);
    if (folderStart == null || folderStart > cutoff) continue;

    let offset = 0;
    while (candidates.length < maxDelete) {
      const prefix = `${PENDING_PREFIX}/${folder.name}`;
      const { data: objects, error } = await client.storage.from(BUCKET).list(prefix, {
        limit: LIST_PAGE_SIZE,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error) throw new Error(`Falha ao listar ${prefix}: ${error.message}`);

      const rows = objects || [];
      result.scanned += rows.length;

      for (const object of rows) {
        if (candidates.length >= maxDelete) break;
        if (!object.id) continue;

        const timestamp = objectTimestamp(object);
        if (timestamp == null || timestamp > cutoff) continue;

        candidates.push(`${prefix}/${object.name}`);
      }

      if (rows.length < LIST_PAGE_SIZE) break;
      offset += LIST_PAGE_SIZE;
    }
  }

  result.eligible = candidates.length;
  if (!candidates.length) return result;

  const referenced = new Set<string>();
  for (let index = 0; index < candidates.length; index += REFERENCE_BATCH_SIZE) {
    const batch = candidates.slice(index, index + REFERENCE_BATCH_SIZE);
    const { data, error } = await client.from('print_files').select('storage_path').in('storage_path', batch);
    if (error) {
      // Fail closed: se não conseguimos provar que um arquivo é órfão, nada é apagado.
      throw new Error(`Falha ao validar referências de impressão: ${error.message}`);
    }
    for (const row of data || []) {
      if (row.storage_path) referenced.add(String(row.storage_path));
    }
  }

  result.referenced = referenced.size;
  const orphaned = candidates.filter((path) => !referenced.has(path));
  if (!orphaned.length) return result;

  for (let index = 0; index < orphaned.length; index += 100) {
    const batch = orphaned.slice(index, index + 100);
    const { data, error } = await client.storage.from(BUCKET).remove(batch);
    if (error) throw new Error(`Falha ao remover uploads órfãos: ${error.message}`);
    result.deleted += Array.isArray(data) ? data.length : batch.length;
  }

  return result;
}
