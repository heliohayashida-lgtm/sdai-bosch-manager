# SDAI Bosch Manager v5.1.3

Correção definitiva do fluxo GitHub Pages + Apps Script + Google Sheets.

## Corrige
- Remove comandos do topo: banco fica em Sistema → Banco de Dados.
- Mantém menu lateral recolhível e responsivo.
- Apps Script aceita ações antigas e novas: setup, setupDatabase, getDb, saveDb.
- Banco estruturado por abas no Google Sheets.
- Autosync após alteração e a cada 30 segundos.

## Instalação
1. Suba todos os arquivos no GitHub e faça commit.
2. No Apps Script, substitua todo o Código.gs por apps-script/Code.gs.
3. Implante como nova versão do Web App.
4. Abra o GitHub Pages com Ctrl+F5.
5. Vá em Sistema → Banco de Dados.
6. Clique em Configurar / validar banco.
7. Clique em Sincronizar agora.
