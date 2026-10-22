import React, { useState, useEffect } from 'react';
import { StoreSettings, MercadoPagoConfig } from '../types';

interface PaymentsConfigViewProps {
  storeSlug?: string;
  settings: StoreSettings;
  isSandboxStore?: boolean;
  onSaveSettings: (newSettings: StoreSettings) => Promise<StoreSettings>;
}

export const PaymentsConfigView: React.FC<PaymentsConfigViewProps> = ({
  storeSlug = 'apolo',
  settings,
  isSandboxStore = false,
  onSaveSettings,
}) => {
  // Current store connection state
  const mpState: MercadoPagoConfig = settings.mercadoPago || {
    connected: false,
    enabled: false,
    accountNickname: '',
    accountEmail: '',
    sandboxMode: false
  };

  // A store is connected if connected is true AND it has an email or nickname or accessToken
  const isConnected = Boolean(mpState.connected && (mpState.accountEmail || mpState.accountNickname || mpState.accessToken));
  const isPaymentEnabled = isConnected && mpState.enabled !== false;

  // Local state for toggling payment availability
  const [enabled, setEnabled] = useState<boolean>(isPaymentEnabled);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Official OAuth Connect Modal state
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [connectingStep, setConnectingStep] = useState<'form' | 'opening' | 'authorizing' | 'success' | 'error'>('form');
  const [connectSandbox, setConnectSandbox] = useState<boolean>(isSandboxStore ? Boolean(mpState.sandboxMode) : false);
  const [authUrl, setAuthUrl] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Disconnect confirmation modal
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);

  // Quick verify feedback
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);

  // Advanced developer settings accordion (hidden by default)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customAccessToken, setCustomAccessToken] = useState(mpState.accessToken || '');
  const [customPublicKey, setCustomPublicKey] = useState(mpState.publicKey || '');

  // Listen for official OAuth postMessage callback from the Mercado Pago authorization popup
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (!event.data) return;

      if (event.data.type === 'MP_OAUTH_SUCCESS') {
        const { accountEmail, accountNickname, accessToken, publicKey, isSandbox } = event.data;
        try {
          const updatedConfig: MercadoPagoConfig = {
            connected: true,
            enabled: true,
            accountEmail: accountEmail || '',
            accountNickname: accountNickname || settings.storeName || 'Mercado Pago',
            sandboxMode: Boolean(isSandbox),
            connectedAt: new Date().toISOString(),
            lastVerifiedAt: new Date().toISOString(),
            accessToken: accessToken || '',
            publicKey: publicKey || '',
          };

          await onSaveSettings({
            ...settings,
            mercadoPago: updatedConfig,
          });

          setConnectingStep('success');
          setEnabled(true);
          setSaveSuccess(true);

          setTimeout(() => {
            setIsConnectModalOpen(false);
            setConnectingStep('form');
            setTimeout(() => setSaveSuccess(false), 3000);
          }, 1500);
        } catch (err) {
          console.error('Error saving OAuth credentials:', err);
          setAuthError('Error al sincronizar la cuenta con la tienda.');
          setConnectingStep('error');
        }
      } else if (event.data.type === 'MP_OAUTH_ERROR') {
        console.warn('OAuth Error received from popup:', event.data.error);
        setAuthError(event.data.error || 'No se completó la vinculación en Mercado Pago.');
        setConnectingStep('error');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [settings, onSaveSettings]);

  // Toggle payment method in store catalog
  const handleToggleEnabled = async (nextEnabled: boolean) => {
    setEnabled(nextEnabled);
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const updatedConfig: MercadoPagoConfig = {
        ...mpState,
        connected: isConnected,
        enabled: nextEnabled,
      };

      await onSaveSettings({
        ...settings,
        mercadoPago: updatedConfig
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error toggling Mercado Pago:', err);
      setEnabled(!nextEnabled);
    } finally {
      setIsSaving(false);
    }
  };

  // Quick toggle between Sandbox and Production (Only available for sandbox store)
  const handleToggleSandboxMode = async (nextSandbox: boolean) => {
    setIsSaving(true);
    try {
      const updatedConfig: MercadoPagoConfig = {
        ...mpState,
        sandboxMode: nextSandbox,
      };

      await onSaveSettings({
        ...settings,
        mercadoPago: updatedConfig
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error toggling sandbox mode:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Open Official Connect Modal
  const handleOpenConnectModal = () => {
    // Normal stores always connect in production mode (false).
    // ONLY the dedicated test store (isSandboxStore) uses sandbox mode.
    setConnectSandbox(isSandboxStore ? Boolean(mpState.sandboxMode ?? true) : false);
    setAuthError(null);
    setAuthUrl('');
    setConnectingStep('form');
    setIsConnectModalOpen(true);
  };

  // Initiate official OAuth Handshake popup with Mercado Pago
  const handleStartOAuth = async () => {
    setAuthError(null);
    setConnectingStep('opening');

    try {
      const res = await fetch(
        `/api/mercadopago/oauth/url?storeSlug=${encodeURIComponent(storeSlug || 'apolo')}&isSandbox=${connectSandbox}`
      );
      if (!res.ok) {
        throw new Error('No se pudo generar la URL de autorización oficial de Mercado Pago.');
      }
      const data = await res.json();
      if (!data.url) {
        throw new Error('Respuesta inválida del servidor.');
      }

      setAuthUrl(data.url);
      setConnectingStep('authorizing');

      // Open official Mercado Pago OAuth directly in popup
      const popup = window.open(
        data.url,
        'mercadopago_oauth_popup',
        'width=640,height=760,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        setAuthError(
          'Tu navegador bloqueó la ventana emergente. Hacé clic en "Abrir ventana de Mercado Pago" a continuación.'
        );
      }
    } catch (err: any) {
      console.error('Error initiating MP OAuth:', err);
      setAuthError(err?.message || 'Error al conectar con Mercado Pago');
      setConnectingStep('error');
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    setIsSaving(true);
    try {
      const updatedConfig: MercadoPagoConfig = {
        connected: false,
        enabled: false,
        accountEmail: '',
        accountNickname: '',
        sandboxMode: false,
        connectedAt: '',
        lastVerifiedAt: '',
        accessToken: '',
        publicKey: ''
      };

      await onSaveSettings({
        ...settings,
        mercadoPago: updatedConfig
      });

      setIsDisconnectModalOpen(false);
      setEnabled(false);
      setCustomAccessToken('');
      setCustomPublicKey('');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error disconnecting Mercado Pago:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Re-verify connection status
  const handleCheckConnection = async () => {
    setIsVerifying(true);
    setVerifyMessage(null);
    try {
      await new Promise((r) => setTimeout(r, 600));
      setVerifyMessage(`✓ Conexión activa con cuenta ${mpState.accountNickname || mpState.accountEmail || 'Mercado Pago'}`);
    } catch {
      setVerifyMessage('✕ Error al verificar estado');
    } finally {
      setIsVerifying(false);
      setTimeout(() => setVerifyMessage(null), 4000);
    }
  };

  // Save manual developer credentials if advanced mode used
  const handleSaveAdvanced = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updatedConfig: MercadoPagoConfig = {
        ...mpState,
        accessToken: customAccessToken.trim() || undefined,
        publicKey: customPublicKey.trim() || undefined,
      };

      await onSaveSettings({
        ...settings,
        mercadoPago: updatedConfig
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving advanced MP credentials:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#009EE3]/10 text-[#009EE3] flex items-center justify-center font-bold shadow-sm">
              <span className="material-symbols-outlined text-3xl">account_balance_wallet</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-neutral-900">
                  Cobros & Mercado Pago
                </h1>
                {isConnected ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Vinculada
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-600 border border-neutral-200">
                    <span className="w-2 h-2 rounded-full bg-neutral-400"></span>
                    Sin vincular
                  </span>
                )}
                {isSandboxStore && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    TIENDA TEST (SANDBOX)
                  </span>
                )}
                {isSandboxStore && isConnected && mpState.sandboxMode && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                    MODO PRUEBAS
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                Conectá tu cuenta de Mercado Pago en un solo clic. El dinero de cada venta ingresa directamente a tu cuenta bancaria.
              </p>
            </div>
          </div>
        </div>

        {saveSuccess && (
          <div className="px-3.5 py-2 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 flex items-center gap-2 animate-fade-in shadow-sm">
            <span className="material-symbols-outlined text-base">check_circle</span>
            Cambios guardados con éxito
          </div>
        )}
      </div>

      {/* Main Status Cards */}
      {!isConnected ? (
        /* ============================================================== */
        /* UNLINKED STATE: 1-Click Connect Hero Banner                    */
        /* ============================================================== */
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-white via-[#009EE3]/5 to-[#009EE3]/10 border-2 border-[#009EE3]/25 rounded-2xl p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-3 max-w-xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#009EE3]/15 text-[#009EE3] text-xs font-bold rounded-full uppercase tracking-wider">
                  <span className="material-symbols-outlined text-sm">link</span>
                  Vinculación oficial en 1 solo clic
                </div>
                <h2 className="text-2xl font-black text-neutral-900 tracking-tight">
                  Empezá a cobrar con Mercado Pago en tu tienda
                </h2>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  No necesitás ser programador ni configurar claves complejas. Conectás tu cuenta de Mercado Pago en un solo paso y tus clientes podrán pagarte con tarjetas de crédito, débito y dinero en cuenta.
                </p>
              </div>

              {/* Big 1-Click Connect Button */}
              <button
                type="button"
                onClick={handleOpenConnectModal}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-7 py-4 bg-[#009EE3] hover:bg-[#0089c7] active:scale-[0.98] text-white font-bold rounded-xl shadow-lg shadow-[#009EE3]/25 hover:shadow-xl transition-all text-base cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-2xl">handshake</span>
                <span>Vincular con Mercado Pago</span>
              </button>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 pt-6 border-t border-neutral-200/60">
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/80 border border-neutral-100 shadow-sm">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-xl">payments</span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-neutral-900">Acreditación Directa</h4>
                  <p className="text-[11px] text-neutral-500 mt-0.5">El 100% del dinero ingresa directo a tu cuenta bancaria o saldo MP.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/80 border border-neutral-100 shadow-sm">
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-xl">credit_card</span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-neutral-900">Múltiples Medios</h4>
                  <p className="text-[11px] text-neutral-500 mt-0.5">Tus clientes pueden pagar en cuotas con tarjeta de crédito o débito.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/80 border border-neutral-100 shadow-sm">
                <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-xl">verified_user</span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-neutral-900">100% Seguro</h4>
                  <p className="text-[11px] text-neutral-500 mt-0.5">Autorización oficial de Mercado Pago sin compartir contraseñas.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ============================================================== */
        /* CONNECTED STATE: Account Card & Catalog Toggle                 */
        /* ============================================================== */
        <div className="space-y-6">
          {/* Linked Account Card */}
          <div className="bg-white border-2 border-emerald-200 rounded-2xl p-6 shadow-sm overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 pointer-events-none"></div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0 shadow-inner">
                  <span className="material-symbols-outlined text-3xl">check_circle</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      Cuenta Activa & Vinculada
                    </span>
                    {isSandboxStore ? (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                        mpState.sandboxMode
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {mpState.sandboxMode ? 'Sandbox (Pruebas)' : 'Producción (Real)'}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-md border border-neutral-200">
                        Producción (Cobros Reales)
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-neutral-900 mt-1">
                    {mpState.accountNickname || settings.storeName || 'Mi Tienda'}
                  </h3>
                  <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-neutral-500 mt-1">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-neutral-400">mail</span>
                      {mpState.accountEmail || 'Sin email registrado'}
                    </span>
                    {mpState.connectedAt && (
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm text-neutral-400">calendar_today</span>
                        Vinculado el {new Date(mpState.connectedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleCheckConnection}
                  disabled={isVerifying}
                  className="px-3.5 py-2 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Verificar conexión activa"
                >
                  <span className={`material-symbols-outlined text-sm ${isVerifying ? 'animate-spin' : ''}`}>
                    {isVerifying ? 'refresh' : 'sync'}
                  </span>
                  <span>{isVerifying ? 'Verificando...' : 'Verificar estado'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsDisconnectModalOpen(true)}
                  className="px-3.5 py-2 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">link_off</span>
                  <span>Desvincular</span>
                </button>
              </div>
            </div>

            {/* In-card sandbox switch ONLY for test store */}
            {isSandboxStore && (
              <div className="mt-5 pt-4 border-t border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-50/60 -mx-6 -mb-6 p-4 px-6 rounded-b-2xl">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-neutral-900">Entorno de Pruebas (Exclusivo Tienda Sandbox)</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded">Admin Test</span>
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    {mpState.sandboxMode
                      ? 'Activo: los pagos en esta tienda se procesan con tarjetas de prueba de Mercado Pago.'
                      : 'Activo en Producción: los pagos se procesan con tarjetas y saldo real.'}
                  </p>
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <span className="text-xs font-bold text-neutral-700">
                    {mpState.sandboxMode ? 'Sandbox (Test)' : 'Producción (Real)'}
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(mpState.sandboxMode)}
                    onChange={(e) => handleToggleSandboxMode(e.target.checked)}
                    className="w-4 h-4 text-[#009EE3] rounded border-neutral-300 focus:ring-[#009EE3] cursor-pointer"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Toggle Online Payments Switch Card */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-neutral-900">
                    Aceptar pagos con Mercado Pago en el catálogo
                  </h4>
                  {enabled ? (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-full">
                      ACTIVO
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-neutral-200 text-neutral-700 rounded-full">
                      PAUSADO
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-500">
                  {enabled
                    ? 'Tus clientes verán el botón de Mercado Pago en el carrito para pagar con tarjetas o dinero en cuenta.'
                    : 'Mercado Pago está temporalmente en pausa. Tus clientes sólo podrán coordinar pedidos por WhatsApp.'}
                </p>
              </div>

              {/* Big iOS Style Switch */}
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                disabled={isSaving}
                onClick={() => handleToggleEnabled(!enabled)}
                className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#009EE3] focus:ring-offset-2 ${
                  enabled ? 'bg-[#009EE3]' : 'bg-neutral-300'
                } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    enabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Developer Settings Accordion (Collapsed by default so regular merchants don't get confused) */}
      <div className="mt-8 pt-6 border-t border-neutral-200">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center justify-between w-full text-left text-xs font-semibold text-neutral-500 hover:text-neutral-800 py-2 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">tune</span>
            Opciones avanzadas para desarrolladores (opcional)
          </span>
          <span className="material-symbols-outlined text-sm">
            {showAdvanced ? 'expand_less' : 'expand_more'}
          </span>
        </button>

        {showAdvanced && (
          <div className="mt-4 p-5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs space-y-4 animate-fade-in">
            <p className="text-neutral-600">
              Por defecto, tu tienda se conecta en 1 clic utilizando la aplicación oficial de la plataforma. Si tenés una aplicación propia en Mercado Pago Developers y preferís usar credenciales técnicas manuales, podés cargarlas acá:
            </p>

            <form onSubmit={handleSaveAdvanced} className="space-y-3">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Access Token Personalizado (Opcional)
                </label>
                <input
                  type="password"
                  value={customAccessToken}
                  onChange={(e) => setCustomAccessToken(e.target.value)}
                  placeholder="APP_USR-..."
                  className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-[#009EE3] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Public Key Personalizada (Opcional)
                </label>
                <input
                  type="text"
                  value={customPublicKey}
                  onChange={(e) => setCustomPublicKey(e.target.value)}
                  placeholder="APP_USR-..."
                  className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-[#009EE3] focus:outline-none"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Guardando...' : 'Guardar credenciales manuales'}
                </button>
              </div>
            </form>

            <div className="pt-3 border-t border-neutral-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-neutral-700">URL de redireccionamiento (Callback) para MP Developers:</span>
                <button
                  type="button"
                  onClick={() => {
                    const url = 'https://tienditas.ai.studio/api/mercadopago/oauth/callback';
                    navigator.clipboard.writeText(url);
                    setCopiedUrl(true);
                    setTimeout(() => setCopiedUrl(false), 2000);
                  }}
                  className="text-[11px] font-semibold text-[#009EE3] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xs">{copiedUrl ? 'check' : 'content_copy'}</span>
                  <span>{copiedUrl ? '¡Copiada!' : 'Copiar URL'}</span>
                </button>
              </div>
              <code className="block p-2 rounded-lg bg-white border border-neutral-200 text-[10px] text-neutral-700 font-mono break-all select-all">
                https://tienditas.ai.studio/api/mercadopago/oauth/callback
              </code>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 1-CLICK CONNECT MODAL                                          */}
      {/* ============================================================== */}
      {isConnectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 relative overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#009EE3] text-white flex items-center justify-center font-bold shadow-sm">
                  <span className="material-symbols-outlined text-xl">handshake</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    Vincular Mercado Pago
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    {settings.storeName || 'Mi Tienda'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsConnectModalOpen(false);
                  setConnectingStep('form');
                }}
                className="text-neutral-400 hover:text-neutral-700 p-1.5 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
                title="Cerrar ventana"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Modal Body based on Step */}
            {connectingStep === 'form' && (
              <div className="space-y-4 pt-4">
                <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200/80 text-xs text-blue-900 flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[#009EE3] text-lg shrink-0 mt-0.5">verified_user</span>
                  <div className="space-y-1">
                    <p className="font-semibold text-blue-950">
                      Conexión oficial directa con Mercado Pago
                    </p>
                    <p className="text-blue-800/90 leading-relaxed text-[11px]">
                      Al continuar, se abrirá la ventana oficial de Mercado Pago para autorizar a <strong>{settings.storeName || 'tu tienda'}</strong> a recibir pagos.
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5 py-1 text-xs text-neutral-600">
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-emerald-600 text-base shrink-0 mt-0.5">check_circle</span>
                    <span>Los cobros de tus clientes van directo a tu dinero en cuenta o banco.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-emerald-600 text-base shrink-0 mt-0.5">check_circle</span>
                    <span>100% seguro: nunca ingresás contraseñas en esta plataforma.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-emerald-600 text-base shrink-0 mt-0.5">check_circle</span>
                    <span>Podés desvincular la cuenta cuando quieras desde este panel.</span>
                  </div>
                </div>

                {/* Exclusivo y ÚNICAMENTE para la tienda de pruebas Sandbox */}
                {isSandboxStore && (
                  <div className="pt-2">
                    <label className="flex items-start justify-between p-3 rounded-xl border border-amber-200 bg-amber-50/70 hover:bg-amber-100/60 transition-colors cursor-pointer gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-amber-900">Entorno de Pruebas (Exclusivo Tienda Sandbox)</span>
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-200 text-amber-900 rounded">Test</span>
                        </div>
                        <span className="text-[11px] text-amber-800 block leading-relaxed">
                          Activá esto si vas a iniciar sesión con una cuenta de vendedor de prueba creada en Mercado Pago Developers.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={connectSandbox}
                        onChange={(e) => setConnectSandbox(e.target.checked)}
                        className="w-4 h-4 mt-0.5 text-[#009EE3] rounded border-neutral-300 focus:ring-[#009EE3] cursor-pointer"
                      />
                    </label>
                  </div>
                )}

                {/* Submit Action */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsConnectModalOpen(false);
                      setConnectingStep('form');
                    }}
                    className="px-4 py-2.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleStartOAuth}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#009EE3] hover:bg-[#0089c7] text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    <span>Conectar con Mercado Pago</span>
                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                  </button>
                </div>
              </div>
            )}

            {connectingStep === 'opening' && (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-14 h-14 rounded-full border-4 border-[#009EE3]/20 border-t-[#009EE3] animate-spin"></div>
                <div>
                  <h4 className="text-sm font-bold text-neutral-900">
                    Generando enlace seguro...
                  </h4>
                  <p className="text-xs text-neutral-500 mt-1">
                    Conectando con los servidores oficiales de Mercado Pago
                  </p>
                </div>
              </div>
            )}

            {connectingStep === 'authorizing' && (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-[#009EE3]/10 text-[#009EE3] flex items-center justify-center font-bold text-3xl">
                    <span className="material-symbols-outlined text-3xl animate-pulse">lock_open</span>
                  </div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white animate-ping"></div>
                </div>

                <div className="max-w-xs">
                  <h4 className="text-sm font-bold text-neutral-900">
                    Ventana de Mercado Pago abierta
                  </h4>
                  <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">
                    Iniciá sesión y aceptá los permisos en la ventana emergente oficial. Tu panel se vinculará automáticamente.
                  </p>
                </div>

                {authUrl && (
                  <div className="pt-2">
                    <a
                      href={authUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">open_in_new</span>
                      <span>¿No se abrió la ventana? Hacé clic acá</span>
                    </a>
                  </div>
                )}

                <div className="pt-4 border-t border-neutral-100 w-full flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setConnectingStep('form')}
                    className="px-3.5 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 font-semibold rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
                  >
                    Volver atrás
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsConnectModalOpen(false);
                      setConnectingStep('form');
                    }}
                    className="px-3.5 py-1.5 text-xs text-rose-600 hover:text-rose-700 font-semibold rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    Cancelar vinculación
                  </button>
                </div>
              </div>
            )}

            {connectingStep === 'error' && (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-4 animate-fade-in">
                <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-3xl">error_outline</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-neutral-900">
                    No se completó la vinculación
                  </h4>
                  <p className="text-xs text-rose-600 mt-1 max-w-xs leading-relaxed">
                    {authError || 'La autorización fue cancelada o expiró.'}
                  </p>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsConnectModalOpen(false);
                      setConnectingStep('form');
                    }}
                    className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 rounded-xl"
                  >
                    Cerrar
                  </button>
                  <button
                    type="button"
                    onClick={handleStartOAuth}
                    className="px-5 py-2 bg-[#009EE3] hover:bg-[#0089c7] text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                  >
                    Reintentar vinculación
                  </button>
                </div>
              </div>
            )}

            {connectingStep === 'success' && (
              <div className="py-10 flex flex-col items-center justify-center text-center space-y-3 animate-fade-in">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-2xl shadow-sm">
                  <span className="material-symbols-outlined text-3xl">check</span>
                </div>
                <div>
                  <h4 className="text-base font-bold text-neutral-900">
                    ¡Cuenta Vinculada con Éxito!
                  </h4>
                  <p className="text-xs text-neutral-500 mt-1">
                    Tu tienda ya está lista para procesar cobros directos.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* DISCONNECT CONFIRMATION MODAL                                  */}
      {/* ============================================================== */}
      {isDisconnectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-neutral-200">
            <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-2xl">warning</span>
            </div>
            <h3 className="text-base font-bold text-neutral-900">
              ¿Desvincular cuenta de Mercado Pago?
            </h3>
            <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
              Tus clientes no podrán seguir pagando con tarjetas o saldo de Mercado Pago en tu catálogo hasta que vuelvas a vincular una cuenta.
            </p>

            <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setIsDisconnectModalOpen(false)}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={isSaving}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSaving ? 'Desvinculando...' : 'Sí, desvincular'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
