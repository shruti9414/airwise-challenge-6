const SOURCES = [
  { href: 'https://cpcb.nic.in/National-Air-Quality-Index/', text: 'CPCB – National Air Quality Index (categories, breakpoints, health statements)' },
  { href: 'https://www.who.int/publications/i/item/9789240034228', text: 'WHO global air quality guidelines 2021' },
  { href: 'https://open-meteo.com/en/docs/air-quality-api', text: 'Open-Meteo Air Quality API (CAMS data)' },
  { href: 'https://ai.google.dev/gemini-api/docs', text: 'Google Gemini API (optional AI advice)' },
]

export default function Sources() {
  return (
    <div className="sources panel">
      <h3>Sources</h3>
      <ul className="bullets">
        {SOURCES.map((s) => <li key={s.href}><a href={s.href} target="_blank" rel="noopener noreferrer">{s.text}<span className="sr-only"> (opens in a new tab)</span></a></li>)}
      </ul>
      <h3>Disclaimer</h3>
      <p>AirWise provides general awareness guidance only. It is not medical advice, does not diagnose any condition and cannot guarantee protection from pollution or any change in air quality. Always follow official local advisories, and seek medical attention for symptoms such as breathlessness, chest pain, persistent cough or dizziness. Modelled data can differ from nearby monitors.</p>
    </div>
  )
}
