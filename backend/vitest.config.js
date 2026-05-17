import { defineConfig } from 'vitest/config';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';

export default defineConfig({
  plugins: [
    {
      name: 'txt-loader',
      resolveId(source, importer) {
        if (source.endsWith('.txt') && importer) {
          return resolve(dirname(importer), source);
        }
      },
      load(id) {
        if (id.endsWith('.txt')) {
          return `export default ${JSON.stringify(readFileSync(id, 'utf-8'))}`;
        }
      },
    },
  ],
});
