const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const geoip = require('geoip-lite');
const axios = require('axios');
const { google } = require('googleapis');
const keys = require('./monitoramento-de-cliques-be2c74e295f7.json');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// Configuração da API do Google Sheets
const client = new google.auth.JWT(
    keys.client_email,
    null,
    keys.private_key,
    ['https://www.googleapis.com/auth/spreadsheets']
);
const spreadsheetId = '1xhmVOg-xucjDNt-8nRlIPWpOt-GnVGCTjHoLi43BC74';

async function writeToSheet(data) {
    try {
        const gsapi = google.sheets({ version: 'v4', auth: client });
        const updateOptions = {
            spreadsheetId,
            range: 'Sheet1!A1',
            valueInputOption: 'USER_ENTERED',
            resource: { values: [data] },
        };
        let response = await gsapi.spreadsheets.values.append(updateOptions);
        console.log('Dados enviados para o Google Sheets:', response.data);
    } catch (error) {
        console.log('Erro ao escrever no Google Sheets:', error.message);
    }
}

const sessions = {};

app.post('/create-session', (req, res) => {
    const { userAgent, referrer, url } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const geo = geoip.lookup(ip) || { city: 'N/A', region: 'N/A', country: 'N/A' };
    const sessionId = Math.random().toString(36).substr(2, 9);
    const sessionData = {
        sessionId,
        ip,
        userAgent,
        referrer,
        url,
        timestamp: new Date().toISOString(),
        screenResolution: req.body.screenResolution || 'N/A',
        deviceType: req.body.deviceType || 'N/A',
        loadTime: req.body.loadTime || 'N/A',
        city: geo.city,
        region: geo.region,
        country: geo.country,
        browser: req.body.browser || 'N/A',
        os: req.body.os || 'N/A',
        sessionDuration: 'N/A',
        clickCount: 0,
        pagesVisited: [url],
    };

    sessions[sessionId] = sessionData;

    console.log('Sessão criada e armazenada:', sessionData);

    res.json({ message: 'Sessão criada.', sessionId });
});

app.post('/capture-click', (req, res) => {
    const { sessionId, timestamp } = req.body;
    if (sessions[sessionId]) {
        sessions[sessionId].clickCount += 1;
        sessions[sessionId].timestamp = timestamp;

        console.log('Clique capturado:', timestamp, 'Total de cliques:', sessions[sessionId].clickCount);

        res.json({ message: 'Clique recebido.' });
    } else {
        console.log('Sessão não encontrada para sessionId:', sessionId);
        res.status(404).json({ message: 'Sessão não encontrada.' });
    }
});

app.post('/session-duration', (req, res) => {
    const { sessionId, duration } = req.body;
    if (sessions[sessionId]) {
        sessions[sessionId].sessionDuration = duration;

        console.log('Duração da sessão atualizada:', duration);

        res.json({ message: 'Duração da sessão recebida.' });
    } else {
        console.log('Sessão não encontrada para sessionId:', sessionId);
        res.status(404).json({ message: 'Sessão não encontrada.' });
    }
});

app.post('/page-visit', (req, res) => {
    const { sessionId, url } = req.body;
    if (sessions[sessionId]) {
        sessions[sessionId].pagesVisited.push(url);

        console.log('Página visitada:', url);

        res.json({ message: 'Página visitada recebida.' });
    } else {
        console.log('Sessão não encontrada para sessionId:', sessionId);
        res.status(404).json({ message: 'Sessão não encontrada.' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
