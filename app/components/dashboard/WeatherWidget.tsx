import type { Weather } from "@/lib/dashboard/types";

function WeatherIcon() { return <span className="weather-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="16.5" cy="6.5" r="3" /><path d="M16.5 1.5v1.3M16.5 10.2v1.3M11.5 6.5h1.3M20.2 6.5h1.3M12.9 2.9l.9.9M19.2 9.2l.9.9M20.1 2.9l-.9.9M5.8 20h11.7a4 4 0 0 0 .3-8 6 6 0 0 0-11.2-1.4A4.8 4.8 0 0 0 5.8 20Z" /></svg></span>; }

export function WeatherWidget({ weather }: { weather: Weather }) {
  return <section className="weather" aria-label={`${weather.condition}, ${weather.temperatureC} degrees in ${weather.location}`}><div className="weather-reading"><div className="weather-primary"><span className="weather-condition">{weather.condition}</span><WeatherIcon /><strong>{weather.temperatureC}°</strong></div><div className="weather-meta"><span className="weather-location">{weather.location}</span><span>Feels {weather.feelsLikeC}°</span><span className="weather-range"><i>↓</i>{weather.lowC}° <i>↑</i>{weather.highC}°</span></div></div></section>;
}
