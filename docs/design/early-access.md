# Early access and funnel counting

Owner rulings, 22 Nov: "nothing free, but we could do a signup for early access"; "limit early access to 50 only, then convert to 20/month and 40 per month"; "no you cannot run it yourself, remove it"; "focus on the landing page and getting attention and conversion".

## The offer

One action, one name everywhere: **Claim an early-access place** (**Join the waiting list** once the places are gone). The form asks for two things: email, and "What do you want to make?". Name, company and the plan the person expects to use are optional and asked on the confirmation step, after the place is given.

Early access costs nothing and takes no payment. After early access: the plan catalogue's prices (built in: Maker $20 a month, Studio $40 a month).

## How places are counted

- A request **holds a place** when it has a place number and its status is not `declined`. `new` and `contacted` keep their place; declining frees it.
- **Places left** = the limit less the places held, never below 0. The limit is the setting `earlyAccess.limit` (default 50), edited in Admin, Pricing and tiers.
- Places are numbered from 1; a number freed by a decline is given again (the lowest free number).
- A request that is not declined and has no place number is **on the waiting list**. Its position is its rank among those, oldest first.
- A freed place, or a raised limit, goes at once to the first on the waiting list, so nobody who arrives later overtakes someone who waits. Lowering the limit takes no place back.
- An address already on the list (compared without case, whatever its status) gets no second place and nothing is stored. The answer is only "You are on the list. We write to this address when your workspace opens."
- Every change to who holds a place (a claim, a status change, a deletion, a new limit) runs in one transaction under one advisory lock (`src/lib/accessRequests/places.ts`). With many claims at the same moment, exactly `limit` get a place (tested with 24 claims on 5 places).
- Requests stored before early access took places in the order they came, up to 50 (migration 0041).

The confirmation step is tied to the request by an unguessable token (24 random bytes) returned with the answer; only its SHA-256 is stored, and it lapses after a day. The email address is never accepted in its place.

Without script the form is a plain POST; the answer is a 303 to `/welcome/early`, with the token in an HttpOnly cookie scoped to that page. Rate limit (the sign-in throttle, five free tries per address), honeypot and audit lines (`access.requested`, `access.refused`, plus `access.details` and `access.promoted`) are those of the request form. A confirmation email goes out only when a mail server is set up in Admin, Email; it never holds up the answer.

## For the page

```tsx
import { EarlyAccess } from "@/components/welcome/early/EarlyAccess";
import { Tracker, TrackSection, useTrackView, track } from "@/components/welcome/early/track";
import { publicLevels } from "@/lib/admin/plans";

<EarlyAccess placement="hero" />      // compact
<EarlyAccess placement="pricing" />
<EarlyAccess placement="close" />     // adds what happens next and the privacy sentence
<Tracker />                           // once per page
<TrackSection id="pricing">...</TrackSection>
<a href="#early-access-close" data-track="cta:hero">Claim an early-access place</a>
```

`publicLevels()` answers `{ showPrices, levels: [{ key, name, price, per, paid, who, what, includes, action, priceMonthly, currency }] }`, the shown plans in order.

## Events

All in PostgreSQL (`site_events`: time, event, path, section, detail, anonymous visit id), through `POST /api/events`. Nothing is sent to anyone else.

| Event | Sent by | Detail |
|---|---|---|
| `page_view` | `<Tracker />` | `referrer` (host only), `utm_source` … `utm_term`, `device` (phone, tablet, desktop), `theme` |
| `section_view` | `<TrackSection id>` / `useTrackView(id)`, once per visit per section | section = the id (`pricing` counts as "reached pricing") |
| `cta_click` | `data-track="cta:<which>"` | `cta` |
| `plan_click` | `data-track="plan:<key>"` | `plan` |
| `example_open` | `data-track="example:<from>"` | `from` |
| `sound_on` | `data-track="sound:<from>"` | `from` |
| `film_start`, `film_scene` | `track("film_scene", { scene })` | as given |
| `form_start` | the form, first focus, once per visit per placement | `placement` |
| `form_error` | the form | `placement`, `field` |
| `form_submit` | the server, for every request taken (with or without script) | `placement`, `outcome` (place, waiting, listed), `script` |

Privacy: no network address, browser string, name or email is stored (a detail value that looks like an email is dropped; paths lose their query). The visit id is random per browser session (sessionStorage, no cookie). Do Not Track and Global Privacy Control are respected in the browser and on the server. Known crawlers are dropped. The route caps a body at 4 KB, takes only the events above, and allows 240 events per address in ten minutes (counted in memory; the address is not written down). Events are kept `events.retentionDays` (default 180, Admin, Funnel); the app has no periodic job, so older rows are deleted on a write at most once an hour.

Admin, Funnel shows per UTC day and in total for a chosen range: visits, reached pricing, started form, sent form, claimed place, each with its share of visits; and the same by referrer and campaign of a visit's first page view.

The sentence for the page:

> Visits to this page are counted on our own server. Nothing is sent to anyone else.
