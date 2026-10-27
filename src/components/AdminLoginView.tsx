import React, { useState, useEffect } from 'react';
import { StoreSettings, Store } from '../types';
import { auth, signInWithGoogle, signOutUser } from '../firebase';

interface AdminLoginViewProps {
  settings: StoreSettings;
  store?: Store;
  onSuccess: () => void;
  onBackToStore: () => void;
}

export const AdminLoginView: React.FC<AdminLoginViewProps> = ({
  settings,
  store,
  onSuccess,
  onBackToStore
}) => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unauthorizedEmail, setUnauthorizedEmail] = useState<string | null>(null);

  const ownerEmail = (store?.ownerEmail || 'yunior@gmail.com').toLowerCase().trim();

  // Check if currently authenticated Google user has access
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (currentUser?.email) {
      const currentEmail = currentUser.email.toLowerCase().trim();
      if (currentEmail === ownerEmail || currentEmail === 'yunior@gmail.com') {
        sessionStorage.setItem(`atelier_admin_auth_${store?.slug || 'apolo'}`, 'true');
        onSuccess();
      }
    }
  }, [ownerEmail, store?.slug, onSuccess]);

  const handleGoogleLogin = async () => {
    setIsSigningIn(true);
    setError(null);
    setUnauthorizedEmail(null);

    try {
      const user = await signInWithGoogle();
      if (!user || !user.email) {
        setError('No se pudo obtener el email de tu cuenta de Google.');
        setIsSigningIn(false);
        return;
      }

      const email = user.email.toLowerCase().trim();
      const isOwner = email === ownerEmail;
      const isSuperAdmin = email === 'yunior@gmail.com';

      if (isOwner || isSuperAdmin) {
        sessionStorage.setItem(`atelier_admin_auth_${store?.slug || 'apolo'}`, 'true');
        onSuccess();
      } else {
        setUnauthorizedEmail(user.email);
        setError(
          `La cuenta ${user.email} no tiene permisos de administración para ${store?.name || 'esta tienda'}. El dueño registrado es ${ownerEmail}.`
        );
      }
    } catch (err: any) {
      console.error('Google Sign-In error:', err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message || 'Error al iniciar sesión con Google.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSwitchAccount = async () => {
    await signOutUser();
    setUnauthorizedEmail(null);
    setError(null);
    handleGoogleLogin();
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl border border-neutral-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-neutral-900 text-white flex items-center justify-center mb-4 shadow-sm">
            <span className="material-symbols-outlined text-[28px]">admin_panel_settings</span>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-400 mb-1">
            Acceso al Panel de Control
          </span>
          <h1 className="text-2xl font-black text-neutral-900 tracking-tight">
            Administración de Tienda
          </h1>
          <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
            Ingresá con tu cuenta verificada de Google para gestionar el catálogo, inventario, ventas y configuración de <strong className="text-neutral-900">{store?.name || settings.storeName || 'tu tienda'}</strong>.
          </p>
        </div>

        {/* Google Sign-In Action */}
        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={isSigningIn}
            className="w-full py-3.5 px-4 rounded-2xl border-2 border-neutral-200 hover:border-black bg-white hover:bg-neutral-50 text-neutral-900 text-xs sm:text-sm font-bold shadow-xs transition-all active:scale-[0.99] flex items-center justify-center gap-3 cursor-pointer"
          >
            {isSigningIn ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                <span>Conectando con Google...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Ingresar con Google</span>
              </>
            )}
          </button>

          {/* Owner hint badge */}
          {store?.ownerEmail && (
            <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/80 text-center">
              <span className="text-[11px] text-neutral-400 uppercase tracking-wider block font-semibold mb-0.5">
                Titular registrado
              </span>
              <span className="text-xs font-mono font-medium text-neutral-700">
                {store.ownerEmail}
              </span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex flex-col gap-2 animate-in fade-in">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-red-600 text-[18px] shrink-0 mt-0.5">
                  error
                </span>
                <p className="text-xs text-red-700 leading-snug">{error}</p>
              </div>

              {unauthorizedEmail && (
                <button
                  type="button"
                  onClick={handleSwitchAccount}
                  className="mt-1 py-1.5 px-3 rounded-xl bg-red-100 hover:bg-red-200 text-red-900 text-xs font-bold transition-colors cursor-pointer self-start"
                >
                  Cambiar cuenta de Google
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-6 border-t border-neutral-100 flex flex-col gap-3 text-center">
          <button
            type="button"
            onClick={onBackToStore}
            className="text-xs text-neutral-600 hover:text-black font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Volver al Catálogo Público</span>
          </button>
        </div>
      </div>
    </div>
  );
};
