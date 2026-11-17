# Guest and Team AI Enablement

A static concept site with five pages: an overview, a campaign studio, a guest frequency lab, team enablement, and a pipeline and governance page with a release gate.

This is an unofficial concept built for a job application. It is not affiliated with, endorsed by or connected to Topgolf or Callaway Brands, and it has no access to any internal system. All audience counts, membership tiers, prices, champion counts and usage figures are synthetic or illustrative.

## Public sources used

- D Magazine, June 2026: CEO plan, 35% visit rate, planned three-tier membership, check-size trend. https://www.dmagazine.com/business-economy/2026/06/topgolf-ceo-david-mckillips-plan/
- Today's Golfer: 10 million new golfers by 2030 goal. https://www.todays-golfer.com/news-and-events/general-news/topgolf-10-million-new-golfers-2030/
- Topgolf press release, 19 May 2026: leadership changes, new CIO for data and digital strategy. https://press.topgolf.com/2026-05-19-Topgolf-Announces-Next-Era-of-Leadership-from-Global-Entertainment,-Sports-Gaming-to-Drive-Brands-Next-Chapter-of-Growth-and-Transformation
- Nasdaq: Toast point-of-sale rollout and pilots. https://www.nasdaq.com/articles/can-topgolfs-toast-pos-rollout-unlock-better-venue-efficiency
- Topgolf app page: booking, waitlist, leaderboards, membership purchase. https://topgolf.com/us/company/app

Anything not in these sources (AI tooling, loyalty program rules, offer policies) is an assumption and is labeled as one on the pages.

## Run it locally

No build step. Open `index.html` in a browser, or serve the folder:

    python3 -m http.server 8000

## Deploy on Vercel

1. Import the repository in Vercel.
2. Set **Root Directory** to `topgolf-ai-enablement`.
3. Leave the framework preset as **Other** and the build command empty. Vercel serves the HTML directly.

## Files

- `index.html`: overview, public facts with sources, goals and guardrails.
- `marketing.html`: campaign brief builder with rule-based claims, frequency and opt-out checks.
- `guests.html`: contact frequency model, membership tier economics and lapse triggers.
- `team.html`: readiness check, role paths, reviewed prompt library and champion coverage.
- `pipeline.html`: app catalog, data classes, release gate and incident steps.
- `styles.css`: shared tokens and components, with light and dark themes.
