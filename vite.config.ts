import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'dynamic-store-seo',
        transformIndexHtml(html, ctx) {
          const url = ctx.originalUrl || ctx.path || '';
          const cleanPath = url.replace(/^\/+|\/+$/g, '').split('?')[0];
          const parts = cleanPath.split('/');
          const slug = parts[0]?.toLowerCase() || '';

          if (slug && slug !== 'superadmin' && slug !== 'index.html') {
            const storeName = slug.charAt(0).toUpperCase() + slug.slice(1);
            const title = `${storeName} - Catálogo & Tienda Online Oficial`;
            const desc = `Mirá todos los productos disponibles en ${storeName} y realizá tu pedido directo por WhatsApp.`;
            return html
              .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
              .replace(/property="og:title" content=".*?"/, `property="og:title" content="${title}"`)
              .replace(/property="og:description" content=".*?"/, `property="og:description" content="${desc}"`)
              .replace(/property="og:site_name" content=".*?"/, `property="og:site_name" content="${storeName}"`)
              .replace(/name="twitter:title" content=".*?"/, `name="twitter:title" content="${title}"`)
              .replace(/name="twitter:description" content=".*?"/, `name="twitter:description" content="${desc}"`)
              .replace(/name="description" content=".*?"/, `name="description" content="${desc}"`);
          }
          return html;
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
