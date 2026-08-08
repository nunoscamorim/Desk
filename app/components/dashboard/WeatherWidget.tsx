import type { Weather } from "@/lib/dashboard/types";

function WeatherIcon() { return <span className="weather-icon" aria-hidden="true"><span className="sun" /><span className="cloud" /></span>; }

export function WeatherWidget({ weather }: { weather: Weather }) {
  return <div className="weather"><WeatherIcon /><div><strong>{weather.temperatureC}°</strong><span>{weather.condition} · {weather.location}</span><small>Feels like {weather.feelsLikeC}° · {weather.lowC}°–{weather.highC}°</small></div></div>;
}
