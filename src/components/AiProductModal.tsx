import React, { useState } from 'react';
import { StoreSettings } from '../types';
import { convertDriveUrlToDirectLink } from './ProductEditModal';
import { compressImageFile } from '../utils/imageOptimizer';
import { ensureStoreAttributes } from '../utils/attributeUtils';

interface AiDetectedColor {
  name: string;
  hex: string;
  isNew: boolean;
}

interface AiAnalysisResult {
  name: string;
  description: string;
  colors: AiDetectedColor[];
  tags: string[];
}

interface AiProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: StoreSettings;
  allowDevicePhotos?: boolean;
  onContinueToForm: (data: {
    name: string;
    description: string;
    category: string;
    images: string[];
    selectedColors: string[];
    newColorsToSave: Array<{ name: string; hex: string }>;
    tags: string[];
  }) => Promise<void> | void;
}

export const AiProductModal: React.FC<AiProductModalProps> = ({
  isOpen,
  onClose,
  settings,
  allowDevicePhotos = true,
  onContinueToForm,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    const valid = settings.categories.filter((c) => c !== 'Todas');
    return valid[0] || 'Vestidos';
  });

  const [images, setImages] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Result state after AI analysis
  const [result, setResult] = useState<AiAnalysisResult | null>(null);
  const [saveNewColorsToMaster, setSaveNewColorsToMaster] = useState(true);

  if (!isOpen) return null;

  // Handle local file uploads (converts and compresses to lightweight WebP/JPEG data URLs)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setErrorMsg(null);
    setIsCompressing(true);

    try {
      const fileList = Array.from(files);
      const compressedList: string[] = [];

      for (const file of fileList) {
        // Automatically compress to max 1080px, WebP/JPEG ~120KB max
        const compressed = await compressImageFile(file, {
          maxDimension: 1080,
          quality: 0.78,
          maxBytes: 150 * 1024,
        });
        compressedList.push(compressed);
      }

      setImages((prev) => [...prev, ...compressedList]);
    } catch (err: any) {
      console.error('Error al comprimir imágenes:', err);
      setErrorMsg('Ocurrió un error al procesar las fotos. Por favor probá de nuevo.');
    } finally {
      setIsCompressing(false);
      // Reset input
      e.target.value = '';
    }
  };

  // Handle direct URL / Drive URL
  const handleAddUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;

    const { directUrl } = convertDriveUrlToDirectLink(trimmed);
    setImages((prev) => [...prev, directUrl]);
    setUrlInput('');
    setErrorMsg(null);
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Check if store has any enabled attribute of type "color"
  const { attribute1, attribute2 } = ensureStoreAttributes(settings);
  const hasEnabledColorAttr =
    (attribute1.enabled && attribute1.type === 'color') ||
    (attribute2.enabled && attribute2.type === 'color');

  // Call the server Gemini API endpoint
  const handleAnalyzeWithAI = async () => {
    if (images.length === 0) {
      setErrorMsg('Debes cargar al menos una foto del producto para que la IA pueda analizarlo.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/ai/analyze-product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          images,
          category: selectedCategory,
          includeColors: hasEnabledColorAttr,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${response.status} al procesar con IA`);
      }

      const data = await response.json();

      // Compare colors with masterColors to distinguish existing vs new
      const masterColorsMap = new Map(
        (settings.masterColors || []).map((c) => [c.name.trim().toLowerCase(), c])
      );

      const detectedColors: AiDetectedColor[] = hasEnabledColorAttr
        ? (data.colors || []).map((col: { name: string; hex: string }) => {
            const cleanName = col.name.trim();
            const exists = masterColorsMap.has(cleanName.toLowerCase());
            const masterMatch = masterColorsMap.get(cleanName.toLowerCase());

            return {
              name: cleanName,
              hex: exists && masterMatch ? masterMatch.hex : col.hex || '#1A1A1A',
              isNew: !exists,
            };
          })
        : [];

      setResult({
        name: data.name || '',
        description: data.description || '',
        colors: detectedColors,
        tags: data.tags || [],
      });
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error al comunicarse con la IA. Verificá tu conexión.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmAndProceed = async () => {
    if (!result) return;

    const selectedColors = hasEnabledColorAttr ? result.colors.map((c) => c.name) : [];
    const newColorsToSave = hasEnabledColorAttr && saveNewColorsToMaster
      ? result.colors.filter((c) => c.isNew).map((c) => ({ name: c.name, hex: c.hex }))
      : [];

    await onContinueToForm({
      name: result.name,
      description: result.description,
      category: selectedCategory,
      images,
      selectedColors,
      newColorsToSave,
      tags: result.tags,
    });

    onClose();
  };

  const categories = settings.categories.filter((c) => c !== 'Todas');

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-neutral-900 via-neutral-900 to-neutral-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-amber-300 shadow-inner">
              <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-white">
                  Nuevo Producto con IA
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-semibold border border-amber-400/30">
                  Gemini Flash 2.5
                </span>
              </div>
              <p className="text-[11px] text-neutral-300">
                Carga las fotos y la categoría para redactar el producto automáticamente
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isAnalyzing}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2 animate-in fade-in">
              <span className="material-symbols-outlined text-[18px] text-red-600 shrink-0 mt-0.5">
                error
              </span>
              <div className="flex-1">{errorMsg}</div>
            </div>
          )}

          {/* LOADING STATE */}
          {isAnalyzing ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-neutral-200 border-t-neutral-900 animate-spin" />
                <span className="material-symbols-outlined text-2xl text-amber-500 absolute inset-0 m-auto flex items-center justify-center">
                  auto_awesome
                </span>
              </div>

              <div className="space-y-1 max-w-sm">
                <h3 className="text-base font-bold text-neutral-900">
                  Analizando prenda(s) con Gemini...
                </h3>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Extrayendo cortes, géneros, tipologías, paleta de colores y redactando el texto comercial.
                </p>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-neutral-400 bg-neutral-100 px-3 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Tiempo estimado: 2 a 3 segundos</span>
              </div>
            </div>
          ) : result ? (
            /* STEP 2: REVIEW & CONFIRM COLORS BEFORE GOING TO FULL FORM */
            <div className="space-y-5 animate-in fade-in">
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-900 text-xs flex items-center gap-2.5">
                <span className="material-symbols-outlined text-emerald-600 text-[20px] shrink-0">
                  check_circle
                </span>
                <div>
                  <strong>¡Análisis completado con éxito!</strong> Revisá los datos generados y los colores sugeridos antes de abrir el formulario.
                </div>
              </div>

              {/* Title generated */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 flex items-center justify-between">
                  <span>Nombre del Producto (Sugerido por IA)</span>
                  <span className="text-[10px] text-neutral-400 font-normal">Editable</span>
                </label>
                <input
                  type="text"
                  value={result.name}
                  onChange={(e) => setResult({ ...result, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold text-neutral-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-black"
                />
              </div>

              {/* Description generated */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 flex items-center justify-between">
                  <span>Descripción Armoniosa (1-2 párrafos)</span>
                  <span className="text-[10px] text-neutral-400 font-normal">Editable</span>
                </label>
                <textarea
                  rows={4}
                  value={result.description}
                  onChange={(e) => setResult({ ...result, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs text-neutral-800 leading-relaxed focus:outline-none focus:bg-white focus:ring-1 focus:ring-black resize-none"
                />
              </div>

              {/* COLORS IDENTIFIED & SUGGESTIONS (only if store has a color attribute enabled) */}
              {hasEnabledColorAttr && (
                <div className="p-4 rounded-xl bg-[#f5f3f3] border border-neutral-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-neutral-700">
                        palette
                      </span>
                      <span className="text-xs font-bold text-neutral-900">
                        Colores Determinantes Detectados ({result.colors.length})
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {result.colors.map((col, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-white rounded-xl border border-neutral-200 flex items-center justify-between gap-2 shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-5 h-5 rounded-full border border-neutral-300 shrink-0 shadow-2xs"
                            style={{ backgroundColor: col.hex }}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-neutral-900 truncate">
                              {col.name}
                            </div>
                            <div className="text-[10px] font-mono text-neutral-400 uppercase">
                              {col.hex}
                            </div>
                          </div>
                        </div>

                        {col.isNew ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                            Nuevo Color
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">check</span>
                            En tu Tienda
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Option to automatically register new colors to masterColors */}
                  {result.colors.some((c) => c.isNew) && (
                    <label className="flex items-start gap-2.5 pt-2 border-t border-neutral-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={saveNewColorsToMaster}
                        onChange={(e) => setSaveNewColorsToMaster(e.target.checked)}
                        className="mt-0.5 rounded text-black focus:ring-black"
                      />
                      <span className="text-xs text-neutral-700 leading-snug">
                        <strong>Sumar colores nuevos a la paleta oficial de la tienda:</strong> Se registrarán en la configuración global para que queden disponibles para siempre en futuras prendas.
                      </span>
                    </label>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* STEP 1: UPLOAD PHOTOS & CATEGORY */
            <div className="space-y-5">
              {/* Category Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">category</span>
                  <span>Categoría de la Prenda</span>
                  <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#f5f3f3] hover:bg-[#efeded] border border-neutral-300 rounded-xl text-xs font-bold text-neutral-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-black transition-colors"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-neutral-400">
                  Ayuda a la IA a afinar los cortes y el vocabulario específico del rubro.
                </p>
              </div>

              {/* Photos Upload Area */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                    <span>Fotos de la Prenda ({images.length})</span>
                    <span className="text-red-500">* Mínimo 1 obligatoria</span>
                  </span>
                  {images.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setImages([])}
                      className="text-[11px] text-red-600 hover:underline cursor-pointer"
                    >
                      Quitar todas
                    </button>
                  )}
                </label>

                {/* Dropzone & Local File Picker */}
                <div className="p-4 sm:p-5 rounded-2xl border-2 border-dashed border-neutral-300 hover:border-neutral-500 bg-[#fbf9f8] transition-colors text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-neutral-100 text-neutral-700 flex items-center justify-center mx-auto">
                    <span className="material-symbols-outlined text-2xl">add_photo_alternate</span>
                  </div>

                  {allowDevicePhotos ? (
                    <div>
                      <label
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900 hover:bg-black text-white text-xs font-semibold cursor-pointer transition-all shadow-xs active:scale-[0.98] ${
                          isCompressing ? 'opacity-70 pointer-events-none' : ''
                        }`}
                      >
                        {isCompressing ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Optimizando fotos...</span>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[16px]">upload_file</span>
                            <span>Seleccionar Fotos desde tu Dispositivo</span>
                          </>
                        )}
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          disabled={isCompressing}
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                      <p className="text-[11px] text-neutral-500 mt-1.5">
                        Podés subir una o varias fotos a la vez (frente, dorso, detalles de tela o variantes).
                        Las imágenes se optimizan automáticamente para carga ultra-rápida.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2.5 max-w-md mx-auto text-left">
                      <span className="material-symbols-outlined text-[18px] text-amber-600 mt-0.5">info</span>
                      <div>
                        <span className="font-semibold block">Subida desde dispositivo desactivada</span>
                        <span className="text-[11px] text-amber-800">
                          Para este comercio, cargá las fotos de la prenda pegando enlaces web directos o de Google Drive a continuación.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Or add via direct link / Google Drive */}
                  <div className="pt-2 border-t border-neutral-200 max-w-md mx-auto">
                    <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider block mb-1.5">
                      O ingresar enlace directo / Google Drive
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddUrl())}
                        placeholder="https://drive.google.com/... o enlace de imagen"
                        className="flex-1 px-3 py-1.5 bg-white border border-neutral-300 rounded-lg text-xs text-neutral-800 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddUrl}
                        disabled={!urlInput.trim()}
                        className="px-3 py-1.5 bg-neutral-800 hover:bg-black disabled:opacity-40 text-white rounded-lg text-xs font-semibold cursor-pointer shrink-0"
                      >
                        Agregar
                      </button>
                    </div>
                  </div>
                </div>

                {/* Thumbnails Grid */}
                {images.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-semibold text-neutral-500">
                      Fotos cargadas para análisis:
                    </span>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                      {images.map((img, idx) => (
                        <div
                          key={idx}
                          className="relative aspect-[3/4] rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200 group shadow-2xs"
                        >
                          <img
                            src={img}
                            alt={`Preview ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center transition-all cursor-pointer opacity-90 group-hover:opacity-100"
                            title="Quitar foto"
                          >
                            <span className="material-symbols-outlined text-[14px]">close</span>
                          </button>
                          <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-semibold">
                            #{idx + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Bar */}
        <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isAnalyzing}
            className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-black rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          {result ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setResult(null)}
                className="px-3.5 py-2 bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Volver a fotos
              </button>
              <button
                type="button"
                onClick={handleConfirmAndProceed}
                className="px-4 py-2 bg-neutral-900 hover:bg-black text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>Continuar a Edición de Producto</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={images.length === 0 || isAnalyzing}
              onClick={handleAnalyzeWithAI}
              className="px-5 py-2.5 bg-neutral-900 hover:bg-black disabled:opacity-40 text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[17px] text-amber-300">
                auto_awesome
              </span>
              <span>Siguiente: Analizar con IA</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
