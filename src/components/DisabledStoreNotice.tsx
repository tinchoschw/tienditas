import React, { useState } from 'react';
import { Store, StoreSettings } from '../types';

interface DisabledStoreNoticeProps {
  store: Store;
  settings?: StoreSettings;
  onExitToLanding: () => void;
  onOpenSuperAdmin: () => void;
  onReenableStore?: () => Promise<void>;
}

export const DisabledStoreNotice: React.FC<DisabledStoreNoticeProps> = ({
  store,
  settings,
  onExitToLanding,
  onOpenSuperAdmin,
  onReenableStore
}) => {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [isReenabling, setIsReenabling] = useState(false);

  const isSuperAdminSession = (() => {
    try {
      return sessionStorage.getItem('atelier_superadmin_auth') === 'true';
    } catch {
      return false;
    }
  })();

  const handleCopyEmail = () => {
    navigator.clipboard.writeText('ugmartin@hotmail.com').then(() => {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2500);
    });
  };

  const mailtoHref = `mailto:ugmartin@hotmail.com?subject=${encodeURIComponent(
    `Solicitud de Reactivación de Tienda: ${store.name} (/${store.slug})`
  )}&body=${encodeURIComponent(
    `Hola Martín,\n\nMe pongo en contacto para solicitar la reactivación de mi tienda en la plataforma Tiendita.\n\n` +
      `• Nombre del Comercio: ${store.name}\n` +
      `• URL de la Tienda: /${store.slug}\n` +
      `• WhatsApp de Contacto: ${store.whatsappNumber || 'Sin especificar'}\n\n` +
      `Agradezco me indiques los pasos a seguir para restablecer el servicio del catálogo y panel de administración.\n\n` +
      `Saludos cordiales,\nAdministración de ${store.name}`
  )}`;

  const handleQuickReenable = async () => {
    if (!onReenableStore) return;
    setIsReenabling(true);
    try {
      await onReenableStore();
    } catch (e) {
      console.error('Error re-enabling store:', e);
    } finally {
      setIsReenabling(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF9F8] text-neutral-900 flex flex-col justify-between font-sans selection:bg-neutral-900 selection:text-white">
      {/* Top Header */}
      <header className="bg-white border-b border-neutral-200/80 sticky top-0 z-20 shadow-2xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onExitToLanding}
              className="p-1 rounded-xl hover:bg-neutral-100 transition-colors cursor-pointer"
              title="Ir al inicio de la plataforma"
            >
              <img
                src="/assets/aistudio/tiendita_logo_9de88685.png"
                alt="Tiendita"
                className="w-9 h-9 object-contain rounded-lg"
              />
            </button>
            <div>
              <div className="text-sm font-bold tracking-tight text-neutral-900">
                Tiendita
              </div>
              <div className="text-[11px] text-neutral-500 font-medium">
                Panel de Administración
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onExitToLanding}
              className="px-3.5 py-2 text-xs font-semibold text-neutral-700 hover:text-black hover:bg-neutral-100 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>Ir al Inicio</span>
            </button>
            <button
              onClick={onOpenSuperAdmin}
              className="px-3.5 py-2 text-xs font-semibold text-neutral-500 hover:text-neutral-900 rounded-xl transition-all cursor-pointer hidden sm:flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[15px]">admin_panel_settings</span>
              <span>Super Admin</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Notice Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 w-full space-y-6">
        {/* SuperAdmin Quick Action Banner if session detected */}
        {isSuperAdminSession && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <span className="material-symbols-outlined text-xl">admin_panel_settings</span>
              </div>
              <div>
                <div className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                  Acceso Super Administrador Detectado
                </div>
                <div className="text-xs text-amber-900">
                  Como administrador de la plataforma, podés reactivar este comercio con un solo click.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleQuickReenable}
                disabled={isReenabling}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span>{isReenabling ? 'Habilitando...' : 'Habilitar Comercio Ahora'}</span>
              </button>
              <button
                type="button"
                onClick={onOpenSuperAdmin}
                className="px-3 py-2 bg-white hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                Super Admin
              </button>
            </div>
          </div>
        )}

        {/* Store Card Header with Disabled Status */}
        <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-100">
            <div className="flex items-center gap-4">
              {store.logoUrl || settings?.logoUrl ? (
                <div className="w-16 h-16 rounded-2xl bg-neutral-50 border border-neutral-100 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                  <img
                    src={store.logoUrl || settings?.logoUrl}
                    alt={store.name}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : (
                <div
                  className="w-16 h-16 rounded-2xl text-white flex items-center justify-center font-bold text-xl shrink-0 shadow-xs uppercase"
                  style={{ backgroundColor: store.primaryColor || '#1A1A1A' }}
                >
                  {store.name.substring(0, 2)}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
                    {store.name}
                  </h1>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1.5 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <span>Sitio Deshabilitado</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-neutral-500 font-mono mt-1">
                  <span>Dirección web:</span>
                  <span className="bg-neutral-100 px-2 py-0.5 rounded text-neutral-800 font-bold">
                    /{store.slug}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-neutral-500 bg-neutral-50 px-3.5 py-2 rounded-xl border border-neutral-100 self-start sm:self-auto">
              <span className="material-symbols-outlined text-[16px] text-neutral-400">lock</span>
              <span>Panel protegido</span>
            </div>
          </div>

          {/* Alert Message Box */}
          <div className="p-5 sm:p-6 rounded-2xl bg-rose-50/70 border border-rose-200/80 flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <span className="material-symbols-outlined text-2xl">pause_circle</span>
            </div>
            <div className="space-y-1.5 flex-1">
              <h2 className="text-base font-bold text-rose-950">
                El sitio de este comercio se encuentra actualmente deshabilitado
              </h2>
              <p className="text-xs sm:text-sm text-rose-900 leading-relaxed">
                Por disposición de la administración de la plataforma, el catálogo público no está disponible para visualización ni pedidos de clientes, y las operaciones del panel de administración han sido suspendidas temporalmente.
              </p>
              <div className="pt-2 flex items-center gap-2 text-xs text-rose-800 font-medium">
                <span className="material-symbols-outlined text-[16px] text-rose-600">verified_user</span>
                <span>Tu inventario, productos y datos se encuentran guardados y protegidos con total seguridad.</span>
              </div>
            </div>
          </div>

          {/* Contact Section (Inspired by Landing Contact Component) */}
          <div className="space-y-4 pt-2">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500">
                Contacto para Reactivación
              </h3>
              <p className="text-xs text-neutral-600 mt-0.5">
                Para reactivar este sitio y volver a habilitar el catálogo público y el panel de control, por favor comunicate con el administrador de la plataforma:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
              {/* Box 1: Official Email Contact */}
              <div className="p-6 rounded-2xl bg-neutral-50 border border-neutral-200/90 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-neutral-900 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <span className="material-symbols-outlined text-[22px]">alternate_email</span>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                        Administrador de la Plataforma
                      </div>
                      <div className="text-base sm:text-lg font-black text-neutral-900 font-mono">
                        ugmartin@hotmail.com
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-neutral-600 leading-relaxed">
                    Martín U. • Administración & Soporte Tiendita. Atención personalizada para la reactivación inmediata de comercios.
                  </p>
                </div>

                <div className="space-y-2 pt-1">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <a
                      href={mailtoHref}
                      className="flex-1 py-2.5 px-4 bg-neutral-900 hover:bg-black text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 text-center shadow-xs cursor-pointer active:scale-[0.99]"
                    >
                      <span className="material-symbols-outlined text-[17px]">send</span>
                      <span>Enviar Email Directo</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyEmail}
                      className="py-2.5 px-4 bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-800 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 active:scale-[0.99]"
                      title="Copiar email al portapapeles"
                    >
                      <span className="material-symbols-outlined text-[17px] text-neutral-600">
                        {copiedEmail ? 'check' : 'content_copy'}
                      </span>
                      <span>{copiedEmail ? '¡Copiado!' : 'Copiar Email'}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200/60 rounded-xl px-3 py-1.5">
                    <span className="material-symbols-outlined text-[15px] text-emerald-600">schedule</span>
                    <span>Respuesta y reactivación en el día hábil.</span>
                  </div>
                </div>
              </div>

              {/* Box 2: Status Breakdown */}
              <div className="p-6 rounded-2xl bg-white border border-neutral-200/90 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="font-bold text-neutral-900 text-xs uppercase tracking-wider text-neutral-500">
                    Estado Actual del Servicio
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-100 flex items-center justify-between">
                      <span className="text-neutral-700 font-medium">Catálogo Público</span>
                      <span className="text-rose-700 font-semibold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">cancel</span>
                        <span>Deshabilitado</span>
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-100 flex items-center justify-between">
                      <span className="text-neutral-700 font-medium">Panel de Gestión</span>
                      <span className="text-amber-700 font-semibold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">pause</span>
                        <span>Pausado</span>
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-100 flex items-center justify-between">
                      <span className="text-neutral-700 font-medium">Base de Datos & Productos</span>
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                        <span>Guardados & Seguros</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-100 text-xs text-neutral-500 flex items-center justify-between">
                  <span>Una vez habilitado:</span>
                  <span className="font-semibold text-neutral-800">Reactivación 100% inmediata</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200/80 bg-white py-6 text-center text-xs text-neutral-500">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} Tiendita • Plataforma de Catálogos Digitales</p>
          <div className="flex items-center gap-4">
            <button
              onClick={onExitToLanding}
              className="hover:text-black cursor-pointer transition-colors"
            >
              Listado de Tiendas
            </button>
            <span>•</span>
            <button
              onClick={onOpenSuperAdmin}
              className="hover:text-black cursor-pointer transition-colors"
            >
              Acceso Super Admin
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
