import React, { useState, useEffect } from 'react';
import { Product, ProductVariant, StoreSettings } from '../types';
import { useAuth } from '../context/AuthContext';
import { compressImageFile, optimizeProductImages } from '../utils/imageOptimizer';

/**
 * Converts Google Drive sharing links into direct Google CDN image URLs
 */
export function convertDriveUrlToDirectLink(url: string): { directUrl: string; wasConverted: boolean } {
  const trimmed = url.trim();
  // Match file id from Google Drive share or open links
  const driveRegex = /(?:drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:.*&)?id=)|drive\.google\.com\/uc\?export=view&id=)([a-zA-Z0-9_-]{20,})/;
  const match = trimmed.match(driveRegex);
  if (match && match[1]) {
    const fileId = match[1];
    return {
      directUrl: `https://lh3.googleusercontent.com/d/${fileId}`,
      wasConverted: true
    };
  }
  return { directUrl: trimmed, wasConverted: false };
}

interface ProductEditModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Product) => Promise<any>;
  settings: StoreSettings;
  allowDevicePhotos?: boolean;
}

export const ProductEditModal: React.FC<ProductEditModalProps> = ({
  product: initialProduct,
  isOpen,
  onClose,
  onSave,
  settings,
  allowDevicePhotos = true
}) => {
  const { managerProfile } = useAuth();
  const [product, setProduct] = useState<Product>({ ...initialProduct });
  const [newTagInput, setNewTagInput] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [driveNotice, setDriveNotice] = useState<string | null>(null);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Pre-selection states for sizes and colors
  const [selectedSizeNames, setSelectedSizeNames] = useState<string[]>(() => {
    const fromVariants = Array.from(new Set(initialProduct.variants.map((v) => v.size)));
    if (fromVariants.length > 0) return fromVariants;
    return settings.masterSizes.filter((s) => s.enabled).map((s) => s.name);
  });

  const [selectedColorNames, setSelectedColorNames] = useState<string[]>(() => {
    const fromVariants = Array.from(new Set(initialProduct.variants.map((v) => v.color)));
    if (fromVariants.length > 0) return fromVariants;
    return settings.masterColors.slice(0, 3).map((c) => c.name);
  });

  useEffect(() => {
    setProduct({ ...initialProduct });
    setNewTagInput('');
    setNewImageUrl('');

    const fromVariantsSizes = Array.from(new Set(initialProduct.variants.map((v) => v.size)));
    setSelectedSizeNames(
      fromVariantsSizes.length > 0
        ? fromVariantsSizes
        : settings.masterSizes.filter((s) => s.enabled).map((s) => s.name)
    );

    const fromVariantsColors = Array.from(new Set(initialProduct.variants.map((v) => v.color)));
    setSelectedColorNames(
      fromVariantsColors.length > 0
        ? fromVariantsColors
        : settings.masterColors.slice(0, 3).map((c) => c.name)
    );
  }, [initialProduct, isOpen, settings.masterSizes, settings.masterColors]);

  // Available colors and sizes for matrix generation
  const activeColors = Array.from(new Set(product.variants.map((v) => v.color)));
  const activeSizes = Array.from(new Set(product.variants.map((v) => v.size)));

  if (!isOpen) return null;

  // Margin calculation
  const marginGross = product.price > 0 ? product.price - product.cost : 0;
  const marginPercent = product.price > 0 ? ((marginGross / product.price) * 100).toFixed(1) : '0';
  const totalStock = product.variants.reduce((acc, v) => acc + ((v.enabled !== false && (v.enabled as any) !== 'false') ? Number(v.stock || 0) : 0), 0);

  const handleAddTag = () => {
    if (!newTagInput.trim()) return;
    if (!product.tags.includes(newTagInput.trim())) {
      setProduct({ ...product, tags: [...product.tags, newTagInput.trim()] });
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setProduct({ ...product, tags: product.tags.filter((t) => t !== tagToRemove) });
  };

  const handleAddImage = (url: string) => {
    if (!url.trim()) return;
    const { directUrl, wasConverted } = convertDriveUrlToDirectLink(url);
    setProduct((prev) => ({
      ...prev,
      images: [...prev.images, directUrl]
    }));
    setNewImageUrl('');
    if (wasConverted) {
      setDriveNotice('Enlace de Google Drive detectado y vinculado directamente como imagen.');
      setTimeout(() => setDriveNotice(null), 6000);
    }
  };

  const handleDirectFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingFiles(true);
    setSaveError(null);

    try {
      const fileList = Array.from(files);
      const compressedList: string[] = [];

      for (const file of fileList) {
        const compressed = await compressImageFile(file, {
          maxDimension: 1080,
          quality: 0.78,
          maxBytes: 150 * 1024,
        });
        compressedList.push(compressed);
      }

      setProduct((prev) => ({
        ...prev,
        images: [...prev.images, ...compressedList],
      }));
    } catch (err) {
      console.error('Error al subir fotos:', err);
      setSaveError('No se pudieron procesar algunas de las fotos seleccionadas.');
    } finally {
      setIsUploadingFiles(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    const updatedImages = product.images.filter((_, i) => i !== index);
    const newCover = product.coverIndex >= updatedImages.length ? 0 : product.coverIndex;
    setProduct({
      ...product,
      images: updatedImages,
      coverIndex: newCover
    });
  };

  const handleSetCover = (index: number) => {
    setProduct({ ...product, coverIndex: index });
  };

  const handleVariantStockChange = (index: number, newStock: number) => {
    const updated = [...product.variants];
    updated[index] = { ...updated[index], stock: Math.max(0, newStock) };
    setProduct({ ...product, variants: updated });
  };

  const handleVariantToggle = (index: number) => {
    const updated = [...product.variants];
    const isCurrentlyEnabled = updated[index].enabled !== false && (updated[index].enabled as any) !== 'false';
    updated[index] = { ...updated[index], enabled: !isCurrentlyEnabled };
    setProduct({ ...product, variants: updated });
  };

  const handleVariantSkuChange = (index: number, sku: string) => {
    const updated = [...product.variants];
    updated[index] = { ...updated[index], sku };
    setProduct({ ...product, variants: updated });
  };

  const handleRemoveVariant = (index: number) => {
    const updated = product.variants.filter((_, i) => i !== index);
    setProduct({ ...product, variants: updated });
  };

  const handleGenerateSelectedCombinations = () => {
    if (selectedSizeNames.length === 0 || selectedColorNames.length === 0) {
      alert('Por favor selecciona al menos un talle y un color para generar las combinaciones.');
      return;
    }

    const prefix = (product.name || 'PR').trim().slice(0, 3).toUpperCase();
    const generated: ProductVariant[] = [];

    selectedColorNames.forEach((colName) => {
      const masterCol = settings.masterColors.find((c) => c.name.toLowerCase() === colName.toLowerCase());
      const hex = masterCol?.hex || '#000000';

      selectedSizeNames.forEach((szName) => {
        // Keep existing stock, SKU and toggle if this combination was already configured
        const existing = product.variants.find(
          (v) => v.color.toLowerCase() === colName.toLowerCase() && v.size.toUpperCase() === szName.toUpperCase()
        );

        if (existing) {
          generated.push(existing);
        } else {
          generated.push({
            id: `var-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            color: colName,
            colorHex: hex,
            size: szName,
            sku: `${prefix}-${colName.slice(0, 3).toUpperCase()}-${szName}`,
            stock: 0,
            enabled: true
          });
        }
      });
    });

    setProduct({ ...product, variants: generated });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      // Optimize any base64 images so the document stays comfortably under Firestore's 1MB limit
      const optimizedImages = await optimizeProductImages(product.images);
      await onSave({
        ...product,
        images: optimizedImages,
        totalStock
      });
      onClose();
    } catch (e: any) {
      console.error('Error al guardar producto:', e);
      setSaveError(e?.message || 'Error al guardar el producto. Por favor intentá nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-white h-full shadow-2xl flex flex-col overflow-hidden">
        {/* Panel Header Bar */}
        <div className="px-6 py-4 bg-[#fbf9f8] border-b border-[#efeded] flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#efeded] flex items-center justify-center text-black">
              <span className="material-symbols-outlined text-[24px]">styler</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-headline-sm text-base sm:text-lg text-[#1b1c1c] font-semibold tracking-tight">
                  Edición de Producto
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    product.enabledOnline
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-neutral-100 text-neutral-600'
                  }`}
                >
                  {product.enabledOnline ? 'Activo en Catálogo' : 'Borrador / Oculto'}
                </span>
              </div>
              <p className="text-xs text-[#5f5e5b]">
                {product.name} • Código Interno: {product.variants[0]?.sku || 'BZ-2025-CLX'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-[#5f5e5b] hover:text-black hover:bg-[#efeded] transition-colors"
              title="Cerrar modal"
            >
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          </div>
        </div>

        {/* Scrollable Editorial Form Work Surface */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 bg-[#fbf9f8]">
          {/* Banner informativo al duplicar producto */}
          {!product.enabledOnline && product.name.startsWith('Copia de ') && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-900 shadow-2xs">
              <span className="material-symbols-outlined text-amber-600 text-[20px] shrink-0 mt-0.5">
                shield
              </span>
              <div className="space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-950">
                  <span>Producto Duplicado</span>
                  <span className="text-[10px] font-semibold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full">
                    Oculto para Clientes
                  </span>
                </div>
                <p className="leading-relaxed">
                  Este producto se guardó como <strong>oculto/invisible</strong> para protegerlo y que los clientes no lo vean en el catálogo online hasta que esté listo. Podés modificar cualquier dato. Cuando quieras publicarlo, activá <strong>"Habilitado en Tienda Online"</strong>. Si cerrás esta ventana, el producto ya existe guardado con sus datos clonados.
                </p>
              </div>
            </div>
          )}

          {/* ================= SECCIÓN 1: DATOS GENERALES ================= */}
          <section className="bg-white p-5 rounded-xl border border-[#efeded] space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#efeded] flex items-center justify-center text-xs font-bold text-black">
                  1
                </span>
                <h3 className="text-sm font-semibold text-black">Datos Generales</h3>
              </div>
              <div className="flex items-center gap-2 bg-[#f5f3f3] px-3 py-1 rounded-xl">
                <span className="text-xs font-medium text-black">Habilitado en Tienda Online</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={product.enabledOnline}
                    onChange={(e) => setProduct({ ...product, enabledOnline: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-black"></div>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Product Title */}
              <div className="md:col-span-8 flex flex-col gap-1">
                <label className="text-xs font-semibold text-neutral-700">Nombre de la Prenda</label>
                <input
                  type="text"
                  value={product.name}
                  onChange={(e) => setProduct({ ...product, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#fbf9f8] border border-neutral-200 rounded-lg text-sm text-black focus:outline-none focus:bg-white focus:ring-1 focus:ring-black"
                />
              </div>

              {/* Internal Category Tagging */}
              <div className="md:col-span-4 flex flex-col gap-1">
                <label className="text-xs font-semibold text-neutral-700">Categoría Principal</label>
                <select
                  value={product.category}
                  onChange={(e) => setProduct({ ...product, category: e.target.value })}
                  className="w-full px-3 py-2 bg-[#fbf9f8] border border-neutral-200 rounded-lg text-sm text-black focus:outline-none cursor-pointer"
                >
                  {settings.categories
                    .filter((c) => c !== 'Todas')
                    .map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                </select>
              </div>

              {/* Description */}
              <div className="md:col-span-12 flex flex-col gap-1">
                <label className="text-xs font-semibold text-neutral-700">
                  Descripción Editorial & Ficha Técnica
                </label>
                <textarea
                  rows={3}
                  value={product.description}
                  onChange={(e) => setProduct({ ...product, description: e.target.value })}
                  className="w-full p-3 bg-[#fbf9f8] border border-neutral-200 rounded-lg text-sm text-black focus:outline-none focus:bg-white focus:ring-1 focus:ring-black leading-relaxed"
                />
              </div>

              {/* Multiselection Tags */}
              <div className="md:col-span-12 flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-neutral-700">
                  Colecciones y Etiquetas de Búsqueda
                </label>
                <div className="flex flex-wrap items-center gap-1.5 p-2 bg-[#fbf9f8] border border-neutral-200 rounded-lg">
                  {product.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#efeded] text-neutral-800 text-xs font-medium"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="text-neutral-500 hover:text-red-600 focus:outline-none"
                      >
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    </span>
                  ))}
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      placeholder="+ Agregar etiqueta..."
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                      className="bg-transparent px-2 py-0.5 text-xs text-black focus:outline-none placeholder:text-neutral-400"
                    />
                    {newTagInput && (
                      <button
                        type="button"
                        onClick={handleAddTag}
                        className="text-xs text-black font-semibold hover:underline"
                      >
                        Añadir
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Pricing Structure */}
              <div className="md:col-span-6 flex flex-col gap-1">
                <label className="text-xs font-semibold text-neutral-700">
                  Precio de Venta al Público (ARS)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500 font-semibold">
                    $
                  </span>
                  <input
                    type="number"
                    value={product.price}
                    onChange={(e) => setProduct({ ...product, price: Number(e.target.value) })}
                    className="w-full pl-8 pr-3 py-2 bg-[#fbf9f8] border border-neutral-200 rounded-lg text-base font-bold text-black focus:outline-none focus:bg-white focus:ring-1 focus:ring-black"
                  />
                </div>
                <span className="text-[11px] text-neutral-500">
                  Margen bruto proyectado: <strong className="text-black">{marginPercent}%</strong> (${marginGross.toLocaleString('es-AR')})
                </span>
              </div>

              <div className="md:col-span-6 flex flex-col gap-1">
                <label className="text-xs font-semibold text-neutral-700">
                  Precio de Costo de Producción (ARS)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500 font-semibold">
                    $
                  </span>
                  <input
                    type="number"
                    value={product.cost}
                    onChange={(e) => setProduct({ ...product, cost: Number(e.target.value) })}
                    className="w-full pl-8 pr-3 py-2 bg-[#fbf9f8] border border-neutral-200 rounded-lg text-base font-medium text-black focus:outline-none focus:bg-white focus:ring-1 focus:ring-black"
                  />
                </div>
                <span className="text-[11px] text-neutral-500">
                  Materia prima, confección y botones incluidos
                </span>
              </div>
            </div>
          </section>

          {/* ================= SECCIÓN 2: FOTOS DEL PRODUCTO ================= */}
          <section className="bg-white p-5 rounded-xl border border-[#efeded] space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#efeded] flex items-center justify-center text-xs font-bold text-black">
                  2
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-black">Fotografía & Curaduría Visual</h3>
                  <span className="text-[11px] text-[#5f5e5b]">
                    Relación 3:4 recomendada • Máximo 8MB por archivo JPG/PNG/WEBP
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded bg-[#f5f3f3] text-xs font-medium text-black self-start sm:self-center">
                {product.images.length} fotos cargadas
              </span>
            </div>

            {/* Official Safety Guarantee Alert */}
            <div className="p-3.5 rounded-xl bg-[#efeded] flex items-start gap-3">
              <span className="material-symbols-outlined text-[22px] text-black shrink-0 mt-0.5">
                verified_user
              </span>
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-black">Sistema de Respaldo Visual Atelier</h4>
                <p className="text-xs text-[#444748] leading-relaxed">
                  Si no se adjunta foto o se encuentra en proceso de producción, el sistema asignará
                  automáticamente la <strong className="text-black">imagen genérica oficial de la prenda</strong> para preservar la armonía arquitectónica y estética de la tienda online sin espacios vacíos.
                </p>
              </div>
            </div>

            {/* Drag & Drop / Image Link Box */}
            <div className="rounded-xl p-5 flex flex-col items-center justify-center text-center bg-[#fbf9f8] border-2 border-dashed border-neutral-200 space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#efeded] flex items-center justify-center text-black">
                <span className="material-symbols-outlined text-[24px]">add_photo_alternate</span>
              </div>
              <div className="text-xs font-semibold text-black">
                Adjuntar / Subir Fotos de Lookbook
              </div>

              {/* Botón de subida directa desde PC / Celular con compresión automática */}
              {allowDevicePhotos ? (
                <div>
                  <label
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900 hover:bg-black text-white text-xs font-semibold cursor-pointer transition-all shadow-xs active:scale-[0.98] ${
                      isUploadingFiles ? 'opacity-70 pointer-events-none' : ''
                    }`}
                  >
                    {isUploadingFiles ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Optimizando fotos...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">upload_file</span>
                        <span>Subir Fotos desde tu Dispositivo (PC o Celular)</span>
                      </>
                    )}
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      disabled={isUploadingFiles}
                      onChange={handleDirectFileUpload}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[11px] text-neutral-500 mt-1">
                    Las fotos se comprimen y optimizan automáticamente para carga ultra-veloz.
                  </p>
                </div>
              ) : (
                <div className="w-full max-w-md p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-amber-600 mt-0.5">info</span>
                  <div>
                    <span className="font-semibold block">Subida desde dispositivo desactivada</span>
                    <span className="text-[11px] text-amber-800">
                      Para este comercio, ingresá las fotos mediante enlaces directos o links públicos de Google Drive a continuación.
                    </span>
                  </div>
                </div>
              )}

              <div className="w-full max-w-md pt-2 border-t border-neutral-200">
                <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider block mb-1">
                  O pegar enlace directo / Google Drive
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="https://drive.google.com/file/d/... o URL directa"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddImage(newImageUrl))}
                    className="flex-1 px-3 py-1.5 bg-white border border-neutral-300 rounded-lg text-xs text-black focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddImage(newImageUrl)}
                    className="px-3 py-1.5 rounded-lg bg-black text-white text-xs font-medium hover:bg-neutral-800 transition-colors shrink-0"
                  >
                    Agregar
                  </button>
                </div>
              </div>

              {driveNotice && (
                <div className="p-2 px-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>{driveNotice}</span>
                </div>
              )}

              <div className="flex items-center gap-1.5 text-[11px] text-[#5f5e5b]">
                <span className="material-symbols-outlined text-[15px] text-emerald-600">cloud_done</span>
                <span>Soporta enlaces compartidos de <strong>Google Drive</strong> sin necesidad de otro hosting</span>
              </div>
            </div>

            {/* Photo Gallery & Reordering */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-black">
                Secuencia de Galería
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {product.images.map((imgUrl, idx) => {
                  const isCover = idx === product.coverIndex;
                  return (
                    <div
                      key={imgUrl + idx}
                      className="relative group rounded-lg overflow-hidden bg-[#efeded] aspect-[3/4] shadow-xs border border-neutral-200"
                    >
                      <img src={imgUrl} alt="Lookbook" className="w-full h-full object-cover" />
                      {isCover && (
                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black text-white text-[9px] font-bold tracking-wider uppercase">
                          Portada
                        </span>
                      )}
                      {!isCover && (
                        <button
                          type="button"
                          onClick={() => handleSetCover(idx)}
                          className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-white/90 hover:bg-white text-black text-[9px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Hacer Portada
                        </button>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="p-1.5 bg-white rounded-full text-red-600 hover:bg-red-50"
                          title="Eliminar foto"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Visual Comparison Module: How fallback looks vs with image */}
                <div className="col-span-2 rounded-lg bg-[#fbf9f8] p-3 border border-neutral-200 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1 text-black text-xs font-bold">
                      <span className="material-symbols-outlined text-[16px]">compare</span>
                      <span>Respaldo Automático Activo</span>
                    </div>
                    <p className="text-[11px] text-neutral-500 mt-1">
                      Comparación en directo entre tarjeta con producción fotográfica y modo respaldo.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-neutral-200">
                    {/* Case A: With photo */}
                    <div className="flex-1 flex flex-col items-center">
                      <div className="w-12 h-16 rounded bg-[#efeded] overflow-hidden relative">
                        {product.images[0] ? (
                          <img
                            src={product.images[0]}
                            alt="Miniature"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-neutral-200"></div>
                        )}
                      </div>
                      <span className="text-[9px] text-neutral-600 mt-1 font-medium">Con Foto</span>
                    </div>
                    <span className="material-symbols-outlined text-neutral-400 text-[14px]">
                      sync_alt
                    </span>
                    {/* Case B: Generic Placeholder Silhouette */}
                    <div className="flex-1 flex flex-col items-center">
                      <div className="w-12 h-16 rounded bg-[#efeded] flex flex-col items-center justify-center text-neutral-500">
                        <span className="material-symbols-outlined text-[18px]">checkroom</span>
                        <span className="text-[7px] uppercase tracking-wider">Silueta</span>
                      </div>
                      <span className="text-[9px] text-neutral-600 mt-1 font-medium">Modo Silueta</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ================= SECCIÓN 3: MATRIZ DE VARIANTES TALLE × COLOR ================= */}
          <section className="bg-white p-5 rounded-xl border border-[#efeded] space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#efeded] flex items-center justify-center text-xs font-bold text-black">
                  3
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-black">
                    Matriz de Variantes Talle × Color
                  </h3>
                  <span className="text-[11px] text-[#5f5e5b]">
                    Control dimensional y existencias físicas sincronizadas
                  </span>
                </div>
              </div>
              <div className="px-3 py-1 rounded-xl bg-black text-white flex items-center gap-2 shadow-xs">
                <span className="material-symbols-outlined text-[16px]">inventory</span>
                <span className="text-xs font-medium">Total Stock Consolidado:</span>
                <span className="text-xs font-bold">{totalStock} unidades</span>
              </div>
            </div>

            {/* Preselección de Talles y Colores */}
            <div className="bg-[#fbf9f8] p-5 rounded-xl border border-neutral-200 space-y-4">
              <div>
                <span className="text-xs font-bold text-black uppercase tracking-wider block">
                  Pre-selección de Talles y Colores para esta Prenda
                </span>
                <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">
                  Elige en qué talles y colores tienes disponibilidad para este modelo. Luego presiona el botón para armar o actualizar la lista de combinaciones.
                </p>
              </div>

              {/* Talles Selector Chips */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-black flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">straighten</span>
                    <span>Talles de este modelo ({selectedSizeNames.length}):</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedSizeNames(settings.masterSizes.map((s) => s.name))}
                      className="text-[11px] text-black font-semibold hover:underline"
                    >
                      Seleccionar todos
                    </button>
                    <span className="text-neutral-300">•</span>
                    <button
                      type="button"
                      onClick={() => setSelectedSizeNames([])}
                      className="text-[11px] text-neutral-500 hover:text-black hover:underline"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {settings.masterSizes.map((size) => {
                    const isSelected = selectedSizeNames.includes(size.name);
                    return (
                      <button
                        key={size.name}
                        type="button"
                        onClick={() => {
                          setSelectedSizeNames((prev) =>
                            isSelected ? prev.filter((s) => s !== size.name) : [...prev, size.name]
                          );
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          isSelected
                            ? 'bg-black text-white border-black shadow-xs'
                            : 'bg-white text-neutral-700 hover:bg-neutral-100 border-neutral-300'
                        }`}
                      >
                        {size.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Colores Selector Chips */}
              <div className="space-y-1.5 pt-2 border-t border-neutral-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-black flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">palette</span>
                    <span>Colores de este modelo ({selectedColorNames.length}):</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedColorNames(settings.masterColors.map((c) => c.name))}
                      className="text-[11px] text-black font-semibold hover:underline"
                    >
                      Seleccionar todos
                    </button>
                    <span className="text-neutral-300">•</span>
                    <button
                      type="button"
                      onClick={() => setSelectedColorNames([])}
                      className="text-[11px] text-neutral-500 hover:text-black hover:underline"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {settings.masterColors.map((color) => {
                    const isSelected = selectedColorNames.includes(color.name);
                    return (
                      <button
                        key={color.name}
                        type="button"
                        onClick={() => {
                          setSelectedColorNames((prev) =>
                            isSelected ? prev.filter((c) => c !== color.name) : [...prev, color.name]
                          );
                        }}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                          isSelected
                            ? 'bg-black text-white border-black shadow-xs'
                            : 'bg-white text-neutral-700 hover:bg-neutral-100 border-neutral-300'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                          style={{ backgroundColor: color.hex }}
                        ></span>
                        <span>{color.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Botón de Generar combinaciones elegidas */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-neutral-200">
                <span className="text-[11px] text-neutral-500">
                  {selectedColorNames.length * selectedSizeNames.length} combinaciones seleccionadas
                </span>

                <button
                  type="button"
                  onClick={handleGenerateSelectedCombinations}
                  disabled={selectedColorNames.length === 0 || selectedSizeNames.length === 0}
                  className="px-4 py-2 rounded-lg bg-black hover:bg-neutral-800 disabled:opacity-40 text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">sync</span>
                  <span>Generar / Actualizar combinaciones seleccionadas</span>
                </button>
              </div>
            </div>

            {/* Matrix Variant Table */}
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden space-y-2">
              <div className="p-3 bg-[#f5f3f3] border-b border-neutral-200 flex items-center justify-between">
                <span className="text-xs font-bold text-black">
                  Combinaciones Cargadas ({product.variants.length})
                </span>
                <span className="text-[11px] text-neutral-500">
                  Ajusta el stock real, activa/desactiva visibilidad o pon stock en 0
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-white text-neutral-600 font-semibold uppercase tracking-wider h-9 border-b border-neutral-200">
                      <th className="py-2 px-3">Variante (Color / Talle)</th>
                      <th className="py-2 px-3">Código SKU</th>
                      <th className="py-2 px-3 w-36">Stock en Unidades</th>
                      <th className="py-2 px-3 text-center">Estado en Tienda</th>
                      <th className="py-2 px-3 text-center">Visible</th>
                      <th className="py-2 px-3 text-right">Quitar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {product.variants.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-neutral-500">
                          No hay combinaciones cargadas aún. Selecciona talles y colores arriba y presiona "Generar".
                        </td>
                      </tr>
                    ) : (
                      product.variants.map((variant, idx) => {
                        const isEnabled = variant.enabled !== false && (variant.enabled as any) !== 'false';
                        const isOutOfStock = Number(variant.stock) <= 0;
                        return (
                          <tr
                            key={variant.id || idx}
                            className={`transition-colors ${
                              !isEnabled
                                ? 'bg-neutral-50/80 opacity-60'
                                : isOutOfStock
                                ? 'bg-amber-50/40'
                                : 'hover:bg-[#fbf9f8]'
                            }`}
                          >
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                                  style={{ backgroundColor: variant.colorHex || '#000' }}
                                ></span>
                                <span className="font-semibold text-black">
                                  {variant.color} / <strong className="font-bold">{variant.size}</strong>
                                </span>
                              </div>
                            </td>

                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                value={variant.sku}
                                onChange={(e) => handleVariantSkuChange(idx, e.target.value)}
                                className="w-28 px-2 py-1 bg-[#fbf9f8] border border-neutral-200 rounded text-xs text-black focus:outline-none focus:bg-white"
                              />
                            </td>

                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleVariantStockChange(idx, variant.stock - 1)}
                                  className="w-6 h-6 rounded bg-[#efeded] hover:bg-neutral-300 flex items-center justify-center font-bold text-black"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min={0}
                                  value={variant.stock}
                                  onChange={(e) =>
                                    handleVariantStockChange(idx, Number(e.target.value))
                                  }
                                  className="w-14 text-center py-1 bg-[#fbf9f8] border border-neutral-200 rounded text-xs font-semibold text-black focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleVariantStockChange(idx, variant.stock + 1)}
                                  className="w-6 h-6 rounded bg-[#efeded] hover:bg-neutral-300 flex items-center justify-center font-bold text-black"
                                >
                                  +
                                </button>
                                <span className="text-[10px] text-neutral-400 pl-0.5">u.</span>
                              </div>
                            </td>

                            <td className="py-2.5 px-3 text-center">
                              {!isEnabled ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-600 text-[10px] font-medium">
                                  Oculta en tienda
                                </span>
                              ) : isOutOfStock ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                                  <span className="material-symbols-outlined text-[12px]">warning</span>
                                  Stock en 0 (Agotado)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Con stock ({variant.stock})
                                </span>
                              )}
                            </td>

                            <td className="py-2.5 px-3 text-center">
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isEnabled}
                                  onChange={() => handleVariantToggle(idx)}
                                  className="sr-only peer"
                                />
                                <div className="w-8 h-4 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-black"></div>
                              </label>
                            </td>

                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveVariant(idx)}
                                className="p-1 rounded text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Eliminar esta combinación"
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>

        {/* Error notification banner if save fails */}
        {saveError && (
          <div className="mx-6 mb-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-red-600">error</span>
            <span className="font-medium">{saveError}</span>
          </div>
        )}

        {/* Action Footer Bar */}
        <div className="px-6 py-4 bg-[#fbf9f8] border-t border-[#efeded] flex flex-col sm:flex-row items-center justify-between gap-3 z-10">
          <div className="flex items-center gap-1.5 text-neutral-500 text-xs">
            <span className="material-symbols-outlined text-[16px]">schedule</span>
            <span>Última modificación por {managerProfile.name}</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-lg bg-neutral-200 hover:bg-neutral-300 text-black text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="flex-1 sm:flex-initial px-6 py-2 rounded-lg bg-black hover:bg-neutral-800 text-white text-xs font-semibold transition-all shadow-sm flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">save</span>
              <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
