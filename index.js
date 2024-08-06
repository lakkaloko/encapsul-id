const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const ipinfo = require('ipinfo');
const app = express();

// Iniciar o servidor na porta configurada
const PORT = process.env.PORT || 10000;
console.log(`Servidor rodando na porta ${PORT}`);

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const GOOGLE_APPLICATION_CREDENTIALS = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
const IPINFO_API_KEY = process.env.IPINFO_API_KEY;

// Configuração do servidor
app.use(cors());
app.use(express.json());

// Configuração de autenticação do Google Sheets
const auth = new google.auth.GoogleAuth({
    credentials: GOOGLE_APPLICATION_CREDENTIALS,
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
        range: 'Sheet1!A1:Z1', // Altere conforme necessário
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
        console.error('Erro ao enviar dados para a planilha:', error.response ? error.response.data : error.message);
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
    const clientIp = ip.split(',')[0].trim(); // Captura o primeiro IP e remove espaços extras

    ipinfo(clientIp, IPINFO_API_KEY, async (err, cLoc) => {
        if (err) {
            console.error('Erro ao obter localização IP:', err);
            return res.status(500).json({ error: 'Erro ao obter localização IP' });
        }

        if (!sessions[data.sessionId]) {
            sessions[data.sessionId] = {
                ...data,
                clickCount: 0
            };
        } else {
            sessions[data.sessionId] = {
                ...sessions[data.sessionId],
                ...data
            };
        }

        const sessionData = [
            clientIp || '',
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
            sessions[data.sessionId].clickCount || 0
        ].map(item => item === undefined ? '' : item); // Substituir undefined por ''

        console.log('Dados formatados para enviar para a planilha:', sessionData);

        try {
            await appendData(auth, sessionData);
            console.log('Dados realmente enviados para a planilha:', sessionData);
            res.status(200).json({ message: 'Dados recebidos e processados' });
        } catch (error) {
            console.error('Erro ao processar dados:', error);
            res.status(500).json({ error: 'Erro ao processar dados', details: error.message });
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
app.post('/capture-click', (req, res) => {
    const { sessionId, timestamp } = req.body;
    if (sessions[sessionId]) {
        sessions[sessionId].clickCount = (sessions[sessionId].clickCount || 0) + 1;
        console.log(`Clique capturado para sessão ${sessionId}:`, sessions[sessionId].clickCount);
        res.status(200).json({ message: 'Clique capturado' });
    } else {
        res.status(400).json({ error: 'Sessão não encontrada' });
    }
});

// Rota para visitas a páginas
app.post('/page-visit', validateData, async (req, res) => {
    const { sessionId, url, timestamp } = req.body;
    if (sessions[sessionId]) {
        sessions[sessionId].pagesVisited = (sessions[sessionId].pagesVisited || []).concat(url);
        const formattedData = [
            '',
            sessionId, '', '', '', url, timestamp, '', '', '', '', '', '', '', '', '', ''
        ].map(item => item === undefined ? '' : item); // Substituir undefined por ''
        
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
