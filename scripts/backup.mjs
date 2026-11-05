import { openStore } from '../lib/store.mjs';
import { saveDailyBackup, loadDailyBackup } from '../lib/backup.mjs';

const [action = 'save', day = new Date().toISOString().slice(0, 10), confirm] = process.argv.slice(2);
const store = await openStore();
try {
  if (action === 'save') console.log(await saveDailyBackup(store, day));
  else if (action === 'restore' && confirm === '--replace') console.log(await loadDailyBackup(store, day));
  else throw new Error('Uso: node scripts/backup.mjs save [AAAA-MM-DD] | restore AAAA-MM-DD --replace. La restauración reemplaza los datos y cierra las sesiones.');
} finally { await store.close(); }
