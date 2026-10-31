import React, { useState, useMemo } from 'react';
import { Product, StoreSettings, StoreFeatureFlags, StoreAttribute, StoreAttributeOption } from '../types';
import { ProductEditModal } from './ProductEditModal';
import { AiProductModal } from './AiProductModal';
import { AttributeConfirmationModal } from './AttributeConfirmationModal';
import { useModalHistory } from '../hooks/useModalHistory';
import {
  ensureStoreAttributes,
  getOptionLabel,
  formatVariantLine,
  fuseProductVariants
} from '../utils/attributeUtils';

interface InventoryViewProps {
  products: Product[];
  settings: StoreSettings;
  onSaveProduct: (product: Product) => Promise<any>;
  onDeleteProduct: (productId: string) => Promise<any>;
  onUpdateSettings?: (settings: Partial<StoreSettings>) => Promise<any>;
  featureFlags?: StoreFeatureFlags;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  products,
  settings,
  onSaveProduct,
  onDeleteProduct,
  onUpdateSettings,
  featureFlags
}) => {
  const { attribute1, attribute2 } = useMemo(() => ensureStoreAttributes(settings), [settings]);

  const [selectedSubTab, setSelectedSubTab] = useState<'products' | 'categories' | 'attr1' | 'attr2'>('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // In-app deletion confirmation dialog states
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Generic attribute confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    affectedList?: string[];
    affectedListTitle?: string;
    confirmLabel: string;
    confirmColor?: 'red' | 'black';
    onConfirm: () => Promise<void> | void;
  } | null>(null);

  // Management states for categories
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<{ original: string; current: string } | null>(null);

  // Form states for adding options to attribute1 & attribute2
  const [newAttr1Label, setNewAttr1Label] = useState('');
  const [newAttr1Hex, setNewAttr1Hex] = useState('#1A1A1A');

  const [newAttr2Label, setNewAttr2Label] = useState('');
  const [newAttr2Hex, setNewAttr2Hex] = useState('#1A1A1A');

  // Inline editing state for attribute options
  const [editingOption, setEditingOption] = useState<{
    attrId: 'attr1' | 'attr2';
    optionId: string;
    label: string;
    hex?: string;
  } | null>(null);

  // Session-dismissed warnings for unused attributes
  const [dismissedWarnings, setDismissedWarnings] = useState<Record<string, boolean>>({});
  const [neverShowWarningChecked, setNeverShowWarningChecked] = useState<Record<string, boolean>>({});

  // Feedback notifications
  const [flashMessage, setFlashMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setFlashMessage({ type, text });
    setTimeout(() => {
      setFlashMessage((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  // Mobile Back Button / Gesture handlers for Inventory modals
  useModalHistory({
    isOpen: Boolean(editingProduct),
    onClose: () => setEditingProduct(null),
    modalKey: 'product-edit-modal'
  });

  useModalHistory({
    isOpen: isAiModalOpen,
    onClose: () => setIsAiModalOpen(false),
    modalKey: 'ai-product-modal'
  });

  useModalHistory({
    isOpen: Boolean(productToDelete),
    onClose: () => setProductToDelete(null),
    modalKey: 'confirm-delete-product'
  });

  useModalHistory({
    isOpen: Boolean(categoryToDelete),
    onClose: () => setCategoryToDelete(null),
    modalKey: 'confirm-delete-category'
  });

  useModalHistory({
    isOpen: Boolean(confirmModal?.isOpen),
    onClose: () => setConfirmModal(null),
    modalKey: 'confirm-attribute-action'
  });

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      const matchesSearch =
        prod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prod.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prod.variants.some((v) => v.sku.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory =
        categoryFilter === 'Todas' || prod.category.toLowerCase() === categoryFilter.toLowerCase();

      const isProdInStock = prod.isUnlimited || prod.variants.some((v) => v.unlimited) || prod.totalStock > 0;

      let matchesStatus = true;
      if (statusFilter === 'active') matchesStatus = prod.enabledOnline && isProdInStock;
      if (statusFilter === 'draft') matchesStatus = !prod.enabledOnline;
      if (statusFilter === 'out_of_stock') matchesStatus = !isProdInStock;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, searchQuery, categoryFilter, statusFilter]);

  // Out of stock alert count (excluding unlimited products)
  const outOfStockCount = products.filter(
    (p) => !p.isUnlimited && !p.variants.some((v) => v.unlimited) && p.totalStock <= 0
  ).length;
  const totalSkuCount = products.reduce((acc, p) => acc + p.variants.length, 0);

  // Category usage
  const categoryUsage = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((p) => {
      map[p.category] = (map[p.category] || 0) + 1;
    });
    return map;
  }, [products]);

  // Check which products use attribute1 and attribute2
  const productsUsingAttr1 = useMemo(() => {
    return products.filter((p) => p.attributesUsed?.includes('attr1'));
  }, [products]);

  const productsUsingAttr2 = useMemo(() => {
    return products.filter((p) => p.attributesUsed?.includes('attr2'));
  }, [products]);

  // Option usage counts
  const optionUsage = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((p) => {
      p.variants.forEach((v) => {
        if (v.attributeOptionId1) {
          map[v.attributeOptionId1] = (map[v.attributeOptionId1] || 0) + 1;
        }
        if (v.attributeOptionId2) {
          map[v.attributeOptionId2] = (map[v.attributeOptionId2] || 0) + 1;
        }
      });
    });
    return map;
  }, [products]);

  // Collect all unique tags and their assigned colors from products
  const allExistingTags = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p) => {
      (p.tags || []).forEach((t) => {
        if (!map.has(t)) {
          map.set(t, p.tagColors?.[t] || '');
        } else if (!map.get(t) && p.tagColors?.[t]) {
          map.set(t, p.tagColors[t]);
        }
      });
    });
    return Array.from(map.entries()).map(([name, color]) => ({ name, color }));
  }, [products]);

  const isMaxProductsReached =
    typeof featureFlags?.maxProducts === 'number' &&
    featureFlags.maxProducts > 0 &&
    products.length >= featureFlags.maxProducts;

  const handleCreateNewProduct = () => {
    if (isMaxProductsReached) {
      alert(`Has alcanzado el límite de ${featureFlags?.maxProducts} prendas establecido para esta tienda.`);
      return;
    }
    const defaultCategory = settings.categories.find((c) => c !== 'Todas') || 'Vestidos';
    
    // Default attributes used: whichever are enabled in store
    const defaultAttrs: ('attr1' | 'attr2')[] = [];
    if (attribute1.enabled) defaultAttrs.push('attr1');
    if (attribute2.enabled) defaultAttrs.push('attr2');

    const newProd: Product = {
      id: `prod-${Date.now()}`,
      name: '',
      category: defaultCategory,
      description: '',
      tags: [],
      tagColors: {},
      price: 0,
      discountPrice: undefined,
      cost: 0,
      enabledOnline: true,
      images: [],
      coverIndex: 0,
      totalStock: 0,
      attributesUsed: defaultAttrs,
      variants: [],
      createdAt: new Date().toISOString()
    };
    setEditingProduct(newProd);
  };

  const handleAiProductCompleted = async (aiData: {
    name: string;
    description: string;
    category: string;
    images: string[];
    selectedColors: string[];
    newColorsToSave: Array<{ name: string; hex: string }>;
    tags: string[];
  }) => {
    // Only save new colors if store has an enabled color attribute
    const colorAttrId = (attribute1.enabled && attribute1.type === 'color')
      ? 'attr1'
      : (attribute2.enabled && attribute2.type === 'color')
      ? 'attr2'
      : null;

    if (colorAttrId && aiData.newColorsToSave.length > 0 && onUpdateSettings) {
      const targetAttr = colorAttrId === 'attr1' ? attribute1 : attribute2;
      const existingLabels = new Set(targetAttr.options.map((o) => o.label.trim().toLowerCase()));
      const toAdd = aiData.newColorsToSave.filter((c) => !existingLabels.has(c.name.trim().toLowerCase()));

      if (toAdd.length > 0) {
        const updatedOptions: StoreAttributeOption[] = [
          ...targetAttr.options,
          ...toAdd.map((c, i) => ({
            id: `opt-${Date.now()}-${i}`,
            label: c.name,
            hex: c.hex
          }))
        ];
        try {
          await onUpdateSettings({
            [colorAttrId]: {
              ...targetAttr,
              options: updatedOptions
            }
          });
        } catch (e) {
          console.error('Error saving new color options:', e);
        }
      }
    }

    const defaultAttrs: ('attr1' | 'attr2')[] = [];
    if (attribute1.enabled) defaultAttrs.push('attr1');
    if (attribute2.enabled) defaultAttrs.push('attr2');

    const newProd: Product = {
      id: `prod-${Date.now()}`,
      name: aiData.name,
      category: aiData.category,
      description: aiData.description,
      tags: aiData.tags || [],
      price: 0,
      cost: 0,
      enabledOnline: true,
      images: aiData.images,
      coverIndex: 0,
      totalStock: 0,
      attributesUsed: defaultAttrs,
      variants: [],
      createdAt: new Date().toISOString()
    };

    setEditingProduct(newProd);
    showNotification('success', 'Ficha generada con IA. Podés revisar los precios y confirmar las opciones.');
  };

  const handleDuplicateProduct = async (prod: Product) => {
    const newId = `prod-${Date.now()}`;
    const duplicated: Product = {
      ...prod,
      id: newId,
      name: `Copia de ${prod.name}`,
      enabledOnline: false,
      variants: prod.variants.map((v, idx) => ({
        ...v,
        id: `var-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await onSaveProduct(duplicated);
      showNotification(
        'success',
        `Producto duplicado como "${duplicated.name}". Se guardó invisible/oculto para protegerlo de la visualización de los clientes.`
      );
      setEditingProduct(duplicated);
    } catch (err) {
      showNotification('error', 'Error al duplicar el producto.');
    }
  };

  // CSV Export with dynamic attributes and unlimited stock labels
  const handleExportCsv = () => {
    const attr1Name = attribute1.name || 'Atributo 1';
    const attr2Name = attribute2.name || 'Atributo 2';
    let csv = `ID,Nombre,Categoria,Precio,Costo,StockTotal,Estado,Variantes\n`;

    products.forEach((p) => {
      const vars = p.variants
        .map((v) => {
          const val1 = attribute1.enabled ? getOptionLabel(attribute1, v.attributeOptionId1, v.color) : v.color;
          const val2 = attribute2.enabled ? getOptionLabel(attribute2, v.attributeOptionId2, v.size) : v.size;
          const combo = [val1, val2].filter(Boolean).join(' / ');
          const stockText = v.unlimited ? 'Ilimitado' : `${v.stock}u`;
          return `${v.sku}${combo ? ` (${combo}: ${stockText})` : `: ${stockText}`}`;
        })
        .join('; ');

      const totalStockText = p.isUnlimited || p.variants.some((v) => v.unlimited) ? 'Ilimitado' : p.totalStock;
      csv += `"${p.id}","${p.name}","${p.category}",${p.price},${p.cost},"${totalStockText}","${
        p.enabledOnline ? 'Activo' : 'Borrador'
      }","${vars}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `inventario-${settings.storeName || 'tienda'}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CATEGORY ACTIONS
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;

    if (settings.categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      showNotification('error', `La categoría "${trimmed}" ya existe en el catálogo.`);
      return;
    }

    try {
      const updatedCategories = [...settings.categories, trimmed];
      if (onUpdateSettings) {
        await onUpdateSettings({ categories: updatedCategories });
      }
      setNewCategoryName('');
      showNotification('success', `Categoría "${trimmed}" agregada exitosamente.`);
    } catch (err) {
      showNotification('error', 'Error al guardar la nueva categoría.');
    }
  };

  const handleSaveRenameCategory = async () => {
    if (!editingCategory || !editingCategory.current.trim()) return;
    const { original, current } = editingCategory;
    const trimmed = current.trim();

    if (trimmed.toLowerCase() === original.toLowerCase()) {
      setEditingCategory(null);
      return;
    }

    if (settings.categories.some((c) => c.toLowerCase() === trimmed.toLowerCase() && c.toLowerCase() !== original.toLowerCase())) {
      showNotification('error', `Ya existe otra categoría con el nombre "${trimmed}".`);
      return;
    }

    try {
      const updatedCategories = settings.categories.map((c) => (c === original ? trimmed : c));
      if (onUpdateSettings) {
        await onUpdateSettings({ categories: updatedCategories });
      }

      const productsToUpdate = products.filter((p) => p.category === original);
      for (const p of productsToUpdate) {
        await onSaveProduct({ ...p, category: trimmed });
      }

      setEditingCategory(null);
      showNotification(
        'success',
        `Categoría actualizada a "${trimmed}" (${productsToUpdate.length} prenda(s) actualizadas).`
      );
    } catch (err) {
      showNotification('error', 'Error al renombrar la categoría.');
    }
  };

  const executeDeleteCategory = async (categoryName: string) => {
    try {
      const updatedCategories = settings.categories.filter((c) => c !== categoryName);
      if (onUpdateSettings) {
        await onUpdateSettings({ categories: updatedCategories });
      }
      showNotification('success', `Categoría "${categoryName}" eliminada del catálogo.`);
    } catch (err) {
      showNotification('error', 'Error al eliminar la categoría.');
    }
  };

  // =========================================================================
  // ATTRIBUTE ACTIONS (attribute1 & attribute2)
  // =========================================================================

  // Helper to map 'attr1' | 'attr2' to 'attribute1' | 'attribute2' in StoreSettings
  const getSettingsAttrKey = (id: 'attr1' | 'attr2'): 'attribute1' | 'attribute2' =>
    id === 'attr1' ? 'attribute1' : 'attribute2';

  // Rename an attribute without asking confirmation
  const handleRenameAttribute = async (attrId: 'attr1' | 'attr2', newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || !onUpdateSettings) return;
    const currentAttr = attrId === 'attr1' ? attribute1 : attribute2;
    const settingsKey = getSettingsAttrKey(attrId);
    await onUpdateSettings({
      [settingsKey]: {
        ...currentAttr,
        name: trimmed
      }
    });
    showNotification('success', `Atributo renombrado a "${trimmed}".`);
  };

  // Change attribute type (text <-> color)
  const handleChangeAttributeType = async (attrId: 'attr1' | 'attr2', newType: 'text' | 'color') => {
    if (!onUpdateSettings) return;
    const currentAttr = attrId === 'attr1' ? attribute1 : attribute2;
    if (currentAttr.type === newType) return;

    // If changing text -> color, assign #FFFFFF to each existing option
    const updatedOptions = currentAttr.options.map((o) => ({
      ...o,
      hex: newType === 'color' ? (o.hex || '#FFFFFF') : undefined
    }));

    const settingsKey = getSettingsAttrKey(attrId);
    await onUpdateSettings({
      [settingsKey]: {
        ...currentAttr,
        type: newType,
        options: updatedOptions
      }
    });
    showNotification(
      'success',
      `Tipo de "${currentAttr.name}" cambiado a ${newType === 'color' ? 'Color' : 'Texto'}.`
    );
  };

  // Toggle attribute enabled/disabled at store level
  const handleToggleAttribute = (attrId: 'attr1' | 'attr2') => {
    const currentAttr = attrId === 'attr1' ? attribute1 : attribute2;
    const settingsKey = getSettingsAttrKey(attrId);

    if (!currentAttr.enabled) {
      // Enabling: doesn't modify existing products
      if (onUpdateSettings) {
        onUpdateSettings({
          [settingsKey]: { ...currentAttr, enabled: true }
        });
      }
      showNotification('success', `Atributo "${currentAttr.name}" habilitado en la tienda.`);
      return;
    }

    // Disabling: check if any products use it -> apply stock fusion!
    const affectedProducts = products.filter((p) => p.attributesUsed?.includes(attrId));

    if (affectedProducts.length === 0) {
      if (onUpdateSettings) {
        onUpdateSettings({
          [settingsKey]: { ...currentAttr, enabled: false }
        });
      }
      showNotification('success', `Atributo "${currentAttr.name}" deshabilitado.`);
      return;
    }

    // Prepare fusion preview
    const otherAttrId = attrId === 'attr1' ? 'attr2' : 'attr1';
    const otherAttr = otherAttrId === 'attr1' ? attribute1 : attribute2;

    const allSummaryLines: string[] = [];
    const fusedProductUpdates: Product[] = [];

    affectedProducts.forEach((prod) => {
      const remaining: ('attr1' | 'attr2')[] = (prod.attributesUsed || []).filter((id) => id !== attrId && (id === otherAttrId ? otherAttr.enabled : false));
      const { updatedProduct, summaryLines } = fuseProductVariants(prod, remaining, settings);
      allSummaryLines.push(...summaryLines);
      fusedProductUpdates.push(updatedProduct);
    });

    setConfirmModal({
      isOpen: true,
      title: `Deshabilitar "${currentAttr.name}" y fusionar variantes`,
      message: `Hay ${affectedProducts.length} producto(s) usando este atributo. Al deshabilitarlo a nivel tienda, se aplicará la consolidación de stock sobre las opciones restantes:`,
      affectedList: allSummaryLines,
      affectedListTitle: 'Variantes resultantes de la fusión',
      confirmLabel: 'Deshabilitar y fusionar variantes',
      confirmColor: 'black',
      onConfirm: async () => {
        for (const fp of fusedProductUpdates) {
          await onSaveProduct(fp);
        }
        if (onUpdateSettings) {
          await onUpdateSettings({
            [settingsKey]: { ...currentAttr, enabled: false }
          });
        }
        setConfirmModal(null);
        showNotification(
          'success',
          `Atributo deshabilitado y variantes fusionadas en ${fusedProductUpdates.length} producto(s).`
        );
      }
    });
  };

  // Add option to an attribute
  const handleAddOption = async (attrId: 'attr1' | 'attr2', e: React.FormEvent) => {
    e.preventDefault();
    const currentAttr = attrId === 'attr1' ? attribute1 : attribute2;
    const label = (attrId === 'attr1' ? newAttr1Label : newAttr2Label).trim();
    if (!label) return;

    if (currentAttr.options.some((o) => o.label.toLowerCase() === label.toLowerCase())) {
      showNotification('error', `La opción "${label}" ya existe en "${currentAttr.name}".`);
      return;
    }

    const hexVal = attrId === 'attr1' ? newAttr1Hex : newAttr2Hex;
    const cleanHex = hexVal.startsWith('#') ? hexVal : `#${hexVal}`;

    const newOption: StoreAttributeOption = {
      id: `opt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      label,
      hex: currentAttr.type === 'color' ? cleanHex : undefined
    };

    const updatedOptions = [...currentAttr.options, newOption];
    const settingsKey = getSettingsAttrKey(attrId);
    if (onUpdateSettings) {
      await onUpdateSettings({
        [settingsKey]: {
          ...currentAttr,
          options: updatedOptions
        }
      });
    }

    if (attrId === 'attr1') {
      setNewAttr1Label('');
      setNewAttr1Hex('#1A1A1A');
    } else {
      setNewAttr2Label('');
      setNewAttr2Hex('#1A1A1A');
    }

    showNotification('success', `Opción "${label}" agregada a "${currentAttr.name}".`);
  };

  // Edit existing option label or hex directly
  const handleSaveOptionEdit = async (attrId: 'attr1' | 'attr2', optionId: string, label: string, hex?: string) => {
    const trimmed = label.trim();
    if (!trimmed || !onUpdateSettings) return;

    const currentAttr = attrId === 'attr1' ? attribute1 : attribute2;
    const updatedOptions = currentAttr.options.map((o) =>
      o.id === optionId ? { ...o, label: trimmed, hex: currentAttr.type === 'color' ? hex || o.hex : undefined } : o
    );

    const settingsKey = getSettingsAttrKey(attrId);
    await onUpdateSettings({
      [settingsKey]: {
        ...currentAttr,
        options: updatedOptions
      }
    });

    setEditingOption(null);
    showNotification('success', `Opción actualizada.`);
  };

  // Delete an option from an attribute
  const handleDeleteOption = (attrId: 'attr1' | 'attr2', option: StoreAttributeOption) => {
    const currentAttr = attrId === 'attr1' ? attribute1 : attribute2;
    const settingsKey = getSettingsAttrKey(attrId);

    // Check which products have variants referencing this option
    const affectedLines: string[] = [];
    const productsToModify: { product: Product; newVariants: any[] }[] = [];

    products.forEach((prod) => {
      const remainingVariants = prod.variants.filter((v) => {
        const matchesOption =
          attrId === 'attr1'
            ? v.attributeOptionId1 === option.id || (!v.attributeOptionId1 && v.color.toLowerCase() === option.label.toLowerCase())
            : v.attributeOptionId2 === option.id || (!v.attributeOptionId2 && v.size.toLowerCase() === option.label.toLowerCase());

        if (matchesOption) {
          affectedLines.push(formatVariantLine(prod.name, v, attribute1, attribute2));
          return false;
        }
        return true;
      });

      if (remainingVariants.length !== prod.variants.length) {
        productsToModify.push({ product: prod, newVariants: remainingVariants });
      }
    });

    if (affectedLines.length > 0) {
      setConfirmModal({
        isOpen: true,
        title: `Eliminar opción "${option.label}"`,
        message: `Esta opción está en uso en ${affectedLines.length} variante(s). Si la eliminas, se borrarán las siguientes variantes de tus productos:`,
        affectedList: affectedLines,
        affectedListTitle: 'Variantes afectadas que serán eliminadas',
        confirmLabel: 'Eliminar opción y variantes',
        confirmColor: 'red',
        onConfirm: async () => {
          for (const item of productsToModify) {
            const totalStock = item.newVariants.reduce(
              (acc, v) => (v.enabled !== false && !v.unlimited ? acc + Number(v.stock || 0) : acc),
              0
            );
            await onSaveProduct({
              ...item.product,
              variants: item.newVariants,
              totalStock,
              isUnlimited: item.newVariants.length > 0 && item.newVariants.every((v) => v.unlimited)
            });
          }

          const updatedOptions = currentAttr.options.filter((o) => o.id !== option.id);
          if (onUpdateSettings) {
            await onUpdateSettings({
              [settingsKey]: { ...currentAttr, options: updatedOptions }
            });
          }

          setConfirmModal(null);
          showNotification('success', `Opción "${option.label}" y sus variantes asociadas han sido eliminadas.`);
        }
      });
      return;
    }

    // No products affected: delete directly
    const updatedOptions = currentAttr.options.filter((o) => o.id !== option.id);
    if (onUpdateSettings) {
      onUpdateSettings({
        [settingsKey]: { ...currentAttr, options: updatedOptions }
      });
    }
    showNotification('success', `Opción "${option.label}" eliminada.`);
  };

  // Helper to render Attribute Management Subtab
  const renderAttributeSubTab = (attrId: 'attr1' | 'attr2') => {
    const attr = attrId === 'attr1' ? attribute1 : attribute2;
    const isAttr1 = attrId === 'attr1';
    const newLabel = isAttr1 ? newAttr1Label : newAttr2Label;
    const setNewLabel = isAttr1 ? setNewAttr1Label : setNewAttr2Label;
    const newHex = isAttr1 ? newAttr1Hex : newAttr2Hex;
    const setNewHex = isAttr1 ? setNewAttr1Hex : setNewAttr2Hex;

    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-200">
        {/* Attribute Settings Card */}
        <div className="bg-white rounded-2xl p-5 border border-[#efeded] shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-neutral-900 text-white text-[10px] font-bold uppercase tracking-wider">
                {attrId === 'attr1' ? 'Atributo 1' : 'Atributo 2'}
              </span>
              <span className="text-xs text-neutral-400">• Configuración principal de tienda</span>
            </div>

            {/* Inline Rename */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <label className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider block mb-1">
                  Nombre del Atributo
                </label>
                <input
                  type="text"
                  defaultValue={attr.name}
                  onBlur={(e) => handleRenameAttribute(attrId, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
                  className="w-full px-3 py-2 bg-[#f5f3f3] border border-neutral-200 rounded-xl text-sm font-bold text-black focus:bg-white focus:outline-none focus:ring-1 focus:ring-black"
                  placeholder="Ej: Color, Talle, Tamaño, Modelo..."
                />
              </div>

              {/* Type Switcher */}
              <div className="flex flex-col">
                <label className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider block mb-1">
                  Tipo de Atributo
                </label>
                <div className="flex items-center bg-[#f5f3f3] p-1 rounded-xl border border-neutral-200">
                  <button
                    type="button"
                    onClick={() => handleChangeAttributeType(attrId, 'text')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      attr.type === 'text' ? 'bg-black text-white shadow-xs' : 'text-neutral-600 hover:text-black'
                    }`}
                  >
                    Texto
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChangeAttributeType(attrId, 'color')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      attr.type === 'color' ? 'bg-black text-white shadow-xs' : 'text-neutral-600 hover:text-black'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-indigo-500"></span>
                    <span>Color (#HEX)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Enable / Disable Attribute Switch */}
          <div className="pt-4 md:pt-0 md:pl-6 border-t md:border-t-0 md:border-l border-neutral-100 flex flex-col justify-center items-start md:items-end gap-2 shrink-0">
            <span className="text-xs font-semibold text-neutral-700">Estado en la tienda</span>
            <button
              type="button"
              onClick={() => handleToggleAttribute(attrId)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                attr.enabled
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-neutral-200 hover:bg-neutral-300 text-neutral-800'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {attr.enabled ? 'check_circle' : 'pause_circle'}
              </span>
              <span>{attr.enabled ? 'Habilitado' : 'Deshabilitado'}</span>
            </button>
            <span className="text-[11px] text-neutral-400">
              {attr.options.length} opciones configuradas
            </span>
          </div>
        </div>

        {/* Quick Add Option Form */}
        <form
          onSubmit={(e) => handleAddOption(attrId, e)}
          className="bg-white rounded-2xl p-4 shadow-xs border border-[#efeded] flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
        >
          <div className="relative flex-1">
            <span className="material-symbols-outlined text-[18px] text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2">
              {attr.type === 'color' ? 'palette' : 'label'}
            </span>
            <input
              type="text"
              placeholder={attr.type === 'color' ? `Nombre del color (ej: Verde Oliva, Arena...)` : `Etiqueta de ${attr.name} (ej: S, M, XL, 500ml...)`}
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#f5f3f3] rounded-xl text-xs text-black placeholder:text-neutral-400 focus:outline-none focus:bg-white border border-transparent focus:border-neutral-300 transition-all font-medium"
            />
          </div>

          {attr.type === 'color' && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 p-1 bg-[#f5f3f3] rounded-xl border border-neutral-200">
                <input
                  type="color"
                  value={newHex}
                  onChange={(e) => setNewHex(e.target.value)}
                  className="w-7 h-7 rounded border-0 cursor-pointer p-0 bg-transparent"
                  title="Elegir muestra visual"
                />
                <input
                  type="text"
                  value={newHex}
                  onChange={(e) => setNewHex(e.target.value)}
                  placeholder="#1A1A1A"
                  className="w-20 px-1.5 py-1 bg-transparent text-xs font-mono font-semibold text-black uppercase focus:outline-none"
                />
              </div>
              <div
                className="w-8 h-8 rounded-full border border-neutral-300 shadow-2xs shrink-0"
                style={{ backgroundColor: newHex }}
              ></div>
            </div>
          )}

          <button
            type="submit"
            disabled={!newLabel.trim()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-black disabled:opacity-40 text-white text-xs font-semibold shadow-xs hover:shadow transition-all active:scale-[0.98] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Nueva Opción</span>
          </button>
        </form>

        {/* Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {attr.options.map((option) => {
            const usageCount = optionUsage[option.id] || 0;
            const isEditing = editingOption?.attrId === attrId && editingOption?.optionId === option.id;

            return (
              <div
                key={option.id}
                className="bg-white rounded-2xl p-4 border border-[#efeded] shadow-xs flex flex-col justify-between gap-3 hover:border-neutral-300 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {attr.type === 'color' && (
                      <div
                        className="w-9 h-9 rounded-full border border-neutral-300 shadow-2xs shrink-0"
                        style={{ backgroundColor: option.hex || '#000000' }}
                      />
                    )}

                    {isEditing ? (
                      <div className="flex-1 space-y-1">
                        <input
                          type="text"
                          value={editingOption.label}
                          onChange={(e) =>
                            setEditingOption({ ...editingOption, label: e.target.value })
                          }
                          className="w-full px-2 py-1 text-xs font-bold border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black"
                        />
                        {attr.type === 'color' && (
                          <input
                            type="text"
                            value={editingOption.hex || '#000000'}
                            onChange={(e) =>
                              setEditingOption({ ...editingOption, hex: e.target.value })
                            }
                            className="w-20 px-2 py-0.5 text-[10px] font-mono border border-neutral-300 rounded focus:outline-none"
                          />
                        )}
                        <div className="flex items-center gap-1 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleSaveOptionEdit(attrId, option.id, editingOption.label, editingOption.hex)
                            }
                            className="px-2 py-0.5 bg-black text-white text-[10px] font-bold rounded"
                          >
                            OK
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingOption(null)}
                            className="px-2 py-0.5 bg-neutral-100 text-neutral-600 text-[10px] rounded"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-black truncate">{option.label}</div>
                        {attr.type === 'color' && option.hex && (
                          <span className="text-[10px] font-mono text-neutral-500 bg-[#f5f3f3] px-1.5 py-0.5 rounded">
                            {option.hex}
                          </span>
                        )}
                        <div className="text-[11px] text-neutral-400 mt-0.5">
                          {usageCount} {usageCount === 1 ? 'variante' : 'variantes'}
                        </div>
                      </div>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingOption({
                            attrId,
                            optionId: option.id,
                            label: option.label,
                            hex: option.hex
                          })
                        }
                        className="p-1 rounded-lg text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors"
                        title="Editar opción"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteOption(attrId, option)}
                        className="p-1 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Eliminar opción"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col px-4 sm:px-8 py-6 max-w-[1600px] mx-auto gap-6 animate-in fade-in duration-200">
      {/* Toast Flash Messages */}
      {flashMessage && (
        <div
          className={`fixed top-20 right-4 sm:right-8 z-50 text-white text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200 ${
            flashMessage.type === 'success' ? 'bg-neutral-900 border border-neutral-700' : 'bg-red-600'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {flashMessage.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span className="font-medium">{flashMessage.text}</span>
        </div>
      )}

      {/* Header Context & Primary Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-[#5f5e5b] text-xs font-semibold uppercase tracking-wider mb-1">
            <span>Operaciones de Tienda</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-black font-bold">Catálogo & Stock Físico</span>
          </div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="font-headline-lg text-2xl sm:text-3xl text-black font-bold tracking-tight">
              Gestión de Productos e Inventario
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#efeded] text-[#444748] text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
              Base Sincronizada
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {featureFlags?.aiAssistant !== false && (
            <button
              onClick={() => setIsAiModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs sm:text-sm font-semibold transition-all shadow-xs hover:shadow active:scale-[0.98] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              <span>Cargar Producto con IA</span>
            </button>
          )}

          <button
            onClick={handleCreateNewProduct}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-black text-white text-xs sm:text-sm font-semibold transition-all shadow-xs hover:shadow active:scale-[0.98] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Nuevo Producto</span>
          </button>
        </div>
      </div>

      {/* Subtab Navigator */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 border-b border-[#efeded] overflow-x-auto pb-px">
          {/* Subtab 1: Productos */}
          <button
            onClick={() => setSelectedSubTab('products')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-xl text-xs font-semibold transition-all border-b-2 ${
              selectedSubTab === 'products'
                ? 'bg-black text-white border-black shadow-xs'
                : 'bg-white text-neutral-600 hover:text-black hover:bg-neutral-50 border-transparent'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">inventory_2</span>
            <span>Productos</span>
            <span
              className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                selectedSubTab === 'products' ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {products.length}
            </span>
          </button>

          {/* Subtab 2: Categorías */}
          <button
            onClick={() => setSelectedSubTab('categories')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-xl text-xs font-semibold transition-all border-b-2 ${
              selectedSubTab === 'categories'
                ? 'bg-black text-white border-black shadow-xs'
                : 'bg-white text-neutral-600 hover:text-black hover:bg-neutral-50 border-transparent'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">category</span>
            <span>Categorías</span>
            <span
              className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                selectedSubTab === 'categories' ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {settings.categories.filter((c) => c !== 'Todas').length}
            </span>
          </button>

          {/* Subtab 3: Dynamic Attribute 1 */}
          <button
            onClick={() => setSelectedSubTab('attr1')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-xl text-xs font-semibold transition-all border-b-2 ${
              selectedSubTab === 'attr1'
                ? 'bg-black text-white border-black shadow-xs'
                : 'bg-white text-neutral-600 hover:text-black hover:bg-neutral-50 border-transparent'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {attribute1.type === 'color' ? 'palette' : 'label'}
            </span>
            <span>{attribute1.name}</span>
            <span
              className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                selectedSubTab === 'attr1' ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {attribute1.options.length}
            </span>
            {!attribute1.enabled && (
              <span className="ml-1 px-1 py-0.2 rounded bg-amber-100 text-amber-900 text-[9px] font-bold">
                Pausado
              </span>
            )}
          </button>

          {/* Subtab 4: Dynamic Attribute 2 */}
          <button
            onClick={() => setSelectedSubTab('attr2')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-xl text-xs font-semibold transition-all border-b-2 ${
              selectedSubTab === 'attr2'
                ? 'bg-black text-white border-black shadow-xs'
                : 'bg-white text-neutral-600 hover:text-black hover:bg-neutral-50 border-transparent'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {attribute2.type === 'color' ? 'palette' : 'straighten'}
            </span>
            <span>{attribute2.name}</span>
            <span
              className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                selectedSubTab === 'attr2' ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {attribute2.options.length}
            </span>
            {!attribute2.enabled && (
              <span className="ml-1 px-1 py-0.2 rounded bg-amber-100 text-amber-900 text-[9px] font-bold">
                Pausado
              </span>
            )}
          </button>
        </div>

        {/* ========================================================================= */}
        {/* SUBTAB 1: PRODUCTOS E INVENTARIO                                          */}
        {/* ========================================================================= */}
        {selectedSubTab === 'products' && (
          <div className="flex flex-col gap-6">
            {/* Unused Attribute Warning Banners */}
            {attribute1.enabled && !attribute1.hideUnusedWarning && !dismissedWarnings['attr1'] && productsUsingAttr1.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-200">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-amber-600 text-2xl shrink-0 mt-0.5">
                    info
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-amber-900">
                      "{attribute1.name}" está habilitado pero ningún producto lo usa.
                    </h4>
                    <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                      ¿Desea deshabilitarlo para simplificar la carga de productos?
                    </p>
                    <label className="flex items-center gap-1.5 mt-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={Boolean(neverShowWarningChecked['attr1'])}
                        onChange={(e) =>
                          setNeverShowWarningChecked((prev) => ({ ...prev, attr1: e.target.checked }))
                        }
                        className="rounded text-black focus:ring-0 cursor-pointer"
                      />
                      <span className="text-[10px] font-medium text-amber-900">
                        No volver a mostrar esta advertencia para este atributo
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (neverShowWarningChecked['attr1'] && onUpdateSettings) {
                        onUpdateSettings({
                          attribute1: { ...attribute1, hideUnusedWarning: true }
                        });
                      }
                      setDismissedWarnings((prev) => ({ ...prev, attr1: true }));
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-neutral-700 hover:bg-amber-100 transition-colors"
                  >
                    Continuar así
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (neverShowWarningChecked['attr1'] && onUpdateSettings) {
                        onUpdateSettings({
                          attribute1: { ...attribute1, hideUnusedWarning: true, enabled: false }
                        });
                      } else {
                        handleToggleAttribute('attr1');
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-900 hover:bg-black text-white text-xs font-bold transition-all shadow-xs"
                  >
                    Deshabilitar atributo
                  </button>
                </div>
              </div>
            )}

            {attribute2.enabled && !attribute2.hideUnusedWarning && !dismissedWarnings['attr2'] && productsUsingAttr2.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-200">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-amber-600 text-2xl shrink-0 mt-0.5">
                    info
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-amber-900">
                      "{attribute2.name}" está habilitado pero ningún producto lo usa.
                    </h4>
                    <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                      ¿Desea deshabilitarlo para simplificar la carga de productos?
                    </p>
                    <label className="flex items-center gap-1.5 mt-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={Boolean(neverShowWarningChecked['attr2'])}
                        onChange={(e) =>
                          setNeverShowWarningChecked((prev) => ({ ...prev, attr2: e.target.checked }))
                        }
                        className="rounded text-black focus:ring-0 cursor-pointer"
                      />
                      <span className="text-[10px] font-medium text-amber-900">
                        No volver a mostrar esta advertencia para este atributo
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (neverShowWarningChecked['attr2'] && onUpdateSettings) {
                        onUpdateSettings({
                          attribute2: { ...attribute2, hideUnusedWarning: true }
                        });
                      }
                      setDismissedWarnings((prev) => ({ ...prev, attr2: true }));
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-neutral-700 hover:bg-amber-100 transition-colors"
                  >
                    Continuar así
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (neverShowWarningChecked['attr2'] && onUpdateSettings) {
                        onUpdateSettings({
                          attribute2: { ...attribute2, hideUnusedWarning: true, enabled: false }
                        });
                      } else {
                        handleToggleAttribute('attr2');
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-900 hover:bg-black text-white text-xs font-bold transition-all shadow-xs"
                  >
                    Deshabilitar atributo
                  </button>
                </div>
              </div>
            )}

            {/* Action & Search Toolbar */}
            <div className="bg-white rounded-2xl p-4 shadow-xs border border-[#efeded] flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
              <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Live Search Input */}
                <div className="relative flex-1 min-w-[240px]">
                  <span className="material-symbols-outlined text-[18px] text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Buscar por nombre, SKU o categoría..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-[#f5f3f3] rounded-xl text-xs text-black placeholder:text-neutral-400 focus:outline-none focus:bg-white border border-transparent focus:border-neutral-300 transition-all font-medium"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  )}
                </div>

                {/* Category Filter */}
                <div className="relative">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full sm:w-auto appearance-none pl-3 pr-8 py-2 bg-[#f5f3f3] rounded-xl text-xs text-black focus:outline-none cursor-pointer border border-transparent focus:border-neutral-300 font-medium"
                  >
                    <option value="Todas">Todas las Categorías</option>
                    {settings.categories
                      .filter((c) => c !== 'Todas')
                      .map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                  </select>
                  <span className="material-symbols-outlined text-[18px] text-neutral-400 pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                    expand_more
                  </span>
                </div>

                {/* Status Filter */}
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full sm:w-auto appearance-none pl-3 pr-8 py-2 bg-[#f5f3f3] rounded-xl text-xs text-black focus:outline-none cursor-pointer border border-transparent focus:border-neutral-300 font-medium"
                  >
                    <option value="all">Todos los Estados</option>
                    <option value="active">Solo Activos (con stock)</option>
                    <option value="draft">Deshabilitados / Borradores</option>
                    <option value="out_of_stock">Agotados</option>
                  </select>
                  <span className="material-symbols-outlined text-[18px] text-neutral-400 pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                    expand_more
                  </span>
                </div>
              </div>

              {/* Primary Trigger Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {featureFlags?.exportProducts !== false && (
                  <button
                    onClick={handleExportCsv}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#efeded] hover:bg-[#e4e2e2] text-black text-xs font-medium transition-colors"
                    title="Exportar inventario y existencias a CSV"
                  >
                    <span className="material-symbols-outlined text-[16px]">file_download</span>
                    <span>Exportar Planilla</span>
                  </button>
                )}
              </div>
            </div>

            {/* Products Table Card */}
            <div className="bg-white rounded-2xl shadow-xs border border-[#efeded] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#f5f3f3] border-b border-[#efeded] text-[#444748] font-bold uppercase tracking-wider text-[11px] h-11">
                      <th className="py-3 px-4">Prenda / Modelo</th>
                      <th className="py-3 px-4">Categoría</th>
                      <th className="py-3 px-4">Precio Venta</th>
                      <th className="py-3 px-4">Costo Producción</th>
                      <th className="py-3 px-4">Variantes & Stock</th>
                      <th className="py-3 px-4">Disponibilidad Online</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#efeded]">
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-neutral-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-[36px] text-neutral-300">
                              inventory_2
                            </span>
                            <span className="text-sm font-medium">No se encontraron productos con los filtros aplicados.</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((prod) => {
                        const coverImg = prod.images[prod.coverIndex || 0] || prod.images[0] || '';
                        const hasNoVariants = prod.variants.length === 0;
                        const isAllUnlimited = prod.isUnlimited || (prod.variants.length > 0 && prod.variants.every((v) => v.unlimited));
                        const hasSomeUnlimited = prod.variants.some((v) => v.unlimited);

                        return (
                          <tr key={prod.id} className="hover:bg-[#faf9f8] transition-colors">
                            {/* Product Info */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-14 rounded-lg bg-[#efeded] overflow-hidden shrink-0 border border-neutral-200">
                                  {coverImg ? (
                                    <img
                                      src={coverImg}
                                      alt={prod.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-neutral-400">
                                      <span className="material-symbols-outlined text-[18px]">image</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-bold text-black text-sm truncate max-w-[220px]">
                                    {prod.name}
                                  </span>
                                  <span className="text-[11px] text-neutral-500 mt-0.5 truncate max-w-[220px]">
                                    {prod.description || 'Sin descripción'}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Category */}
                            <td className="py-3.5 px-4 font-semibold text-neutral-700">
                              <span className="px-2.5 py-1 rounded-lg bg-[#f5f3f3] text-[11px] font-medium text-black">
                                {prod.category}
                              </span>
                            </td>

                            {/* Price */}
                            <td className="py-3.5 px-4 font-bold text-black">
                              ${prod.price.toLocaleString('es-AR')}
                            </td>

                            {/* Cost */}
                            <td className="py-3.5 px-4 text-neutral-500 font-medium">
                              ${prod.cost.toLocaleString('es-AR')}
                            </td>

                            {/* Variants & Stock */}
                            <td className="py-3.5 px-4">
                              {hasNoVariants ? (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-[11px] font-bold">
                                  <span className="material-symbols-outlined text-[15px] text-amber-600">warning</span>
                                  <span>Sin variantes: no se ve en la tienda</span>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`w-2 h-2 rounded-full ${
                                        isAllUnlimited || prod.totalStock > 0 ? 'bg-emerald-500' : 'bg-red-500'
                                      }`}
                                    ></span>
                                    <span className="font-bold text-black">
                                      {isAllUnlimited
                                        ? '∞ Ilimitado'
                                        : hasSomeUnlimited
                                        ? `${prod.totalStock} u. + variantes ilimitadas`
                                        : `${prod.totalStock} unidades`}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-neutral-400">
                                    {prod.variants.length} variantes cargadas
                                  </span>
                                </div>
                              )}
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-4">
                              {hasNoVariants ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-neutral-100 text-neutral-500 border border-neutral-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-400"></span>
                                  Oculto (requiere variantes)
                                </span>
                              ) : (
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                                    prod.enabledOnline
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      prod.enabledOnline ? 'bg-emerald-600' : 'bg-neutral-400'
                                    }`}
                                  ></span>
                                  {prod.enabledOnline ? 'Visible en Tienda' : 'Oculto / Borrador'}
                                </span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleDuplicateProduct(prod)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#efeded] hover:bg-neutral-200 text-black text-xs font-medium transition-colors cursor-pointer"
                                  title="Duplicar producto"
                                >
                                  <span className="material-symbols-outlined text-[15px]">content_copy</span>
                                  <span>Duplicar</span>
                                </button>

                                <button
                                  onClick={() => setEditingProduct(prod)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#efeded] hover:bg-neutral-200 text-black text-xs font-medium transition-colors"
                                  title="Editar producto y variantes"
                                >
                                  <span className="material-symbols-outlined text-[15px]">edit</span>
                                  <span>Editar</span>
                                </button>

                                <button
                                  onClick={async () => {
                                    await onSaveProduct({
                                      ...prod,
                                      enabledOnline: !prod.enabledOnline
                                    });
                                  }}
                                  className={`p-1.5 rounded-lg border transition-colors ${
                                    prod.enabledOnline
                                      ? 'text-neutral-600 hover:bg-neutral-100 border-neutral-200'
                                      : 'text-neutral-400 bg-neutral-100 border-neutral-300'
                                  }`}
                                  title={prod.enabledOnline ? 'Ocultar en tienda' : 'Habilitar en tienda'}
                                >
                                  <span className="material-symbols-outlined text-[16px]">
                                    {prod.enabledOnline ? 'visibility' : 'visibility_off'}
                                  </span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setProductToDelete(prod)}
                                  className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors"
                                  title="Eliminar producto"
                                >
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SUBTAB 2: GESTIÓN DE CATEGORÍAS                                            */}
        {/* ========================================================================= */}
        {selectedSubTab === 'categories' && (
          <div className="flex flex-col gap-6">
            <div className="bg-white rounded-2xl p-5 border border-[#efeded] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[22px]">category</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-black">
                    ¿Para qué sirven las Categorías?
                  </h3>
                  <p className="text-xs text-[#5f5e5b] mt-1 max-w-3xl leading-relaxed">
                    Las <strong className="text-black">categorías</strong> organizan tu catálogo comercial y colecciones. Permiten a los clientes filtrar prendas en la tienda online y aparecen en el desplegable al crear o editar cualquier prenda.
                  </p>
                </div>
              </div>

              <div className="px-3.5 py-1.5 rounded-xl bg-[#f5f3f3] border border-neutral-200 text-xs font-semibold text-neutral-700 whitespace-nowrap">
                {settings.categories.filter((c) => c !== 'Todas').length} categorías configuradas
              </div>
            </div>

            {/* Quick Add Category Bar */}
            <form
              onSubmit={handleAddCategory}
              className="bg-white rounded-2xl p-4 shadow-xs border border-[#efeded] flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
            >
              <div className="relative flex-1">
                <span className="material-symbols-outlined text-[18px] text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2">
                  add_circle
                </span>
                <input
                  type="text"
                  placeholder="Nombre de la nueva categoría (ej. Faldas, Calzado, Carteras...)"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#f5f3f3] rounded-xl text-xs text-black placeholder:text-neutral-400 focus:outline-none focus:bg-white border border-transparent focus:border-neutral-300 transition-all font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={!newCategoryName.trim()}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-black disabled:opacity-40 text-white text-xs font-semibold shadow-xs hover:shadow transition-all active:scale-[0.98] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span>Nueva Categoría</span>
              </button>
            </form>

            {/* Categories Management Table */}
            <div className="bg-white rounded-2xl shadow-xs border border-[#efeded] overflow-hidden">
              <div className="p-3.5 bg-[#f5f3f3] border-b border-[#efeded] flex items-center justify-between">
                <span className="text-xs font-bold text-black">
                  Colecciones y Categorías Activas en la Tienda
                </span>
                <span className="text-[11px] text-neutral-500">
                  Los cambios se sincronizan en tiempo real
                </span>
              </div>

              <div className="divide-y divide-[#efeded]">
                {settings.categories.map((cat) => {
                  const isGlobalFilter = cat === 'Todas';
                  const isEditingThis = editingCategory?.original === cat;
                  const count = categoryUsage[cat] || 0;

                  return (
                    <div
                      key={cat}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#faf9f8] transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-[#efeded] text-neutral-700 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[18px]">
                            {isGlobalFilter ? 'select_all' : 'folder'}
                          </span>
                        </div>

                        {isEditingThis ? (
                          <div className="flex items-center gap-2 flex-1 max-w-md">
                            <input
                              type="text"
                              value={editingCategory.current}
                              onChange={(e) =>
                                setEditingCategory({ ...editingCategory, current: e.target.value })
                              }
                              className="flex-1 px-3 py-1.5 rounded-xl border border-neutral-300 text-xs font-semibold text-black focus:outline-none focus:ring-1 focus:ring-black"
                            />
                            <button
                              type="button"
                              onClick={handleSaveRenameCategory}
                              className="px-3 py-1.5 rounded-xl bg-black text-white text-xs font-semibold"
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCategory(null)}
                              className="px-2.5 py-1.5 rounded-xl bg-neutral-200 text-neutral-700 text-xs"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div>
                            <span className="text-xs font-bold text-black">{cat}</span>
                            <span className="text-[11px] text-neutral-400 ml-2">
                              {count} {count === 1 ? 'prenda' : 'prendas'}
                            </span>
                          </div>
                        )}
                      </div>

                      {!isGlobalFilter && !isEditingThis && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingCategory({ original: cat, current: cat })}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors"
                            title="Renombrar categoría"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCategoryToDelete(cat)}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Eliminar categoría"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SUBTAB 3: ATRIBUTO 1                                                      */}
        {/* ========================================================================= */}
        {selectedSubTab === 'attr1' && renderAttributeSubTab('attr1')}

        {/* ========================================================================= */}
        {/* SUBTAB 4: ATRIBUTO 2                                                      */}
        {/* ========================================================================= */}
        {selectedSubTab === 'attr2' && renderAttributeSubTab('attr2')}
      </div>

      {/* Product Edit Modal */}
      {editingProduct && (
        <ProductEditModal
          product={editingProduct}
          isOpen={Boolean(editingProduct)}
          onClose={() => setEditingProduct(null)}
          onSave={async (saved) => {
            await onSaveProduct(saved);
            setEditingProduct(null);
            showNotification('success', `Producto "${saved.name}" guardado exitosamente.`);
          }}
          settings={settings}
          allowDevicePhotos={featureFlags?.uploadDevicePhotos !== false}
          existingTags={allExistingTags}
        />
      )}

      {/* Attribute Generic Confirmation Modal */}
      {confirmModal && (
        <AttributeConfirmationModal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal(null)}
          title={confirmModal.title}
          message={confirmModal.message}
          affectedList={confirmModal.affectedList}
          affectedListTitle={confirmModal.affectedListTitle}
          confirmLabel={confirmModal.confirmLabel}
          confirmColor={confirmModal.confirmColor}
          onConfirm={confirmModal.onConfirm}
        />
      )}

      {/* Confirmation Modal: Eliminar Categoría */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-neutral-200 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-2xl">category</span>
            </div>
            <h3 className="text-base font-bold text-neutral-900 mb-1">
              ¿Eliminar categoría "{categoryToDelete}"?
            </h3>
            <p className="text-xs text-neutral-500 mb-5 leading-relaxed">
              {(categoryUsage[categoryToDelete] || 0) > 0 ? (
                <>
                  Hay <strong className="text-neutral-800 font-semibold">{categoryUsage[categoryToDelete]} prenda(s)</strong> asociadas a esta categoría. Al eliminarla, las prendas conservarán su información pero la categoría ya no figurará en los filtros de la tienda.
                </>
              ) : (
                'Esta categoría ya no estará disponible para catalogar prendas.'
              )}
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const cat = categoryToDelete;
                  setCategoryToDelete(null);
                  await executeDeleteCategory(cat);
                }}
                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                Eliminar Categoría
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Eliminar Producto */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-neutral-200 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-2xl">delete</span>
            </div>
            <h3 className="text-base font-bold text-neutral-900 mb-1">
              ¿Eliminar prenda "{productToDelete.name}"?
            </h3>
            <p className="text-xs text-neutral-500 mb-5 leading-relaxed">
              Esta acción dará de baja la prenda y todas sus variantes de stock de forma permanente del catálogo.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const prod = productToDelete;
                  setProductToDelete(null);
                  await onDeleteProduct(prod.id);
                  showNotification('success', `Prenda "${prod.name}" eliminada.`);
                }}
                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                Eliminar Prenda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nuevo Producto con IA */}
      <AiProductModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        settings={settings}
        allowDevicePhotos={featureFlags?.uploadDevicePhotos !== false}
        onContinueToForm={handleAiProductCompleted}
      />
    </div>
  );
};
