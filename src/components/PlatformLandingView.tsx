import React, { useState } from 'react';
import { Store } from '../types';

interface PlatformLandingViewProps {
  stores: Store[];
  onSelectStore: (slug: string, mode?: 'storefront' | 'admin') => void;
  onOpenSuperAdmin: () => void;
}

export const PlatformLandingView: React.FC<PlatformLandingViewProps> = ({
  stores,
  onSelectStore,
  onOpenSuperAdmin
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [slugInput, setSlugInput] = useState('');
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Only active stores with public catalog enabled appear in the public platform directory
  const activeStores = stores.filter(
    (s) => s.active !== false && s.featureFlags?.publicCatalog !== false
  );

  const filteredStores = activeStores.filter((s) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      s.name.toLowerCase().includes(term) ||
      s.slug.toLowerCase().includes(term) ||
      (s.whatsappNumber && s.whatsappNumber.includes(term))
    );
  });

  const handleDirectGo = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSlug = slugInput.trim().toLowerCase().replace(/^\/+|\/+$/g, '');
    if (!cleanSlug) return;
    onSelectStore(cleanSlug, 'storefront');
  };

  const scrollToSection = (e: React.MouseEvent, sectionId: string) => {
    e.preventDefault();
    const element = document.getElementById(sectionId);
    if (element) {
      const headerOffset = 76;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
      window.history.replaceState(null, '', `#${sectionId}`);
    }
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText('ugmartin@hotmail.com').then(() => {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2500);
    });
  };

  const mailtoHref = `mailto:ugmartin@hotmail.com?subject=${encodeURIComponent(
    'Consulta por Tienda Online - Apolo Commerce'
  )}&body=${encodeURIComponent(
    'Hola Martín,\n\nQuisiera solicitar información para activar mi tienda online en la plataforma.\n\n' +
      '• Nombre de mi comercio / marca:\n' +
      '• Rubro (Indumentaria, calzado, etc.):\n' +
      '• Mi WhatsApp de contacto:\n\n' +
      'Aguardo su contacto para coordinar los detalles. ¡Muchas gracias!'
  )}`;

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-neutral-900 flex flex-col justify-between font-sans selection:bg-neutral-900 selection:text-white scroll-smooth">
      {/* Platform Header with One-Page Smooth Navigation */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-neutral-900 text-white rounded-xl flex items-center justify-center font-bold shadow-xs">
              <span className="material-symbols-outlined text-xl">storefront</span>
            </div>
            <div>
              <div className="text-base font-bold tracking-tight text-neutral-900 leading-tight">
                Apolo Commerce
              </div>
              <div className="text-xs text-neutral-500 font-medium">
                Catálogos Digitales & Ventas por WhatsApp
              </div>
            </div>
          </div>

          {/* Smooth Scroll Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-neutral-600">
            <a
              href="#funcionalidades"
              onClick={(e) => scrollToSection(e, 'funcionalidades')}
              className="hover:text-black transition-colors"
            >
              Funcionalidades
            </a>
            <a
              href="#tiempos"
              onClick={(e) => scrollToSection(e, 'tiempos')}
              className="hover:text-black transition-colors"
            >
              Puesta en Marcha
            </a>
            <a
              href="#comercios"
              onClick={(e) => scrollToSection(e, 'comercios')}
              className="hover:text-black transition-colors"
            >
              Comercios ({activeStores.length})
            </a>
            <a
              href="#contacto"
              onClick={(e) => scrollToSection(e, 'contacto')}
              className="hover:text-black transition-colors"
            >
              Contacto
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <a
              href="#contacto"
              onClick={(e) => scrollToSection(e, 'contacto')}
              className="hidden sm:inline-flex px-3.5 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-black rounded-xl transition-all shadow-xs"
            >
              Solicitar Mi Tienda
            </a>
            <button
              onClick={onOpenSuperAdmin}
              className="px-3 py-2 text-xs font-semibold text-neutral-700 hover:text-black bg-neutral-100 hover:bg-neutral-200/80 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border border-neutral-200/80"
              title="Panel de Super Administrador"
            >
              <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
              <span className="hidden sm:inline">Super Admin</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main One-Page Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-14 space-y-16">
        {/* HERO SECTION */}
        <section className="text-center max-w-3xl mx-auto space-y-5 pt-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200/70 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Puesta en Marcha Ágil · Sin Comisiones por Venta</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-neutral-900 leading-tight sm:leading-[1.15]">
            Tu Catálogo Online y Ventas por WhatsApp en Tiempo Récord
          </h1>

          <p className="text-sm sm:text-base text-neutral-600 leading-relaxed max-w-2xl mx-auto">
            La plataforma diseñada para marcas de moda, calzado y comercios independientes. 
            Mostrá tu stock real por talles y colores, recibí pedidos ordenados directo al chat y gestioná tus ventas sin intermediarios.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="#contacto"
              onClick={(e) => scrollToSection(e, 'contacto')}
              className="w-full sm:w-auto px-6 py-3 bg-neutral-900 hover:bg-black text-white text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
            >
              <span>Quiero Mi Catálogo Online</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </a>
            <a
              href="#comercios"
              onClick={(e) => scrollToSection(e, 'comercios')}
              className="w-full sm:w-auto px-5 py-3 bg-white hover:bg-neutral-100 text-neutral-800 text-xs sm:text-sm font-semibold rounded-xl border border-neutral-200 transition-all flex items-center justify-center gap-2 shadow-2xs"
            >
              <span className="material-symbols-outlined text-[18px] text-neutral-500">storefront</span>
              <span>Explorar Comercios de Ejemplo</span>
            </a>
          </div>

          {/* Quick Direct Store Access Input */}
          <form
            onSubmit={handleDirectGo}
            className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 max-w-md mx-auto"
          >
            <div className="relative flex-1">
              <span className="material-symbols-outlined text-neutral-400 text-[18px] absolute left-3 top-1/2 -translate-y-1/2">
                link
              </span>
              <input
                type="text"
                value={slugInput}
                onChange={(e) => setSlugInput(e.target.value)}
                placeholder="Abrir catálogo directo (ej. apolo, calipso...)"
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-neutral-300 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 shadow-xs"
              />
            </div>
            <button
              type="submit"
              disabled={!slugInput.trim()}
              className="px-4 py-2.5 bg-neutral-800 hover:bg-black disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>Abrir</span>
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            </button>
          </form>
        </section>

        {/* TIMELINE & OPERATIONAL NUMBERS BANNER */}
        <section id="tiempos" className="scroll-mt-20">
          <div className="bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-800 text-white rounded-3xl p-6 sm:p-10 shadow-xl border border-neutral-800">
            <div className="text-center max-w-xl mx-auto mb-8 space-y-2">
              <span className="text-[11px] uppercase tracking-widest font-bold text-neutral-400">
                Velocidad de Implementación
              </span>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                ¿Cuánto tiempo lleva tener tu sitio online funcionando?
              </h2>
              <p className="text-xs sm:text-sm text-neutral-300">
                Olvidate de semanas de desarrollo web o integraciones costosas. La plataforma está lista para usar.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-xs flex flex-col justify-between">
                <div>
                  <div className="text-3xl sm:text-4xl font-extrabold text-emerald-400 mb-1">
                    15 min
                  </div>
                  <div className="text-sm font-bold text-white mb-1">
                    Carga Inicial de Productos
                  </div>
                  <p className="text-xs text-neutral-300 leading-relaxed">
                    Subí tus fotos, asigná talles, colores y precios con una matriz ultra intuitiva sin manuales.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-1.5 text-[11px] text-neutral-400">
                  <span className="material-symbols-outlined text-[15px] text-emerald-400">bolt</span>
                  <span>Sin conocimientos técnicos</span>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-xs flex flex-col justify-between">
                <div>
                  <div className="text-3xl sm:text-4xl font-extrabold text-sky-400 mb-1">
                    0%
                  </div>
                  <div className="text-sm font-bold text-white mb-1">
                    Comisión por Venta
                  </div>
                  <p className="text-xs text-neutral-300 leading-relaxed">
                    El 100% de la venta es tuya. El cliente te abona directo por transferencia, Mercado Pago o efectivo.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-1.5 text-[11px] text-neutral-400">
                  <span className="material-symbols-outlined text-[15px] text-sky-400">savings</span>
                  <span>Directo a tu cuenta bancaria</span>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-xs flex flex-col justify-between">
                <div>
                  <div className="text-3xl sm:text-4xl font-extrabold text-amber-400 mb-1">
                    24 hs
                  </div>
                  <div className="text-sm font-bold text-white mb-1">
                    Puesta en Marcha Garantizada
                  </div>
                  <p className="text-xs text-neutral-300 leading-relaxed">
                    Recibís tu dirección web propia (<code className="bg-white/10 px-1 py-0.5 rounded text-amber-300 font-mono text-[10px]">/tu-tienda</code>) y soporte personalizado de inicio.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-1.5 text-[11px] text-neutral-400">
                  <span className="material-symbols-outlined text-[15px] text-amber-400">verified</span>
                  <span>Acompañamiento en el lanzamiento</span>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-xs flex flex-col justify-between">
                <div>
                  <div className="text-3xl sm:text-4xl font-extrabold text-rose-400 mb-1">
                    3x
                  </div>
                  <div className="text-sm font-bold text-white mb-1">
                    Conversión en WhatsApp
                  </div>
                  <p className="text-xs text-neutral-300 leading-relaxed">
                    Chau responder 20 veces "¿qué talles tenés en stock?". El cliente te envía el carrito listo para confirmar.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-1.5 text-[11px] text-neutral-400">
                  <span className="material-symbols-outlined text-[15px] text-rose-400">chat</span>
                  <span>Mensaje ordenado con fotos y totales</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CORE FEATURES SECTION */}
        <section id="funcionalidades" className="scroll-mt-20 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-[11px] uppercase tracking-widest font-bold text-neutral-400">
              Diseñado para Comerciantes
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight">
              Todo lo que necesitás para vender profesionalmente
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500">
              Sin complicaciones ni herramientas que nadie usa. Cada función resuelve un dolor real de tu día a día.
            </p>
          </div>

          {/* 3 Step Flow */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-neutral-200/90 shadow-xs relative">
              <div className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-800 font-bold text-xs flex items-center justify-center mb-4">
                01
              </div>
              <h3 className="text-base font-bold text-neutral-900 mb-1.5">
                Cargás tus Productos y Stock
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Asigná variantes dimensionales por Talle (S, M, L, XL, etc.) y Color (Negro, Beige, Blanco...). Si una variante se agota, el sistema la deshabilita automáticamente.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-neutral-200/90 shadow-xs relative">
              <div className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-800 font-bold text-xs flex items-center justify-center mb-4">
                02
              </div>
              <h3 className="text-base font-bold text-neutral-900 mb-1.5">
                Compartís tu Link en Redes
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Pegá tu URL directa en la biografía de Instagram, TikTok o estados de WhatsApp. Tu cliente entra en 1 segundo sin descargar ninguna aplicación.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-neutral-200/90 shadow-xs relative">
              <div className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-800 font-bold text-xs flex items-center justify-center mb-4">
                03
              </div>
              <h3 className="text-base font-bold text-neutral-900 mb-1.5">
                Recibís el Pedido por WhatsApp
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                El carrito genera el texto exacto con el desglose de prendas, variantes seleccionadas y precio total. Solo tenés que enviar los datos de pago y despachar.
              </p>
            </div>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-2xs hover:shadow-sm transition-all space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-800 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">devices</span>
              </div>
              <h4 className="text-sm font-bold text-neutral-900">Catálogo Móvil Ultra Rápido</h4>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Diseñado para celulares, con navegación táctil fluida, zoom en prendas y buscador instantáneo de modelos y categorías.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-2xs hover:shadow-sm transition-all space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-800 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">straighten</span>
              </div>
              <h4 className="text-sm font-bold text-neutral-900">Matriz Talle x Color</h4>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Se terminaron los reclamos por falta de stock. El cliente solo puede seleccionar combinaciones que realmente tengas disponibles.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-2xs hover:shadow-sm transition-all space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-800 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">point_of_sale</span>
              </div>
              <h4 className="text-sm font-bold text-neutral-900">Registro de Ventas & Cobros</h4>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Panel administrativo para asentar pedidos manuales o automáticos, registrar señas, saldos pendientes y estado de entrega.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-2xs hover:shadow-sm transition-all space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-800 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">palette</span>
              </div>
              <h4 className="text-sm font-bold text-neutral-900">Personalización de Marca</h4>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Tu logo, tu tipografía de título, tus colores institucionales y tus mensajes destacados de cuotas o envíos gratis.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-2xs hover:shadow-sm transition-all space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-800 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">cloud_sync</span>
              </div>
              <h4 className="text-sm font-bold text-neutral-900">Nube & Multi-Dispositivo</h4>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Tu inventario sincronizado al instante en Google Firestore. Podés actualizar precios desde la computadora o el celular en el mostrador.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-2xs hover:shadow-sm transition-all space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-800 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">shield</span>
              </div>
              <h4 className="text-sm font-bold text-neutral-900">Acceso Seguro para Administradores</h4>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Cada comercio cuenta con su contraseña individual protegida para gestionar precios y datos confidenciales.
              </p>
            </div>
          </div>
        </section>

        {/* ACTIVE STORES DIRECTORY */}
        <section id="comercios" className="scroll-mt-20 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 pb-4">
            <div>
              <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                <span>Comercios Activos en la Plataforma</span>
                <span className="text-xs font-semibold text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded-full">
                  {activeStores.length} tiendas
                </span>
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Mirá cómo se ve un catálogo en vivo y explorá las tiendas activas en la plataforma.
              </p>
            </div>

            {/* Filter Input */}
            {stores.length > 2 && (
              <div className="relative w-full sm:w-64">
                <span className="material-symbols-outlined text-neutral-400 text-[16px] absolute left-3 top-1/2 -translate-y-1/2">
                  search
                </span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar comercio..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs text-neutral-800 focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
            )}
          </div>

          {filteredStores.length === 0 ? (
            <div className="bg-white rounded-2xl border border-neutral-200 p-8 text-center space-y-3">
              <span className="material-symbols-outlined text-3xl text-neutral-400">store_mall_directory</span>
              <p className="text-sm text-neutral-600 font-medium">
                {stores.length === 0
                  ? 'Aún no hay tiendas creadas en la plataforma.'
                  : `No se encontraron tiendas que coincidan con "${searchTerm}".`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredStores.map((store) => {
                const isActive = store.active !== false;

                return (
                  <div
                    key={store.id}
                    className="bg-white rounded-2xl border border-neutral-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {store.logoUrl ? (
                            <div className="w-12 h-12 rounded-xl bg-neutral-50 border border-neutral-100 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                              <img
                                src={store.logoUrl}
                                alt={store.name}
                                className="max-h-full max-w-full object-contain"
                              />
                            </div>
                          ) : (
                            <div
                              className="w-12 h-12 rounded-xl text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs uppercase"
                              style={{ backgroundColor: store.primaryColor || '#1A1A1A' }}
                            >
                              {store.name.substring(0, 2)}
                            </div>
                          )}

                          <div className="min-w-0">
                            <h3 className="font-bold text-neutral-900 text-base truncate tracking-tight">
                              {store.name}
                            </h3>
                            <div className="flex items-center gap-1.5 text-xs text-neutral-500 font-mono mt-0.5 truncate">
                              <span className="text-neutral-400">/</span>
                              <span className="bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-700 font-semibold">
                                {store.slug}
                              </span>
                            </div>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : 'bg-neutral-100 text-neutral-500'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isActive ? 'bg-emerald-500' : 'bg-neutral-400'
                            }`}
                          />
                          <span>{isActive ? 'Activa' : 'Pausada'}</span>
                        </span>
                      </div>

                      {store.whatsappNumber && (
                        <div className="flex items-center gap-2 text-xs text-neutral-600 mt-3 pt-3 border-t border-neutral-100">
                          <span className="material-symbols-outlined text-[15px] text-emerald-600">chat</span>
                          <span className="truncate">{store.whatsappNumber}</span>
                        </div>
                      )}
                    </div>

                    {/* Action button: ONLY Catalog access (Admin button removed) */}
                    <div className="bg-neutral-50/80 p-4 border-t border-neutral-100">
                      <button
                        onClick={() => onSelectStore(store.slug, 'storefront')}
                        className="w-full py-2.5 px-4 bg-neutral-900 hover:bg-black text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs hover:shadow active:scale-[0.99]"
                      >
                        <span className="material-symbols-outlined text-[17px] text-neutral-300">storefront</span>
                        <span>Ver Catálogo</span>
                        <span className="material-symbols-outlined text-[15px] text-neutral-400">arrow_forward</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* CONTACT & CLIENT ONBOARDING SECTION (Direct info only, no form) */}
        <section id="contacto" className="scroll-mt-20">
          <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-lg p-6 sm:p-10">
            <div className="max-w-3xl mx-auto text-center space-y-4 mb-8">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 text-neutral-800 text-xs font-semibold">
                <span className="material-symbols-outlined text-[15px]">mail</span>
                <span>Contacto Directo para Nuevos Comercios</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight leading-tight">
                ¿Querés sumar tu comercio a la plataforma?
              </h2>
              <p className="text-sm sm:text-base text-neutral-600 max-w-xl mx-auto leading-relaxed">
                Envianos un mail a nuestra casilla oficial <strong className="text-neutral-900">ugmartin@hotmail.com</strong> con el nombre de tu marca y nos pondremos en contacto a la brevedad para coordinar la activación de tu catálogo online.
              </p>
            </div>

            {/* Direct Contact Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
              {/* Email Official Box */}
              <div className="p-6 rounded-2xl bg-neutral-50 border border-neutral-200 flex flex-col justify-between space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-neutral-900 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <span className="material-symbols-outlined text-[24px]">alternate_email</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                        Casilla Oficial de Contacto
                      </div>
                      <div className="text-base sm:text-lg font-extrabold text-neutral-900 font-mono">
                        ugmartin@hotmail.com
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-neutral-600 leading-relaxed pt-1">
                    Atención personalizada para dar de alta tu tienda, resolver consultas técnicas o coordinar la carga de catálogo.
                  </p>
                </div>

                <div className="space-y-2.5 pt-2">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <a
                      href={mailtoHref}
                      className="flex-1 py-3 px-4 bg-neutral-900 hover:bg-black text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 text-center shadow-xs cursor-pointer active:scale-[0.99]"
                    >
                      <span className="material-symbols-outlined text-[17px]">send</span>
                      <span>Enviar Email Directo</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyEmail}
                      className="py-3 px-4 bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-800 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 active:scale-[0.99]"
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
                    <span>Respuesta garantizada en menos de 24 horas hábiles.</span>
                  </div>
                </div>
              </div>

              {/* What's Included Card */}
              <div className="p-6 rounded-2xl bg-white border border-neutral-200 flex flex-col justify-between space-y-4">
                <div>
                  <div className="font-bold text-neutral-900 text-sm mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-neutral-700 text-[18px]">verified</span>
                    <span>Todo lo que incluye tu tienda al activarla:</span>
                  </div>

                  <div className="space-y-2.5 text-xs text-neutral-700">
                    <div className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0 mt-0.5">
                        check_circle
                      </span>
                      <span>
                        <strong>URL directa exclusiva</strong> (ej: <code className="font-mono text-neutral-900 bg-neutral-100 px-1 py-0.5 rounded">/tu-marca</code>) lista para tu biografía de redes sociales.
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0 mt-0.5">
                        check_circle
                      </span>
                      <span>
                        <strong>Catálogo interactivo con variantes</strong> de Talle y Color con control de stock en tiempo real.
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0 mt-0.5">
                        check_circle
                      </span>
                      <span>
                        <strong>Carrito de pedidos por WhatsApp</strong> con desglose detallado de prendas y precio total.
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0 mt-0.5">
                        check_circle
                      </span>
                      <span>
                        <strong>Panel de control administrativo</strong> protegido para gestionar stock, precios y asentar ventas.
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0 mt-0.5">
                        check_circle
                      </span>
                      <span>
                        <strong>Sin comisiones por venta</strong>: cobrás directo a tu cuenta bancaria o billetera digital.
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-100 text-[11px] text-neutral-500">
                  Escribinos a <a href="mailto:ugmartin@hotmail.com" className="font-semibold text-neutral-900 underline">ugmartin@hotmail.com</a> detallando tu rubro y te respondemos de inmediato.
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-neutral-200/80 py-6 text-xs text-neutral-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-neutral-800">Apolo Commerce</span>
            <span>· Plataforma Multi-Comercio &copy; {new Date().getFullYear()}</span>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="mailto:ugmartin@hotmail.com"
              className="text-neutral-600 hover:text-black font-medium transition-colors"
            >
              ugmartin@hotmail.com
            </a>
            <button
              onClick={onOpenSuperAdmin}
              className="text-neutral-600 hover:text-black font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[15px]">admin_panel_settings</span>
              <span>Acceso Super Admin</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
