# The model brief (a template, filled in for the airport)

Give this file to the 2 subagents that build the models. Swap everything in [brackets] for your system. The airport in
`sims/airport-shared/` was built from exactly this brief.

## What this is

We are rebuilding [an airport] in the format of [one reference video that already worked]. The look must be as close to
the reference as we can get: when we invent our own look, it comes out weak. Your job is the **3D models only**. The
world layout, the camera, the UI and the film come afterwards on top of your kit.

## Study the reference first

`ref/`: [12-15 full-size frames of the reference video, one every 3-5 seconds]. Open them before writing anything.
Write down what makes the look, then check it against the frames again:
- **Toy proportions.** Vehicles big against the buildings, simple chunky rounded forms. Small real details are left
  out; the ones that stay are made bigger.
- **Premium finish.** Generous bevels on every edge, matte paint with a soft sheen, soft contact shadows, crisp dark
  tyres with light hubs, dark glass, neat panel lines, logos and numbers printed cleanly. Cheap = flat boxes, sharp
  corners, noisy detail, plastic shine.
- **Few colours.** [Blue and white on a lavender ground. Yellow only on the working machines, green only on trees, a
  second livery in teal in small amounts.]
- **Readable at a glance.** Every object recognisable from its silhouette at thumbnail size.

## The shared look

`style.js` holds the palette (sampled from the frames with ffmpeg), the shared materials, cached rounded boxes, a
label texture for liveries and numbers, and the stage. Use it; don't redefine colours. If you need a colour it lacks,
sample it from the frames and say so in your report.

## Scale contract

Both kits must meet each other at these numbers [the airport's]:
- Airliner: fuselage 46 m long, 7 m across, span 44 m, fin tip 15 m. **Cargo door sills at y = 3.2, passenger door
  sills at y = 5.0.**
- Ground vehicles at about 1.5x real size. The high loader's front deck rises to 3.2, the belt loader's top end to
  3.4, the catering box to 5.0.
- Buildings: gates 60 m apart, the jet bridge's cab floor at 5.0 when docked.

## Agent A: [airside]

[The jet in 2 liveries, the terminal pier, the jet bridge, the cargo terminal, the tower, a hangar, an apron light,
trees, fences, city blocks.] Each one a function returning `{group, ...}` with its moving parts and its key points
(door sills, dock positions, park positions).

## Agent B: [ground vehicles]

[Tug, dolly, ULD container, belt loader, high loader, catering truck, fuel truck, pushback tug, bus, follow-me car,
stairs truck, box truck, forklift, cones, chocks.] Each one returns `{group, roll(distance), ...}` plus its moving
parts: `setFront(h)`, `setBox(h)`, `setForks(h)`, `setBoom(k)`. **Start with [the reference's own box truck and
forklift] and match them side by side until a stranger couldn't tell them apart**, then give every other vehicle the
same treatment.

## How to work

1. Read the frames, `style.js` and `stage.js`.
2. Build a bench page: every model on the ground under the stage, laid out like one of the reference's scenes.
3. Build and capture: `node sims/build.mjs <bench>` then `node sims/capture.mjs <bench> --still 2 --out a.png`.
4. Compare side by side with the reference at the same angle and scale. Iterate.
5. Close-up stills of every model plus one whole-scene still.

## Rules

- Touch only your own files.
- No downloads, no new packages. Everything is three.js already in the kit.
- No people built in code: cabs get dark glass.
- Merge static parts per material and instance repeated parts, so a scene with 3 jets and 30 vehicles renders fast.
- Report in under 25 lines: what you built, the exported API, the still paths, and anything in `style.js` you would
  change and why.
