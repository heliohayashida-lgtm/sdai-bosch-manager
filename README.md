# SDAI Bosch Manager

Sistema de gestão operacional para Sistemas de Detecção e Alarme de Incêndio (SDAI), com cadastro técnico, histórico de falhas, plano de ação, relatórios e integração com Google Workspace.

## Estrutura

- `index.html` — interface principal.
- `css/style.css` — identidade visual e responsividade.
- `js/app.js` — regras atuais do sistema.
- `js/config.js` — configuração da URL do Apps Script.
- `js/api.js` — camada preparada para integração com Google Apps Script.
- `apps-script/Code.gs` — backend Google Apps Script.

## Publicação web

1. Suba este conteúdo no repositório GitHub.
2. Conecte o repositório ao Netlify.
3. Publique o site.
4. Configure o Apps Script como Web App.
5. Copie a URL `/exec` do Apps Script em `js/config.js`.

## Observação

Esta entrega já organiza o frontend para GitHub/Netlify. A próxima etapa é migrar definitivamente o armazenamento local para o backend Apps Script + Google Sheets.
