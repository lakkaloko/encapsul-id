const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const sheets = google.sheets('v4');
const app = express();

// Configuração da porta para usar a variável de ambiente PORT ou 3000 como fallback
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const GOOGLE_CREDS = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
const IPINFO_API_KEY = process.env.IPINFO_API_KEY;

const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

const validateData = (req, res, next) => {
    const data = req.body;
    const requiredFields = ['sessionId', 'userAgent', 'url', 'timestamp'];
    let isValid = true;
    let missingFields = [];

    requiredFields.forEach(field => {
        if (!data[field]) {
            isValid = false;
            missingFields.push(field);
        }
    });

    if (!isValid) {
        console.log('Dados inválidos:', { error: 'Dados inválidos', missingFields });
        return res.status(400).json({ error: 'Dados inválidos', missingFields });
    }

    next();
};

async function appendData(auth, data) {
    const client = await auth.getClient();
    const request = {
        spreadsheetId: SPREADSHEET_ID,
        range: RANGE,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: {
            values: [data]
        },
        auth: client
    };

    try {
        const response = (await sheets.spreadsheets.values.append(request)).data;
        console.log('Dados enviados para a planilha:', response);
    } catch (error) {
        console.error('Erro ao enviar dados para a planilha:', error);
        throw error;
    }
}

// Rota para coletar dados
app.post('/collect-data', validateData, async (req, res) => {
    const data = req.body;
    console.log('Dados recebidos:', data);

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

    console.log('Dados formatados para enviar para a planilha:', formattedData);

    try {
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        ipinfo(ip, IPINFO_API_KEY, (err, cLoc) => {
            if (!err) {
                sessionData.city = cLoc.city || 'N/A';
                sessionData.region = cLoc.region || 'N/A';
                sessionData.country = cLoc.country || 'N/A';
            }
            res.json({ message: 'Sessão criada.', sessionId });
        });
    } catch (error) {
        console.error('Erro ao obter geolocalização:', error);
        res.json({ message: 'Sessão criada.', sessionId });
    }
});

// Rota para duração da sessão
app.post('/session-duration', (req, res) => {
    const { sessionId, duration } = req.body;
    if (sessions[sessionId]) {
        sessions[sessionId].sessionDuration = duration;
        res.json({ message: 'Duração da sessão capturada.' });
    } else {
        res.json({ message: 'Sessão não encontrada.' });
    }
});

    console.log('Dados formatados para enviar para a planilha:', formattedData);

    try {
        await appendData(auth, formattedData);
        res.status(200).json({ message: 'Duração da sessão recebida e processada' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao processar dados' });
    }
});

// Rota para capturar cliques
app.post('/capture-click', validateData, async (req, res) => {
    const data = req.body;
    console.log('Clique capturado:', data);

    const formattedData = [
        data.sessionId || '',
        '', '', '', '', '', '',
        data.timestamp || '',
        '', '', '', '', '', '',
        '', 1, ''
    ];

    console.log('Dados formatados para enviar para a planilha:', formattedData);

    try {
        await appendData(auth, formattedData);
        res.status(200).json({ message: 'Clique recebido e processado' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao processar dados' });
    }
});

// Rota para visitas a páginas
app.post('/page-visit', async (req, res) => {
    const { sessionId, url, timestamp } = req.body;
    if (sessions[sessionId]) {
        sessions[sessionId].pagesVisited.push(url);
        try {
            const doc = await accessSpreadsheet();
            const sheet = doc.sheetsByIndex[0]; // Assumindo que estamos usando a primeira aba
            await sheet.addRow(sessions[sessionId]);
            res.json({ message: 'Visita registrada.' });
        } catch (error) {
            console.error('Erro ao acessar a planilha:', error);
            res.json({ message: 'Erro ao registrar visita.' });
        }
    } else {
        res.json({ message: 'Sessão não encontrada.' });
    }
});

    console.log('Dados formatados para enviar para a planilha:', formattedData);

    try {
        await appendData(auth, formattedData);
        res.status(200).json({ message: 'Visita à página recebida e processada' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao processar dados' });
    }
});

// Iniciar o servidor na porta configurada
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
