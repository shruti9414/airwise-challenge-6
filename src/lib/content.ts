import type { Commute, Profile } from '../types'

export interface Hack {
  id: string
  title: string
  what: string
  why: string
  difficulty: 'Easy' | 'Moderate'
  cost: 'Free' | '₹ low' | '₹₹ medium' | '₹₹₹ higher'
  benefit: string
  limits: string
}

export const HACKS: Hack[] = [
  { id: 'indoor:hack-ventilate', title: 'Ventilate when outdoor air is cleaner', what: 'Open windows for 10–15 minutes at the time of day AirWise shows the lowest outdoor AQI, then close them.', why: 'Indoor pollutants from cooking and cleaning build up; a short flush replaces them when outside air is cleaner than inside.', difficulty: 'Easy', cost: 'Free', benefit: 'Moderate, only when outdoor air is better than indoor air.', limits: 'Counter-productive during Poor to Severe smog or near busy roads.' },
  { id: 'indoor:hack-smoke', title: 'Cut indoor smoke sources', what: 'Avoid smoking, incense, mosquito coils and scented candles indoors, especially on smog days.', why: 'These burn materials and release fine particles directly into the air you are breathing.', difficulty: 'Easy', cost: 'Free', benefit: 'High: removes a source rather than cleaning up after it.', limits: 'Does not address pollution entering from outdoors.' },
  { id: 'indoor:hack-exhaust', title: 'Use the kitchen exhaust while cooking', what: 'Switch on the chimney or exhaust fan before cooking and keep it running for a few minutes afterwards.', why: 'Frying and cooking on gas or biomass releases particles and gases such as NO₂.', difficulty: 'Easy', cost: 'Free', benefit: 'Moderate to high in kitchens that vent outside.', limits: 'Recirculating hoods without outdoor venting remove less.' },
  { id: 'indoor:hack-mop', title: 'Wet-mop instead of dry sweeping', what: 'Use a damp mop or cloth for floors and surfaces; dust shelves with a damp cloth.', why: 'Dry sweeping lifts settled dust back into the air where you breathe it.', difficulty: 'Easy', cost: 'Free', benefit: 'Moderate for dust and settled particles.', limits: 'Does not remove fine particles already suspended in the air.' },
  { id: 'indoor:hack-filters', title: 'Maintain AC and purifier filters', what: 'Clean or replace AC and purifier filters on the schedule in the manual, more often in smog season.', why: 'Clogged filters move less air and can release trapped dust back into rooms.', difficulty: 'Easy', cost: '₹ low', benefit: 'Keeps existing equipment working properly.', limits: 'Standard AC filters do not remove fine PM2.5 the way HEPA does.' },
  { id: 'indoor:hack-hepa', title: 'Use a HEPA purifier sized for the room', what: 'Pick a purifier with a true HEPA filter and a clean air delivery rate suited to your room size; run it with doors and windows closed.', why: 'HEPA filters capture a large share of fine particles including PM2.5.', difficulty: 'Moderate', cost: '₹₹₹ higher', benefit: 'High for PM2.5 in the room where it runs.', limits: 'Does not remove gases, needs filter replacement and electricity, and an undersized unit does little.' },
  { id: 'indoor:hack-room', title: 'Make one “clean room”', what: 'Choose a bedroom, close its windows, keep it free of smoke and dust, and spend smog-heavy hours there.', why: 'Concentrating your clean-air effort on one room is cheaper and more effective than the whole home.', difficulty: 'Moderate', cost: '₹ low', benefit: 'Moderate; stronger when paired with a purifier.', limits: 'Still depends on how leaky the room is.' },
  { id: 'indoor:hack-seal', title: 'Seal obvious draughts', what: 'Use door sweeps or weather-stripping on gaps around the doors and windows of the room you use most.', why: 'Leaky rooms let outdoor particles in even with windows closed.', difficulty: 'Moderate', cost: '₹ low', benefit: 'Low to moderate.', limits: 'Reduces fresh air; do not seal rooms with gas appliances and keep kitchen ventilation working.' },
  { id: 'indoor:hack-plants', title: 'Keep plants as décor, not as filters', what: 'Enjoy indoor plants for their look and feel, and rely on source control and filtration for clean air.', why: 'Studies showing plants clean air were done in sealed chambers; at home scale their effect on air quality is negligible.', difficulty: 'Easy', cost: '₹ low', benefit: 'Wellbeing and appearance only, not measurable air cleaning.', limits: 'Do not count plants as a substitute for ventilation, source control or a purifier.' },
]

export function rankHacks(opts: { pmHigh: boolean; purifier: boolean; severe: boolean; openable: boolean }): Hack[] {
  const score = (h: Hack): number => {
    const k = h.id.replace('indoor:hack-', '')
    if (k === 'hepa') return opts.pmHigh && !opts.purifier ? 9 : opts.purifier ? 2 : 5
    if (k === 'filters') return opts.purifier ? 8 : 4
    if (k === 'ventilate') return opts.severe ? 1 : opts.openable ? 7 : 3
    if (k === 'seal' || k === 'room') return opts.severe ? 8 : 4
    if (k === 'plants') return 0
    return 6
  }
  return [...HACKS].sort((a, b) => score(b) - score(a))
}

export interface Alternative { id: string; title: string; text: string; commutes: Commute[] | 'all'; outdoor: boolean }

export const ALTERNATIVES: Alternative[] = [
  { id: 'transit', title: 'Use public transport', text: 'Metro, bus or train moves many people per unit of fuel and cuts street-level exhaust.', commutes: ['car', 'twoWheeler'], outdoor: false },
  { id: 'carpool', title: 'Carpool or share rides', text: 'Two people in one car roughly halves emissions per person for the same trip.', commutes: ['car', 'twoWheeler'], outdoor: false },
  { id: 'combine', title: 'Combine errands into one trip', text: 'Plan one loop instead of several short trips; cold-start trips emit the most.', commutes: ['car', 'twoWheeler'], outdoor: false },
  { id: 'idle', title: 'Switch the engine off when waiting', text: 'More than a minute of idling burns fuel without moving you anywhere.', commutes: ['car', 'twoWheeler'], outdoor: false },
  { id: 'walk', title: 'Walk or cycle short trips', text: 'For trips under about 3 km, walking or cycling emits nothing; pick quiet, low-traffic streets.', commutes: 'all', outdoor: true },
  { id: 'burn', title: 'Never burn waste or leaves', text: 'Open burning is a major local source of PM2.5; use municipal collection or composting.', commutes: 'all', outdoor: false },
  { id: 'energy', title: 'Use energy efficiently at home', text: 'LED lighting, unplugging idle devices and setting AC to 24–26 °C cut electricity demand.', commutes: 'all', outdoor: false },
]

export function alternativesFor(profile: Profile, severeOutdoors: boolean) {
  const items = ALTERNATIVES.filter((a) => (a.commutes === 'all' || a.commutes.includes(profile.commute)) && !(a.outdoor && severeOutdoors))
  const paused = ALTERNATIVES.some((a) => a.outdoor) && severeOutdoors
    ? 'Walking and cycling are paused while air quality is Poor or worse; use public transport or a shared ride instead.' : null
  return { items, paused }
}

export const TIPS = [
  'Share the day’s AQI with neighbours and your residents’ association so everyone can plan outdoor time.',
  'Agree on a “no open burning” rule for your lane or society, and arrange regular waste collection.',
  'Organise a ride-share board for school runs and office commutes.',
  'Ask schools to move sports indoors on Poor-or-worse days.',
  'Check on older neighbours during severe smog spells.',
  'Plant and protect street trees; they help shade and cool streets, though they do not clear smog.',
]

export const CHALLENGES = [
  { id: 'car-light', title: 'Car-light week', goal: 5, text: 'Log 5 low-emission trips in the last 7 days.' },
  { id: 'share-ride', title: 'Share-a-ride week', goal: 3, text: 'Log 3 carpool or public-transport trips in the last 7 days.' },
  { id: 'one-trip', title: 'One-trip errands', goal: 3, text: 'Combine errands into one trip 3 times this week.' },
]

export const ACTIONS = [
  'Start a society-level waste segregation and collection drive.',
  'Request a no-idling sign at school gates and market entrances.',
  'Ask your municipality or RWA to dampen roads and construction dust.',
  'Set up a shared bicycle or carpool group for your neighbourhood.',
]

export const ACTIVITIES = [
  'Family “AQI detective”: check the AirWise reading each morning and note how it changes through the day.',
  'School poster day on what PM2.5 is and how to reduce exposure.',
  'Build a classroom “clean air plan”: indoor games for Poor-AQI days.',
  'Walk the neighbourhood and map sources of smoke and dust, then discuss fixes.',
]

export const CHECKLIST = [
  { id: 'c1', text: 'No open burning of waste or leaves' },
  { id: 'c2', text: 'Vehicles serviced and tyres properly inflated' },
  { id: 'c3', text: 'Engine switched off when waiting' },
  { id: 'c4', text: 'Kitchen exhaust used while cooking' },
  { id: 'c5', text: 'AC and purifier filters cleaned' },
  { id: 'c6', text: 'Wet mopping instead of dry sweeping' },
  { id: 'c7', text: 'One errand trip combined this week' },
  { id: 'c8', text: 'Checked official AQI advisories today' },
]
