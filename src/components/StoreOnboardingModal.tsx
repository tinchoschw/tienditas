import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Store } from '../types';
import { createNewStore, generateUniqueSlug } from '../services/db';

interface StoreOnboardingModalProps {
  user: User;
  existingStores: Store[];
  isOpen: boolean;
  onClose: () => void;
  onStoreCreated: (store: Store) => void;
}

const RUBROS_OPTIONS = [
  'Indumentaria y Moda',
  'Calzado y Marroquinería',
  'Panadería, Pastelería y Cafetería',
  'Gastronomía, Rotisería y Viandas',
  'Bazar, Hogar y Decoración',
  'Belleza, Cosmética y Perfumería',
  'Accesorios, Joyas y Relojes',
  'Deportes, Fitness y Aire Libre',
  'Librería, Regalería y Juguetes',
  'Salud, Dietética y Nutrición',
  'Otro'
];

export const StoreOnboardingModal: React.FC<StoreOnboardingModalProps> = ({
  user,
  existingStores,
  isOpen,
  onClose,
  onStoreCreated
}) => {
  const [storeName, setStoreName] = useState('');
  const [slug, setSlug] = useState('');
  const [isCustomSlug, setIsCustomSlug] = useState(false);
  const [rubro, setRubro] = useState(RUBROS_OPTIONS[0]);
  const [otherRubro, setOtherRubro] = useState('');
  const [phone, setPhone] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate slug from store name
  useEffect(() => {
    if (!isCustomSlug && storeName.trim()) {
      setSlug(generateUniqueSlug(storeName, existingStores));
    }
  }, [storeName, isCustomSlug, existingStores]);

  if (!isOpen) return null;

  // Split Google displayName into first and last name
  const nameParts = (user.displayName || '').trim().split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!storeName.trim()) {
      setError('Por favor ingresá el nombre de tu tienda.');
      return;
    }
    if (!phone.trim()) {
      setError('Por favor ingresá tu número de celular o WhatsApp de contacto.');
      return;
    }
    if (rubro === 'Otro' && !otherRubro.trim()) {
      setError('Por favor especificá el rubro de tu tienda.');
      return;
    }
    if (!acceptedTerms) {
      setError('Debes aceptar los Términos y Condiciones para continuar.');
      return;
    }

    const finalRubro = rubro === 'Otro' ? otherRubro.trim() : rubro;
    const finalSlug = slug.trim() || generateUniqueSlug(storeName, existingStores);

    setIsSubmitting(true);
    try {
      const created = await createNewStore({
        name: storeName.trim(),
        slug: finalSlug,
        ownerEmail: user.email || '',
        ownerFirstName: firstName,
        ownerLastName: lastName,
        ownerPhone: phone.trim(),
        rubro: finalRubro,
        whatsappNumber: phone.trim(),
        termsAcceptedAt: new Date().toISOString()
      });

      onStoreCreated(created);
    } catch (err: any) {
      console.error('Error creating store:', err);
      setError(err.message || 'No se pudo crear la tienda. Verificá tu conexión e intentá de nuevo.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-neutral-100 my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header with Google User details */}
        <div className="flex items-start justify-between gap-4 border-b border-neutral-100 pb-5">
          <div className="flex items-center gap-3">
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName || 'Usuario'} 
                className="w-12 h-12 rounded-full border-2 border-neutral-200 shadow-xs" 
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-neutral-900 text-white font-bold flex items-center justify-center text-lg">
                {(user.displayName || user.email || 'U')[0].toUpperCase()}
              </div>
            )}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
                Cuenta de Google Verificada
              </span>
              <h2 className="text-base sm:text-lg font-bold text-neutral-900 leading-tight">
                {user.displayName || 'Comerciante'}
              </h2>
              <span className="text-xs text-neutral-500 font-mono">
                {user.email}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-neutral-100 text-neutral-400 hover:text-black transition-colors"
            title="Cerrar"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-[11px] font-semibold mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>14 días de prueba gratis · Activación inmediata</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
              Creá tu Tienda Online
            </h1>
            <p className="text-xs text-neutral-500 mt-1">
              Completá los datos de tu negocio para generar tu catálogo digital con pedidos directos a WhatsApp.
            </p>
          </div>

          {/* Nombre de la tienda */}
          <div>
            <label className="block text-xs font-bold text-neutral-800 mb-1">
              Nombre de tu Tienda / Marca *
            </label>
            <input
              type="text"
              required
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="Ej: Calipso Moda, La Panera Artesanal, Apolo..."
              className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black transition-all"
            />
            {storeName.trim() && (
              <p className="text-[11px] text-neutral-500 mt-1 flex items-center gap-1">
                <span>Tu link público será:</span>
                <span className="font-mono font-semibold text-black bg-neutral-100 px-1.5 py-0.5 rounded">
                  /{slug}
                </span>
              </p>
            )}
          </div>

          {/* Rubro */}
          <div>
            <label className="block text-xs font-bold text-neutral-800 mb-1">
              Rubro del Comercio *
            </label>
            <select
              value={rubro}
              onChange={(e) => setRubro(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black transition-all"
            >
              {RUBROS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>

            {rubro === 'Otro' && (
              <input
                type="text"
                required
                value={otherRubro}
                onChange={(e) => setOtherRubro(e.target.value)}
                placeholder="Especificá tu rubro..."
                className="w-full mt-2 px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black transition-all"
              />
            )}
          </div>

          {/* Celular / WhatsApp */}
          <div>
            <label className="block text-xs font-bold text-neutral-800 mb-1">
              Celular / WhatsApp del Titular *
            </label>
            <div className="relative">
              <span className="material-symbols-outlined text-[18px] text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2">
                phone
              </span>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej: 11 2345 6789 (con código de área)"
                className="w-full pl-9 pr-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black transition-all"
              />
            </div>
            <p className="text-[11px] text-neutral-400 mt-1">
              Te contactaremos por este WhatsApp para acompañarte con el alta y tus clientes te enviarán sus pedidos aquí.
            </p>
          </div>

          {/* Checkbox Obligatorio de Términos y Condiciones */}
          <div className="pt-2">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-black focus:ring-black border-neutral-300"
              />
              <span className="text-xs text-neutral-700 leading-snug">
                He leído y acepto los{' '}
                <button
                  type="button"
                  onClick={() => setShowTermsModal(true)}
                  className="font-bold underline text-black hover:text-neutral-600"
                >
                  Términos y Condiciones
                </button>{' '}
                y la{' '}
                <button
                  type="button"
                  onClick={() => setShowTermsModal(true)}
                  className="font-bold underline text-black hover:text-neutral-600"
                >
                  Política de Privacidad
                </button>
                . *
              </span>
            </label>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2 animate-in fade-in">
              <span className="material-symbols-outlined text-[16px] text-red-600 shrink-0 mt-0.5">
                error
              </span>
              <span>{error}</span>
            </div>
          )}

          {/* Submit Action */}
          <div className="pt-3 flex flex-col gap-2">
            <button
              type="submit"
              disabled={isSubmitting || !acceptedTerms || !storeName.trim() || !phone.trim()}
              className="w-full py-3.5 px-4 rounded-xl bg-neutral-900 hover:bg-black disabled:opacity-40 text-white text-xs sm:text-sm font-bold tracking-wide shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  <span>Generando tu tienda online...</span>
                </>
              ) : (
                <>
                  <span>Crear mi Tienda e Ingresar</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full py-2.5 text-xs text-neutral-500 hover:text-black font-semibold transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>

      {/* Modal de Términos y Condiciones */}
      {showTermsModal && (
        <div className="fixed inset-0 z-60 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-neutral-200 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h3 className="text-base font-bold text-neutral-900">
                Términos y Condiciones del Servicio
              </h3>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-black"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 text-xs text-neutral-600 space-y-3 leading-relaxed">
              <p>
                <strong>1. Objeto del Servicio:</strong> La plataforma provee herramientas de software como servicio para la creación, exhibición y gestión de catálogos digitales en línea, control de stock y enlace de pedidos hacia WhatsApp y Mercado Pago.
              </p>
              <p>
                <strong>2. Período de Prueba:</strong> Cada nuevo comercio registrado accede a catorce (14) días de prueba sin cargo. Finalizado el período de prueba, el comercio podrá optar por abonar la suscripción mensual vigente para mantener activo su catálogo público.
              </p>
              <p>
                <strong>3. Cobros e Intermediación:</strong> La plataforma no cobra comisión por venta sobre las transacciones del comercio. Los cobros realizados a través de Mercado Pago o transferencias bancarias ingresan directamente en las cuentas de titularidad exclusiva de cada comercio.
              </p>
              <p>
                <strong>4. Responsabilidad sobre Productos:</strong> El comercio es el único y exclusivo responsable de la autenticidad, calidad, precios, stock, entrega y facturación de los productos exhibidos en su catálogo.
              </p>
              <p>
                <strong>5. Privacidad y Datos:</strong> La plataforma resguarda la información de contacto provista y no comercializa datos de clientes ni de comercios con terceros.
              </p>
            </div>

            <div className="pt-3 border-t border-neutral-100 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setAcceptedTerms(true);
                  setShowTermsModal(false);
                }}
                className="px-4 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl"
              >
                Entendido y Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
