# 4. Static-first web: prerender every page

- Status: Accepted
- Date: 2026-11-13

## Context

Content changes rarely and is the same for every visitor. The 3D simulation runs entirely in the browser.

## Decision

Prerender all routes at build time (TanStack Start prerendering with link crawling). Pages must be complete and readable without the API: the API only adds the review badge and accepts feedback, and the page degrades to "draft, not reviewed" when the API is unreachable.

## Consequences

- Fast, cheap hosting and good SEO for the dictionary.
- The site stays up if the API is down.
- Anything personalised must be a client-side enhancement.
