const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const ipinfo = require('ipinfo');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(cors());

const PORT = process.env.PORT || 3000;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const GOOGLE_CREDS = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
const IPINFO_API_KEY = process.env.IPINFO_API_KEY;

const sessions = {};

async function accessSpreadsheet() {
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID);
    await doc.useServiceAccountAuth(GOOGLE_CREDS);
    await doc.loadInfo();
    return doc;
}

app.post('/create-session', async (req, res) => {
    const { userAgent, referrer, url, timestamp, screenResolution, deviceType, loadTime } = req.body;
    const sessionId = generateSessionId();

    const sessionData = {
        sessionId,
        userAgent,
        referrer,
        url,
        timestamp,
        screenResolution,
        deviceType,
        loadTime,
        clickCount: 0,
        pagesVisited: [url],
        sessionDuration: 'N/A',
        city: 'N/A',
        region: 'N/A',
        country: 'N/A'
    };

    sessions[sessionId] = sessionData;

    try {
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        ipinfo(ip, IPINFO_API_KEY, (err, cLoc) => {
            if (!err) {
                sessionData.city = cLoc.city;
                sessionData.region = cLoc.region;
                sessionData.country = cLoc.country;
            }
            res.json({ message: 'Sessão criada.', sessionId });
        });
    } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({ message: 'Erro ao criar sessão.' });
    }
});

app.post('/capture-click', (req, res) => {
    const { sessionId, timestamp } = req.body;
    if (sessions[sessionId]) {
        sessions[sessionId].clickCount += 1;
        res.json({ message: 'Clique capturado.' });
    } else {
        res.status(404).json({ message: 'Sessão não encontrada.' });
    }
});

app.post('/session-duration', (req, res) => {
    const { sessionId, duration } = req.body;
    if (sessions[sessionId]) {
        sessions[sessionId].sessionDuration = duration;
        res.json({ message: 'Duração da sessão registrada.' });
    } else {
        res.status(404).json({ message: 'Sessão não encontrada.' });
    }
});

app.post('/page-visit', (req, res) => {
    const { sessionId, url } = req.body;
    if (sessions[sessionId]) {
        sessions[sessionId].pagesVisited.push(url);
        res.json({ message: 'Visita de página registrada.' });
    } else {
        res.status(404).json({ message: 'Sessão não encontrada.' });
    }
});

function generateSessionId() {
    return Math.random().toString(36).substr(2, 9);
}

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
