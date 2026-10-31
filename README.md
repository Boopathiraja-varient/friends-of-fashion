# Friends of Fashion — Diwali welcome

A single-page, static site for a men's ethnic-wear shop in Bodinayakanur, Theni
district. The opening film is drawn entirely in code (SVG + canvas), with real
CC0 firecracker recordings and a Web Audio synth fallback.

## Viewing it

Open `index.html` in a browser. No build step, no server required.

For the typefaces to load, the page needs an internet connection the first time
(Google Fonts). Everything else works offline.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page markup, the welcome film scene, inline SVG art |
| `styles.css` | Design tokens, layout, film staging, responsive rules |
| `script.js` | Film controller, fireworks canvas, sample/synth audio, nav, reveals |
| `assets/friends-of-fashion-logo.png` | Shop logo — used in the header, footer, film and as the favicon |
| `assets/collection/` | Product photos for the six collection pieces |
| `assets/audio/` | CC0 firecracker recordings (BigSoundBank) with a synth fallback |

## The welcome film

- Plays once per browser (not on every refresh), then stays out of the way.
- Runs for about ten seconds, skippable at any point. `Esc` also closes it.
- A vertical **saravedi** (a long string of firecrackers) hangs at the left edge
  of the film and goes off in a rapid chain, with real recorded pops and canvas
  sparks. It is decorative only; it does not change the page layout.
- On phones the film uses the full dynamic viewport height (`100dvh`), safe-area
  insets for the bottom controls, and a portrait-specific type/control rhythm.
- Replay it with the "Replay the welcome" button in the Diwali section.
  To see the automatic first-visit film again, clear this site's local storage
  (key `fof-welcomed-once`).
- Cracker sound is **on by default**. The page attempts to start it
  automatically on load. If the browser blocks unmuted autoplay, the welcome
  holds on its poster with "Tap anywhere for sound"; the first tap, click or
  key press resumes the audio and starts the film from the beginning, so the
  saravedi is not missed. The sound preference is remembered for the session.
- "Light the sky" in the Diwali section fires a burst on demand and switches
  sound on (that tap counts as permission).
- Visitors who prefer reduced motion never get the automatic film, and the
  ambient canvas effects are disabled for them.

## Shop details in use

- **Phone**: +91 63808 94843
- **WhatsApp**: https://wa.me/916380894843
- **Instagram**: https://www.instagram.com/friends_of_fashion
- **Address**: Opposite the town police station, near Poo Market,
  Bodinayakanur 625513, Theni district
- **Map**: Google Maps search for the shop at the Bodinayakanur address

## The collection

Six pieces, titled after the photo files:

**Newly launched**
- Stone Work Shirt — `assets/collection/stone-work-shirt.jpg`
- Bottom Printed Shirt — `assets/collection/bottom-printed-shirt.jpg`
- Baggy Pant — `assets/collection/baggy-pant.jpg`
- Polo Fit Pant — `assets/collection/polo-fit-pants.jpg`

**Everyday essentials**
- Formal Wear — `assets/collection/formal-wear.jpg`
- Traditional Wear — `assets/collection/traditional-wear.jpg`

The source photos were in `~/Videos`. For the web they were copied into
`assets/collection/` as progressive JPEGs at their original resolution.

> **Photo quality:** the Stone Work Shirt photo is only 194 × 259 px, so it will
> look soft in the card. Formal Wear, Traditional Wear and Baggy Pant are also
> small (about 390 px wide). Replacing those four with larger originals — around
> 1000 px wide or more — will noticeably sharpen the collection. Drop the new
> files into `assets/collection/` with the same names.

## Still to update

- **Prices** — every card currently says "Price on request".
- **Product descriptions** — written from the piece names and categories, since
  no fabric or fit notes were supplied. Adjust to match the real garments.
- **Hours** — Monday – Sunday, 10:00 – 22:00.
- **The house / craft copy** — written as a general atelier description. Adjust
  it to the shop's real history and specialties.
- **Social links** — Instagram and WhatsApp are connected; add Facebook or
  YouTube to the footer if needed.

## Notes

- Colours, type, and spacing live at the top of `styles.css` as CSS custom
  properties. Changing `--gold`, `--ink`, or `--maroon` there re-themes the
  whole page.
- The logo sits on a warm ivory medallion in the header, footer and film so its
  darker details stay legible on the deep maroon background. If a transparent
  single-colour version becomes available, the medallion can be removed by
  editing `.brand__mark` and `.film__seal` in `styles.css`.
- The film's timeline is in `openFilm()` in `script.js` (stage timers plus the
  burst schedule). The auto-close is the `9900` value in that function.
- Fireworks are capped and paused when the tab is hidden; the page does not use
  any third-party scripts or trackers.
- Firecracker audio: real CC0 recordings from
  [BigSoundBank](https://bigsoundbank.com/) (`firecracker with wick`,
  `Mascletà`, `sparkling candle`), trimmed and normalised into `assets/audio/`.
  The saravedi track is assembled from the same real single-cracker takes so it
  keeps a papery snap without a large aerial-shell boom. If those files cannot
  load, `script.js` falls back to the Web Audio synth.
