# SDAI Manager — Design System v8.0

## O problema real da vez anterior

Você tinha razão em cobrar mais. A causa raiz não era "faltou aplicar CSS" —
era que o arquivo tinha **acumulado 6-7 gerações de CSS competindo entre si**
(builds V5.2 → V5.3 → V5.4 → V6.0 → 6.1 → 6.6), cada uma com seu próprio
conjunto de variáveis (`--blue`, depois `--premium-blue`, depois
`--brand-blue`, todas coexistindo) e várias definições diferentes para o
mesmo componente (`.card`, `.top`, `.premiumStat` apareciam redefinidos 3–4
vezes). O resultado era uma colcha de retalhos visual, não um sistema.

Como as suas regras absolutas protegem **lógica/JavaScript**, não CSS, desta
vez eu **substituí toda a folha de estilos por uma única e coerente** — sem
tocar em nenhuma função, nenhum `onclick`, nenhum fluxo de dados, nenhuma
integração com Google.

## Paleta premium (tokens `--l3a-*`)

| Papel | Cor | Uso |
|---|---|---|
| Primária | `#0B5FAD` (600 `#0A4F92`, 700 `#073A6E`) | botões principais, links, foco |
| Secundária | `#0E2A44` → `#050F1B` | menu lateral (gradiente) |
| Destaque | `#0EA5B7` | gráficos, acentos |
| Sucesso | `#15803D` / fundo `#E7F7EC` | operação normal |
| Alerta | `#B45309` / fundo `#FDF3DF` | em teste / atenção |
| Erro | `#B42318` / fundo `#FCEAE9` | falhas |
| Informação | `#1D4ED8` / fundo `#EAF1FE` | avisos neutros |
| Fundo do app | `#F3F6FA` | — |
| Superfície (cards) | `#FFFFFF` | — |
| Borda | `#E2E8F1` (forte `#CBD6E4`) | — |
| Texto primário / secundário / discreto | `#101828` / `#51617A` / `#8695AB` | — |

Escala de raio: `8 / 12 / 18 / 999px` · Sombras: `sm / md / lg` em 3 níveis de
elevação · Fonte: **Plus Jakarta Sans** em toda a interface.

Todas as variáveis antigas (`--blue`, `--brand-line`, `--premium-text` etc.)
continuam existindo como **alias** apontando para o novo sistema — então nada
quebra, mesmo que eu não tenha revisado cada uma das ~900 linhas de JS em
busca de um `var(--x)` esquecido.

## O que foi refeito de verdade (não só cor)

1. **Cards / KPIs** — sombra em camadas, hierarquia de título/subtítulo,
   números grandes e com peso, barra de destaque lateral nos metrics.
2. **Menu lateral** — item ativo com gradiente + sombra colorida, hover com
   leve deslocamento, ícones com cor de estado, grupos em acordeão mantidos.
3. **Cabeçalho** — o indicador de sincronização, que antes era uma bolha
   flutuante sobre o conteúdo, agora mora dentro do cabeçalho junto ao
   relógio e ao usuário — mais organizado, sem elemento "solto" na tela.
4. **Tabelas** — cabeçalho discreto, hover suave, coluna de ações alinhada à
   direita **apenas quando há botões** (`:has(.btn)`), sem bagunçar colunas
   de dados comuns.
5. **Botões** — hierarquia real: primário / secundário / perigo / pequeno,
   com hover, pressed (`:active`), foco visível e estado desabilitado.
6. **Inputs** — anel de foco azul consistente, checkboxes/radios com
   `accent-color`, mesmo raio e espaçamento em todos os campos.
7. **Modal/drawer** — agora tem um **botão de fechar (X)** próprio, fixo no
   canto superior direito do drawer — antes só existia "Cancelar" dentro do
   formulário.
8. **Login, badges, gráficos (donut/barras), relatório de impressão** —
   todos migrados para os mesmos tokens, mesma escala de raio e sombra.
9. **Espaçamento** — grid de 8px como base para paddings/gaps em todo o
   sistema novo.
10. **Microinterações** — transições de 160ms em hover/foco/ativo de menu,
    botões, cards e inputs, sempre respeitando "reduzir movimento".

## Correção importante que eu mesmo cometi e já resolvi

Ao substituir a folha de estilos inteira, as regras de **impressão**
(`@media print`) que escondem o menu/cabeçalho e formatam o relatório para
PDF ficaram de fora na primeira passada. Percebi antes de finalizar e as
recoloquei, adaptadas aos novos tokens — a exportação de relatório para PDF
continua funcionando exatamente como antes.

## O que continua fora do escopo (por decisão sua)

O arquivo ainda tem **funções JavaScript duplicadas** (mesmo nome declarado
mais de uma vez ao longo das versões — ex.: `render()`, `applyNavPermissions()`,
`renderUsuarios`/`editUser`/`addUser`). Isso não quebra nada hoje porque em
JavaScript a última declaração vence, mas é dívida técnica visível se alguém
abrir o código. Como a regra absoluta é **não remover nenhuma função
existente**, mantive tudo como estava. Se um dia quiser essa limpeza (só
remoção de código morto, testada passo a passo), é um pedido separado.

## Code.gs

Sem alterações — o trabalho desta vez foi 100% front-end/visual, como pedido.

## Publicação

1. Substitua o `index.html` no GitHub Pages pelo novo arquivo.
2. `Code.gs` não muda, não precisa reimplantar o Apps Script.
3. Recarregue com **Ctrl+F5** para garantir que a fonte e o CSS novos sejam
   buscados sem cache.
4. Vale conferir rapidamente: login → dashboard → abrir uma tabela (ex.
   Painéis, editar um registro no drawer e testar o novo X de fechar) →
   gerar um relatório e imprimir/exportar PDF → menu recolhido no desktop →
   menu em gaveta no celular.
