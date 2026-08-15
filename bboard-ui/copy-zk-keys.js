import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const destKeysDir = path.resolve(__dirname, 'public/keys');
const destZkirDir = path.resolve(__dirname, 'public/zkir');

console.log('Copying ZK keys and zkir compilation artifacts...');
console.log(`Dest Keys: ${destKeysDir}`);
console.log(`Dest ZKIR: ${destZkirDir}`);

try {
  // Ensure dest dirs exist
  fs.mkdirSync(destKeysDir, { recursive: true });
  fs.mkdirSync(destZkirDir, { recursive: true });

  const contracts = [
    { name: 'BBoard', path: 'bboard' },
    { name: 'Splits', path: 'splits' }
  ];

  for (const contract of contracts) {
    const srcKeysDir = path.resolve(__dirname, `../contract/src/managed/${contract.path}/keys`);
    const srcZkirDir = path.resolve(__dirname, `../contract/src/managed/${contract.path}/zkir`);

    if (fs.existsSync(srcKeysDir)) {
      const keys = fs.readdirSync(srcKeysDir);
      for (const key of keys) {
        const srcPath = path.join(srcKeysDir, key);
        const destPathWithPrefix = path.join(destKeysDir, `${contract.name}#${key}`);
        const destPathPlain = path.join(destKeysDir, key);
        
        fs.copyFileSync(srcPath, destPathWithPrefix);
        fs.copyFileSync(srcPath, destPathPlain);
      }
      console.log(`Successfully copied ${contract.name} keys.`);
    }

    if (fs.existsSync(srcZkirDir)) {
      const zkirFiles = fs.readdirSync(srcZkirDir);
      for (const file of zkirFiles) {
        const srcPath = path.join(srcZkirDir, file);
        const destPathWithPrefix = path.join(destZkirDir, `${contract.name}#${file}`);
        const destPathPlain = path.join(destZkirDir, file);
        
        fs.copyFileSync(srcPath, destPathWithPrefix);
        fs.copyFileSync(srcPath, destPathPlain);
      }
      console.log(`Successfully copied ${contract.name} ZKIR.`);
    }
  }

  console.log('Successfully completed ZK artifacts copying and mapping.');
} catch (error) {
  console.error('Failed to copy ZK artifacts:', error);
  process.exit(1);
}
