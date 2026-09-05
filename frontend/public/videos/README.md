# Hero videos

`hero-16x9.mp4` and `hero-9x16.mp4` — the landing page and `/apple-design`
hero background (`CircuitVideoHero.tsx`). Both muted (no audio track at
all — stripped, not just silenced), looping, no controls; behaves like a
GIF, not a video player.

## Provenance

Source clip: a single-seater drifting/on-track clip supplied directly by
the project owner (`85447171-Race_car_driving_on_tarmac_*.mp4`, 1280x720,
~10s). The car carries a generic black/orange livery with no team name,
sponsor decal, or real driver likeness — no rights-clearance concerns
there. Per `docs/BRAND.md`'s Imagery section, real circuit footage is
allowed for this hero as long as it clears the same checklist a generated
clip would: no burned-in broadcast graphics, no sponsor logos/team
wordmarks, no readable real venue signage, and no footage the project
doesn't actually have the rights to use. This source is the owner's own
supplied file, not a scrape of official broadcast or licensed circuit
media, so it's usable; it does read as AI-rendered rather than a real
camera take (the trackside architecture visibly reshapes itself between
cuts — the same grandstand isn't self-consistent shot to shot — which real
footage can't do).

**One region needed a fix before use:** for the clip's opening shot
(0.0s-~1.8s), a trackside sponsor board is in frame — its text isn't
legible even at native resolution, but the layout (repeated red circular
mark + white wordmark on a black board) reads enough like a real
trackside sponsor board to fail the "no real venue signage" bar on sight,
same standard as the previous clip. Blurred out with a targeted `boxblur`
over that region for that time window only; verified by re-extracting
frames from the *output* across and just past the window to confirm it's
actually illegible now and the blur doesn't bleed into the next shot. The
rest of the clip was checked frame-by-frame (roughly 1 fps, plus the
transition points) and is clean: no logos, no other readable signage, no
visible driver face (helmet/visor only throughout).

## 9:16 crop

`hero-9x16.mp4` is a center-weighted crop of the cleaned 16:9 master
(`crop=404:720:340:0` — 720p height, 9:16 width), not a separate
generation. The source is one continuous drifting pan (plus a short static
opening shot) where the car's on-screen position drifts from roughly
centered to left-of-center over the clip; `x=340` was chosen by sampling
car position every ~0.5s across the whole clip and picking the offset that
keeps the cockpit and main car body in frame at every sampled timestamp —
front/rear wingtips clip at the extremes, which is the same acceptable
trade-off the previous clip's crop made, since a single static crop can't
track a moving subject frame-by-frame.

## Regenerating

If either file is ever replaced, re-run the same checks before shipping:
scrub through the new clip frame-by-frame for anything the checklist
above rules out, re-verify any crop/blur fix by re-extracting frames from
the *output* (not just trusting the filter graph), and re-sample car
position across the clip before picking a 9:16 crop offset.
