import React, { useState } from 'react';
import { StoreSettings } from '../types';

interface AdminLoginViewProps {
  settings: StoreSettings;
  onSuccess: () => void;
  onBackToStore: () => void;
}

export const AdminLoginView: React.FC<AdminLoginViewProps> = ({
  settings,
  onSuccess,
  onBackToStore
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const activePassword = settings.adminPassword?.trim();
    const trimmedInput = password.trim();

    if (activePassword && trimmedInput === activePassword) {
      sessionStorage.setItem('atelier_admin_auth', 'true');
      onSuccess();
    } else {
      setError('Clave de administrador incorrecta. Verifica la contraseña ingresada.');
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-xl border border-neutral-200">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-black text-white flex items-center justify-center mb-4 shadow-sm">
            <span className="material-symbols-outlined text-[28px]">lock</span>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-400 mb-1">
            Acceso Restringido
          </span>
          <h1 className="font-headline-sm text-2xl font-bold text-black tracking-tight">
            Portal de Administración
          </h1>
          <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
            Ingresa tu clave autorizada para gestionar el catálogo, inventario, ventas y configuración de <strong className="text-black">{settings.storeName || 'Atelier Studio'}</strong>.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
              Clave de Acceso
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Ingresa la contraseña..."
                autoFocus
                className="w-full pl-3.5 pr-10 py-2.5 bg-[#fbf9f8] border border-neutral-200 rounded-xl text-sm text-black focus:outline-none focus:bg-white focus:ring-1 focus:ring-black transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black transition-colors"
                title={showPassword ? 'Ocultar clave' : 'Mostrar clave'}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 animate-in fade-in duration-200">
              <span className="material-symbols-outlined text-red-600 text-[18px] shrink-0 mt-0.5">
                error
              </span>
              <p className="text-xs text-red-700 leading-snug">{error}</p>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 px-4 rounded-xl bg-black hover:bg-neutral-800 text-white text-sm font-semibold tracking-wide shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">login</span>
            <span>Ingresar al Panel de Gestión</span>
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-neutral-100 flex flex-col gap-3 text-center">
          <button
            type="button"
            onClick={onBackToStore}
            className="text-xs text-neutral-600 hover:text-black font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Volver a la Tienda Pública</span>
          </button>
        </div>
      </div>
    </div>
  );
};
