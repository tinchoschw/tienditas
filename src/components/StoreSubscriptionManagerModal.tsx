import React, { useState, useEffect } from 'react';
import { Store, StorePeriod, StorePlan, StoreStatus, Rubro } from '../types';
import { 
  subscribeStorePeriods, 
  createStorePeriod, 
  updateStorePeriod, 
  addStoreExtension, 
  updateStorePlanAndStatus,
  subscribeRubros 
} from '../services/db';

interface StoreSubscriptionManagerModalProps {
  store: Store;
  basePrice: number;
  isOpen: boolean;
  onClose: () => void;
  onStoreUpdated: (updatedStore: Store) => void;
  showToast: (msg: string) => void;
}

export const StoreSubscriptionManagerModal: React.FC<StoreSubscriptionManagerModalProps> = ({
  store,
  basePrice,
  isOpen,
  onClose,
  onStoreUpdated,
  showToast
}) => {
  const [activeTab, setActiveTab] = useState<'plan' | 'payments' | 'extensions'>('plan');
  
  // Store profile state
  const [storeName, setStoreName] = useState<string>(store.name || '');
  const [ownerFirstName, setOwnerFirstName] = useState<string>(store.ownerFirstName || '');
  const [ownerEmail, setOwnerEmail] = useState<string>(store.ownerEmail || '');
  const [whatsappNumber, setWhatsappNumber] = useState<string>(store.whatsappNumber || store.ownerPhone || '');
  const [rubro, setRubro] = useState<string>(store.rubro || 'Indumentaria');
  const [isSandbox, setIsSandbox] = useState<boolean>(!!store.isSandbox);

  // Rubros list for combo selection
  const [availableRubros, setAvailableRubros] = useState<Rubro[]>([]);

  // Subscription state
  const [currentPlan, setCurrentPlan] = useState<StorePlan>(store.plan || 'trial');
  const [currentStatus, setCurrentStatus] = useState<StoreStatus>(store.status || (store.active !== false ? 'active' : 'suspended'));
  const [planEndsAt, setPlanEndsAt] = useState<string>(
    store.planEndsAt ? store.planEndsAt.split('T')[0] : ''
  );
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  // Quick Extension State
  const [extensionDays, setExtensionDays] = useState<number>(30);
  const [extensionReason, setExtensionReason] = useState<string>('');
  const [isAddingExtension, setIsAddingExtension] = useState(false);

  // Periods state
  const [periods, setPeriods] = useState<StorePeriod[]>([]);
  const [isCreatingPeriod, setIsCreatingPeriod] = useState(false);
  const [newPeriodAmount, setNewPeriodAmount] = useState<number>(basePrice);
  const [newPeriodNote, setNewPeriodNote] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeRubros((list) => {
      setAvailableRubros(list);
    });
    return () => unsub();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !store?.id) return;
    const unsub = subscribeStorePeriods(store.id, (list) => {
      setPeriods(list);
    });
    return () => unsub();
  }, [isOpen, store?.id]);

  useEffect(() => {
    setStoreName(store.name || '');
    setOwnerFirstName(store.ownerFirstName || '');
    setOwnerEmail(store.ownerEmail || '');
    setWhatsappNumber(store.whatsappNumber || store.ownerPhone || '');
    setRubro(store.rubro || 'Indumentaria');
    setIsSandbox(!!store.isSandbox);
    setCurrentPlan(store.plan || 'trial');
    setCurrentStatus(store.status || (store.active !== false ? 'active' : 'suspended'));
    setPlanEndsAt(store.planEndsAt ? store.planEndsAt.split('T')[0] : '');
  }, [store]);

  if (!isOpen) return null;

  const handleSavePlanSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPlan(true);
    try {
      const finalEndsAt = planEndsAt ? new Date(planEndsAt).toISOString() : '';
      const updated = await updateStorePlanAndStatus(store.id, {
        name: storeName.trim(),
        ownerFirstName: ownerFirstName.trim(),
        ownerEmail: ownerEmail.trim().toLowerCase(),
        whatsappNumber: whatsappNumber.trim(),
        ownerPhone: whatsappNumber.trim(),
        rubro: rubro.trim(),
        isSandbox,
        plan: currentPlan,
        status: currentStatus,
        planEndsAt: finalEndsAt
      });
      if (updated) onStoreUpdated(updated);
      showToast('Datos del comercio y suscripción actualizados.');
    } catch (err: any) {
      console.error(err);
      showToast('Error al guardar cambios de la tienda.');
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleApplyExtension = async (days: number, defaultReason?: string) => {
    const reason = extensionReason.trim() || defaultReason || `Extensión autorizada de ${days} días`;
    setIsAddingExtension(true);
    try {
      const updated = await addStoreExtension(store.id, {
        days,
        reason
      });
      if (updated) {
        onStoreUpdated(updated);
        setPlanEndsAt(updated.planEndsAt ? updated.planEndsAt.split('T')[0] : '');
      }
      setExtensionReason('');
      showToast(`¡Se agregaron +${days} días de servicio a la tienda!`);
    } catch (err: any) {
      console.error(err);
      showToast('Error al aplicar extensión.');
    } finally {
      setIsAddingExtension(false);
    }
  };

  const handleCreateNewPeriod = async () => {
    setIsCreatingPeriod(true);
    try {
      const now = new Date();
      // If there's an existing period, start from its dueDate or now
      let startDate = now;
      if (periods.length > 0 && periods[0].dueDate) {
        const lastDue = new Date(periods[0].dueDate);
        if (!isNaN(lastDue.getTime())) {
          startDate = lastDue;
        }
      }

      const dueDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      await createStorePeriod(store.id, {
        startDate: startDate.toISOString().split('T')[0],
        dueDate: dueDate.toISOString().split('T')[0],
        amount: newPeriodAmount || basePrice,
        paidAmount: 0,
        status: 'pending',
        note: newPeriodNote.trim()
      });

      setNewPeriodNote('');
      showToast('Nuevo período de 30 días generado.');
    } catch (err: any) {
      console.error(err);
      showToast('Error al generar período.');
    } finally {
      setIsCreatingPeriod(false);
    }
  };

  const handleUpdatePeriod = async (periodId: string, patch: Partial<StorePeriod>) => {
    try {
      await updateStorePeriod(store.id, periodId, patch);
      showToast('Período actualizado.');
    } catch (err) {
      console.error(err);
      showToast('Error al actualizar período.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-neutral-100 my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Top Header */}
        <div className="flex items-start justify-between gap-4 border-b border-neutral-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-500 text-[20px]">loyalty</span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Gestión de Suscripción & Cobros
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight mt-0.5">
              {store.name}
            </h2>
            <div className="flex items-center gap-2 text-xs text-neutral-500 font-mono mt-0.5">
              <span>slug: <strong>/{store.slug}</strong></span>
              <span>•</span>
              <span>Dueño: <strong>{store.ownerEmail || 'Sin email'}</strong></span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-neutral-100 text-neutral-400 hover:text-black transition-colors"
            title="Cerrar modal"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 border-b border-neutral-100 my-4">
          <button
            onClick={() => setActiveTab('plan')}
            className={`py-2 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'plan'
                ? 'border-black text-black'
                : 'border-transparent text-neutral-500 hover:text-black'
            }`}
          >
            Plan & Vencimiento
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`py-2 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'payments'
                ? 'border-black text-black'
                : 'border-transparent text-neutral-500 hover:text-black'
            }`}
          >
            <span>Seguimiento de Pagos</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-700">
              {periods.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('extensions')}
            className={`py-2 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'extensions'
                ? 'border-black text-black'
                : 'border-transparent text-neutral-500 hover:text-black'
            }`}
          >
            <span>Extensiones</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-700">
              {store.extensions?.length || 0}
            </span>
          </button>
        </div>

        {/* TAB 1: Plan, Status & Quick Extension */}
        {activeTab === 'plan' && (
          <div className="space-y-6">
            <form onSubmit={handleSavePlanSettings} className="space-y-5">
              {/* Profile Data Section */}
              <div className="p-4 bg-neutral-50/80 rounded-2xl border border-neutral-200/80 space-y-3.5">
                <div className="flex items-center gap-2 border-b border-neutral-200 pb-2">
                  <span className="material-symbols-outlined text-neutral-700 text-[18px]">store</span>
                  <span className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
                    Perfil del Comercio
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Nombre del Comercio *
                    </label>
                    <input
                      type="text"
                      required
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="Ej: Calipso Indumentaria"
                      className="w-full px-3.5 py-2 bg-white border border-neutral-200 rounded-xl text-xs font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Nombre de Contacto / Titular
                    </label>
                    <input
                      type="text"
                      value={ownerFirstName}
                      onChange={(e) => setOwnerFirstName(e.target.value)}
                      placeholder="Ej: Martina"
                      className="w-full px-3.5 py-2 bg-white border border-neutral-200 rounded-xl text-xs font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Email de Google del Dueño *
                    </label>
                    <input
                      type="email"
                      required
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      placeholder="dueño@gmail.com"
                      className="w-full px-3.5 py-2 bg-white border border-neutral-200 rounded-xl text-xs font-mono text-neutral-900 focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      WhatsApp / Celular de Contacto
                    </label>
                    <input
                      type="text"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      placeholder="+54911..."
                      className="w-full px-3.5 py-2 bg-white border border-neutral-200 rounded-xl text-xs font-mono text-neutral-900 focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Rubro Selector Combo */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Rubro del Comercio *
                    </label>
                    <select
                      value={rubro}
                      onChange={(e) => setRubro(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-black"
                    >
                      {availableRubros.map((r) => (
                        <option key={r.id} value={r.name}>
                          {r.name}
                        </option>
                      ))}
                      {!availableRubros.some((r) => r.name.toLowerCase() === rubro.toLowerCase()) && (
                        <option value={rubro}>{rubro}</option>
                      )}
                    </select>
                    <p className="text-[10px] text-neutral-400 mt-1">
                      Cambiar de rubro no sobreescribe atributos que la tienda ya haya personalizado.
                    </p>
                  </div>

                  {/* Sandbox Checkbox */}
                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl bg-white hover:bg-neutral-100 border border-neutral-200 transition-colors w-full">
                      <input
                        type="checkbox"
                        checked={isSandbox}
                        onChange={(e) => setIsSandbox(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-neutral-800">
                        🧪 Tienda Sandbox (Modo Pruebas)
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Subscription & Plan Section */}
              <div className="p-4 bg-neutral-50/80 rounded-2xl border border-neutral-200/80 space-y-3.5">
                <div className="flex items-center gap-2 border-b border-neutral-200 pb-2">
                  <span className="material-symbols-outlined text-neutral-700 text-[18px]">verified</span>
                  <span className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
                    Plan & Suscripción
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Plan */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Tipo de Plan *
                    </label>
                    <select
                      value={currentPlan}
                      onChange={(e) => setCurrentPlan(e.target.value as StorePlan)}
                      className="w-full px-3.5 py-2 bg-white border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-black"
                    >
                      <option value="trial">Prueba Gratuita (trial)</option>
                      <option value="paid">Suscripción Paga ($24.900/mes)</option>
                      <option value="friends_family">Friends & Family (Bonificado)</option>
                      <option value="internal">Interno / Sin Vencimiento</option>
                    </select>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Estado de la Tienda *
                    </label>
                    <select
                      value={currentStatus}
                      onChange={(e) => setCurrentStatus(e.target.value as StoreStatus)}
                      className="w-full px-3.5 py-2 bg-white border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-black"
                    >
                      <option value="active">Activa (Catálogo y Admin Habilitados)</option>
                      <option value="suspended">Suspendida (Fuera de Servicio)</option>
                      <option value="closed">Cerrada / Persianas Bajas</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Expiration date */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Fecha de Vencimiento (planEndsAt)
                    </label>
                    <input
                      type="date"
                      value={planEndsAt}
                      onChange={(e) => setPlanEndsAt(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-black"
                    />
                    <span className="text-[10px] text-neutral-400 mt-0.5 block">
                      Dejar vacío para que no venza nunca (ej. plan internal).
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSavingPlan}
                  className="px-6 py-2.5 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  <span>{isSavingPlan ? 'Guardando...' : 'Guardar Cambios del Comercio'}</span>
                </button>
              </div>
            </form>

            {/* Quick Extension Box */}
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-700 text-[18px]">more_time</span>
                <span className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                  Otorgar Extensión Rápida
                </span>
              </div>
              <p className="text-xs text-amber-900 leading-relaxed">
                Agregá días adicionales a la fecha de vencimiento actual. Quedará registrado en el historial de extensiones.
              </p>

              <div>
                <label className="block text-[11px] font-bold text-amber-950 mb-1">
                  Motivo de la Extensión (opcional)
                </label>
                <input
                  type="text"
                  value={extensionReason}
                  onChange={(e) => setExtensionReason(e.target.value)}
                  placeholder="Ej: Bonificación promo lanzamiento, Abonó 1 mes por transferencia..."
                  className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleApplyExtension(7, 'Extensión semanal')}
                  disabled={isAddingExtension}
                  className="px-3.5 py-2 bg-white hover:bg-amber-100 text-amber-950 border border-amber-300 text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-2xs"
                >
                  +7 Días
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyExtension(30, 'Extensión mensual (30 días)')}
                  disabled={isAddingExtension}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  +30 Días (Mes)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyExtension(60, 'Extensión bimestral (60 días)')}
                  disabled={isAddingExtension}
                  className="px-3.5 py-2 bg-white hover:bg-amber-100 text-amber-950 border border-amber-300 text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-2xs"
                >
                  +60 Días
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Seguimiento de Pagos (Períodos de 30 días) */}
        {activeTab === 'payments' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-neutral-50 border border-neutral-200">
              <div>
                <span className="text-xs font-bold text-neutral-900 block">
                  Generar Nuevo Período Fijo (30 días)
                </span>
                <span className="text-[11px] text-neutral-500">
                  Monto base predeterminado: <strong>${basePrice.toLocaleString('es-AR')}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={newPeriodAmount}
                  onChange={(e) => setNewPeriodAmount(Number(e.target.value) || 0)}
                  className="w-24 px-2.5 py-1.5 bg-white border border-neutral-300 rounded-xl text-xs font-bold text-neutral-900"
                />
                <button
                  type="button"
                  onClick={handleCreateNewPeriod}
                  disabled={isCreatingPeriod}
                  className="px-3.5 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>{isCreatingPeriod ? 'Creando...' : 'Generar Período'}</span>
                </button>
              </div>
            </div>

            {/* List of Periods */}
            {periods.length === 0 ? (
              <div className="text-center py-8 text-neutral-400 text-xs">
                No hay períodos de pago registrados para este comercio aún.
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {periods.map((period) => {
                  const debt = Math.max(0, (period.amount || 0) - (period.paidAmount || 0));
                  const isPaid = period.status === 'paid' || debt === 0;

                  return (
                    <div
                      key={period.id}
                      className={`p-4 rounded-2xl border transition-all space-y-3 ${
                        isPaid
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : 'bg-white border-neutral-200 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                          <span className="text-xs font-bold text-neutral-900">
                            Período: {period.startDate} → {period.dueDate}
                          </span>
                        </div>

                        {/* Status Toggle */}
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdatePeriod(period.id, {
                              status: isPaid ? 'pending' : 'paid',
                              paidAmount: isPaid ? 0 : period.amount
                            })
                          }
                          className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
                            isPaid
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-amber-100 text-amber-800 border-amber-300'
                          }`}
                        >
                          {isPaid ? '✓ Pagado' : '⏳ Pendiente'}
                        </button>
                      </div>

                      {/* Inputs Row */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-neutral-400 block mb-0.5">
                            Monto a Pagar ($)
                          </label>
                          <input
                            type="number"
                            value={period.amount}
                            onChange={(e) =>
                              handleUpdatePeriod(period.id, { amount: Number(e.target.value) || 0 })
                            }
                            className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-900"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] uppercase font-bold text-neutral-400 block mb-0.5">
                            Monto Pagado ($)
                          </label>
                          <input
                            type="number"
                            value={period.paidAmount || 0}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              handleUpdatePeriod(period.id, {
                                paidAmount: val,
                                status: val >= period.amount ? 'paid' : 'pending',
                                lastPaymentDate: new Date().toISOString().split('T')[0]
                              });
                            }}
                            className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-900"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] uppercase font-bold text-neutral-400 block mb-0.5">
                            Deuda Saldo ($)
                          </label>
                          <div className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border ${
                            debt > 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            ${debt.toLocaleString('es-AR')}
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] uppercase font-bold text-neutral-400 block mb-0.5">
                            Fecha Último Pago
                          </label>
                          <input
                            type="date"
                            value={period.lastPaymentDate || ''}
                            onChange={(e) =>
                              handleUpdatePeriod(period.id, { lastPaymentDate: e.target.value })
                            }
                            className="w-full px-2 py-1.5 bg-white border border-neutral-200 rounded-lg text-[11px] text-neutral-900"
                          />
                        </div>
                      </div>

                      {/* Nota */}
                      <div>
                        <input
                          type="text"
                          value={period.note || ''}
                          onChange={(e) =>
                            handleUpdatePeriod(period.id, { note: e.target.value })
                          }
                          placeholder="Nota manual (ej: Abonó $15.000 por transferencia, saldo resta para prox mes)..."
                          className="w-full px-3 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs text-neutral-700 placeholder:text-neutral-400"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Extensiones Otorgadas */}
        {activeTab === 'extensions' && (
          <div className="space-y-4">
            <p className="text-xs text-neutral-500">
              Historial de extensiones y prórrogas otorgadas manualmente por el Superadmin:
            </p>

            {(!store.extensions || store.extensions.length === 0) ? (
              <div className="text-center py-8 text-neutral-400 text-xs">
                No hay extensiones otorgadas a este comercio.
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {store.extensions.map((ext, idx) => (
                  <div
                    key={ext.id || idx}
                    className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-neutral-900 block">
                        Extensión de {ext.days} días
                      </span>
                      <span className="text-neutral-500 text-[11px]">
                        Motivo: <em>{ext.reason || 'Sin motivo especificado'}</em>
                      </span>
                    </div>
                    <span className="text-neutral-400 font-mono text-[11px]">
                      {ext.date}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal Bottom Footer */}
        <div className="mt-6 pt-4 border-t border-neutral-100 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
