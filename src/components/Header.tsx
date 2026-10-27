import React, { useState, useEffect } from 'react';
import { StoreSettings, StoreFeatureFlags, Store } from '../types';

interface HeaderProps {
  isAdminView: boolean;
  currentTab: 'storefront' | 'inventory' | 'sales' | 'brand' | 'payments' | 'account';
  setCurrentTab: (tab: 'storefront' | 'inventory' | 'sales' | 'brand' | 'payments' | 'account') => void;
  cartCount: number;
  cartTotal?: number;
  onOpenCart: () => void;
  settings: StoreSettings;
  store?: Store;
  supportWhatsApp?: string;
  isSettingsLoaded?: boolean;
  isSandbox?: boolean;
  featureFlags?: StoreFeatureFlags;
  onExitAdmin: () => void;
  onLogoutAdmin: () => void;
  onOpenHelpAssistant?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isAdminView,
  currentTab,
  setCurrentTab,
  cartCount,
  cartTotal = 0,
  onOpenCart,
  settings,
  store,
  supportWhatsApp = '5491122334455',
  isSettingsLoaded = true,
  isSandbox = false,
  featureFlags,
  onExitAdmin,
  onLogoutAdmin,
  onOpenHelpAssistant
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close admin menu when Escape key is pressed
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);
  const daysRemaining = (() => {
    if (!store?.planEndsAt) return null;
    const diff = new Date(store.planEndsAt).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  })();

  const isExpired = store?.status === 'suspended' || store?.status === 'closed' || (daysRemaining !== null && daysRemaining <= 0);
  const isExpiringSoon = !isExpired && daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 7;
  const hasAccountAlert = isExpired || isExpiringSoon;

  const cleanSupportPhone = (supportWhatsApp || '5491122334455').replace(/[^0-9]/g, '');
  const renewalWhatsappUrl = `https://wa.me/${cleanSupportPhone}?text=${encodeURIComponent(
    `Hola! Quiero renovar / consultar por mi plan para la tienda "${store?.name || settings.storeName}" (/${store?.slug || 'tienda'}).`
  )}`;

  const scale = typeof settings.logoScale === 'number' && settings.logoScale > 0 ? settings.logoScale : 100;
  // Dynamic scale calculation: Base 48px at 100%. At 40% = 19px. At 250% = 120px. At 500% = 240px.
  const logoHeightPx = Math.max(16, Math.round(48 * (scale / 100)));

  return (
    <header 
      className="sticky top-0 z-40 w-full backdrop-blur-md border-b border-[#efeded] shadow-[0_1px_8px_rgba(0,0,0,0.03)] transition-all duration-200"
      style={{
        backgroundColor: isAdminView ? '#fbf9f8f5' : `${(isSettingsLoaded ? settings.backgroundColor : '#ffffff') || '#ffffff'}f5`
      }}
    >
      <div 
        className="w-full px-4 sm:px-8 max-w-[1600px] mx-auto flex items-center justify-between gap-4 py-2 transition-all duration-200"
        style={{
          minHeight: `${Math.max(64, logoHeightPx + 16)}px`
        }}
      >
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          <button 
            onClick={onExitAdmin}
            className="flex items-center gap-2 sm:gap-3 text-left focus:outline-none group py-1 min-w-0"
            title={settings.storeName ? `Ir a la portada de ${settings.storeName}` : 'Ir a la portada'}
          >
            {settings.logoUrl ? (
              <img 
                src={settings.logoUrl} 
                alt={settings.storeName || 'Logo'}
                style={{ 
                  height: `${logoHeightPx}px`,
                  maxHeight: '280px',
                  width: 'auto'
                }}
                className="w-auto object-contain transition-all duration-150 group-hover:scale-[1.02] shrink-0"
              />
            ) : settings.storeName ? (
              <div className="flex items-center gap-1 font-bold text-base sm:text-lg tracking-tight uppercase shrink-0">
                <span style={{ color: settings.primaryColor || '#1A1A1A' }}>{settings.storeName}</span>
              </div>
            ) : !isSettingsLoaded ? (
              <div className="h-8 w-28 sm:w-36 bg-neutral-200/50 rounded-lg animate-pulse" />
            ) : (
              <div className="flex items-center gap-1 font-bold text-base sm:text-lg tracking-tight uppercase shrink-0">
                <span style={{ color: settings.primaryColor || '#1A1A1A' }}>Mi Tienda</span>
              </div>
            )}
            {settings.logoUrl && settings.storeName && (
              <span 
                className="font-headline-sm text-sm sm:text-[17px] tracking-tight font-semibold uppercase inline-block truncate max-w-[150px] sm:max-w-[320px]"
                style={{ color: settings.primaryColor || '#1A1A1A' }}
              >
                {settings.storeName}
              </span>
            )}
          </button>

          {/* Sandbox Indicator */}
          {isSandbox && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold uppercase tracking-wider shrink-0" title="Tienda de pruebas Sandbox">
              <span>🧪</span>
              <span>Sandbox</span>
            </div>
          )}

          {/* Admin Mode Status Badge */}
          {isAdminView && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-900 text-white text-[11px] font-semibold tracking-wide shrink-0">
              <span className="material-symbols-outlined text-[14px] text-amber-400">admin_panel_settings</span>
              <span>Panel de Control</span>
            </div>
          )}
        </div>

        {/* ADMIN VIEW NAVIGATION (Clean unified menu eliminating top bar button clutter) */}
        {isAdminView ? (
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Active Section Pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 text-neutral-800 text-xs font-semibold border border-neutral-200/70">
              <span className="material-symbols-outlined text-[16px] text-neutral-600">
                {currentTab === 'inventory'
                  ? 'inventory_2'
                  : currentTab === 'sales'
                  ? 'receipt_long'
                  : currentTab === 'brand'
                  ? 'palette'
                  : currentTab === 'payments'
                  ? 'credit_card'
                  : 'manage_accounts'}
              </span>
              <span>
                {currentTab === 'inventory'
                  ? 'Productos e Inventario'
                  : currentTab === 'sales'
                  ? 'Registro de Ventas'
                  : currentTab === 'brand'
                  ? 'Diseño & Marca'
                  : currentTab === 'payments'
                  ? 'Mercado Pago'
                  : 'Mi Cuenta'}
              </span>
            </div>

            {/* Menú Toggle Button Container with Dropdown */}
            <div className="relative">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-neutral-900 hover:bg-black text-white text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-95"
                title="Abrir menú de navegación y opciones"
                aria-expanded={mobileMenuOpen}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {mobileMenuOpen ? 'close' : 'menu'}
                </span>
                <span>{mobileMenuOpen ? 'Cerrar' : 'Menú'}</span>
                {hasAccountAlert && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-pulse" />
                )}
              </button>

              {/* Admin Unified Menu (Compact floating card anchored right) */}
              {mobileMenuOpen && (
                <>
                  {/* Dismiss Backdrop */}
                  <div
                    className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity"
                    onClick={() => setMobileMenuOpen(false)}
                  />

                  {/* Menu Floating Card */}
                  <div 
                    className="absolute right-0 top-full mt-2.5 z-50 w-[min(340px,calc(100vw-2rem))] bg-white rounded-2xl shadow-2xl border border-neutral-200/90 p-3.5 sm:p-4 animate-in fade-in zoom-in-95 duration-150"
                    role="menu"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                        <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                          Navegación del Administrador
                        </span>
                        <span className="text-xs text-neutral-500 font-medium truncate max-w-[170px]">
                          {settings.storeName || 'Mi Tienda'}
                        </span>
                      </div>

                      {/* Expiration / Plan Alert Banner */}
                      {(isExpired || isExpiringSoon) && (
                        <div className={`p-3 rounded-2xl border text-xs flex flex-col gap-2 ${
                          isExpired 
                            ? 'bg-rose-50 border-rose-200 text-rose-950' 
                            : 'bg-amber-50 border-amber-200 text-amber-950'
                        }`}>
                          <div className="flex items-center gap-1.5 font-bold">
                            <span className="material-symbols-outlined text-[16px]">
                              {isExpired ? 'error' : 'warning'}
                            </span>
                            <span>
                              {isExpired ? 'Tienda pausada o vencida' : `Tu plan vence en ${daysRemaining} días`}
                            </span>
                          </div>
                          <p className="text-[11px] leading-snug text-neutral-600">
                            {isExpired 
                              ? 'Tu período de servicio ha finalizado. Comunicate para reactivar tu catálogo.' 
                              : 'Renová tu suscripción para seguir recibiendo pedidos online sin interrupciones.'}
                          </p>
                          <a
                            href={renewalWhatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-1.5 px-3 bg-[#25D366] hover:bg-[#1EBE5D] text-white text-[11px] font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-2xs"
                          >
                            <span>Quiero renovar / consultar por mi plan</span>
                          </a>
                        </div>
                      )}

                      <div className="flex flex-col gap-1.5">
                        <button
                          onClick={() => {
                            setMobileMenuOpen(false);
                            setCurrentTab('inventory');
                          }}
                          className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                            currentTab === 'inventory'
                              ? 'bg-black text-white shadow-xs'
                              : 'text-neutral-700 hover:bg-neutral-100 hover:text-black'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="material-symbols-outlined text-[18px]">inventory_2</span>
                            <span>Productos e Inventario</span>
                          </div>
                          {currentTab === 'inventory' && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          )}
                        </button>

                        {featureFlags?.salesModule !== false && (
                          <button
                            onClick={() => {
                              setMobileMenuOpen(false);
                              setCurrentTab('sales');
                            }}
                            className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                              currentTab === 'sales'
                                ? 'bg-black text-white shadow-xs'
                                : 'text-neutral-700 hover:bg-neutral-100 hover:text-black'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                              <span>Registro de Ventas</span>
                            </div>
                            {currentTab === 'sales' && (
                              <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            )}
                          </button>
                        )}

                        {featureFlags?.brandCustomizer !== false && (
                          <button
                            onClick={() => {
                              setMobileMenuOpen(false);
                              setCurrentTab('brand');
                            }}
                            className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                              currentTab === 'brand'
                                ? 'bg-black text-white shadow-xs'
                                : 'text-neutral-700 hover:bg-neutral-100 hover:text-black'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="material-symbols-outlined text-[18px]">palette</span>
                              <span>Diseño & Marca</span>
                            </div>
                            {currentTab === 'brand' && (
                              <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            )}
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setMobileMenuOpen(false);
                            setCurrentTab('payments');
                          }}
                          className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                            currentTab === 'payments'
                              ? 'bg-[#009ee3] text-white shadow-xs'
                              : 'text-neutral-700 hover:bg-[#009ee3]/10 hover:text-[#009ee3]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="material-symbols-outlined text-[18px]">credit_card</span>
                            <span>Mercado Pago & Cobros</span>
                          </div>
                          {currentTab === 'payments' && (
                            <span className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </button>

                        {/* Mi Cuenta Navigation Item */}
                        <button
                          onClick={() => {
                            setMobileMenuOpen(false);
                            setCurrentTab('account');
                          }}
                          className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                            currentTab === 'account'
                              ? 'bg-black text-white shadow-xs'
                              : 'text-neutral-700 hover:bg-neutral-100 hover:text-black'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
                            <span>Mi Cuenta</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {hasAccountAlert && (
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Atención requerida" />
                            )}
                            {currentTab === 'account' && (
                              <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            )}
                          </div>
                        </button>
                      </div>

                      {/* Bottom Action Group */}
                      <div className="pt-3 border-t border-neutral-100 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => {
                              setMobileMenuOpen(false);
                              onExitAdmin();
                            }}
                            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold transition-all cursor-pointer border border-neutral-200/70 shadow-xs"
                            title="Ver la tienda como cliente"
                          >
                            <span className="material-symbols-outlined text-[17px]">visibility</span>
                            <span>Ver Tienda</span>
                          </button>

                          {onOpenHelpAssistant && (
                            <button
                              onClick={() => {
                                setMobileMenuOpen(false);
                                onOpenHelpAssistant();
                              }}
                              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 text-xs font-semibold transition-all cursor-pointer border border-amber-200 shadow-xs"
                              title="Abrir Asistente de Ayuda"
                            >
                              <span className="text-[14px]">✨</span>
                              <span>Ayuda</span>
                            </button>
                          )}
                        </div>

                        <button
                          onClick={() => {
                            setMobileMenuOpen(false);
                            onLogoutAdmin();
                          }}
                          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-red-200 bg-red-50/60 hover:bg-red-100/60 text-red-700 text-xs font-semibold transition-colors cursor-pointer"
                          title="Cerrar sesión de administración"
                        >
                          <span className="material-symbols-outlined text-[17px]">logout</span>
                          <span>Cerrar Sesión</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          /* CLIENT STOREFRONT VIEW (Icono del chango, numerito de cantidad y total acumulado) */
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={onOpenCart}
              style={{
                backgroundColor: settings.primaryColor || '#1A1A1A',
                color: '#ffffff'
              }}
              className="flex items-center gap-2 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl hover:opacity-90 text-white transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
              title="Carrito de compras"
            >
              <div className="relative flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px] sm:text-[22px]">shopping_cart</span>
                <span 
                  className="absolute -top-2 -right-2 px-1 py-0.2 rounded-full text-[10px] font-bold min-w-[17px] text-center leading-tight shadow-xs"
                  style={{
                    backgroundColor: settings.secondaryColor || '#ef4444',
                    color: '#ffffff'
                  }}
                >
                  {cartCount}
                </span>
              </div>
              {cartTotal !== undefined && (
                <span className="text-xs sm:text-sm font-bold tracking-tight pl-1 border-l border-white/25">
                  ${cartTotal.toLocaleString('es-AR')}
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
