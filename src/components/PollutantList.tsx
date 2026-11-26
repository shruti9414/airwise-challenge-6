import type { Pollutant, Reading } from '../types'
import { POLLUTANT_LABEL, POLLUTANT_UNIT, bandFor, subIndex, toDisplayUnit } from '../lib/aqi'

/** Averaged concentration and CPCB sub-index for each pollutant, with the averaging note. */
export default function PollutantList({ reading }: { reading: Reading }) {
  return (
    <>
      <h3>Pollutants</h3>
      <ul className="pollutants">
        {(Object.keys(POLLUTANT_LABEL) as Pollutant[]).map((p) => {
          const v = reading.pollutants[p]
          const sub = subIndex(p, v)
          return (
            <li key={p}>
              <span className="p-name">{POLLUTANT_LABEL[p]}</span>
              <span className="p-val">
                {v === null ? 'n/a' : `${toDisplayUnit(p, v).toFixed(p === 'co' ? 2 : 0)} ${POLLUTANT_UNIT[p]}`}
              </span>
              <span className="p-band">{sub === null ? 'Unavailable' : `${bandFor(sub)?.label} (${sub})`}</span>
            </li>
          )
        })}
      </ul>
      <p className="hint">
        CPCB averaging: 24-hour mean for PM2.5, PM10, NO₂ and SO₂; 8-hour mean for CO and O₃. “n/a” means too few valid
        hours. Sub-index shown in brackets.
      </p>
    </>
  )
}
