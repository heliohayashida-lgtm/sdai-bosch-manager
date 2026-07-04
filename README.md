# SDAI Bosch Manager v5.1.4

Correções desta versão:

- Remove definitivamente os botões de banco do topo. Banco fica somente em Sistema → Banco de Dados.
- Google Sheets estruturado por abas: Paineis, Lacos, FLMs, Portas, Locais, Equipamentos, Falhas, Plano_Acao etc.
- Correção do salvamento no Apps Script via POST de formulário/no-cors.
- Configuração do intervalo de gravação automática: 10, 15, 30, 60, 120 ou 300 segundos.
- Menu responsivo e recolhível.

Instalação:

1. Suba todos os arquivos no GitHub.
2. Substitua o Código.gs do Apps Script por apps-script/Code.gs.
3. Implante uma NOVA VERSÃO do Apps Script.
4. Abra o GitHub Pages com Ctrl+F5.
5. Vá em Sistema → Banco de Dados.
6. Clique em Configurar / validar banco.
7. Importe a base ou use os dados existentes.
8. Clique em Sincronizar agora uma vez para validar. Depois o autosync assume.
