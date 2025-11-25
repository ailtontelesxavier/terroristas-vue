import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_URL = 'https://scsanctions.un.org/resources/xml/en/consolidated.xml';

app.get('/api/onu', async (_req, res) => {
  try {
    const response = await fetch(TARGET_URL);
    if (!response.ok) {
      return res.status(502).send('Falha ao buscar lista da ONU.');
    }
    const xml = await response.text();

    res.set("Content-Type", "application/xml");
    res.send(xml);
  } catch (err) {
    console.error('Erro ao proxy a lista da ONU', err);
    res.status(500).send('Erro interno ao buscar lista da ONU.');
  }
});

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

app.listen(8006, () => {
  console.log("App rodando na porta 8006");
});
