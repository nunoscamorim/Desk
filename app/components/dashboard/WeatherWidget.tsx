import type { Weather } from "@/lib/dashboard/types";

export function WeatherWidget({ weather }: { weather: Weather }) {
  return <section className="weather" aria-label={`${weather.condition}, ${weather.temperatureC} degrees in ${weather.location}`}><div className="weather-reading"><div className="weather-primary"><strong>{weather.temperatureC}°</strong><span className="weather-condition">{weather.condition}</span></div><div className="weather-meta"><span className="weather-location">{weather.location}</span><span>Feels {weather.feelsLikeC}°</span><span className="weather-range"><i>↓</i>{weather.lowC}° <i>↑</i>{weather.highC}°</span></div></div></section>;
}
