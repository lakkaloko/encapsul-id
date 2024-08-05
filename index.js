const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const ipinfo = require('ipinfo');
const app = express();

// Configuração da porta para usar a variável de ambiente PORT ou 3000 como fallback
const PORT = process.env.PORT || 3000;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const GOOGLE_CREDS = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
const IPINFO_API_KEY = process.env.IPINFO_API_KEY;

// Configuração do servidor
app.use(cors());
app.use(express.json());

// Configuração de autenticação do Google Sheets
const auth = new google.auth.GoogleAuth({
    credentials: GOOGLE_CREDS,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});
const sheets = google.sheets({ version: 'v4', auth });

// Função para validar os dados recebidos
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

// Função para enviar dados para a planilha
async function appendData(auth, data) {
    const client = await auth.getClient();
    const request = {
        spreadsheetId: SPREADSHEET_ID,
        range: 'Página1!A1:Z1', // Altere conforme necessário
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

// Função para lidar com dados de sessão
const sessions = {};

// Rota para coletar dados
app.post('/collect-data', validateData, async (req, res) => {
    const data = req.body;
    console.log('Dados recebidos:', data);

    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    ipinfo(ip, IPINFO_API_KEY, async (err, cLoc) => {
        const sessionData = [
            data.sessionId || '',
            data.userAgent || '',
            data.browser || '',
            data.os || '',
            data.referrer || '',
            data.url || '',
            data.timestamp || '',
            data.screenResolution || '',
            data.deviceType || '',
            cLoc ? cLoc.city : 'N/A',
            cLoc ? cLoc.region : 'N/A',
            cLoc ? cLoc.country : 'N/A',
            data.loadTime || '',
            data.sessionDuration || '',
            data.clickCount || 0
        ];

        console.log('Dados formatados para enviar para a planilha:', sessionData);

        try {
            await appendData(auth, sessionData);
            res.status(200).json({ message: 'Dados recebidos e processados' });
        } catch (error) {
            res.status(500).json({ error: 'Erro ao processar dados' });
        }
    });
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
        const formattedData = [
            sessionId, '', '', '', '', url, timestamp, '', '', '', '', '', '', '', '', '', ''
        ];
        
        console.log('Dados formatados para enviar para a planilha:', formattedData);

        try {
            await appendData(auth, formattedData);
            res.status(200).json({ message: 'Visita à página recebida e processada' });
        } catch (error) {
            res.status(500).json({ error: 'Erro ao processar dados' });
        }
    } else {
        res.json({ message: 'Sessão não encontrada.' });
    }
});

// Iniciar o servidor na porta configurada
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
