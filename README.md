# SDAI Bosch Manager — V4 correto integrado ao Google

Este pacote usa o arquivo correto `sdai_bosch_manager_v4_buscas_corrigidas.html` como base.

## O que subir no GitHub

Suba todos os itens da pasta extraída:

- `index.html`
- pasta `js`
- pasta `apps-script`
- `README.md`

## O que substituir no Apps Script

1. Abra o Apps Script.
2. Abra `Código.gs`.
3. Apague tudo.
4. Cole o conteúdo de `apps-script/Code.gs`.
5. Salve.
6. Vá em `Implantar > Gerenciar implantações > Editar`.
7. Selecione `Nova versão`.
8. Clique em `Implantar`.

## Teste

No GitHub Pages:

1. Clique em `Configurar Banco Google`.
2. Clique em `Salvar agora`.
3. Abra o Apps Script/planilha criada e confirme a aba `DB`.
4. Em outro computador, abra o mesmo link e clique em `Carregar Google`.

Observação: este pacote mantém o banco local como cache, mas permite sincronizar com o Google Sheets.
