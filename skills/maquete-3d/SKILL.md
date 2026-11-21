---
name: maquete-3d
description: Cria maquetes 3D animadas e explicativas (mundo em miniatura isométrico, bonequinhos, veículos, cidades, rios, lojas, celulares com app — tudo em código, sem arquivo 3D) e grava em MP4 para usar como trecho de vídeos narrativos, Reels, Stories, TikTok, YouTube e anúncios. Serve para qualquer tema: divulgação de produto ou serviço (ex.: o caminho de um pedido de delivery, o entregador andando, como um app funciona), vídeos-história, explicações de processo, logística, infraestrutura, política e regiões (há pacote pronto do Amazonas: rios, balsas, BR-319). Use SEMPRE que o usuário pedir "3D", "maquete", "animação explicativa", "mapa animado", "cena 3D pro vídeo", "bonequinho andando", "mostrar o caminho de...", "simulação" ou uma explicação visual em movimento para vídeo. NÃO use para sites/landing pages, imagens estáticas, pessoas realistas ou rostos, a menos que o usuário peça explicitamente. Motor: Simulator (Nyxera0x, MIT).
---

# Maquete 3D para vídeos

Transforma um trecho de roteiro em uma **maquete 3D animada**: mundo em miniatura, câmera que só desliza e dá zoom,
um **herói** (um pedido, um entregador, um caminhão, um documento, um cliente) seguido do início ao fim, e grava em
**MP4 pronto para edição**. A maquete é um *trecho* do vídeo (15–40 s); narração, selfie, música e legenda entram
na edição (CapCut/Premiere).

O motor fica em `engine/` (Simulator, MIT). Leia `engine/ENGINE.md` antes da primeira cena: regras técnicas de
render(t), caminhos, colisão e captura. Este arquivo diz **como usamos o motor**.

## Quando usar / quando não usar

| Usar | Não usar (salvo pedido explícito) |
|---|---|
| Vídeo explicando como um serviço/produto funciona (delivery, app, atendimento) | Sites, landing pages, telas de sistema |
| Vídeo-história / narrativo com uma rota, um processo, um antes x depois | Imagem estática, post de carrossel (use design normal) |
| Logística, infraestrutura, região, cidade, problema público | Pessoas realistas, rostos, retrato de alguém |
| Anúncio curto com "maquete" chamativa no gancho | Cenas com câmera em primeira pessoa, cortes rápidos, ação de filme |

Se a ideia couber melhor em outra coisa (vídeo de IA realista, motion 2D, gravação real), diga isso em uma frase.

## Pacotes de referência (abra o que se aplica)

- `references/catalogo-geral.md` — peças universais: bonequinhos, cidade, casas, lojas, moto, carro, celular gigante
  com app, armazém; paletas neutra e "cor da marca". **Sempre.**
- `references/produtos-servicos.md` — cenas de produto/serviço (delivery, app, serviço local, SaaS), regras comerciais.
- `references/amazonas.md` — pacote regional do Amazonas: rios, balsa, BR-319, floresta, ribeirinhos.
- `references/regras-politicas.md` — **só** quando o vídeo for de político/campanha.
- `references/roteiro-narrativo.md` — onde a maquete entra no vídeo e o beat sheet. **Sempre.**

Outro lugar/tema (sertão, cidade grande, praia, fazenda, fábrica)? Monte um mini-pacote no próprio beat sheet:
3–5 cores, 5–10 peças típicas, 1 herói — no mesmo formato do `amazonas.md`.

## Primeira vez na máquina/sessão

```bash
cd "<pasta-desta-skill>/engine" && npm install
# Só se não houver Chromium: npx playwright install chromium
export CHROMIUM=/opt/pw-browsers/chromium   # sessão na nuvem do Claude Code, se o playwright não achar o navegador
```
Node 20+, `ffmpeg` e Python 3. Peça a aprovação do usuário antes do `npm install` (código de terceiros revisado: só
acessa internet para ElevenLabs, opcional, e Openverse, sons CC0).

## Fluxo de trabalho (sempre nesta ordem)

1. **Entender o trecho.** Pergunte só o que faltar: mensagem em 1 frase, herói, de onde a onde, o "momento-chave"
   (o problema ou o diferencial), duração, formato (9:16, 4:5, 16:9), tipo de peça (produto, história, política).
2. **Beat sheet** (`references/roteiro-narrativo.md`): tempo → acontece → texto na tela. Mostre e espere OK.
3. **Kit base mais próximo** em `engine/sims/`, copiado para `sims/<nome>-shared/` e `sims/<nome>-film/`:
   rota entre lugares (entrega, viagem) → `warehouse-*`; item passando de mão em mão (pedido, carga, documento) →
   `airport-*`; algo sendo construído/montado → `site-*`; linha de produção/etapas fixas → `plant-*`.
4. **Modelos e paleta** do(s) pacote(s) de referência. Cena grande: 2 subagentes com `engine/docs/BRIEF.md`
   (A: cenário/prédios/terreno; B: veículos/bonequinhos/objetos).
5. **Mundo em função do tempo** (`world.js`) e **câmera** (`film.js`) pelas regras do ENGINE.md.
6. **Revisar**: folha de quadros nos beats + varredura de colisão. Mostre a folha ao usuário antes do render final.
7. **Gravar** e entregar MP4 + folha de quadros + beat sheet.

## Como adaptamos o Simulator

| Original (aeroporto) | Nosso uso |
|---|---|
| Painel de software por cima | **HUD de vídeo**: título curto, barra de etapas (ex.: Pedido → Preparo → Entrega → Na sua porta), 1 número grande (minutos, km, R$, dias). Em vídeo de app, pode aparecer um **celular gigante** na maquete mostrando a tela. |
| Paleta azul/branco/lavanda | Paleta do pacote (ou da marca do produto, só no herói e no HUD) |
| Sem pessoas | **Bonequinhos** estilo brinquedo (ver catálogo geral): andam por caminho, sem rosto detalhado |
| Filme único de 50 s | 1 maquete = 1 trecho de 15–40 s; história longa = 2–4 maquetes |
| Clique troca o card | Destaque no herói (caixa wireframe + brilho + rota no chão) e entrada do texto da etapa |
| Trilha ElevenLabs | Só sons de ação (ou mudo); música e narração na edição |
| Tudo baixo | Mesma regra: nada alto no centro; avião/prédio alto sempre de lado |

## Formatos de gravação

```bash
node sims/build.mjs <nome>-film
node sims/capture.mjs <nome>-film --size 1080x1920 --dpr 1 --out simulator-out/<nome>-9x16.mp4   # Reels/Stories/TikTok
node sims/capture.mjs <nome>-film --size 1080x1350 --dpr 1 --out simulator-out/<nome>-4x5.mp4    # Feed
node sims/capture.mjs <nome>-film --size 1920x1080 --dpr 1 --out simulator-out/<nome>-16x9.mp4   # YouTube
node sims/capture.mjs <nome>-film --stills 0,4,8,12,16,20 --cols 3 --out simulator-out/<nome>-folha.png
```
9:16: nada importante nos 250 px de cima nem nos 450 px de baixo; herói no terço do meio.
Entregue também uma versão **sem HUD** para o editor pôr a própria legenda.

## Regras gerais de conteúdo

- Maquete é ilustração: em mapas/rotas, "Ilustração fora de escala".
- Números só com fonte (oficial ou dado real do produto). Sem fonte → contador qualitativo, nunca inventado.
- Sem marcas, logos ou pessoas reais de terceiros.
- Produto/serviço: ver `produtos-servicos.md` (não prometer prazo/preço que o serviço não cumpre).
- Política: ver `regras-politicas.md` (rótulo de IA obrigatório).

## Entrega

MP4 no formato pedido + versão sem HUD + folha de quadros + beat sheet (com fontes). Diga a duração e onde entra a
narração. Próximo passo sugerido: gravar a fala que cobre a maquete e montar na edição.
