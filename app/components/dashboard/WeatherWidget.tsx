import type { Weather } from "@/lib/dashboard/types";

function WeatherIcon() { return <span className="weather-icon" aria-hidden="true"><svg viewBox="0 0 48 48"><g className="weather-sun"><path d="M31 4v4M31 26v4M20 17h-4M46 17h-4M23.2 9.2l-2.8-2.8M41.6 27.6l-2.8-2.8M38.8 9.2l2.8-2.8" /><circle cx="31" cy="17" r="7.5" /></g><path className="weather-cloud-shadow" d="M12 39h25a7 7 0 0 0 .4-14A11 11 0 0 0 17 22a8.5 8.5 0 0 0-5 17Z" /><path className="weather-cloud" d="M11 37h25a7 7 0 0 0 .4-14A11 11 0 0 0 16 20a8.5 8.5 0 0 0-5 17Z" /></svg></span>; }

export function WeatherWidget({ weather }: { weather: Weather }) {
  return <section className="weather" aria-label={`${weather.condition}, ${weather.temperatureC} degrees in ${weather.location}`}><WeatherIcon /><div className="weather-reading"><div className="weather-primary"><span>{weather.condition}</span><strong>{weather.temperatureC}°</strong></div><div className="weather-meta"><span className="weather-location">{weather.location}</span><span>Feels {weather.feelsLikeC}°</span><span className="weather-range"><i>↓</i>{weather.lowC}° <i>↑</i>{weather.highC}°</span></div></div></section>;
}
