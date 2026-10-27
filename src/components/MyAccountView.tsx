import React, { useState, useEffect } from 'react';
import { Store, StorePeriod, StoreFeedback } from '../types';
import { saveStoreFeedback, updateStoreOwnerInfo, closeStoreByOwner, subscribeStorePeriods } from '../services/db';

interface MyAccountViewProps {
  store: Store;
  supportWhatsApp?: string;
  periods?: StorePeriod[];
  onStoreUpdated?: (updatedStore: Store) => void;
  onUpdateOwner?: (data: { ownerFirstName?: string; ownerLastName?: string; ownerPhone?: string }) => Promise<void>;
  onCloseStore?: (feedback: { storeId: string; motivos: string[]; text: string; storeName: string; userEmail: string; userName: string }) => Promise<void>;
}

const CLOSURE_REASONS = [
  'No tuve suficientes ventas o visitas',
  'El costo mensual no se ajusta a mi presupuesto',
  'Me faltó alguna función importante',
  'Cerré o pausé mi actividad comercial',
  'Prefiero usar otra herramienta',
  'Otro motivo'
];

export const MyAccountView: React.FC<MyAccountViewProps> = ({
  store,
  supportWhatsApp = '5491122334455',
  periods: initialPeriods = [],
  onStoreUpdated,
  onUpdateOwner,
  onCloseStore
}) => {
  const [livePeriods, setLivePeriods] = useState<StorePeriod[]>(initialPeriods);

  useEffect(() => {
    if (initialPeriods.length > 0) {
      setLivePeriods(initialPeriods);
      return;
    }
    if (!store?.id) return;
    const unsub = subscribeStorePeriods(store.id, (list) => {
      setLivePeriods(list);
    });
    return () => unsub();
  }, [store?.id, initialPeriods]);

  const periods = livePeriods;
  // Personal Info Form State
  const [firstName, setFirstName] = useState(store.ownerFirstName || '');
  const [lastName, setLastName] = useState(store.ownerLastName || '');
  const [phone, setPhone] = useState(store.ownerPhone || store.whatsappNumber || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Friends & Family Feedback Modal
  const [isFfModalOpen, setIsFfModalOpen] = useState(false);
  const [ffFeedbackText, setFfFeedbackText] = useState('');
  const [isSendingFf, setIsSendingFf] = useState(false);
  const [ffSuccess, setFfSuccess] = useState(false);

  // Close Store Modal
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [closureComment, setClosureComment] = useState('');
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isClosingStore, setIsClosingStore] = useState(false);
  const [closureError, setClosureError] = useState<string | null>(null);

  // Plan info calculations
  const planNames: Record<string, string> = {
    trial: 'Prueba gratuita (14 días)',
    friends_family: 'Friends & Family',
    paid: 'Suscripción Mensual',
    internal: 'Sin vencimiento'
  };

  const currentPlanName = planNames[store.plan || 'trial'] || 'Prueba gratuita';

  const daysRemaining = (() => {
    if (!store.planEndsAt) return null;
    const diff = new Date(store.planEndsAt).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  })();

  const isExpired = daysRemaining !== null && daysRemaining <= 0;
  const isExpiringSoon = daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 7;

  // Active / Latest period
  const activePeriod = periods.length > 0 ? periods[0] : store.currentPeriod;
  const periodAmount = activePeriod?.amount || 24900;
  const periodPaid = activePeriod?.paidAmount || 0;
  const periodDebt = Math.max(0, periodAmount - periodPaid);

  const cleanSupportPhone = supportWhatsApp.replace(/[^0-9]/g, '');
  const whatsappUrl = `https://wa.me/${cleanSupportPhone}?text=${encodeURIComponent(
    `Hola! Te consulto por el plan de mi tienda "${store.name}" (/${store.slug}).`
  )}`;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileSuccess(false);
    try {
      if (onUpdateOwner) {
        await onUpdateOwner({
          ownerFirstName: firstName.trim(),
          ownerLastName: lastName.trim(),
          ownerPhone: phone.trim()
        });
      } else {
        const updated = await updateStoreOwnerInfo(store.id, {
          ownerFirstName: firstName.trim(),
          ownerLastName: lastName.trim(),
          ownerPhone: phone.trim()
        });
        if (updated && onStoreUpdated) {
          onStoreUpdated(updated);
        }
      }
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSendFfFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ffFeedbackText.trim()) return;
    setIsSendingFf(true);
    try {
      await saveStoreFeedback({
        storeId: store.id,
        storeName: store.name,
        userEmail: store.ownerEmail || '',
        userName: `${firstName} ${lastName}`.trim() || store.ownerEmail || 'Dueño',
        text: ffFeedbackText.trim(),
        type: 'friends_family'
      });
      setFfSuccess(true);
      setTimeout(() => {
        setFfSuccess(false);
        setIsFfModalOpen(false);
        setFfFeedbackText('');
      }, 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSendingFf(false);
    }
  };

  const handleConfirmCloseStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setClosureError(null);

    if (confirmationInput.trim().toLowerCase() !== store.name.trim().toLowerCase()) {
      setClosureError(`Debes escribir exactamente "${store.name}" para confirmar.`);
      return;
    }
    if (selectedReasons.length === 0) {
      setClosureError('Por favor seleccioná al menos un motivo.');
      return;
    }

    setIsClosingStore(true);
    try {
      const fbData = {
        storeId: store.id,
        storeName: store.name,
        userEmail: store.ownerEmail || '',
        userName: `${firstName} ${lastName}`.trim() || store.ownerEmail || 'Dueño',
        motivos: selectedReasons,
        text: closureComment.trim()
      };

      if (onCloseStore) {
        await onCloseStore(fbData);
      } else {
        await closeStoreByOwner(store.id, {
          motivos: selectedReasons,
          text: closureComment.trim(),
          storeName: store.name,
          userEmail: store.ownerEmail || '',
          userName: `${firstName} ${lastName}`.trim() || store.ownerEmail || 'Dueño'
        });
        if (onStoreUpdated) {
          onStoreUpdated({ ...store, status: 'closed', active: false });
        }
      }
      setIsCloseModalOpen(false);
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      setClosureError(err.message || 'Error al cerrar la tienda.');
      setIsClosingStore(false);
    }
  };

  const toggleClosureReason = (reason: string) => {
    setSelectedReasons((prev) =>
      prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8 animate-in fade-in duration-200">
      
      {/* Top Title */}
      <div>
        <div className="flex items-center gap-2 text-xs text-neutral-400 font-bold uppercase tracking-wider mb-1">
          <span className="material-symbols-outlined text-[16px]">manage_accounts</span>
          <span>Configuración de Cuenta & Suscripción</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
          Mi Cuenta
        </h1>
        <p className="text-xs sm:text-sm text-neutral-500 mt-1">
          Gestioná tus datos personales de contacto, revisá el estado de tu suscripción o comunicate con soporte.
        </p>
      </div>

      {/* Plan Status Card */}
      <div className={`p-6 sm:p-7 rounded-3xl border shadow-sm ${
        isExpired
          ? 'bg-rose-50/70 border-rose-200'
          : isExpiringSoon
          ? 'bg-amber-50/70 border-amber-200'
          : 'bg-white border-neutral-200/90'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-neutral-200/60">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              Plan Actual
            </span>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-black text-neutral-900">
                {currentPlanName}
              </h2>
              {store.status === 'closed' ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-neutral-900 text-white">
                  Persianas Bajas
                </span>
              ) : isExpired ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-600 text-white animate-pulse">
                  Vencido
                </span>
              ) : isExpiringSoon ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-white">
                  Vence pronto
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Activo
                </span>
              )}
            </div>
          </div>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 self-start sm:self-auto cursor-pointer"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.18-2.587-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.007c.106.005.249-.04.39.299.144.347.491 1.2.534 1.288.043.088.072.19.014.305-.058.115-.087.187-.173.289l-.26.305c-.087.087-.179.18-.077.355.101.174.453.748.971 1.21.668.595 1.232.78 1.406.867.174.086.275.072.376-.044.101-.116.433-.506.549-.679.116-.174.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.044.073.044.42-.1 1.825zM12 2C6.477 2 2 6.477 2 12c0 1.891.527 3.662 1.444 5.176L2 22l4.981-1.306C8.424 21.528 10.151 22 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
            </svg>
            <span>Consultar por mi plan</span>
          </a>
        </div>

        {/* Plan Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5">
          <div className="p-3.5 rounded-2xl bg-white/70 border border-neutral-200/60">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
              Próximo Vencimiento
            </span>
            <span className="text-sm font-bold text-neutral-900 mt-0.5 block">
              {store.planEndsAt
                ? new Date(store.planEndsAt).toLocaleDateString('es-AR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })
                : 'Sin fecha de caducidad'}
            </span>
            {daysRemaining !== null && (
              <span className={`text-[11px] font-semibold mt-1 block ${
                isExpired ? 'text-rose-600' : isExpiringSoon ? 'text-amber-600' : 'text-neutral-500'
              }`}>
                {isExpired
                  ? `Venció hace ${Math.abs(daysRemaining)} días`
                  : `Quedan ${daysRemaining} días de servicio`}
              </span>
            )}
          </div>

          {/* Paid plan details */}
          {store.plan === 'paid' && (
            <>
              <div className="p-3.5 rounded-2xl bg-white/70 border border-neutral-200/60">
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
                  Abono del Período
                </span>
                <span className="text-sm font-bold text-neutral-900 mt-0.5 block">
                  ${periodAmount.toLocaleString('es-AR')}
                </span>
                <span className="text-[11px] text-neutral-500 mt-1 block">
                  {periodDebt > 0 ? (
                    <span className="text-amber-700 font-bold">Saldo pend.: ${periodDebt.toLocaleString('es-AR')}</span>
                  ) : (
                    <span className="text-emerald-700 font-bold">Al día (Pagado)</span>
                  )}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/70 border border-neutral-200/60">
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
                  Último Pago Registrado
                </span>
                <span className="text-sm font-bold text-neutral-900 mt-0.5 block">
                  {activePeriod?.lastPaymentDate
                    ? new Date(activePeriod.lastPaymentDate).toLocaleDateString('es-AR')
                    : 'Sin pagos registrados'}
                </span>
                <span className="text-[11px] text-neutral-500 mt-1 block">
                  {activePeriod?.paidAmount ? `Total pagado: $${activePeriod.paidAmount.toLocaleString('es-AR')}` : 'Período en curso'}
                </span>
              </div>
            </>
          )}

          {/* Friends & Family Feedback Action */}
          {store.plan === 'friends_family' && (
            <div className="sm:col-span-2 p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-indigo-950 block">
                  Plan Especial Friends & Family
                </span>
                <p className="text-[11px] text-indigo-800">
                  Tu opinión nos ayuda a mejorar. Compartinos sugerencias o ideas cuando quieras.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFfModalOpen(true)}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer shrink-0"
              >
                Dar feedback
              </button>
            </div>
          )}
        </div>

        {/* Extensions List (if any granted) */}
        {store.extensions && store.extensions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-neutral-200/60">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-2">
              Extensiones Otorgadas
            </span>
            <div className="space-y-1.5">
              {store.extensions.map((ext, idx) => (
                <div
                  key={ext.id || idx}
                  className="flex items-center justify-between text-xs py-1.5 px-3 rounded-xl bg-white/80 border border-neutral-100"
                >
                  <span className="font-semibold text-neutral-800">
                    Extensión de {ext.days} días
                  </span>
                  <span className="text-neutral-500 text-[11px]">
                    {ext.reason || 'Sin motivo'} • {ext.date}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Personal Information Form */}
      <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-sm p-6 sm:p-8 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
            Datos del Titular
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Información del responsable del comercio. Podés editar tu nombre, apellido y celular.
          </p>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-800 mb-1">
                Nombre
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Tu nombre..."
                className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-800 mb-1">
                Apellido
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Tu apellido..."
                className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-800 mb-1">
                Celular / WhatsApp de Contacto
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej: 11 2345 6789"
                className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-800 mb-1">
                Correo Electrónico (Google)
              </label>
              <div className="relative">
                <input
                  type="email"
                  disabled
                  value={store.ownerEmail || 'Sin email'}
                  className="w-full px-3.5 py-2.5 bg-neutral-100 border border-neutral-200 rounded-xl text-sm text-neutral-500 cursor-not-allowed select-none font-mono"
                />
                <span className="material-symbols-outlined text-[16px] text-neutral-400 absolute right-3 top-1/2 -translate-y-1/2">
                  lock
                </span>
              </div>
              <span className="text-[10px] text-neutral-400 mt-1 block">
                El email está vinculado a tu cuenta de Google y no puede modificarse desde aquí.
              </span>
            </div>
          </div>

          {profileSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold flex items-center gap-2 animate-in fade-in">
              <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
              <span>¡Datos personales actualizados correctamente!</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSavingProfile}
            className="px-5 py-2.5 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isSavingProfile ? 'Guardando cambios...' : 'Guardar Datos Personales'}
          </button>
        </form>
      </div>

      {/* Danger Zone: Close Store */}
      <div className="bg-white rounded-3xl border border-red-200 shadow-xs p-6 sm:p-8 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-red-600 uppercase tracking-wider mb-1">
              <span className="material-symbols-outlined text-[16px]">warning</span>
              <span>Bajar las Persianas</span>
            </div>
            <h2 className="text-lg font-bold text-neutral-900">
              Cerrar Tienda Online
            </h2>
            <p className="text-xs text-neutral-500 mt-1 max-w-xl">
              Al cerrar la tienda, tu catálogo público quedará en modo <em>"Tienda temporalmente fuera de servicio"</em>. 
              <strong> Tus datos, productos y fotos NO serán eliminados</strong> y podrás solicitar la reactivación cuando desees.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsCloseModalOpen(true);
              setConfirmationInput('');
              setSelectedReasons([]);
              setClosureComment('');
              setClosureError(null);
            }}
            className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0"
          >
            Cerrar Tienda
          </button>
        </div>
      </div>

      {/* Friends & Family Feedback Modal */}
      {isFfModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-neutral-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h3 className="text-base font-bold text-neutral-900">
                Tu opinión nos ayuda a crecer ✨
              </h3>
              <button
                onClick={() => setIsFfModalOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-black"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSendFfFeedback} className="mt-4 space-y-4">
              <p className="text-xs text-neutral-600 leading-relaxed">
                ¿Qué te pareció la plataforma hasta ahora? ¿Hay alguna función o ajuste que te gustaría ver?
              </p>

              <textarea
                required
                rows={4}
                value={ffFeedbackText}
                onChange={(e) => setFfFeedbackText(e.target.value)}
                placeholder="Escribí tu comentario, idea o sugerencia aquí..."
                className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black"
              />

              {ffSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>¡Muchas gracias por tu feedback! Ha sido guardado.</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFfModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-neutral-500 hover:text-black"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSendingFf || !ffFeedbackText.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
                >
                  {isSendingFf ? 'Enviando...' : 'Enviar Feedback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Store Modal with Multiple Reasons + Confirmation */}
      {isCloseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-neutral-100 my-8 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2 text-red-600 font-bold text-sm">
                <span className="material-symbols-outlined text-[20px]">storefront</span>
                <span>Bajar las Persianas de {store.name}</span>
              </div>
              <button
                onClick={() => setIsCloseModalOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-black"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleConfirmCloseStore} className="mt-4 space-y-4">
              <p className="text-xs text-neutral-600 leading-relaxed">
                Lamentamos que decidas cerrar tu catálogo online. Ayudanos a entender los motivos seleccionando las opciones correspondientes:
              </p>

              {/* Multiple selection reasons */}
              <div className="space-y-2">
                {CLOSURE_REASONS.map((reason) => {
                  const isChecked = selectedReasons.includes(reason);
                  return (
                    <label
                      key={reason}
                      onClick={() => toggleClosureReason(reason)}
                      className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-semibold cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-neutral-900 text-white border-black'
                          : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // handled by label onClick
                        className="sr-only"
                      />
                      <span className="material-symbols-outlined text-[16px]">
                        {isChecked ? 'check_box' : 'check_box_outline_blank'}
                      </span>
                      <span>{reason}</span>
                    </label>
                  );
                })}
              </div>

              {/* Textarea */}
              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">
                  ¿Querés dejarnos algún comentario o sugerencia adicional?
                </label>
                <textarea
                  rows={3}
                  value={closureComment}
                  onChange={(e) => setClosureComment(e.target.value)}
                  placeholder="Escribí aquí lo que desees..."
                  className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              {/* Confirmation Input */}
              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 space-y-1.5">
                <label className="block text-xs font-bold text-red-950">
                  Para confirmar el cierre, escribí exactamente el nombre de la tienda:
                </label>
                <div className="text-xs font-mono font-bold text-red-700">
                  {store.name}
                </div>
                <input
                  type="text"
                  required
                  value={confirmationInput}
                  onChange={(e) => setConfirmationInput(e.target.value)}
                  placeholder="Escribí el nombre de la tienda..."
                  className="w-full px-3 py-2 bg-white border border-red-300 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              {closureError && (
                <div className="p-3 bg-red-100 text-red-800 rounded-xl text-xs font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <span>{closureError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCloseModalOpen(false)}
                  disabled={isClosingStore}
                  className="px-4 py-2.5 text-xs font-bold text-neutral-600 hover:text-black transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isClosingStore}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  {isClosingStore ? 'Cerrando tienda...' : 'Bajar las Persianas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
