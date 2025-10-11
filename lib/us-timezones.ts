// Lightweight US states to primary IANA timezone mapping
// Note: Some states span multiple timezones; we map to the predominant one.
export type USState = { name: string; code: string; timezone: string }

export const US_STATES: USState[] = [
  { name: 'Alabama', code: 'AL', timezone: 'America/Chicago' },
  { name: 'Alaska', code: 'AK', timezone: 'America/Anchorage' },
  { name: 'Arizona', code: 'AZ', timezone: 'America/Phoenix' }, // No DST
  { name: 'Arkansas', code: 'AR', timezone: 'America/Chicago' },
  { name: 'California', code: 'CA', timezone: 'America/Los_Angeles' },
  { name: 'Colorado', code: 'CO', timezone: 'America/Denver' },
  { name: 'Connecticut', code: 'CT', timezone: 'America/New_York' },
  { name: 'Delaware', code: 'DE', timezone: 'America/New_York' },
  { name: 'District of Columbia', code: 'DC', timezone: 'America/New_York' },
  { name: 'Florida', code: 'FL', timezone: 'America/New_York' }, // Panhandle has Central
  { name: 'Georgia', code: 'GA', timezone: 'America/New_York' },
  { name: 'Hawaii', code: 'HI', timezone: 'Pacific/Honolulu' },
  { name: 'Idaho', code: 'ID', timezone: 'America/Denver' }, // North Idaho has Pacific
  { name: 'Illinois', code: 'IL', timezone: 'America/Chicago' },
  { name: 'Indiana', code: 'IN', timezone: 'America/New_York' }, // Some counties Central
  { name: 'Iowa', code: 'IA', timezone: 'America/Chicago' },
  { name: 'Kansas', code: 'KS', timezone: 'America/Chicago' }, // West KS Mountain
  { name: 'Kentucky', code: 'KY', timezone: 'America/New_York' }, // West KY Central
  { name: 'Louisiana', code: 'LA', timezone: 'America/Chicago' },
  { name: 'Maine', code: 'ME', timezone: 'America/New_York' },
  { name: 'Maryland', code: 'MD', timezone: 'America/New_York' },
  { name: 'Massachusetts', code: 'MA', timezone: 'America/New_York' },
  { name: 'Michigan', code: 'MI', timezone: 'America/New_York' },
  { name: 'Minnesota', code: 'MN', timezone: 'America/Chicago' },
  { name: 'Mississippi', code: 'MS', timezone: 'America/Chicago' },
  { name: 'Missouri', code: 'MO', timezone: 'America/Chicago' },
  { name: 'Montana', code: 'MT', timezone: 'America/Denver' },
  { name: 'Nebraska', code: 'NE', timezone: 'America/Chicago' }, // West NE Mountain
  { name: 'Nevada', code: 'NV', timezone: 'America/Los_Angeles' },
  { name: 'New Hampshire', code: 'NH', timezone: 'America/New_York' },
  { name: 'New Jersey', code: 'NJ', timezone: 'America/New_York' },
  { name: 'New Mexico', code: 'NM', timezone: 'America/Denver' },
  { name: 'New York', code: 'NY', timezone: 'America/New_York' },
  { name: 'North Carolina', code: 'NC', timezone: 'America/New_York' },
  { name: 'North Dakota', code: 'ND', timezone: 'America/Chicago' }, // West ND Mountain
  { name: 'Ohio', code: 'OH', timezone: 'America/New_York' },
  { name: 'Oklahoma', code: 'OK', timezone: 'America/Chicago' },
  { name: 'Oregon', code: 'OR', timezone: 'America/Los_Angeles' }, // East OR Mountain
  { name: 'Pennsylvania', code: 'PA', timezone: 'America/New_York' },
  { name: 'Rhode Island', code: 'RI', timezone: 'America/New_York' },
  { name: 'South Carolina', code: 'SC', timezone: 'America/New_York' },
  { name: 'South Dakota', code: 'SD', timezone: 'America/Chicago' }, // West SD Mountain
  { name: 'Tennessee', code: 'TN', timezone: 'America/Chicago' }, // East TN Eastern
  { name: 'Texas', code: 'TX', timezone: 'America/Chicago' }, // West TX Mountain
  { name: 'Utah', code: 'UT', timezone: 'America/Denver' },
  { name: 'Vermont', code: 'VT', timezone: 'America/New_York' },
  { name: 'Virginia', code: 'VA', timezone: 'America/New_York' },
  { name: 'Washington', code: 'WA', timezone: 'America/Los_Angeles' },
  { name: 'West Virginia', code: 'WV', timezone: 'America/New_York' },
  { name: 'Wisconsin', code: 'WI', timezone: 'America/Chicago' },
  { name: 'Wyoming', code: 'WY', timezone: 'America/Denver' },
]

export const getTimezoneForUSState = (stateNameOrCode: string): string | undefined => {
  if (!stateNameOrCode) return undefined
  const q = stateNameOrCode.trim().toLowerCase()
  const found = US_STATES.find(s => 
    s.code.toLowerCase() === q || 
    s.name.toLowerCase() === q ||
    s.name.toLowerCase().replace(/\s+/g, '') === q.replace(/\s+/g, '')
  )
  return found?.timezone
}
