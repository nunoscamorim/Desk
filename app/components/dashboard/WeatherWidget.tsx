import type { Weather } from "@/lib/dashboard/types";

export function WeatherWidget({ weather }: { weather: Weather }) {
  return <section className="weather" aria-label={`${weather.condition}, ${weather.temperatureC} degrees in ${weather.location}`}><div className="weather-reading"><div className="weather-primary"><strong>{weather.temperatureC}°</strong><svg className="weather-heroicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" /></svg></div><div className="weather-meta"><span className="weather-location">{weather.location}</span><span>Feels {weather.feelsLikeC}°</span><span className="weather-range"><i>↓</i>{weather.lowC}° <i>↑</i>{weather.highC}°</span></div></div></section>;
}
