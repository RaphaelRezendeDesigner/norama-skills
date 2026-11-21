# Pacote regional: Amazonas — peças, paleta e cenas

Use junto com `catalogo-geral.md` (bonequinhos, cidade, veículos comuns). Peça política? Some `regras-politicas.md`.

## Paleta (estilo miniatura, cores limpas, fosco)

| Uso | Cor | Hex inicial (ajustar no render) |
|---|---|---|
| Chão/várzea | verde-claro suave | `#cfe3c2` |
| Copa de floresta (2–3 tons) | verdes | `#3f8f5a`, `#57a86b`, `#2f7a4c` |
| Rio Negro | escuro, quase chá | `#3a3530` |
| Rio Solimões / Amazonas / Madeira | barrento | `#c49a6c` |
| Igarapé / água limpa | azul-esverdeado | `#5fa8a0` |
| Estrada de terra / atoleiro | laranja-terra / marrom molhado | `#c8743a` / `#8a5a34` |
| Asfalto | cinza-azulado | `#5d6470` |
| Faixas, casas | branco quente | `#f6f2ea` |
| Cobertura de casa/porto | telha / azul-metal | `#c0553a` / `#4f7fb8` |
| Máquinas e herói | amarelo (só no que trabalha) | `#f2b630` |

Regra do original: poucas cores; o amarelo marca só o que está trabalhando/herói. Céu não aparece (câmera a ~36°).
Use tom "Neutral" no tone mapping (ver ENGINE.md passo 3) e compare o chão com o hex depois do primeiro still.

## Peças (cada uma é uma função que devolve `{group, ...}`)

**Terreno/água (subagente A)**
- Rio como faixa larga com margens arredondadas; leve animação de textura (deslocar UV com o tempo, puro de `t`).
- Encontro das águas: duas faixas (negro + barrento) correndo lado a lado sem misturar.
- Floresta: tapetes de copas (esferas/“brócolis” agrupados), instanciados; nunca árvore alta isolada no centro.
- Ponte comum (vão curto) e ponte estaiada (Rio Negro) — estaiada sempre de lado/longe.
- Porto/balsa: rampa de concreto, flutuante, cobertura.
- Cidade em blocos (Manaus, Humaitá, Porto Velho, Presidente Figueiredo): 6–12 prédios baixos, placa com nome.
- Estrada: asfalto com faixa, terra com sulcos, poças e trecho alagado; marcos de km (placas pequenas).
- Ramal (estrada vicinal) de terra estreito ligando roça à estrada.
- Roça/plantação (fileiras), curral, casa ribeirinha de palafita.
- Cachoeira (Presidente Figueiredo): degraus com água branca animada.

**Veículos (subagente B)** — escala ~1,5x, formas grossas e arredondadas
- Caminhão baú, carreta graneleira, caminhonete, carro de passeio, ônibus intermunicipal.
- Caminhão atolado (rodas meio enterradas, inclinação) e trator puxando.
- Balsa com caminhões em cima + empurrador.
- Barco regional (recreio de 2 andares), voadeira, canoa.
- Avião pequeno (bimotor regional) e jato de linha — só atravessando a cena pelo lado.
- Máquinas de obra: motoniveladora, rolo compactador, caminhão de asfalto (usar o kit `site-*`).
- Carga herói: caixa/saca/peixe em caixa térmica com etiqueta.

## Cenas prontas (pontos de partida)

1. **BR-319 — "o trecho do meio"** (kit `warehouse-*`)
   Manaus → travessia de balsa (Careiro) → asfalto → trecho do meio sem pavimento (atoleiro, caminhão parado, contador
   de horas/dias subindo) → Humaitá → Porto Velho. Barra de etapas no topo.
   Dados a confirmar no DNIT antes de publicar: extensão total (~885 km Manaus–Porto Velho) e extensão do trecho
   do meio (~400 km sem pavimento).
2. **Antes x depois da estrada** — a mesma rota duas vezes: primeiro com atoleiro (contador alto), depois asfaltada
   (contador baixo). Ótimo para fechar com a proposta.
3. **Escoamento da produção** (kit `airport-*`, carga passando de mão em mão)
   Roça → ramal (caminhonete) → estrada → porto → balsa/barco → feira em Manaus. Herói: a saca/caixa.
4. **Travessia e espera da balsa** — fila de caminhões, relógio, balsa indo e vindo.
5. **Rio x estrada x avião** — três formas de chegar a um município: barco (dias), estrada (horas), avião (preço).
   O avião cruza de lado.
6. **Burocracia (regularização fundiária)** — o "herói" é uma pasta/documento indo de prédio em prédio (órgãos com
   nome genérico), contador de anos subindo. Sem logomarcas reais de órgãos.

## Escalas de referência (metros de cena)

- Pista de estrada: 7 m; ramal: 4 m; caminhão baú: 9 m de comprimento x 3,5 m de altura.
- Rio "largo" na maquete: 60–120 m (comprimido; o real é muito maior — por isso o aviso "fora de escala").
- Balsa: 40 m x 12 m, convés a y = 1,2. Rampa do porto encontra o convés em y = 1,2.
