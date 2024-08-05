const express = require('express');
const bodyParser = require('body-parser');
const geoip = require('geoip-lite');
const ipinfo = require('ipinfo');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const creds = require('./monitoramento-de-cliques-be2c74e295f7.json');

const app = express();
app.use(bodyParser.json());

const doc = new GoogleSpreadsheet('1xhmVOg-xucjDNt-8nRlIPWpOt-GnVGCTjHoLi43BC74');

async function accessSpreadsheet() {
  await doc.useServiceAccountAuth(creds);
  await doc.loadInfo();
}

accessSpreadsheet();

let sessions = {};

app.post('/create-session', (req, res) => {
  const { userAgent, referrer, url, screenResolution, deviceType, loadTime, browser, os } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const geo = geoip.lookup(ip);

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
    city: geo ? geo.city : 'N/A',
    region: geo ? geo.region : 'N/A',
    country: geo ? geo.country : 'N/A',
    sessionDuration: 'N/A',
    clickCount: 0,
    pagesVisited: [url]
  };

  sessions[sessionId] = sessionData;

  res.json({ sessionId });
});

app.post('/page-visit', (req, res) => {
  const { sessionId, url } = req.body;
  if (sessions[sessionId]) {
    sessions[sessionId].pagesVisited.push(url);
    res.json({ message: 'Página visitada recebida.' });
  } else {
    res.json({ message: 'Sessão não encontrada.' });
  }
});

app.post('/capture-click', (req, res) => {
  const { sessionId, timestamp } = req.body;
  if (sessions[sessionId]) {
    sessions[sessionId].clickCount += 1;
    sessions[sessionId].timestamp = timestamp;
    res.json({ message: 'Clique recebido.' });
  } else {
    res.json({ message: 'Sessão não encontrada.' });
  }
});

app.post('/session-duration', (req, res) => {
  const { sessionId, duration } = req.body;
  if (sessions[sessionId]) {
    sessions[sessionId].sessionDuration = duration;
    res.json({ message: 'Duração da sessão recebida.' });
  } else {
    res.json({ message: 'Sessão não encontrada.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
