import { getTimezoneForUSState } from "./us-timezones"

// Return primary IANA timezone for a (country, region) pair in curated set
export function getTimezoneForRegion(countryName: string, regionName?: string): string | undefined {
  const cn = (countryName || '').trim()
  const rn = (regionName || '').trim()

  // United States: use detailed mapping
  if (cn === 'United States') {
    if (!rn) return undefined
    const tz = getTimezoneForUSState(rn)
    if (tz) return tz
    return undefined
  }

  // Canada: provinces/territories (primary zones)
  if (cn === 'Canada') {
    const q = rn.toLowerCase()
    const map: Record<string, string> = {
      'british columbia': 'America/Vancouver', 'bc': 'America/Vancouver',
      'alberta': 'America/Edmonton', 'ab': 'America/Edmonton',
      'saskatchewan': 'America/Regina', 'sk': 'America/Regina',
      'manitoba': 'America/Winnipeg', 'mb': 'America/Winnipeg',
      'ontario': 'America/Toronto', 'on': 'America/Toronto',
      'quebec': 'America/Toronto', 'qc': 'America/Toronto',
      'new brunswick': 'America/Moncton', 'nb': 'America/Moncton',
      'nova scotia': 'America/Halifax', 'ns': 'America/Halifax',
      'prince edward island': 'America/Halifax', 'pe': 'America/Halifax',
      'newfoundland and labrador': 'America/St_Johns', 'nl': 'America/St_Johns',
      'yukon': 'America/Whitehorse', 'yt': 'America/Whitehorse',
      'northwest territories': 'America/Yellowknife', 'nt': 'America/Yellowknife',
      'nunavut': 'America/Iqaluit', 'nu': 'America/Iqaluit',
    }
    return map[q] || 'America/Toronto'
  }

  // Australia: states and territories
  if (cn === 'Australia') {
    const q = rn.toLowerCase()
    const map: Record<string, string> = {
      'new south wales': 'Australia/Sydney', 'nsw': 'Australia/Sydney',
      'victoria': 'Australia/Melbourne', 'vic': 'Australia/Melbourne',
      'queensland': 'Australia/Brisbane', 'qld': 'Australia/Brisbane',
      'south australia': 'Australia/Adelaide', 'sa': 'Australia/Adelaide',
      'western australia': 'Australia/Perth', 'wa': 'Australia/Perth',
      'tasmania': 'Australia/Hobart', 'tas': 'Australia/Hobart',
      'northern territory': 'Australia/Darwin', 'nt': 'Australia/Darwin',
      'australian capital territory': 'Australia/Sydney', 'act': 'Australia/Sydney',
    }
    return map[q] || 'Australia/Sydney'
  }

  // Single-timezone curated countries
  if (cn === 'United Kingdom') return 'Europe/London'
  if (cn === 'Egypt') return 'Africa/Cairo'
  if (cn === 'Saudi Arabia') return 'Asia/Riyadh'
  if (cn === 'UAE') return 'Asia/Dubai'
  if (cn === 'Germany') return 'Europe/Berlin'
  if (cn === 'France') return 'Europe/Paris'
  if (cn === 'India') return 'Asia/Kolkata'
  if (cn === 'Pakistan') return 'Asia/Karachi'

  return undefined
}
