# Catálogo geral — peças universais e paletas

## Paletas

**Neutra (padrão)** — funciona para qualquer tema; a cor de destaque vem da marca ou do tema.
| Uso | Hex inicial |
|---|---|
| Chão | `#ecebf3` (lavanda clara, como o original) ou `#eef0e8` (neutro quente) |
| Ruas | `#d9dbe3`, faixas `#ffffff` |
| Prédios/casas | `#ffffff`, `#f4f1ea`, telhado `#c9cfdb` |
| Vegetação | `#7fbf8a`, `#5aa36b` |
| Destaque (herói/marca) | **uma** cor só: a da marca, ou amarelo `#f2b630` |
| Texto/HUD | `#1d2433` sobre cartões brancos com sombra suave |

**Cor da marca**: use a cor principal da marca só no herói (moto, mochila, caixa do pedido, uniforme) e no HUD.
O resto da cena fica neutro — é o contraste que faz o herói "saltar".

Tone mapping Neutral; confira o chão no primeiro still (ENGINE.md, passo 3).

## Bonequinhos (pessoas estilo brinquedo)

O motor não traz pessoas: modele assim (subagente B).
- Corpo em cápsula arredondada, cabeça esfera, braços/pernas cilindros grossos; altura ~1,8 m na escala 1,5x.
- Sem rosto detalhado (no máximo dois pontos de olho). Diferencie por cor de roupa, boné, mochila, capacete.
- Variantes: entregador (mochila térmica com a cor da marca + capacete), cliente, atendente/cozinheiro (avental),
  produtor rural (chapéu), motorista, idoso (bengala), criança (menor), pessoa com celular na mão.
- Animação pura de `t`: andar = balanço de pernas/braços em seno da distância percorrida (não do tempo), pé no chão.
- Gestos simples: acenar, entregar caixa (caixa passa de uma mão para outra), olhar o celular.

## Peças urbanas
Quarteirões com prédios baixos, casas com quintal, condomínio com portaria, loja/restaurante com toldo e balcão,
mercado, farmácia, escritório, praça, ponto de ônibus, semáforo, faixa de pedestre, posto, estacionamento.

## Veículos
Moto de entrega (baú), bicicleta, patinete, carro, caminhonete, van, caminhão baú, ônibus, drone pequeno (voando baixo).

## Objetos e "tela"
- **Celular gigante**: um smartphone em pé na cena (ou flutuando ao lado) com a tela em textura HTML/canvas
  atualizada por `t` — mostra o app (pedido aceito, mapa, "chegou!"). Ótimo para produto digital.
- Pin de mapa flutuante, balão de notificação, caixa/sacola/pizza, documento/pasta, moeda/cartão, relógio,
  check verde ao concluir uma etapa.

## Regiões e outros cenários
- Amazonas: `amazonas.md`.
- Outros lugares: mini-pacote no beat sheet (3–5 cores, 5–10 peças, 1 herói). Ex.: sertão (chão `#e8cf9a`, cactos,
  açude, caminhão-pipa), litoral (areia, mar, coqueiros, barco), fazenda (lavoura em fileiras, silo, trator),
  centro de cidade grande (prédios baixos com recuo, metrô como trem de superfície, ciclovia).
