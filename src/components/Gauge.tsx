import type { Reading } from '../types'
import { BANDS, POLLUTANT_LABEL, bandFor } from '../lib/aqi'

export default function Gauge({ aqi, reading }: { aqi: number | null; reading: Reading }) {
  const R = 84,
    C = 100
  const pt = (v: number, r = R) => {
    const a = Math.PI * (1 - Math.min(v, 500) / 500)
    return [C + r * Math.cos(a), C - r * Math.sin(a)] as const
  }
  const arcs = BANDS.map((b, i) => {
    const [x1, y1] = pt(BANDS[i - 1]?.max ?? 0),
      [x2, y2] = pt(b.max)
    return <path key={b.id} d={`M${x1} ${y1}A${R} ${R} 0 0 1 ${x2} ${y2}`} className={`arc arc-${b.id}`} />
  })
  const [mx, my] = pt(aqi ?? 0)
  const label = aqi === null ? 'AQI unavailable' : `AQI ${aqi}, ${bandFor(aqi)?.label}, on the Indian CPCB scale`
  return (
    <figure className="gauge">
      <svg viewBox="0 0 200 118" role="img" aria-label={label}>
        {arcs}
        {aqi !== null && <circle cx={mx} cy={my} r="9" className="marker" />}
        <text x="100" y="88" textAnchor="middle" className="gauge-num">
          {aqi ?? '—'}
        </text>
        <text x="100" y="108" textAnchor="middle" className="gauge-cap">
          Indian AQI
        </text>
      </svg>
      <figcaption className="sr-only">
        {reading.dominant ? `Main pollutant: ${POLLUTANT_LABEL[reading.dominant]}` : 'No main pollutant available'}
      </figcaption>
    </figure>
  )
}
