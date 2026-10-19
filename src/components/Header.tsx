import React, { useState } from 'react';
import { StoreSettings, StoreFeatureFlags } from '../types';

interface HeaderProps {
  isAdminView: boolean;
  currentTab: 'storefront' | 'inventory' | 'sales' | 'brand' | 'payments';
  setCurrentTab: (tab: 'storefront' | 'inventory' | 'sales' | 'brand' | 'payments') => void;
  cartCount: number;
  cartTotal?: number;
  onOpenCart: () => void;
  settings: StoreSettings;
  isSettingsLoaded?: boolean;
  isSandbox?: boolean;
  featureFlags?: StoreFeatureFlags;
  onExitAdmin: () => void;
  onLogoutAdmin: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isAdminView,
  currentTab,
  setCurrentTab,
  cartCount,
  cartTotal = 0,
  onOpenCart,
  settings,
  isSettingsLoaded = true,
  isSandbox = false,
  featureFlags,
  onExitAdmin,
  onLogoutAdmin
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

        {/* ADMIN VIEW NAVIGATION TABS (Visible ONLY to authenticated Admin) */}
        {isAdminView ? (
          <>
            <nav className="hidden lg:flex items-center gap-1 bg-[#f5f3f3] p-1 rounded-xl">
              <button
                onClick={() => setCurrentTab('inventory')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                  currentTab === 'inventory'
                    ? 'bg-black text-white shadow-sm'
                    : 'text-[#444748] hover:text-black hover:bg-white/60'
                }`}
              >
                Productos e Inventario
              </button>
              {featureFlags?.salesModule !== false && (
                <button
                  onClick={() => setCurrentTab('sales')}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                    currentTab === 'sales'
                      ? 'bg-black text-white shadow-sm'
                      : 'text-[#444748] hover:text-black hover:bg-white/60'
                  }`}
                >
                  Registro de Ventas
                </button>
              )}
              {featureFlags?.brandCustomizer !== false && (
                <button
                  onClick={() => setCurrentTab('brand')}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                    currentTab === 'brand'
                      ? 'bg-black text-white shadow-sm'
                      : 'text-[#444748] hover:text-black hover:bg-white/60'
                  }`}
                >
                  Diseño & Marca
                </button>
              )}
              <button
                onClick={() => setCurrentTab('payments')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer flex items-center gap-1.5 ${
                  currentTab === 'payments'
                    ? 'bg-[#009ee3] text-white shadow-sm'
                    : 'text-[#444748] hover:text-[#009ee3] hover:bg-white/60'
                }`}
                title="Configuración de cobros con Mercado Pago"
              >
                <span className="material-symbols-outlined text-[15px]">credit_card</span>
                <span>Mercado Pago</span>
              </button>
            </nav>


            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={onExitAdmin}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#efeded] hover:bg-neutral-200 text-black text-xs font-medium transition-colors"
                title="Ver la tienda como cliente"
              >
                <span className="material-symbols-outlined text-[16px]">visibility</span>
                <span className="hidden sm:inline">Ver Tienda Online</span>
              </button>

              <button
                onClick={onLogoutAdmin}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-xs font-medium transition-colors"
                title="Cerrar sesión de administración"
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
                <span className="hidden sm:inline">Cerrar Sesión</span>
              </button>

              {/* Mobile menu trigger */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-neutral-700 hover:bg-[#f5f3f3] lg:hidden"
                title="Menú"
              >
                <span className="material-symbols-outlined text-[24px]">
                  {mobileMenuOpen ? 'close' : 'menu'}
                </span>
              </button>
            </div>
          </>
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

      {/* Mobile Menu for Admin View only */}
      {isAdminView && mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-neutral-200 px-4 py-3 space-y-2 animate-in fade-in duration-150">
          <div className="flex flex-col gap-1">
            <button
              onClick={() => {
                setCurrentTab('inventory');
                setMobileMenuOpen(false);
              }}
              className={`text-left px-3 py-2 rounded-lg text-sm ${
                currentTab === 'inventory' ? 'bg-black text-white font-semibold' : 'text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              Productos e Inventario
            </button>
            {featureFlags?.salesModule !== false && (
              <button
                onClick={() => {
                  setCurrentTab('sales');
                  setMobileMenuOpen(false);
                }}
                className={`text-left px-3 py-2 rounded-lg text-sm ${
                  currentTab === 'sales' ? 'bg-black text-white font-semibold' : 'text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                Registro de Ventas
              </button>
            )}
            {featureFlags?.brandCustomizer !== false && (
              <button
                onClick={() => {
                  setCurrentTab('brand');
                  setMobileMenuOpen(false);
                }}
                className={`text-left px-3 py-2 rounded-lg text-sm ${
                  currentTab === 'brand' ? 'bg-black text-white font-semibold' : 'text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                Diseño & Marca
              </button>
            )}
            <button
              onClick={() => {
                setCurrentTab('payments');
                setMobileMenuOpen(false);
              }}
              className={`text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${
                currentTab === 'payments' ? 'bg-[#009ee3] text-white font-semibold' : 'text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <span>Mercado Pago & Cobros</span>
              <span className="material-symbols-outlined text-[16px]">credit_card</span>
            </button>

            <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
              <button
                onClick={() => {
                  onExitAdmin();
                  setMobileMenuOpen(false);
                }}
                className="text-xs font-medium text-neutral-600 hover:text-black py-1.5"
              >
                Ver Tienda Online
              </button>
              <button
                onClick={() => {
                  onLogoutAdmin();
                  setMobileMenuOpen(false);
                }}
                className="text-xs font-medium text-red-600 hover:text-red-700 py-1.5"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
