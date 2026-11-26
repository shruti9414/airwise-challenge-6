import type { Alert } from '../types'
import { BANDS, GUIDANCE_LABEL, PM25_STANDARD_24H, WHO_PM25_24H, guidanceFor } from './aqi'
import { isStale, outlookAt } from './airData'
import { bandIndex, label, isSensitive, type Context } from './engine'
import { fmtHour, hourOf } from './outlook'

export function buildAlerts({ data, reading, profile, now = Date.now() }: Context): Alert[] {
  const alerts: Alert[] = []
  const idx = bandIndex(reading.band)
  if (data.source === 'sample')
    alerts.push({
      id: 'sample',
      severity: 'info',
      title: 'Sample data in use',
      detail: 'These alerts are generated from clearly labelled sample values, not a live reading.',
    })
  if (isStale(data, now))
    alerts.push({
      id: 'stale',
      severity: 'warning',
      title: 'Data may be outdated',
      detail: 'The latest observation is more than 3 hours old. Check an official source before deciding.',
    })
  if (reading.aqi !== null && idx >= 3) {
    alerts.push({
      id: 'band',
      severity: idx >= 4 ? 'critical' : 'warning',
      title: `${label(reading.band)} air quality (AQI ${reading.aqi})`,
      detail: BANDS[idx]?.health ?? '',
    })
  }
  const pm25 = reading.pollutants.pm25
  if (pm25 !== null && pm25 > PM25_STANDARD_24H) {
    alerts.push({
      id: 'pm25',
      severity: pm25 > 120 ? 'critical' : 'warning',
      title: `High PM2.5: ${Math.round(pm25)} µg/m³`,
      detail: `That is ${(pm25 / WHO_PM25_24H).toFixed(1)}× the WHO 24-hour guideline and above the Indian 24-hour standard of ${PM25_STANDARD_24H} µg/m³.`,
    })
  }
  const sensitive = isSensitive(profile)
  const base = guidanceFor(outlookAt(data, data.nowIndex).band, sensitive)
  for (let i = data.nowIndex + 1; i <= Math.min(data.nowIndex + 6, data.hourly.length - 1); i++) {
    const g = guidanceFor(outlookAt(data, i).band, sensitive)
    if (g !== base) {
      alerts.push({
        id: 'change',
        severity: 'info',
        title: `Outdoor guidance changes around ${fmtHour(hourOf(data.times[i] ?? ''))}`,
        detail: `Forecast moves from “${GUIDANCE_LABEL[base]}” to “${GUIDANCE_LABEL[g]}”.`,
      })
      break
    }
  }
  return alerts
}
