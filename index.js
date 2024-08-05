const express = require('express');
const bodyParser = require('body-parser');
const ipinfo = require('ipinfo');
const { GoogleSpreadsheet } = require('google-spreadsheet');

const app = express();
app.use(bodyParser.json());

// Usando variáveis de ambiente para configurar a porta e as credenciais
const PORT = process.env.PORT || 2000;
const IPINFO_TOKEN = process.env.IPINFO_API_KEY;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const GOOGLE_CREDS = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);

// Inicializando a planilha do Google
const doc = new GoogleSpreadsheet(SPREADSHEET_ID);

async function accessSpreadsheet() {
  await doc.useServiceAccountAuth(GOOGLE_CREDS);
  await doc.loadInfo();
}

accessSpreadsheet();

let sessions = {};

// Rota para criar uma nova sessão
app.post('/create-session', (req, res) => {
  const { userAgent, referrer, url, screenResolution, deviceType, loadTime, browser, os } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  ipinfo(ip, IPINFO_TOKEN, (err, cLoc) => {
    if (err) {
      console.error(err);
      res.status(500).send('Error retrieving IP info');
      return;
    }

    const sessionId = Math.random().toString(36).substr(2, 9);
    const sessionData = {
      sessionId,
      ip,
      userAgent,
      referrer,
      url,
      screenResolution,
      deviceType,
      loadTime,
      browser,
      os,
      city: cLoc.city || 'N/A',
      region: cLoc.region || 'N/A',
      country: cLoc.country || 'N/A',
      sessionDuration: 'N/A',
      clickCount: 0,
      pagesVisited: [url]
    };

    sessions[sessionId] = sessionData;
    console.log('Sessão criada e armazenada:', sessionData);
    res.json({ message: 'Sessão criada.', sessionId });
  });
});

// Rota para capturar cliques
app.post('/capture-click', (req, res) => {
  const { sessionId, timestamp } = req.body;

  if (sessions[sessionId]) {
    sessions[sessionId].clickCount += 1;
    sessions[sessionId].timestamp = timestamp;
    console.log('Clique capturado:', timestamp, 'Total de cliques:', sessions[sessionId].clickCount);
    res.json({ message: 'Clique recebido.' });
  } else {
    res.status(404).json({ message: 'Sessão não encontrada.' });
  }
});

// Rota para capturar duração da sessão
app.post('/session-duration', (req, res) => {
  const { sessionId, duration } = req.body;

  if (sessions[sessionId]) {
    sessions[sessionId].sessionDuration = duration;
    console.log('Duração da sessão atualizada:', duration);
    res.json({ message: 'Duração da sessão recebida.' });
  } else {
    res.status(404).json({ message: 'Sessão não encontrada.' });
  }
});

// Rota para capturar visitas de página
app.post('/page-visit', (req, res) => {
  const { sessionId, url } = req.body;

  if (sessions[sessionId]) {
    sessions[sessionId].pagesVisited.push(url);
    console.log('Página visitada:', url);
    res.json({ message: 'Página visitada recebida.' });
  } else {
    res.status(404).json({ message: 'Sessão não encontrada.' });
  }
});

// Função para enviar dados para o Google Sheets
async function sendToGoogleSheets(sessionData) {
  const sheet = doc.sheetsByIndex[0];
  await sheet.addRow({
    'IP Address': sessionData.ip,
    'User Agent': sessionData.userAgent,
    'Browser': sessionData.browser,
    'Operating System': sessionData.os,
    'Referrer': sessionData.referrer,
    'URL': sessionData.url,
    'Timestamp': sessionData.timestamp,
    'Screen Resolution': sessionData.screenResolution,
    'Device Type': sessionData.deviceType,
    'City': sessionData.city,
    'Region': sessionData.region,
    'Country': sessionData.country,
    'Load Time': sessionData.loadTime,
    'Session Duration': sessionData.sessionDuration,
    'Click Count': sessionData.clickCount
  });
  console.log('Dados enviados para o Google Sheets:', sessionData);
}

// Enviar dados de sessão para o Google Sheets ao encerrar a sessão
app.post('/end-session', (req, res) => {
  const { sessionId } = req.body;

  if (sessions[sessionId]) {
    sendToGoogleSheets(sessions[sessionId]);
    delete sessions[sessionId];
    res.json({ message: 'Sessão encerrada e dados enviados para o Google Sheets.' });
  } else {
    res.status(404).json({ message: 'Sessão não encontrada.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
