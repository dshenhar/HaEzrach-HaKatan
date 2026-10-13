# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Israeli news readers from across the whole political spectrum, not one camp. They
read in Hebrew, mostly on a phone, and come to see how the same day's news is
being told on both halves of the map.

## Product Purpose

חדשות האזרח הקטן ("האזרח הקטן") reads the Israeli news sites every half hour,
groups the coverage into stories, and works out what each story is about. It shows
a story twice: once split into the right bloc and the left bloc, each with its own
AI summary of how it was told there, and once with no blocs at all.

Success is a reader seeing both halves of the same story at once, and seeing what
one side covered and the other left out.

## Positioning

The claim: the same day's news reads differently depending on which half of the map
you read it in, and the way out of that is to see both at once.

The app judges outlets itself rather than averaging outside raters. Each outlet has
a position per issue, on a -5 to +5 axis, not one number per outlet. It starts from
an editorial estimate with a stated confidence and is moved by readers' ratings,
including a blind poll in which the outlet's name is hidden until after the vote.
The full working is published on the methodology page.

## Operating Context

- The feed refreshes every half hour, on the hour and the half hour, Israel time.
- The web app is what is live today (https://haezrach-hakatan.web.app). It is
  installed to the home screen and runs standalone. Tapping an article opens the
  outlet's own page in the phone's reader, with a Done button that returns to the app.
- Links shared in WhatsApp, Telegram and similar apps show the name, the one-line
  description and the og card.
- Tabs: נושאים חמים (hot topics), 360 (the feed), Analytics, Profile. Other pages:
  the methodology (איך נקבעת העמדה), the blind poll, accessibility, privacy, terms.
- Hot topics are about fifty affairs the right and the left are split on, kept
  current by hand about once a month with the owner.
- An optional positions questionnaire personalises the blindspot filter, so it
  shows what the reader's own side missed.

## Capabilities and Constraints

- Expo and React Native: one codebase for iPhone, Android and the web. The web
  app is the product today, so the platform above is `web`. When store builds
  ship, each should feel native to its OS, and the platform becomes `adaptive`.
- Right to left throughout. On the web every row is laid out right to left by hand
  (`row-reverse`), because react-native-web ignores the RTL setting the phone build
  uses. `<html>` has `lang="he"` and no `dir`: setting `dir` as well mirrors the
  whole app a second time.
- Themes: light, negative and high contrast. An accessibility bar on every screen
  offers larger text, high contrast and reduced motion.
- Terminology: the right bloc and the left bloc (ימין / שמאל). A blindspot
  (נקודה עיוורת) is an item covered by two or more outlets of one side and none of
  the other. The blind poll is הסקר העיוור. Hot topics speak of the camps' media
  ("תקשורת הימין") and do not name an outlet unless the outlet is itself the affair.
- An outlet's position is a reading of coverage tendency. It is not a claim about
  reliability or quality, and not a claim that an outlet lies.
- Shown per article: headline, a summary of up to 250 characters, the outlet's name
  and the time. Every tap goes to the full article on the outlet's own site.
  Articles are not kept beyond 30 hours, and robots.txt is honoured.

## Brand Commitments

- Name: חדשות האזרח הקטן; short form האזרח הקטן.
- Absolute neutrality: the app does not take a side, and no design choice favours
  the right or the left.
- No images of any outlet: no outlet photos, no logos. Outlets appear by name only.

## Evidence on Hand

- Methodology, said in public: `ui/content/methodology.ts`.
- Privacy, terms and the accessibility statement: `ui/content/legal.ts`.
- The og card: `ui/public/og.png`, drawn from `ui/assets/og-card-source.html`.
- Hot-topic pictures: `ui/public/topics/<id>.webp` (square, 400px).
- Not on hand, and not to be invented: testimonials, user counts, press coverage,
  outlet images or logos, article bodies.

## Product Principles

1. Both halves, side by side. A story is shown as each bloc told it, and also
   without blocs.
2. Neutral by construction. The right and the left get equal weight and equal
   treatment in layout, order, emphasis and copy.
3. The outlet's work stays the outlet's. Headline, short summary, name and time
   only; no outlet images; the full article is on the outlet's own site.
4. For everyone who wants to read it. Accessible, Hebrew, right to left, and
   usable by touch alone.

## Accessibility & Inclusion

Israeli standard IS 5568 at level AA (based on WCAG 2.0), binding.

- An accessibility bar on every screen: larger text, high contrast, reduced motion.
- Every text colour is checked against its background for the required contrast.
- Every button, slider and map circle has a screen-reader label.
- Fully right to left.
- Every action that can be done by dragging can also be done by a single tap.
- Known limitation: the political map is visual by nature. Its data is also
  available as a list on the Analytics page.
