const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Coloque o yt-dlp.exe na mesma pasta deste arquivo (server.js)
const YTDLP_PATH = path.join(__dirname, 'yt-dlp.exe');
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
const ARCHIVE_FILE = path.join(DOWNLOAD_DIR, 'archive.txt');

if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR);
if (!fs.existsSync(YTDLP_PATH)) {
  console.warn('AVISO: yt-dlp.exe não encontrado na pasta do projeto. Copie o yt-dlp.exe para: ' + __dirname);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/downloads', express.static(DOWNLOAD_DIR));

function walkFiles(dir) {
  const result = [];
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) result.push(...walkFiles(full));
    else result.push(full);
  }
  return result;
}

function getArchiveSet() {
  if (!fs.existsSync(ARCHIVE_FILE)) return new Set();
  return new Set(
    fs.readFileSync(ARCHIVE_FILE, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  );
}

// Lista os formatos disponíveis para UM vídeo específico
app.post('/api/formats', (req, res) => {
  const { url, browser } = req.body;
  if (!url) return res.status(400).json({ error: 'URL não informada' });

  // --no-playlist: garante que pegamos só o vídeo informado, mesmo que a URL tenha &list=
  const args = ['-j', '--no-warnings', '--no-playlist'];
  if (browser) args.push('--cookies-from-browser', browser);
  args.push(url);

  const proc = spawn(YTDLP_PATH, args);
  let data = '';
  let errData = '';

  proc.stdout.on('data', (chunk) => (data += chunk));
  proc.stderr.on('data', (chunk) => (errData += chunk));

  proc.on('error', (err) => {
    res.status(500).json({ error: 'Não foi possível executar o yt-dlp.exe: ' + err.message });
  });

  proc.on('close', (code) => {
    if (code !== 0) {
      return res.status(500).json({ error: errData || 'Erro ao obter informações do vídeo' });
    }
    try {
      const info = JSON.parse(data);
      const formats = (info.formats || [])
        .filter((f) => f.vcodec !== 'none' || f.acodec !== 'none')
        .map((f) => ({
          format_id: f.format_id,
          ext: f.ext,
          resolution: f.height ? `${f.height}p` : f.resolution || 'audio only',
          filesize: f.filesize || f.filesize_approx || null,
          note: f.format_note || '',
          vcodec: f.vcodec,
          acodec: f.acodec,
        }));
      res.json({ title: info.title, formats });
    } catch (e) {
      res.status(500).json({ error: 'Erro ao interpretar resposta do yt-dlp' });
    }
  });
});

// Lista todos os vídeos de uma playlist (rápido, sem baixar formatos individuais)
// e marca quais já foram baixados anteriormente, com base no arquivo de histórico.
app.post('/api/playlist-info', (req, res) => {
  const { url, browser } = req.body;
  if (!url) return res.status(400).json({ error: 'URL não informada' });

  // --flat-playlist: só lista os itens, rápido, sem checar formatos de cada vídeo
  const args = ['--flat-playlist', '-J', '--no-warnings'];
  if (browser) args.push('--cookies-from-browser', browser);
  args.push(url);

  const proc = spawn(YTDLP_PATH, args);
  let data = '';
  let errData = '';

  proc.stdout.on('data', (chunk) => (data += chunk));
  proc.stderr.on('data', (chunk) => (errData += chunk));

  proc.on('error', (err) => {
    res.status(500).json({ error: 'Não foi possível executar o yt-dlp.exe: ' + err.message });
  });

  proc.on('close', (code) => {
    if (!data.trim()) {
      return res.status(500).json({ error: errData || 'Não foi possível obter informações da playlist' });
    }
    try {
      const info = JSON.parse(data);
      const entries = info.entries || [info]; // se for um vídeo único, trata como lista de 1
      const archiveSet = getArchiveSet();

      const videos = entries
        .filter(Boolean)
        .map((entry, i) => {
          const id = entry.id;
          const videoUrl = entry.url || entry.webpage_url || `https://www.youtube.com/watch?v=${id}`;
          return {
            id,
            title: entry.title || id,
            url: videoUrl,
            index: entry.playlist_index != null ? entry.playlist_index : i + 1,
            downloaded: archiveSet.has(`youtube ${id}`),
          };
        });

      res.json({ playlistTitle: info.title || null, playlistUrl: url, videos });
    } catch (e) {
      res.status(500).json({ error: errData || 'Erro ao interpretar resposta do yt-dlp' });
    }
  });
});

// Dispara o download de uma URL única, várias URLs específicas, ou uma playlist inteira
app.post('/api/download', (req, res) => {
  const { url, urls, format, browser, playlistItems } = req.body; // browser ex: "chrome", "firefox", "edge"
  const targets = Array.isArray(urls) && urls.length > 0 ? urls : url ? [url] : [];
  if (targets.length === 0) return res.status(400).json({ error: 'URL não informada' });

  const filesBefore = new Set(walkFiles(DOWNLOAD_DIR));
  const outputTemplate = path.join(DOWNLOAD_DIR, '%(playlist_title|)s/%(title)s.%(ext)s');

  // --ignore-errors: continua baixando o resto mesmo se algum vídeo falhar
  // --download-archive: registra IDs já baixados, evitando baixar de novo e permitindo marcar status na listagem
  const args = [
    '-o', outputTemplate,
    '--no-warnings',
    '--ignore-errors',
    '--download-archive', ARCHIVE_FILE,
  ];
  // --playlist-items: usado quando o usuário seleciona vídeos específicos de uma playlist.
  // Mantém a URL original da playlist (em vez de URLs individuais), preservando o contexto
  // necessário para o %(playlist_title)s funcionar e criar a pasta corretamente.
  if (playlistItems) args.push('--playlist-items', playlistItems);
  if (format) args.push('-f', format);
  if (browser) args.push('--cookies-from-browser', browser);
  args.push(...targets);

  const proc = spawn(YTDLP_PATH, args);
  let errData = '';

  proc.stderr.on('data', (chunk) => (errData += chunk));

  proc.on('error', (err) => {
    res.status(500).json({ error: 'Não foi possível executar o yt-dlp.exe: ' + err.message });
  });

  proc.on('close', () => {
    const allFilesAfter = walkFiles(DOWNLOAD_DIR);
    const newFiles = allFilesAfter
      .filter((f) => !filesBefore.has(f))
      .map((f) => ({ full: f, time: fs.statSync(f).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    const failedCount = (errData.match(/^ERROR:/gm) || []).length;

    if (newFiles.length === 0) {
      if (failedCount === 0) {
        // Nenhum arquivo novo, mas sem erro: provavelmente todos já tinham sido baixados antes
        return res.json({ downloaded: 0, failed: 0, files: [], warning: 'Nenhum arquivo novo (todos os itens selecionados já haviam sido baixados antes).' });
      }
      return res.status(500).json({ error: errData || 'Nenhum arquivo foi baixado' });
    }

    res.json({
      downloaded: newFiles.length,
      failed: failedCount,
      files: newFiles.map(
        (f) => '/downloads/' + path.relative(DOWNLOAD_DIR, f.full).split(path.sep).map(encodeURIComponent).join('/')
      ),
      warning: failedCount > 0 ? `${failedCount} vídeo(s) não puderam ser baixados (provavelmente restritos a membros).` : null,
    });
  });
});

// Ouve apenas em localhost: não fica acessível para outros dispositivos na rede
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
