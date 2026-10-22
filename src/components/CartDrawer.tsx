import React, { useState } from 'react';
import { CartItem, Product, StoreSettings, StoreFeatureFlags } from '../types';

interface CartDrawerProps {
  isOpen?: boolean;
  isSlideOver?: boolean;
  onClose?: () => void;
  cart: CartItem[];
  products?: Product[];
  onUpdateQuantity: (index: number, delta: number) => void;
  onRemoveItem: (index: number) => void;
  onClearCart: () => void;
  settings: StoreSettings;
  featureFlags?: StoreFeatureFlags;
  storeSlug?: string;
  onRecordSale?: (saleData: any) => Promise<any>;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isSlideOver = false,
  onClose,
  cart,
  products = [],
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  settings,
  featureFlags,
  storeSlug = '',
  onRecordSale
}) => {
  const totalItemsCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const isMpConnected = Boolean(settings.mercadoPago?.connected && (settings.mercadoPago?.accessToken || settings.mercadoPago?.accountEmail || settings.mercadoPago?.accountNickname));
  const isMpEnabled = (featureFlags?.mercadoPagoCheckout !== false) && isMpConnected && (settings.mercadoPago?.enabled !== false);
  const isWaEnabled = featureFlags?.whatsappCheckout !== false;

  // Selected payment method
  const [selectedMethod, setSelectedMethod] = useState<'mercadopago' | 'whatsapp'>(() => {
    return isMpEnabled ? 'mercadopago' : 'whatsapp';
  });

  // Customer form for checkout
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [formErrors, setFormErrors] = useState<{ name?: string; email?: string; phone?: string }>({});

  // Loading state for Mercado Pago preference creation
  const [isProcessingMp, setIsProcessingMp] = useState(false);
  const [mpError, setMpError] = useState<string | null>(null);

  // Helper to validate common customer fields
  const validateCustomerFields = (): boolean => {
    const errors: { name?: string; email?: string; phone?: string } = {};
    if (!customerName.trim()) {
      errors.name = 'El nombre y apellido son obligatorios.';
    }
    const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
    if (!customerPhone.trim()) {
      errors.phone = 'El teléfono / WhatsApp es obligatorio.';
    } else if (cleanPhone.length < 8) {
      errors.phone = 'Ingresa un teléfono válido (al menos 8 dígitos con código de área).';
    }
    if (!customerEmail.trim()) {
      errors.email = 'El email es obligatorio para el envío del comprobante.';
    } else if (!customerEmail.includes('@') || !customerEmail.includes('.')) {
      errors.email = 'Ingresa un correo electrónico válido (ej: nombre@gmail.com).';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return false;
    }
    setFormErrors({});
    return true;
  };

  // Helper to get max available stock for a cart item
  const getItemMaxStock = (item: CartItem): number => {
    const prod = products.find((p) => p.id === item.productId);
    if (!prod) return 999;
    const variant = prod.variants.find(
      (v) =>
        (v.id && v.id === item.variantId) ||
        (v.color.toLowerCase() === item.color.toLowerCase() &&
          v.size.toLowerCase() === item.size.toLowerCase())
    );
    return variant ? Math.max(0, Number(variant.stock || 0)) : 999;
  };

  // Build WhatsApp text link with customer details
  const buildWhatsAppUrl = () => {
    const phone = settings.whatsappNumber ? settings.whatsappNumber.replace(/[^0-9]/g, '') : '5491155556789';
    let text = `Hola ${settings.storeName || 'Atelier Studio'}! Quiero coordinar el siguiente pedido:\n\n`;
    
    if (customerName.trim()) {
      text += `👤 *Cliente:* ${customerName.trim()}\n`;
    }
    if (customerPhone.trim()) {
      text += `📱 *Teléfono:* ${customerPhone.trim()}\n`;
    }
    if (customerEmail.trim()) {
      text += `✉️ *Email:* ${customerEmail.trim()}\n`;
    }
    if (customerName.trim() || customerPhone.trim() || customerEmail.trim()) {
      text += `\n`;
    }

    cart.forEach((item) => {
      text += `• ${item.quantity}x ${item.productName} (Talle ${item.size}, ${item.color}) = $${(item.price * item.quantity).toLocaleString('es-AR')}\n`;
    });
    text += `\n*Total Estimado:* $${subtotal.toLocaleString('es-AR')}`;
    text += `\n\n¡Aguardo su confirmación para coordinar el pago y entrega!`;

    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  // WhatsApp checkout execution (Records as "preventa" without discounting stock)
  const handleWhatsAppCheckout = async () => {
    if (cart.length === 0) return;

    // Validate mandatory customer details
    if (!validateCustomerFields()) {
      return;
    }

    // Check stock availability
    for (const item of cart) {
      const maxStock = getItemMaxStock(item);
      if (item.quantity > maxStock) {
        alert(
          `No hay suficiente stock para "${item.productName} (${item.color} - Talle ${item.size})". Disponibles: ${maxStock} unidades.`
        );
        return;
      }
    }

    const orderRef = `CONS-${Date.now().toString().slice(-6)}`;

    // Record in local sales ledger as "preventa" (stock is NOT discounted)
    if (onRecordSale) {
      try {
        await onRecordSale({
          id: orderRef,
          date: new Date().toISOString().slice(0, 10),
          customer: customerName.trim() || 'Consulta WhatsApp',
          contactInfo: `${customerPhone.trim() ? `Tel: ${customerPhone.trim()}` : 'WhatsApp'}${customerEmail.trim() ? ` • ${customerEmail.trim()}` : ''}`,
          customerEmail: customerEmail.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          items: cart.map((it) => ({
            productId: it.productId,
            productName: it.productName,
            variantId: it.variantId,
            size: it.size,
            color: it.color,
            quantity: it.quantity,
            unitPrice: it.price,
            totalPrice: it.price * it.quantity
          })),
          subtotal,
          total: subtotal,
          paidTotal: 0,
          pendingBalance: subtotal,
          status: 'preventa',
          stockDiscounted: false,
          channel: 'whatsapp',
          payments: []
        });
      } catch (recordErr) {
        console.warn('Could not record WhatsApp preventa sale:', recordErr);
      }
    }

    window.open(buildWhatsAppUrl(), '_blank');
    onClearCart();
    if (onClose) {
      setTimeout(() => onClose(), 300);
    }
  };

  // Mercado Pago checkout execution
  const handleMercadoPagoCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setMpError(null);

    // Validate mandatory customer details
    if (!validateCustomerFields()) {
      return;
    }

    // Check stock availability
    for (const item of cart) {
      const maxStock = getItemMaxStock(item);
      if (item.quantity > maxStock) {
        alert(
          `No hay suficiente stock para "${item.productName} (${item.color} - Talle ${item.size})". Disponibles: ${maxStock} unidades.`
        );
        return;
      }
    }

    setIsProcessingMp(true);

    try {
      const orderRef = `PED-${Date.now().toString().slice(-6)}`;

      // Record in sales ledger as pending MP sale
      if (onRecordSale) {
        try {
          await onRecordSale({
            id: orderRef,
            date: new Date().toISOString().slice(0, 10),
            customer: customerName.trim(),
            contactInfo: `${customerEmail.trim()}${customerPhone.trim() ? ` • Tel: ${customerPhone.trim()}` : ''}`,
            customerEmail: customerEmail.trim(),
            customerPhone: customerPhone.trim() || undefined,
            dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
            items: cart.map((it) => ({
              productId: it.productId,
              productName: it.productName,
              variantId: it.variantId,
              size: it.size,
              color: it.color,
              quantity: it.quantity,
              unitPrice: it.price,
              totalPrice: it.price * it.quantity
            })),
            subtotal,
            total: subtotal,
            paidTotal: 0,
            pendingBalance: subtotal,
            status: 'pendiente_total',
            stockDiscounted: true,
            channel: 'mercadopago',
            payments: []
          });
        } catch (recordErr) {
          console.warn('Could not record pending sale prior to redirect:', recordErr);
        }
      }

      // Call backend to create Checkout Pro preference
      const mpConfig = settings.mercadoPago;
      const res = await fetch('/api/mercadopago/create-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map((it) => ({
            id: it.productId,
            title: `${it.productName} (${it.color} / Talle ${it.size})`,
            quantity: it.quantity,
            price: it.price,
            image: it.image
          })),
          payer: {
            name: customerName.trim(),
            email: customerEmail.trim(),
            phone: customerPhone.trim() || undefined
          },
          externalReference: orderRef,
          storeSlug: storeSlug || 'tienda',
          storeName: settings.storeName || 'Tienda',
          accessToken: mpConfig?.accessToken || undefined,
          sandboxMode: Boolean(mpConfig?.sandboxMode)
        })
      });

      const data = await res.json();

      if (!res.ok || !data.checkout_url) {
        throw new Error(data.error || 'No se pudo generar la pasarela de pago de Mercado Pago.');
      }

      // NOTE: We do NOT clear the cart before redirecting!
      // The cart is kept in localStorage so that if the customer clicks "Volver a la tienda" or fails,
      // they can retry without losing their selected items.
      // App.tsx clears the cart upon receiving an "approved" redirect from Mercado Pago.

      // Redirect customer to Mercado Pago Checkout
      window.location.href = data.checkout_url;
    } catch (err: any) {
      console.error('Error during Mercado Pago checkout:', err);
      setMpError(err.message || 'Error al conectar con Mercado Pago. Puedes intentar por WhatsApp.');
      setIsProcessingMp(false);
    }
  };

  const content = (
    <div className="bg-white rounded-2xl shadow-xl flex flex-col h-full border border-[#efeded] overflow-hidden">
      {/* Drawer Header */}
      <div className="p-4 sm:p-5 flex items-center justify-between border-b border-[#efeded] bg-white shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#f5f3f3] flex items-center justify-center text-black">
            <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
          </div>
          <div>
            <h2 className="font-bold text-base text-black leading-tight">Tu Carrito</h2>
            <span className="text-xs text-neutral-500">
              {totalItemsCount} {totalItemsCount === 1 ? 'prenda' : 'prendas seleccionadas'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {cart.length > 0 && (
            <button
              type="button"
              onClick={onClearCart}
              className="text-xs font-semibold text-neutral-500 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
            >
              Vaciar
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center transition-colors cursor-pointer"
              title="Cerrar carrito"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Items Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-16 text-center text-neutral-400">
            <div className="w-16 h-16 rounded-2xl bg-[#f5f3f3] flex items-center justify-center mb-3 text-neutral-400">
              <span className="material-symbols-outlined text-[32px]">shopping_bag</span>
            </div>
            <p className="font-bold text-black text-sm">Tu carrito está vacío</p>
            <p className="text-xs text-neutral-500 mt-1 max-w-[240px]">
              Explora nuestro catálogo y agrega tus prendas preferidas.
            </p>
          </div>
        ) : (
          cart.map((item, idx) => {
            const maxStock = getItemMaxStock(item);
            const isMax = item.quantity >= maxStock;

            return (
              <div
                key={`${item.productId}-${item.variantId}-${idx}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-[#fbf9f8] hover:bg-[#f5f3f3] transition-colors border border-neutral-200/80"
              >
                {/* Thumbnail */}
                <div className="w-16 h-20 bg-neutral-200 rounded-lg overflow-hidden shrink-0 relative flex items-center justify-center">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.productName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-[24px] text-neutral-400">
                      checkroom
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-black truncate leading-tight">
                    {item.productName}
                  </h4>
                  <div className="flex items-center gap-1.5 text-[11px] text-neutral-600 mt-1 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-white border border-neutral-200 font-medium">
                      Talle {item.size}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-white border border-neutral-200 font-medium">
                      {item.color}
                    </span>
                    <span className={`text-[10px] ${isMax ? 'text-amber-700 font-semibold' : 'text-neutral-400'}`}>
                      (Disp: {maxStock} u.)
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-2.5">
                    {/* Stepper */}
                    <div className="flex items-center bg-white border border-neutral-200 rounded-lg p-0.5 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(idx, -1)}
                        className="w-6 h-6 flex items-center justify-center text-black text-xs hover:bg-neutral-100 rounded-md transition-colors font-bold cursor-pointer"
                        title="Restar cantidad"
                      >
                        -
                      </button>
                      <span className="px-2.5 text-xs font-bold text-black min-w-[20px] text-center">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        disabled={isMax}
                        onClick={() => {
                          if (!isMax) onUpdateQuantity(idx, 1);
                        }}
                        className={`w-6 h-6 flex items-center justify-center text-xs rounded-md transition-colors font-bold ${
                          isMax
                            ? 'text-neutral-300 cursor-not-allowed'
                            : 'text-black hover:bg-neutral-100 cursor-pointer'
                        }`}
                        title={isMax ? `Stock máximo (${maxStock} u.) alcanzado` : 'Sumar cantidad'}
                      >
                        +
                      </button>
                    </div>

                    {/* Price */}
                    <div className="text-right">
                      <span className="text-xs sm:text-sm font-bold text-black block">
                        ${(item.price * item.quantity).toLocaleString('es-AR')}
                      </span>
                      {item.quantity > 1 && (
                        <span className="text-[10px] text-neutral-400 block">
                          ${item.price.toLocaleString('es-AR')} c/u
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => onRemoveItem(idx)}
                  className="w-7 h-7 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-600 flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-1"
                  title="Eliminar producto"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Checkout Calculation Deck */}
      {cart.length > 0 && (
        <div className="p-4 sm:p-5 bg-[#fbf9f8] border-t border-[#efeded] shrink-0 space-y-3.5 max-h-[58vh] overflow-y-auto">
          {/* Subtotal summary */}
          <div className="space-y-1.5 text-xs text-neutral-600">
            <div className="flex items-center justify-between">
              <span>Subtotal ({totalItemsCount} prendas):</span>
              <span className="text-black font-semibold">${subtotal.toLocaleString('es-AR')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Envío / Retiro:</span>
              <span className="px-2 py-0.5 rounded bg-neutral-200 text-neutral-700 text-[10px] font-semibold">
                A coordinar con la tienda
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-neutral-200">
              <span className="text-sm font-bold text-black">Total a Pagar</span>
              <span className="text-xl font-extrabold text-black tracking-tight font-mono">
                ${subtotal.toLocaleString('es-AR')}
              </span>
            </div>
          </div>

          {/* Contact Information (Always present and required for both WhatsApp & Mercado Pago) */}
          <div className="space-y-2 pt-2 border-t border-neutral-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-neutral-600">person</span>
                Tus Datos de Contacto <span className="text-red-500">*</span>
              </span>
              <span className="text-[10px] text-neutral-500 font-medium">
                Obligatorios para tu pedido
              </span>
            </div>

            <div className="space-y-1.5">
              <div>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  placeholder="Nombre y Apellido *"
                  className={`w-full px-3 py-2 text-xs rounded-xl border bg-white focus:outline-none focus:ring-2 ${
                    selectedMethod === 'mercadopago' ? 'focus:ring-[#009ee3]' : 'focus:ring-[#25D366]'
                  } ${formErrors.name ? 'border-red-400 bg-red-50/30' : 'border-neutral-300'}`}
                />
                {formErrors.name && (
                  <span className="text-[10px] text-red-600 block mt-0.5">{formErrors.name}</span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <div>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => {
                      setCustomerPhone(e.target.value);
                      if (formErrors.phone) setFormErrors((prev) => ({ ...prev, phone: undefined }));
                    }}
                    placeholder="WhatsApp / Celular *"
                    className={`w-full px-3 py-2 text-xs rounded-xl border bg-white focus:outline-none focus:ring-2 ${
                      selectedMethod === 'mercadopago' ? 'focus:ring-[#009ee3]' : 'focus:ring-[#25D366]'
                    } ${formErrors.phone ? 'border-red-400 bg-red-50/30' : 'border-neutral-300'}`}
                  />
                  {formErrors.phone && (
                    <span className="text-[10px] text-red-600 block mt-0.5">{formErrors.phone}</span>
                  )}
                </div>

                <div>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => {
                      setCustomerEmail(e.target.value);
                      if (formErrors.email) setFormErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    placeholder="Email (para comprobante) *"
                    className={`w-full px-3 py-2 text-xs rounded-xl border bg-white focus:outline-none focus:ring-2 ${
                      selectedMethod === 'mercadopago' ? 'focus:ring-[#009ee3]' : 'focus:ring-[#25D366]'
                    } ${formErrors.email ? 'border-red-400 bg-red-50/30' : 'border-neutral-300'}`}
                  />
                  {formErrors.email && (
                    <span className="text-[10px] text-red-600 block mt-0.5">{formErrors.email}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Payment Method Selector if both or at least one is enabled */}
          {isMpEnabled && isWaEnabled && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
                Selecciona forma de pago:
              </span>
              <div className="grid grid-cols-2 gap-2">
                {/* Option 1: Mercado Pago */}
                <button
                  type="button"
                  onClick={() => setSelectedMethod('mercadopago')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    selectedMethod === 'mercadopago'
                      ? 'border-[#009ee3] bg-[#009ee3]/10 text-neutral-900 ring-2 ring-[#009ee3]/30 shadow-2xs'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#009ee3]" />
                    <span className="font-bold text-xs text-[#009ee3]">Mercado Pago</span>
                  </div>
                  <span className="text-[10px] text-neutral-500 mt-1">
                    Tarjetas, Débito o Saldo MP
                  </span>
                </button>

                {/* Option 2: WhatsApp */}
                <button
                  type="button"
                  onClick={() => setSelectedMethod('whatsapp')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    selectedMethod === 'whatsapp'
                      ? 'border-[#25D366] bg-[#25D366]/10 text-neutral-900 ring-2 ring-[#25D366]/30 shadow-2xs'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#25D366]" />
                    <span className="font-bold text-xs text-[#1EBE5D]">WhatsApp</span>
                  </div>
                  <span className="text-[10px] text-neutral-500 mt-1">
                    Efectivo o Transferencia
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* ACTION BUTTON: MERCADO PAGO */}
          {selectedMethod === 'mercadopago' && isMpEnabled && (
            <div className="space-y-2 pt-1">
              {settings.mercadoPago?.sandboxMode && (
                <div className="px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span>🧪</span>
                    <span>Modo Pruebas (Sandbox)</span>
                  </span>
                  <span className="text-[10px] bg-white px-1.5 py-0.5 rounded border border-indigo-200">
                    Tarjetas demo
                  </span>
                </div>
              )}

              {mpError && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-[11px] flex items-start gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-red-600 shrink-0 mt-0.5">error</span>
                  <span>{mpError}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleMercadoPagoCheckout}
                disabled={isProcessingMp}
                className="w-full py-3.5 px-4 rounded-xl bg-[#009ee3] hover:bg-[#0082ba] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60"
              >
                {isProcessingMp ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Conectando con Mercado Pago...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">credit_card</span>
                    <span>Pagar con Mercado Pago • ${subtotal.toLocaleString('es-AR')}</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[10px] text-neutral-400 pt-0.5">
                <span className="material-symbols-outlined text-[12px] text-emerald-600">lock</span>
                <span>Procesado por Checkout Pro oficial de Mercado Pago</span>
              </div>
            </div>
          )}

          {/* ACTION BUTTON: WHATSAPP DIRECT ORDER */}
          {(selectedMethod === 'whatsapp' || !isMpEnabled) && isWaEnabled && (
            <div className="pt-1 space-y-2">
              <button
                type="button"
                onClick={handleWhatsAppCheckout}
                className="w-full py-3.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.18-2.587-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.007c.106.005.249-.04.39.299.144.347.491 1.2.534 1.288.043.088.072.19.014.305-.058.115-.087.187-.173.289l-.26.305c-.087.087-.179.18-.077.355.101.174.453.748.971 1.21.668.595 1.232.78 1.406.867.174.086.275.072.376-.044.101-.116.433-.506.549-.679.116-.174.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.044.073.044.42-.1 1.825zM12 2C6.477 2 2 6.477 2 12c0 1.891.527 3.662 1.444 5.176L2 22l4.981-1.306C8.424 21.528 10.151 22 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
                </svg>
                <span>Finalizar Pedido por WhatsApp</span>
              </button>
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-neutral-500">
                <span className="material-symbols-outlined text-[14px] text-emerald-600">verified</span>
                <span>Trato directo • Se registra consulta sin reservar stock</span>
              </div>
            </div>
          )}

          {/* Fallback if both checkouts are disabled */}
          {!isMpEnabled && !isWaEnabled && (
            <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-900 text-xs flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px] text-amber-600 shrink-0">shopping_bag</span>
              <div>
                <p className="font-bold text-[11px]">Compras online momentáneamente pausadas</p>
                <p className="text-[11px] text-amber-800/90 mt-0.5 leading-relaxed">
                  Esta tienda está en modo catálogo. Puedes contactar directamente al comercio para consultar disponibilidad.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (isSlideOver) {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-xs flex justify-end">
        <div
          className="fixed inset-0"
          onClick={onClose}
        />
        <div className="relative w-full max-w-md h-full bg-white shadow-2xl z-10 flex flex-col">
          {content}
        </div>
      </div>
    );
  }

  return content;
};
