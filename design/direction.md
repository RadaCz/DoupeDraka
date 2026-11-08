# Design Direction

> Set by the designer via set_design_direction. Forwarded automatically into build briefs for this project. Update it with another set_design_direction call — do not hand-edit.

## Feel

A printed adventure module handed to you by a patient dungeon master — parchment, ink, one warm lamp. This is a solo 5e crawler; the prose IS the product, so the interface exists to make the journal feel like a journal and the dice feel like dice, never like a dashboard wearing a fantasy skin. Daylight-legible on a phone at a bus stop for a 20-minute session; patient, inhabited, slightly worn — never epic poster.

## Palette

Light parchment ground (user's brief: red and beige). :root { --bg:#F6F0E4; --surface-1:#FFFBF2; --surface-2:#EDE3CF; --border:#D8C9AC; --text:#241C14; --accent:#A32B22; --accent-hover:#86201A; --coin:#B58A3C (utility: currency only). } Accent is a VERB colour — the one next action, a crit, HP — max ~8% of any screen. Mana/slots are accent desaturations, not new hues. Contrast: text/bg 12.9:1, accent/bg 5.6:1, white/accent 6.1:1. No gradients except one 4% warm vignette on the narration panel.

## Typography

Display: Literata / Body: Source Serif 4 (both OFL, Czech diacritics at full weight — test "Přízračný"). The content is fantasy, the typography should be a good book: a contemporary book serif carries headings and location names, Source Serif 4's large x-height stays sturdy at 15-16px on a phone. Never swap the body to a sans — it reads as a bug report. 7-step fluid clamp scale (-1..5); display leading 1.08-1.15 tracking -0.02em; narration prose 1.72 at 62ch with text-wrap:pretty; tabular-nums on every stat, HP, dice total and gold; small caps for labels and OUTCOME markers.

## The Distinctive Move

The journal IS the interface: narration is never a chat bubble. Every turn writes into a continuous printed page — DM prose in body serif with a drop-cap opening a scene, mechanical results as right-aligned small-caps marginal notes ("HIT — 7 DAMAGE", "DEX CHECK · 14 vs DC 12 · FAILED"), dice as a thin inline rule above the result. Player intent is an italic indented marginal annotation with a hairline rule, not a different-coloured bubble; no left/right alignment, no avatars. The action bar is the only chrome, pinned like a page footer, with Attack/Cast/Continue the single accent verb.

## Section Rhythm

App screens, not landing sections — the page catalog does not apply here and no hero preset is forced into a game shell. Every screen is a custom composition against one identity: "printed module page".

screen-1: custom — Title. Type-led frontispiece: title in step-5 Literata, one line of prose, a single oxblood "Begin" verb, four location crests as a faint row. No art required to ship.
screen-2: custom — Character creation. A form on paper: one question per panel, ruled-label fields, class/race as a halfling-height list where the selected row gains a left accent rule; live stat-block preview right, stacks below on phone; printed step index, not a progress bar.
screen-3: custom — The Game (journal). Banner (location name, visit count) → journal page → pinned action bar. HP/slots/gold as a compact marginal strip on the sheet panel, never a top bar of numbers.
screen-4: custom — Character sheet. Printed SRD stat block: AC/HP/Speed on one small-caps line, abilities in a tight 3-column grid, conditions as ruled rows, spells full weight when modelled and greyed "not yet modelled" otherwise — never a silent slot refund.
screen-5: custom — Combat state. Same journal; the monster enters as a portrait card with its stat block in the margin; action bar swaps to Attack / Cast / Flee with Attack the only accent verb. Crit flips the result line to accent with the roll breakdown in one 220ms transform.
screen-6: custom — Death / end of session. Quiet, not dramatic: a 1px rule, the closing line in step-2, one oxblood verb back to title.
screen-7: custom — Shop (when built). A ruled price table with tabular numerals, coin glyph in --coin, one accent "Buy" verb. Where the missing gold sink gets a home.

## Imagery

Illustration, never photography — a crawler is imagined, a photo in a cloak breaks the fourth wall instantly. Woodcut / scraperboard line art with flat warm washes: ink lines #241C14 on parchment #F6F0E4, with oxblood #A32B22 the ONLY saturated colour in the frame (a lantern glow, a sigil, blood). Single warm source, low contrast, generous empty parchment around the subject; no deep blacks. Subjects isolated with no environment, placed into the layout as artefacts — no hero scenes, no warriors in fog. Mood: patient, inhabited, slightly worn; never epic. No text in images ever. Portraits 1:1, location banners 16:9, crests 1:1.

## Hero Layout

type-led: a large, characterful headline is the hero; the image is small or a texture.

## Hero Motion

still: hero-split, hero-editorial or hero-product — a still opener, only when the user asked for one, the brief is print-like or editorial, or motion is an accessibility concern; the feel says which.
