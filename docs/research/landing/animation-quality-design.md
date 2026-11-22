---
title: "How can the characters in the six origin scenes be animated to a higher standard without replacing what exists?"
type: design
created: 2026-11-22
updated: 2026-11-22
tags: [welcome-page, animation, three.js, characters]
status: approved
author: mixed
---

# Character animation quality in the origin scenes

Owner instruction, 22 November 2026: "this is much better; is there a way to improve the animation characters though, keep it all; how to improve the quality of the animation; provide ICE recommendations and options; do not change anything yet without my authorization."

Nothing in the scenes is changed by this document.

## Research question

Which changes to the people in the six scenes raise the perceived quality of the animation most, per unit of work, while keeping the scenes, the sets, the bag, the lines and the real-time film as they are?

## Where the characters stand today

From `src/components/welcome/scenes/film/kit.tsx` (`Figure`, `FigPose`):

| Part | Today | What it cannot do |
|---|---|---|
| Face | a head with two dots | blink, look at something, raise a brow, open a mouth, smile, wince |
| Arms | one straight cylinder from shoulder to hand, stretched to length | bend at the elbow, shrug; a long reach makes a long thin arm |
| Hands | a mitten (or a mitten with a phone) | point, grip, turn the wrist |
| Body | one rigid piece that leans from the feet | bend at the waist, twist, breathe, squash and stretch |
| Legs | fused into the body | step, shift weight, crouch, walk |
| Head | turn and nod | tilt, lead a move with the eyes |
| Clothing and props | rigid (scarf, lanyard, backpack, ear defenders) | lag, swing, settle after a move |
| Motion | each pose is a hand-written function of time with easing | overlap, follow-through, settle; everything stops at once |

The bag already has what the people lack: squash and stretch, a tag that swings as a weight on a loop, a lamp when it speaks. The people read as props next to it.

## Options, scored

ICE: Impact on perceived quality, Confidence that it will work in this code and style, Ease (10 is easiest). Each 1 to 10; score is the product. The numbers are the project manager's estimates from reading the code and the frames; none is measured.

| # | Option | What it adds | I | C | E | Score |
|---|---|---|---|---|---|---|
| A | Faces | Eyes that blink and look at the bag; brows; a mouth with six or seven shapes (closed, open, smile, "o", wince, laugh); an expression per beat | 9 | 8 | 8 | 576 |
| B | Arms with elbows and better hands | Two-bone arms solved to the same hand targets used today, so every existing pose still works; shoulders that lift; hands with a thumb that turn at the wrist; a pointing and a gripping hand | 7 | 8 | 7 | 392 |
| D | A body that moves | Waist bend and twist, breathing while idle, squash and stretch on reactions, and a spring layer so scarf, lanyard, backpack and hair lag and settle | 7 | 8 | 7 | 392 |
| I | The tag performs its lines | The speaker grille pulses with each syllable, the lamp follows the voice, the tag "leans in" to speak; ties directly to the voice-overs when they exist | 6 | 8 | 8 | 384 |
| E | An acting pass | Re-time every reaction with anticipation, a held pose, a take, overlap and settle; eyelines to the bag; people react one after another, not together. Needs A, B and D to pay off | 8 | 7 | 6 | 336 |
| C | Legs | Separate legs with knees and feet; weight shift, a step back, a crouch, a short walk in and out of frame | 7 | 7 | 5 | 245 |
| F | Rendering of the people | Cloth and skin read differently; soft shading in creases; an optional thin outline; a rim light per scene | 5 | 6 | 6 | 180 |
| K | Background life | Two or three background travellers who idle, glance and move on; belts and signs already move | 4 | 7 | 6 | 168 |
| J | Camera | Slight depth of field on close shots, a little motion blur on the toss, a small handheld drift | 4 | 6 | 6 | 144 |
| G | Authored, rigged characters | Replace the built figures with modelled, skinned characters animated by hand or from motion capture, loaded as files | 9 | 5 | 3 | 135 |
| H | A pre-rendered film | Render the six scenes offline to video | 8 | 5 | 2 | 80 |

## Three ways to go

1. **Expressive puppets (recommended): A, B, D, I, then E.** Keeps every scene, set, line and the present style. The people gain faces, elbows, a flexible body and timing. No new library, no downloaded assets, everything still drawn in code. It is the largest gain for the least risk.
2. **Option 1 plus C, F and K.** Adds legs, better rendering of the people and background travellers. More work and more to draw each frame, so the frame rate has to be re-measured on a phone.
3. **Authored characters (G).** The highest ceiling and the biggest change: the figures are replaced, so it does not "keep it all". It needs a decision the others do not: who makes the characters. They would be modelled by a person or taken from a published human-made library under a licence that allows it; nothing would be machine-generated.

H is listed for completeness and not recommended: it gives up the real-time film, the thumbnails that jump to a scene and the small page weight.

## Constraints

- The owner's rule: drawn or real visuals only, no generated imagery. Options A to F, I, J and K are drawn in code. G needs human-made assets and a licence check.
- No pause control; reduced motion still gets the drawn stills; the stills would be redrawn only if the figures change shape.
- The film must hold its frame rate on a phone; each set is one merged mesh and a frame draws about 100 calls. Options C, F, J and K add cost and must be measured on a real device, which has not been done for the present film either.
- Every line stays word for word.
- All files, if any are added (G), are stored as the app stores files.

## How success is judged

Before any work, the owner names the scenes and moments that most need it. After, a reviewer who has not seen the work scores each scene's character animation on a fixed list (faces readable at phone size, no straight-arm reaches, reactions staggered, settle after every move, eyelines correct), and the owner gives the score that counts. A null result is the owner seeing no difference at normal size; that would point to option 3.

## Scope boundaries

Not in this question: the sets, the bag's own animation beyond the tag speaking, the lines, the voice recordings themselves, the rest of the welcome page.

## Owner's choice, 22 November 2026

Authorized, in this order: A, B, C, D, I, E, F, K, J. Not chosen: G (authored characters) and H (pre-rendered film). Everything existing is kept.

## Next step

The owner chooses a way to go, or names the moments that bother him most. Then a plan is written; nothing is built before that.
