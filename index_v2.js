require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const puppeteer = require('puppeteer-core');  // A importação do puppeteer-core é necessária para usar a flag --no-sandbox

const app = express();
const port = process.env.PORT || 4000;

app.use(bodyParser.json());

// Inicialização do cliente WhatsApp com a opção no-sandbox
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    launchOptions: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'], // Adicionando a flag --no-sandbox
    },
  },
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
  console.log(message.body);
});

client.initialize();

// Rota para testar o funcionamento do Webhook
app.get('/', (req, res) => {
  res.status(200).send(`Zoom Webhook sample successfully running. Set this URL with the /webhook path as your apps Event notification endpoint URL.`);
});

// Rota para receber eventos do Zoom
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-zm-signature'];
  const timestamp = req.headers['x-zm-request-timestamp'];
  const message = `v0:${timestamp}:${JSON.stringify(req.body)}`;
  const hashForVerify = crypto.createHmac('sha256', process.env.ZOOM_WEBHOOK_SECRET_TOKEN).update(message).digest('hex');
  const expectedSignature = `v0=${hashForVerify}`;

  // Verificação da assinatura para garantir que veio do Zoom
  if (signature === expectedSignature) {
    console.log('Evento válido recebido:', req.body);

    // Verifica o tipo de evento
    if (req.body.event === 'endpoint.url_validation') {
      // Responde com o token de validação do Zoom
      const hashForValidate = crypto.createHmac('sha256', process.env.ZOOM_WEBHOOK_SECRET_TOKEN).update(req.body.payload.plainToken).digest('hex');
      res.status(200).json({ plainToken: req.body.payload.plainToken, encryptedToken: hashForValidate });
    } else if (req.body.event === 'meeting.started') {
      console.log('Reunião iniciada:', req.body.payload.object.id);
      // Recuperar informações da reunião
      const meetingId = req.body.payload.object.id;
      const meetingPassword = req.body.payload.object.password || 'Não fornecida';
      const joinUrl = `https://zoom.us/j/${meetingId}`; // Link de participação da reunião

      // Envia mensagem via WhatsApp para um grupo quando a reunião começar
      sendWhatsAppMessage(meetingId, meetingPassword, joinUrl, 'início');
    } else if (req.body.event === 'meeting.ended') {
      console.log('Reunião encerrada:', req.body.payload.object.id);
      // Envia mensagem via WhatsApp para o grupo quando a reunião terminar
      sendWhatsAppMessage('', '', '', 'fim');
    }

    res.status(200).send('Evento processado');
  } else {
    res.status(401).send('Assinatura inválida');
  }
});

// Função para enviar mensagem no WhatsApp para um grupo
function sendWhatsAppMessage(meetingId, meetingPassword = '', joinUrl = '', eventType) {
  const groupId = '120363371602328341@g.us'; // Substitua pelo ID do grupo
  const message = getMessageContent(meetingId, meetingPassword, joinUrl, eventType);

  client.sendMessage(groupId, message).then((response) => {
    console.log('Mensagem enviada com sucesso para o grupo:', response);
  }).catch((error) => {
    console.error('Erro ao enviar mensagem para o grupo:', error);
  });
}

// Função para definir o conteúdo da mensagem
function getMessageContent(meetingId, meetingPassword, joinUrl, eventType) {
  if (eventType === 'início') {
    return `*A reunião foi íniciada no ZOOM!* 🟢

*Clique no link abaixo para participar:*
👇🏻👇🏻 Entrar na reunião Zoom: 
${joinUrl}

*Ou, se preferir, digite o ID e a senha:*
*ID da reunião:* ${meetingId}
*Senha de acesso:* ${meetingPassword}`;

  } else if (eventType === 'fim') {
    return `*A reunião foi encerrada!* 🔴
    
Gostaríamos de agradecer a todos pela participação!🙏`;
  }
}

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
