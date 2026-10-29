import React, { useState, useEffect, useMemo } from 'react';
import { Product, ProductVariant, StoreSettings, StoreAttribute, StoreAttributeOption } from '../types';
import { compressImageFile, optimizeProductImages } from '../utils/imageOptimizer';
import { ensureStoreAttributes, getOptionLabel, getOptionHex, fuseProductVariants } from '../utils/attributeUtils';
import { AttributeConfirmationModal } from './AttributeConfirmationModal';

/**
 * Converts Google Drive sharing links into direct Google CDN image URLs
 */
export function convertDriveUrlToDirectLink(url: string): { directUrl: string; wasConverted: boolean } {
  const trimmed = url.trim();
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

export const TAG_COLOR_PALETTE = [
  { hex: '#ef4444', label: 'Rojo' },
  { hex: '#f59e0b', label: 'Ámbar' },
  { hex: '#10b981', label: 'Verde' },
  { hex: '#6366f1', label: 'Índigo' },
  { hex: '#8b5cf6', label: 'Púrpura' },
  { hex: '#ec4899', label: 'Rosa' },
  { hex: '#06b6d4', label: 'Cyan' },
  { hex: '#475569', label: 'Grafito' },
];

export const QUICK_EMOJIS = ['🔥', '✨', '🌱', '🏷️', '⭐', '⚡', '❤️', '💎', '🎉', '🥐'];

export const DEFAULT_SUGGESTED_TAGS = [
  { name: '🔥 Hot Sale', color: '#ef4444' },
  { name: '✨ Destacado', color: '#f59e0b' },
  { name: '🏷️ Oferta', color: '#ec4899' },
  { name: '🌱 Nuevo', color: '#10b981' },
  { name: '⭐ Exclusivo', color: '#8b5cf6' },
  { name: '🚚 Envío Gratis', color: '#6366f1' },
];

interface ProductEditModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Product) => Promise<any>;
  settings: StoreSettings;
  allowDevicePhotos?: boolean;
  existingTags?: { name: string; color?: string }[];
}

export const ProductEditModal: React.FC<ProductEditModalProps> = ({
  product: initialProduct,
  isOpen,
  onClose,
  onSave,
  settings,
  allowDevicePhotos = true,
  existingTags = []
}) => {
  const { attribute1, attribute2 } = useMemo(() => ensureStoreAttributes(settings), [settings]);

  // Which attributes are enabled at store level
  const storeEnabledAttrs = useMemo(() => {
    const list: ('attr1' | 'attr2')[] = [];
    if (attribute1.enabled) list.push('attr1');
    if (attribute2.enabled) list.push('attr2');
    return list;
  }, [attribute1, attribute2]);

  const [product, setProduct] = useState<Product>({ ...initialProduct });
  const [draggedImgIndex, setDraggedImgIndex] = useState<number | null>(null);
  const [newTagInput, setNewTagInput] = useState('');
  const [selectedTagColor, setSelectedTagColor] = useState<string>(TAG_COLOR_PALETTE[0].hex);
  const [activeColorPickerTag, setActiveColorPickerTag] = useState<string | null>(null);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [driveNotice, setDriveNotice] = useState<string | null>(null);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showUnlimitedTooltip, setShowUnlimitedTooltip] = useState(false);

  // Modal confirmation for attribute add/remove
  const [attrConfirmModal, setAttrConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    affectedList?: string[];
    affectedListTitle?: string;
    confirmLabel: string;
    confirmColor?: 'red' | 'black';
    onConfirm: () => void;
  } | null>(null);

  // Attributes used by this product (subset of store enabled attributes)
  const [attributesUsed, setAttributesUsed] = useState<('attr1' | 'attr2')[]>(() => {
    if (initialProduct.attributesUsed && Array.isArray(initialProduct.attributesUsed)) {
      return initialProduct.attributesUsed.filter((id) =>
        id === 'attr1' ? attribute1.enabled : id === 'attr2' ? attribute2.enabled : false
      );
    }
    return storeEnabledAttrs;
  });

  // Selected option IDs for attribute 1
  const [selectedOptIds1, setSelectedOptIds1] = useState<string[]>(() => {
    const fromVariants = Array.from(
      new Set(
        initialProduct.variants
          .map((v) => {
            if (v.attributeOptionId1) return v.attributeOptionId1;
            const match = attribute1.options.find(
              (o) => o.label.toLowerCase() === (v.color || '').toLowerCase()
            );
            return match ? match.id : null;
          })
          .filter(Boolean) as string[]
      )
    );
    if (fromVariants.length > 0) return fromVariants;
    return attribute1.options.slice(0, 4).map((o) => o.id);
  });

  // Selected option IDs for attribute 2
  const [selectedOptIds2, setSelectedOptIds2] = useState<string[]>(() => {
    const fromVariants = Array.from(
      new Set(
        initialProduct.variants
          .map((v) => {
            if (v.attributeOptionId2) return v.attributeOptionId2;
            const match = attribute2.options.find(
              (o) => o.label.toLowerCase() === (v.size || '').toLowerCase()
            );
            return match ? match.id : null;
          })
          .filter(Boolean) as string[]
      )
    );
    if (fromVariants.length > 0) return fromVariants;
    return attribute2.options.map((o) => o.id);
  });

  useEffect(() => {
    setProduct({ ...initialProduct });
    setNewTagInput('');
    setSelectedTagColor(TAG_COLOR_PALETTE[0].hex);
    setActiveColorPickerTag(null);
    setNewImageUrl('');

    const initialAttrs = (initialProduct.attributesUsed || storeEnabledAttrs).filter((id) =>
      id === 'attr1' ? attribute1.enabled : id === 'attr2' ? attribute2.enabled : false
    );
    setAttributesUsed(initialAttrs);

    const fromVariants1 = Array.from(
      new Set(
        initialProduct.variants
          .map((v) => {
            if (v.attributeOptionId1) return v.attributeOptionId1;
            const match = attribute1.options.find(
              (o) => o.label.toLowerCase() === (v.color || '').toLowerCase()
            );
            return match ? match.id : null;
          })
          .filter(Boolean) as string[]
      )
    );
    setSelectedOptIds1(fromVariants1.length > 0 ? fromVariants1 : attribute1.options.slice(0, 4).map((o) => o.id));

    const fromVariants2 = Array.from(
      new Set(
        initialProduct.variants
          .map((v) => {
            if (v.attributeOptionId2) return v.attributeOptionId2;
            const match = attribute2.options.find(
              (o) => o.label.toLowerCase() === (v.size || '').toLowerCase()
            );
            return match ? match.id : null;
          })
          .filter(Boolean) as string[]
      )
    );
    setSelectedOptIds2(fromVariants2.length > 0 ? fromVariants2 : attribute2.options.map((o) => o.id));
  }, [initialProduct, isOpen, attribute1, attribute2, storeEnabledAttrs]);

  if (!isOpen) return null;

  // Effective price (uses discountPrice if active and valid)
  const hasDiscountPrice = Boolean(
    product.discountPrice &&
    product.discountPrice > 0 &&
    product.discountPrice < product.price
  );
  const effectivePrice = hasDiscountPrice ? product.discountPrice! : product.price;

  // Margin calculation based on effective selling price
  const marginGross = effectivePrice > 0 ? effectivePrice - product.cost : 0;
  const marginPercent = effectivePrice > 0 ? ((marginGross / effectivePrice) * 100).toFixed(1) : '0';

  const totalStock = product.variants.reduce(
    (acc, v) => acc + (v.enabled !== false && !v.unlimited ? Number(v.stock || 0) : 0),
    0
  );
  const isAllUnlimited = product.variants.length > 0 && product.variants.every((v) => v.unlimited);
  const hasSomeUnlimited = product.variants.some((v) => v.unlimited);

  // Tag helpers
  const handleAddTag = (nameToAdd?: string, colorToAdd?: string) => {
    const raw = (nameToAdd !== undefined ? nameToAdd : newTagInput).trim();
    if (!raw) return;
    const color = colorToAdd || selectedTagColor || TAG_COLOR_PALETTE[0].hex;
    const currentTags = product.tags || [];
    const currentColors = { ...(product.tagColors || {}) };

    if (!currentTags.includes(raw)) {
      setProduct({
        ...product,
        tags: [...currentTags, raw],
        tagColors: {
          ...currentColors,
          [raw]: color
        }
      });
    } else if (colorToAdd) {
      setProduct({
        ...product,
        tagColors: {
          ...currentColors,
          [raw]: colorToAdd
        }
      });
    }

    if (nameToAdd === undefined) {
      setNewTagInput('');
    }
  };

  const handleToggleExistingTag = (tagName: string, tagColor?: string) => {
    const currentTags = product.tags || [];
    if (currentTags.includes(tagName)) {
      handleRemoveTag(tagName);
    } else {
      handleAddTag(tagName, tagColor || selectedTagColor);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const nextTags = (product.tags || []).filter((t) => t !== tagToRemove);
    const nextColors = { ...(product.tagColors || {}) };
    delete nextColors[tagToRemove];
    setProduct({
      ...product,
      tags: nextTags,
      tagColors: nextColors
    });
  };

  const handleAddImageUrl = () => {
    if (!newImageUrl.trim()) return;
    const { directUrl, wasConverted } = convertDriveUrlToDirectLink(newImageUrl);
    setProduct({
      ...product,
      images: [...product.images, directUrl]
    });
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
    setProduct({
      ...product,
      images: updatedImages,
      coverIndex: 0
    });
  };

  const handleReorderImages = (fromIndex: number, toIndex: number) => {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= product.images.length ||
      toIndex >= product.images.length
    ) {
      return;
    }
    const newImages = [...product.images];
    const [moved] = newImages.splice(fromIndex, 1);
    newImages.splice(toIndex, 0, moved);
    setProduct({
      ...product,
      images: newImages,
      coverIndex: 0
    });
  };

  // =========================================================================
  // ATTRIBUTE TOGGLING FOR THIS PRODUCT (0, 1 or 2 attributes)
  // =========================================================================

  const handleToggleProductAttribute = (attrId: 'attr1' | 'attr2') => {
    const attrName = attrId === 'attr1' ? attribute1.name : attribute2.name;
    const isCurrentlyUsed = attributesUsed.includes(attrId);

    if (isCurrentlyUsed) {
      // Removing attribute: apply Stock Fusion!
      const remaining = attributesUsed.filter((id) => id !== attrId);

      if (product.variants.length > 0) {
        const { updatedProduct, summaryLines } = fuseProductVariants(product, remaining, settings);

        setAttrConfirmModal({
          isOpen: true,
          title: `Quitar atributo "${attrName}" y fusionar variantes`,
          message: `Al quitar este atributo, las variantes actuales se combinarán según las opciones que quedan, consolidando el stock:`,
          affectedList: summaryLines,
          affectedListTitle: 'Variantes resultantes de la consolidación',
          confirmLabel: 'Quitar atributo y fusionar variantes',
          confirmColor: 'black',
          onConfirm: () => {
            setAttributesUsed(remaining);
            setProduct(updatedProduct);
            setAttrConfirmModal(null);
          }
        });
        return;
      }

      setAttributesUsed(remaining);
      setProduct({ ...product, attributesUsed: remaining });
    } else {
      // Adding attribute: if product has variants, warn user that existing variants will be reset
      const newAttrs = [...attributesUsed, attrId];

      if (product.variants.length > 0) {
        setAttrConfirmModal({
          isOpen: true,
          title: `Agregar atributo "${attrName}"`,
          message: `Al agregar un nuevo atributo a esta prenda, se reconfigurará la estructura de variantes. Deberás seleccionar las opciones deseadas y presionar "Generar combinaciones".`,
          confirmLabel: 'Agregar atributo y reconfigurar',
          confirmColor: 'black',
          onConfirm: () => {
            setAttributesUsed(newAttrs);
            setProduct({ ...product, attributesUsed: newAttrs, variants: [] });
            setAttrConfirmModal(null);
          }
        });
        return;
      }

      setAttributesUsed(newAttrs);
      setProduct({ ...product, attributesUsed: newAttrs });
    }
  };

  // =========================================================================
  // VARIANT MATRIX GENERATION
  // =========================================================================

  const handleGenerateCombinations = () => {
    const prefix = (product.name || 'PR').trim().slice(0, 3).toUpperCase();
    const uses1 = attributesUsed.includes('attr1');
    const uses2 = attributesUsed.includes('attr2');

    // Case 1: 0 attributes used -> Simple Product
    if (!uses1 && !uses2) {
      const existingSimple = product.variants[0];
      const single: ProductVariant = {
        id: existingSimple?.id || `var-${Date.now()}`,
        color: '',
        size: '',
        sku: existingSimple?.sku || `${prefix}-SIMPLE`,
        stock: existingSimple ? existingSimple.stock : 10,
        enabled: true,
        unlimited: existingSimple ? existingSimple.unlimited : false
      };
      setProduct({ ...product, variants: [single] });
      return;
    }

    // Case 2: Only 1 attribute used
    if (uses1 && !uses2) {
      if (selectedOptIds1.length === 0) {
        alert(`Por favor selecciona al menos una opción de ${attribute1.name}.`);
        return;
      }
      const generated: ProductVariant[] = selectedOptIds1.map((optId) => {
        const opt = attribute1.options.find((o) => o.id === optId) || { id: optId, label: 'Opción' };
        const existing = product.variants.find((v) => v.attributeOptionId1 === optId || v.color === opt.label);

        if (existing) {
          return {
            ...existing,
            attributeOptionId1: optId,
            attributeOptionId2: undefined
          };
        }

        return {
          id: `var-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          color: attribute1.type === 'color' ? opt.label : '',
          colorHex: opt.hex,
          size: attribute1.type === 'text' ? opt.label : '',
          sku: `${prefix}-${opt.label.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '')}`,
          stock: 0,
          enabled: true,
          unlimited: false,
          attributeOptionId1: optId,
          attributeOptionId2: undefined
        };
      });

      setProduct({ ...product, variants: generated });
      return;
    }

    if (!uses1 && uses2) {
      if (selectedOptIds2.length === 0) {
        alert(`Por favor selecciona al menos una opción de ${attribute2.name}.`);
        return;
      }
      const generated: ProductVariant[] = selectedOptIds2.map((optId) => {
        const opt = attribute2.options.find((o) => o.id === optId) || { id: optId, label: 'Opción' };
        const existing = product.variants.find((v) => v.attributeOptionId2 === optId || v.size === opt.label);

        if (existing) {
          return {
            ...existing,
            attributeOptionId1: undefined,
            attributeOptionId2: optId
          };
        }

        return {
          id: `var-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          color: attribute2.type === 'color' ? opt.label : '',
          colorHex: opt.hex,
          size: attribute2.type === 'text' ? opt.label : '',
          sku: `${prefix}-${opt.label.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '')}`,
          stock: 0,
          enabled: true,
          unlimited: false,
          attributeOptionId1: undefined,
          attributeOptionId2: optId
        };
      });

      setProduct({ ...product, variants: generated });
      return;
    }

    // Case 3: Both attributes used -> Combinations Matrix (opt1 × opt2)
    if (selectedOptIds1.length === 0 || selectedOptIds2.length === 0) {
      alert(`Por favor selecciona al menos una opción de ${attribute1.name} y una de ${attribute2.name}.`);
      return;
    }

    const generated: ProductVariant[] = [];

    selectedOptIds1.forEach((id1) => {
      const opt1 = attribute1.options.find((o) => o.id === id1) || { id: id1, label: 'Op1' };

      selectedOptIds2.forEach((id2) => {
        const opt2 = attribute2.options.find((o) => o.id === id2) || { id: id2, label: 'Op2' };

        const existing = product.variants.find(
          (v) =>
            (v.attributeOptionId1 === id1 && v.attributeOptionId2 === id2) ||
            (v.color.toLowerCase() === opt1.label.toLowerCase() && v.size.toLowerCase() === opt2.label.toLowerCase())
        );

        if (existing) {
          generated.push({
            ...existing,
            attributeOptionId1: id1,
            attributeOptionId2: id2,
            colorHex: opt1.hex || existing.colorHex
          });
        } else {
          const skuCode = `${prefix}-${opt1.label.slice(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '')}-${opt2.label.slice(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '')}`;
          generated.push({
            id: `var-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            color: attribute1.type === 'color' ? opt1.label : attribute2.type === 'color' ? opt2.label : opt1.label,
            colorHex: opt1.hex || opt2.hex,
            size: attribute1.type === 'text' ? opt1.label : opt2.label,
            sku: skuCode,
            stock: 0,
            enabled: true,
            unlimited: false,
            attributeOptionId1: id1,
            attributeOptionId2: id2
          });
        }
      });
    });

    setProduct({ ...product, variants: generated });
  };

  // Mass actions on variants
  const handleMarkAllUnlimited = () => {
    const updated = product.variants.map((v) => ({ ...v, unlimited: true }));
    setProduct({ ...product, variants: updated, isUnlimited: true });
  };

  const handleMarkAllLimited = () => {
    const updated = product.variants.map((v) => ({ ...v, unlimited: false }));
    setProduct({ ...product, variants: updated, isUnlimited: false });
  };

  const handleVariantUnlimitedToggle = (index: number) => {
    const updated = [...product.variants];
    const curr = !!updated[index].unlimited;
    updated[index] = { ...updated[index], unlimited: !curr };
    setProduct({
      ...product,
      variants: updated,
      isUnlimited: updated.length > 0 && updated.every((v) => v.unlimited)
    });
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

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const optimizedImages = await optimizeProductImages(product.images);
      await onSave({
        ...product,
        images: optimizedImages,
        attributesUsed,
        totalStock,
        isUnlimited: product.variants.length > 0 && product.variants.every((v) => v.unlimited)
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
            <div className="w-10 h-10 rounded-xl bg-[#efeded] flex items-center justify-center text-black">
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
                {product.name || 'Sin título'} • Código Interno: {product.variants[0]?.sku || 'PR-SIMPLE'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#5f5e5b] hover:text-black hover:bg-[#efeded] transition-colors cursor-pointer"
              title="Cerrar modal"
            >
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          </div>
        </div>

        {/* Scrollable Form Work Surface */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 bg-[#fbf9f8]">
          {/* ================= SECCIÓN 1: DATOS GENERALES ================= */}
          <section className="bg-white p-5 rounded-2xl border border-[#efeded] space-y-4 shadow-xs">
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
                  className="w-full px-3 py-2 bg-[#fbf9f8] border border-neutral-200 rounded-xl text-sm text-black focus:outline-none focus:bg-white focus:ring-1 focus:ring-black"
                />
              </div>

              {/* Category */}
              <div className="md:col-span-4 flex flex-col gap-1">
                <label className="text-xs font-semibold text-neutral-700">Categoría Principal</label>
                <select
                  value={product.category}
                  onChange={(e) => setProduct({ ...product, category: e.target.value })}
                  className="w-full px-3 py-2 bg-[#fbf9f8] border border-neutral-200 rounded-xl text-sm text-black focus:outline-none cursor-pointer"
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
                  className="w-full px-3 py-2 bg-[#fbf9f8] border border-neutral-200 rounded-xl text-xs text-black focus:outline-none focus:bg-white focus:ring-1 focus:ring-black leading-relaxed"
                />
              </div>

              {/* Tags Section */}
              <div className="md:col-span-12 flex flex-col gap-2 pt-1 border-t border-neutral-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-neutral-500">label</span>
                    <span>Etiquetas Destacadas & Badges</span>
                  </label>
                  <span className="text-[11px] text-neutral-400">
                    Se muestran como distintivos de color sobre la foto en el catálogo
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {(product.tags || []).map((tag) => {
                    const tagColor = product.tagColors?.[tag] || TAG_COLOR_PALETTE[0].hex;
                    return (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white shadow-2xs"
                        style={{ backgroundColor: tagColor }}
                      >
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:opacity-75 transition-opacity"
                        >
                          ✕
                        </button>
                      </span>
                    );
                  })}
                </div>

                {/* Input field + Add button */}
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    placeholder="Ej: 🔥 Hot Sale o 🌱 Algodón Orgánico..."
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    className="flex-1 px-3 py-1.5 bg-[#fbf9f8] border border-neutral-200 rounded-xl text-xs text-black focus:outline-none focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddTag()}
                    disabled={!newTagInput.trim()}
                    className="px-4 py-1.5 bg-neutral-900 hover:bg-black disabled:opacity-40 text-white rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer"
                  >
                    Añadir Etiqueta
                  </button>
                </div>
              </div>

              {/* Pricing Structure */}
              <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2 border-t border-neutral-100">
                {/* 1. Precio Regular */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-neutral-700">Precio Regular (ARS)</label>
                  <input
                    type="number"
                    min={0}
                    value={product.price || ''}
                    onChange={(e) => setProduct({ ...product, price: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#fbf9f8] border border-neutral-200 rounded-xl text-base font-bold text-black focus:outline-none focus:bg-white focus:ring-1 focus:ring-black"
                  />
                  <span className="text-[11px] text-neutral-500">Precio de venta en catálogo</span>
                </div>

                {/* 2. Precio c/Descuento */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-neutral-700 flex items-center justify-between">
                    <span>Precio Oferta (ARS)</span>
                    <span className="text-[10px] text-neutral-400 font-normal">Opcional</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="Ej: 18500"
                    value={product.discountPrice !== undefined && product.discountPrice !== null && product.discountPrice > 0 ? product.discountPrice : ''}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : undefined;
                      setProduct({ ...product, discountPrice: val });
                    }}
                    className="w-full px-3 py-2 bg-[#fbf9f8] border border-neutral-200 rounded-xl text-base font-bold text-emerald-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-emerald-600"
                  />
                  {product.discountPrice && product.discountPrice > 0 && product.price > 0 ? (
                    product.discountPrice < product.price ? (
                      <span className="text-[11px] font-semibold text-emerald-600">
                        🔥 Activo: {Math.round(((product.price - product.discountPrice) / product.price) * 100)}% OFF
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-600 font-medium">
                        ⚠️ Debe ser menor al precio regular
                      </span>
                    )
                  ) : (
                    <span className="text-[11px] text-neutral-400">Si se completa, reemplaza el precio</span>
                  )}
                </div>

                {/* 3. Costo de Producción */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-neutral-700">Costo de Producción (ARS)</label>
                  <input
                    type="number"
                    min={0}
                    value={product.cost || ''}
                    onChange={(e) => setProduct({ ...product, cost: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#fbf9f8] border border-neutral-200 rounded-xl text-base font-medium text-black focus:outline-none focus:bg-white"
                  />
                  <span className="text-[11px] text-neutral-500">
                    Margen: <strong className="text-black">{marginPercent}%</strong> (${marginGross.toLocaleString('es-AR')})
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ================= SECCIÓN 2: FOTOS DEL PRODUCTO ================= */}
          <section className="bg-white p-5 rounded-2xl border border-[#efeded] space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#efeded] flex items-center justify-center text-xs font-bold text-black">
                  2
                </span>
                <h3 className="text-sm font-semibold text-black">Fotografía de la Prenda</h3>
              </div>
              <span className="px-2.5 py-1 rounded-xl bg-[#f5f3f3] text-xs font-medium text-black">
                {product.images.length} fotos cargadas
              </span>
            </div>

            {/* Upload Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {allowDevicePhotos && (
                <label className="flex items-center justify-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-black text-white rounded-xl text-xs font-semibold cursor-pointer transition-all shadow-xs shrink-0">
                  <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
                  <span>{isUploadingFiles ? 'Procesando...' : 'Subir Fotos'}</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    disabled={isUploadingFiles}
                    onChange={handleDirectFileUpload}
                    className="hidden"
                  />
                </label>
              )}

              <div className="flex-1 flex items-center gap-2">
                <input
                  type="url"
                  placeholder="O pegar URL directa o enlace de Google Drive..."
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  className="flex-1 px-3 py-2 bg-[#fbf9f8] border border-neutral-200 rounded-xl text-xs text-black focus:outline-none focus:bg-white"
                />
                <button
                  type="button"
                  onClick={handleAddImageUrl}
                  disabled={!newImageUrl.trim()}
                  className="px-3 py-2 bg-neutral-200 hover:bg-neutral-300 disabled:opacity-40 text-black rounded-xl text-xs font-semibold transition-colors"
                >
                  Vincular
                </button>
              </div>
            </div>

            {driveNotice && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                {driveNotice}
              </div>
            )}

            {/* Photos Grid */}
            {product.images.length === 0 ? (
              <div className="p-8 rounded-2xl bg-[#fbf9f8] border border-neutral-200 text-center text-xs text-neutral-400">
                Aún no has agregado fotos. Podés subir desde tu dispositivo o pegar un enlace arriba.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {product.images.map((imgUrl, idx) => (
                  <div
                    key={imgUrl + idx}
                    className="relative group rounded-xl overflow-hidden bg-[#efeded] aspect-[3/4] shadow-xs border border-neutral-200"
                  >
                    <img src={imgUrl} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                    {idx === 0 && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/80 text-white text-[9px] font-bold uppercase tracking-wider">
                        Portada
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute top-2 right-2 p-1 bg-white/90 hover:bg-red-50 text-red-600 rounded-lg shadow-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ================= SECCIÓN 3: ATRIBUTOS Y VARIANTES ================= */}
          <section className="bg-white p-5 rounded-2xl border border-[#efeded] space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#efeded] flex items-center justify-center text-xs font-bold text-black">
                  3
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-black">Atributos y Variantes de Stock</h3>
                  <span className="text-[11px] text-[#5f5e5b]">
                    Configura opciones dimensionales o maneja stock ilimitado
                  </span>
                </div>
              </div>

              <div className="px-3.5 py-1.5 rounded-xl bg-black text-white flex items-center gap-2 shadow-xs self-start sm:self-center">
                <span className="material-symbols-outlined text-[16px]">inventory</span>
                <span className="text-xs font-medium">Total Stock:</span>
                <span className="text-xs font-bold">
                  {isAllUnlimited
                    ? '∞ Ilimitado'
                    : hasSomeUnlimited
                    ? `${totalStock} u. + ilimitadas`
                    : `${totalStock} unidades`}
                </span>
              </div>
            </div>

            {/* Atributos Habilitados para esta Prenda */}
            <div className="bg-[#fbf9f8] p-4 rounded-2xl border border-neutral-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-black uppercase tracking-wider block">
                    ¿Qué atributos utiliza este producto?
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    Elegí si esta prenda utiliza uno, ambos o ninguno de los atributos de la tienda.
                  </span>
                </div>

                {/* Attribute Selector Toggles */}
                <div className="flex items-center gap-2 flex-wrap">
                  {attribute1.enabled && (
                    <button
                      type="button"
                      onClick={() => handleToggleProductAttribute('attr1')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        attributesUsed.includes('attr1')
                          ? 'bg-black text-white border-black shadow-xs'
                          : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">
                        {attributesUsed.includes('attr1') ? 'check' : 'add'}
                      </span>
                      <span>{attribute1.name}</span>
                    </button>
                  )}

                  {attribute2.enabled && (
                    <button
                      type="button"
                      onClick={() => handleToggleProductAttribute('attr2')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        attributesUsed.includes('attr2')
                          ? 'bg-black text-white border-black shadow-xs'
                          : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">
                        {attributesUsed.includes('attr2') ? 'check' : 'add'}
                      </span>
                      <span>{attribute2.name}</span>
                    </button>
                  )}

                  {attributesUsed.length === 0 && (
                    <span className="text-xs text-neutral-500 font-medium">
                      (Producto simple sin atributos)
                    </span>
                  )}
                </div>
              </div>

              {/* Options Chips for Attr 1 */}
              {attributesUsed.includes('attr1') && attribute1.enabled && (
                <div className="pt-2 border-t border-neutral-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-black">
                      Opciones de {attribute1.name} para esta prenda ({selectedOptIds1.length}):
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedOptIds1(attribute1.options.map((o) => o.id))}
                        className="text-[11px] text-black font-semibold hover:underline"
                      >
                        Todas
                      </button>
                      <span className="text-neutral-300">•</span>
                      <button
                        type="button"
                        onClick={() => setSelectedOptIds1([])}
                        className="text-[11px] text-neutral-500 hover:text-black hover:underline"
                      >
                        Limpiar
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {attribute1.options.map((opt) => {
                      const isSelected = selectedOptIds1.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setSelectedOptIds1((prev) =>
                              isSelected ? prev.filter((id) => id !== opt.id) : [...prev, opt.id]
                            );
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                            isSelected
                              ? 'bg-black text-white border-black shadow-xs'
                              : 'bg-white text-neutral-700 hover:bg-neutral-100 border-neutral-300'
                          }`}
                        >
                          {attribute1.type === 'color' && opt.hex && (
                            <span
                              className="w-3 h-3 rounded-full border border-black/15 shrink-0"
                              style={{ backgroundColor: opt.hex }}
                            />
                          )}
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Options Chips for Attr 2 */}
              {attributesUsed.includes('attr2') && attribute2.enabled && (
                <div className="pt-2 border-t border-neutral-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-black">
                      Opciones de {attribute2.name} para esta prenda ({selectedOptIds2.length}):
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedOptIds2(attribute2.options.map((o) => o.id))}
                        className="text-[11px] text-black font-semibold hover:underline"
                      >
                        Todas
                      </button>
                      <span className="text-neutral-300">•</span>
                      <button
                        type="button"
                        onClick={() => setSelectedOptIds2([])}
                        className="text-[11px] text-neutral-500 hover:text-black hover:underline"
                      >
                        Limpiar
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {attribute2.options.map((opt) => {
                      const isSelected = selectedOptIds2.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setSelectedOptIds2((prev) =>
                              isSelected ? prev.filter((id) => id !== opt.id) : [...prev, opt.id]
                            );
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                            isSelected
                              ? 'bg-black text-white border-black shadow-xs'
                              : 'bg-white text-neutral-700 hover:bg-neutral-100 border-neutral-300'
                          }`}
                        >
                          {attribute2.type === 'color' && opt.hex && (
                            <span
                              className="w-3 h-3 rounded-full border border-black/15 shrink-0"
                              style={{ backgroundColor: opt.hex }}
                            />
                          )}
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Button to Generate / Sync Combinations */}
              <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-neutral-200">
                <span className="text-[11px] text-neutral-500">
                  {attributesUsed.length === 0
                    ? 'Genera una única variante para este producto simple'
                    : attributesUsed.length === 1
                    ? `${(attributesUsed[0] === 'attr1' ? selectedOptIds1 : selectedOptIds2).length} variantes a generar`
                    : `${selectedOptIds1.length * selectedOptIds2.length} combinaciones a generar`}
                </span>

                <button
                  type="button"
                  onClick={handleGenerateCombinations}
                  className="px-4 py-2 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">sync</span>
                  <span>Generar / Actualizar combinaciones</span>
                </button>
              </div>
            </div>

            {/* Matrix Variant Table */}
            <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden space-y-2">
              {/* Header with Mass Actions & Tooltip */}
              <div className="p-3.5 bg-[#f5f3f3] border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-black">
                    Combinaciones Cargadas ({product.variants.length})
                  </span>

                  {/* Help Tooltip ? for Unlimited Stock */}
                  <div className="relative inline-block">
                    <button
                      type="button"
                      onClick={() => setShowUnlimitedTooltip(!showUnlimitedTooltip)}
                      onMouseEnter={() => setShowUnlimitedTooltip(true)}
                      onMouseLeave={() => setShowUnlimitedTooltip(false)}
                      className="w-5 h-5 rounded-full bg-neutral-200 hover:bg-neutral-300 text-neutral-700 text-[11px] font-bold flex items-center justify-center cursor-pointer transition-colors"
                      title="¿Qué es el stock ilimitado?"
                    >
                      ?
                    </button>
                    {showUnlimitedTooltip && (
                      <div className="absolute left-6 top-1/2 -translate-y-1/2 w-64 p-3 bg-neutral-900 text-white text-[11px] rounded-xl shadow-xl z-20 leading-relaxed pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                        <strong>Stock Ilimitado:</strong> Estas variantes nunca figurarán agotadas en la tienda ni bloquearán la compra. Tampoco se descontará stock al registrar ventas por Mercado Pago, WhatsApp o mostrador.
                      </div>
                    )}
                  </div>
                </div>

                {/* Mass Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleMarkAllUnlimited}
                    className="px-2.5 py-1 bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300 rounded-lg text-[11px] font-semibold transition-colors shadow-2xs"
                  >
                    Marcar todas como ilimitadas
                  </button>
                  <button
                    type="button"
                    onClick={handleMarkAllLimited}
                    className="px-2.5 py-1 bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300 rounded-lg text-[11px] font-semibold transition-colors shadow-2xs"
                  >
                    Volver a todas limitadas
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-white text-neutral-600 font-semibold uppercase tracking-wider h-9 border-b border-neutral-200">
                      <th className="py-2 px-3">Variante</th>
                      <th className="py-2 px-3">Código SKU</th>
                      <th className="py-2 px-3 text-center">Stock Ilimitado</th>
                      <th className="py-2 px-3 w-36">Stock Unidades</th>
                      <th className="py-2 px-3 text-center">Visible</th>
                      <th className="py-2 px-3 text-right">Quitar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {product.variants.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-neutral-500">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-semibold text-neutral-700">Sin variantes: no se ve en la tienda</span>
                            <span className="text-[11px] text-neutral-400">
                              Selecciona opciones arriba y presiona "Generar / Actualizar combinaciones".
                            </span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      product.variants.map((variant, idx) => {
                        const isEnabled = variant.enabled !== false && (variant.enabled as any) !== 'false';
                        const isUnlimited = !!variant.unlimited;
                        const isOutOfStock = !isUnlimited && Number(variant.stock) <= 0;

                        // Display label for variant
                        const label1 = attribute1.enabled
                          ? getOptionLabel(attribute1, variant.attributeOptionId1, variant.color)
                          : variant.color;
                        const label2 = attribute2.enabled
                          ? getOptionLabel(attribute2, variant.attributeOptionId2, variant.size)
                          : variant.size;
                        const hex = variant.colorHex || (attribute1.type === 'color' ? getOptionHex(attribute1, variant.attributeOptionId1) : undefined);

                        const displayTitle = [label1, label2].filter(Boolean).join(' / ') || 'Producto Simple';

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
                                {hex && (
                                  <span
                                    className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                                    style={{ backgroundColor: hex }}
                                  />
                                )}
                                <span className="font-semibold text-black">{displayTitle}</span>
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

                            {/* Unlimited Stock Toggle */}
                            <td className="py-2.5 px-3 text-center">
                              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={isUnlimited}
                                  onChange={() => handleVariantUnlimitedToggle(idx)}
                                  className="w-4 h-4 rounded text-black focus:ring-0 border-neutral-300 cursor-pointer"
                                />
                                <span className={`text-[11px] font-bold ${isUnlimited ? 'text-black' : 'text-neutral-400'}`}>
                                  {isUnlimited ? '∞ Ilimitado' : 'Limitado'}
                                </span>
                              </label>
                            </td>

                            {/* Stock Quantity */}
                            <td className="py-2.5 px-3">
                              {isUnlimited ? (
                                <div className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded inline-block">
                                  ∞ Ilimitado
                                </div>
                              ) : (
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
                              )}
                            </td>

                            {/* Visible Toggle */}
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

                            {/* Remove Variant */}
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveVariant(idx)}
                                className="p-1 rounded text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Eliminar combinación"
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
        <div className="px-6 py-4 bg-[#fbf9f8] border-t border-[#efeded] flex items-center justify-end gap-3 z-10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-neutral-200 hover:bg-neutral-300 text-black text-xs font-semibold transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-6 py-2 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-semibold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">save</span>
            <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
          </button>
        </div>
      </div>

      {/* Attribute Add/Remove Confirmation Modal */}
      {attrConfirmModal && (
        <AttributeConfirmationModal
          isOpen={attrConfirmModal.isOpen}
          onClose={() => setAttrConfirmModal(null)}
          title={attrConfirmModal.title}
          message={attrConfirmModal.message}
          affectedList={attrConfirmModal.affectedList}
          affectedListTitle={attrConfirmModal.affectedListTitle}
          confirmLabel={attrConfirmModal.confirmLabel}
          confirmColor={attrConfirmModal.confirmColor}
          onConfirm={attrConfirmModal.onConfirm}
        />
      )}
    </div>
  );
};
