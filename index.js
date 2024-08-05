const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { google } = require('googleapis');
const keys = require('./monitoramento-de-cliques-be2c74e295f7.json');
const useragent = require('useragent');

const app = express();

app.use(cors({ origin: '*' }));
app.use(bodyParser.json());

const SHEET_ID = '1xhmVOg-xucjDNt-8nRlIPWpOt-GnVGCTjHoLi43BC74';
const GEOLOCATION_API_KEY = '18b71e5453304413b40c633aeb064704';

const sessions = {}; // Armazena sessões por sessionId

async function getGeolocation(ip) {
    try {
        const response = await fetch(`https://api.ipgeolocation.io/ipgeo?apiKey=${GEOLOCATION_API_KEY}&ip=${ip}`);
        const data = await response.json();
        console.log('Geolocation data:', data);
        return { city: data.city || 'N/A', region: data.state_prov || 'N/A', country: data.country_name || 'N/A' };
    } catch (error) {
        console.error('Erro ao obter geolocalização:', error);
        return { city: 'N/A', region: 'N/A', country: 'N/A' };
    }
}

async function appendToSheet(data) {
    try {
        const client = new google.auth.JWT(
            keys.client_email,
            null,
            keys.private_key,
            ['https://www.googleapis.com/auth/spreadsheets']
        );

        const sheets = google.sheets({ version: 'v4', auth: client });

        const request = {
            spreadsheetId: SHEET_ID,
            range: 'Sheet1!A:P',
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: [data]
            }
        };

        console.log('Enviando dados para o Google Sheets:', request.resource.values);
        const response = await sheets.spreadsheets.values.append(request);
        console.log('Resposta do Google Sheets:', response.data);
    } catch (error) {
        console.error('Erro ao enviar dados para o Google Sheets:', error);
    }
}

app.post('/create-session', async (req, res) => {
    const data = req.body;
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    data.ip = ip;

    const location = await getGeolocation(ip);
    data.city = location.city;
    data.region = location.region;
    data.country = location.country;

    const agent = useragent.parse(data.userAgent);
    data.browser = agent.toAgent();
    data.os = agent.os.toString();

    data.sessionId = Math.random().toString(36).substring(2); // Gera um novo sessionId
    data.sessionDuration = 'N/A';
    data.clickCount = 0;
    data.pagesVisited = [data.url || 'N/A'];

    console.log('Dados recebidos no servidor:', data);

    sessions[data.sessionId] = data;
    console.log('Sessão criada e armazenada:', sessions);

    res.status(200).json({ message: 'Sessão criada.', sessionId: data.sessionId });
});

app.post('/session-duration', async (req, res) => {
    const { sessionId, duration } = req.body;
    console.log('Recebendo sessionId para duração da sessão:', sessionId);
    console.log('Sessões armazenadas:', JSON.stringify(sessions));
    if (sessions[sessionId]) {
        sessions[sessionId].sessionDuration = duration;
        console.log('Duração da sessão atualizada:', duration);
        console.log('Sessão atualizada:', sessions[sessionId]);
        res.status(200).json({ message: 'Duração da sessão recebida.' });
    } else {
        console.error('Sessão não encontrada para sessionId:', sessionId);
        res.status(400).json({ message: 'Sessão não encontrada.' });
    }
});

app.post('/capture-click', async (req, res) => {
    const { sessionId, timestamp } = req.body;
    console.log('Recebendo sessionId para captura de clique:', sessionId);
    console.log('Sessões armazenadas:', JSON.stringify(sessions));
    if (sessions[sessionId]) {
        sessions[sessionId].clickCount += 1;
        sessions[sessionId].timestamp = timestamp;
        console.log('Clique capturado:', timestamp, 'Total de cliques:', sessions[sessionId].clickCount);
        console.log('Sessão atualizada:', sessions[sessionId]);
        res.status(200).json({ message: 'Clique recebido.' });
    } else {
        console.error('Sessão não encontrada para sessionId:', sessionId);
        res.status(400).json({ message: 'Sessão não encontrada.' });
    }
});

app.post('/page-visit', async (req, res) => {
    const { sessionId, url } = req.body;
    console.log('Recebendo sessionId para visita de página:', sessionId);
    console.log('Sessões armazenadas:', JSON.stringify(sessions));
    if (sessions[sessionId]) {
        sessions[sessionId].pagesVisited.push(url);
        sessions[sessionId].url = url;
        sessions[sessionId].timestamp = new Date().toISOString();
        console.log('Página visitada:', url);
        console.log('Sessão atualizada:', sessions[sessionId]);

        // Enviando dados acumulados para o Google Sheets
        await appendToSheet([
            sessions[sessionId].ip, sessions[sessionId].userAgent, sessions[sessionId].browser, sessions[sessionId].os, 
            sessions[sessionId].referrer, sessions[sessionId].url, sessions[sessionId].timestamp, 
            sessions[sessionId].screenResolution, sessions[sessionId].deviceType, sessions[sessionId].city, 
            sessions[sessionId].region, sessions[sessionId].country, sessions[sessionId].loadTime, 
            sessions[sessionId].sessionDuration || 'N/A', sessions[sessionId].clickCount || 0, 
            sessions[sessionId].pagesVisited.join(', ') || 'N/A'
        ]);

        res.status(200).json({ message: 'Página visitada recebida e dados enviados ao Google Sheets.' });
    } else {
        console.error('Sessão não encontrada para sessionId:', sessionId);
        res.status(400).json({ message: 'Sessão não encontrada.' });
    }
});

app.listen(3000, () => {
    console.log('Servidor rodando na porta 3000');
});

function validateData(data) {
    if (!data.ip || !data.userAgent || !data.browser || !data.os || 
        !data.url || !data.timestamp || !data.screenResolution || !data.deviceType || 
        !data.city || !data.region || !data.country || data.loadTime === undefined) {
        console.error('Dados inválidos:', data);
        return false;
    }
    return true;
}
