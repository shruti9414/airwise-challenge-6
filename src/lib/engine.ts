import type { Advice, AirData, Alert, BandId, Guidance, Period, Profile, Reading, Routine, RoutineItem } from '../types'
import { BANDS, GUIDANCE_LABEL, WHO_PM25_24H, bandFor, guidanceFor } from './aqi'
import { currentReading, isStale, outlookAt } from './airData'

export interface Context {
  data: AirData
  reading: Reading
  profile: Profile
  now?: number
}

export const isSensitive = (p: Profile) => p.children || p.elderly || p.respiratory
const bandIndex = (b: BandId | null) => (b === null ? 2 : BANDS.findIndex((x) => x.id === b))
const hourOf = (t: string) => Number(t.slice(11, 13))
const label = (b: BandId | null) => BANDS[bandIndex(b)]?.label ?? 'Unknown'
export const fmtHour = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'am' : 'pm'}`
const add = (list: string[], cond: unknown, text: string) => { if (cond) list.push(text) }

export const PERIODS: Record<Period, { label: string; hours: number[] }> = {
  morning: { label: 'Morning', hours: [6, 7, 8, 9, 10, 11] },
  afternoon: { label: 'Afternoon', hours: [12, 13, 14, 15, 16] },
  evening: { label: 'Evening', hours: [17, 18, 19, 20] },
  night: { label: 'Night', hours: [21, 22, 23] },
}

export function periodOf(hour: number): Period {
  if (hour >= 6 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

export const currentHour = (d: AirData) => hourOf(d.times[d.nowIndex] ?? '00T00')

/** Hourly AQI indexes (into data.hourly) that belong to the same local day as "now". */
function todayIndexes(d: AirData): number[] {
  const day = (d.times[d.nowIndex] ?? '').slice(0, 10)
  return d.times.flatMap((t, i) => (t.startsWith(day) ? [i] : []))
}

/** Mean hourly AQI for the hours of a day period today; null when no data is available. */
export function periodOutlook(d: AirData, period: Period): { aqi: number; band: BandId } | null {
  const vals = todayIndexes(d)
    .filter((i) => PERIODS[period].hours.includes(hourOf(d.times[i] as string)))
    .map((i) => outlookAt(d, i).aqi)
    .filter((v): v is number => v !== null)
  if (vals.length === 0) return null
  const aqi = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  return { aqi, band: bandFor(aqi)?.id as BandId }
}

/** Two-hour window (today, 6 am–9 pm, not already over) with the lowest forecast AQI. */
export function bestWindow(d: AirData): { start: number; end: number; aqi: number; band: BandId } | null {
  const hour = currentHour(d)
  const byHour = new Map(todayIndexes(d).map((i) => [hourOf(d.times[i] as string), outlookAt(d, i).aqi]))
  let best: { start: number; aqi: number } | null = null
  for (let s = Math.max(6, hour); s <= 19; s++) {
    const a = byHour.get(s), b = byHour.get(s + 1)
    if (a == null || b == null) continue
    const avg = (a + b) / 2
    if (!best || avg < best.aqi) best = { start: s, aqi: avg }
  }
  if (!best) return null
  const aqi = Math.round(best.aqi)
  return { start: best.start, end: best.start + 2, aqi, band: bandFor(aqi)?.id as BandId }
}

function household(p: Profile): string {
  const who = [p.children && 'children', p.elderly && 'older adults', p.respiratory && 'people with respiratory sensitivity'].filter(Boolean)
  return who.length ? who.join(', ').replace(/, ([^,]*)$/, ' and $1') : ''
}

export function buildAdvice({ data, reading, profile }: Context): Advice {
  const { band, aqi, dominant, pollutants } = reading
  const sensitive = isSensitive(profile)
  const guidance = guidanceFor(band, sensitive)
  const high = bandIndex(band) >= 3
  const pm25 = pollutants.pm25
  const window = bestWindow(data)
  const calm = data.weather !== null && data.weather.windSpeed < 6
  const doNow: string[] = [], avoid: string[] = [], alternatives: string[] = []
  const who = household(profile)

  const analysis = aqi === null
    ? 'There is not enough valid pollutant data (PM2.5 or PM10, plus at least three pollutants over their CPCB averaging periods), so an Indian AQI estimate is unavailable. Treat the guidance below as cautious defaults and check an official local source.'
    : `The Indian AQI is ${aqi} (${label(band)})${dominant ? `, driven mainly by ${dominant === 'pm25' ? 'PM2.5' : dominant === 'pm10' ? 'PM10' : dominant.toUpperCase()}` : ''}.` +
      (pm25 !== null ? ` PM2.5 averages ${Math.round(pm25)} µg/m³, about ${(pm25 / WHO_PM25_24H).toFixed(1)}× the WHO 24-hour guideline of ${WHO_PM25_24H} µg/m³.` : '') +
      (calm && high ? ' Winds are light, so pollution is not dispersing quickly.' : '') +
      (who ? ` Your household includes ${who}, so guidance is one step more cautious.` : '')

  const meaning = (band === null ? 'Health effects are uncertain without particulate data.' : (BANDS[bandIndex(band)]?.health ?? '')) +
    (sensitive && bandIndex(band) >= 2 ? ' Children, older adults and people with heart or lung conditions are affected first.' : '')

  if (guidance === 'normal') {
    add(doNow, true, `Normal outdoor activity is fine${profile.children ? ' — including outdoor play for children' : ''}. Stay hydrated and keep usual precautions.`)
    add(doNow, profile.ventilation === 'openable', 'Open windows for cross-ventilation while the air is clean.')
  } else if (guidance === 'reduce') {
    add(doNow, true, `Keep outdoor exertion short${window ? ` and aim for ${fmtHour(window.start)}–${fmtHour(window.end)}, the cleanest window forecast today` : ''}.`)
    add(doNow, sensitive, 'Watch children, older adults and anyone with asthma or heart/lung conditions for coughing, wheeze or breathlessness.')
  } else {
    add(doNow, true, `Move exercise and play indoors${guidance === 'stayIn' ? ' and keep outdoor trips essential and short' : '; keep outdoor trips short'}.`)
    add(doNow, window && guidance === 'avoid', `If you must go out, ${fmtHour((window as { start: number }).start)}–${fmtHour((window as { end: number }).end)} is forecast to be the least polluted (still ${label((window as { band: BandId }).band)}).`)
    add(doNow, true, 'Follow official local advisories. Seek medical advice for breathlessness, chest tightness, persistent cough or dizziness.')
  }
  add(doNow, profile.respiratory && bandIndex(band) >= 2, 'Keep prescribed medication handy and follow your doctor’s action plan.')
  add(doNow, profile.elderly && bandIndex(band) >= 3, 'Check in on older family members regularly today.')
  add(doNow, bandIndex(band) >= 3 && profile.commute !== 'remote', 'If travel is unavoidable, a well-fitted N95/FFP2 mask can reduce particle inhalation; it does not remove the risk.')

  const pmHigh = pm25 !== null && pm25 > 60
  add(doNow, pmHigh && profile.purifier, 'Run your air purifier in the room you use most, with doors and windows closed.')
  add(doNow, pmHigh && !profile.purifier, 'Reduce indoor sources (incense, candles, smoky cooking, dry sweeping) and consider a HEPA purifier sized for your room if feasible.')
  add(doNow, high && profile.ventilation !== 'acOnly', 'Keep windows closed during peak pollution; air rooms only briefly when outdoor readings are lowest.')

  add(avoid, bandIndex(band) >= 2 && profile.activity !== 'minimal', 'Jogging, cycling in traffic and other heavy outdoor exercise.')
  add(avoid, bandIndex(band) >= 3 && profile.children, 'Outdoor sports and long playground sessions for children.')
  add(avoid, bandIndex(band) >= 2, 'Burning waste, leaves, incense, candles or mosquito coils indoors.')
  add(avoid, bandIndex(band) >= 2, 'Dry sweeping or dusting that lifts particles back into the air.')
  add(avoid, profile.commute === 'car' || profile.commute === 'twoWheeler', 'Idling the engine while waiting.')
  add(avoid, high && profile.activity === 'outdoorWork', 'Long unprotected stretches of outdoor work; take breaks indoors where you can.')
  add(avoid, bandIndex(band) < 2, 'Contributing to smog: waste burning and unnecessary engine idling.')

  add(alternatives, guidance !== 'normal' && profile.activity !== 'minimal', 'Swap outdoor exercise for indoor yoga, stretching, stair climbing or a home workout.')
  add(alternatives, profile.commute === 'car', 'Take public transport, share a ride or combine errands into one trip.')
  add(alternatives, profile.commute === 'twoWheeler', 'Consider metro/bus or a shared ride on the worst days, and wear a well-fitting mask if you ride.')
  add(alternatives, profile.commute === 'walkCycle' && bandIndex(band) >= 3, 'Use public transport today instead of walking or cycling along busy roads.')
  add(alternatives, profile.commute === 'walkCycle' && bandIndex(band) < 3, 'Walking or cycling is a great low-emission choice today; prefer quiet, low-traffic routes.')
  add(alternatives, pmHigh && !profile.purifier, 'Make a low-cost "clean room": one room with windows closed, no indoor smoke, wet-mopped floors.')
  add(alternatives, profile.commute === 'remote', 'Working from home cuts your commute exposure: use that to keep indoor air clean.')

  const why = `Fine particles (PM2.5) are small enough to reach deep into the lungs and bloodstream. ` +
    (sensitive ? 'Children breathe faster for their size, and older adults and people with heart or lung conditions have less reserve, so they feel the effects earlier. ' : '') +
    'Reducing time and exertion outdoors, and keeping indoor air clean, lowers your exposure; these are general awareness guidelines, not medical advice.'

  return { analysis, meaning, doNow, avoid, alternatives, why }
}

export function buildRoutine({ data, reading, profile }: Context): Routine {
  const sensitive = isSensitive(profile)
  const win = bestWindow(data)
  const item = (id: string, text: string, reason: string): RoutineItem => ({ id, text, reason })
  const ctxFor = (p: Period) => {
    const o = periodOutlook(data, p)
    const band = o?.band ?? reading.band
    return { band, g: guidanceFor(band, sensitive), note: o ? `${label(o.band)} outlook (index ≈ ${o.aqi})` : `current ${label(reading.band)} reading` }
  }
  const car = profile.commute === 'car' || profile.commute === 'twoWheeler'
  const m = ctxFor('morning'), a = ctxFor('afternoon'), e = ctxFor('evening')
  const n = ctxFor('night')
  const out = (g: Guidance, hi: string, mid: string, lo: string) => (g === 'normal' ? hi : g === 'reduce' ? mid : lo)

  const morning = [
    item('exposure:morning-outdoor',
      out(m.g, 'Walk or play outdoors for exercise and fresh air.', 'Keep outdoor time short; shift longer activity to the cleanest window.', 'Skip outdoor workouts and playground time; exercise indoors.'),
      `${m.note} this morning${m.g === 'normal' ? ', so normal activity is reasonable' : '; winter mornings often trap pollution near the ground'}.`),
    profile.ventilation === 'openable' && item('indoor:morning-air',
      bandIndex(m.band) <= 1 ? 'Open windows for 10–15 minutes to air out rooms.' : 'Keep windows closed this morning.',
      bandIndex(m.band) <= 1 ? 'Outdoor air is cleaner than average, so a short flush helps clear indoor pollutants.' : `Opening windows would let in ${m.note} air.`),
    profile.commute !== 'remote' && item('movement:morning-commute',
      profile.commute === 'walkCycle' && bandIndex(m.band) >= 3 ? 'Take public transport instead of walking or cycling today.' : car ? 'Share a ride, use public transport or combine errands into one trip.' : 'Choose low-traffic routes for your commute.',
      car ? 'Fewer vehicle trips mean lower emissions and less traffic pollution on your street.' : 'Heavy exertion beside traffic raises how much pollution you inhale.'),
    bandIndex(m.band) >= 3 && profile.commute !== 'remote' && item('exposure:morning-mask',
      'If you must travel, wear a well-fitted N95/FFP2 mask.',
      'Masks only help when they seal well; they reduce but do not eliminate exposure, and may not fit young children, so limit their time outdoors instead.'),
  ].filter(Boolean) as RoutineItem[]

  const afternoon = [
    win && item('exposure:afternoon-window',
      `Plan outdoor time for ${fmtHour(win.start)}–${fmtHour(win.end)}.`,
      `This is the lowest forecast outlook window today (index ≈ ${win.aqi}, ${label(win.band)}); sunlight and warmth usually disperse pollution.`),
    a.g !== 'normal' && profile.activity !== 'minimal' && item('movement:afternoon-indoor',
      'Do 20–30 minutes of indoor exercise: yoga, stretching or stairs.',
      `Outdoor effort at ${a.note} means deeper breathing of polluted air.`),
    item('indoor:afternoon-mop', 'Wet-mop floors instead of dry sweeping.', 'Damp cleaning traps dust; sweeping re-suspends fine particles.'),
    car && item('movement:afternoon-errands', 'Combine errands into a single trip.', 'One trip instead of several cuts both fuel use and your time in traffic.'),
  ].filter(Boolean) as RoutineItem[]

  const evening = [
    item('indoor:evening-cook', 'Switch on the kitchen exhaust while cooking.', 'Cooking releases fine particles and gases that otherwise linger indoors.'),
    item('exposure:evening-outdoor',
      out(e.g, 'A short evening walk is fine.', 'Keep any evening walk brief and away from busy roads.', 'Skip evening walks; stay in or exercise indoors.'),
      `${e.note}; pollution often builds as temperatures drop after sunset.`),
    car && item('movement:evening-idle', 'Switch the engine off when waiting.', 'Idling adds exhaust without moving you anywhere.'),
  ].filter(Boolean) as RoutineItem[]

  const night = [
    item('indoor:night-air',
      profile.purifier ? 'Run the purifier in the bedroom on a quiet setting, doors closed.' : 'Keep bedroom windows closed and avoid burning incense or coils.',
      profile.purifier ? 'You spend about a third of the day asleep, so clean bedroom air matters.' : `Overnight outlook: ${n.note}; closed windows limit what gets in.`),
    (profile.purifier || profile.ventilation === 'acOnly') && item('indoor:night-filter', 'Check and clean purifier or AC filters.', 'Clogged filters clean less air and can recirculate dust.'),
    item('exposure:night-plan', 'Check tomorrow’s outlook before planning school runs or exercise.', 'A cleaner window can be planned around instead of guessed.'),
  ].filter(Boolean) as RoutineItem[]

  return { morning, afternoon, evening, night }
}

export function buildAlerts({ data, reading, profile, now = Date.now() }: Context): Alert[] {
  const alerts: Alert[] = []
  const idx = bandIndex(reading.band)
  if (data.source === 'sample') alerts.push({ id: 'sample', severity: 'info', title: 'Sample data in use', detail: 'These alerts are generated from clearly labelled sample values, not a live reading.' })
  if (isStale(data, now)) alerts.push({ id: 'stale', severity: 'warning', title: 'Data may be outdated', detail: 'The latest observation is more than 3 hours old. Check an official source before deciding.' })
  if (reading.aqi !== null && idx >= 3) {
    alerts.push({ id: 'band', severity: idx >= 4 ? 'critical' : 'warning', title: `${label(reading.band)} air quality (AQI ${reading.aqi})`, detail: BANDS[idx]?.health ?? '' })
  }
  const pm25 = reading.pollutants.pm25
  if (pm25 !== null && pm25 > 60) {
    alerts.push({ id: 'pm25', severity: pm25 > 120 ? 'critical' : 'warning', title: `High PM2.5: ${Math.round(pm25)} µg/m³`, detail: `That is ${(pm25 / WHO_PM25_24H).toFixed(1)}× the WHO 24-hour guideline and above the Indian 24-hour standard of 60 µg/m³.` })
  }
  const sensitive = isSensitive(profile)
  const base = guidanceFor(outlookAt(data, data.nowIndex).band, sensitive)
  for (let i = data.nowIndex + 1; i <= Math.min(data.nowIndex + 6, data.hourly.length - 1); i++) {
    const g = guidanceFor(outlookAt(data, i).band, sensitive)
    if (g !== base) {
      alerts.push({ id: 'change', severity: 'info', title: `Outdoor guidance changes around ${fmtHour(hourOf(data.times[i] as string))}`, detail: `Forecast moves from “${GUIDANCE_LABEL[base]}” to “${GUIDANCE_LABEL[g]}”.` })
      break
    }
  }
  return alerts
}

export const assess = (data: AirData, profile: Profile): Context => ({ data, reading: currentReading(data), profile })
