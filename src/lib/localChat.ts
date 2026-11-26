import { BANDS, GUIDANCE_LABEL, guidanceFor } from './aqi'
import { isSensitive, type Context } from './engine'
import { bestWindow, fmtHour } from './outlook'
import type { ChatAnswer } from './ai'

type Topic = 'school' | 'indoor' | 'commute' | 'mask' | 'windows' | 'exercise' | 'symptoms' | 'time' | 'outside'

/** Keyword routing (English + common Hinglish). First match wins; order matters. */
const TOPICS: [Topic, RegExp][] = [
  ['symptoms', /cough|wheez|breath|asthma|chest|dizz|sick|ill\b|doctor|khansi|saans|dama/i],
  ['mask', /mask|n95|ffp2/i],
  ['school', /school|child|kid|baby|infant|bachch|bachh|play/i],
  ['indoor', /bedroom|indoor|purifier|hepa|plant|clean(?:er)? (?:the )?air|room|sleep|cook|kitchen|ghar|andar/i],
  ['windows', /window|ventilat|khidki|door/i],
  ['commute', /commute|travel|drive|car\b|bike|metro|bus\b|office|transport|emission|carpool/i],
  ['exercise', /exercis|jog|run\b|running|walk|cycl|yoga|gym|workout|sport/i],
  ['time', /when|best time|which time|kab|timing|window of/i],
  ['outside', /outside|outdoor|safe|bahar|go out|today|aaj/i],
]

export const topicOf = (q: string): Topic | null => TOPICS.find(([, re]) => re.test(q))?.[0] ?? null

/**
 * Answers a free-text question from the live reading and household profile, with no network call.
 * It is deliberately template-based: it never improvises facts beyond what the local engine already knows.
 */
export function answerLocally({ data, reading, profile }: Context, question: string): ChatAnswer {
  const sensitive = isSensitive(profile)
  const guidance = guidanceFor(reading.band, sensitive)
  const band = BANDS.find((b) => b.id === reading.band)
  const level = reading.aqi === null ? 'not available (particulate data missing)' : `${reading.aqi} (${band?.label})`
  const win = bestWindow(data)
  const bad = BANDS.findIndex((b) => b.id === reading.band) >= 3
  const winText = win ? `${fmtHour(win.start)}–${fmtHour(win.end)}` : null
  const base = `The Indian AQI right now is ${level}. For your household the outdoor guidance is: ${GUIDANCE_LABEL[guidance]}.`
  const care = 'This is general awareness guidance, not medical advice.'

  switch (topicOf(question)) {
    case 'symptoms':
      return {
        answer: `${base} If anyone has breathlessness, chest tightness, a persistent cough or dizziness, stop activity, move to cleaner indoor air and seek medical advice. ${care}`,
        steps: [
          'Keep prescribed medication handy and follow your doctor’s plan',
          'Follow official local advisories',
          'Contact a doctor or emergency service for severe symptoms',
        ],
      }
    case 'mask':
      return {
        answer: `${base} ${bad ? 'A well-fitted N95/FFP2 mask can reduce particle inhalation if travel is unavoidable, but it does not remove the risk and may not fit young children.' : 'A mask is not usually needed at this level; it matters most when air is poor or worse.'}`,
        steps: [
          'Choose a snug seal over cloth or surgical masks',
          'Limit outdoor time instead of relying on a mask',
          'Do not use masks on children under 2',
        ],
      }
    case 'school':
      return {
        answer: `${base} ${guidance === 'normal' ? 'Normal school and outdoor play are fine today.' : guidance === 'reduce' ? 'School is fine, but keep outdoor sports and play short.' : 'Prefer indoor activities at school and keep outdoor play to a minimum; talk to the school about indoor alternatives.'}`,
        steps: [
          ...(winText && guidance !== 'normal'
            ? [`If outdoor time is needed, ${winText} is forecast to be the cleanest window today`]
            : []),
          'Watch for coughing or wheeze after outdoor time',
          'Check the outlook again before tomorrow’s school run',
        ],
      }
    case 'indoor':
      return {
        answer: `${base} ${profile.purifier ? 'Run your purifier in the room you use most with doors and windows closed.' : 'Without a purifier, you can still make a low-cost clean room: windows closed, no indoor smoke, floors wet-mopped.'}`,
        steps: [
          'Avoid incense, candles, coils and smoky cooking',
          'Wet-mop instead of dry sweeping',
          'Use the kitchen exhaust while cooking',
          ...(profile.purifier ? ['Clean or replace the purifier filter on schedule'] : []),
        ],
      }
    case 'windows':
      return {
        answer: `${base} ${bad ? 'Keep windows closed during peak pollution and air rooms only briefly.' : profile.ventilation === 'acOnly' ? 'Your home is sealed/AC only, so keep AC filters clean.' : 'Opening windows for 10–15 minutes is reasonable while the air is cleaner.'}`,
        steps: [
          ...(winText ? [`If you must air the rooms, ${winText} is forecast to be the best time today`] : []),
          'Close windows again afterwards',
          'Clean AC and purifier filters regularly',
        ],
      }
    case 'commute':
      return {
        answer: `${base} ${profile.commute === 'remote' ? 'You work or study from home, which already avoids commute exposure.' : profile.commute === 'walkCycle' && bad ? 'Use public transport instead of walking or cycling along busy roads today.' : profile.commute === 'car' || profile.commute === 'twoWheeler' ? 'Public transport, a shared ride or one combined trip are the lowest-emission choices.' : 'Public transport and quiet, low-traffic routes are good low-emission choices.'}`,
        steps: [
          'Combine errands into a single trip',
          'Switch the engine off when waiting',
          'Choose low-traffic routes',
        ],
      }
    case 'exercise':
      return {
        answer: `${base} ${guidance === 'normal' ? 'Normal outdoor exercise is fine.' : guidance === 'reduce' ? 'Keep outdoor exercise short and easy.' : 'Move exercise indoors today.'}`,
        steps: [
          ...(winText && guidance !== 'normal' ? [`Cleanest outdoor window today: ${winText}`] : []),
          'Try indoor yoga, stretching or stair climbing',
          'Avoid exercising beside heavy traffic',
        ],
      }
    case 'time':
      return {
        answer: winText
          ? `${base} The cleanest modelled window for the rest of today is around ${winText}.`
          : `${base} No cleaner window is forecast for the rest of today.`,
        steps: ['Plan outdoor time for the cleanest window', 'Recheck the forecast later today'],
      }
    case 'outside':
      return {
        answer: `${base} ${guidance === 'normal' ? 'Normal outdoor activity is fine.' : guidance === 'reduce' ? 'Keep outdoor exertion short.' : 'Keep outdoor trips short and essential.'} ${care}`,
        steps: [...(winText ? [`Cleanest window forecast today: ${winText}`] : []), 'Follow official local advisories'],
      }
    default:
      return {
        answer: `${base} I can answer questions about school and children, indoor air, windows, commute, masks, exercise and the best time to go out. ${care}`,
        steps: ['Try: “Is it safe to send my child to school?”', 'Try: “How can I clean the air in my bedroom?”'],
      }
  }
}
