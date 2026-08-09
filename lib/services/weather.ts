import type { Weather } from "@/lib/dashboard/types";

export interface WeatherService { getCurrentWeather(): Promise<Weather>; }
export class MockWeatherService implements WeatherService {
  async getCurrentWeather(): Promise<Weather> { return { location: "Leça do Balio", temperatureC: 24, feelsLikeC: 25, condition: "Sunny", highC: 27, lowC: 18 }; }
}
