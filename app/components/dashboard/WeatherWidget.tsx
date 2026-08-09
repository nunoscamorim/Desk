import type { Weather } from "@/lib/dashboard/types";

function WeatherIcon() { return <span className="weather-icon" aria-hidden="true"><span className="sun" /><span className="cloud" /></span>; }

export function WeatherWidget({ weather }: { weather: Weather }) {
  return <section className="weather" aria-label={`${weather.condition}, ${weather.temperatureC} degrees in ${weather.location}`}><WeatherIcon /><div className="weather-reading"><div className="weather-primary"><strong>{weather.temperatureC}°</strong><span>{weather.condition}</span></div><div className="weather-meta"><span className="weather-location">{weather.location}</span><span>Feels {weather.feelsLikeC}°</span><span className="weather-range"><i>↓</i>{weather.lowC}° <i>↑</i>{weather.highC}°</span></div></div></section>;
}
