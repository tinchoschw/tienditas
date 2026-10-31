import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Sale, Product, SaleItem, SalePayment, StoreFeatureFlags, StoreSettings } from '../types';
import { ensureStoreAttributes, formatVariantSummary } from '../utils/attributeUtils';

interface SalesViewProps {
  sales: Sale[];
  products: Product[];
  onCreateSale: (newSale: Sale) => Promise<Sale>;
  onCancelSale: (saleId: string) => Promise<void>;
  onDeleteSale?: (saleId: string) => Promise<void>;
  onAddPayment: (saleId: string, payment: Omit<SalePayment, 'id'>) => Promise<any>;
  onUpdateSaleItems: (saleId: string, items: SaleItem[], newTotal?: number) => Promise<any>;
  onConfirmPreventaSale?: (saleId: string, paidAmount?: number, paymentMethod?: string) => Promise<any>;
  onDismissPaymentAlert?: (saleId: string) => Promise<void>;
  featureFlags?: StoreFeatureFlags;
  settings?: StoreSettings;
}

export const SalesView: React.FC<SalesViewProps> = ({
  sales,
  products,
  onCreateSale,
  onCancelSale,
  onDeleteSale,
  onAddPayment,
  onUpdateSaleItems,
  onConfirmPreventaSale,
  onDismissPaymentAlert,
  featureFlags,
  settings
}) => {
  const [showNewSalePanel, setShowNewSalePanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'date' | 'debt' | 'total' | 'paid'>('date');

  // Floating Action Button observer for Nueva Venta
  const newSaleBtnRef = useRef<HTMLButtonElement>(null);
  const [isNewSaleBtnVisible, setIsNewSaleBtnVisible] = useState(true);

  useEffect(() => {
    const el = newSaleBtnRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsNewSaleBtnVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Format date and time helper
  const formatSaleDateTime = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const dateFormatted = d.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      if (dateStr.includes('T') || dateStr.includes(':')) {
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${dateFormatted} ${hours}:${minutes} hs`;
      }
      return dateFormatted;
    } catch {
      return dateStr;
    }
  };

  const { attribute1, attribute2 } = useMemo(() => ensureStoreAttributes(settings), [settings]);

  // Count unreviewed payment alerts from MP webhook
  const pendingAlertsCount = useMemo(() => {
    return sales.filter((s) => s.paymentAlert && !s.paymentAlert.dismissed).length;
  }, [sales]);

  // Modal to confirm cancellation
  const [cancelModalSale, setCancelModalSale] = useState<Sale | null>(null);

  // Modal to confirm permanent deletion (avoids window.confirm blocking in iframe)
  const [deleteConfirmSale, setDeleteConfirmSale] = useState<Sale | null>(null);

  // Alphabetically sorted categories
  const sortedCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category && p.category.trim()) set.add(p.category.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  // New Sale Form State (Always starts blank for new entry)
  const [newSaleDate, setNewSaleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newSaleCustomer, setNewSaleCustomer] = useState('');
  const [newSaleDueDate, setNewSaleDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [loadedItems, setLoadedItems] = useState<SaleItem[]>([]);
  const [customTotalInput, setCustomTotalInput] = useState<string>('');

  // Add Item to loaded order selectors (with Category combo and Alphabetical Sorting)
  const [newSaleCategoryFilter, setNewSaleCategoryFilter] = useState<string>('Todas');
  const availableProductsForNewSale = useMemo(() => {
    return products
      .filter((p) => {
        if (newSaleCategoryFilter === 'Todas') return true;
        return p.category.toLowerCase() === newSaleCategoryFilter.toLowerCase();
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, newSaleCategoryFilter]);

  const [itemSelectProductId, setItemSelectProductId] = useState<string>(() => {
    const sorted = [...products].sort((a, b) => a.name.localeCompare(b.name));
    return sorted[0]?.id || '';
  });
  const selectedProduct = products.find((p) => p.id === itemSelectProductId) || availableProductsForNewSale[0] || products[0];
  const [itemSelectSize, setItemSelectSize] = useState<string>('M');
  const [itemSelectColor, setItemSelectColor] = useState<string>('Negro');
  const [itemSelectQty, setItemSelectQty] = useState<number>(1);

  // Helper to completely reset the new sale form to blank
  const resetNewSaleForm = () => {
    setNewSaleCustomer('');
    setLoadedItems([]);
    setCustomTotalInput('');
    setNewSaleDate(new Date().toISOString().slice(0, 10));
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setNewSaleDueDate(d.toISOString().slice(0, 10));
    setNewSalePaymentAmount('');
    setNewSalePaymentDate(new Date().toISOString().slice(0, 10));
    setNewSalePaymentMethod('Transferencia Bancaria');
    setNewSaleCategoryFilter('Todas');
    setItemSelectQty(1);
    const sorted = [...products].sort((a, b) => a.name.localeCompare(b.name));
    if (sorted[0]) {
      setItemSelectProductId(sorted[0].id);
      setItemSelectSize(sorted[0].variants[0]?.size || 'U');
      setItemSelectColor(sorted[0].variants[0]?.color || 'Único');
    }
  };

  // Popup Modal for Viewing and Editing a Sale (Replacing the bottom view)
  const [modalSale, setModalSale] = useState<Sale | null>(null);
  const [modalDraftItems, setModalDraftItems] = useState<SaleItem[]>([]);
  const [modalDraftTotal, setModalDraftTotal] = useState<string>('');
  const [modalCategoryFilter, setModalCategoryFilter] = useState<string>('Todas');
  const [modalSelectProductId, setModalSelectProductId] = useState<string>('');
  const [modalSelectSize, setModalSelectSize] = useState<string>('M');
  const [modalSelectColor, setModalSelectColor] = useState<string>('Negro');
  const [modalSelectQty, setModalSelectQty] = useState<number>(1);
  const [modalSaving, setModalSaving] = useState<boolean>(false);
  const [modalSuccessMsg, setModalSuccessMsg] = useState<string | null>(null);

  // Initial Payment form for New Sale
  const [newSalePaymentAmount, setNewSalePaymentAmount] = useState<string>('');
  const [newSalePaymentDate, setNewSalePaymentDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [newSalePaymentMethod, setNewSalePaymentMethod] = useState<string>('Transferencia Bancaria');

  // Payment form inside modal
  const [modalPaymentAmount, setModalPaymentAmount] = useState<string>('');
  const [modalPaymentDate, setModalPaymentDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [modalPaymentMethod, setModalPaymentMethod] = useState<string>('Transferencia Bancaria');

  // Stock Warning Dialog state for in-app alert with confirmation
  interface StockWarningInfo {
    productName: string;
    color: string;
    size: string;
    requestedQty: number;
    availableStock: number;
    onConfirm: () => void;
  }
  const [stockWarningDialog, setStockWarningDialog] = useState<StockWarningInfo | null>(null);

  const availableProductsForModal = useMemo(() => {
    return products
      .filter((p) => {
        if (modalCategoryFilter === 'Todas') return true;
        return p.category.toLowerCase() === modalCategoryFilter.toLowerCase();
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, modalCategoryFilter]);

  const selectedModalProduct = products.find((p) => p.id === modalSelectProductId) || availableProductsForModal[0] || products[0];

  // Helper to open a sale in the popup modal
  const handleOpenSaleModal = (sale: Sale) => {
    setModalSale(sale);
    setModalDraftItems([...sale.items]);
    setModalDraftTotal(String(sale.total));
    setModalCategoryFilter('Todas');
    const sorted = [...products].sort((a, b) => a.name.localeCompare(b.name));
    if (sorted[0]) {
      setModalSelectProductId(sorted[0].id);
      setModalSelectSize(sorted[0].variants[0]?.size || 'U');
      setModalSelectColor(sorted[0].variants[0]?.color || 'Único');
    }
    setModalSelectQty(1);
    setModalPaymentAmount('');
    setModalSuccessMsg(null);
  };

  // Build mailto URL with complete formatted receipt for the customer
  const buildEmailReceiptUrl = (sale: Sale) => {
    const email = sale.customerEmail || (sale.contactInfo && sale.contactInfo.includes('@') ? sale.contactInfo.match(/[\w.-]+@[\w.-]+\.\w+/)?.[0] : '') || '';
    const subject = `Comprobante de Pedido #${sale.id} - ${sale.customer || 'Cliente'}`;
    const itemsList = sale.items
      .map((it) => `• ${it.quantity}x ${it.productName} (Talle: ${it.size}, Color: ${it.color}) - $${it.totalPrice.toLocaleString('es-AR')}`)
      .join('\n');

    const body = `¡Hola ${sale.customer || ''}!\n\n` +
      `Te enviamos el comprobante y detalle de tu pedido #${sale.id}:\n\n` +
      `DETALLE DE PRENDAS:\n${itemsList}\n\n` +
      `RESUMEN CONTABLE:\n` +
      `• Total del Pedido: $${sale.total.toLocaleString('es-AR')}\n` +
      `• Total Abonado: $${sale.paidTotal.toLocaleString('es-AR')}\n` +
      `• Saldo Pendiente: $${sale.pendingBalance.toLocaleString('es-AR')}\n` +
      `• Estado: ${sale.status === 'cobrada_total' ? 'PAGADO COMPLETO' : sale.status === 'cobro_parcial' ? 'PAGO PARCIAL' : sale.status === 'preventa' ? 'CONSULTA PREVENTA' : 'PENDIENTE'}\n\n` +
      `Fecha: ${sale.date}\n\n` +
      `¡Muchas gracias por elegirnos! Quedamos a disposición ante cualquier consulta.`;

    return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // Build WhatsApp receipt link with complete order breakdown
  const buildWhatsAppReceiptUrl = (sale: Sale) => {
    const rawPhone = sale.customerPhone || sale.contactInfo || '';
    const phone = rawPhone.replace(/[^0-9]/g, '');
    const itemsList = sale.items
      .map((it) => `• ${it.quantity}x ${it.productName} (Talle ${it.size}, ${it.color}) = $${it.totalPrice.toLocaleString('es-AR')}`)
      .join('\n');

    const text = `¡Hola ${sale.customer || ''}! Te enviamos el comprobante de tu pedido #${sale.id}:\n\n` +
      `*Detalle de Prendas:*\n${itemsList}\n\n` +
      `*Total:* $${sale.total.toLocaleString('es-AR')}\n` +
      `*Abonado:* $${sale.paidTotal.toLocaleString('es-AR')}\n` +
      `*Saldo Pendiente:* $${sale.pendingBalance.toLocaleString('es-AR')}\n` +
      `*Estado:* ${sale.status === 'cobrada_total' ? '✅ PAGADO COMPLETO' : sale.status === 'cobro_parcial' ? '⏳ PAGO PARCIAL' : '⏳ PENDIENTE'}\n\n` +
      `¡Muchas gracias por elegirnos!`;

    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  // Keep modalSale refreshed from sales prop
  React.useEffect(() => {
    if (modalSale) {
      const refreshed = sales.find((s) => s.id === modalSale.id);
      if (refreshed) {
        setModalSale(refreshed);
      }
    }
  }, [sales]);

  // Summary Ledger Calculations
  const totalSold = useMemo(() => {
    return sales
      .filter((s) => s.status !== 'cancelada')
      .reduce((acc, s) => acc + s.total, 0);
  }, [sales]);

  const totalCollected = useMemo(() => {
    return sales
      .filter((s) => s.status !== 'cancelada')
      .reduce((acc, s) => acc + s.paidTotal, 0);
  }, [sales]);

  const totalPending = useMemo(() => {
    return sales
      .filter((s) => s.status !== 'cancelada')
      .reduce((acc, s) => acc + s.pendingBalance, 0);
  }, [sales]);

  const activeSalesCount = useMemo(() => {
    return sales.filter((s) => s.status !== 'cancelada').length;
  }, [sales]);

  const avgTicket = activeSalesCount > 0 ? Math.round(totalSold / activeSalesCount) : 0;
  const collectedPercentage = totalSold > 0 ? ((totalCollected / totalSold) * 100).toFixed(1) : '0';

  // Subtotal for new sale
  const subtotalNewSale = loadedItems.reduce((acc, it) => acc + it.totalPrice, 0);

  // Filtered & Sorted Sales
  const filteredSales = useMemo(() => {
    return sales
      .filter((s) => {
        const matchesQuery =
          s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.contactInfo.toLowerCase().includes(searchQuery.toLowerCase()) ||
          Boolean(s.customerPhone && s.customerPhone.toLowerCase().includes(searchQuery.toLowerCase())) ||
          Boolean(s.customerEmail && s.customerEmail.toLowerCase().includes(searchQuery.toLowerCase()));

        let matchesStatus = true;
        if (statusFilter !== 'all') {
          matchesStatus = s.status === statusFilter;
        }

        return matchesQuery && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'date') return new Date(b.date).getTime() - new Date(a.date).getTime();
        if (sortBy === 'debt') return b.pendingBalance - a.pendingBalance;
        if (sortBy === 'total') return b.total - a.total;
        if (sortBy === 'paid') return b.paidTotal - a.paidTotal;
        return 0;
      });
  }, [sales, searchQuery, statusFilter, sortBy]);

  const handleAddItemToNewSale = () => {
    if (!selectedProduct) return;
    const price = selectedProduct.price;
    const matchedVariant =
      selectedProduct.variants.find(
        (v) =>
          v.size.toLowerCase() === itemSelectSize.toLowerCase() &&
          v.color.toLowerCase() === itemSelectColor.toLowerCase()
      ) ||
      selectedProduct.variants.find((v) => v.size.toLowerCase() === itemSelectSize.toLowerCase()) ||
      selectedProduct.variants[0];

    const isUnlimited = !!matchedVariant?.unlimited;
    const currentStock = isUnlimited ? 999999 : (matchedVariant ? Number(matchedVariant.stock || 0) : 0);

    const doAdd = () => {
      const summary = matchedVariant
        ? formatVariantSummary(matchedVariant, attribute1, attribute2, selectedProduct)
        : [itemSelectColor, itemSelectSize].filter(Boolean).join(' · ');

      const newItem: SaleItem = {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        variantId: matchedVariant?.id,
        size: itemSelectSize || matchedVariant?.size || 'U',
        color: itemSelectColor || matchedVariant?.color || 'Único',
        attributeSummary: summary,
        unlimited: isUnlimited,
        quantity: itemSelectQty,
        unitPrice: price,
        totalPrice: price * itemSelectQty
      };

      const newItems = [...loadedItems, newItem];
      setLoadedItems(newItems);
      const newSubtotal = newItems.reduce((acc, it) => acc + it.totalPrice, 0);
      setCustomTotalInput(String(newSubtotal));

      // Reset fields back to initial state as requested by user
      setNewSaleCategoryFilter('Todas');
      const sorted = [...products].sort((a, b) => a.name.localeCompare(b.name));
      if (sorted[0]) {
        setItemSelectProductId(sorted[0].id);
        setItemSelectSize(sorted[0].variants[0]?.size || 'U');
        setItemSelectColor(sorted[0].variants[0]?.color || 'Único');
      }
      setItemSelectQty(1);
    };

    if (!isUnlimited && itemSelectQty > currentStock) {
      setStockWarningDialog({
        productName: selectedProduct.name,
        color: itemSelectColor || matchedVariant?.color || 'Único',
        size: itemSelectSize || matchedVariant?.size || 'U',
        requestedQty: itemSelectQty,
        availableStock: currentStock,
        onConfirm: () => {
          doAdd();
        }
      });
      return;
    }

    doAdd();
  };
  const handleRemoveItemFromNewSale = (idx: number) => {
    const updated = loadedItems.filter((_, i) => i !== idx);
    setLoadedItems(updated);
    const newSubtotal = updated.reduce((acc, it) => acc + it.totalPrice, 0);
    setCustomTotalInput(String(newSubtotal));
  };

  const handleConfirmNewSale = async () => {
    if (loadedItems.length === 0) {
      alert('Debes agregar al menos una prenda para registrar la venta.');
      return;
    }

    const subtotal = loadedItems.reduce((acc, it) => acc + it.totalPrice, 0);
    const finalTotal = Number(customTotalInput) || subtotal;
    const nextNum = 1000 + sales.length + 1;

    const payAmount = Number(newSalePaymentAmount) || 0;
    const initialPayments: SalePayment[] = [];
    if (payAmount > 0) {
      initialPayments.push({
        id: `pay-${Date.now()}`,
        amount: payAmount,
        date: newSalePaymentDate || new Date().toISOString().slice(0, 10),
        method: newSalePaymentMethod || 'Transferencia Bancaria',
        status: 'Confirmado'
      });
    }

    const paidTotal = payAmount;
    const pendingBalance = Math.max(0, finalTotal - paidTotal);
    let status: Sale['status'] = 'pendiente_total';
    if (paidTotal >= finalTotal && finalTotal > 0) {
      status = 'cobrada_total';
    } else if (paidTotal > 0) {
      status = 'cobro_parcial';
    }

    let finalSaleDate = newSaleDate;
    if (newSaleDate && !newSaleDate.includes('T')) {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      finalSaleDate = `${newSaleDate}T${timeStr}`;
    }

    const newSale: Sale = {
      id: `V-${nextNum}`,
      date: finalSaleDate,
      customer: newSaleCustomer.trim() || 'Cliente Mostrador',
      contactInfo: newSaleCustomer.includes('(')
        ? newSaleCustomer.substring(newSaleCustomer.indexOf('(') + 1).replace(')', '')
        : 'Mostrador Local',
      dueDate: newSaleDueDate,
      items: loadedItems,
      subtotal,
      total: finalTotal,
      paidTotal,
      pendingBalance,
      status,
      payments: initialPayments,
      createdAt: new Date().toISOString()
    };

    await onCreateSale(newSale);
    resetNewSaleForm();
    setShowNewSalePanel(false);
  };
  const handleSaveModalChanges = async () => {
    if (!modalSale) return;
    setModalSaving(true);
    try {
      const calculatedSubtotal = modalDraftItems.reduce((acc, it) => acc + it.totalPrice, 0);
      const finalTotal = Number(modalDraftTotal) > 0 ? Number(modalDraftTotal) : calculatedSubtotal;
      await onUpdateSaleItems(modalSale.id, modalDraftItems, finalTotal);
      setModalSuccessMsg('¡Cambios guardados con éxito!');
      setTimeout(() => {
        setModalSale(null);
        setModalSuccessMsg(null);
      }, 600);
    } catch (e) {
      console.error(e);
      alert('Error al guardar los cambios.');
    } finally {
      setModalSaving(false);
    }
  };

  const handleModalRegisterPayment = async () => {
    if (!modalSale) return;
    const amount = Number(modalPaymentAmount);
    if (!amount || amount <= 0) {
      alert('Ingresa un monto válido para el cobro.');
      return;
    }
    await onAddPayment(modalSale.id, {
      amount,
      date: modalPaymentDate,
      method: modalPaymentMethod,
      status: 'Confirmado'
    });
    setModalPaymentAmount('');
  };

  const handleModalAddItem = () => {
    if (!selectedModalProduct) return;
    const price = selectedModalProduct.price;
    const matchedVariant =
      selectedModalProduct.variants.find(
        (v) =>
          v.size.toLowerCase() === modalSelectSize.toLowerCase() &&
          v.color.toLowerCase() === modalSelectColor.toLowerCase()
      ) ||
      selectedModalProduct.variants.find((v) => v.size.toLowerCase() === modalSelectSize.toLowerCase()) ||
      selectedModalProduct.variants[0];

    const isUnlimited = !!matchedVariant?.unlimited;
    const currentStock = isUnlimited ? 999999 : (matchedVariant ? Number(matchedVariant.stock || 0) : 0);

    const doAddModal = () => {
      const summary = matchedVariant
        ? formatVariantSummary(matchedVariant, attribute1, attribute2, selectedModalProduct)
        : [modalSelectColor, modalSelectSize].filter(Boolean).join(' · ');

      const newItem: SaleItem = {
        productId: selectedModalProduct.id,
        productName: selectedModalProduct.name,
        variantId: matchedVariant?.id,
        size: modalSelectSize || matchedVariant?.size || 'U',
        color: modalSelectColor || matchedVariant?.color || 'Único',
        attributeSummary: summary,
        unlimited: isUnlimited,
        quantity: modalSelectQty,
        unitPrice: price,
        totalPrice: price * modalSelectQty
      };

      const newItems = [...modalDraftItems, newItem];
      setModalDraftItems(newItems);
      const newSubtotal = newItems.reduce((acc, it) => acc + it.totalPrice, 0);
      setModalDraftTotal(String(newSubtotal));

      // Reset modal selector back to initial state
      setModalCategoryFilter('Todas');
      const sorted = [...products].sort((a, b) => a.name.localeCompare(b.name));
      if (sorted[0]) {
        setModalSelectProductId(sorted[0].id);
        setModalSelectSize(sorted[0].variants[0]?.size || 'U');
        setModalSelectColor(sorted[0].variants[0]?.color || 'Único');
      }
      setModalSelectQty(1);
    };

    if (!isUnlimited && modalSelectQty > currentStock) {
      setStockWarningDialog({
        productName: selectedModalProduct.name,
        color: modalSelectColor || matchedVariant?.color || 'Único',
        size: modalSelectSize || matchedVariant?.size || 'U',
        requestedQty: modalSelectQty,
        availableStock: currentStock,
        onConfirm: () => {
          doAddModal();
        }
      });
      return;
    }

    doAddModal();
  };
  const handleModalRemoveItem = (idx: number) => {
    const updated = modalDraftItems.filter((_, i) => i !== idx);
    setModalDraftItems(updated);
    const newSubtotal = updated.reduce((acc, it) => acc + it.totalPrice, 0);
    setModalDraftTotal(String(newSubtotal));
  };

  const handleModalUpdateItemQty = (idx: number, delta: number) => {
    const item = modalDraftItems[idx];
    if (!item) return;
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      handleModalRemoveItem(idx);
      return;
    }
    const updated = [...modalDraftItems];
    updated[idx] = {
      ...item,
      quantity: newQty,
      totalPrice: item.unitPrice * newQty
    };
    setModalDraftItems(updated);
    const newSubtotal = updated.reduce((acc, it) => acc + it.totalPrice, 0);
    setModalDraftTotal(String(newSubtotal));
  };

  const handleExportPlanilla = () => {
    let csv = 'ID,Fecha,Cliente,Contacto,Vencimiento,Total,Cobrado,Saldo,Estado,Prendas\n';
    sales.forEach((s) => {
      const itemsList = s.items.map((it) => {
        const desc = it.attributeSummary || [it.color, it.size].filter(Boolean).join('/');
        return `${it.productName} (${desc || 'Estándar'} x${it.quantity}${it.unlimited ? ' [ilimitado]' : ''})`;
      }).join('; ');
      csv += `"${s.id}","${s.date}","${s.customer}","${s.contactInfo}","${s.dueDate}",${s.total},${s.paidTotal},${s.pendingBalance},"${s.status}","${itemsList}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', `ventas-y-cobros-atelier-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="w-full flex flex-col px-4 sm:px-8 py-6 max-w-[1600px] mx-auto gap-6">
      {/* Header Context & Quick Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-[#5f5e5b] text-xs font-semibold uppercase tracking-wider mb-1">
            <span>Operaciones Comerciales</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-black font-bold">Libro de Ventas & Cobros</span>
          </div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="font-headline-lg text-2xl sm:text-3xl text-black font-bold tracking-tight">
              Registro de Ventas y Cobros
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#efeded] text-[#444748] text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
              Sincronización de Stock Activa
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            ref={newSaleBtnRef}
            onClick={() => {
              if (!showNewSalePanel) {
                resetNewSaleForm();
              }
              setShowNewSalePanel(!showNewSalePanel);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-black text-white text-xs sm:text-sm font-semibold transition-all shadow-xs hover:shadow active:scale-[0.98] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Nueva Venta</span>
          </button>
          {featureFlags?.exportSales !== false && (
            <button
              onClick={handleExportPlanilla}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#efeded] hover:bg-[#e4e2e2] text-black text-xs sm:text-sm font-medium transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">file_download</span>
              <span>Exportar Planilla</span>
            </button>
          )}
        </div>
      </div>

      {/* Payment Alerts Banner from MP Webhook */}
      {pendingAlertsCount > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-amber-600 text-2xl shrink-0">warning</span>
            <div>
              <p className="font-bold text-sm">
                Tenés {pendingAlertsCount} {pendingAlertsCount === 1 ? 'venta con aviso de pago' : 'ventas con avisos de pago'}
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                Mercado Pago notificó cobros con diferencias de monto o sobre ventas previamente canceladas. Revisá las ventas marcadas.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Bar / Ledger Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Total Vendido */}
        <div className="p-5 rounded-xl bg-white shadow-xs border border-[#efeded] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">
              Total Vendido del Mes
            </span>
            <div className="w-9 h-9 rounded-lg bg-[#f5f3f3] flex items-center justify-center text-black">
              <span className="material-symbols-outlined text-[20px]">trending_up</span>
            </div>
          </div>
          <div className="mt-4">
            <div className="font-headline-lg text-2xl sm:text-3xl text-black font-bold tracking-tight">
              ${totalSold.toLocaleString('es-AR')}
            </div>
            <p className="text-xs text-neutral-500 mt-1 flex items-center gap-1">
              <span className="text-emerald-700 font-bold">+14.2%</span> vs. ciclo mensual previo
            </p>
          </div>
          <div className="w-full bg-[#efeded] h-1.5 rounded-full mt-4 overflow-hidden">
            <div className="bg-black h-full w-[78%]"></div>
          </div>
        </div>

        {/* Total Cobrado */}
        <div className="p-5 rounded-xl bg-white shadow-xs border border-[#efeded] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">
              Total Cobrado
            </span>
            <div className="w-9 h-9 rounded-lg bg-[#f5f3f3] flex items-center justify-center text-black">
              <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
            </div>
          </div>
          <div className="mt-4">
            <div className="font-headline-lg text-2xl sm:text-3xl text-black font-bold tracking-tight">
              ${totalCollected.toLocaleString('es-AR')}
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              <strong className="text-black">{collectedPercentage}%</strong> de la facturación consolidada
            </p>
          </div>
          <div className="w-full bg-[#efeded] h-1.5 rounded-full mt-4 overflow-hidden">
            <div className="bg-neutral-800 h-full" style={{ width: `${Math.min(100, Number(collectedPercentage))}%` }}></div>
          </div>
        </div>

        {/* Pendiente de Cobro */}
        <div className="p-5 rounded-xl bg-white shadow-xs border border-[#efeded] flex flex-col justify-between relative">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">
              Pendiente de Cobro
            </span>
            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[11px] font-bold">
              Falta cobrar
            </span>
          </div>
          <div className="mt-4">
            <div className="font-headline-lg text-2xl sm:text-3xl text-red-600 font-bold tracking-tight">
              ${totalPending.toLocaleString('es-AR')}
            </div>
            <p className="text-xs text-neutral-500 mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px] text-red-600">schedule</span>
              <span>{sales.filter((s) => s.pendingBalance > 0).length} cobros con saldo activo</span>
            </p>
          </div>
          <div className="w-full bg-[#efeded] h-1.5 rounded-full mt-4 overflow-hidden">
            <div className="bg-red-600 h-full w-[35%]"></div>
          </div>
        </div>

        {/* Ventas Activas */}
        <div className="p-5 rounded-xl bg-white shadow-xs border border-[#efeded] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">
              Ventas Activas
            </span>
            <div className="w-9 h-9 rounded-lg bg-[#f5f3f3] flex items-center justify-center text-black">
              <span className="material-symbols-outlined text-[20px]">local_mall</span>
            </div>
          </div>
          <div className="mt-4">
            <div className="font-headline-lg text-2xl sm:text-3xl text-black font-bold tracking-tight">
              {activeSalesCount}
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              {sales.filter((s) => s.status === 'cobrada_total').length} liquidadas al 100%
            </p>
          </div>
          <div className="flex items-center gap-1 mt-4">
            <span className="w-2.5 h-2.5 rounded-full bg-neutral-900"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-neutral-700"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-neutral-400"></span>
            <span className="text-[11px] text-neutral-500 pl-1 font-medium">
              Promedio ticket ${avgTicket.toLocaleString('es-AR')}
            </span>
          </div>
        </div>
      </div>

      {/* POP-UP MODAL: Registrar Nueva Venta (No ensucia la pantalla) */}
      {showNewSalePanel && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden my-auto flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 flex items-center justify-between bg-[#f5f3f3] border-b border-[#efeded] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-[22px]">add_shopping_cart</span>
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-black">
                    Nueva Venta
                  </h2>
                  <p className="text-xs text-neutral-500">
                    Carga de pedido y cobro con afectación inmediata de inventario
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetNewSaleForm();
                  setShowNewSalePanel(false);
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-500 hover:text-black hover:bg-neutral-200 transition-colors cursor-pointer"
                title="Cerrar sin guardar"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
              {/* Client & Dates Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px]">calendar_today</span>
                    Fecha de Venta
                  </label>
                  <input
                    type="date"
                    value={newSaleDate}
                    onChange={(e) => setNewSaleDate(e.target.value)}
                    className="h-9 px-3 rounded-lg bg-[#f5f3f3] text-black text-xs font-medium focus:outline-none focus:bg-white border border-neutral-200"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px]">person</span>
                    Cliente / Identificador
                  </label>
                  <input
                    type="text"
                    placeholder="Nombre o alias de contacto"
                    value={newSaleCustomer}
                    onChange={(e) => setNewSaleCustomer(e.target.value)}
                    className="h-9 px-3 rounded-lg bg-[#f5f3f3] text-black text-xs font-medium focus:outline-none focus:bg-white border border-neutral-200"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px]">event_busy</span>
                    Fecha Límite de Cobro
                  </label>
                  <input
                    type="date"
                    value={newSaleDueDate}
                    onChange={(e) => setNewSaleDueDate(e.target.value)}
                    className="h-9 px-3 rounded-lg bg-[#f5f3f3] text-black text-xs font-medium focus:outline-none focus:bg-white border border-neutral-200"
                  />
                </div>
              </div>

              {/* Add Items Section with Linked Dropdowns */}
              <div className="p-4 rounded-xl bg-[#f5f3f3] border border-neutral-200 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-bold text-black flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">checkroom</span>
                    Prendas de la Venta
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-neutral-600 bg-white px-2.5 py-1 rounded-full border border-neutral-200">
                    <span className="material-symbols-outlined text-[14px]">sync_alt</span>
                    Descuenta stock automáticamente al confirmar
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-12 gap-2.5 items-end">
                  {/* Categoría Combo (Ordenado Alfabéticamente) */}
                  <div className="flex flex-col gap-1 lg:col-span-3">
                    <label className="text-[11px] font-semibold text-neutral-600">Categoría</label>
                    <select
                      value={newSaleCategoryFilter}
                      onChange={(e) => {
                        const newCat = e.target.value;
                        setNewSaleCategoryFilter(newCat);
                        const filtered = products
                          .filter((p) => newCat === 'Todas' || p.category.toLowerCase() === newCat.toLowerCase())
                          .sort((a, b) => a.name.localeCompare(b.name));
                        if (filtered.length > 0) {
                          setItemSelectProductId(filtered[0].id);
                          setItemSelectSize(filtered[0].variants[0]?.size || 'U');
                          setItemSelectColor(filtered[0].variants[0]?.color || 'Único');
                        }
                      }}
                      className="h-9 px-2.5 rounded-lg bg-white text-black text-xs focus:outline-none border border-neutral-200"
                    >
                      <option value="Todas">Todas las categorías</option>
                      {sortedCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Prenda / Modelo Combo (Ordenado Alfabéticamente) */}
                  <div className="flex flex-col gap-1 lg:col-span-3">
                    <label className="text-[11px] font-semibold text-neutral-600">Prenda / Modelo</label>
                    <select
                      value={itemSelectProductId}
                      onChange={(e) => {
                        setItemSelectProductId(e.target.value);
                        const p = products.find((x) => x.id === e.target.value);
                        if (p && p.variants[0]) {
                          setItemSelectSize(p.variants[0].size);
                          setItemSelectColor(p.variants[0].color);
                        }
                      }}
                      className="h-9 px-2.5 rounded-lg bg-white text-black text-xs focus:outline-none border border-neutral-200"
                    >
                      {availableProductsForNewSale.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (${p.price.toLocaleString('es-AR')})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Talle */}
                  <div className="flex flex-col gap-1 lg:col-span-2">
                    <label className="text-[11px] font-semibold text-neutral-600">Talle</label>
                    <select
                      value={itemSelectSize}
                      onChange={(e) => setItemSelectSize(e.target.value)}
                      className="h-9 px-2 rounded-lg bg-white text-black text-xs focus:outline-none border border-neutral-200"
                    >
                      {Array.from(new Set(selectedProduct?.variants.map((v) => v.size) || ['S', 'M', 'L'])).map(
                        (s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  {/* Color */}
                  <div className="flex flex-col gap-1 lg:col-span-2">
                    <label className="text-[11px] font-semibold text-neutral-600">Color</label>
                    <select
                      value={itemSelectColor}
                      onChange={(e) => setItemSelectColor(e.target.value)}
                      className="h-9 px-2 rounded-lg bg-white text-black text-xs focus:outline-none border border-neutral-200"
                    >
                      {Array.from(new Set(selectedProduct?.variants.map((v) => v.color) || ['Negro'])).map(
                        (c) => {
                          const vMatch = selectedProduct?.variants.find((v) => v.color === c && v.size === itemSelectSize);
                          const stockDisp = vMatch ? vMatch.stock : selectedProduct?.totalStock;
                          return (
                            <option key={c} value={c}>
                              {c} ({stockDisp} u.)
                            </option>
                          );
                        }
                      )}
                    </select>
                  </div>

                  {/* Cantidad y Botón Añadir (+) Contenido */}
                  <div className="flex items-end gap-2 lg:col-span-2">
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <label className="text-[11px] font-semibold text-neutral-600">Cant.</label>
                      <input
                        type="number"
                        min={1}
                        value={itemSelectQty}
                        onChange={(e) => setItemSelectQty(Math.max(1, Number(e.target.value)))}
                        className="h-9 w-full px-1.5 rounded-lg bg-white text-black text-xs font-semibold focus:outline-none border border-neutral-200 text-center"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddItemToNewSale}
                      className="h-9 w-10 shrink-0 rounded-lg bg-black hover:bg-neutral-800 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer shadow-xs"
                      title="Añadir producto a la venta"
                      aria-label="Añadir producto a la venta"
                    >
                      <span className="material-symbols-outlined text-[20px]">add</span>
                    </button>
                  </div>
                </div>

                {/* Loaded Items Breakdown */}
                <div className="flex flex-col gap-2 mt-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    Prendas en esta Orden ({loadedItems.length}):
                  </span>
                  {loadedItems.length === 0 ? (
                    <div className="p-4 rounded-lg bg-white text-center text-xs text-neutral-400 border border-neutral-200">
                      Aún no has agregado prendas a esta orden.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {loadedItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg bg-white flex items-center justify-between gap-3 shadow-2xs border border-neutral-200"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-[#efeded] flex items-center justify-center text-black">
                              <span className="material-symbols-outlined text-[18px]">checkroom</span>
                            </div>
                            <div>
                              <div className="text-xs font-bold text-black">{item.productName}</div>
                              <div className="text-[11px] text-neutral-500">
                                {item.attributeSummary || [item.color, item.size ? `Talle ${item.size}` : ''].filter(Boolean).join(' · ')} · Cant: <strong>{item.quantity}</strong>
                                {item.unlimited && <span className="ml-1 text-emerald-700 font-semibold">(Stock ilimitado)</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-black">
                              ${item.totalPrice.toLocaleString('es-AR')}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveItemFromNewSale(idx)}
                              className="p-1 rounded text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              title="Quitar prenda"
                            >
                              <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Subtotal & Editable Total */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-neutral-200">
                  <div className="text-xs text-neutral-600">
                    Subtotal calculado: <strong className="text-black font-bold">${subtotalNewSale.toLocaleString('es-AR')}</strong>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-black">Total Acordado ($):</label>
                    <input
                      type="number"
                      value={customTotalInput}
                      onChange={(e) => setCustomTotalInput(e.target.value)}
                      placeholder={String(subtotalNewSale)}
                      className="w-32 h-8 px-2.5 rounded-lg bg-white border border-neutral-300 text-xs font-bold text-black focus:outline-none focus:border-black"
                    />
                  </div>
                </div>
              </div>

              {/* RECUADRO DE REGISTRACIÓN DE PAGOS (Solicitado por el usuario) */}
              <div className="rounded-xl border border-neutral-200 overflow-hidden bg-white">
                <div className="p-3 sm:p-4 bg-[#f5f3f3] border-b border-neutral-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-black">payments</span>
                    <h3 className="text-xs sm:text-sm font-bold text-black">
                      Registrar Cobro Inicial (Opcional si abonan en este momento)
                    </h3>
                  </div>
                  <span className="text-[11px] text-neutral-500">
                    Cobro parcial o total inmediato
                  </span>
                </div>

                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold text-neutral-600">Monto Abonado ($)</label>
                      <input
                        type="number"
                        placeholder="Ej: 5000"
                        value={newSalePaymentAmount}
                        onChange={(e) => setNewSalePaymentAmount(e.target.value)}
                        className="h-9 px-2.5 rounded-lg bg-white border border-neutral-200 text-xs font-bold text-black focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold text-neutral-600">Fecha del Cobro</label>
                      <input
                        type="date"
                        value={newSalePaymentDate}
                        onChange={(e) => setNewSalePaymentDate(e.target.value)}
                        className="h-9 px-2.5 rounded-lg bg-white border border-neutral-200 text-xs text-black focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold text-neutral-600">Medio de Pago</label>
                      <input
                        type="text"
                        placeholder="Ej. Transferencia, Efectivo, Débito"
                        value={newSalePaymentMethod}
                        onChange={(e) => setNewSalePaymentMethod(e.target.value)}
                        className="h-9 px-2.5 rounded-lg bg-white border border-neutral-200 text-xs text-black focus:outline-none"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-neutral-500">
                    Si ingresas un monto, la venta se creará con el pago asentado en su historial contable y el saldo restante se ajustará de forma inmediata.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Action Footer */}
            <div className="px-6 py-4 bg-[#fbf9f8] border-t border-[#efeded] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  resetNewSaleForm();
                  setShowNewSalePanel(false);
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-neutral-200 hover:bg-neutral-300 text-black text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                Cerrar sin Guardar
              </button>

              <button
                type="button"
                onClick={handleConfirmNewSale}
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-black hover:bg-neutral-800 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[17px]">check</span>
                <span>Confirmar Venta y Descontar Stock</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Sales Interactive Table */}
      <div className="w-full bg-white rounded-xl shadow-xs border border-[#efeded] overflow-hidden flex flex-col">
        {/* Sorting & Filter Ribbon */}
        <div className="p-4 bg-[#f5f3f3] border-b border-[#efeded] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">
              Ordenar por:
            </span>
            <button
              onClick={() => setSortBy('date')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                sortBy === 'date'
                  ? 'bg-black text-white'
                  : 'bg-white text-neutral-700 hover:bg-neutral-100 border border-neutral-200'
              }`}
            >
              <span>Fecha de Venta</span>
              <span className="material-symbols-outlined text-[13px]">arrow_downward</span>
            </button>
            <button
              onClick={() => setSortBy('debt')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                sortBy === 'debt'
                  ? 'bg-black text-white'
                  : 'bg-white text-neutral-700 hover:bg-neutral-100 border border-neutral-200'
              }`}
            >
              <span>Quién falta pagar (Mayor deuda)</span>
            </button>
            <button
              onClick={() => setSortBy('total')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                sortBy === 'total'
                  ? 'bg-black text-white'
                  : 'bg-white text-neutral-700 hover:bg-neutral-100 border border-neutral-200'
              }`}
            >
              <span>Monto Total</span>
            </button>
            <button
              onClick={() => setSortBy('paid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                sortBy === 'paid'
                  ? 'bg-black text-white'
                  : 'bg-white text-neutral-700 hover:bg-neutral-100 border border-neutral-200'
              }`}
            >
              <span>Monto ya cobrado</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-2 text-[16px] text-neutral-400">
                search
              </span>
              <input
                type="text"
                placeholder="Buscar cliente o ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-2.5 rounded-lg bg-white border border-neutral-200 text-xs text-black focus:outline-none w-48"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 px-2.5 rounded-lg bg-white border border-neutral-200 text-xs text-black focus:outline-none cursor-pointer"
            >
              <option value="all">Todos los Estados</option>
              <option value="preventa">Consultas / Preventas WhatsApp</option>
              <option value="pendiente_total">Pendiente Total</option>
              <option value="cobro_parcial">Cobro Parcial</option>
              <option value="cobrada_total">Cobrada Total</option>
              <option value="cancelada">Canceladas</option>
            </select>
          </div>
        </div>

        {/* Main Data Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#f5f3f3] text-neutral-500 font-semibold uppercase tracking-wider h-10 border-b border-[#efeded]">
                <th className="px-4 py-2">ID Venta</th>
                <th className="px-4 py-2">Fecha Venta</th>
                <th className="px-4 py-2">Cliente</th>
                <th className="px-4 py-2">Fecha Límite Cobro</th>
                <th className="px-4 py-2">Monto Total</th>
                <th className="px-4 py-2">Total Cobrado</th>
                <th className="px-4 py-2">Saldo Pendiente</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2 text-right">Acciones Operativas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efeded]">
              {filteredSales.map((sale) => {
                const isCancelled = sale.status === 'cancelada';
                const isPendingTotal = sale.status === 'pendiente_total';
                const isPaid = sale.status === 'cobrada_total';
                const isPreventa = sale.status === 'preventa';

                return (
                  <tr
                    key={sale.id}
                    onClick={() => handleOpenSaleModal(sale)}
                    className={`cursor-pointer transition-colors ${
                      isCancelled
                        ? 'bg-neutral-50/60 opacity-60'
                        : isPreventa
                        ? 'bg-indigo-50/20 hover:bg-indigo-50/40'
                        : 'hover:bg-[#fbf9f8]'
                    }`}
                  >
                    <td className="px-4 py-3 font-bold text-black flex items-center gap-1.5">
                      <span>{sale.id}</span>
                      {sale.channel === 'whatsapp' && (
                        <span className="text-[10px] px-1 py-0.2 rounded bg-[#25D366]/20 text-[#1EBE5D] font-bold">WA</span>
                      )}
                      {sale.channel === 'mercadopago' && (
                        <span className="text-[10px] px-1 py-0.2 rounded bg-[#009ee3]/20 text-[#009ee3] font-bold">MP</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-neutral-700 whitespace-nowrap">{formatSaleDateTime(sale.date)}</td>

                    <td className="px-4 py-3">
                      <div className={`font-semibold text-black ${isCancelled ? 'line-through' : ''}`}>
                        {sale.customer}
                      </div>
                      <div className="text-[11px] text-neutral-500">{sale.contactInfo}</div>
                    </td>

                    <td className="px-4 py-3">
                      {isCancelled ? (
                        <span className="text-neutral-400">—</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-neutral-700">
                          <span className="material-symbols-outlined text-[13px] text-neutral-400">
                            event
                          </span>
                          {sale.dueDate}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 font-bold text-black">
                      ${sale.total.toLocaleString('es-AR')}
                    </td>

                    <td className="px-4 py-3 font-semibold text-neutral-800">
                      ${sale.paidTotal.toLocaleString('es-AR')}
                    </td>

                    <td className={`px-4 py-3 font-bold ${sale.pendingBalance > 0 ? 'text-red-600' : 'text-neutral-500'}`}>
                      ${sale.pendingBalance.toLocaleString('es-AR')}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        {sale.paymentAlert && !sale.paymentAlert.dismissed && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-bold animate-pulse">
                            <span>⚠ Revisar pago</span>
                          </span>
                        )}
                        {isPreventa && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-900 text-[10px] font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                          <span>Consulta (Sin stock)</span>
                        </span>
                      )}
                      {isPaid && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          Cobrada Total
                        </span>
                      )}
                      {sale.status === 'cobro_parcial' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                          Cobro Parcial
                        </span>
                      )}
                      {isPendingTotal && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-bold">
                          Pendiente Total
                        </span>
                      )}
                      {isCancelled && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-600 text-[10px] font-medium">
                          Cancelada & Reintegrada
                        </span>
                      )}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isPreventa && onConfirmPreventaSale && (
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              await onConfirmPreventaSale(sale.id);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-indigo-900 hover:bg-black text-white text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                            title="Confirmar Pedido y Descontar Stock"
                          >
                            <span className="material-symbols-outlined text-[13px]">check_circle</span>
                            <span>Confirmar</span>
                          </button>
                        )}

                        {Boolean(sale.customerPhone || (sale.contactInfo && sale.contactInfo.replace(/[^0-9]/g, '').length >= 8)) && (
                          <a
                            href={`https://wa.me/${(sale.customerPhone || sale.contactInfo).replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                              `Hola ${sale.customer || ''}! Te escribimos respecto a tu pedido #${sale.id}. ¿Te gustaría que coordinemos el pago y entrega?`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="Abrir chat de WhatsApp con el cliente"
                          >
                            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.18-2.587-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.007c.106.005.249-.04.39.299.144.347.491 1.2.534 1.288.043.088.072.19.014.305-.058.115-.087.187-.173.289l-.26.305c-.087.087-.179.18-.077.355.101.174.453.748.971 1.21.668.595 1.232.78 1.406.867.174.086.275.072.376-.044.101-.116.433-.506.549-.679.116-.174.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.044.073.044.42-.1 1.825zM12 2C6.477 2 2 6.477 2 12c0 1.891.527 3.662 1.444 5.176L2 22l4.981-1.306C8.424 21.528 10.151 22 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
                            </svg>
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenSaleModal(sale);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#efeded] hover:bg-neutral-200 text-black text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">checkroom</span>
                          <span>Productos ({sale.items.length})</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenSaleModal(sale);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                            sale.pendingBalance > 0
                              ? 'bg-black text-white hover:bg-neutral-800'
                              : 'bg-[#efeded] text-black hover:bg-neutral-200'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {sale.pendingBalance > 0 ? 'payments' : 'receipt_long'}
                          </span>
                          <span>
                            {sale.pendingBalance > 0
                              ? `Cobros ($${Math.round(sale.pendingBalance / 1000)}k)`
                              : 'Ver Cobro'}
                          </span>
                        </button>

                        {!isCancelled ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCancelModalSale(sale);
                            }}
                            className="p-1 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Cancelar Venta y Reponer Stock"
                          >
                            <span className="material-symbols-outlined text-[17px]">cancel</span>
                          </button>
                        ) : (
                          onDeleteSale && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmSale(sale);
                              }}
                              className="p-1 rounded-lg text-neutral-400 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                              title="Eliminar definitivamente venta cancelada"
                            >
                              <span className="material-symbols-outlined text-[17px]">delete_forever</span>
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Info */}
        <div className="p-3 bg-[#f5f3f3] border-t border-[#efeded] flex items-center justify-between text-xs text-neutral-500">
          <span>Mostrando {filteredSales.length} de {sales.length} registros en curso</span>
          <div className="flex items-center gap-1 font-semibold text-black">
            <span className="px-2 py-0.5 rounded bg-white border border-neutral-200">1</span>
          </div>
        </div>
      </div>

      {/* POP-UP MODAL: Detalle, Modificación y Cobros de la Venta */}
      {modalSale && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden my-auto flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-[#f5f3f3] border-b border-[#efeded] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-[22px]">receipt_long</span>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-bold text-black">
                      Venta #{modalSale.id} — {modalSale.customer}
                    </h2>
                    {modalSale.status === 'cobrada_total' && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                        Cobrada Total
                      </span>
                    )}
                    {modalSale.status === 'cobro_parcial' && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold">
                        Cobro Parcial
                      </span>
                    )}
                    {modalSale.status === 'pendiente_total' && (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[11px] font-bold">
                        Pendiente Total
                      </span>
                    )}
                    {modalSale.status === 'cancelada' && (
                      <span className="px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-700 text-[11px] font-semibold">
                        Cancelada & Reintegrada
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500">
                    Fecha: <strong className="text-neutral-800">{formatSaleDateTime(modalSale.date)}</strong> | Vencimiento:{' '}
                    <strong className="text-neutral-800">{modalSale.dueDate}</strong> | Contacto:{' '}
                    <span className="text-neutral-700">{modalSale.contactInfo}</span>
                  </p>

                  {/* Quick Comprobante Actions */}
                  <div className="flex items-center gap-2 flex-wrap pt-2">
                    {Boolean(modalSale.customerEmail || (modalSale.contactInfo && modalSale.contactInfo.includes('@'))) && (
                      <a
                        href={buildEmailReceiptUrl(modalSale)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-900 text-[11px] font-bold transition-colors"
                        title="Enviar comprobante por email usando tu cliente de correo (Gmail, etc.)"
                      >
                        <span className="material-symbols-outlined text-[15px] text-blue-600">mail</span>
                        <span>Enviar Comprobante por Mail</span>
                      </a>
                    )}

                    {Boolean(modalSale.customerPhone || (modalSale.contactInfo && modalSale.contactInfo.replace(/[^0-9]/g, '').length >= 8)) && (
                      <a
                        href={buildWhatsAppReceiptUrl(modalSale)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#25D366]/15 border border-[#25D366]/30 hover:bg-[#25D366]/25 text-[#1EBE5D] text-[11px] font-bold transition-colors"
                        title="Enviar comprobante detallado por WhatsApp"
                      >
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                          <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.18-2.587-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.007c.106.005.249-.04.39.299.144.347.491 1.2.534 1.288.043.088.072.19.014.305-.058.115-.087.187-.173.289l-.26.305c-.087.087-.179.18-.077.355.101.174.453.748.971 1.21.668.595 1.232.78 1.406.867.174.086.275.072.376-.044.101-.116.433-.506.549-.679.116-.174.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.044.073.044.42-.1 1.825zM12 2C6.477 2 2 6.477 2 12c0 1.891.527 3.662 1.444 5.176L2 22l4.981-1.306C8.424 21.528 10.151 22 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
                        </svg>
                        <span>Enviar Comprobante por WhatsApp</span>
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-800 text-[11px] font-semibold transition-colors cursor-pointer"
                      title="Imprimir comprobante o guardar como PDF"
                    >
                      <span className="material-symbols-outlined text-[15px]">print</span>
                      <span>Imprimir / PDF</span>
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalSale(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-500 hover:text-black hover:bg-neutral-200 transition-colors cursor-pointer"
                title="Cerrar sin guardar"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Body: Scrollable */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
              {/* Payment Alert Notice from MP Webhook */}
              {modalSale.paymentAlert && (
                <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
                  modalSale.paymentAlert.dismissed
                    ? 'bg-neutral-50 border-neutral-200 text-neutral-600'
                    : 'bg-amber-50 border-amber-300 text-amber-950'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      modalSale.paymentAlert.dismissed
                        ? 'bg-neutral-200 text-neutral-600'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      <span className="material-symbols-outlined text-[20px]">warning</span>
                    </div>
                    <div>
                      <div className="font-bold text-xs flex items-center gap-2">
                        <span>Aviso de Cobro: {modalSale.paymentAlert.type === 'underpaid' ? 'Pago Parcial' : modalSale.paymentAlert.type === 'overpaid' ? 'Sobrepago' : 'Pago en Venta Cancelada'}</span>
                        {modalSale.paymentAlert.dismissed ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-700 font-semibold">
                            Revisado
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-bold">
                            Pendiente de revisión
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] mt-0.5 leading-relaxed">
                        {modalSale.paymentAlert.message}
                      </p>
                    </div>
                  </div>

                  {!modalSale.paymentAlert.dismissed && onDismissPaymentAlert && (
                    <button
                      type="button"
                      onClick={async () => {
                        await onDismissPaymentAlert(modalSale.id);
                        setModalSale((prev) => prev ? {
                          ...prev,
                          paymentAlert: prev.paymentAlert ? { ...prev.paymentAlert, dismissed: true } : undefined
                        } : null);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shrink-0 transition-colors cursor-pointer shadow-xs"
                    >
                      Marcar como revisado
                    </button>
                  )}
                </div>
              )}

              {/* Preventa Banner (if sale is WhatsApp inquiry without stock discount) */}
              {modalSale.status === 'preventa' && (
                <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[20px]">help_outline</span>
                    </div>
                    <div>
                      <div className="font-bold text-xs text-indigo-950 flex items-center gap-2">
                        <span>Consulta / Preventa por WhatsApp</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-200/80 text-indigo-900 font-bold">
                          Sin stock descontado
                        </span>
                      </div>
                      <p className="text-[11px] text-indigo-800/90 mt-0.5 leading-relaxed">
                        Esta orden no descuenta inventario hasta ser confirmada. Cuando coordines el pago con el cliente, confirmala para descontar el stock del inventario.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {Boolean(modalSale.customerPhone || (modalSale.contactInfo && modalSale.contactInfo.replace(/[^0-9]/g, '').length >= 8)) && (
                      <a
                        href={`https://wa.me/${(modalSale.customerPhone || modalSale.contactInfo).replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                          `Hola ${modalSale.customer || ''}! Te escribimos respecto a tu pedido #${modalSale.id}. ¿Te gustaría que coordinemos el pago y entrega?`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                      >
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                          <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.18-2.587-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.007c.106.005.249-.04.39.299.144.347.491 1.2.534 1.288.043.088.072.19.014.305-.058.115-.087.187-.173.289l-.26.305c-.087.087-.179.18-.077.355.101.174.453.748.971 1.21.668.595 1.232.78 1.406.867.174.086.275.072.376-.044.101-.116.433-.506.549-.679.116-.174.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.044.073.044.42-.1 1.825zM12 2C6.477 2 2 6.477 2 12c0 1.891.527 3.662 1.444 5.176L2 22l4.981-1.306C8.424 21.528 10.151 22 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
                        </svg>
                        <span>Chat WhatsApp</span>
                      </a>
                    )}

                    {onConfirmPreventaSale && (
                      <button
                        type="button"
                        onClick={async () => {
                          await onConfirmPreventaSale(modalSale.id);
                          setModalSuccessMsg('¡Venta confirmada y stock descontado!');
                          setTimeout(() => setModalSuccessMsg(null), 2500);
                        }}
                        className="px-4 py-2 rounded-xl bg-indigo-900 hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        <span>Confirmar y Descontar Stock</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Customer Notes from Catalog Checkout */}
              {Boolean(modalSale.notes?.trim()) && (
                <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-950 flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-amber-600 text-lg shrink-0 mt-0.5">chat</span>
                  <div className="flex-1">
                    <p className="text-[11px] font-bold text-amber-900 uppercase tracking-wider mb-0.5">
                      Mensaje / Nota del Cliente
                    </p>
                    <p className="text-xs sm:text-sm text-neutral-800 whitespace-pre-wrap italic">
                      "{modalSale.notes?.trim()}"
                    </p>
                  </div>
                </div>
              )}

              {/* Financial Balance Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-[#f5f3f3] border border-neutral-200">
                  <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block">
                    Total de la Venta
                  </span>
                  <span className="text-lg font-bold text-black">
                    ${(Number(modalDraftTotal) > 0 ? Number(modalDraftTotal) : modalSale.total).toLocaleString('es-AR')}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200">
                  <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
                    Total Cobrado
                  </span>
                  <span className="text-lg font-bold text-emerald-900">
                    ${modalSale.paidTotal.toLocaleString('es-AR')}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-red-50/60 border border-red-200">
                  <span className="text-[11px] font-semibold text-red-800 uppercase tracking-wider block">
                    Saldo Restante Pendiente
                  </span>
                  <span className="text-lg font-bold text-red-700">
                    ${Math.max(
                      0,
                      (Number(modalDraftTotal) > 0 ? Number(modalDraftTotal) : modalSale.total) - modalSale.paidTotal
                    ).toLocaleString('es-AR')}
                  </span>
                </div>
              </div>

              {/* SECCIÓN 1: Prendas & Productos de la Venta */}
              <div className="rounded-xl border border-neutral-200 overflow-hidden bg-white">
                <div className="p-3 sm:p-4 bg-[#f5f3f3] border-b border-neutral-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-black">checkroom</span>
                    <h3 className="text-xs sm:text-sm font-bold text-black">
                      Prendas en esta Venta ({modalDraftItems.length})
                    </h3>
                  </div>
                  <span className="text-[11px] text-neutral-500">
                    El inventario se sincroniza al guardar cambios
                  </span>
                </div>

                <div className="p-4 space-y-4">
                  {modalDraftItems.length === 0 ? (
                    <div className="p-6 text-center text-xs text-neutral-500">
                      No hay prendas agregadas a esta venta. Agrega al menos una abajo.
                    </div>
                  ) : (
                    <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg overflow-hidden">
                      {modalDraftItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#fbf9f8] transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-11 bg-[#f5f3f3] rounded-lg flex items-center justify-center text-black border border-neutral-200">
                              <span className="material-symbols-outlined text-[18px]">apparel</span>
                            </div>
                            <div>
                              <div className="text-xs font-bold text-black">{item.productName}</div>
                              <div className="text-[11px] text-neutral-500">
                                {item.attributeSummary || [item.color, item.size ? `Talle ${item.size}` : ''].filter(Boolean).join(' · ')} · ${item.unitPrice.toLocaleString('es-AR')} c/u
                                {item.unlimited && <span className="ml-1 text-emerald-700 font-semibold">(Stock ilimitado)</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 self-end sm:self-center">
                            {/* Stepper */}
                            <div className="flex items-center bg-[#f5f3f3] rounded-lg p-0.5 border border-neutral-200">
                              <button
                                type="button"
                                disabled={modalSale.status === 'cancelada'}
                                onClick={() => handleModalUpdateItemQty(idx, -1)}
                                className="w-6 h-6 flex items-center justify-center text-black hover:bg-white rounded text-xs font-bold disabled:opacity-40 cursor-pointer"
                              >
                                -
                              </button>
                              <span className="w-8 text-center text-xs font-bold text-black">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                disabled={modalSale.status === 'cancelada'}
                                onClick={() => handleModalUpdateItemQty(idx, 1)}
                                className="w-6 h-6 flex items-center justify-center text-black hover:bg-white rounded text-xs font-bold disabled:opacity-40 cursor-pointer"
                              >
                                +
                              </button>
                            </div>

                            <span className="text-xs font-bold text-black min-w-[70px] text-right">
                              ${item.totalPrice.toLocaleString('es-AR')}
                            </span>

                            {modalSale.status !== 'cancelada' && (
                              <button
                                type="button"
                                onClick={() => handleModalRemoveItem(idx)}
                                className="p-1 rounded text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                title="Quitar prenda de la venta"
                              >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Agregar nueva prenda a la venta (con combos ordenados alfabéticamente) */}
                  {modalSale.status !== 'cancelada' && (
                    <div className="p-3.5 rounded-xl bg-[#f5f3f3] border border-neutral-200 space-y-3">
                      <span className="text-[11px] font-bold text-black uppercase tracking-wider block">
                        Agregar Prenda Adicional
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2.5 items-end">
                        {/* Categoría Combo (Ordenada Alfabéticamente) */}
                        <div className="flex flex-col gap-1 sm:col-span-2">
                          <label className="text-[10px] font-semibold text-neutral-600">Categoría</label>
                          <select
                            value={modalCategoryFilter}
                            onChange={(e) => {
                              const newCat = e.target.value;
                              setModalCategoryFilter(newCat);
                              const filtered = products
                                .filter((p) => newCat === 'Todas' || p.category.toLowerCase() === newCat.toLowerCase())
                                .sort((a, b) => a.name.localeCompare(b.name));
                              if (filtered.length > 0) {
                                setModalSelectProductId(filtered[0].id);
                                setModalSelectSize(filtered[0].variants[0]?.size || 'U');
                                setModalSelectColor(filtered[0].variants[0]?.color || 'Único');
                              }
                            }}
                            className="h-9 px-2.5 rounded-lg bg-white text-black text-xs border border-neutral-200 focus:outline-none"
                          >
                            <option value="Todas">Todas las categorías</option>
                            {sortedCategories.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Prenda / Modelo Combo (Ordenado Alfabéticamente) */}
                        <div className="flex flex-col gap-1 sm:col-span-2">
                          <label className="text-[10px] font-semibold text-neutral-600">Prenda / Modelo</label>
                          <select
                            value={modalSelectProductId}
                            onChange={(e) => {
                              setModalSelectProductId(e.target.value);
                              const p = products.find((x) => x.id === e.target.value);
                              if (p && p.variants[0]) {
                                setModalSelectSize(p.variants[0].size);
                                setModalSelectColor(p.variants[0].color);
                              }
                            }}
                            className="h-9 px-2.5 rounded-lg bg-white text-black text-xs border border-neutral-200 focus:outline-none"
                          >
                            {availableProductsForModal.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} (${p.price.toLocaleString('es-AR')})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Talle */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-semibold text-neutral-600">Talle</label>
                          <select
                            value={modalSelectSize}
                            onChange={(e) => setModalSelectSize(e.target.value)}
                            className="h-9 px-2 rounded-lg bg-white text-black text-xs border border-neutral-200 focus:outline-none"
                          >
                            {Array.from(new Set(selectedModalProduct?.variants.map((v) => v.size) || ['S', 'M', 'L'])).map(
                              (s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              )
                            )}
                          </select>
                        </div>

                        {/* Color */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-semibold text-neutral-600">Color</label>
                          <select
                            value={modalSelectColor}
                            onChange={(e) => setModalSelectColor(e.target.value)}
                            className="h-9 px-2 rounded-lg bg-white text-black text-xs border border-neutral-200 focus:outline-none"
                          >
                            {Array.from(new Set(selectedModalProduct?.variants.map((v) => v.color) || ['Negro'])).map(
                              (c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              )
                            )}
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] font-semibold text-neutral-600">Cantidad:</label>
                          <input
                            type="number"
                            min="1"
                            value={modalSelectQty}
                            onChange={(e) => setModalSelectQty(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-16 h-8 px-2 rounded-lg bg-white border border-neutral-200 text-xs font-bold text-center text-black"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={handleModalAddItem}
                          title="Añadir producto a la venta"
                          aria-label="Añadir producto a la venta"
                          className="h-8 px-3 rounded-lg bg-black hover:bg-neutral-800 active:scale-95 text-white text-xs font-semibold flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">add</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Subtotal & Total Adjustment */}
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-neutral-200">
                    <div className="text-xs text-neutral-500">
                      Subtotal calculado:{' '}
                      <strong className="text-black">
                        ${modalDraftItems.reduce((acc, it) => acc + it.totalPrice, 0).toLocaleString('es-AR')}
                      </strong>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-neutral-700">Monto Final Acordado ($):</label>
                      <input
                        type="number"
                        value={modalDraftTotal}
                        onChange={(e) => setModalDraftTotal(e.target.value)}
                        className="w-32 h-8 px-2.5 rounded-lg bg-white border border-neutral-300 text-xs font-bold text-black focus:outline-none focus:border-black"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECCIÓN 2: Historial y Registro de Pagos */}
              <div className="rounded-xl border border-neutral-200 overflow-hidden bg-white">
                <div className="p-3 sm:p-4 bg-[#f5f3f3] border-b border-neutral-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-black">payments</span>
                    <h3 className="text-xs sm:text-sm font-bold text-black">
                      Comprobantes y Pagos Registrados ({modalSale.payments.length})
                    </h3>
                  </div>
                  <span className="text-[11px] text-neutral-500">
                    Total Abonado: ${modalSale.paidTotal.toLocaleString('es-AR')}
                  </span>
                </div>

                <div className="p-4 space-y-4">
                  {modalSale.payments.length === 0 ? (
                    <div className="p-4 rounded-lg bg-[#f5f3f3] text-center text-xs text-neutral-500 border border-neutral-200">
                      Aún no se han registrado cobros para esta venta.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {modalSale.payments.map((p, idx) => (
                        <div
                          key={p.id || idx}
                          className="p-3 rounded-lg bg-[#f5f3f3] border border-neutral-200 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="material-symbols-outlined text-[18px] text-emerald-700">
                              check_circle
                            </span>
                            <div>
                              <div className="font-bold text-black">
                                Pago #{idx + 1}: ${p.amount.toLocaleString('es-AR')}
                              </div>
                              <div className="text-[11px] text-neutral-500">
                                {p.date} • {p.method}
                              </div>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            {p.status || 'Confirmado'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Formulario para asentar nuevo pago */}
                  {modalSale.status !== 'cancelada' && modalSale.pendingBalance > 0 && (
                    <div className="p-3.5 rounded-xl bg-[#f5f3f3] border border-neutral-200 space-y-3">
                      <span className="text-[11px] font-bold text-black uppercase tracking-wider block">
                        Registrar Nuevo Cobro
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-semibold text-neutral-600">Monto ($)</label>
                          <input
                            type="number"
                            placeholder={`Max: $${modalSale.pendingBalance}`}
                            value={modalPaymentAmount}
                            onChange={(e) => setModalPaymentAmount(e.target.value)}
                            className="h-9 px-2.5 rounded-lg bg-white border border-neutral-200 text-xs font-bold text-black focus:outline-none"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-semibold text-neutral-600">Fecha del Pago</label>
                          <input
                            type="date"
                            value={modalPaymentDate}
                            onChange={(e) => setModalPaymentDate(e.target.value)}
                            className="h-9 px-2.5 rounded-lg bg-white border border-neutral-200 text-xs text-black focus:outline-none"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-semibold text-neutral-600">Medio de Pago</label>
                          <input
                            type="text"
                            placeholder="Ej. Transferencia, Efectivo, Débito"
                            value={modalPaymentMethod}
                            onChange={(e) => setModalPaymentMethod(e.target.value)}
                            className="h-9 px-2.5 rounded-lg bg-white border border-neutral-200 text-xs text-black focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={handleModalRegisterPayment}
                          className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">payments</span>
                          <span>Registrar Cobro</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Botón de Cancelar Venta / Eliminar si Cancelada */}
              {modalSale.status !== 'cancelada' ? (
                <div className="p-3.5 rounded-xl bg-red-50/60 border border-red-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[20px] text-red-600">warning</span>
                    <span className="text-xs text-neutral-700">
                      ¿Necesitas anular esta orden? El stock se devolverá automáticamente a la tienda.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCancelModalSale(modalSale)}
                    className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">block</span>
                    <span>Cancelar Venta</span>
                  </button>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-neutral-100 border border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[20px] text-neutral-600">cancel</span>
                    <span className="text-xs text-neutral-700">
                      Esta venta está cancelada y el stock fue reintegrado al inventario.
                    </span>
                  </div>
                  {onDeleteSale && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteConfirmSale(modalSale);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">delete_forever</span>
                      <span>Eliminar Definitivamente</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer: LOS DOS BOTONES PEDIDOS POR EL USUARIO */}
            <div className="px-6 py-4 bg-[#fbf9f8] border-t border-[#efeded] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div>
                {modalSuccessMsg && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    {modalSuccessMsg}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setModalSale(null)}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-lg bg-neutral-200 hover:bg-neutral-300 text-black text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cerrar sin Guardar
                </button>

                <button
                  type="button"
                  disabled={modalSaving}
                  onClick={handleSaveModalChanges}
                  className="flex-1 sm:flex-initial px-6 py-2.5 rounded-lg bg-black hover:bg-neutral-800 disabled:opacity-50 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  <span>{modalSaving ? 'Guardando...' : 'Guardar Cambios'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POP-UP CONFIRMATION MODAL: Cancelar Venta */}
      {cancelModalSale && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[28px]">report_problem</span>
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-headline-sm text-base sm:text-lg text-black font-bold">
                  ¿Confirmar Cancelación de Venta?
                </h3>
                <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
                  Venta #{cancelModalSale.id} - {cancelModalSale.customer}
                </span>
                <p className="text-xs text-neutral-600 mt-2 leading-relaxed">
                  Dejará la venta en estado <strong>Cancelada</strong> (sin borrar el historial contable) y{' '}
                  <span className="text-black font-bold">reintegrará automáticamente las unidades al stock</span>{' '}
                  disponible de forma inmediata.
                </p>
              </div>
            </div>

            <div className="p-4 bg-[#f5f3f3] border-t border-[#efeded] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelModalSale(null)}
                className="px-4 py-2 rounded-lg text-black text-xs font-semibold hover:bg-[#efeded] transition-colors"
              >
                Conservar Venta
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onCancelSale(cancelModalSale.id);
                  setCancelModalSale(null);
                }}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">inventory_2</span>
                <span>Sí, Cancelar y Reintegrar Stock</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Stock Warning & Exceeded Confirmation Modal */}
      {stockWarningDialog && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[26px]">warning</span>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-base text-black">Aviso de Stock Insuficiente</h3>
                <p className="text-xs text-neutral-500 mt-0.5">Validación de inventario en venta</p>
              </div>
              <button
                type="button"
                onClick={() => setStockWarningDialog(null)}
                className="w-7 h-7 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-black flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="px-5 pb-5 space-y-3">
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-neutral-800 space-y-2">
                <p>
                  La cantidad solicitada (<strong className="text-amber-900 font-bold">{stockWarningDialog.requestedQty} u.</strong>) supera el stock disponible en sistema (<strong className="text-amber-900 font-bold">{stockWarningDialog.availableStock} u.</strong>) para:
                </p>
                <div className="p-2 bg-white rounded-lg border border-amber-200 font-semibold text-black">
                  {stockWarningDialog.productName} — Color {stockWarningDialog.color} / Talle {stockWarningDialog.size}
                </div>
                <p className="text-[11px] text-neutral-600 leading-relaxed">
                  ¿Deseas agregar esta prenda a la orden de todas formas? Al confirmar la venta, el stock de este artículo se descontará y <strong>quedará en 0 unidades</strong> (nunca en valores negativos).
                </p>
              </div>
            </div>

            <div className="p-4 bg-[#f5f3f3] border-t border-[#efeded] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setStockWarningDialog(null)}
                className="px-4 py-2 rounded-xl text-neutral-700 hover:bg-neutral-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  stockWarningDialog.onConfirm();
                  setStockWarningDialog(null);
                }}
                className="px-5 py-2 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">check</span>
                <span>Aceptar y Añadir Prenda</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM PERMANENT SALE DELETION MODAL */}
      {deleteConfirmSale && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-neutral-200 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-2xl">delete_forever</span>
            </div>
            <h3 className="text-base font-bold text-neutral-900 mb-1">
              ¿Eliminar definitivamente venta #{deleteConfirmSale.id}?
            </h3>
            <p className="text-xs text-neutral-500 mb-5 leading-relaxed">
              Cliente: <strong className="text-neutral-800">{deleteConfirmSale.customer}</strong>. Esta acción removerá el registro de forma permanente del libro de ventas.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteConfirmSale(null)}
                className="px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const s = deleteConfirmSale;
                  setDeleteConfirmSale(null);
                  if (onDeleteSale) {
                    await onDeleteSale(s.id);
                  }
                  if (modalSale?.id === s.id) {
                    setModalSale(null);
                  }
                }}
                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                Eliminar Registro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Botón flotante para Nueva Venta cuando el botón principal no está visible */}
      {!isNewSaleBtnVisible && !showNewSalePanel && (
        <button
          type="button"
          onClick={() => {
            resetNewSaleForm();
            setShowNewSalePanel(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          title="Nueva venta"
          aria-label="Nueva venta"
          className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-40 w-14 h-14 rounded-full bg-black text-white shadow-2xl hover:bg-neutral-800 active:scale-95 transition-all flex items-center justify-center cursor-pointer group hover:ring-4 hover:ring-black/20"
        >
          <span className="material-symbols-outlined text-3xl font-light leading-none group-hover:rotate-90 transition-transform">add</span>
          {/* Tooltip */}
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-neutral-900 text-white text-xs font-semibold rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden sm:block">
            Nueva venta
          </span>
        </button>
      )}
    </div>
  );
};
