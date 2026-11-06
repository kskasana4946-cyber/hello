import { defineConfig, Plugin } from 'vite';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function glslShaderPlugin(): Plugin {
  return {
    name: 'apex-glsl-raw-loader',
    enforce: 'pre',
    transform(code: string, id: string) {
      const cleanId = id.split('?')[0];
      if (
        cleanId.endsWith('.glsl') ||
        cleanId.endsWith('.wgsl') ||
        cleanId.endsWith('.vert') ||
        cleanId.endsWith('.frag')
      ) {
        return {
          code: `export default ${JSON.stringify(code)};`,
          map: null,
        };
      }
      return null;
    },
  };
}

export function pakStaticServerPlugin(): Plugin {
  const servePakMiddleware = (req: any, res: any, next: () => void) => {
    const urlStr: string = req.url || '';
    if (!urlStr.startsWith('/assets/paks/')) {
      return next();
    }
    const relPath = decodeURIComponent(urlStr.split('?')[0].replace(/^\//, ''));
    const absPath = path.resolve(process.cwd(), relPath);
    if (!absPath.startsWith(path.resolve(process.cwd(), 'assets/paks'))) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }
    if (!fs.existsSync(absPath) || fs.statSync(absPath).isDirectory()) {
      return next();
    }
    const stat = fs.statSync(absPath);
    const rangeHeader = req.headers?.range;
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader(
      'Content-Type',
      absPath.endsWith('.json') ? 'application/json' : 'application/octet-stream'
    );
    if (rangeHeader && typeof rangeHeader === 'string' && rangeHeader.startsWith('bytes=')) {
      const [startStr, endStr] = rangeHeader.replace('bytes=', '').split('-');
      const start = parseInt(startStr, 10) || 0;
      const end = endStr ? Math.min(parseInt(endStr, 10), stat.size - 1) : stat.size - 1;
      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      res.setHeader('Content-Length', String(end - start + 1));
      fs.createReadStream(absPath, { start, end }).pipe(res);
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Length', String(stat.size));
    fs.createReadStream(absPath).pipe(res);
  };

  return {
    name: 'apex-pak-static-server',
    configureServer(server) {
      server.middlewares.use(servePakMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(servePakMiddleware);
    },
  };
}

const indexHtmlPath = path.resolve(__dirname, 'index.html');
const hasIndexHtml = fs.existsSync(indexHtmlPath);

export default defineConfig({
  plugins: [glslShaderPlugin(), pakStaticServerPlugin()],
  assetsInclude: ['**/*.pak', '**/*.hdr', '**/*.glb', '**/*.wasm'],
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 8000,
    rollupOptions: {
      preserveEntrySignatures: 'exports-only',
      input: hasIndexHtml
        ? indexHtmlPath
        : {
            core: path.resolve(__dirname, 'src/core/UncappedRenderer.ts'),
            streaming: path.resolve(__dirname, 'src/streaming/PakStreamer.ts'),
            physics: path.resolve(__dirname, 'src/physics/RapierVehicleWorld.ts'),
          },
    },
  },
  worker: {
    format: 'es',
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
});
