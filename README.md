# maurogenna.dev

My portfolio: four case studies on building AI-powered products, and the
experience behind them.

What follows are the decisions behind the site, not a feature list. Each one
cost something, and the cost is stated.

## No client framework

The page's own JavaScript is about 2 KB: a scroll reveal built on
`IntersectionObserver` that unobserves each element once it fires, two click
handlers, and the screenshot viewer.

The viewer is the one place the page needed real interaction. On a phone the
screenshots render at 14% of their source width — sharp, but unreadable — and
linking straight to the image file sent the reader off the page with only the
back gesture to return. A native `<dialog>` brings the focus trap, the backdrop
and inerting the page behind it, so keeping the reader in place cost 1 KB rather
than a library.

*Cost:* there is no component model. Any future interactivity gets written by
hand — and `<dialog>` did not close on Escape in every browser tested, so that
is handled explicitly rather than assumed.

## Self-hosted type, with a metric-matched fallback

Geist is served from this origin as a subset variable font rather than from a
font CDN. The fallback `@font-face` sets `size-adjust: 104%`, measured in the
browser rather than guessed, because Geist sets 4% wider than Arial at the same
size.

Without that, swapping from fallback to Geist rebreaks every line, since the
layout measure is in `ch` units.

*Cost:* I own the subsetting and the updates, and lose any shared CDN cache.

## Colour resolves entirely from tokens

Every colour comes from a custom property on `:root`. The dark theme redefines
the tokens and nothing else. Contrast was computed against both surfaces in both
themes rather than eyeballed.

*Cost:* a one-off colour means adding a token or breaking the rule. There is no
local escape hatch.

## Motion is off unless it is wanted

The styles that hide a section live behind a `.reveal-ready` class that
JavaScript adds only when `prefers-reduced-motion` does not match. Visitors with
reduced motion, and visitors with no JavaScript at all, get the content already
in place instead of permanently invisible.

*Cost:* an indirection. The hiding styles only exist after JS decides motion is
allowed.

## Images go through `astro:assets`

Each screenshot is emitted at three widths behind a `srcset`, so a phone
downloads a fraction of what a desktop does.

*Cost:* the images have to live in `src/`, not `public/`, or the pipeline is
silently bypassed.

## It prints

Saving the page as a PDF produces a document: black on white, navigation
dropped, link URLs printed after their text.

*Cost:* a stylesheet nobody looks at until the moment it matters.

## Numbers

| | |
| --- | --- |
| First render | 71.6 KB — HTML 25.3, CSS 13.0, font 28.6, JS 5.2 |
| JavaScript | 5.2 KB across three modules, 3.1 of it analytics |
| Type sizes | 6 |
| Spacing steps | 10 |
| Third-party requests | 0 |

Analytics is Vercel Web Analytics, whose script is served from this origin. That
is why the third-party count is still zero, and why the site needs no cookie
banner.

## Running it

```sh
npm install
npm run dev
```

Astro 5, static output, deployed on Vercel.
