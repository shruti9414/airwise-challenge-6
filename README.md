# AirWise – Breathe Better, Live Smarter

**Challenge:** PromptWars Challenge 6 – Urban Air Quality Assistant
**Vertical:** Environmental health / civic tech for families and communities in Indian cities

> **No database. No backend. No login.** AirWise is a static, frontend-only React app. Everything runs in the browser; the only network calls are to public APIs (Open-Meteo, and Google Gemini if you choose to paste your own key).

## Problem statement

Every winter, cities such as Delhi, Lucknow and Ahmedabad see severe smog. An AQI number alone does not tell a family *what to do*: whether children can play outside, when to open windows, how to commute, or what small habits actually help.

## Project vision

AirWise turns a live AQI reading into a personalised, explainable plan: how polluted is the air, is it safe for my family, what should I do differently today, how do I clean my indoor air, and what is the effect of my choices. Every recommendation says **why**.

## Features

| Area | What it does |
|---|---|
| **Overview** | Live Indian AQI gauge (CPCB scale), category, dominant pollutant, PM2.5/PM10/NO₂/O₃/SO₂/CO with sub-indices, weather, observation time, source, hourly trend chart (with accessible table). Loading, error, stale and sample states. |
| **Location** | 10 preset Indian cities (Ahmedabad, Delhi, Mumbai, Bengaluru, Pune, …), debounced search for any Indian city, and "use my location" behind an explicit consent dialog (rounded to ~1 km, never saved). |
| **Smart alerts** | Poor / Very Poor / Severe AQI, high PM2.5, stale data, sample-data notice, and *upcoming changes in outdoor-activity guidance* from the hourly forecast. |
| **AI Family Assistant** | Household form (family size, children, elders, respiratory sensitivity, activity, commute, ventilation, purifier). Output: situation analysis, what the risk means, what to do now, what to avoid, better alternatives, why it matters. |
| **Chat box (works with no key)** | Type any question, or tap an example chip, and get an instant answer built on-device from today's AQI and your household (English and common Hinglish keywords), labelled "Rule-based answer, no AI service called". Optionally paste your own Gemini key to get an AI-written answer or the full six-part AI advice; every AI reply is validated and clearly labelled. |
| **Daily plan** | Morning / afternoon / evening / night actions driven by each period's forecast AQI, each with a reason, checkboxes and a progress bar. Includes the best 2-hour outdoor window. |
| **Indoor air** | "Should I open windows now?" verdict plus 9 hacks, each with what / why / difficulty / cost / benefit / limitations, ranked for your situation. Plants are explicitly décor only. |
| **Sustainable alternatives** | Personalised by commute. Walking/cycling are *paused* when AQI is Poor or worse. |
| **Impact tracker** | Log trips; see estimated CO₂e avoided, weekly activity score, habits completed, and exposure-reducing habits, with a 7-day chart and a transparent assumptions panel. |
| **Community** | Awareness tips, action ideas, school/family activities, joinable challenges (progress from your own trip log) and a prevention checklist. Clearly labelled demo; no shared server. |
| **Settings** | Change city, edit household, switch live ↔ sample data, data-source and privacy info, one-click reset of all saved data. |

## Technology stack

React 19 · TypeScript (strict) · Vite · Lucide icons · Vitest + Testing Library · ESLint. Runtime dependencies: `react`, `react-dom`, `lucide-react` only. System fonts (no web-font downloads), hand-written CSS, inline SVG charts.

## Architecture

```
src/
  App.tsx              page shell, nav, section composition
  hooks.ts             useSaved (localStorage), useAirData, useDebounced
  types.ts             shared types
  components/          Overview, Assistant (+ProfileForm, AI panel), Routine, IndoorAir,
                       Impact (alternatives + tracker), Community, Settings, Sources,
                       LocationPicker, ui (Section, Modal, BandBadge, AdviceView)
  lib/
    aqi.ts             CPCB breakpoints, sub-indices, categories, outdoor guidance
    airData.ts         Open-Meteo client, cache, staleness, sample data, city search
    engine.ts          recommendation engine: advice, routine, alerts, best window
    content.ts         indoor hacks, alternatives, community content
    impact.ts          emissions/score maths + trip validation
    storage.ts         validated localStorage load/save/reset, cities, defaults
    ai.ts              provider adapter, Gemini provider, anonymisation, validation
    localChat.ts       keyless question answering from the local engine
  *.test.ts(x)         90 automated tests
```

Community, Settings and Sources are code-split with `React.lazy`.

## Recommendation engine logic

The engine (`lib/engine.ts`) is **deterministic, local and transparent** – no API key needed.

1. **Reading** – `computeReading` computes a CPCB sub-index for each pollutant by linear interpolation between CPCB breakpoints; the AQI is the **worst sub-index** and requires PM2.5 or PM10 (otherwise AQI is "unavailable", never guessed). PM values use the trailing 24 h mean (CPCB averaging); gases use the current hour.
2. **Guidance level** – `normal → reduce → avoid → stayIn`, from the AQI category. Households with children, older adults or respiratory sensitivity step one level stricter from *Moderate* upward.
3. **Context modifiers** – PM2.5 vs the WHO 24 h guideline (15 µg/m³) and the Indian standard (60 µg/m³); purifier present/absent; window ventilation type; commute mode; outdoor activity; light winds ("stagnant air"); the day's hourly forecast (cleanest 2-hour window, per-period outlook).
4. **Output** – six-part advice, a four-period routine with a reason for each item, and alerts. Example outcomes: good AQI + children → normal activity; poor AQI + children → keep exertion indoors; severe + elderly → stay in, follow official advisories, seek medical advice for symptoms; high PM2.5 without a purifier → cut indoor sources and keep windows closed; car commute → public transport / carpool / combined trips.

Different profiles and AQI levels produce measurably different text (covered by tests).

### Optional Gemini integration

`lib/ai.ts` defines an `AiProvider` interface so another LLM can be dropped in. The Gemini provider is used **only** when you paste a key and tick the consent box:

* The key is held in React state only: never in localStorage, files or URLs (sent in the `x-goog-api-key` header). It is wiped on `pagehide` or **Clear key**.
* Only an anonymised summary plus the question you type is sent: AQI, category, PM2.5 band, a boolean "vulnerable member present", activity, commute, ventilation, purifier. **No city, coordinates, family size or named conditions** are sent by AirWise. The UI discloses this and asks you not to type personal details; questions containing an email address or phone/ID-like number are blocked before sending (`checkQuestion`). Your question is passed to the model as a JSON string value, with instructions to answer only air-quality questions.
* Replies must be JSON in the exact expected shape (six advice fields, or `answer` + `steps` for chat); each string is length-limited and rejected if it contains HTML, links or affirmative absolute claims ("guarantees", "cures", "100% safe"). Honest disclaimers such as "cannot guarantee safety" are allowed. Invalid → discarded with an error message; the rule-based advice stays on screen.
* AI output is labelled "AI-generated by Gemini"; rule-based output is labelled "Rule-based advice … no AI service called". Model: `gemini-flash-lite-latest` (constant `MODEL` in `lib/ai.ts`).

## Data source and API details

* **Air quality:** [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api) – hourly PM2.5, PM10, NO₂, O₃, SO₂, CO from the Copernicus CAMS atmospheric model (yesterday + today + tomorrow). This is **modelled**, not ground-monitor data; the UI says so.
* **Weather:** Open-Meteo forecast API (temperature, humidity, wind).
* **City search:** Open-Meteo geocoding API, restricted to India.
* **Caching:** 30-minute cache per ~1 km grid cell in localStorage; if the network fails, older cached data is shown (and flagged stale after 3 h).
* **Sample mode:** an illustrative winter-smog day, shown with a "Sample data – not a live reading" notice and a source label. It is never shown as live, and it is only used when you choose it or click it after live loading fails.

## How the application works

1. Load saved preferences (validated) → fetch live data for the chosen city (or sample mode).
2. Compute the current reading → run the engine with your household profile.
3. Render overview, advice, routine, indoor tips, alternatives, alerts. Ticking items and logging trips updates the impact tracker; everything persists locally.

## Install and run

```bash
npm install
npm run dev        # development server
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
```
Requires Node 20+.

## Testing

```bash
npm test           # 96 tests (Vitest, jsdom)
npm run typecheck  # tsc --noEmit (strict)
npm run lint       # ESLint
```

Tests cover AQI classification (boundaries, missing/invalid values), the recommendation engine for the five documented scenarios and different profiles, indoor-hack ranking, sustainable alternatives, impact maths, trip/family-size validation, localStorage handling (corrupt, tampered, throwing storage), API parsing, caching, API failure fallback, stale data, city search, AI anonymisation/validation/timeout, and UI flows (navigation, skip link & keyboard order, loading/error/empty states, forms, routine progress, trip log, challenges, reset, sample↔live switch, keyless chat, Gemini success and failure).

## Security and privacy practices

* No backend, accounts, tracking or analytics. No secrets in the code; the Gemini key is memory-only.
* Strict CSP in `index.html` (`script-src 'self'`; `connect-src` limited to Open-Meteo and Gemini), `no-referrer`, no `dangerouslySetInnerHTML`, `eval` or dynamic code; React escapes all output.
* All stored data is re-validated on load; user inputs (family size, distance, city search) are validated and length-limited. External links use `rel="noopener noreferrer"`.
* Geolocation only after an in-app consent dialog; coordinates are rounded to ~1 km and never persisted. No exact addresses are collected.
* **Reset all saved data** in Settings removes every `airwise:*` localStorage entry.
* `npm audit --omit=dev`: 0 vulnerabilities (at time of writing). This is a best-effort review, not a guarantee.

## Accessibility features

Semantic landmarks and heading order; skip link; keyboard-operable everything with visible focus rings; native form controls with labels; errors linked via `aria-describedby`/`aria-invalid`; AQI never conveyed by colour alone (always a text label + icon); gauge and charts have text alternatives and a data table; `aria-live` status regions; native `<dialog>` for modals; 44 px touch targets; responsive type and layout; `prefers-reduced-motion` honoured. Lighthouse accessibility score **100** (desktop and mobile).

## Performance and efficiency

Three runtime dependencies; ~95 kB gzip main bundle; lazy-loaded Community/Settings/Sources; no images or web fonts; debounced city search (400 ms); abortable fetches; 30-minute data cache; memoised derived data; listener cleanup. Lighthouse (local preview build): performance 100 desktop / 92 mobile, best-practices 100, SEO 100.

## Assumptions and limitations

* AQI is **computed** from modelled concentrations using CPCB breakpoints (CPCB specifies 24 h averages for PM and 8 h for O₃/CO; gases here use the current hour). It can differ from official monitor-based AQI.
* Open-Meteo/CAMS has ~10 km resolution; local hotspots are not captured.
* CO₂e factors are simple assumptions (car 0.15, public transport 0.05, carpool 0.075 kg/km); trips are self-reported. The tracker does **not** claim to change city AQI or measure exposure.
* Community challenges are demo content; progress is local to the browser.
* Sample hourly curve is illustrative. Gemini output is validated for shape and safety, not for medical accuracy.

## Medical disclaimer

AirWise gives general awareness guidance only. It is not medical advice, does not diagnose, and cannot promise protection from pollution or any change in air quality. Follow official local advisories (e.g. CPCB/SAFAR/your city's health department) and seek medical attention for breathlessness, chest pain, persistent cough or dizziness.

## Future improvements

Ground-station data (CPCB/OpenAQ) where CORS allows; installable PWA with offline cache; Hindi/Gujarati translations; user-defined indoor sensor input; additional LLM providers behind the existing adapter.

## Sources

[CPCB National AQI](https://cpcb.nic.in/National-Air-Quality-Index/) · [WHO Global Air Quality Guidelines 2021](https://www.who.int/publications/i/item/9789240034228) · [Open-Meteo](https://open-meteo.com/en/docs/air-quality-api) · [Gemini API](https://ai.google.dev/gemini-api/docs)
