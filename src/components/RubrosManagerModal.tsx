import React, { useState, useEffect } from 'react';
import { Rubro, StoreAttribute, StoreAttributeOption } from '../types';
import { subscribeRubros, saveRubro, deleteRubro } from '../services/db';

interface RubrosManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RubrosManagerModal: React.FC<RubrosManagerModalProps> = ({ isOpen, onClose }) => {
  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingRubro, setEditingRubro] = useState<Rubro | null>(null);

  // Form states for creating / editing
  const [name, setName] = useState('');
  const [active, setActive] = useState(true);

  // Attribute 1 states
  const [attr1Enabled, setAttr1Enabled] = useState(true);
  const [attr1Name, setAttr1Name] = useState('Color');
  const [attr1Type, setAttr1Type] = useState<'text' | 'color'>('color');
  const [attr1Options, setAttr1Options] = useState<StoreAttributeOption[]>([
    { id: 'opt-col-negro', label: 'Negro Puro', hex: '#1A1A1A' },
    { id: 'opt-col-blanco', label: 'Blanco Roto', hex: '#E5E5E5' }
  ]);
  const [newOpt1Label, setNewOpt1Label] = useState('');
  const [newOpt1Hex, setNewOpt1Hex] = useState('#1A1A1A');

  // Attribute 2 states
  const [attr2Enabled, setAttr2Enabled] = useState(true);
  const [attr2Name, setAttr2Name] = useState('Talle');
  const [attr2Type, setAttr2Type] = useState<'text' | 'color'>('text');
  const [attr2Options, setAttr2Options] = useState<StoreAttributeOption[]>([
    { id: 'opt-sz-s', label: 'S' },
    { id: 'opt-sz-m', label: 'M' },
    { id: 'opt-sz-l', label: 'L' }
  ]);
  const [newOpt2Label, setNewOpt2Label] = useState('');
  const [newOpt2Hex, setNewOpt2Hex] = useState('#1A1A1A');

  // Deletion confirm dialog
  const [deletingRubro, setDeletingRubro] = useState<Rubro | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeRubros((data) => {
      setRubros(data);
    });
    return () => unsub();
  }, [isOpen]);

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleOpenCreate = () => {
    setEditingRubro(null);
    setName('');
    setActive(true);

    setAttr1Enabled(true);
    setAttr1Name('Atributo 1');
    setAttr1Type('text');
    setAttr1Options([
      { id: 'opt-1', label: 'Opción A' },
      { id: 'opt-2', label: 'Opción B' }
    ]);
    setNewOpt1Label('');
    setNewOpt1Hex('#1A1A1A');

    setAttr2Enabled(false);
    setAttr2Name('Atributo 2');
    setAttr2Type('text');
    setAttr2Options([]);
    setNewOpt2Label('');
    setNewOpt2Hex('#1A1A1A');

    setIsEditing(true);
  };

  const handleOpenEdit = (r: Rubro) => {
    setEditingRubro(r);
    setName(r.name);
    setActive(r.active);

    setAttr1Enabled(r.attribute1?.enabled ?? true);
    setAttr1Name(r.attribute1?.name || 'Color');
    setAttr1Type(r.attribute1?.type || 'color');
    setAttr1Options(r.attribute1?.options || []);
    setNewOpt1Label('');
    setNewOpt1Hex('#1A1A1A');

    setAttr2Enabled(r.attribute2?.enabled ?? false);
    setAttr2Name(r.attribute2?.name || 'Talle');
    setAttr2Type(r.attribute2?.type || 'text');
    setAttr2Options(r.attribute2?.options || []);
    setNewOpt2Label('');
    setNewOpt2Hex('#1A1A1A');

    setIsEditing(true);
  };

  const handleAddOption1 = () => {
    if (!newOpt1Label.trim()) return;
    const newId = `opt-1-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
    setAttr1Options((prev) => [
      ...prev,
      {
        id: newId,
        label: newOpt1Label.trim(),
        hex: attr1Type === 'color' ? newOpt1Hex : undefined
      }
    ]);
    setNewOpt1Label('');
  };

  const handleRemoveOption1 = (id: string) => {
    setAttr1Options((prev) => prev.filter((o) => o.id !== id));
  };

  const handleAddOption2 = () => {
    if (!newOpt2Label.trim()) return;
    const newId = `opt-2-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
    setAttr2Options((prev) => [
      ...prev,
      {
        id: newId,
        label: newOpt2Label.trim(),
        hex: attr2Type === 'color' ? newOpt2Hex : undefined
      }
    ]);
    setNewOpt2Label('');
  };

  const handleRemoveOption2 = (id: string) => {
    setAttr2Options((prev) => prev.filter((o) => o.id !== id));
  };

  const handleSaveRubro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showFeedback('Por favor ingresá el nombre del rubro.');
      return;
    }

    setIsSaving(true);
    try {
      const rubroId = editingRubro?.id || name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `rubro-${Date.now().toString(36)}`;

      const attribute1: StoreAttribute = {
        id: 'attr1',
        name: attr1Name.trim() || 'Atributo 1',
        type: attr1Type,
        enabled: attr1Enabled,
        options: attr1Options.map((o) => ({
          ...o,
          hex: attr1Type === 'color' ? (o.hex || '#1A1A1A') : undefined
        })),
        hideUnusedWarning: false
      };

      const attribute2: StoreAttribute = {
        id: 'attr2',
        name: attr2Name.trim() || 'Atributo 2',
        type: attr2Type,
        enabled: attr2Enabled,
        options: attr2Options.map((o) => ({
          ...o,
          hex: attr2Type === 'color' ? (o.hex || '#1A1A1A') : undefined
        })),
        hideUnusedWarning: false
      };

      const rubroToSave: Rubro = {
        id: rubroId,
        name: name.trim(),
        active,
        attribute1,
        attribute2,
        createdAt: editingRubro?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await saveRubro(rubroToSave);
      showFeedback(`Rubro "${rubroToSave.name}" guardado exitosamente.`);
      setIsEditing(false);
      setEditingRubro(null);
    } catch (err: any) {
      console.error('Error saving rubro:', err);
      showFeedback('Error al guardar el rubro. Intentá nuevamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (r: Rubro) => {
    try {
      const updated: Rubro = { ...r, active: !r.active };
      await saveRubro(updated);
      showFeedback(`Rubro "${r.name}" ${updated.active ? 'activado' : 'desactivado'}.`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingRubro) return;
    try {
      await deleteRubro(deletingRubro.id);
      showFeedback(`Rubro "${deletingRubro.name}" eliminado.`);
      setDeletingRubro(null);
    } catch (err) {
      console.error(err);
      showFeedback('No se pudo eliminar el rubro.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-neutral-100 my-8 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header */}
        <div className="flex items-start justify-between gap-4 border-b border-neutral-100 pb-5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">category</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-neutral-900 tracking-tight">
                  Administrador de Rubros
                </h2>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                  {rubros.length} rubros
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Configurá los rubros disponibles para el alta de tiendas y los atributos predeterminados que heredarán.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing && (
              <button
                type="button"
                onClick={handleOpenCreate}
                className="px-3.5 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[17px]">add</span>
                <span>Nuevo Rubro</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-neutral-100 text-neutral-400 hover:text-black transition-colors"
              title="Cerrar"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Toast Feedback */}
        {feedbackMsg && (
          <div className="mt-4 p-3 bg-neutral-900 text-white text-xs font-medium rounded-xl flex items-center justify-between shadow-md">
            <span>{feedbackMsg}</span>
            <button onClick={() => setFeedbackMsg(null)} className="text-neutral-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-5 pr-1 space-y-6">
          {isEditing ? (
            /* ================= EDIT / CREATE FORM ================= */
            <form onSubmit={handleSaveRubro} className="space-y-6 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <h3 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-600 text-lg">
                    {editingRubro ? 'edit' : 'add_circle'}
                  </span>
                  <span>{editingRubro ? `Editando rubro: ${editingRubro.name}` : 'Crear nuevo rubro'}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
                >
                  Volver al listado
                </button>
              </div>

              {/* General Rubro Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                    Nombre del Rubro *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Indumentaria, Calzado, Gastronomía..."
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(e) => setActive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                  <div>
                    <span className="text-xs font-semibold text-neutral-800 block">
                      Rubro Activo
                    </span>
                    <span className="text-[11px] text-neutral-400 block">
                      Visible en el selector de registro de tiendas
                    </span>
                  </div>
                </div>
              </div>

              {/* ATRIBUTO 1 CONFIGURATION */}
              <div className="p-4 sm:p-5 rounded-2xl bg-neutral-50/80 border border-neutral-200/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-neutral-900 text-white text-xs font-bold flex items-center justify-center">
                      1
                    </span>
                    <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wide">
                      Primer Atributo Predeterminado
                    </h4>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={attr1Enabled}
                      onChange={(e) => setAttr1Enabled(e.target.checked)}
                      className="rounded text-black focus:ring-black"
                    />
                    <span className="text-xs font-medium text-neutral-700">Habilitado</span>
                  </label>
                </div>

                {attr1Enabled && (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">
                          Nombre del Atributo
                        </label>
                        <input
                          type="text"
                          value={attr1Name}
                          onChange={(e) => setAttr1Name(e.target.value)}
                          placeholder="Ej: Color, Tamaño, Modelo..."
                          className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl text-xs font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-black"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">
                          Tipo de Atributo
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setAttr1Type('text')}
                            className={`py-2 px-3 text-xs font-semibold rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              attr1Type === 'text'
                                ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs'
                                : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[16px]">notes</span>
                            <span>Texto</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setAttr1Type('color')}
                            className={`py-2 px-3 text-xs font-semibold rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              attr1Type === 'color'
                                ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs'
                                : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[16px]">palette</span>
                            <span>Color</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Options list for Attr 1 */}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                        Opciones iniciales ({attr1Options.length})
                      </label>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {attr1Options.map((opt) => (
                          <div
                            key={opt.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-neutral-200 text-xs shadow-2xs"
                          >
                            {attr1Type === 'color' && (
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-neutral-300 shadow-2xs shrink-0"
                                style={{ backgroundColor: opt.hex || '#ffffff' }}
                              />
                            )}
                            <span className="font-medium text-neutral-800">{opt.label}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveOption1(opt.id)}
                              className="text-neutral-400 hover:text-rose-600 ml-1 cursor-pointer"
                              title="Quitar opción"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Add Option Input */}
                      <div className="flex items-center gap-2">
                        {attr1Type === 'color' && (
                          <input
                            type="color"
                            value={newOpt1Hex}
                            onChange={(e) => setNewOpt1Hex(e.target.value)}
                            className="w-9 h-9 p-0.5 rounded-lg border border-neutral-200 cursor-pointer bg-white"
                            title="Elegir color hex"
                          />
                        )}
                        <input
                          type="text"
                          value={newOpt1Label}
                          onChange={(e) => setNewOpt1Label(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddOption1();
                            }
                          }}
                          placeholder={attr1Type === 'color' ? 'Nombre del color (ej: Negro)' : 'Opción (ej: S, M, Chico...)'}
                          className="flex-1 px-3 py-2 bg-white border border-neutral-200 rounded-xl text-xs font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-black"
                        />
                        <button
                          type="button"
                          onClick={handleAddOption1}
                          className="px-3.5 py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                        >
                          + Agregar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ATRIBUTO 2 CONFIGURATION */}
              <div className="p-4 sm:p-5 rounded-2xl bg-neutral-50/80 border border-neutral-200/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-neutral-900 text-white text-xs font-bold flex items-center justify-center">
                      2
                    </span>
                    <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wide">
                      Segundo Atributo Predeterminado
                    </h4>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={attr2Enabled}
                      onChange={(e) => setAttr2Enabled(e.target.checked)}
                      className="rounded text-black focus:ring-black"
                    />
                    <span className="text-xs font-medium text-neutral-700">Habilitado</span>
                  </label>
                </div>

                {attr2Enabled && (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">
                          Nombre del Atributo
                        </label>
                        <input
                          type="text"
                          value={attr2Name}
                          onChange={(e) => setAttr2Name(e.target.value)}
                          placeholder="Ej: Talle, Material, Presentación..."
                          className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl text-xs font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-black"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">
                          Tipo de Atributo
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setAttr2Type('text')}
                            className={`py-2 px-3 text-xs font-semibold rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              attr2Type === 'text'
                                ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs'
                                : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[16px]">notes</span>
                            <span>Texto</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setAttr2Type('color')}
                            className={`py-2 px-3 text-xs font-semibold rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              attr2Type === 'color'
                                ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs'
                                : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[16px]">palette</span>
                            <span>Color</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Options list for Attr 2 */}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                        Opciones iniciales ({attr2Options.length})
                      </label>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {attr2Options.map((opt) => (
                          <div
                            key={opt.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-neutral-200 text-xs shadow-2xs"
                          >
                            {attr2Type === 'color' && (
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-neutral-300 shadow-2xs shrink-0"
                                style={{ backgroundColor: opt.hex || '#ffffff' }}
                              />
                            )}
                            <span className="font-medium text-neutral-800">{opt.label}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveOption2(opt.id)}
                              className="text-neutral-400 hover:text-rose-600 ml-1 cursor-pointer"
                              title="Quitar opción"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Add Option Input */}
                      <div className="flex items-center gap-2">
                        {attr2Type === 'color' && (
                          <input
                            type="color"
                            value={newOpt2Hex}
                            onChange={(e) => setNewOpt2Hex(e.target.value)}
                            className="w-9 h-9 p-0.5 rounded-lg border border-neutral-200 cursor-pointer bg-white"
                            title="Elegir color hex"
                          />
                        )}
                        <input
                          type="text"
                          value={newOpt2Label}
                          onChange={(e) => setNewOpt2Label(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddOption2();
                            }
                          }}
                          placeholder={attr2Type === 'color' ? 'Nombre del color' : 'Opción (ej: S, M, XL...)'}
                          className="flex-1 px-3 py-2 bg-white border border-neutral-200 rounded-xl text-xs font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-black"
                        />
                        <button
                          type="button"
                          onClick={handleAddOption2}
                          className="px-3.5 py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                        >
                          + Agregar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Guardando...' : editingRubro ? 'Guardar Cambios' : 'Crear Rubro'}
                </button>
              </div>
            </form>
          ) : (
            /* ================= RUBROS LIST ================= */
            <div className="space-y-4">
              {rubros.length === 0 ? (
                <div className="text-center py-12 bg-neutral-50 rounded-2xl border border-neutral-200">
                  <span className="material-symbols-outlined text-4xl text-neutral-300 mb-2">category</span>
                  <p className="text-xs font-bold text-neutral-700">No hay rubros cargados</p>
                  <button
                    onClick={handleOpenCreate}
                    className="mt-3 px-4 py-2 bg-black text-white text-xs font-semibold rounded-xl"
                  >
                    Crear el Primer Rubro
                  </button>
                </div>
              ) : (
                rubros.map((r) => {
                  const a1 = r.attribute1;
                  const a2 = r.attribute2;

                  return (
                    <div
                      key={r.id}
                      className="p-5 rounded-2xl border border-neutral-200/90 hover:border-neutral-300 bg-white shadow-2xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      {/* Left: Rubro Info & Attributes Preview */}
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="text-base font-bold text-neutral-900 tracking-tight">
                            {r.name}
                          </h3>
                          <button
                            type="button"
                            onClick={() => handleToggleActive(r)}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
                              r.active
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                : 'bg-neutral-100 text-neutral-500 border border-neutral-200 hover:bg-neutral-200'
                            }`}
                            title="Click para cambiar estado"
                          >
                            {r.active ? '● Activo' : '○ Inactivo'}
                          </button>
                        </div>

                        {/* Attributes summary badges */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {/* Attribute 1 card */}
                          <div className={`p-2.5 rounded-xl border ${a1?.enabled ? 'bg-neutral-50/60 border-neutral-200/80' : 'bg-neutral-50/30 border-neutral-100 opacity-60'}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-neutral-900 flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[15px] text-neutral-500">
                                  {a1?.type === 'color' ? 'palette' : 'notes'}
                                </span>
                                <span>{a1?.name || 'Atributo 1'}</span>
                              </span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-neutral-200 text-neutral-600">
                                {a1?.enabled ? (a1?.type === 'color' ? 'Color' : 'Texto') : 'Deshabilitado'}
                              </span>
                            </div>
                            {a1?.enabled && (
                              <div className="text-[11px] text-neutral-500 flex items-center gap-1.5 flex-wrap">
                                <span>{a1.options.length} opciones:</span>
                                {a1.options.slice(0, 4).map((o) => (
                                  <span key={o.id} className="inline-flex items-center gap-1 bg-white px-1.5 py-0.5 rounded border border-neutral-200 text-[10px]">
                                    {a1.type === 'color' && (
                                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: o.hex || '#ffffff' }} />
                                    )}
                                    <span>{o.label}</span>
                                  </span>
                                ))}
                                {a1.options.length > 4 && <span>+{a1.options.length - 4} más</span>}
                              </div>
                            )}
                          </div>

                          {/* Attribute 2 card */}
                          <div className={`p-2.5 rounded-xl border ${a2?.enabled ? 'bg-neutral-50/60 border-neutral-200/80' : 'bg-neutral-50/30 border-neutral-100 opacity-60'}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-neutral-900 flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[15px] text-neutral-500">
                                  {a2?.type === 'color' ? 'palette' : 'notes'}
                                </span>
                                <span>{a2?.name || 'Atributo 2'}</span>
                              </span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-neutral-200 text-neutral-600">
                                {a2?.enabled ? (a2?.type === 'color' ? 'Color' : 'Texto') : 'Deshabilitado'}
                              </span>
                            </div>
                            {a2?.enabled && (
                              <div className="text-[11px] text-neutral-500 flex items-center gap-1.5 flex-wrap">
                                <span>{a2.options.length} opciones:</span>
                                {a2.options.slice(0, 4).map((o) => (
                                  <span key={o.id} className="inline-flex items-center gap-1 bg-white px-1.5 py-0.5 rounded border border-neutral-200 text-[10px]">
                                    {a2.type === 'color' && (
                                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: o.hex || '#ffffff' }} />
                                    )}
                                    <span>{o.label}</span>
                                  </span>
                                ))}
                                {a2.options.length > 4 && <span>+{a2.options.length - 4} más</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(r)}
                          className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                          <span>Editar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingRubro(r)}
                          className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                          title="Eliminar rubro"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-100 pt-4 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-neutral-400">
            Los cambios en rubros impactan únicamente en las nuevas tiendas que se creen a partir de ahora.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>

      {/* Confirmation Dialog for Delete */}
      {deletingRubro && (
        <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-neutral-200 animate-in fade-in zoom-in-95 duration-150">
            <h4 className="text-base font-bold text-neutral-900 mb-2">
              ¿Eliminar rubro "{deletingRubro.name}"?
            </h4>
            <p className="text-xs text-neutral-500 mb-5">
              Ya no estará disponible para registrar nuevas tiendas. Las tiendas existentes que ya tengan este rubro no se verán afectadas.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingRubro(null)}
                className="px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
