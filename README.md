# YouTube Downloader Pessoal

Ferramenta privada (uso individual) para baixar vídeos do YouTube com uma interface web simples, usando o yt-dlp por baixo dos panos.

⚠️ Use apenas para conteúdo que você tem direito de baixar (vídeos próprios, conteúdo de domínio público, licenças Creative Commons, etc). Baixar conteúdo protegido por direitos autorais sem autorização pode violar os Termos de Serviço do YouTube e a legislação de direitos autorais.

Esse servidor escuta apenas em `127.0.0.1` (localhost) — ou seja, só funciona no seu próprio computador, não fica acessível para outras pessoas na rede ou na internet.

## Pré-requisitos

1. **Node.js** instalado (https://nodejs.org) — baixe a versão LTS.
2. **yt-dlp.exe** — baixe em https://github.com/yt-dlp/yt-dlp/releases/latest e coloque na mesma pasta deste projeto (ao lado do `server.js`).
3. **ffmpeg** (recomendado) — baixe em https://www.gyan.dev/ffmpeg/builds/ (versão "release essentials"), extraia e copie `ffmpeg.exe` para a mesma pasta do projeto também.

## Instalação

Abra o terminal (cmd ou PowerShell) dentro da pasta do projeto e rode:

```
npm install
```

## Como usar

1. Inicie o servidor:
   ```
   npm start
   ```
2. Abra o navegador em: http://localhost:3000
3. Cole a URL do vídeo, clique em "Buscar formatos", escolha a qualidade desejada e clique em "Baixar selecionado".
4. Quando terminar, vai aparecer um link para abrir o arquivo. Os arquivos baixados ficam salvos na pasta `downloads/` dentro do projeto.

## Estrutura de pastas esperada

```
yt-downloader/
├── server.js
├── package.json
├── yt-dlp.exe        <- você precisa adicionar
├── ffmpeg.exe         <- você precisa adicionar (recomendado)
├── public/
│   └── index.html
└── downloads/         <- criada automaticamente
```

## Listando e selecionando vídeos de uma playlist

Além de baixar a playlist inteira de uma vez, agora dá para ver todos os vídeos antes de baixar:

1. Cole a URL da playlist e clique em **"Listar vídeos da playlist"**.
2. Aparece a lista com todos os vídeos. Os que já foram baixados antes aparecem marcados com "✓ Já baixado" e vêm desmarcados por padrão; os demais já vêm marcados para download.
3. Desmarque/marque conforme quiser (use os links "Marcar não baixados" / "Desmarcar tudo" para agilizar) e clique em **"Baixar selecionados"**.

O controle de "já baixado" funciona através de um arquivo de histórico (`downloads/archive.txt`), que o yt-dlp usa para registrar os IDs de vídeos já baixados. Isso também evita baixar o mesmo vídeo duas vezes sem querer, mesmo que você selecione algo repetido.



Se um vídeo/playlist for restrito a assinantes de um canal ("members-only") ou for um vídeo não listado/privado:

- Se você **for de fato assinante** (ou tiver acesso) e estiver logado no YouTube em algum navegador, selecione esse navegador no campo "Navegador onde você está logado" antes de clicar em "Baixar". O servidor vai usar os cookies de sessão daquele navegador para autenticar (equivalente à flag `--cookies-from-browser` do yt-dlp).
- Se você **não for assinante/não tiver acesso**, não existe forma de contornar isso — é uma restrição do criador do conteúdo, não uma limitação técnica da ferramenta.
- Feche o navegador escolhido antes de usar essa opção, pois alguns navegadores bloqueiam o acesso ao arquivo de cookies enquanto estão abertos.

## Playlists com vídeos restritos

A partir da atualização atual, o servidor usa `--ignore-errors`, ou seja, se alguns vídeos de uma playlist forem restritos (ou indisponíveis por qualquer motivo), os demais vídeos públicos continuam sendo baixados normalmente. Ao final, a interface mostra quantos vídeos foram baixados com sucesso e quantos falharam.



- Downloads de vídeos longos ou em qualidade muito alta podem demorar; a página fica "carregando" até o yt-dlp terminar.
- Se aparecer erro de "membro do canal", significa que o vídeo é restrito a assinantes — não há como contornar isso sem ser de fato assinante autenticado.
- Para parar o servidor, volte ao terminal e aperte `Ctrl+C`.
