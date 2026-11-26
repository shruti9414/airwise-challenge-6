import type { Advice, BandId, Profile } from '../types'
import { BANDS, WHO_PM25_24H, guidanceFor } from './aqi'
import { bandIndex, label, add, isSensitive, type Context } from './engine'
import { bestWindow, fmtHour } from './outlook'

function household(p: Profile): string {
  const who = [
    p.children && 'children',
    p.elderly && 'older adults',
    p.respiratory && 'people with respiratory sensitivity',
  ].filter(Boolean)
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
  const doNow: string[] = [],
    avoid: string[] = [],
    alternatives: string[] = []
  const who = household(profile)

  const analysis =
    aqi === null
      ? 'There is not enough valid pollutant data (PM2.5 or PM10, plus at least three pollutants over their CPCB averaging periods), so an Indian AQI estimate is unavailable. Treat the guidance below as cautious defaults and check an official local source.'
      : `The Indian AQI is ${aqi} (${label(band)})${dominant ? `, driven mainly by ${dominant === 'pm25' ? 'PM2.5' : dominant === 'pm10' ? 'PM10' : dominant.toUpperCase()}` : ''}.` +
        (pm25 !== null
          ? ` PM2.5 averages ${Math.round(pm25)} µg/m³, about ${(pm25 / WHO_PM25_24H).toFixed(1)}× the WHO 24-hour guideline of ${WHO_PM25_24H} µg/m³.`
          : '') +
        (calm && high ? ' Winds are light, so pollution is not dispersing quickly.' : '') +
        (who ? ` Your household includes ${who}, so guidance is one step more cautious.` : '')

  const meaning =
    (band === null
      ? 'Health effects are uncertain without particulate data.'
      : (BANDS[bandIndex(band)]?.health ?? '')) +
    (sensitive && bandIndex(band) >= 2
      ? ' Children, older adults and people with heart or lung conditions are affected first.'
      : '')

  if (guidance === 'normal') {
    add(
      doNow,
      true,
      `Normal outdoor activity is fine${profile.children ? ' — including outdoor play for children' : ''}. Stay hydrated and keep usual precautions.`,
    )
    add(doNow, profile.ventilation === 'openable', 'Open windows for cross-ventilation while the air is clean.')
  } else if (guidance === 'reduce') {
    add(
      doNow,
      true,
      `Keep outdoor exertion short${window ? ` and aim for ${fmtHour(window.start)}–${fmtHour(window.end)}, the cleanest window forecast today` : ''}.`,
    )
    add(
      doNow,
      sensitive,
      'Watch children, older adults and anyone with asthma or heart/lung conditions for coughing, wheeze or breathlessness.',
    )
  } else {
    add(
      doNow,
      true,
      `Move exercise and play indoors${guidance === 'stayIn' ? ' and keep outdoor trips essential and short' : '; keep outdoor trips short'}.`,
    )
    add(
      doNow,
      window && guidance === 'avoid',
      `If you must go out, ${fmtHour((window as { start: number }).start)}–${fmtHour((window as { end: number }).end)} is forecast to be the least polluted (still ${label((window as { band: BandId }).band)}).`,
    )
    add(
      doNow,
      true,
      'Follow official local advisories. Seek medical advice for breathlessness, chest tightness, persistent cough or dizziness.',
    )
  }
  add(
    doNow,
    profile.respiratory && bandIndex(band) >= 2,
    'Keep prescribed medication handy and follow your doctor’s action plan.',
  )
  add(doNow, profile.elderly && bandIndex(band) >= 3, 'Check in on older family members regularly today.')
  add(
    doNow,
    bandIndex(band) >= 3 && profile.commute !== 'remote',
    'If travel is unavoidable, a well-fitted N95/FFP2 mask can reduce particle inhalation; it does not remove the risk.',
  )

  const pmHigh = pm25 !== null && pm25 > 60
  add(
    doNow,
    pmHigh && profile.purifier,
    'Run your air purifier in the room you use most, with doors and windows closed.',
  )
  add(
    doNow,
    pmHigh && !profile.purifier,
    'Reduce indoor sources (incense, candles, smoky cooking, dry sweeping) and consider a HEPA purifier sized for your room if feasible.',
  )
  add(
    doNow,
    high && profile.ventilation !== 'acOnly',
    'Keep windows closed during peak pollution; air rooms only briefly when outdoor readings are lowest.',
  )

  add(
    avoid,
    bandIndex(band) >= 2 && profile.activity !== 'minimal',
    'Jogging, cycling in traffic and other heavy outdoor exercise.',
  )
  add(avoid, bandIndex(band) >= 3 && profile.children, 'Outdoor sports and long playground sessions for children.')
  add(avoid, bandIndex(band) >= 2, 'Burning waste, leaves, incense, candles or mosquito coils indoors.')
  add(avoid, bandIndex(band) >= 2, 'Dry sweeping or dusting that lifts particles back into the air.')
  add(avoid, profile.commute === 'car' || profile.commute === 'twoWheeler', 'Idling the engine while waiting.')
  add(
    avoid,
    high && profile.activity === 'outdoorWork',
    'Long unprotected stretches of outdoor work; take breaks indoors where you can.',
  )
  add(avoid, bandIndex(band) < 2, 'Contributing to smog: waste burning and unnecessary engine idling.')

  add(
    alternatives,
    guidance !== 'normal' && profile.activity !== 'minimal',
    'Swap outdoor exercise for indoor yoga, stretching, stair climbing or a home workout.',
  )
  add(alternatives, profile.commute === 'car', 'Take public transport, share a ride or combine errands into one trip.')
  add(
    alternatives,
    profile.commute === 'twoWheeler',
    'Consider metro/bus or a shared ride on the worst days, and wear a well-fitting mask if you ride.',
  )
  add(
    alternatives,
    profile.commute === 'walkCycle' && bandIndex(band) >= 3,
    'Use public transport today instead of walking or cycling along busy roads.',
  )
  add(
    alternatives,
    profile.commute === 'walkCycle' && bandIndex(band) < 3,
    'Walking or cycling is a great low-emission choice today; prefer quiet, low-traffic routes.',
  )
  add(
    alternatives,
    pmHigh && !profile.purifier,
    'Make a low-cost "clean room": one room with windows closed, no indoor smoke, wet-mopped floors.',
  )
  add(
    alternatives,
    profile.commute === 'remote',
    'Working from home cuts your commute exposure: use that to keep indoor air clean.',
  )

  const why =
    `Fine particles (PM2.5) are small enough to reach deep into the lungs and bloodstream. ` +
    (sensitive
      ? 'Children breathe faster for their size, and older adults and people with heart or lung conditions have less reserve, so they feel the effects earlier. '
      : '') +
    'Reducing time and exertion outdoors, and keeping indoor air clean, lowers your exposure; these are general awareness guidelines, not medical advice.'

  return { analysis, meaning, doNow, avoid, alternatives, why }
}
