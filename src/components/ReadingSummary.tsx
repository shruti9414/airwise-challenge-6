import type { AirData, Guidance, Reading } from '../types'
import { AQI_NOTE, BANDS, GUIDANCE_LABEL, POLLUTANT_LABEL } from '../lib/aqi'
import Gauge from './Gauge'
import { BandBadge } from './ui'

const fmtTime = (ms: number) => new Date(ms).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

/** Gauge, category, guidance, disclaimer and observation details for the current reading. */
export default function ReadingSummary({
  reading,
  data,
  guidance,
}: {
  reading: Reading
  data: AirData
  guidance: Guidance | null
}) {
  return (
    <div className="hero-grid">
      <Gauge aqi={reading.aqi} reading={reading} />
      <div>
        <BandBadge band={reading.band} />
        <p className="guidance">{guidance && GUIDANCE_LABEL[guidance]}</p>
        <p className="muted">
          {BANDS.find((b) => b.id === reading.band)?.health ??
            'There is not enough valid pollutant data to estimate an AQI.'}
        </p>
        <p className="hint">{AQI_NOTE}</p>
        <dl className="meta">
          <div>
            <dt>Main pollutant</dt>
            <dd>{reading.dominant ? POLLUTANT_LABEL[reading.dominant] : 'Unavailable'}</dd>
          </div>
          <div>
            <dt>Observation time</dt>
            <dd>{fmtTime(data.observedAt)}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{data.source === 'live' ? 'Open-Meteo Air Quality (CAMS model)' : 'Built-in sample'}</dd>
          </div>
          {data.weather && (
            <div>
              <dt>Weather</dt>
              <dd>
                {Math.round(data.weather.temperature)} °C · {Math.round(data.weather.humidity)}% humidity · wind{' '}
                {Math.round(data.weather.windSpeed)} km/h
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}
