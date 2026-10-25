import React, { useState, useMemo } from 'react';
import { Product, StoreSettings, MasterSize, MasterColor, StoreFeatureFlags } from '../types';
import { ProductEditModal } from './ProductEditModal';
import { AiProductModal } from './AiProductModal';
import { useModalHistory } from '../hooks/useModalHistory';

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
  const [selectedSubTab, setSelectedSubTab] = useState<'products' | 'categories' | 'sizes' | 'colors'>('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // In-app deletion confirmation dialog states (avoids window.confirm blocking in iframe)
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [sizeToDelete, setSizeToDelete] = useState<string | null>(null);
  const [colorToDelete, setColorToDelete] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Management states for categories
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<{ original: string; current: string } | null>(null);

  // Management states for sizes
  const [newSizeName, setNewSizeName] = useState('');
  const [newSizeEnabled, setNewSizeEnabled] = useState(true);

  // Management states for colors
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#1A1A1A');

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
    isOpen: Boolean(sizeToDelete),
    onClose: () => setSizeToDelete(null),
    modalKey: 'confirm-delete-size'
  });

  useModalHistory({
    isOpen: Boolean(colorToDelete),
    onClose: () => setColorToDelete(null),
    modalKey: 'confirm-delete-color'
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

      let matchesStatus = true;
      if (statusFilter === 'active') matchesStatus = prod.enabledOnline && prod.totalStock > 0;
      if (statusFilter === 'draft') matchesStatus = !prod.enabledOnline;
      if (statusFilter === 'out_of_stock') matchesStatus = prod.totalStock <= 0;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, searchQuery, categoryFilter, statusFilter]);

  // Out of stock alert count
  const outOfStockCount = products.filter((p) => p.totalStock <= 0).length;
  const totalSkuCount = products.reduce((acc, p) => acc + p.variants.length, 0);

  // Usage counts
  const categoryUsage = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((p) => {
      map[p.category] = (map[p.category] || 0) + 1;
    });
    return map;
  }, [products]);

  const sizeUsage = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((p) => {
      p.variants.forEach((v) => {
        const key = v.size.toUpperCase();
        map[key] = (map[key] || 0) + 1;
      });
    });
    return map;
  }, [products]);

  const colorUsage = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((p) => {
      p.variants.forEach((v) => {
        const key = v.color.toLowerCase();
        map[key] = (map[key] || 0) + 1;
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
      alert(`Has alcanzado el límite de ${featureFlags?.maxProducts} prendas establecido para esta tienda. Para agregar más prendas, elimina productos existentes o solicita una ampliación al administrador.`);
      return;
    }
    const defaultCategory = settings.categories.find((c) => c !== 'Todas') || 'Vestidos';
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
    // 1. Guardar nuevos colores en la paleta oficial de la tienda si fueron aprobados
    if (aiData.newColorsToSave.length > 0 && onUpdateSettings) {
      const existingNames = new Set(settings.masterColors.map((c) => c.name.trim().toLowerCase()));
      const toAdd = aiData.newColorsToSave.filter((c) => !existingNames.has(c.name.trim().toLowerCase()));
      if (toAdd.length > 0) {
        const updatedMasterColors = [
          ...settings.masterColors,
          ...toAdd.map((c) => ({
            name: c.name,
            hex: c.hex,
            active: true
          }))
        ];
        try {
          await onUpdateSettings({ masterColors: updatedMasterColors });
        } catch (e) {
          console.error('Error saving new colors to settings:', e);
        }
      }
    }

    // 2. Generar variantes iniciales con los colores identificados y los talles habilitados
    const activeSizes = settings.masterSizes.filter((s) => s.enabled).map((s) => s.name);
    const sizeList = activeSizes.length > 0 ? activeSizes : ['S', 'M', 'L'];
    const prefix = (aiData.name || 'PR').trim().slice(0, 3).toUpperCase();

    const variants = aiData.selectedColors.flatMap((colName) => {
      const matched =
        settings.masterColors.find((c) => c.name.toLowerCase() === colName.toLowerCase()) ||
        aiData.newColorsToSave.find((c) => c.name.toLowerCase() === colName.toLowerCase());
      const hex = matched?.hex || '#1A1A1A';

      return sizeList.map((sz) => ({
        id: `var-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        color: colName,
        colorHex: hex,
        size: sz,
        sku: `${prefix}-${colName.slice(0, 3).toUpperCase()}-${sz}`,
        stock: 0,
        enabled: true
      }));
    });

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
      variants,
      createdAt: new Date().toISOString()
    };

    // 3. Abrir el formulario existente de edición con todos los datos precargados
    setEditingProduct(newProd);
    showNotification('success', 'Ficha generada con IA. Podés revisar los precios y confirmar el stock.');
  };

  const handleDuplicateProduct = async (prod: Product) => {
    const newId = `prod-${Date.now()}`;
    const duplicated: Product = {
      ...prod,
      id: newId,
      name: `Copia de ${prod.name}`,
      enabledOnline: false, // Importante: se crea invisible para protegerlo de la visualización de los clientes
      variants: prod.variants.map((v, idx) => ({
        ...v,
        id: `var-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      // Guardar inmediatamente para que el producto ya exista incluso si se cancela la edición
      await onSaveProduct(duplicated);
      showNotification(
        'success',
        `Producto duplicado como "${duplicated.name}". Se guardó invisible/oculto para protegerlo de la visualización de los clientes.`
      );
      // Abre automáticamente el edit del nuevo producto
      setEditingProduct(duplicated);
    } catch (err) {
      showNotification('error', 'Error al duplicar el producto.');
    }
  };

  const handleExportCsv = () => {
    let csv = 'ID,Nombre,Categoria,Precio,Costo,StockTotal,Estado,Variantes\n';
    products.forEach((p) => {
      const vars = p.variants.map((v) => `${v.sku} (${v.color}/${v.size}: ${v.stock}u)`).join('; ');
      csv += `"${p.id}","${p.name}","${p.category}",${p.price},${p.cost},${p.totalStock},"${p.enabledOnline ? 'Activo' : 'Borrador'}","${vars}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `inventario-atelier-${new Date().toISOString().slice(0, 10)}.csv`);
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

      // Propagate category rename to existing products
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

  const handleDeleteCategory = (categoryName: string) => {
    if (categoryName === 'Todas') {
      showNotification('error', 'La categoría "Todas" es un filtro global del sistema y no puede eliminarse.');
      return;
    }
    setCategoryToDelete(categoryName);
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

  // SIZE ACTIONS
  const handleAddSize = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSizeName.trim().toUpperCase();
    if (!trimmed) return;

    if (settings.masterSizes.some((s) => s.name.toUpperCase() === trimmed)) {
      showNotification('error', `El talle "${trimmed}" ya existe en los talles maestros.`);
      return;
    }

    try {
      const updatedSizes: MasterSize[] = [...settings.masterSizes, { name: trimmed, enabled: newSizeEnabled }];
      if (onUpdateSettings) {
        await onUpdateSettings({ masterSizes: updatedSizes });
      }
      setNewSizeName('');
      showNotification('success', `Talle maestro "${trimmed}" agregado exitosamente.`);
    } catch (err) {
      showNotification('error', 'Error al guardar el nuevo talle maestro.');
    }
  };

  const handleToggleSize = async (sizeName: string) => {
    try {
      const updatedSizes = settings.masterSizes.map((s) =>
        s.name.toUpperCase() === sizeName.toUpperCase() ? { ...s, enabled: !s.enabled } : s
      );
      if (onUpdateSettings) {
        await onUpdateSettings({ masterSizes: updatedSizes });
      }
    } catch (err) {
      showNotification('error', 'Error al actualizar el estado del talle.');
    }
  };

  const handleDeleteSize = (sizeName: string) => {
    setSizeToDelete(sizeName);
  };

  const executeDeleteSize = async (sizeName: string) => {
    try {
      const updatedSizes = settings.masterSizes.filter((s) => s.name.toUpperCase() !== sizeName.toUpperCase());
      if (onUpdateSettings) {
        await onUpdateSettings({ masterSizes: updatedSizes });
      }
      showNotification('success', `Talle maestro "${sizeName}" eliminado.`);
    } catch (err) {
      showNotification('error', 'Error al eliminar el talle maestro.');
    }
  };

  // COLOR ACTIONS
  const handleAddColor = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newColorName.trim();
    if (!trimmed) return;

    let hex = newColorHex.trim();
    if (!hex.startsWith('#')) hex = '#' + hex;

    if (settings.masterColors.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      showNotification('error', `El color "${trimmed}" ya existe en los colores maestros.`);
      return;
    }

    try {
      const updatedColors: MasterColor[] = [...settings.masterColors, { name: trimmed, hex }];
      if (onUpdateSettings) {
        await onUpdateSettings({ masterColors: updatedColors });
      }
      setNewColorName('');
      setNewColorHex('#1A1A1A');
      showNotification('success', `Color maestro "${trimmed}" (${hex}) guardado con éxito.`);
    } catch (err) {
      showNotification('error', 'Error al guardar el nuevo color maestro.');
    }
  };

  const handleDeleteColor = (colorName: string) => {
    setColorToDelete(colorName);
  };

  const executeDeleteColor = async (colorName: string) => {
    try {
      const updatedColors = settings.masterColors.filter(
        (c) => c.name.toLowerCase() !== colorName.toLowerCase()
      );
      if (onUpdateSettings) {
        await onUpdateSettings({ masterColors: updatedColors });
      }
      showNotification('success', `Color maestro "${colorName}" eliminado.`);
    } catch (err) {
      showNotification('error', 'Error al eliminar el color maestro.');
    }
  };

  return (
    <div className="w-full flex flex-col">
      {/* Sub-header Breadcrumb & Operational Context Bar */}
      <section className="w-full bg-[#f5f3f3] border-b border-[#efeded] px-4 sm:px-8 py-3.5">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs text-[#5f5e5b] flex-wrap">
            <span>Catálogo Maestro</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span>{settings.storeName || 'Atelier Studio'}</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-black font-semibold">
              {selectedSubTab === 'products' && 'Productos e Inventario'}
              {selectedSubTab === 'categories' && 'Categorías de Colección'}
              {selectedSubTab === 'sizes' && 'Talles Maestros'}
              {selectedSubTab === 'colors' && 'Colores Maestros'}
            </span>
          </div>

          <div className="flex items-center gap-2.5 text-xs text-[#5f5e5b] flex-wrap">
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg shadow-2xs border border-neutral-200">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span> Base Sincronizada
            </span>
            <span className="hidden sm:inline">SKU Activos: {totalSkuCount}</span>
            <span className="hidden sm:inline">•</span>
            <span className="text-red-700 font-semibold flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">warning</span>
              Alerta: {outOfStockCount} {outOfStockCount === 1 ? 'ítem' : 'ítems'} con quiebre
            </span>
          </div>
        </div>
      </section>

      {/* Main Management Control Layer */}
      <section className="w-full px-4 sm:px-8 pt-6 pb-16 max-w-[1600px] mx-auto flex flex-col gap-6">
        {/* Flash Message Banner */}
        {flashMessage && (
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
              flashMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="material-symbols-outlined text-[18px]">
                {flashMessage.type === 'success' ? 'check_circle' : 'error'}
              </span>
              <span>{flashMessage.text}</span>
            </div>
            <button
              onClick={() => setFlashMessage(null)}
              className="text-neutral-400 hover:text-black p-1"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        {/* Navigation Tabs (Intermedio) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar border-b border-neutral-200">
          <button
            onClick={() => setSelectedSubTab('products')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-lg text-xs font-semibold transition-all border-b-2 ${
              selectedSubTab === 'products'
                ? 'bg-black text-white border-black shadow-xs'
                : 'bg-white text-neutral-600 hover:text-black hover:bg-neutral-50 border-transparent'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">inventory_2</span>
            <span>Productos e Inventario</span>
            <span
              className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                selectedSubTab === 'products' ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {products.length}
            </span>
          </button>

          <button
            onClick={() => setSelectedSubTab('categories')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-lg text-xs font-semibold transition-all border-b-2 ${
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

          <button
            onClick={() => setSelectedSubTab('sizes')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-lg text-xs font-semibold transition-all border-b-2 ${
              selectedSubTab === 'sizes'
                ? 'bg-black text-white border-black shadow-xs'
                : 'bg-white text-neutral-600 hover:text-black hover:bg-neutral-50 border-transparent'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">straighten</span>
            <span>Talles Maestros</span>
            <span
              className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                selectedSubTab === 'sizes' ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {settings.masterSizes.length}
            </span>
          </button>

          <button
            onClick={() => setSelectedSubTab('colors')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-lg text-xs font-semibold transition-all border-b-2 ${
              selectedSubTab === 'colors'
                ? 'bg-black text-white border-black shadow-xs'
                : 'bg-white text-neutral-600 hover:text-black hover:bg-neutral-50 border-transparent'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">palette</span>
            <span>Colores Maestros</span>
            <span
              className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                selectedSubTab === 'colors' ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {settings.masterColors.length}
            </span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* SUBTAB 1: PRODUCTOS E INVENTARIO                                          */}
        {/* ========================================================================= */}
        {selectedSubTab === 'products' && (
          <div className="flex flex-col gap-6">
            {/* Action & Search Toolbar */}
            <div className="bg-white rounded-xl p-4 shadow-xs border border-[#efeded] flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
              <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Live Search Input */}
                <div className="relative flex-1 min-w-[240px]">
                  <span className="material-symbols-outlined text-[18px] text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Buscar por título, código o SKU..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-[#f5f3f3] rounded-lg text-xs text-black placeholder:text-neutral-400 focus:outline-none focus:bg-white border border-transparent focus:border-neutral-300 transition-all"
                  />
                </div>

                {/* Category Selector Filter */}
                <div className="relative">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full sm:w-auto appearance-none pl-3 pr-8 py-2 bg-[#f5f3f3] rounded-lg text-xs text-black focus:outline-none cursor-pointer border border-transparent focus:border-neutral-300"
                  >
                    <option value="Todas">Todas las Colecciones</option>
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
                    className="w-full sm:w-auto appearance-none pl-3 pr-8 py-2 bg-[#f5f3f3] rounded-lg text-xs text-black focus:outline-none cursor-pointer border border-transparent focus:border-neutral-300"
                  >
                    <option value="all">Todos los Estados</option>
                    <option value="active">Solo Activos</option>
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
                {/* Max Products Capacity Badge */}
                {typeof featureFlags?.maxProducts === 'number' && featureFlags.maxProducts > 0 && (
                  <div
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold ${
                      isMaxProductsReached
                        ? 'bg-red-50 border-red-200 text-red-700'
                        : 'bg-neutral-100 border-neutral-200 text-neutral-700'
                    }`}
                    title={isMaxProductsReached ? 'Cupo máximo alcanzado' : 'Capacidad de prendas asignada'}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {isMaxProductsReached ? 'warning' : 'inventory_2'}
                    </span>
                    <span>
                      {products.length} / {featureFlags.maxProducts} prendas
                    </span>
                    {isMaxProductsReached && (
                      <span className="text-[10px] font-bold uppercase bg-red-200 text-red-800 px-1.5 py-0.2 rounded-md">
                        Lleno
                      </span>
                    )}
                  </div>
                )}

                {featureFlags?.exportProducts !== false && (
                  <button
                    onClick={handleExportCsv}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#efeded] hover:bg-[#e4e2e2] text-black text-xs font-medium transition-colors"
                    title="Descargar CSV con variantes y stock"
                  >
                    <span className="material-symbols-outlined text-[18px]">file_download</span>
                    <span>Exportar Planilla</span>
                  </button>
                )}

                {featureFlags?.aiAssistant !== false && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isMaxProductsReached) {
                        alert(`Has alcanzado el límite de ${featureFlags?.maxProducts} prendas permitido.`);
                        return;
                      }
                      setIsAiModalOpen(true);
                    }}
                    className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-white text-xs font-semibold shadow-xs hover:shadow transition-all active:scale-[0.98] cursor-pointer ${
                      isMaxProductsReached
                        ? 'bg-neutral-400 opacity-60 cursor-not-allowed'
                        : 'bg-gradient-to-r from-amber-600 via-amber-700 to-neutral-900 hover:from-amber-500 hover:to-black'
                    }`}
                    title="Crear ficha de producto automáticamente a partir de fotos con IA (Gemini 2.5 Flash)"
                  >
                    <span className="material-symbols-outlined text-[18px] text-amber-300">
                      auto_awesome
                    </span>
                    <span>Nuevo producto con IA</span>
                  </button>
                )}

                <button
                  onClick={handleCreateNewProduct}
                  className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs font-semibold shadow-xs hover:shadow transition-all active:scale-[0.98] cursor-pointer ${
                    isMaxProductsReached
                      ? 'bg-neutral-500 hover:bg-neutral-600'
                      : 'bg-neutral-900 hover:bg-black'
                  }`}
                  title={isMaxProductsReached ? 'Cupo máximo alcanzado' : 'Crear nuevo producto'}
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  <span>Nuevo Producto</span>
                </button>
              </div>
            </div>

            {/* General Inventory Table */}
            <div className="bg-white rounded-xl shadow-xs border border-[#efeded] overflow-hidden">
              <div className="p-3.5 flex items-center justify-between bg-[#f5f3f3] border-b border-[#efeded]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-black">
                    Índice Operativo de Inventario
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-[#efeded] text-[11px] font-medium text-neutral-600">
                    {filteredProducts.length} de {products.length} resultados
                  </span>
                </div>

                <div className="flex items-center gap-1 text-xs text-neutral-500">
                  <span>Orden: Más recientes</span>
                  <span className="material-symbols-outlined text-[16px]">swap_vert</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#efeded] text-[11px] font-semibold text-neutral-500 uppercase tracking-wider bg-white">
                      <th className="py-3 px-4">Prenda / Ficha</th>
                      <th className="py-3 px-4">Colección / Categoría</th>
                      <th className="py-3 px-4">Precio Venta</th>
                      <th className="py-3 px-4">Costo Prod.</th>
                      <th className="py-3 px-4">Variantes & Stock</th>
                      <th className="py-3 px-4">Disponibilidad Online</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#efeded] text-xs">
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-neutral-500">
                          <span className="material-symbols-outlined text-4xl text-neutral-300 block mb-2">
                            inventory_2
                          </span>
                          No se encontraron productos con los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((prod) => {
                        const coverImg =
                          prod.images && prod.images.length > 0
                            ? prod.images[prod.coverIndex || 0] || prod.images[0]
                            : null;

                        return (
                          <tr key={prod.id} className="hover:bg-[#faf9f8] transition-colors group">
                            {/* Product Info */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-14 rounded-lg bg-[#f5f3f3] border border-neutral-200 overflow-hidden flex items-center justify-center shrink-0">
                                  {coverImg ? (
                                    <img
                                      src={coverImg}
                                      alt={prod.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span className="material-symbols-outlined text-neutral-400 text-lg">
                                      styler
                                    </span>
                                  )}
                                </div>
                                <div>
                                  <div className="font-semibold text-black group-hover:underline cursor-pointer"
                                       onClick={() => setEditingProduct(prod)}>
                                    {prod.name || 'Sin nombre'}
                                  </div>
                                  <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                                    ID: {prod.id}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Category */}
                            <td className="py-3.5 px-4">
                              <span className="px-2.5 py-1 rounded-md bg-[#f5f3f3] text-neutral-700 text-xs font-medium">
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
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`w-2 h-2 rounded-full ${
                                      prod.totalStock > 0 ? 'bg-emerald-500' : 'bg-red-500'
                                    }`}
                                  ></span>
                                  <span className="font-bold text-black">{prod.totalStock} unidades</span>
                                </div>
                                <span className="text-[10px] text-neutral-400">
                                  {prod.variants.length} variantes cargadas
                                </span>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-4">
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
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleDuplicateProduct(prod)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#efeded] hover:bg-neutral-200 text-black text-xs font-medium transition-colors cursor-pointer"
                                  title="Duplicar producto (guarda una copia oculta y abre su edición)"
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
            {/* Pedagogical / Functional explanation banner */}
            <div className="bg-white rounded-xl p-5 border border-[#efeded] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-lg bg-black text-white flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[22px]">category</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-black">
                    ¿Para qué sirven las Categorías?
                  </h3>
                  <p className="text-xs text-[#5f5e5b] mt-1 max-w-3xl leading-relaxed">
                    Las <strong className="text-black">categorías</strong> organizan tu catálogo comercial y colecciones. Permiten a los clientes filtrar prendas en la tienda online (ej: <em>Vestidos de Fiesta, Sastrería, Tops, Accesorios</em>) y aparecen en el desplegable al crear o editar cualquier prenda.
                  </p>
                </div>
              </div>

              <div className="px-3.5 py-1.5 rounded-lg bg-[#f5f3f3] border border-neutral-200 text-xs font-semibold text-neutral-700 whitespace-nowrap">
                {settings.categories.filter((c) => c !== 'Todas').length} categorías configuradas
              </div>
            </div>

            {/* Quick Add Category Bar */}
            <form
              onSubmit={handleAddCategory}
              className="bg-white rounded-xl p-4 shadow-xs border border-[#efeded] flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
            >
              <div className="relative flex-1">
                <span className="material-symbols-outlined text-[18px] text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2">
                  add_circle
                </span>
                <input
                  type="text"
                  placeholder="Nombre de la nueva categoría (ej. Faldas & Minifaldas, Ropa de Playa...)"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#f5f3f3] rounded-lg text-xs text-black placeholder:text-neutral-400 focus:outline-none focus:bg-white border border-transparent focus:border-neutral-300 transition-all font-medium"
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
            <div className="bg-white rounded-xl shadow-xs border border-[#efeded] overflow-hidden">
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
                              className="flex-1 px-3 py-1.5 rounded-lg border border-neutral-300 text-xs font-semibold text-black focus:outline-none focus:ring-1 focus:ring-black"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRenameCategory();
                                if (e.key === 'Escape') setEditingCategory(null);
                              }}
                            />
                            <button
                              type="button"
                              onClick={handleSaveRenameCategory}
                              className="px-3 py-1.5 rounded-lg bg-black text-white text-xs font-semibold hover:bg-neutral-800"
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCategory(null)}
                              className="px-2.5 py-1.5 rounded-lg bg-neutral-200 text-neutral-700 text-xs font-medium hover:bg-neutral-300"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-black">{cat}</span>
                              {isGlobalFilter && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-neutral-200 text-neutral-700">
                                  Filtro del Sistema
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-neutral-500">
                              {count} {count === 1 ? 'prenda asociada' : 'prendas asociadas'} en inventario
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      {!isEditingThis && (
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {/* Filter products by this category */}
                          <button
                            type="button"
                            onClick={() => {
                              setCategoryFilter(cat);
                              setSelectedSubTab('products');
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#efeded] hover:bg-neutral-200 text-black text-xs font-medium transition-colors"
                            title="Ver productos con esta categoría"
                          >
                            <span className="material-symbols-outlined text-[15px]">visibility</span>
                            <span>Ver prendas</span>
                          </button>

                          {!isGlobalFilter && (
                            <>
                              <button
                                type="button"
                                onClick={() => setEditingCategory({ original: cat, current: cat })}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-100 text-neutral-700 text-xs font-medium transition-colors"
                                title="Renombrar categoría"
                              >
                                <span className="material-symbols-outlined text-[15px]">edit</span>
                                <span>Renombrar</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteCategory(cat)}
                                className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors"
                                title="Eliminar categoría"
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                              </button>
                            </>
                          )}
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
        {/* SUBTAB 3: GESTIÓN DE TALLES MAESTROS                                      */}
        {/* ========================================================================= */}
        {selectedSubTab === 'sizes' && (
          <div className="flex flex-col gap-6">
            {/* Pedagogical / Functional explanation banner */}
            <div className="bg-white rounded-xl p-5 border border-[#efeded] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-lg bg-black text-white flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[22px]">straighten</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-black">
                    ¿Para qué sirven los Talles Maestros?
                  </h3>
                  <p className="text-xs text-[#5f5e5b] mt-1 max-w-3xl leading-relaxed">
                    Los <strong className="text-black">talles maestros</strong> son las medidas o numeraciones oficiales estandarizadas de tu boutique (ej: <em>XS, S, M, L, XL</em> o <em>36, 38, 40</em> o <em>Talle Único</em>). Al dar de alta prendas o variantes de stock, el sistema te ofrece esta lista maestra para que no tengas que escribir cada talle de memoria ni cometer errores de tipeo.
                  </p>
                </div>
              </div>

              <div className="px-3.5 py-1.5 rounded-lg bg-[#f5f3f3] border border-neutral-200 text-xs font-semibold text-neutral-700 whitespace-nowrap">
                {settings.masterSizes.length} talles configurados
              </div>
            </div>

            {/* Quick Add Size Bar */}
            <form
              onSubmit={handleAddSize}
              className="bg-white rounded-xl p-4 shadow-xs border border-[#efeded] flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
            >
              <div className="relative flex-1">
                <span className="material-symbols-outlined text-[18px] text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2">
                  straighten
                </span>
                <input
                  type="text"
                  placeholder="Nombre del talle (ej. XXL, 38, 40, Único...)"
                  value={newSizeName}
                  onChange={(e) => setNewSizeName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#f5f3f3] rounded-lg text-xs text-black placeholder:text-neutral-400 focus:outline-none focus:bg-white border border-transparent focus:border-neutral-300 transition-all font-medium uppercase"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-neutral-600 cursor-pointer select-none px-2">
                <input
                  type="checkbox"
                  checked={newSizeEnabled}
                  onChange={(e) => setNewSizeEnabled(e.target.checked)}
                  className="rounded text-black focus:ring-0 cursor-pointer"
                />
                <span>Habilitado para matrices automáticas</span>
              </label>

              <button
                type="submit"
                disabled={!newSizeName.trim()}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-black disabled:opacity-40 text-white text-xs font-semibold shadow-xs hover:shadow transition-all active:scale-[0.98] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span>Nuevo Talle</span>
              </button>
            </form>

            {/* Master Sizes Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {settings.masterSizes.map((size) => {
                const assignedVariants = sizeUsage[size.name.toUpperCase()] || 0;

                return (
                  <div
                    key={size.name}
                    className="bg-white rounded-xl p-4 border border-[#efeded] shadow-xs flex flex-col justify-between gap-3 hover:border-neutral-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-lg bg-black text-white font-bold text-sm flex items-center justify-center tracking-tight shadow-xs">
                          {size.name}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-black">Talle {size.name}</div>
                          <div className="text-[11px] text-neutral-500">
                            {assignedVariants} {assignedVariants === 1 ? 'variante' : 'variantes'} con stock
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteSize(size.name)}
                        className="text-neutral-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                        title="Eliminar talle maestro"
                      >
                        <span className="material-symbols-outlined text-[17px]">delete</span>
                      </button>
                    </div>

                    <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-neutral-500">Generación automática</span>
                      <button
                        type="button"
                        onClick={() => handleToggleSize(size.name)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors ${
                          size.enabled
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-neutral-100 text-neutral-600'
                        }`}
                      >
                        {size.enabled ? 'Activo' : 'Pausado'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SUBTAB 4: GESTIÓN DE COLORES MAESTROS                                     */}
        {/* ========================================================================= */}
        {selectedSubTab === 'colors' && (
          <div className="flex flex-col gap-6">
            {/* Pedagogical / Functional explanation banner */}
            <div className="bg-white rounded-xl p-5 border border-[#efeded] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-lg bg-black text-white flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[22px]">palette</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-black">
                    ¿Para qué sirven los Colores Maestros?
                  </h3>
                  <p className="text-xs text-[#5f5e5b] mt-1 max-w-3xl leading-relaxed">
                    Los <strong className="text-black">colores maestros</strong> definen la carta cromática oficial de tu marca. Cada color posee un nombre comercial (ej. <em>Negro Azabache, Crema Natural, Terracota</em>) y su código hexadecimal (<em>#HEX</em>). Al crear variantes de prendas, el cliente ve los círculos de colores reales en la tienda online para seleccionar su combinación exacta.
                  </p>
                </div>
              </div>

              <div className="px-3.5 py-1.5 rounded-lg bg-[#f5f3f3] border border-neutral-200 text-xs font-semibold text-neutral-700 whitespace-nowrap">
                {settings.masterColors.length} colores configurados
              </div>
            </div>

            {/* Quick Add Color Bar */}
            <form
              onSubmit={handleAddColor}
              className="bg-white rounded-xl p-4 shadow-xs border border-[#efeded] flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
            >
              {/* Color Name Input */}
              <div className="relative flex-1">
                <span className="material-symbols-outlined text-[18px] text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2">
                  palette
                </span>
                <input
                  type="text"
                  placeholder="Nombre comercial del color (ej. Verde Eucalipto, Arena Camel...)"
                  value={newColorName}
                  onChange={(e) => setNewColorName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#f5f3f3] rounded-lg text-xs text-black placeholder:text-neutral-400 focus:outline-none focus:bg-white border border-transparent focus:border-neutral-300 transition-all font-medium"
                />
              </div>

              {/* Native Color Picker + Hex Input */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 p-1 bg-[#f5f3f3] rounded-lg border border-neutral-200">
                  <input
                    type="color"
                    value={newColorHex}
                    onChange={(e) => setNewColorHex(e.target.value)}
                    className="w-7 h-7 rounded border-0 cursor-pointer p-0 bg-transparent"
                    title="Elegir muestra visual de color"
                  />
                  <input
                    type="text"
                    value={newColorHex}
                    onChange={(e) => setNewColorHex(e.target.value)}
                    placeholder="#1A1A1A"
                    className="w-20 px-1.5 py-1 bg-transparent text-xs font-mono font-semibold text-black uppercase focus:outline-none"
                  />
                </div>

                {/* Swatch circle preview */}
                <div
                  className="w-8 h-8 rounded-full border border-neutral-300 shadow-2xs shrink-0"
                  style={{ backgroundColor: newColorHex }}
                  title="Vista previa del color"
                ></div>
              </div>

              <button
                type="submit"
                disabled={!newColorName.trim()}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-black disabled:opacity-40 text-white text-xs font-semibold shadow-xs hover:shadow transition-all active:scale-[0.98] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">palette</span>
                <span>Guardar Color</span>
              </button>
            </form>

            {/* Master Colors Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {settings.masterColors.map((color) => {
                const assignedVariants = colorUsage[color.name.toLowerCase()] || 0;

                return (
                  <div
                    key={color.name}
                    className="bg-white rounded-xl p-4 border border-[#efeded] shadow-xs flex items-center justify-between gap-3 hover:border-neutral-300 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {/* Circle Swatch */}
                      <div
                        className="w-10 h-10 rounded-full border border-neutral-300 shadow-xs shrink-0"
                        style={{ backgroundColor: color.hex }}
                      ></div>

                      <div>
                        <div className="text-xs font-bold text-black">{color.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-mono text-neutral-500 bg-[#f5f3f3] px-1.5 py-0.5 rounded">
                            {color.hex}
                          </span>
                          <span className="text-[10px] text-neutral-400">
                            • {assignedVariants} {assignedVariants === 1 ? 'variante' : 'variantes'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteColor(color.name)}
                      className="text-neutral-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                      title="Eliminar color maestro"
                    >
                      <span className="material-symbols-outlined text-[17px]">delete</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Focused Slide-Over / Management Modal: Edición de Producto */}
      {editingProduct && (
        <ProductEditModal
          product={editingProduct}
          isOpen={!!editingProduct}
          onClose={() => setEditingProduct(null)}
          onSave={onSaveProduct}
          settings={settings}
          allowDevicePhotos={featureFlags?.uploadDevicePhotos !== false}
          existingTags={allExistingTags}
        />
      )}

      {/* Confirmation Modal: Eliminar Categoría */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-neutral-200 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-2xl">folder_delete</span>
            </div>
            <h3 className="text-base font-bold text-neutral-900 mb-1">
              ¿Eliminar categoría "{categoryToDelete}"?
            </h3>
            <p className="text-xs text-neutral-500 mb-5 leading-relaxed">
              {(categoryUsage[categoryToDelete] || 0) > 0 ? (
                <>
                  Hay <strong className="text-neutral-800 font-semibold">{categoryUsage[categoryToDelete]} prenda(s)</strong> con esta categoría asignada que quedarán sin clasificar en el catálogo.
                </>
              ) : (
                'Esta categoría se eliminará de las opciones y filtros de tu tienda.'
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

      {/* Confirmation Modal: Eliminar Talle Maestro */}
      {sizeToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-neutral-200 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-2xl">straighten</span>
            </div>
            <h3 className="text-base font-bold text-neutral-900 mb-1">
              ¿Eliminar talle maestro "{sizeToDelete}"?
            </h3>
            <p className="text-xs text-neutral-500 mb-5 leading-relaxed">
              {(sizeUsage[sizeToDelete.toUpperCase()] || 0) > 0 ? (
                <>
                  Hay <strong className="text-neutral-800 font-semibold">{sizeUsage[sizeToDelete.toUpperCase()]} variante(s)</strong> registradas con este talle en el inventario.
                </>
              ) : (
                'Este talle ya no aparecerá sugerido al cargar nuevas prendas.'
              )}
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSizeToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const s = sizeToDelete;
                  setSizeToDelete(null);
                  await executeDeleteSize(s);
                }}
                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                Eliminar Talle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Eliminar Color Maestro */}
      {colorToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-neutral-200 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-2xl">palette</span>
            </div>
            <h3 className="text-base font-bold text-neutral-900 mb-1">
              ¿Eliminar color maestro "{colorToDelete}"?
            </h3>
            <p className="text-xs text-neutral-500 mb-5 leading-relaxed">
              {(colorUsage[colorToDelete.toLowerCase()] || 0) > 0 ? (
                <>
                  Hay <strong className="text-neutral-800 font-semibold">{colorUsage[colorToDelete.toLowerCase()]} variante(s)</strong> registradas con este color en el inventario.
                </>
              ) : (
                'Este color ya no aparecerá en la paleta maestra al crear variantes.'
              )}
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setColorToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const c = colorToDelete;
                  setColorToDelete(null);
                  await executeDeleteColor(c);
                }}
                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                Eliminar Color
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

      {/* Modal: Nuevo Producto con IA (Gemini Flash) */}
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
