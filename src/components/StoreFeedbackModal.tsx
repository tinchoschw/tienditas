import React, { useState, useEffect } from 'react';
import { Store } from '../types';
import { saveStoreFeedback } from '../services/db';
import { auth } from '../firebase';

interface StoreFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  store?: Store;
  currentTab: 'storefront' | 'inventory' | 'sales' | 'brand' | 'payments' | 'account';
  showNotification?: (type: 'success' | 'error' | 'info', message: string) => void;
}

const TAB_SECTION_NAMES: Record<string, string> = {
  inventory: 'Productos e Inventario',
  sales: 'Registro de Ventas',
  brand: 'Diseño & Marca',
  payments: 'Mercado Pago & Cobros',
  account: 'Mi Cuenta',
  storefront: 'Catálogo Público'
};

export const StoreFeedbackModal: React.FC<StoreFeedbackModalProps> = ({
  isOpen,
  onClose,
  store,
  currentTab,
  showNotification
}) => {
  const defaultSection = TAB_SECTION_NAMES[currentTab] || 'General';
  const [section, setSection] = useState(defaultSection);
  const [feedbackType, setFeedbackType] = useState<'suggestion' | 'bug' | 'general'>('suggestion');
  const [text, setText] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSection(TAB_SECTION_NAMES[currentTab] || 'General');
      setText('');
      setUserEmail(auth.currentUser?.email || store?.ownerEmail || '');
    }
  }, [isOpen, currentTab, store]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    try {
      await saveStoreFeedback({
        storeId: store?.id || 'apolo',
        storeName: store?.name || 'Mi Tienda',
        userEmail: userEmail.trim() || auth.currentUser?.email || store?.ownerEmail || 'anonimo@tiendita.app',
        userName: store?.ownerFirstName || store?.name || 'Comercio',
        text: trimmed,
        section,
        type: feedbackType
      });

      if (showNotification) {
        showNotification('success', '¡Gracias por tu comentario! Lo hemos recibido para seguir mejorando la plataforma.');
      }
      onClose();
    } catch (err) {
      console.error('Error saving feedback:', err);
      if (showNotification) {
        showNotification('error', 'Error al enviar feedback. Intenta nuevamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-neutral-100 my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-neutral-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-neutral-900 text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[20px]">rate_review</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
                Enviar Comentario o Sugerencia
              </h2>
              <p className="text-xs text-neutral-500">
                Tu opinión nos ayuda a perfeccionar la plataforma
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-neutral-100 text-neutral-400 hover:text-black transition-colors cursor-pointer"
            title="Cerrar"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 mt-5">
          {/* Automatically identified section */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
              Sección Identificada
            </label>
            <div className="flex items-center gap-2">
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black"
              >
                <option value="Productos e Inventario">Productos e Inventario</option>
                <option value="Registro de Ventas">Registro de Ventas</option>
                <option value="Diseño & Marca">Diseño & Marca</option>
                <option value="Mercado Pago & Cobros">Mercado Pago & Cobros</option>
                <option value="Mi Cuenta">Mi Cuenta</option>
                <option value="Catálogo Público">Catálogo Público</option>
                <option value="General">General / Otra</option>
              </select>
            </div>
            <p className="text-[11px] text-neutral-400 mt-1">
              Detectamos que estabas en <strong className="text-neutral-700">{defaultSection}</strong>, pero podés cambiarla si te referís a otra.
            </p>
          </div>

          {/* Feedback type tabs */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
              Tipo de Mensaje
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFeedbackType('suggestion')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  feedbackType === 'suggestion'
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : 'bg-neutral-100 text-neutral-600 hover:text-black'
                }`}
              >
                <span>💡</span>
                <span>Sugerencia</span>
              </button>
              <button
                type="button"
                onClick={() => setFeedbackType('bug')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  feedbackType === 'bug'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-neutral-100 text-neutral-600 hover:text-black'
                }`}
              >
                <span>🐛</span>
                <span>Problema</span>
              </button>
              <button
                type="button"
                onClick={() => setFeedbackType('general')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  feedbackType === 'general'
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : 'bg-neutral-100 text-neutral-600 hover:text-black'
                }`}
              >
                <span>💬</span>
                <span>Consulta</span>
              </button>
            </div>
          </div>

          {/* Message Textarea */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
              Tu Comentario o Detalle *
            </label>
            <textarea
              required
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Contanos qué te gustaría mejorar, qué encontraste confuso o qué función te facilitaría el trabajo..."
              className="w-full p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 placeholder-neutral-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black resize-none"
            />
          </div>

          {/* Email verification / contact */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
              Email de Contacto (opcional para responderte)
            </label>
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="tu-email@gmail.com"
              className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-neutral-600 hover:text-black hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !text.trim()}
              className="px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-black text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">send</span>
                  <span>Enviar Feedback</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
