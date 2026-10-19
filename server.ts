import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Allow large payloads for base64 image uploads
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Endpoint to analyze product images and extract info using Gemini Flash
app.post('/api/ai/analyze-product', async (req, res) => {
  try {
    const { images, category } = req.body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'Debes enviar al menos una imagen de la prenda.' });
    }

    // Convert each image into an inlineData part for Gemini
    const imageParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];

    for (const img of images) {
      if (typeof img !== 'string') continue;

      if (img.startsWith('data:')) {
        const matches = img.match(/^data:([a-zA-Z0-9/+-]+);base64,(.+)$/s);
        if (matches) {
          imageParts.push({
            inlineData: {
              mimeType: matches[1],
              data: matches[2],
            },
          });
          continue;
        }
      }

      // If it's a URL (Google Drive, Cloud, CDN or web link), fetch and convert to base64
      if (img.startsWith('http://') || img.startsWith('https://')) {
        try {
          const fetchRes = await fetch(img);
          if (fetchRes.ok) {
            const arrayBuffer = await fetchRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const contentType = fetchRes.headers.get('content-type') || 'image/jpeg';
            imageParts.push({
              inlineData: {
                mimeType: contentType.split(';')[0],
                data: buffer.toString('base64'),
              },
            });
            continue;
          }
        } catch (fetchErr) {
          console.warn('Could not fetch image URL directly, attempting fallback:', img, fetchErr);
        }
      }

      // If it's raw base64 string
      imageParts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: img,
        },
      });
    }

    if (imageParts.length === 0) {
      return res.status(400).json({ error: 'No se pudieron procesar las imágenes proporcionadas.' });
    }

    const systemInstruction = `Sos un experto en tiendas de indumentaria y con tan solo recibir una o varias fotos de un producto podes definir los siguientes valores:
- Nombre del producto. Si hay varias fotos de productos aparentemente distintos, pone un titulo sin entrar en cada particularidad, que pueda englobar todo. Ejemplo: si hay varias remeras oversize diferentes con un estampado podes ponerles "Remera oversize estampadas".
- Descripcion del producto. Datos como por ejemplo texturas y generos, para que se puede usar, cortes y tipologias, estampas, etc. Tiene que ser un texto armonioso de no mas de 1 o 2 parrafos, que conecte las distintas caracteristicas. 
- Colores. En caso que sean varias fotos del mismo producto, es posible que venga en distintos colores. Unicamente especificar el color mas determinante por mas que hayan varios en una misma prenda. Si hay 2 fotos de 2 remeras, una es blanca con mangas negras y un estampado, la otra es negra con mangas blancas y un estampado que puede ser diferente, los colores serán de la primera blanco y de la segunda negro.
RESPONDER SOLO ESTOS ITEMS, SIN TEXTO ADICIONAL.`;

    const userPrompt = `Categoría del producto: "${category || 'General'}".
Cantidad de fotos adjuntas: ${imageParts.length}.
Analizá las imágenes y devolvé el nombre del producto, la descripción armoniosa y la lista de colores determinantes con su nombre comercial en español (ej. Negro, Blanco, Beige, Terracota, Verde Oliva) y código hexadecimal (#RRGGBB).`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [...imageParts, { text: userPrompt }],
      },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: {
              type: Type.STRING,
              description: 'Nombre del producto englobando las fotos',
            },
            description: {
              type: Type.STRING,
              description: 'Texto armonioso de no más de 1 o 2 párrafos',
            },
            colors: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: {
                    type: Type.STRING,
                    description: 'Nombre del color más determinante en español',
                  },
                  hex: {
                    type: Type.STRING,
                    description: 'Código hexadecimal (#RRGGBB)',
                  },
                },
                required: ['name', 'hex'],
              },
              description: 'Colores determinantes identificados en las fotos',
            },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Etiquetas de búsqueda sugeridas',
            },
          },
          required: ['name', 'description', 'colors'],
        },
      },
    });

    const outputText = response.text || '{}';
    const parsed = JSON.parse(outputText);
    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/ai/analyze-product:', error);
    return res.status(500).json({
      error: error?.message || 'Error al procesar las imágenes con la IA',
    });
  }
});

// Endpoint to generate marketing copy, slide headlines, and creative direction with Gemini Flash
app.post('/api/ai/generate-marketing-post', async (req, res) => {
  try {
    const { products, format, style, customPrompt, storeName, storeWhatsapp, totalSlides } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Debes seleccionar al menos un producto.' });
    }

    const slideCount = Math.max(1, Math.min(totalSlides || (format === 'carousel' ? 3 : 1), 6));

    const productsSummary = products.map((p: any, i: number) => {
      const colorsList = Array.isArray(p.colors) ? p.colors.join(', ') : '';
      const sizesList = Array.isArray(p.sizes) ? p.sizes.join(', ') : '';
      const priceText = p.price ? `$${Number(p.price).toLocaleString('es-AR')}` : '';
      return `Prenda ${i + 1}: "${p.name}" (${p.category || 'Indumentaria'}). Precio: ${priceText}. Colores: ${colorsList || 'Varios'}. Talles: ${sizesList || 'Varios'}. Descripción: ${p.description || ''}`;
    }).join('\n');

    const styleDescriptions: Record<string, string> = {
      minimal: 'Estilo Editorial Minimalista: Tonos neutros, beige, lino, sombras suaves, sobrio, tipografía limpia, sofisticado y atemporal.',
      studio: 'Estilo Estudio de Fotografía: Iluminación de pasarela, fondo limpio con luz difusa, lookbook de marca prémium, moderno.',
      urban: 'Estilo Streetwear & Urbano: Alto contraste, tipografías audaces en mayúsculas, estética aesthetic moderna, nocturna o de ciudad.',
      brand_flyer: 'Estilo Flyer Comercial de Marca: Destacando nombre de tienda, beneficios de compra (cuotas, envíos), llamado a la acción comercial directo.'
    };

    const formatDescriptions: Record<string, string> = {
      feed_portrait: 'Formato Post Vertical 4:5 (1080x1350 px) - Máxima visibilidad en feed.',
      feed_square: 'Formato Post Cuadrado 1:1 (1080x1080 px) - Clásico para feed.',
      story: 'Formato Historia/Reel 9:16 (1080x1920 px) - Formato vertical inmersivo.',
      carousel: `Formato Carrusel Narrativo (${slideCount} placas continuas con storytelling coherente).`
    };

    const systemInstruction = `Sos un director creativo y copywriter de moda y social media de primer nivel para tiendas de indumentaria en Instagram.
Tu objetivo es crear una propuesta completa de contenido para redes sociales lista para publicar:
1. Copywriting del pie de foto (Caption de Instagram):
   - Hook / Gancho inicial atrapante que frene el scroll.
   - Párrafo fluido destacando el calce, comodidad y estilo de las prendas.
   - Lista clara de talles/colores o combinaciones recomendadas.
   - Llamado a la acción (CTA) claro invitando a escribir por WhatsApp o visitar el link de la tienda.
   - Tono fresco, cálido y vendedor en español (Argentina/Latam).
2. Títulos y subtítulos para cada placa visual (slides):
   - Muy concisos, de alto impacto visual (como en revistas de moda o cuentas top de Instagram).
   - Para carruseles: secuencia narrativa coherente (Slide 1: Hook/Impacto, Slide 2: Detalle/Variantes, Slide 3: Estilo de vida/Ocasión, Slide 4: Cierre/CTA).
3. Hashtags relevantes de moda, indumentaria, looks y shopping.
4. Paleta de colores recomendada para la gráfica según el estilo elegido.`;

    const userPrompt = `Tienda: "${storeName || 'Tienda Oficial'}".
WhatsApp de pedidos: "${storeWhatsapp || 'el enlace de la biografía'}".
Prendas a promocionar:
${productsSummary}

Formato solicitado: ${formatDescriptions[format] || format}.
Estilo visual: ${styleDescriptions[style] || style}.
Cantidad de placas (slides): ${slideCount}.
${customPrompt ? `Idea o indicación especial del comerciante: "${customPrompt}".` : 'Modo Magia: Creá el mejor contenido aplicando tendencias actuales de moda.'}

Generá la respuesta en formato JSON estricto con los textos, pie de foto y placas.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [{ text: userPrompt }],
      },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            headline: {
              type: Type.STRING,
              description: 'Titular principal de alto impacto para la primera placa (ej: NEW DROP, TOTAL LOOK)',
            },
            subheadline: {
              type: Type.STRING,
              description: 'Subtítulo breve para la primera placa',
            },
            callToAction: {
              type: Type.STRING,
              description: 'Texto breve de acción para la placa (ej: Pedí al WhatsApp, Envíos a todo el país)',
            },
            caption: {
              type: Type.STRING,
              description: 'Pie de foto completo para Instagram con hook, texto de moda, emojis y CTA',
            },
            hashtags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Hashtags de moda e indumentaria relevantes',
            },
            slides: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  slideType: {
                    type: Type.STRING,
                    description: 'Tipo de placa: hook, detail, lifestyle o cta',
                  },
                  headline: {
                    type: Type.STRING,
                    description: 'Titular corto para esta placa (1 a 4 palabras)',
                  },
                  subheadline: {
                    type: Type.STRING,
                    description: 'Subtítulo explicativo corto para esta placa',
                  },
                  badge: {
                    type: Type.STRING,
                    description: 'Texto de la insignia o pill (ej: 100% Algodón, 3 Cuotas, Nuevo Ingreso)',
                  },
                },
                required: ['slideType', 'headline', 'subheadline', 'badge'],
              },
              description: `Lista de exactamente ${slideCount} placas para la publicación`,
            },
            colorTheme: {
              type: Type.OBJECT,
              properties: {
                primary: { type: Type.STRING, description: 'Color primario hexadecimal (#RRGGBB)' },
                secondary: { type: Type.STRING, description: 'Color secundario hexadecimal (#RRGGBB)' },
                background: { type: Type.STRING, description: 'Color de fondo hexadecimal (#RRGGBB)' },
                accent: { type: Type.STRING, description: 'Color de acento o badge hexadecimal (#RRGGBB)' },
              },
              required: ['primary', 'secondary', 'background', 'accent'],
            },
          },
          required: ['headline', 'subheadline', 'callToAction', 'caption', 'hashtags', 'slides'],
        },
      },
    });

    const outputText = response.text || '{}';
    const parsed = JSON.parse(outputText);
    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/ai/generate-marketing-post:', error);
    return res.status(500).json({
      error: error?.message || 'Error al generar el contenido de marketing con IA',
    });
  }
});

// Centralized Platform-wide Mercado Pago credentials (managed by SuperAdmin & backed by env vars)
let platformMpConfig = {
  publicKey: process.env.MERCADOPAGO_PUBLIC_KEY || 'APP_USR-5bed7b67-e57e-4f32-92fa-d6555c149928',
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || 'APP_USR-1254765898303511-101901-bf79a18105c13f25b1a0bfb65082e01c-3776798082',
  sandboxMode: true,
  accountNickname: 'Cuenta de Desarrollo (Sandbox)',
  accountEmail: 'yunior@gmail.com',
  lastVerifiedAt: new Date().toISOString(),
};

// Endpoint to get platform Mercado Pago config for SuperAdmin
app.get('/api/platform/mercadopago', (_req, res) => {
  return res.json({
    publicKey: platformMpConfig.publicKey,
    accessToken: platformMpConfig.accessToken,
    accessTokenMasked: platformMpConfig.accessToken
      ? `${platformMpConfig.accessToken.substring(0, 14)}••••••••••••••••`
      : '',
    hasAccessToken: Boolean(platformMpConfig.accessToken),
    sandboxMode: platformMpConfig.sandboxMode,
    accountNickname: platformMpConfig.accountNickname,
    accountEmail: platformMpConfig.accountEmail,
    lastVerifiedAt: platformMpConfig.lastVerifiedAt,
  });
});

// Endpoint for SuperAdmin to update platform Mercado Pago credentials
app.post('/api/platform/mercadopago', async (req, res) => {
  try {
    const { publicKey, accessToken, sandboxMode } = req.body;

    if (typeof publicKey === 'string') {
      platformMpConfig.publicKey = publicKey.trim();
    }

    if (typeof accessToken === 'string' && accessToken.trim()) {
      platformMpConfig.accessToken = accessToken.trim();
    }

    if (typeof sandboxMode === 'boolean') {
      platformMpConfig.sandboxMode = sandboxMode;
    }

    // Attempt to verify with Mercado Pago API if access token is present
    if (platformMpConfig.accessToken) {
      try {
        const mpRes = await fetch('https://api.mercadopago.com/users/me', {
          headers: {
            'Authorization': `Bearer ${platformMpConfig.accessToken}`,
          },
        });
        const data: any = await mpRes.json();
        if (mpRes.ok) {
          platformMpConfig.accountNickname = data.nickname || 'Cuenta Verificada';
          platformMpConfig.accountEmail = data.email || '';
          platformMpConfig.lastVerifiedAt = new Date().toISOString();
        }
      } catch (checkErr) {
        console.warn('Could not verify new credentials with MP API:', checkErr);
      }
    }

    return res.json({
      success: true,
      message: 'Configuración maestra de Mercado Pago actualizada exitosamente.',
      config: {
        publicKey: platformMpConfig.publicKey,
        accessTokenMasked: platformMpConfig.accessToken
          ? `${platformMpConfig.accessToken.substring(0, 14)}••••••••••••••••`
          : '',
        sandboxMode: platformMpConfig.sandboxMode,
        accountNickname: platformMpConfig.accountNickname,
        accountEmail: platformMpConfig.accountEmail,
        lastVerifiedAt: platformMpConfig.lastVerifiedAt,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Error al guardar credenciales de plataforma' });
  }
});

// Endpoint to verify credentials against Mercado Pago API
app.post('/api/mercadopago/verify-credentials', async (req, res) => {
  try {
    const { accessToken } = req.body;
    const token = (accessToken && typeof accessToken === 'string' && accessToken.trim())
      ? accessToken.trim()
      : platformMpConfig.accessToken;

    if (!token) {
      return res.status(400).json({ valid: false, error: 'Debes ingresar un Access Token.' });
    }

    const mpRes = await fetch('https://api.mercadopago.com/users/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data: any = await mpRes.json();

    if (!mpRes.ok) {
      return res.status(mpRes.status).json({
        valid: false,
        error: data.message || `Error de validación Mercado Pago (${mpRes.status})`,
        details: data,
      });
    }

    return res.json({
      valid: true,
      id: data.id,
      nickname: data.nickname || 'Usuario Mercado Pago',
      email: data.email || '',
      siteId: data.site_id || 'MLA',
      countryId: data.country_id || 'AR',
    });
  } catch (error: any) {
    console.error('Error in /api/mercadopago/verify-credentials:', error);
    return res.status(500).json({
      valid: false,
      error: error?.message || 'Error de conexión con los servidores de Mercado Pago',
    });
  }
});

// Endpoint to create a Checkout Pro Preference
app.post('/api/mercadopago/create-preference', async (req, res) => {
  try {
    const {
      items,
      payer,
      externalReference,
      storeSlug,
      storeName,
      accessToken,
      sandboxMode = true,
      backUrls,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'La orden debe contener al menos un producto.' });
    }

    const token = (accessToken && typeof accessToken === 'string' && accessToken.trim())
      ? accessToken.trim()
      : platformMpConfig.accessToken;

    if (!token) {
      return res.status(500).json({ error: 'No se configuró un Access Token de Mercado Pago en la plataforma.' });
    }

    // Determine host URL for return callbacks
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const origin = process.env.APP_URL || `${protocol}://${host}`;

    const storePath = storeSlug ? `/${storeSlug}` : '';
    const defaultSuccessUrl = `${origin}${storePath}?payment_status=approved&ext_ref=${encodeURIComponent(externalReference || '')}`;
    const defaultFailureUrl = `${origin}${storePath}?payment_status=failure&ext_ref=${encodeURIComponent(externalReference || '')}`;
    const defaultPendingUrl = `${origin}${storePath}?payment_status=pending&ext_ref=${encodeURIComponent(externalReference || '')}`;

    const formattedItems = items.map((it: any, index: number) => ({
      id: String(it.id || it.productId || `item-${index + 1}`),
      title: String(it.title || it.name || it.productName || 'Prenda').substring(0, 255),
      description: String(it.description || `${it.productName || 'Prenda'} - Talle ${it.size || 'U'}, ${it.color || 'Único'}`).substring(0, 255),
      quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
      unit_price: Math.max(1, Number(it.price || it.unitPrice || it.unit_price) || 100),
      currency_id: 'ARS',
      picture_url: typeof it.image === 'string' && it.image.startsWith('http') ? it.image : undefined,
    }));

    const preferencePayload: Record<string, any> = {
      items: formattedItems,
      payer: {
        name: payer?.name || 'Cliente',
        surname: payer?.surname || '',
        email: payer?.email || 'comprador.prueba@testuser.com',
        phone: payer?.phone ? { number: String(payer.phone).replace(/[^0-9]/g, '') } : undefined,
      },
      back_urls: {
        success: backUrls?.success || defaultSuccessUrl,
        failure: backUrls?.failure || defaultFailureUrl,
        pending: backUrls?.pending || defaultPendingUrl,
      },
      auto_return: 'approved',
      external_reference: String(externalReference || `order-${Date.now()}`),
      statement_descriptor: (storeName || storeSlug || 'TIENDA').substring(0, 16).toUpperCase(),
      binary_mode: false,
    };

    // Add notification webhook URL if publicly accessible HTTPS origin is available
    if (origin && origin.startsWith('https://')) {
      preferencePayload.notification_url = `${origin}/api/mercadopago/webhook?storeSlug=${encodeURIComponent(storeSlug || '')}`;
    }

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(preferencePayload),
    });

    const data: any = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('Mercado Pago API error response:', data);
      return res.status(mpResponse.status).json({
        error: data.message || 'Error al generar la preferencia en Mercado Pago',
        details: data,
      });
    }

    // Select suitable URL: sandbox_init_point for testing credentials, init_point for production
    const checkoutUrl = (sandboxMode && data.sandbox_init_point)
      ? data.sandbox_init_point
      : data.init_point;

    return res.json({
      id: data.id,
      init_point: data.init_point,
      sandbox_init_point: data.sandbox_init_point,
      checkout_url: checkoutUrl,
      external_reference: preferencePayload.external_reference,
    });
  } catch (error: any) {
    console.error('Error in /api/mercadopago/create-preference:', error);
    return res.status(500).json({
      error: error?.message || 'Error interno al procesar el pago con Mercado Pago',
    });
  }
});

// Mercado Pago Webhook / IPN notification receiver
app.post('/api/mercadopago/webhook', async (req, res) => {
  try {
    const { type, data, action } = req.body || {};
    const queryType = req.query.type || req.query.topic;
    const paymentId = (data && data.id) || req.query.id || req.query['data.id'];
    const storeSlug = req.query.storeSlug || '';

    console.log(`[Mercado Pago Webhook] Received notification: type=${type || queryType}, paymentId=${paymentId}, storeSlug=${storeSlug}, action=${action}`);

    // If payment notification received, query Mercado Pago API to verify payment state
    if (paymentId && platformMpConfig.accessToken) {
      try {
        const mpCheck = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: {
            'Authorization': `Bearer ${platformMpConfig.accessToken}`,
          },
        });
        if (mpCheck.ok) {
          const paymentData: any = await mpCheck.json();
          if (paymentData.status === 'approved' && paymentData.external_reference) {
            const extRef = paymentData.external_reference;
            const targetStore = String(storeSlug || 'apolo').toLowerCase();
            const nowIso = new Date().toISOString();

            // Direct server-to-server sync with Firestore so admin dashboard updates immediately
            const fsProjectId = 'zinc-doodad-wwh4c';
            const fsDbId = 'ai-studio-dee35615-acaf-42d4-984f-7cbc923722c4';
            const fsApiKey = 'AIzaSyDggHizYhtVI5Fb7dbfgnbQr9zBaQ8welU';

            try {
              const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${fsProjectId}/databases/${fsDbId}/documents/stores/${targetStore}/sales/${extRef}?updateMask.fieldPaths=status&updateMask.fieldPaths=paidTotal&updateMask.fieldPaths=pendingBalance&updateMask.fieldPaths=updatedAt&key=${fsApiKey}`;

              const patchRes = await fetch(firestoreUrl, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fields: {
                    status: { stringValue: 'cobrada_total' },
                    paidTotal: { doubleValue: Number(paymentData.transaction_amount) || 0 },
                    pendingBalance: { doubleValue: 0 },
                    updatedAt: { stringValue: nowIso },
                  },
                }),
              });

              if (patchRes.ok) {
                console.log(`[Mercado Pago Webhook] Successfully marked order ${extRef} as 'cobrada_total' in Firestore!`);
              }
            } catch (dbErr) {
              console.warn('[Mercado Pago Webhook] Error updating Firestore sale:', dbErr);
            }
          }
        }
      } catch (checkErr) {
        console.warn('[Mercado Pago Webhook] Error fetching payment info from MP:', checkErr);
      }
    }

    // Mercado Pago expects a 200/201 response immediately
    return res.status(200).json({ status: 'ok', received: true });
  } catch (err: any) {
    console.error('[Mercado Pago Webhook Error]:', err);
    return res.status(200).json({ status: 'error_handled', message: err?.message });
  }
});

app.get('/api/mercadopago/webhook', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'Mercado Pago Webhook Listener' });
});



// Configure Vite middleware in dev or static files in production
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  if (isProduction) {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT} (${isProduction ? 'production' : 'development'})`);
  });
}

startServer();
