const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const bodyParser = require('body-parser');
const app = express();

const PORT = process.env.PORT || 10000;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const GOOGLE_APPLICATION_CREDENTIALS = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);

app.use(cors());
app.use(bodyParser.json());

const auth = new google.auth.GoogleAuth({
    credentials: GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

const sheets = google.sheets('v4');

// Função para converter timestamp para datetime
function convertTimestampToDateTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: false 
    }).replace(',', ''); // Formato: "MM/DD/YYYY HH:MM:SS"
}

// Função para simplificar o user agent
function simplifyUserAgent(userAgent) {
    if (userAgent.includes("Android")) {
        return "Android Device";
    } else if (userAgent.includes("iPhone")) {
        return "iPhone Device";
    } else if (userAgent.includes("Windows")) {
        return "Windows Device";
    } else {
        return "Other Device";
    }
}

// Função para validar os dados recebidos
const validateData = (req, res, next) => {
    const data = req.body;
    console.log('Corpo da requisição recebido:', JSON.stringify(data, null, 2));
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
        range: 'Sheet1!A:Q', // Adapte conforme necessário
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

// Função para obter IP do cliente
const getClientIp = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        const ip = forwarded.split(',')[0];
        return ip;
    }
    return req.connection.remoteAddress;
};

// Rota para coletar dados
app.post('/collect-data', validateData, async (req, res) => {
    const data = req.body;
    console.log('Dados recebidos:', JSON.stringify(data, null, 2));

    const ip = getClientIp(req) || 'N/A';

    const formattedData = [
        ip,
        simplifyUserAgent(data.userAgent) || 'N/A',
        data.browser || 'N/A',
        data.os || 'N/A',
        data.referrer || 'N/A',
        data.url || 'N/A',
        convertTimestampToDateTime(data.timestamp) || 'N/A',
        data.screenResolution || 'N/A',
        data.deviceType || 'N/A',
        data.city || 'N/A',
        data.region || 'N/A',
        data.country || 'N/A',
        data.loadTime || 'N/A',
        data.sessionDuration || 'N/A',
        data.clickCount || 0,
        data.pagesVisited || 'N/A'
    ];

    console.log('Dados formatados para enviar para a planilha:', JSON.stringify(formattedData, null, 2));

    try {
        await appendData(auth, formattedData);
        res.status(200).json({ message: 'Dados recebidos e processados' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao processar dados' });
    }
});

// Rota para duração da sessão
app.post('/session-duration', validateData, async (req, res) => {
    const data = req.body;
    console.log('Duração da sessão:', JSON.stringify(data, null, 2));

    const ip = getClientIp(req) || 'N/A';

    const formattedData = [
        ip,
        simplifyUserAgent(data.userAgent) || 'N/A',
        data.browser || 'N/A',
        data.os || 'N/A',
        data.referrer || 'N/A',
        data.url || 'N/A',
        convertTimestampToDateTime(data.timestamp) || 'N/A',
        data.screenResolution || 'N/A',
        data.deviceType || 'N/A',
        'N/A', // City
        'N/A', // Region
        'N/A', // Country
        'N/A', // Load Time
        data.duration || 'N/A',
        data.clickCount || 0,
        'N/A' // Pages Visited
    ];

    console.log('Dados formatados para enviar para a planilha:', JSON.stringify(formattedData, null, 2));

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
    console.log('Clique capturado:', JSON.stringify(data, null, 2));

    const ip = getClientIp(req) || 'N/A';

    const formattedData = [
        ip,
        simplifyUserAgent(data.userAgent) || 'N/A',
        data.browser || 'N/A',
        data.os || 'N/A',
        data.referrer || 'N/A',
        data.url || 'N/A',
        convertTimestampToDateTime(data.timestamp) || 'N/A',
        data.screenResolution || 'N/A',
        data.deviceType || 'N/A',
        'N/A', // City
        'N/A', // Region
        'N/A', // Country
        'N/A', // Load Time
        'N/A', // Session Duration
        data.clickCount || 1,
        'N/A' // Pages Visited
    ];

    console.log('Dados formatados para enviar para a planilha:', JSON.stringify(formattedData, null, 2));

    try {
        await appendData(auth, formattedData);
        res.status(200).json({ message: 'Clique recebido e processado' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao processar dados' });
    }
});

// Rota para visitas a páginas
app.post('/page-visit', validateData, async (req, res) => {
    const data = req.body;
    console.log('Visita à página:', JSON.stringify(data, null, 2));

    const ip = getClientIp(req) || 'N/A';

    const formattedData = [
        ip,
        simplifyUserAgent(data.userAgent) || 'N/A',
        data.browser || 'N/A',
        data.os || 'N/A',
        data.referrer || 'N/A',
        data.url || 'N/A',
        convertTimestampToDateTime(data.timestamp) || 'N/A',
        data.screenResolution || 'N/A',
        data.deviceType || 'N/A',
        'N/A', // City
        'N/A', // Region
        'N/A', // Country
        data.loadTime || 'N/A',
        'N/A', // Session Duration
        data.clickCount || 0,
        data.url || 'N/A'
    ];

    console.log('Dados formatados para enviar para a planilha:', JSON.stringify(formattedData, null, 2));

    try {
        await appendData(auth, formattedData);
        res.status(200).json({ message: 'Visita à página recebida e processada' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao processar dados' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
