const express = require('express');
const bodyParser = require('body-parser');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const ipinfo = require('ipinfo');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(cors());  // Adiciona o middleware de CORS

const creds = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
const ipinfoApiKey = process.env.IPINFO_API_KEY;
const spreadsheetId = process.env.SPREADSHEET_ID;

const doc = new GoogleSpreadsheet(spreadsheetId);

async function accessSpreadsheet() {
  await doc.useServiceAccountAuth(creds);
  await doc.loadInfo();
}

accessSpreadsheet().catch(console.error);

app.post('/create-session', async (req, res) => {
  const { userAgent, referrer, url } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  ipinfo(ip, ipinfoApiKey, async (err, cLoc) => {
    if (err) {
      console.log(err);
      res.status(500).send({ message: 'Erro ao obter geolocalização' });
    } else {
      const sessionData = {
        userAgent,
        referrer,
        url,
        ip,
        city: cLoc.city || 'N/A',
        region: cLoc.region || 'N/A',
        country: cLoc.country || 'N/A',
        browser: userAgent.split(' ')[userAgent.split(' ').length - 1],
        os: userAgent.split(' ')[0],
        sessionId: Math.random().toString(36).substr(2, 9),
        sessionDuration: 'N/A',
        clickCount: 0,
        pagesVisited: [url]
      };

      const sheet = doc.sheetsByIndex[0];
      await sheet.addRow(sessionData);

      res.status(200).send({ message: 'Sessão criada.', sessionId: sessionData.sessionId });
    }
  });
});

app.post('/capture-click', async (req, res) => {
  const { sessionId, timestamp } = req.body;

  const rows = await doc.sheetsByIndex[0].getRows();
  const sessionRow = rows.find(row => row.sessionId === sessionId);

  if (sessionRow) {
    sessionRow.clickCount = parseInt(sessionRow.clickCount) + 1;
    sessionRow.timestamp = timestamp;
    await sessionRow.save();
    res.status(200).send({ message: 'Clique recebido.' });
  } else {
    res.status(404).send({ message: 'Sessão não encontrada.' });
  }
});

app.post('/session-duration', async (req, res) => {
  const { sessionId, duration } = req.body;

  const rows = await doc.sheetsByIndex[0].getRows();
  const sessionRow = rows.find(row => row.sessionId === sessionId);

  if (sessionRow) {
    sessionRow.sessionDuration = duration;
    await sessionRow.save();
    res.status(200).send({ message: 'Duração da sessão recebida.' });
  } else {
    res.status(404).send({ message: 'Sessão não encontrada.' });
  }
});

app.post('/page-visit', async (req, res) => {
  const { sessionId, url } = req.body;

  const rows = await doc.sheetsByIndex[0].getRows();
  const sessionRow = rows.find(row => row.sessionId === sessionId);

  if (sessionRow) {
    sessionRow.pagesVisited.push(url);
    await sessionRow.save();
    res.status(200).send({ message: 'Página visitada recebida.' });
  } else {
    res.status(404).send({ message: 'Sessão não encontrada.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
