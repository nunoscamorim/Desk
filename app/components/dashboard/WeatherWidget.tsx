import type { Weather } from "@/lib/dashboard/types";

function WeatherIcon() { return <span className="weather-icon" aria-hidden="true"><svg viewBox="0 0 32 32"><circle cx="22" cy="10" r="4.5" /><path d="M22 2.5v2M22 15.5v2M14.5 10h2M27.5 10h2M16.7 4.7l1.4 1.4M25.9 13.9l1.4 1.4M27.3 4.7l-1.4 1.4M7 25.5h18a5 5 0 0 0 .2-10 7.5 7.5 0 0 0-14-1.7A6 6 0 0 0 7 25.5Z" /></svg></span>; }

export function WeatherWidget({ weather }: { weather: Weather }) {
  return <section className="weather" aria-label={`${weather.condition}, ${weather.temperatureC} degrees in ${weather.location}`}><div className="weather-reading"><div className="weather-primary"><WeatherIcon /><span className="weather-condition">{weather.condition}</span><strong>{weather.temperatureC}°</strong></div><div className="weather-meta"><span className="weather-location">{weather.location}</span><span>Feels {weather.feelsLikeC}°</span><span className="weather-range"><i>↓</i>{weather.lowC}° <i>↑</i>{weather.highC}°</span></div></div></section>;
}
