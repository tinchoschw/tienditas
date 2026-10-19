import React, { useState, useEffect, useRef } from 'react';
import { StoreSettings } from '../types';
import { INITIAL_SETTINGS } from '../initialData';
import { useAuth } from '../context/AuthContext';
import { convertDriveUrlToDirectLink } from './ProductEditModal';

interface BrandCustomizerViewProps {
  settings: StoreSettings;
  onSaveSettings: (settings: Partial<StoreSettings>) => Promise<any>;
  allowDevicePhotos?: boolean;
}

export const BrandCustomizerView: React.FC<BrandCustomizerViewProps> = ({
  settings: initialSettings,
  onSaveSettings,
  allowDevicePhotos = true
}) => {
  const { managerProfile } = useAuth();
  const [formSettings, setFormSettings] = useState<StoreSettings>({ ...initialSettings });
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'desktop'>('mobile');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [newLogoUrlInput, setNewLogoUrlInput] = useState('');
  const [logoNotice, setLogoNotice] = useState<string | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [primaryPresets, setPrimaryPresets] = useState<{ name: string; hex: string }[]>(() => {
    return initialSettings.primaryPresets && initialSettings.primaryPresets.length > 0
      ? initialSettings.primaryPresets
      : [
          { name: 'Negro Atelier', hex: '#1A1A1A' },
          { name: 'Azul Noche', hex: '#202A37' },
          { name: 'Verde Oliva Profundo', hex: '#2C3327' },
          { name: 'Espresso', hex: '#3A2826' }
        ];
  });

  const [secondaryPresets, setSecondaryPresets] = useState<{ name: string; hex: string }[]>(() => {
    return initialSettings.secondaryPresets && initialSettings.secondaryPresets.length > 0
      ? initialSettings.secondaryPresets
      : [
          { name: 'Terracota Atelier', hex: '#E05A47' },
          { name: 'Cobre Cálido', hex: '#C86D51' },
          { name: 'Arcilla Natural', hex: '#A0624C' },
          { name: 'Granate Vino', hex: '#8A1C10' }
        ];
  });

  const [backgroundPresets, setBackgroundPresets] = useState<{ name: string; hex: string }[]>(() => {
    return initialSettings.backgroundPresets && initialSettings.backgroundPresets.length > 0
      ? initialSettings.backgroundPresets
      : [
          { name: 'Blanco Puro', hex: '#FFFFFF' },
          { name: 'Crema Atelier', hex: '#F9F8F6' },
          { name: 'Gris Suave', hex: '#F5F5F7' }
        ];
  });

  // Modal dialog for adding a new color preset with explicit confirmation
  const [addPresetTarget, setAddPresetTarget] = useState<'primary' | 'secondary' | 'background' | null>(null);
  const [newPresetColor, setNewPresetColor] = useState<string>('#1A1A1A');
  const [newPresetName, setNewPresetName] = useState<string>('');
  const [showAdminPassword, setShowAdminPassword] = useState<boolean>(false);

  const handleOpenAddPreset = (target: 'primary' | 'secondary' | 'background') => {
    setAddPresetTarget(target);
    if (target === 'primary') {
      setNewPresetColor(formSettings.primaryColor || '#1A1A1A');
    } else if (target === 'secondary') {
      setNewPresetColor(formSettings.secondaryColor || '#E05A47');
    } else {
      setNewPresetColor(formSettings.backgroundColor || '#F9F8F6');
    }
    setNewPresetName('');
  };

  const handleConfirmAddPreset = async () => {
    if (!addPresetTarget) return;
    const hex = newPresetColor.toUpperCase();
    const name = newPresetName.trim() || `Tono ${hex}`;

    if (addPresetTarget === 'primary') {
      const exists = primaryPresets.some((p) => p.hex.toLowerCase() === hex.toLowerCase());
      const updated = exists ? primaryPresets : [...primaryPresets, { name, hex }];
      setPrimaryPresets(updated);
      const nextSettings = {
        ...formSettings,
        primaryColor: hex,
        primaryPresets: updated,
        secondaryPresets,
        backgroundPresets
      };
      setFormSettings(nextSettings);
      await onSaveSettings(nextSettings);
    } else if (addPresetTarget === 'secondary') {
      const exists = secondaryPresets.some((p) => p.hex.toLowerCase() === hex.toLowerCase());
      const updated = exists ? secondaryPresets : [...secondaryPresets, { name, hex }];
      setSecondaryPresets(updated);
      const nextSettings = {
        ...formSettings,
        secondaryColor: hex,
        primaryPresets,
        secondaryPresets: updated,
        backgroundPresets
      };
      setFormSettings(nextSettings);
      await onSaveSettings(nextSettings);
    } else if (addPresetTarget === 'background') {
      const exists = backgroundPresets.some((p) => p.hex.toLowerCase() === hex.toLowerCase());
      const updated = exists ? backgroundPresets : [...backgroundPresets, { name, hex }];
      setBackgroundPresets(updated);
      const nextSettings = {
        ...formSettings,
        backgroundColor: hex,
        primaryPresets,
        secondaryPresets,
        backgroundPresets: updated
      };
      setFormSettings(nextSettings);
      await onSaveSettings(nextSettings);
    }

    setAddPresetTarget(null);
  };

  const handleDeletePrimaryPreset = async (hexToDelete: string) => {
    if (primaryPresets.length <= 1) {
      alert('Debes conservar al menos 1 color en los preajustes.');
      return;
    }
    const updated = primaryPresets.filter((p) => p.hex.toLowerCase() !== hexToDelete.toLowerCase());
    setPrimaryPresets(updated);
    const nextPrimary = formSettings.primaryColor.toLowerCase() === hexToDelete.toLowerCase() ? updated[0].hex : formSettings.primaryColor;
    const nextSettings = {
      ...formSettings,
      primaryColor: nextPrimary,
      primaryPresets: updated,
      secondaryPresets,
      backgroundPresets
    };
    setFormSettings(nextSettings);
    await onSaveSettings(nextSettings);
  };

  const handleDeleteSecondaryPreset = async (hexToDelete: string) => {
    if (secondaryPresets.length <= 1) {
      alert('Debes conservar al menos 1 color en los preajustes.');
      return;
    }
    const updated = secondaryPresets.filter((p) => p.hex.toLowerCase() !== hexToDelete.toLowerCase());
    setSecondaryPresets(updated);
    const nextSecondary = formSettings.secondaryColor.toLowerCase() === hexToDelete.toLowerCase() ? updated[0].hex : formSettings.secondaryColor;
    const nextSettings = {
      ...formSettings,
      secondaryColor: nextSecondary,
      primaryPresets,
      secondaryPresets: updated,
      backgroundPresets
    };
    setFormSettings(nextSettings);
    await onSaveSettings(nextSettings);
  };

  const handleDeleteBackgroundPreset = async (hexToDelete: string) => {
    if (backgroundPresets.length <= 1) {
      alert('Debes conservar al menos 1 color de fondo en los preajustes.');
      return;
    }
    const updated = backgroundPresets.filter((p) => p.hex.toLowerCase() !== hexToDelete.toLowerCase());
    setBackgroundPresets(updated);
    const nextBg = formSettings.backgroundColor.toLowerCase() === hexToDelete.toLowerCase() ? updated[0].hex : formSettings.backgroundColor;
    const nextSettings = {
      ...formSettings,
      backgroundColor: nextBg,
      primaryPresets,
      secondaryPresets,
      backgroundPresets: updated
    };
    setFormSettings(nextSettings);
    await onSaveSettings(nextSettings);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const settingsToSave: StoreSettings = {
        ...formSettings,
        primaryPresets,
        secondaryPresets,
        backgroundPresets
      };
      await onSaveSettings(settingsToSave);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    setFormSettings({ ...initialSettings });
    if (initialSettings.primaryPresets && initialSettings.primaryPresets.length > 0) {
      setPrimaryPresets(initialSettings.primaryPresets);
    }
    if (initialSettings.secondaryPresets && initialSettings.secondaryPresets.length > 0) {
      setSecondaryPresets(initialSettings.secondaryPresets);
    }
    if (initialSettings.backgroundPresets && initialSettings.backgroundPresets.length > 0) {
      setBackgroundPresets(initialSettings.backgroundPresets);
    }
  }, [initialSettings]);

  const handleResetDefaults = () => {
    setConfirmResetOpen(true);
  };

  return (
    <div className="w-full flex flex-col px-4 sm:px-8 py-8 max-w-[1600px] mx-auto">
      {/* Header Section with Editorial Accent */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-lg bg-[#e1dfdb] text-[#63635f] text-[11px] font-bold uppercase tracking-wider">
              Identidad Visual & CMS
            </span>
            <span className="text-xs text-[#5f5e5b] flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Sincronización en vivo
            </span>
          </div>
          <h1 className="font-headline-lg text-2xl sm:text-3xl text-black font-bold tracking-tight">
            Personalización de Marca y Estilo Web
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 max-w-2xl leading-relaxed">
            Modifica la identidad visual de tu tienda pública en tiempo real. Configura paletas cromáticas,
            tipografías asociadas y la taxonomía maestra de catálogo.
          </p>
        </div>

        {/* Action Top Bar */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3.5 py-2 rounded-lg bg-[#efeded] hover:bg-[#e4e2e2] text-black text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">restart_alt</span>
            <span>Restablecer</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-black text-white text-xs font-semibold shadow-xs hover:bg-neutral-800 transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">
              {savedSuccess ? 'check' : 'publish'}
            </span>
            <span>{saving ? 'Guardando...' : savedSuccess ? '¡Guardado!' : 'Guardar y Publicar'}</span>
          </button>
        </div>
      </div>

      {/* Main Studio Split Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* LEFT CONFIGURATION COLUMN (7 Cols) */}
        <div className="xl:col-span-7 flex flex-col gap-6">
          {/* SECCIÓN 1: NOMBRE DE MARCA Y LOGO DE LA TIENDA */}
          <section className="bg-white rounded-xl p-6 shadow-xs border border-[#efeded]">
            <div className="flex items-center justify-between mb-4 border-b border-neutral-100 pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">
                  Sección 01
                </span>
                <h2 className="text-base font-bold text-black">Nombre Comercial y Logotipo</h2>
              </div>
              <span className="material-symbols-outlined text-neutral-400">verified_user</span>
            </div>

            {/* Editable Store Name Input */}
            <div className="mb-5 p-4 rounded-xl bg-[#f5f3f3] border border-neutral-200">
              <label className="text-xs font-bold text-black block mb-1">
                Nombre de la Marca / Tienda
              </label>
              <p className="text-[11px] text-neutral-500 mb-2">
                Personaliza el nombre de tu marca. Se mostrará en el encabezado, pie de página y comprobantes de pedido.
              </p>
              <input
                type="text"
                value={formSettings.storeName}
                onChange={(e) => setFormSettings({ ...formSettings, storeName: e.target.value })}
                placeholder="Ej. Atelier Studio"
                className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-neutral-200 text-sm font-semibold text-black focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>

            {/* Logo Stage Box */}
            <div className="flex flex-col sm:flex-row items-center gap-5 p-5 rounded-lg bg-[#f5f3f3] border border-neutral-200 mb-4">
              {/* Logo Preview Container */}
              <div className="w-full sm:w-72 min-h-28 max-h-48 bg-white rounded-lg flex items-center justify-center p-3 shadow-2xs border border-neutral-200 relative group overflow-hidden">
                {formSettings.logoUrl ? (
                  <img
                    src={formSettings.logoUrl}
                    alt={formSettings.storeName}
                    style={{ 
                      height: `${Math.max(20, Math.round(50 * (formSettings.logoScale / 100)))}px`,
                      maxHeight: '170px'
                    }}
                    className="w-auto object-contain transition-all duration-150 group-hover:scale-105"
                  />
                ) : (
                  <div className="font-bold text-base tracking-tight uppercase">
                    ATELIER <span className="text-[#E05A47]">■</span> STUDIO
                  </div>
                )}
                <div className="absolute bottom-1 right-2 px-1.5 py-0.5 rounded bg-[#f5f3f3] text-neutral-500 text-[9px] font-bold">
                  HD Vector
                </div>
              </div>

              {/* Upload Meta & Spec */}
              <div className="flex-1 space-y-2 text-center sm:text-left w-full">
                <div className="text-xs font-bold text-black">atelier_studio_master.svg</div>
                <p className="text-[11px] text-neutral-500">
                  Dimensiones recomendadas: <strong className="text-black font-semibold">320 × 60 px</strong>. Formato en SVG o PNG con transparencia.
                </p>

                {/* Scale Slider */}
                <div className="pt-1">
                  <div className="flex justify-between items-center text-xs text-neutral-600 mb-1">
                    <span>Escala en barra de navegación</span>
                    <span className="font-bold text-black">{formSettings.logoScale}%</span>
                  </div>
                  <input
                    type="range"
                    min={40}
                    max={500}
                    step={5}
                    value={formSettings.logoScale}
                    onChange={(e) => {
                      const newScale = Number(e.target.value);
                      const updated = { ...formSettings, logoScale: newScale };
                      setFormSettings(updated);
                      onSaveSettings(updated);
                    }}
                    className="w-full h-1.5 bg-neutral-300 rounded-lg appearance-none cursor-pointer accent-black"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-400 mt-1">
                    <span>40% (Chico)</span>
                    <span>100% (Normal)</span>
                    <span>250% (Grande)</span>
                    <span>500% (Extra Grande)</span>
                  </div>

                  {/* Quick Scale Buttons */}
                  <div className="flex items-center gap-1.5 pt-2 flex-wrap">
                    <span className="text-[10px] text-neutral-500 font-semibold mr-1">Rápido:</span>
                    {[40, 60, 100, 150, 200, 250, 380, 500].map((sc) => (
                      <button
                        key={sc}
                        type="button"
                        onClick={async () => {
                          const next = { ...formSettings, logoScale: sc };
                          setFormSettings(next);
                          await onSaveSettings(next);
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all cursor-pointer ${
                          formSettings.logoScale === sc
                            ? 'bg-black text-white border-black shadow-2xs'
                            : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                        }`}
                      >
                        {sc}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Image link input & Device File Upload */}
            <div className="space-y-2 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Pegar enlace de Google Drive o URL de imagen (SVG / PNG)"
                  value={newLogoUrlInput}
                  onChange={(e) => setNewLogoUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (newLogoUrlInput.trim()) {
                        const { directUrl, wasConverted } = convertDriveUrlToDirectLink(newLogoUrlInput.trim());
                        const updated = { ...formSettings, logoUrl: directUrl };
                        setFormSettings(updated);
                        setNewLogoUrlInput('');
                        if (wasConverted) {
                          setLogoNotice('✓ Enlace de Google Drive transformado con éxito a enlace CDN directo.');
                        } else {
                          setLogoNotice('✓ Logotipo actualizado correctamente.');
                        }
                        setTimeout(() => setLogoNotice(null), 4000);
                        onSaveSettings(updated);
                      }
                    }
                  }}
                  className="flex-1 min-w-[240px] px-3 py-2 rounded-lg bg-[#f5f3f3] border border-neutral-200 text-xs text-black focus:outline-none focus:bg-white"
                />

                <button
                  type="button"
                  onClick={async () => {
                    if (newLogoUrlInput.trim()) {
                      const { directUrl, wasConverted } = convertDriveUrlToDirectLink(newLogoUrlInput.trim());
                      const updated = { ...formSettings, logoUrl: directUrl };
                      setFormSettings(updated);
                      setNewLogoUrlInput('');
                      if (wasConverted) {
                        setLogoNotice('✓ Enlace de Google Drive transformado con éxito a enlace CDN directo.');
                      } else {
                        setLogoNotice('✓ Logotipo actualizado correctamente.');
                      }
                      setTimeout(() => setLogoNotice(null), 4000);
                      await onSaveSettings(updated);
                    }
                  }}
                  className="px-3.5 py-2 rounded-lg bg-black text-white text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer shrink-0"
                >
                  Aplicar URL
                </button>

                {/* Upload from Device (conditional on feature flag) */}
                {allowDevicePhotos && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png, image/jpeg, image/svg+xml, image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) {
                          alert('El archivo no debe superar 5MB.');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = async (ev) => {
                          const dataUrl = ev.target?.result as string;
                          if (dataUrl) {
                            const updated = { ...formSettings, logoUrl: dataUrl };
                            setFormSettings(updated);
                            setLogoNotice(`✓ Archivo "${file.name}" cargado desde tu dispositivo.`);
                            setTimeout(() => setLogoNotice(null), 4000);
                            await onSaveSettings(updated);
                          }
                        };
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-lg bg-white border border-neutral-300 hover:border-black text-neutral-800 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs"
                      title="Elegir logotipo guardado en tu computadora o teléfono"
                    >
                      <span className="material-symbols-outlined text-[17px] text-neutral-600">upload_file</span>
                      <span>Elegir del dispositivo</span>
                    </button>
                  </>
                )}

                {formSettings.logoUrl ? (
                  <button
                    type="button"
                    onClick={async () => {
                      const updated = { ...formSettings, logoUrl: '' };
                      setFormSettings(updated);
                      setLogoNotice('✓ Se quitó el logotipo.');
                      setTimeout(() => setLogoNotice(null), 3000);
                      await onSaveSettings(updated);
                    }}
                    className="px-3 py-2 rounded-lg bg-[#efeded] hover:bg-neutral-200 text-black text-xs font-medium transition-colors cursor-pointer shrink-0"
                  >
                    Quitar Logotipo
                  </button>
                ) : null}
              </div>

              {/* Status Notice */}
              {logoNotice && (
                <div className="p-2 px-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 animate-in fade-in duration-150">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>{logoNotice}</span>
                </div>
              )}

              <p className="text-[11px] text-neutral-500">
                Admite enlaces compartidos de <strong>Google Drive</strong> (con acceso de lector), URLs web directas y <strong>archivos locales (PNG, SVG, JPG, WebP)</strong> subidos directamente desde tu dispositivo.
              </p>
            </div>
          </section>

          {/* SECCIÓN 2: PALETA DE COLORES DE LA WEB */}
          <section className="bg-white rounded-xl p-6 shadow-xs border border-[#efeded] space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">
                  Sección 02
                </span>
                <h2 className="text-base font-bold text-black">Paleta de Colores de la Web</h2>
              </div>
              <span className="material-symbols-outlined text-neutral-400">palette</span>
            </div>

            {/* Color 1: Primary Brand Accent */}
            <div className="p-4 rounded-lg bg-[#f5f3f3] border border-neutral-200 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-black">Color Primario</span>
                  <p className="text-[11px] text-neutral-500">
                    Botones principales, encabezados, títulos editoriales y elementos de foco.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formSettings.primaryColor}
                    onChange={(e) =>
                      setFormSettings({ ...formSettings, primaryColor: e.target.value })
                    }
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                  />
                  <span className="text-xs font-mono bg-white px-2 py-1 rounded border border-neutral-200 text-black font-semibold">
                    {formSettings.primaryColor.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Presets */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <span className="text-[11px] text-neutral-500 font-semibold mr-1">Presets:</span>
                {primaryPresets.map((p) => (
                  <div key={p.hex} className="relative group inline-flex items-center justify-center">
                    <button
                      type="button"
                      title={`${p.name} (${p.hex})`}
                      onClick={() => setFormSettings({ ...formSettings, primaryColor: p.hex })}
                      style={{ backgroundColor: p.hex }}
                      className={`w-7 h-7 rounded-full border border-black/10 transition-transform ${
                        formSettings.primaryColor.toLowerCase() === p.hex.toLowerCase()
                          ? 'ring-2 ring-black ring-offset-2 scale-110'
                          : 'hover:scale-110'
                      }`}
                    />
                    <button
                      type="button"
                      title={`Eliminar ${p.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePrimaryPreset(p.hex);
                      }}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-xs cursor-pointer z-10"
                    >
                      <span className="material-symbols-outlined text-[11px] leading-none">delete</span>
                    </button>
                  </div>
                ))}

                {/* + Button that opens Dialog with Aceptar */}
                <button
                  type="button"
                  onClick={() => handleOpenAddPreset('primary')}
                  className="w-7 h-7 rounded-full border-2 border-dashed border-neutral-400 hover:border-black flex items-center justify-center text-neutral-600 hover:text-black cursor-pointer bg-white transition-all hover:scale-110 shadow-2xs"
                  title="Elegir y confirmar nuevo color para agregarlo a los presets"
                >
                  <span className="material-symbols-outlined text-[15px] font-bold">add</span>
                </button>
              </div>
            </div>

            {/* Color 2: Secondary / Terracota Accent */}
            <div className="p-4 rounded-lg bg-[#f5f3f3] border border-neutral-200 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-black">Color Secundario / Acento</span>
                  <p className="text-[11px] text-neutral-500">
                    Píldoras de stock limitado, badges de descuento y llamadas visuales prioritarias.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formSettings.secondaryColor}
                    onChange={(e) =>
                      setFormSettings({ ...formSettings, secondaryColor: e.target.value })
                    }
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                  />
                  <span className="text-xs font-mono bg-white px-2 py-1 rounded border border-neutral-200 text-black font-semibold">
                    {formSettings.secondaryColor.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Presets */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <span className="text-[11px] text-neutral-500 font-semibold mr-1">Presets:</span>
                {secondaryPresets.map((p) => (
                  <div key={p.hex} className="relative group inline-flex items-center justify-center">
                    <button
                      type="button"
                      title={`${p.name} (${p.hex})`}
                      onClick={() => setFormSettings({ ...formSettings, secondaryColor: p.hex })}
                      style={{ backgroundColor: p.hex }}
                      className={`w-7 h-7 rounded-full border border-black/10 transition-transform ${
                        formSettings.secondaryColor.toLowerCase() === p.hex.toLowerCase()
                          ? 'ring-2 ring-black ring-offset-2 scale-110'
                          : 'hover:scale-110'
                      }`}
                    />
                    <button
                      type="button"
                      title={`Eliminar ${p.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSecondaryPreset(p.hex);
                      }}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-xs cursor-pointer z-10"
                    >
                      <span className="material-symbols-outlined text-[11px] leading-none">delete</span>
                    </button>
                  </div>
                ))}

                {/* + Button that opens Dialog with Aceptar */}
                <button
                  type="button"
                  onClick={() => handleOpenAddPreset('secondary')}
                  className="w-7 h-7 rounded-full border-2 border-dashed border-neutral-400 hover:border-black flex items-center justify-center text-neutral-600 hover:text-black cursor-pointer bg-white transition-all hover:scale-110 shadow-2xs"
                  title="Elegir y confirmar nuevo color para agregarlo a los presets"
                >
                  <span className="material-symbols-outlined text-[15px] font-bold">add</span>
                </button>
              </div>
            </div>

            {/* Color 3: Store Surface Canvas Selector */}
            <div className="p-4 rounded-lg bg-[#f5f3f3] border border-neutral-200 space-y-2">
              <span className="text-xs font-bold text-black">Color de Fondo de la Tienda</span>
              <p className="text-[11px] text-neutral-500">
                Establece el tono ambiental sobre el que posan los vestidos, túnicas y piezas.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                {backgroundPresets.map((bg) => {
                  const isChecked = formSettings.backgroundColor.toLowerCase() === bg.hex.toLowerCase();
                  return (
                    <div key={bg.hex} className="relative group">
                      <label
                        onClick={() => setFormSettings({ ...formSettings, backgroundColor: bg.hex })}
                        className={`flex items-center gap-3 p-3 rounded-lg bg-white cursor-pointer hover:bg-neutral-50 transition-colors border ${
                          isChecked ? 'ring-2 ring-black border-black shadow-2xs' : 'border-neutral-200'
                        }`}
                      >
                        <input
                          type="radio"
                          name="store_bg"
                          checked={isChecked}
                          onChange={() => setFormSettings({ ...formSettings, backgroundColor: bg.hex })}
                          className="sr-only"
                        />
                        <div
                          className="w-5 h-5 rounded-full shadow-2xs border border-neutral-300 shrink-0"
                          style={{ backgroundColor: bg.hex }}
                        ></div>
                        <div className="flex flex-col min-w-0 pr-4">
                          <span className="text-xs font-semibold text-black truncate">{bg.name}</span>
                          <span className="text-[10px] text-neutral-400 font-mono">{bg.hex}</span>
                        </div>
                      </label>
                      <button
                        type="button"
                        title={`Eliminar ${bg.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBackgroundPreset(bg.hex);
                        }}
                        className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-xs cursor-pointer z-10"
                      >
                        <span className="material-symbols-outlined text-[11px] leading-none">delete</span>
                      </button>
                    </div>
                  );
                })}

                {/* + Button that opens Dialog with Aceptar */}
                <button
                  type="button"
                  onClick={() => handleOpenAddPreset('background')}
                  className="flex items-center justify-center gap-2 p-3 rounded-lg bg-white cursor-pointer hover:bg-neutral-50 border-2 border-dashed border-neutral-300 hover:border-black transition-colors"
                  title="Elegir y confirmar nuevo color de fondo"
                >
                  <span className="material-symbols-outlined text-[18px] text-neutral-600">add</span>
                  <span className="text-xs font-semibold text-neutral-700">Otro color...</span>
                </button>
              </div>
            </div>

            {/* Color 4: WhatsApp Integration */}
            <div className="p-4 rounded-lg bg-[#f5f3f3] border border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#25D366] text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                  <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.062-2.127-.53-1.833-.757-3.013-2.616-3.104-2.738-.093-.122-.738-.982-.738-1.873 0-.89.467-1.328.633-1.507.167-.179.366-.224.488-.224.122 0 .245.002.352.007.113.005.263-.043.412.316.155.374.529 1.29.576 1.385.047.094.078.204.016.327-.063.123-.094.199-.187.309-.094.109-.198.244-.282.327-.094.094-.192.196-.083.383.11.188.487.804 1.045 1.301.718.64 1.324.839 1.512.933.188.093.298.078.408-.047.11-.125.469-.546.594-.734.125-.187.25-.156.422-.093.172.062 1.09.514 1.277.608.188.094.313.141.359.219.047.078.047.453-.097.858z" />
                  </svg>
                </div>
                <div>
                  <span className="text-xs font-bold text-black">Botón WhatsApp Checkout</span>
                  <p className="text-[11px] text-neutral-500">
                    Fijo en color oficial (<code className="font-mono">#25D366</code>). Permite pedidos instantáneos directos.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Número (ej. 5491155556789)"
                  value={formSettings.whatsappNumber}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, whatsappNumber: e.target.value })
                  }
                  className="px-2.5 py-1 text-xs bg-white border border-neutral-200 rounded-lg w-36 text-black focus:outline-none"
                />
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formSettings.whatsappEnabled}
                    onChange={(e) =>
                      setFormSettings({ ...formSettings, whatsappEnabled: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>
          </section>

          {/* SECCIÓN 4: SEGURIDAD Y CLAVE DE ADMINISTRACIÓN */}
          <section className="bg-white rounded-xl p-6 shadow-xs border border-[#efeded] space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">
                  Sección 04
                </span>
                <h2 className="text-base font-bold text-black">Clave de Acceso para Administrar</h2>
              </div>
              <span className="material-symbols-outlined text-neutral-400">lock</span>
            </div>

            <div className="p-4 rounded-xl bg-[#f5f3f3] border border-neutral-200 space-y-3">
              <div>
                <label className="text-xs font-bold text-black block mb-1">
                  Contraseña de Administrador
                </label>
                <p className="text-[11px] text-neutral-500 mb-2.5">
                  Esta clave es solicitada para ingresar a la gestión de productos, inventario, ventas y personalización de marca.
                </p>
                <div className="relative w-full sm:max-w-md">
                  <input
                    type={showAdminPassword ? 'text' : 'password'}
                    value={formSettings.adminPassword || 'AdminApolo2026!'}
                    onChange={(e) =>
                      setFormSettings({ ...formSettings, adminPassword: e.target.value })
                    }
                    placeholder="Escribe la clave de administrador"
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-white border border-neutral-200 text-sm font-mono font-semibold text-black focus:outline-none focus:ring-1 focus:ring-black"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black transition-colors cursor-pointer"
                    title={showAdminPassword ? 'Ocultar clave' : 'Mostrar clave'}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showAdminPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT LIVE PREVIEW COLUMN (5 Cols, Sticky) */}
        <div className="xl:col-span-5 sticky top-24 space-y-4">
          <div className="bg-white rounded-xl p-5 shadow-xs border border-[#efeded] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                <span className="text-xs font-bold text-black uppercase tracking-wider">
                  Previsualización en Vivo
                </span>
              </div>
              <div className="flex items-center gap-1 bg-[#f5f3f3] p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                    previewDevice === 'mobile' ? 'bg-white text-black shadow-2xs font-bold' : 'text-neutral-500'
                  }`}
                >
                  Móvil
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                    previewDevice === 'desktop' ? 'bg-white text-black shadow-2xs font-bold' : 'text-neutral-500'
                  }`}
                >
                  Escritorio
                </button>
              </div>
            </div>

            {/* Mockup Frame */}
            <div
              className={`rounded-xl overflow-hidden shadow-inner p-4 transition-colors duration-300 border border-neutral-200 ${
                previewDevice === 'mobile' ? 'max-w-sm mx-auto' : 'w-full'
              }`}
              style={{ backgroundColor: formSettings.backgroundColor }}
            >
              {/* Browser Header Bar */}
              <div className="bg-white rounded-lg p-2.5 shadow-2xs flex items-center justify-between mb-3 border border-neutral-100">
                <div className="flex items-center gap-2">
                  {formSettings.logoUrl ? (
                    <img
                      src={formSettings.logoUrl}
                      alt={formSettings.storeName}
                      style={{ 
                        height: `${Math.max(14, Math.round(26 * (formSettings.logoScale / 100)))}px`,
                        maxHeight: '110px'
                      }}
                      className="w-auto object-contain"
                    />
                  ) : (
                    <span className="font-bold text-xs uppercase tracking-tight">ATELIER STUDIO</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-black">
                  <span className="material-symbols-outlined text-[18px]">search</span>
                  <div className="relative">
                    <span className="material-symbols-outlined text-[18px]">shopping_bag</span>
                    <span
                      className="absolute -top-1 -right-2 text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold text-white"
                      style={{ backgroundColor: formSettings.primaryColor }}
                    >
                      1
                    </span>
                  </div>
                </div>
              </div>

              {/* Preview Product Showcase Tile */}
              <div className="bg-white rounded-xl p-3 shadow-2xs border border-neutral-100 space-y-3">
                {/* Visual Mock of Fashion Garment */}
                <div className="relative w-full aspect-[3/4] rounded-lg bg-[#f5f3f3] overflow-hidden group">
                  <img
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCVqKdXpqGJf51ctX6KxgPxa6TTRMES7CS53LEg2a2LgrU_e-2AcQQgP27YxuWzFv11r62dd5YA7XGN_znsY0jfKGrbw64fdb3bL1D1NmMDi8L5T13Zhe18WLOGVccvfUzhMI3-RUwXuUHsKnZ-lPkV8MLv1_HNmaWQySe_k_sWfRo3zbP3WJoki16I7x9GC55xD5eq-1N1uJxP0wVCje1xi-jq8Ilm46bm5nORboL6ALlgukBlgaQ"
                    alt="Vestido Wrap Lino Puro"
                    className="w-full h-full object-cover"
                  />
                  {/* Secondary Color Badge (Offers / Limited) */}
                  <div
                    className="absolute top-2 left-2 px-2 py-0.5 rounded text-white text-[10px] font-bold uppercase tracking-wider shadow-xs"
                    style={{ backgroundColor: formSettings.secondaryColor }}
                  >
                    Últimas 2 unidades
                  </div>
                </div>

                {/* Product Details */}
                <div className="space-y-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">
                        Nueva Colección
                      </span>
                      <h3 className="text-xs sm:text-sm font-bold text-black">
                        Vestido Wrap Lino Puro
                      </h3>
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-black">$148.000</span>
                  </div>

                  {/* Variant Selectors inside Preview */}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-neutral-500 font-medium">Talle:</span>
                    <div className="flex gap-1">
                      <span
                        className="px-2 py-0.5 rounded text-white text-[10px] font-bold"
                        style={{ backgroundColor: formSettings.primaryColor }}
                      >
                        S
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#f5f3f3] text-black text-[10px] font-medium">
                        M
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#f5f3f3] text-neutral-400 line-through text-[10px]">
                        L
                      </span>
                    </div>
                  </div>
                </div>

                {/* Primary Action CTA */}
                <button
                  type="button"
                  className="w-full py-2 rounded-lg text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5"
                  style={{ backgroundColor: formSettings.primaryColor }}
                >
                  <div className="flex items-center gap-0.5">
                    <span className="font-bold text-xs leading-none">+</span>
                    <span className="material-symbols-outlined text-[15px]">shopping_cart</span>
                  </div>
                  <span>Agregar al Carrito</span>
                </button>

                {/* WhatsApp Direct Order CTA */}
                {formSettings.whatsappEnabled && (
                  <button
                    type="button"
                    className="w-full py-2 rounded-lg bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.062-2.127-.53-1.833-.757-3.013-2.616-3.104-2.738-.093-.122-.738-.982-.738-1.873 0-.89.467-1.328.633-1.507.167-.179.366-.224.488-.224.122 0 .245.002.352.007.113.005.263-.043.412.316.155.374.529 1.29.576 1.385.047.094.078.204.016.327-.063.123-.094.199-.187.309-.094.109-.198.244-.282.327-.094.094-.192.196-.083.383.11.188.487.804 1.045 1.301.718.64 1.324.839 1.512.933.188.093.298.078.408-.047.11-.125.469-.546.594-.734.125-.187.25-.156.422-.093.172.062 1.09.514 1.277.608.188.094.313.141.359.219.047.078.047.453-.097.858z" />
                    </svg>
                    <span>Pedir por WhatsApp</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal / Dialog: Agregar Color a los Presets con botón de Aceptar */}
      {addPresetTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-neutral-100 flex items-center justify-between bg-[#f5f3f3]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-black text-[20px]">palette</span>
                <h3 className="font-bold text-sm text-black">
                  Agregar Color a Presets ({addPresetTarget === 'primary' ? 'Primario' : addPresetTarget === 'secondary' ? 'Secundario' : 'Fondo de Tienda'})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAddPresetTarget(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-black hover:bg-neutral-200"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              {/* Color Visual Preview & Picker */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-[#f5f3f3] border border-neutral-200">
                <div className="relative">
                  <div
                    className="w-14 h-14 rounded-full border-2 border-white shadow-md cursor-pointer transition-transform hover:scale-105"
                    style={{ backgroundColor: newPresetColor }}
                  />
                  <input
                    type="color"
                    value={newPresetColor}
                    onChange={(e) => setNewPresetColor(e.target.value.toUpperCase())}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    title="Click para abrir la paleta completa"
                  />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-bold text-black block mb-0.5">Toca el círculo para elegir</span>
                  <span className="text-[11px] text-neutral-500">
                    O escribe manualmente el código hexadecimal abajo.
                  </span>
                </div>
              </div>

              {/* Hex Code Input */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-neutral-700">Código Hexadecimal (#HEX)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-neutral-400 font-mono font-bold">#</span>
                  <input
                    type="text"
                    value={newPresetColor.replace('#', '')}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
                      setNewPresetColor(`#${clean.toUpperCase()}`);
                    }}
                    placeholder="E05A47"
                    className="h-10 w-full pl-7 pr-3 rounded-lg bg-[#f5f3f3] text-sm font-mono font-bold text-black focus:outline-none focus:bg-white border border-neutral-200"
                  />
                </div>
              </div>

              {/* Name Input */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-neutral-700">Nombre del Color (Opcional)</label>
                <input
                  type="text"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder={`Ej. Verde Musgo (${newPresetColor})`}
                  className="h-10 px-3 rounded-lg bg-[#f5f3f3] text-xs font-medium text-black focus:outline-none focus:bg-white border border-neutral-200"
                />
              </div>
            </div>

            <div className="p-4 bg-[#f5f3f3] border-t border-neutral-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddPresetTarget(null)}
                className="px-4 py-2 rounded-lg text-neutral-600 hover:text-black hover:bg-neutral-200 text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmAddPreset}
                className="px-5 py-2 rounded-lg bg-black hover:bg-neutral-800 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">check</span>
                <span>Aceptar y Agregar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Defaults Confirmation Modal */}
      {confirmResetOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-neutral-200 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-2xl">restart_alt</span>
            </div>
            <h3 className="text-base font-bold text-neutral-900 mb-1">
              ¿Restablecer configuración predeterminada?
            </h3>
            <p className="text-xs text-neutral-500 mb-5 leading-relaxed">
              Esta acción revertirá los colores, logo y configuración estética a los valores originales de fábrica del catálogo.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormSettings({ ...INITIAL_SETTINGS });
                  setConfirmResetOpen(false);
                }}
                className="px-4 py-2 text-xs font-semibold bg-neutral-900 hover:bg-black text-white rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                Restablecer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
