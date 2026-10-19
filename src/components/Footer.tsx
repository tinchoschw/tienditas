import React from 'react';
import { StoreSettings } from '../types';

interface FooterProps {
  settings: StoreSettings;
  onOpenAdminAccess: () => void;
  isAdminView: boolean;
  onOpenSuperAdmin?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ settings, onOpenAdminAccess, isAdminView, onOpenSuperAdmin }) => {
  return (
    <footer 
      className="w-full border-t border-[#e4e2e2] mt-16 transition-colors duration-200"
      style={{
        backgroundColor: settings.backgroundColor ? `${settings.backgroundColor}` : '#efeded'
      }}
    >
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap text-center md:text-left">
          {settings.storeName ? (
            <>
              <span 
                className="font-headline-sm text-sm tracking-tight font-bold uppercase"
                style={{ color: settings.primaryColor || '#1A1A1A' }}
              >
                {settings.storeName}
              </span>
              <span className="text-xs text-[#5f5e5b] hidden sm:inline">—</span>
            </>
          ) : null}
          <span className="text-xs text-[#5f5e5b]">
            Catálogo & Tienda Online
          </span>
        </div>

        <div className="flex items-center gap-5 flex-wrap justify-center text-xs text-[#5f5e5b]">
          <span>© {new Date().getFullYear()} {settings.storeName || 'Tienda Oficial'}. Todos los derechos reservados.</span>
          <span className="text-neutral-300 hidden sm:inline">|</span>
          <button
            onClick={onOpenAdminAccess}
            className="text-neutral-500 hover:text-black flex items-center gap-1 transition-colors cursor-pointer"
            title="Ingreso para el equipo de administración y ventas"
          >
            <span className="material-symbols-outlined text-[14px]">lock</span>
            <span>{isAdminView ? 'Panel de Gestión' : 'Acceso Administración'}</span>
          </button>
          {onOpenSuperAdmin && (
            <>
              <span className="text-neutral-300 hidden sm:inline">|</span>
              <button
                onClick={onOpenSuperAdmin}
                className="text-neutral-400 hover:text-neutral-800 flex items-center gap-1 transition-colors cursor-pointer"
                title="Panel Super Admin de Tiendas"
              >
                <span className="material-symbols-outlined text-[14px]">hub</span>
                <span>Super Admin</span>
              </button>
            </>
          )}
        </div>
      </div>
    </footer>
  );
};
