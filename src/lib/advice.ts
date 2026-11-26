import type { Advice, BandId, Guidance, Profile } from '../types'
import { BANDS, PM25_STANDARD_24H, WHO_PM25_24H, guidanceFor } from './aqi'
import { BAND_LEVEL, bandIndex, isSensitive, label, type Context } from './engine'
import { bestWindow, fmtHour } from './outlook'
import { compact } from './util'

/** Wind speed (km/h) below which pollution is treated as not dispersing. */
const CALM_WIND_KMH = 6

const NO_DATA_ANALYSIS =
  'There is not enough valid pollutant data (PM2.5 or PM10, plus at least three pollutants over their CPCB averaging periods), so an Indian AQI estimate is unavailable. Treat the guidance below as cautious defaults and check an official local source.'

/** Everything the advice rules depend on, derived once from the context. */
interface Facts {
  context: Context
  profile: Profile
  band: BandId | null
  /** Index of the band, Good = 0 .. Severe = 5 (unknown counts as Moderate). */
  level: number
  guidance: Guidance
  sensitive: boolean
  /** Poor or worse. */
  high: boolean
  /** PM2.5 above the Indian 24-hour standard. */
  pmHigh: boolean
  window: ReturnType<typeof bestWindow>
}

function household(p: Profile): string {
  const who = compact([
    p.children && 'children',
    p.elderly && 'older adults',
    p.respiratory && 'people with respiratory sensitivity',
  ])
  return who.join(', ').replace(/, ([^,]*)$/, ' and $1')
}

function pollutantName(pollutant: string): string {
  return pollutant === 'pm25' ? 'PM2.5' : pollutant === 'pm10' ? 'PM10' : pollutant.toUpperCase()
}

function analysisText({ context, profile, band, high }: Facts): string {
  const { aqi, dominant, pollutants } = context.reading
  if (aqi === null) return NO_DATA_ANALYSIS
  const pm25 = pollutants.pm25
  const calm = context.data.weather !== null && context.data.weather.windSpeed < CALM_WIND_KMH
  const who = household(profile)
  return compact([
    `The Indian AQI is ${aqi} (${label(band)})${dominant ? `, driven mainly by ${pollutantName(dominant)}` : ''}.`,
    pm25 !== null &&
      `PM2.5 averages ${Math.round(pm25)} µg/m³, about ${(pm25 / WHO_PM25_24H).toFixed(1)}× the WHO 24-hour guideline of ${WHO_PM25_24H} µg/m³.`,
    calm && high && 'Winds are light, so pollution is not dispersing quickly.',
    who && `Your household includes ${who}, so guidance is one step more cautious.`,
  ]).join(' ')
}

function meaningText({ band, level, sensitive }: Facts): string {
  const health = band === null ? 'Health effects are uncertain without particulate data.' : (BANDS[level]?.health ?? '')
  const vulnerable =
    sensitive && level >= BAND_LEVEL.moderate
      ? ' Children, older adults and people with heart or lung conditions are affected first.'
      : ''
  return health + vulnerable
}

/** The headline outdoor step for the guidance level, with the cleanest window when it helps. */
function outdoorSteps({ guidance, profile, sensitive, window }: Facts): string[] {
  if (guidance === 'normal') {
    return compact([
      `Normal outdoor activity is fine${profile.children ? ' — including outdoor play for children' : ''}. Stay hydrated and keep usual precautions.`,
      profile.ventilation === 'openable' && 'Open windows for cross-ventilation while the air is clean.',
    ])
  }
  if (guidance === 'reduce') {
    const cleanest = window
      ? ` and aim for ${fmtHour(window.start)}–${fmtHour(window.end)}, the cleanest window forecast today`
      : ''
    return compact([
      `Keep outdoor exertion short${cleanest}.`,
      sensitive &&
        'Watch children, older adults and anyone with asthma or heart/lung conditions for coughing, wheeze or breathlessness.',
    ])
  }
  return compact([
    `Move exercise and play indoors${guidance === 'stayIn' ? ' and keep outdoor trips essential and short' : '; keep outdoor trips short'}.`,
    guidance === 'avoid' &&
      window &&
      `If you must go out, ${fmtHour(window.start)}–${fmtHour(window.end)} is forecast to be the least polluted (still ${label(window.band)}).`,
    'Follow official local advisories. Seek medical advice for breathlessness, chest tightness, persistent cough or dizziness.',
  ])
}

function healthSteps({ profile, level }: Facts): string[] {
  return compact([
    profile.respiratory &&
      level >= BAND_LEVEL.moderate &&
      'Keep prescribed medication handy and follow your doctor’s action plan.',
    profile.elderly && level >= BAND_LEVEL.poor && 'Check in on older family members regularly today.',
    level >= BAND_LEVEL.poor &&
      profile.commute !== 'remote' &&
      'If travel is unavoidable, a well-fitted N95/FFP2 mask can reduce particle inhalation; it does not remove the risk.',
  ])
}

function indoorSteps({ profile, pmHigh, high }: Facts): string[] {
  return compact([
    pmHigh && profile.purifier && 'Run your air purifier in the room you use most, with doors and windows closed.',
    pmHigh &&
      !profile.purifier &&
      'Reduce indoor sources (incense, candles, smoky cooking, dry sweeping) and consider a HEPA purifier sized for your room if feasible.',
    high &&
      profile.ventilation !== 'acOnly' &&
      'Keep windows closed during peak pollution; air rooms only briefly when outdoor readings are lowest.',
  ])
}

function avoidItems({ profile, level, high }: Facts): string[] {
  const { activity, commute, children } = profile
  return compact([
    level >= BAND_LEVEL.moderate &&
      activity !== 'minimal' &&
      'Jogging, cycling in traffic and other heavy outdoor exercise.',
    level >= BAND_LEVEL.poor && children && 'Outdoor sports and long playground sessions for children.',
    level >= BAND_LEVEL.moderate && 'Burning waste, leaves, incense, candles or mosquito coils indoors.',
    level >= BAND_LEVEL.moderate && 'Dry sweeping or dusting that lifts particles back into the air.',
    (commute === 'car' || commute === 'twoWheeler') && 'Idling the engine while waiting.',
    high &&
      activity === 'outdoorWork' &&
      'Long unprotected stretches of outdoor work; take breaks indoors where you can.',
    level < BAND_LEVEL.moderate && 'Contributing to smog: waste burning and unnecessary engine idling.',
  ])
}

function alternativeItems({ profile, level, guidance, pmHigh }: Facts): string[] {
  const { activity, commute, purifier } = profile
  return compact([
    guidance !== 'normal' &&
      activity !== 'minimal' &&
      'Swap outdoor exercise for indoor yoga, stretching, stair climbing or a home workout.',
    commute === 'car' && 'Take public transport, share a ride or combine errands into one trip.',
    commute === 'twoWheeler' &&
      'Consider metro/bus or a shared ride on the worst days, and wear a well-fitting mask if you ride.',
    commute === 'walkCycle' &&
      level >= BAND_LEVEL.poor &&
      'Use public transport today instead of walking or cycling along busy roads.',
    commute === 'walkCycle' &&
      level < BAND_LEVEL.poor &&
      'Walking or cycling is a great low-emission choice today; prefer quiet, low-traffic routes.',
    pmHigh &&
      !purifier &&
      'Make a low-cost "clean room": one room with windows closed, no indoor smoke, wet-mopped floors.',
    commute === 'remote' && 'Working from home cuts your commute exposure: use that to keep indoor air clean.',
  ])
}

function whyText({ sensitive }: Facts): string {
  return compact([
    'Fine particles (PM2.5) are small enough to reach deep into the lungs and bloodstream.',
    sensitive &&
      'Children breathe faster for their size, and older adults and people with heart or lung conditions have less reserve, so they feel the effects earlier.',
    'Reducing time and exertion outdoors, and keeping indoor air clean, lowers your exposure; these are general awareness guidelines, not medical advice.',
  ]).join(' ')
}

/** Six-part advice for the current reading and household. Every rule is a small, readable condition. */
export function buildAdvice(context: Context): Advice {
  const { reading, profile, data } = context
  const sensitive = isSensitive(profile)
  const level = bandIndex(reading.band)
  const pm25 = reading.pollutants.pm25
  const facts: Facts = {
    context,
    profile,
    band: reading.band,
    level,
    guidance: guidanceFor(reading.band, sensitive),
    sensitive,
    high: level >= BAND_LEVEL.poor,
    pmHigh: pm25 !== null && pm25 > PM25_STANDARD_24H,
    window: bestWindow(data),
  }
  return {
    analysis: analysisText(facts),
    meaning: meaningText(facts),
    doNow: [...outdoorSteps(facts), ...healthSteps(facts), ...indoorSteps(facts)],
    avoid: avoidItems(facts),
    alternatives: alternativeItems(facts),
    why: whyText(facts),
  }
}
