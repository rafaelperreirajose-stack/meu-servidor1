import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// Armazenar tokens em memória (simples)
const tokens = new Map();

// ============ ROTAS DE LOGIN ============

// Rota 1: Iniciar login com GitHub
app.get('/auth/github', (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  
  if (!clientId) {
    return res.status(500).send('❌ GITHUB_CLIENT_ID não configurado');
  }

  const redirectUri = `${process.env.REDIRECT_URI || 'http://localhost:3000'}/auth/github/callback`;
  const scope = 'user:email';
  
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri )}&scope=${scope}`;
  
  res.redirect(authUrl);
});

// Rota 2: Callback do GitHub
app.get('/auth/github/callback', async (req, res) => {
  const { code, error } = req.query;
  
  if (error) {
    return res.send(`❌ Erro: ${error}`);
  }

  if (!code) {
    return res.send('❌ Código não fornecido');
  }

  try {
    // Trocar código por token
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: code
      },
      {
        headers: { Accept: 'application/json' }
      }
     );

    const { access_token, error: tokenError } = tokenResponse.data;

    if (tokenError || !access_token) {
      return res.send('❌ Falha ao obter token');
    }

    // Obter dados do usuário
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: { 
        Authorization: `Bearer ${access_token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    } );

    const usuario = {
      id: userResponse.data.id,
      username: userResponse.data.login,
      nome: userResponse.data.name || userResponse.data.login,
      avatar: userResponse.data.avatar_url,
      email: userResponse.data.email || 'Email privado'
    };

    // Salvar token
    tokens.set(usuario.id, access_token);

    // Redirecionar para sucesso
    res.redirect(`/sucesso?user=${encodeURIComponent(JSON.stringify(usuario))}`);

  } catch (erro) {
    console.error('Erro:', erro.message);
    res.send(`❌ Erro na autenticação: ${erro.message}`);
  }
});

// ============ ROTAS DE TESTE ============

// Rota: Página de sucesso
app.get('/sucesso', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'sucesso.html'));
});

// Rota: Página inicial
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🔥 Servidor Free Fire rodando em http://localhost:${PORT}` );
  console.log(`🔐 GitHub OAuth: ${process.env.GITHUB_CLIENT_ID ? '✓ Configurado' : '✗ Não configurado'}`);
});
