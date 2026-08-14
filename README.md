# Lista LS — App de lista de compras

App de lista de supermercado da família, com **lista compartilhada entre dois celulares**,
ditado por voz, importação por foto (OCR) e relatórios de consumo.

- **No ar:** https://lista-supermercado.eng-leandrofurtado.workers.dev
- **Hospedagem:** Cloudflare Workers (assets estáticos + API)
- **Banco:** Cloudflare Workers KV
- **Instalação no celular:** abrir no Safari → Compartilhar → *Adicionar à Tela de Início*

---

## Estrutura dos arquivos

| Arquivo | O que faz |
|---|---|
| `index.html` | **O app inteiro** — HTML, CSS e JS num arquivo só. É aqui que quase toda mudança acontece |
| `worker.js` | API de sincronização. Serve os assets e responde em `/api/lista/:codigo` |
| `wrangler.jsonc` | Configuração do Cloudflare: aponta o `worker.js` e liga o banco KV |
| `sw.js` | Service worker — faz funcionar offline e atualizar sozinho quando sai versão nova |
| `manifest.json` | Nome e ícone do app quando instalado no celular |
| `icon-192.png` / `icon-512.png` / `apple-touch-icon.png` | Ícones (carrinho verde) |
| `.assetsignore` | Impede que `.git`, `worker.js` e docs sejam servidos publicamente |
| `.gitignore` | Ignora o `.DS_Store` do Finder |

---

## Funcionalidades

### Lista
- Toque marca o item como comprado (risca, fica verde e desce para o fim)
- Dois modos de visualização: por categoria ou alfabético
- Barra de progresso e contador por categoria
- Adicionar item com autocomplete e quantidade
- Lixeira em qualquer item (itens padrão removidos voltam se digitados de novo)
- **Confete** quando a lista é concluída 🎉

### Entrada de itens
- **Falar itens** — ditado por voz com popup de revisão antes de enviar
- **Importar foto** — OCR (tesseract.js) de print de WhatsApp, Alexa ou lista escrita
- **Importar/Exportar PDF** — o PDF carrega os dados embutidos nos metadados
- Digitação manual com sugestões

### Leitura por voz
- Botão de alto-falante em cada categoria lê os itens **não comprados** em loop
- Pausa de 1 segundo entre itens, velocidade reduzida
- **Wake Lock** mantém a tela acesa enquanto lê

### Lista compartilhada (sincronização)
- Campo "código da lista" — o mesmo código nos dois celulares = uma lista só
- Automática: envia e busca mudanças sozinho (a cada ~6s com o app aberto)
- **Funciona offline**: grava no aparelho e envia quando voltar a internet
- Sem login e sem senha (quem souber o código vê a lista)

### Relatórios de compra
- Períodos: 30 dias, 90 dias, 6 meses ou tudo
- Mais comprados / menos comprados, com frequência ("a cada ~7 dias")
- **"Talvez esteja na hora de comprar"** — detecta itens que passaram do intervalo
  habitual; toque para adicionar à lista
- Totais e distribuição por categoria

---

## Como a sincronização funciona

O estado da lista vira um documento com **carimbo de tempo por item**:

```
{
  d:  { "m:cafe": true, "e:leite": {nome, qtd, cat}, "r:arroz": true, "h:cafe:1723..." : {...} },
  ts: { "m:cafe": 1723500000000, ... }
}
```

Prefixos das chaves:

- `m:` — item marcado como comprado
- `e:` — item extra (adicionado pelo usuário)
- `r:` — item padrão removido
- `h:` — **histórico de compras** (alimenta os relatórios)

Ao juntar duas versões, **para cada chave vence quem tem o carimbo mais novo**.
Isso faz as mudanças dos dois celulares se somarem, mesmo feitas offline,
sem uma apagar a outra.

> ⚠️ As chaves `h:` (histórico) **nunca são apagadas** — nem pelo botão "Nova lista".
> Isso é proposital: perder meses de histórico por um toque acidental seria uma pena.
> Veja a proteção na função `carimbar()`.

### API

| Rota | Método | O que faz |
|---|---|---|
| `/api/lista/:codigo` | `GET` | Devolve o documento guardado |
| `/api/lista/:codigo` | `POST` | Junta o documento enviado com o guardado e devolve o resultado |

Qualquer outra rota serve os arquivos do app.

---

## Correção do ditado por voz

O motor de correção fica em `index.html` (`corrigirFala` / `avaliar`) e funciona em camadas:

1. Descarta ruído — palavras que não são itens de mercado (`NAO_ITEM`: "mão", "sim", "então"...)
2. Testa as **várias hipóteses** que o iPhone devolve, escolhendo a que bate com o dicionário
3. Remove verbos e quantidades ("coloca arroz" → Arroz; "dois quilos de carne" → Carne)
4. Busca exata no dicionário (~327 itens)
5. Busca **fonética** (`fonetico()`): "sebola" → Cebola, "xuxu" → Chuchu, "keijo" → Queijo
6. Busca por similaridade (Levenshtein) com limite de confiança
7. Não reconheceu? Entra marcado com **"?"** para conferência antes de enviar

**Para adicionar itens ao dicionário:** procure `const dic = {` no `index.html`
e inclua o nome na categoria correspondente.

---

## Como publicar uma alteração

### Pelo site do GitHub
1. Abrir o repositório → **Add file** → **Upload files**
2. Arrastar o arquivo alterado (substitui o existente)
3. **Commit changes**

### Pelo terminal
```bash
cd /Users/leandrofurtado/Documents/Claude/Projects/LISTA-LS-SUPERMERCADO
git add .
git commit -m "descrição do que mudou"
git push
```

Nos dois casos o **Cloudflare republica sozinho em ~1 minuto**.
No celular, o app detecta a versão nova e recarrega automaticamente.

**A lista salva não é apagada nas atualizações** — os dados ficam no aparelho e no KV.

### Testar antes de publicar
```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```
Local, o ditado de voz e a sincronização não funcionam (precisam de HTTPS e da API).
O resto dá para conferir.

---

## Limitações conhecidas

- **Ditado por voz exige HTTPS e Safari** — não funciona em navegador embutido de
  outro app nem em arquivo local (`file://`)
- **Voz com a tela apagada no botão é impossível** em app web no iPhone (restrição da Apple).
  O Wake Lock só evita o bloqueio automático
- **Sem senha na lista compartilhada** — use um código difícil de adivinhar
- **"Nova lista" apaga para os dois** quando a sincronização está ligada
- PDF enviado no WhatsApp precisa ir **como documento**, não como foto,
  senão os dados embutidos se perdem

---

## Ambiente

- **Pasta local:** `/Users/leandrofurtado/Documents/Claude/Projects/LISTA-LS-SUPERMERCADO`
- **GitHub:** `leandrofurtado/lista-supermercado`
- **Cloudflare:** Workers & Pages → `lista-supermercado`
- **KV:** namespace `lista-supermercado-kv` (binding `LISTA`)

Bibliotecas carregadas via CDN: jsPDF (exportar), pdf.js (importar), tesseract.js (OCR).
Sem build, sem dependências instaladas — é só HTML, CSS e JS puro.
