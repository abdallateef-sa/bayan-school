// Utility functions for geographic data (countries, states)
// This file provides client-side helpers to fetch country states from backend when available
// and falls back to a lightweight static JSON shipped with the app for reliability.

export type CountryOption = { value: string; label: string }
export type StateOption = { name: string; code?: string }

// Fetch states for a given country using local fallbacks
// API endpoint not available, using static data
export async function fetchCountryStates(countryName: string): Promise<StateOption[]> {
  // Use local fallbacks directly - API endpoint not available
  // Fallbacks for curated countries
  if (countryName === 'United States') {
    try {
      // Use local static file to avoid third-party dependency and rate limits
      const res = await fetch('/data/us-states.json', { cache: 'force-cache' })
      if (res.ok) {
        const states: Array<{ name: string; code: string }> = await res.json()
        return states
      }
    } catch (_) {
      // ignore
    }
  }

  if (countryName === 'Canada') {
    return [
      { name: 'Alberta', code: 'AB' }, { name: 'British Columbia', code: 'BC' }, { name: 'Manitoba', code: 'MB' },
      { name: 'New Brunswick', code: 'NB' }, { name: 'Newfoundland and Labrador', code: 'NL' }, { name: 'Northwest Territories', code: 'NT' },
      { name: 'Nova Scotia', code: 'NS' }, { name: 'Nunavut', code: 'NU' }, { name: 'Ontario', code: 'ON' },
      { name: 'Prince Edward Island', code: 'PE' }, { name: 'Quebec', code: 'QC' }, { name: 'Saskatchewan', code: 'SK' },
      { name: 'Yukon', code: 'YT' }
    ]
  }

  if (countryName === 'Australia') {
    return [
      { name: 'New South Wales', code: 'NSW' }, { name: 'Victoria', code: 'VIC' }, { name: 'Queensland', code: 'QLD' },
      { name: 'South Australia', code: 'SA' }, { name: 'Western Australia', code: 'WA' }, { name: 'Tasmania', code: 'TAS' },
      { name: 'Northern Territory', code: 'NT' }, { name: 'Australian Capital Territory', code: 'ACT' }
    ]
  }

  if (countryName === 'United Kingdom') {
    return [ { name: 'England' }, { name: 'Scotland' }, { name: 'Wales' }, { name: 'Northern Ireland' } ]
  }

  if (countryName === 'UAE') {
    return [ { name: 'Abu Dhabi' }, { name: 'Dubai' }, { name: 'Sharjah' }, { name: 'Ajman' }, { name: 'Umm Al Quwain' }, { name: 'Ras Al Khaimah' }, { name: 'Fujairah' } ]
  }

  if (countryName === 'Saudi Arabia') {
    return [ { name: 'Riyadh' }, { name: 'Makkah' }, { name: 'Madinah' }, { name: 'Eastern Province' }, { name: 'Asir' }, { name: 'Jazan' }, { name: 'Tabuk' }, { name: 'Hail' }, { name: 'Najran' }, { name: 'Al-Bahah' }, { name: 'Al-Jawf' }, { name: 'Northern Borders' } ]
  }

  if (countryName === 'Egypt') {
    return [ { name: 'Cairo' }, { name: 'Giza' }, { name: 'Alexandria' }, { name: 'Dakahlia' }, { name: 'Sharqia' }, { name: 'Qalyubia' }, { name: 'Gharbia' }, { name: 'Monufia' }, { name: 'Kafr El Sheikh' }, { name: 'Beheira' }, { name: 'Ismailia' }, { name: 'Suez' }, { name: 'Port Said' }, { name: 'Damietta' } ]
  }

  if (countryName === 'Germany') {
    return [ { name: 'Bavaria' }, { name: 'Berlin' }, { name: 'Hamburg' }, { name: 'Hesse' }, { name: 'Lower Saxony' }, { name: 'North Rhine-Westphalia' }, { name: 'Saxony' }, { name: 'Baden-Württemberg' } ]
  }

  if (countryName === 'France') {
    return [ { name: 'Île-de-France' }, { name: 'Provence-Alpes-Côte d’Azur' }, { name: 'Auvergne-Rhône-Alpes' }, { name: 'Occitanie' }, { name: 'Nouvelle-Aquitaine' }, { name: 'Grand Est' }, { name: 'Hauts-de-France' } ]
  }

  if (countryName === 'India') {
    return [ { name: 'Maharashtra' }, { name: 'Delhi' }, { name: 'Karnataka' }, { name: 'Tamil Nadu' }, { name: 'West Bengal' }, { name: 'Uttar Pradesh' }, { name: 'Gujarat' }, { name: 'Telangana' } ]
  }

  if (countryName === 'Pakistan') {
    return [ { name: 'Punjab' }, { name: 'Sindh' }, { name: 'Khyber Pakhtunkhwa' }, { name: 'Balochistan' }, { name: 'Gilgit-Baltistan' }, { name: 'Azad Kashmir' }, { name: 'Islamabad Capital Territory' } ]
  }

  return []
}

// Create a curated country list from a larger list, preserving a preferred order
export function curateCountries(all: Array<{ name: string; emoji?: string }>): CountryOption[] {
  // Country code to flag emoji converter
  const flagFor = (code: string) => code.replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
  
  const preferredCountries = [
    { name: 'United States', code: 'US' },
    { name: 'United Kingdom', code: 'GB' },
    { name: 'Canada', code: 'CA' },
    { name: 'Egypt', code: 'EG' },
    { name: 'Saudi Arabia', code: 'SA' },
    { name: 'UAE', code: 'AE' },
    { name: 'Germany', code: 'DE' },
    { name: 'France', code: 'FR' },
    { name: 'India', code: 'IN' },
    { name: 'Pakistan', code: 'PK' },
    { name: 'Australia', code: 'AU' },
  ]

  // If all array is provided and not empty, use it to filter
  const preferredSet = new Set(preferredCountries.map(c => c.name))
  
  let mapped: CountryOption[]
  if (all && all.length > 0) {
    // Filter from provided array
    mapped = all
      .filter((c) => preferredSet.has(c.name))
      .sort((a, b) => {
        const aIndex = preferredCountries.findIndex(p => p.name === a.name)
        const bIndex = preferredCountries.findIndex(p => p.name === b.name)
        return aIndex - bIndex
      })
      .map((country) => ({ value: country.name, label: `${country.emoji || '🌍'} ${country.name}` }))
  } else {
    // Use static list with flag emojis
    mapped = preferredCountries.map(country => ({
      value: country.name,
      label: `${flagFor(country.code)} ${country.name}`
    }))
  }

  const options: CountryOption[] = [
    { value: '', label: 'Select your country' },
    ...mapped,
    { value: 'other', label: '🌍 Other' },
  ]
  return options
}
