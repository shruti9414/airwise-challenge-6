import type { Guidance, Period, Routine, RoutineItem } from '../types'
import { guidanceFor } from './aqi'
import { bandIndex, label, isSensitive, type Context } from './engine'
import { bestWindow, fmtHour, periodOutlook } from './outlook'
import { compact } from './util'

export function buildRoutine({ data, reading, profile }: Context): Routine {
  const sensitive = isSensitive(profile)
  const win = bestWindow(data)
  const item = (id: string, text: string, reason: string): RoutineItem => ({ id, text, reason })
  const ctxFor = (p: Period) => {
    const o = periodOutlook(data, p)
    const band = o?.band ?? reading.band
    return {
      band,
      g: guidanceFor(band, sensitive),
      note: o ? `${label(o.band)} outlook (index ≈ ${o.aqi})` : `current ${label(reading.band)} reading`,
    }
  }
  const car = profile.commute === 'car' || profile.commute === 'twoWheeler'
  const m = ctxFor('morning'),
    a = ctxFor('afternoon'),
    e = ctxFor('evening')
  const n = ctxFor('night')
  const out = (g: Guidance, hi: string, mid: string, lo: string) => (g === 'normal' ? hi : g === 'reduce' ? mid : lo)

  const morning = compact<RoutineItem>([
    item(
      'exposure:morning-outdoor',
      out(
        m.g,
        'Walk or play outdoors for exercise and fresh air.',
        'Keep outdoor time short; shift longer activity to the cleanest window.',
        'Skip outdoor workouts and playground time; exercise indoors.',
      ),
      `${m.note} this morning${m.g === 'normal' ? ', so normal activity is reasonable' : '; winter mornings often trap pollution near the ground'}.`,
    ),
    profile.ventilation === 'openable' &&
      item(
        'indoor:morning-air',
        bandIndex(m.band) <= 1
          ? 'Open windows for 10–15 minutes to air out rooms.'
          : 'Keep windows closed this morning.',
        bandIndex(m.band) <= 1
          ? 'Outdoor air is cleaner than average, so a short flush helps clear indoor pollutants.'
          : `Opening windows would let in ${m.note} air.`,
      ),
    profile.commute !== 'remote' &&
      item(
        'movement:morning-commute',
        profile.commute === 'walkCycle' && bandIndex(m.band) >= 3
          ? 'Take public transport instead of walking or cycling today.'
          : car
            ? 'Share a ride, use public transport or combine errands into one trip.'
            : 'Choose low-traffic routes for your commute.',
        car
          ? 'Fewer vehicle trips mean lower emissions and less traffic pollution on your street.'
          : 'Heavy exertion beside traffic raises how much pollution you inhale.',
      ),
    bandIndex(m.band) >= 3 &&
      profile.commute !== 'remote' &&
      item(
        'exposure:morning-mask',
        'If you must travel, wear a well-fitted N95/FFP2 mask.',
        'Masks only help when they seal well; they reduce but do not eliminate exposure, and may not fit young children, so limit their time outdoors instead.',
      ),
  ])

  const afternoon = compact<RoutineItem>([
    win &&
      item(
        'exposure:afternoon-window',
        `Plan outdoor time for ${fmtHour(win.start)}–${fmtHour(win.end)}.`,
        `This is the lowest forecast outlook window today (index ≈ ${win.aqi}, ${label(win.band)}); sunlight and warmth usually disperse pollution.`,
      ),
    a.g !== 'normal' &&
      profile.activity !== 'minimal' &&
      item(
        'movement:afternoon-indoor',
        'Do 20–30 minutes of indoor exercise: yoga, stretching or stairs.',
        `Outdoor effort at ${a.note} means deeper breathing of polluted air.`,
      ),
    item(
      'indoor:afternoon-mop',
      'Wet-mop floors instead of dry sweeping.',
      'Damp cleaning traps dust; sweeping re-suspends fine particles.',
    ),
    car &&
      item(
        'movement:afternoon-errands',
        'Combine errands into a single trip.',
        'One trip instead of several cuts both fuel use and your time in traffic.',
      ),
  ])

  const evening = compact<RoutineItem>([
    item(
      'indoor:evening-cook',
      'Switch on the kitchen exhaust while cooking.',
      'Cooking releases fine particles and gases that otherwise linger indoors.',
    ),
    item(
      'exposure:evening-outdoor',
      out(
        e.g,
        'A short evening walk is fine.',
        'Keep any evening walk brief and away from busy roads.',
        'Skip evening walks; stay in or exercise indoors.',
      ),
      `${e.note}; pollution often builds as temperatures drop after sunset.`,
    ),
    car &&
      item(
        'movement:evening-idle',
        'Switch the engine off when waiting.',
        'Idling adds exhaust without moving you anywhere.',
      ),
  ])

  const night = compact<RoutineItem>([
    item(
      'indoor:night-air',
      profile.purifier
        ? 'Run the purifier in the bedroom on a quiet setting, doors closed.'
        : 'Keep bedroom windows closed and avoid burning incense or coils.',
      profile.purifier
        ? 'You spend about a third of the day asleep, so clean bedroom air matters.'
        : `Overnight outlook: ${n.note}; closed windows limit what gets in.`,
    ),
    (profile.purifier || profile.ventilation === 'acOnly') &&
      item(
        'indoor:night-filter',
        'Check and clean purifier or AC filters.',
        'Clogged filters clean less air and can recirculate dust.',
      ),
    item(
      'exposure:night-plan',
      'Check tomorrow’s outlook before planning school runs or exercise.',
      'A cleaner window can be planned around instead of guessed.',
    ),
  ])

  return { morning, afternoon, evening, night }
}
