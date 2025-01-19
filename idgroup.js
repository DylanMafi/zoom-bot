const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 4000;

app.use(bodyParser.json());

// Inicialização do cliente WhatsApp
const client = new Client({
  authStrategy: new LocalAuth(),
});

client.on('qr', (qr) => {
  // Gera o QR Code para autenticação
  qrcode.generate(qr, { small: true });
  console.log('Escaneie o QR Code para autenticar no WhatsApp!');
});

client.on('ready', () => {
  console.log('Cliente WhatsApp pronto!');
});

client.on('message', (message) => {
  console.log('Mensagem recebida: ', message.body);

  // Se a mensagem foi enviada em um grupo
  if (message.from.includes('@g.us')) {
    console.log(`Mensagem recebida de grupo com ID: ${message.from}`);
  }
});

client.initialize();

// Rota para testar o funcionamento do Webhook
app.get('/', (req, res) => {
  res.status(200).send(`Zoom Webhook sample successfully running. Set this URL with the /webhook path as your apps Event notification endpoint URL.`);
});

// Rota para receber eventos do Zoom
app.post('/webhook', (req, res) => {
  console.log('Evento recebido do Zoom:', req.body);
  res.status(200).send('Evento processado');
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
