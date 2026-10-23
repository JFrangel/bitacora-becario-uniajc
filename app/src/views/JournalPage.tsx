import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { JournalDto } from '../../convex/lib/journalDto';
import { useSession } from '../audience';
import { useBoardData } from '../data/useBoardData';
import { errorMessage } from '../convexClient';
import { BadgeColumn } from '../features/profile/BadgeColumn';
import { exportBackup, parseBackup } from '../features/journal/backup';
import type { ExportEntry } from '../features/journal/backup';
import { EntryPanel } from '../features/journal/EntryPanel';
import type { EntrySubmit } from '../features/journal/EntryPanel';
import type { PendingPhoto, SavedPhoto } from '../features/journal/entryForm';
import { compressImage } from '../features/journal/images';
import { Journal } from '../features/journal/Journal';
import { ConfirmDialog } from '../shell/ConfirmDialog';
import { useToast } from '../shell/Toast';
import { useToday } from '../lib/useToday';
import { Placeholder } from './Placeholder';

const MAX_COPY_BYTES = 30 * 1024 * 1024;
const RESTORE_BATCH = 50;

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const dataUrlToBlob = (dataUrl: string): Blob => {
  const [meta, body] = dataUrl.split(',', 2);
  const mime = /data:([^;]+)/.exec(meta)?.[1] ?? 'application/octet-stream';
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};

/** La Bitácora conectada: la dueña la escribe; el enlace de solo lectura (con Bitácora incluida) solo la mira. */
export function JournalPage({ badge }: { badge?: ReactNode }) {
  const { audience, shareToken, workspaceId } = useSession();
  const scope = workspaceId ? { workspaceId } : {};
  const viewer = audience === 'viewer';
  const toast = useToast();
  const today = useToday();
  const { projects } = useBoardData();

  const ownList = useQuery(api.journal.list, viewer ? 'skip' : scope);
  const ownSummary = useQuery(api.journal.summary, viewer ? 'skip' : scope);
  const shared = useQuery(api.viewer.journal, viewer ? { shareToken: shareToken! } : 'skip');
  const entries = (viewer ? shared?.entries : ownList) as JournalDto[] | undefined;
  const summary = viewer ? shared?.summary : ownSummary;

  const createManual = useMutation(api.journal.createManual);
  const update = useMutation(api.journal.update);
  const documentDraft = useMutation(api.journal.documentDraft);
  const remove = useMutation(api.journal.remove);
  const reorder = useMutation(api.journal.reorder);
  const restore = useMutation(api.journal.restore);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const [panel, setPanel] = useState<{ entry?: JournalDto } | null>(null);
  const [pendingCopy, setPendingCopy] = useState<{ entries: ReturnType<typeof parseBackup>['entries']; skippedDrafts: number } | null>(null);

  if (!entries || !summary) return <Placeholder tab="journal" />;

  const post = async (blob: Blob): Promise<string> => {
    const url = await generateUploadUrl(scope);
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': blob.type || 'image/jpeg' }, body: blob });
    if (!response.ok) throw new Error('upload');
    return ((await response.json()) as { storageId: string }).storageId;
  };

  const upload = async (pending: PendingPhoto[]): Promise<SavedPhoto[]> => {
    const saved: SavedPhoto[] = [];
    for (const photo of pending) {
      saved.push({ storageId: await post(photo.full), thumbStorageId: await post(photo.thumb), name: photo.name });
    }
    return saved;
  };

  const submit = async ({ mode, id, fields }: EntrySubmit) => {
    const typed = fields as never;
    if (mode === 'create') await createManual({ ...scope, fields: typed });
    else if (mode === 'document') await documentDraft({ ...scope, id: id as Id<'journalEntries'>, fields: typed });
    else await update({ ...scope, id: id as Id<'journalEntries'>, fields: typed });
  };

  const download = async () => {
    try {
      const rows: ExportEntry[] = await Promise.all(
        entries
          .filter((entry) => !entry.isDraft)
          .map(async (entry) => ({
            id: entry.id,
            date: entry.date,
            hours: entry.hours ?? null,
            project: entry.projectName,
            activity: entry.activity,
            objective: entry.objective,
            development: entry.development,
            result: entry.result ?? '',
            observations: entry.observations,
            status: entry.activityStatus,
            docStatus: entry.docStatus,
            taskTitle: entry.taskTitle,
            links: entry.links,
            photos: await Promise.all(entry.photos.filter((p) => p.url).map(async (p) => ({ name: p.name, dataUrl: await blobToDataUrl(await (await fetch(p.url!)).blob()) }))),
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
          })),
      );
      if (rows.length === 0) {
        toast('Aún no hay registros para descargar.');
        return;
      }
      const blob = new Blob([exportBackup(rows)], { type: 'application/json' });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = `bitacora-${today}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
      toast('Copia descargada con imágenes y enlaces.');
    } catch {
      toast('No se pudo crear la copia. Intenta con menos imágenes.');
    }
  };

  const readCopy = async (file: File) => {
    try {
      if (file.size > MAX_COPY_BYTES) throw new Error('La copia supera el límite de 30 MB.');
      setPendingCopy(parseBackup(await file.text()));
    } catch (error) {
      toast((error as Error).message || 'No se pudo restaurar esta copia.');
    }
  };

  const applyCopy = async () => {
    if (!pendingCopy) return;
    const { entries: copy, skippedDrafts } = pendingCopy;
    setPendingCopy(null);
    try {
      const prepared = [];
      for (const item of copy) {
        const photos: Array<{ storageId: Id<'_storage'>; thumbStorageId?: Id<'_storage'>; name: string }> = [];
        const links = [...item.links];
        for (const photo of item.photos) {
          if (!photo.dataUrl) {
            // Una imagen que solo tiene dirección web (copias antiguas) se conserva como enlace de evidencia.
            if (photo.url && links.length < 12) links.push({ label: photo.name, url: photo.url });
            continue;
          }
          const blob = dataUrlToBlob(photo.dataUrl);
          const { full, thumb } = await compressImage(new File([blob], photo.name, { type: blob.type }));
          photos.push({ storageId: (await post(full)) as Id<'_storage'>, thumbStorageId: (await post(thumb)) as Id<'_storage'>, name: photo.name });
        }
        prepared.push({
          legacyId: item.legacyId,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          fields: {
            date: item.date,
            hours: String(item.hours),
            projectName: item.projectName,
            activity: item.activity,
            ...(item.objective ? { objective: item.objective } : {}),
            ...(item.development ? { development: item.development } : {}),
            result: item.result,
            ...(item.observations ? { observations: item.observations } : {}),
            activityStatus: item.activityStatus,
            links,
            photos,
          },
        });
      }
      for (let i = 0; i < prepared.length; i += RESTORE_BATCH) await restore({ ...scope, entries: prepared.slice(i, i + RESTORE_BATCH) });
      toast(`Copia restaurada: ${prepared.length} registros${skippedDrafts ? ` (${skippedDrafts} borradores no se restauran)` : ''}.`);
    } catch (error) {
      toast(errorMessage(error) ?? 'No se pudo restaurar esta copia.');
    }
  };

  return (
    <>
      <Journal
        entries={entries}
        summary={summary}
        projects={projects}
        readOnly={viewer}
        badge={badge ?? <BadgeColumn />}
        onNew={() => setPanel({})}
        onEdit={(entry) => setPanel({ entry })}
        onReorder={(date, ids) => {
          void reorder({ ...scope, date, orderedIds: ids as Id<'journalEntries'>[] })
            .then(() => toast('Orden del día guardado.'))
            .catch((error) => toast(errorMessage(error) ?? 'No se pudo guardar el orden.'));
        }}
        onExport={() => void download()}
        onImport={(file) => void readCopy(file)}
      />
      {!viewer && (
        <EntryPanel
          open={panel !== null}
          entry={panel?.entry}
          today={today}
          projects={projects}
          onClose={() => setPanel(null)}
          upload={upload}
          onSubmit={submit}
          onDelete={async (id) => {
            await remove({ ...scope, id: id as Id<'journalEntries'> });
          }}
        />
      )}
      {pendingCopy && (
        <ConfirmDialog
          title="¿Restaurar esta copia?"
          text={`Se agregarán o actualizarán ${pendingCopy.entries.length} registros de la copia. Los que ya existen no se duplican.`}
          confirmLabel="Restaurar"
          onConfirm={() => void applyCopy()}
          onCancel={() => setPendingCopy(null)}
        />
      )}
    </>
  );
}
