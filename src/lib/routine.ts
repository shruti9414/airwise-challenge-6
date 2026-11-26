import type { BandId, Guidance, Period, Profile, Routine, RoutineItem } from '../types'
import { guidanceFor } from './aqi'
import { BAND_LEVEL, bandIndex, isSensitive, label, type Context } from './engine'
import { bestWindow, fmtHour, periodOutlook } from './outlook'
import { compact } from './util'

/** How a part of the day looks: its band, the guidance that follows from it, and a phrase describing the source. */
interface PeriodView {
  band: BandId | null
  guidance: Guidance
  note: string
}

interface Facts {
  profile: Profile
  /** Cleanest two-hour window left today, if any. */
  window: ReturnType<typeof bestWindow>
  morning: PeriodView
  afternoon: PeriodView
  evening: PeriodView
  night: PeriodView
  /** Drives a car or two-wheeler, so fewer trips and no idling matter. */
  motorised: boolean
}

const item = (id: string, text: string, reason: string): RoutineItem => ({ id, text, reason })

/** Picks the wording that fits the guidance level: normal, reduce, or avoid/stay in. */
const byGuidance = (g: Guidance, normal: string, reduce: string, strict: string) =>
  g === 'normal' ? normal : g === 'reduce' ? reduce : strict

function morningItems({ profile, morning: m, motorised }: Facts): RoutineItem[] {
  const level = bandIndex(m.band)
  const clean = level < BAND_LEVEL.moderate
  const poor = level >= BAND_LEVEL.poor
  return compact([
    item(
      'exposure:morning-outdoor',
      byGuidance(
        m.guidance,
        'Walk or play outdoors for exercise and fresh air.',
        'Keep outdoor time short; shift longer activity to the cleanest window.',
        'Skip outdoor workouts and playground time; exercise indoors.',
      ),
      `${m.note} this morning${m.guidance === 'normal' ? ', so normal activity is reasonable' : '; winter mornings often trap pollution near the ground'}.`,
    ),
    profile.ventilation === 'openable' &&
      item(
        'indoor:morning-air',
        clean ? 'Open windows for 10–15 minutes to air out rooms.' : 'Keep windows closed this morning.',
        clean
          ? 'Outdoor air is cleaner than average, so a short flush helps clear indoor pollutants.'
          : `Opening windows would let in ${m.note} air.`,
      ),
    profile.commute !== 'remote' &&
      item(
        'movement:morning-commute',
        profile.commute === 'walkCycle' && poor
          ? 'Take public transport instead of walking or cycling today.'
          : motorised
            ? 'Share a ride, use public transport or combine errands into one trip.'
            : 'Choose low-traffic routes for your commute.',
        motorised
          ? 'Fewer vehicle trips mean lower emissions and less traffic pollution on your street.'
          : 'Heavy exertion beside traffic raises how much pollution you inhale.',
      ),
    poor &&
      profile.commute !== 'remote' &&
      item(
        'exposure:morning-mask',
        'If you must travel, wear a well-fitted N95/FFP2 mask.',
        'Masks only help when they seal well; they reduce but do not eliminate exposure, and may not fit young children, so limit their time outdoors instead.',
      ),
  ])
}

function afternoonItems({ profile, window, afternoon: a, motorised }: Facts): RoutineItem[] {
  return compact([
    window &&
      item(
        'exposure:afternoon-window',
        `Plan outdoor time for ${fmtHour(window.start)}–${fmtHour(window.end)}.`,
        `This is the lowest forecast outlook window today (index ≈ ${window.aqi}, ${label(window.band)}); sunlight and warmth usually disperse pollution.`,
      ),
    a.guidance !== 'normal' &&
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
    motorised &&
      item(
        'movement:afternoon-errands',
        'Combine errands into a single trip.',
        'One trip instead of several cuts both fuel use and your time in traffic.',
      ),
  ])
}

function eveningItems({ evening: e, motorised }: Facts): RoutineItem[] {
  return compact([
    item(
      'indoor:evening-cook',
      'Switch on the kitchen exhaust while cooking.',
      'Cooking releases fine particles and gases that otherwise linger indoors.',
    ),
    item(
      'exposure:evening-outdoor',
      byGuidance(
        e.guidance,
        'A short evening walk is fine.',
        'Keep any evening walk brief and away from busy roads.',
        'Skip evening walks; stay in or exercise indoors.',
      ),
      `${e.note}; pollution often builds as temperatures drop after sunset.`,
    ),
    motorised &&
      item(
        'movement:evening-idle',
        'Switch the engine off when waiting.',
        'Idling adds exhaust without moving you anywhere.',
      ),
  ])
}

function nightItems({ profile, night: n }: Facts): RoutineItem[] {
  return compact([
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
}

/** A four-period routine; every item has a stable id and a reason. */
export function buildRoutine({ data, reading, profile }: Context): Routine {
  const sensitive = isSensitive(profile)
  const view = (period: Period): PeriodView => {
    const outlook = periodOutlook(data, period)
    const band = outlook?.band ?? reading.band
    return {
      band,
      guidance: guidanceFor(band, sensitive),
      note: outlook
        ? `${label(outlook.band)} outlook (index ≈ ${outlook.aqi})`
        : `current ${label(reading.band)} reading`,
    }
  }
  const facts: Facts = {
    profile,
    window: bestWindow(data),
    morning: view('morning'),
    afternoon: view('afternoon'),
    evening: view('evening'),
    night: view('night'),
    motorised: profile.commute === 'car' || profile.commute === 'twoWheeler',
  }
  return {
    morning: morningItems(facts),
    afternoon: afternoonItems(facts),
    evening: eveningItems(facts),
    night: nightItems(facts),
  }
}
