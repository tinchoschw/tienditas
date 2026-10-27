import React from 'react';
import { User } from 'firebase/auth';
import { Store } from '../types';

interface StoreSelectorModalProps {
  user: User;
  stores: Store[];
  isOpen: boolean;
  onClose: () => void;
  onSelectStore: (store: Store) => void;
  onCreateNewStore: () => void;
}

export const StoreSelectorModal: React.FC<StoreSelectorModalProps> = ({
  user,
  stores,
  isOpen,
  onClose,
  onSelectStore,
  onCreateNewStore
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-neutral-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-neutral-100 pb-4">
          <div className="flex items-center gap-3">
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName || 'Usuario'} 
                className="w-11 h-11 rounded-full border border-neutral-200" 
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-neutral-900 text-white font-bold flex items-center justify-center">
                {(user.displayName || user.email || 'U')[0].toUpperCase()}
              </div>
            )}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
                Sesión Iniciada con Google
              </span>
              <h2 className="text-base font-bold text-neutral-900">
                {user.displayName || user.email}
              </h2>
              <span className="text-xs text-neutral-500 font-mono">
                {user.email}
              </span>
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

        {/* Content */}
        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-neutral-900 tracking-tight">
                Tus Tiendas Registradas
              </h3>
              <p className="text-xs text-neutral-500">
                Seleccioná a qué panel de administración querés ingresar:
              </p>
            </div>

            <button
              onClick={onCreateNewStore}
              className="px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-900 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>Crear Otra</span>
            </button>
          </div>

          {/* Stores List */}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {stores.map((st) => {
              const isSuspendedOrClosed = st.status === 'suspended' || st.status === 'closed';
              const isTrial = st.plan === 'trial';
              const isExpired = st.planEndsAt ? new Date(st.planEndsAt) < new Date() : false;

              return (
                <div
                  key={st.id}
                  className="p-4 rounded-2xl border border-neutral-200/80 hover:border-black transition-all bg-neutral-50/50 hover:bg-white flex items-center justify-between gap-3 group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-bold text-neutral-900 truncate">
                        {st.name}
                      </h4>
                      {isTrial && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                          Prueba 14d
                        </span>
                      )}
                      {st.plan === 'paid' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                          Suscripción
                        </span>
                      )}
                      {st.plan === 'internal' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-200 text-neutral-700 shrink-0">
                          Sin Vencimiento
                        </span>
                      )}
                      {isSuspendedOrClosed && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 shrink-0">
                          Pausada
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-neutral-500">
                      <span className="font-mono text-[11px] text-neutral-600">/{st.slug}</span>
                      {st.rubro && (
                        <>
                          <span>•</span>
                          <span>{st.rubro}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectStore(st)}
                    className="px-4 py-2 bg-neutral-900 group-hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <span>Entrar</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
