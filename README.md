# AirWise – Breathe Better, Live Smarter

**Challenge:** PromptWars Challenge 6 – Urban Air Quality Assistant
**Vertical:** Environmental health / civic tech for families and communities in Indian cities

> **No database. No backend. No login.** AirWise is a static, frontend-only React app. Everything runs in the browser; the only network calls are to public APIs (Open-Meteo; OpenStreetMap Nominatim only if you use "Use my location"; and Google Gemini if you choose to paste your own key).

> **To try the Gemini AI features:** scroll to **Ask a question** on the Overview page, open **Optional: use Gemini AI**, paste your own Gemini API key (free from [Google AI Studio](https://aistudio.google.com/apikey)), tick the consent box and press **Ask Gemini**. The key is never stored or committed: it stays in memory only and is cleared when you leave the page. Without a key, **Get instant answer** gives a rule-based answer, clearly labelled as such.

**Demo video:** [demo/airwise-demo.mp4](demo/airwise-demo.mp4) (84 seconds, captions, no audio), recorded on the live site.

## Problem statement

Every winter, cities such as Delhi, Lucknow and Ahmedabad see severe smog. An AQI number alone does not tell a family *what to do*: whether children can play outside, when to open windows, how to commute, or what small habits actually help.

## Project vision

AirWise turns a live AQI reading into a personalised, explainable plan: how polluted is the air, is it safe for my family, what should I do differently today, how do I clean my indoor air, and what is the effect of my choices. Every recommendation says **why**.

## Chosen vertical, persona and approach

* **Vertical:** Challenge 6, Urban Air Quality Assistant (severe winter smog and urban pollution).
* **Persona:** an urban Indian family or community that wants clear daily decisions, not just an AQI number.
* **Approach:** a deterministic, explainable rule engine decides everything that affects health guidance (AQI band × household profile × hourly forecast). GenAI is an optional layer on top: it is given only an anonymised summary, its output is validated before display, and the rule-based answer is always the fallback. The chat box works with no key (rule-based, labelled), and uses Gemini when the user supplies their own key.
* **Tailoring:** location (city search or device location), household (children, older adults, respiratory sensitivity, purifier), activity, commute and home ventilation all change the advice.
* **Impact of choices:** a weekly tracker converts low-emission trips and habits into CO₂ avoided and an exposure-habit score, with the formulas shown.

## How it aligns with the challenge

| Challenge requirement | Where it is in AirWise |
|---|---|
| GenAI-powered assistant | Rule engine plus an optional Gemini layer (own key, memory only, anonymised context, validated replies). The chat box also works with no key. |
| Low-emission daily routines | **My Daily Plan**: morning, afternoon, evening and night actions, each with a reason. |
| Indoor air quality hacks | **Indoor Air**: "open windows now?" verdict and nine ranked hacks with honest limits. |
| Sustainable alternatives | Commute-based alternatives; walking/cycling are paused when air is Poor or worse. |
| Tailored to location and lifestyle | City search or device location; household, activity, commute, ventilation and purifier change the advice. |
| Explain the impact of choices | Impact tracker: CO₂e avoided, weekly score and habits, formulas shown. |
| Severe winter smog and urban pollution | Indian CPCB AQI estimate, PM2.5 vs WHO and Indian standards, smart alerts and cleanest outdoor window. |

**How to see the AI part:** open "Optional: use Gemini AI", paste a Gemini API key (free from Google AI Studio), tick the consent box and press "Ask Gemini". Without a key the app uses the rule-based assistant and says so on every answer.

## Features

| Area | What it does |
|---|---|
| **Overview** | Live Indian AQI gauge (CPCB scale), category, dominant pollutant, PM2.5/PM10/NO₂/O₃/SO₂/CO with sub-indices, weather, observation time, source, hourly outlook chart (with accessible table), and the estimate disclaimer. Loading, error, stale and sample states. |
| **Location** | 10 preset Indian cities (Ahmedabad, Delhi, Mumbai, Bengaluru, Pune, …), debounced search for any Indian city, and "use my location" behind an explicit consent dialog (fresh high-accuracy position, rounded to ~1 km, never saved, named by a reverse-geocode of the rounded coordinates via OpenStreetMap Nominatim, e.g. "Surat, Gujarat (approx.)", falling back to "Near <nearest preset city>" if that lookup fails; clear messages for denied, unavailable and timed-out location). |
| **Smart alerts** | Poor / Very Poor / Severe AQI, high PM2.5, stale data, sample-data notice, and *upcoming changes in outdoor-activity guidance* from the hourly forecast. |
| **AI Family Assistant** | Household form (family size, children, elders, respiratory sensitivity, activity, commute, ventilation, purifier). Output: situation analysis, what the risk means, what to do now, what to avoid, better alternatives, why it matters. |
| **Chat box (works with no key)** | Type any question, or tap an example chip, and get an instant answer built on-device from today's AQI and your household (English and common Hinglish keywords), labelled "Rule-based answer, no AI service called". Optionally paste your own Gemini key to get an AI-written answer or the full six-part AI advice; every AI reply is validated and clearly labelled. |
| **Daily plan** | Morning / afternoon / evening / night actions driven by each period's modelled outlook, each with a reason, checkboxes and a progress bar. Includes the best 2-hour outdoor window. |
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
  components/          Overview (+Gauge, ReadingSummary, PollutantList, Trend)
                       Assistant (+ProfileForm, AiPanel, GeminiSettings, ChatResults)
                       LocationPicker (+CitySearch), Routine, IndoorAir,
                       Impact (alternatives + tracker), Community, Settings, Sources,
                       ui (Section, Modal, BandBadge, AdviceView)
  lib/
    aqi.ts             CPCB breakpoints, sub-indices, categories, outdoor guidance
    airData.ts         Open-Meteo client, cache, staleness, sample data, city search
    engine.ts          shared Context, sensitivity helpers and assess()
    advice.ts          six-part advice from reading + household
    routine.ts         four-period routine with a reason per item
    alerts.ts          smart alerts (severity, stale data, upcoming change)
    outlook.ts         hourly outlook helpers: periods, period outlook, cleanest window
    content.ts         indoor hacks, alternatives, community content
    impact.ts          emissions/score maths + trip validation
    storage.ts         validated localStorage load/save/reset, cities, defaults
    ai.ts              provider adapter, Gemini provider, anonymisation, validation
    localChat.ts       keyless question answering from the local engine
  a11y.test.tsx        axe-core accessibility checks on the rendered app
  *.test.ts(x)         127 automated tests
```

Community, Settings and Sources are code-split with `React.lazy`.

## Recommendation engine logic

The engine (`lib/engine.ts`, `advice.ts`, `routine.ts`, `alerts.ts`) is **deterministic, local and transparent** – no API key needed.

> **AirWise shows: "CPCB breakpoint-based AQI estimate using modelled air-quality data. Not an official CPCB station reading."** The same sentence appears in the Overview and in Settings.

1. **Reading** – `averagedPollutants` averages each pollutant over its CPCB period ending at the current hour: **24 h** for PM2.5, PM10, NO₂ and SO₂; **8 h** for CO and O₃. `computeReading` then converts each average to a sub-index by linear interpolation between CPCB breakpoints. The AQI is the **worst sub-index**. Data sufficiency: a pollutant needs at least 16 valid hours in its 24 h window (6 of 8 for the 8 h pollutants, the same two-thirds rule); the AQI needs **at least 3 valid sub-indices, including PM2.5 or PM10**. Otherwise the AQI is shown as **unavailable**, never guessed. A single current-hour gas value is never used for the headline AQI.
2. **Guidance level** – `normal → reduce → avoid → stayIn`, from the AQI category. Households with children, older adults or respiratory sensitivity step one level stricter from *Moderate* upward.
3. **Context modifiers** – PM2.5 vs the WHO 24 h guideline (15 µg/m³) and the Indian standard (60 µg/m³); purifier present/absent; window ventilation type; commute mode; outdoor activity; light winds ("stagnant air"); the day's hourly outlook (cleanest 2-hour window, per-period outlook). The hourly chart, cleanest window and period outlook use an **hourly outlook index** computed from each hour's modelled concentrations. It is labelled as such in the UI, is not a CPCB AQI, and exists only to show how the day varies, which a rolling 24 h average would hide.
4. **Output** – six-part advice, a four-period routine with a reason for each item, and alerts. Example outcomes: good AQI + children → normal activity; poor AQI + children → keep exertion indoors; severe + elderly → stay in, follow official advisories, seek medical advice for symptoms; high PM2.5 without a purifier → cut indoor sources and keep windows closed; car commute → public transport / carpool / combined trips.

Different profiles and AQI levels produce measurably different text (covered by tests).

### Optional Gemini integration

`lib/ai.ts` defines an `AiProvider` interface so another LLM can be dropped in. The Gemini provider is used **only** when you paste a key and tick the consent box:

* The key is held in React state only: never in localStorage, files or URLs (sent in the `x-goog-api-key` header). It is wiped on `pagehide` or **Clear key**.
* Only an anonymised summary plus the question you type is sent: AQI, category, PM2.5 band, a boolean "vulnerable member present", activity, commute, ventilation, purifier. **No city, coordinates, family size or named conditions** are sent by AirWise. The UI discloses this and asks you not to type personal details; questions containing an email address or phone/ID-like number are blocked before sending (`checkQuestion`). Your question is passed to the model as a JSON string value, with instructions to answer only air-quality questions.
* Replies must be JSON in the exact expected shape (six advice fields, or `answer` + `steps` for chat); each string is length-limited and rejected if it contains HTML, links or affirmative absolute claims ("guarantees", "cures", "100% safe"). Honest disclaimers such as "cannot guarantee safety" are allowed. Invalid → discarded with an error message; the rule-based advice stays on screen.
* AI output is labelled "AI-generated by Gemini"; rule-based output is labelled "Rule-based advice … no AI service called". Model: `gemini-flash-lite-latest` (constant `MODEL` in `lib/ai.ts`).

## Data source and API details

* **Air quality:** [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api) – hourly PM2.5, PM10, NO₂, O₃, SO₂, CO from the Copernicus CAMS atmospheric model (yesterday + today + tomorrow). This is **modelled** data, not ground-monitor data, so the result is an estimate and not an official CPCB reading; the UI says so.
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
npm run format     # prettier (120 columns); `npm run format:check` verifies
```
Requires Node 20+.

## Testing

```bash
npm test           # 127 tests (Vitest, jsdom)
npm run typecheck  # tsc --noEmit (strict)
npm run lint       # ESLint
```

Tests include automated accessibility checks with axe-core (WCAG 2 A/AA rules; colour contrast needs a real browser, so it is checked separately). Tests cover AQI classification (boundaries, missing/invalid values), CPCB 24 h and 8 h averaging, data sufficiency (16 valid hours, 3 pollutants, PM2.5/PM10 required), the recommendation engine for the five documented scenarios and different profiles, indoor-hack ranking, sustainable alternatives, impact maths, trip/family-size validation, localStorage handling (corrupt, tampered, throwing storage, tampered trip modes), validation of cached air data, API parsing, caching, API failure fallback, stale data, city search, AI anonymisation/validation/timeout, and UI flows (navigation, skip link & keyboard order, loading/error/empty states, forms, routine progress, trip log, challenges, reset, sample↔live switch, keyless chat, Gemini success and failure).

## Security and privacy practices

* No backend, accounts, tracking or analytics. No secrets in the code; the Gemini key is memory-only.
* Response headers in `vercel.json`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, restrictive `Permissions-Policy`.
* Strict CSP in `index.html` (`script-src 'self'`; `connect-src` limited to Open-Meteo, Nominatim and Gemini), `no-referrer`, no `dangerouslySetInnerHTML`, `eval` or dynamic code; React escapes all output.
* All stored data is re-validated on load; user inputs (family size, distance, city search) are validated and length-limited. External links use `rel="noopener noreferrer"`.
* Geolocation only after an in-app consent dialog; coordinates are rounded to ~1 km and never persisted. No exact addresses are collected.
* **Reset all saved data** in Settings removes every `airwise:*` localStorage entry.
* `npm audit --omit=dev`: 0 vulnerabilities (at time of writing). This is a best-effort review, not a guarantee.

## Accessibility features

Semantic landmarks and heading order; skip link; keyboard-operable everything with visible focus rings; native form controls with labels; errors linked via `aria-describedby`/`aria-invalid`; AQI never conveyed by colour alone (always a text label + icon); gauge and charts have text alternatives and a data table; `aria-live` status regions; native `<dialog>` for modals; 44 px touch targets; responsive type and layout; `prefers-reduced-motion` honoured; one hidden page-level `h1`; scrollable table region is keyboard-focusable.

**Measured (local production preview, 26 Nov 2026; results vary by machine):** Lighthouse accessibility 100, best-practices 100, SEO 100 on desktop and mobile. axe-core in Chrome reported 0 violations on desktop and mobile widths. axe could not evaluate contrast over the gradient hero, so text/background pairs of the palette were computed separately: body and muted text are at least 5.5:1 and badges at least 6.8:1.

## Performance and efficiency

Three runtime dependencies; ~99 kB gzip main bundle; reserved hero space so the page does not jump when data arrives; hashed assets served with immutable caching (`vercel.json`); preconnect to the air-quality API; lazy-loaded Community/Settings/Sources; memoised advice; no images or web fonts; debounced city search (400 ms); abortable fetches; 30-minute data cache; memoised derived data; listener cleanup. Lighthouse performance (same measurement): 99 desktop, 96 mobile (layout shift 0 on mobile).

## Assumptions and limitations

* **Why not official station data?** Public station feeds (CPCB, OpenAQ, WAQI and similar) generally need an API key, a registration or a server, which a keyless, backend-free app cannot hold safely. Open-Meteo needs no key, so AirWise uses it and says plainly that the result is an estimate.
* **Place name lookup.** Using "Use my location" sends the rounded (~1 km) coordinates to OpenStreetMap Nominatim to get a readable name; the consent dialog says so. Nothing is stored, and the app works without it.
* **Device location can be approximate.** Laptops and desktops usually estimate location from Wi-Fi or IP and can be several km off; phones with GPS are better. The air-quality model itself covers roughly 10 km, so the city picker is the reliable choice.
* **Modelled data, not station data.** The AQI is an estimate computed from CAMS model output with CPCB breakpoints and averaging rules. It is not an official CPCB station reading and can differ from one, especially near traffic, industry or burning.
* Forecast hours are also model output; the hourly outlook index is not averaged and is only a guide to the shape of the day.
* The AQI is shown as unavailable when fewer than 16 valid hours (or fewer than 3 valid pollutants, or neither PM2.5 nor PM10) are available, for example when the service omits a pollutant.
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
