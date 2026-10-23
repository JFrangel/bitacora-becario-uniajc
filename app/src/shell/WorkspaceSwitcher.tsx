import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { WorkspaceSummary } from '../../convex/lib/workspaces';
import { errorMessage } from '../convexClient';
import { hrefForWorkspace, navigate } from '../router';
import type { Tab } from '../router';
import { ConfirmDialog } from './ConfirmDialog';
import { Panel } from './Panel';

type WorkspaceSwitcherProps = {
  workspaces: WorkspaceSummary[];
  activeWorkspace?: WorkspaceSummary;
  activeTab: Tab;
  showCreateLabel?: boolean;
};

/** Cambia entre Bitácoras propias y compartidas, o crea un espacio independiente. */
export function WorkspaceSwitcher({ workspaces, activeWorkspace, activeTab, showCreateLabel = false }: WorkspaceSwitcherProps) {
  const createWorkspace = useMutation(api.workspaces.create);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const renameWorkspace = useMutation(api.workspaces.rename);
  const removeWorkspace = useMutation(api.workspaces.remove);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageName, setManageName] = useState('');
  const [manageError, setManageError] = useState('');
  const [manageBusy, setManageBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const switchTo = (workspace: WorkspaceSummary) => {
    navigate(hrefForWorkspace(activeTab, workspace.id, workspace.isInitial));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const id = await createWorkspace({ name });
      setOpen(false);
      setName('');
      navigate(hrefForWorkspace('board', id));
    } catch (cause) {
      setError(errorMessage(cause) ?? 'No se pudo crear la Bitácora. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const manageable = activeWorkspace?.role === 'owner' ? activeWorkspace : undefined;

  const openManage = () => {
    if (!manageable) return;
    setManageName(manageable.name);
    setManageError('');
    setManageOpen(true);
  };

  const saveName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!manageable) return;
    setManageError('');
    setManageBusy(true);
    try {
      await renameWorkspace({ workspaceId: manageable.id, name: manageName });
      setManageOpen(false);
    } catch (cause) {
      setManageError(errorMessage(cause) ?? 'No se pudo guardar el nombre. Inténtalo de nuevo.');
    } finally {
      setManageBusy(false);
    }
  };

  const deleteWorkspace = async () => {
    if (!manageable) return;
    setManageError('');
    setManageBusy(true);
    try {
      await removeWorkspace({ workspaceId: manageable.id });
      const next = workspaces.find((workspace) => workspace.id !== manageable.id && workspace.isInitial) ?? workspaces.find((workspace) => workspace.id !== manageable.id);
      setConfirming(false);
      setManageOpen(false);
      navigate(hrefForWorkspace('board', next?.id, next?.isInitial));
    } catch (cause) {
      setConfirming(false);
      setManageError(errorMessage(cause) ?? 'No se pudo eliminar la Bitácora. Inténtalo de nuevo.');
    } finally {
      setManageBusy(false);
    }
  };

  const owned = workspaces.filter((workspace) => workspace.role === 'owner');
  const shared = workspaces.filter((workspace) => workspace.role !== 'owner');

  return (
    <div className="workspace-switcher">
      <select
        aria-label="Cambiar de Bitácora"
        value={activeWorkspace?.id ?? ''}
        hidden={!activeWorkspace}
        onChange={(event) => {
          const next = workspaces.find((workspace) => workspace.id === event.target.value);
          if (next) switchTo(next);
        }}
      >
        {owned.length > 0 && (
          <optgroup label="Mis Bitácoras">
            {owned.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
          </optgroup>
        )}
        {shared.length > 0 && (
          <optgroup label="Compartidas conmigo">
            {shared.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name} · {workspace.ownerName}</option>)}
          </optgroup>
        )}
      </select>
      {manageable && (
        <button className="workspace-add" type="button" aria-label="Editar Bitácora" title="Editar Bitácora" onClick={openManage}>
          <span aria-hidden="true">✎</span>
        </button>
      )}
      <button className={`workspace-add${showCreateLabel ? ' workspace-create-button' : ''}`} type="button" aria-label="Crear Bitácora" title="Crear Bitácora" onClick={() => { setError(''); setOpen(true); }}>
        {showCreateLabel && <span className="workspace-add-label">Nueva Bitácora</span>}
        <span aria-hidden="true">+</span>
      </button>
      <Panel open={manageOpen} onClose={() => { if (!confirming) setManageOpen(false); }} title="Editar Bitácora" className="workspace-panel">
        <form className="fill-form workspace-create" onSubmit={(event) => void saveName(event)}>
          <label>
            <span className="lbl">Nombre</span>
            <input data-autofocus maxLength={60} value={manageName} onChange={(event) => setManageName(event.target.value)} required />
          </label>
          <p className="form-error" role="alert">{manageError}</p>
          <button className="fill primary wide" type="submit" disabled={manageBusy || manageName.trim().length < 2 || manageName.trim() === manageable?.name}>
            {manageBusy ? 'Guardando…' : 'Guardar nombre'}
          </button>
          {manageable?.isInitial ? (
            <p className="hint">La Bitácora principal no se puede eliminar.</p>
          ) : (
            <button type="button" className="ghost danger" disabled={manageBusy} onClick={() => setConfirming(true)}>
              Eliminar Bitácora
            </button>
          )}
        </form>
        {confirming && manageable && (
          <ConfirmDialog
            title={`¿Eliminar «${manageable.name}»?`}
            text="Se quita esta Bitácora y el acceso de las personas con quienes la compartes. Solo se puede si no tiene tareas ni registros. Esta acción es permanente."
            confirmLabel="Eliminar para siempre"
            busy={manageBusy}
            onConfirm={() => void deleteWorkspace()}
            onCancel={() => setConfirming(false)}
          />
        )}
      </Panel>
      <Panel open={open} onClose={() => setOpen(false)} title="Nueva Bitácora" className="workspace-panel">
        <form className="fill-form workspace-create" onSubmit={(event) => void submit(event)}>
          <label>
            <span className="lbl">Nombre</span>
            <input autoFocus data-autofocus maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre del espacio" required />
          </label>
          <p className="form-error" role="alert">{error}</p>
          <button className="fill primary wide" type="submit" disabled={busy || name.trim().length < 2}>
            {busy ? 'Creando…' : 'Crear Bitácora'}
          </button>
        </form>
      </Panel>
    </div>
  );
}
