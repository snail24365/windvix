import axios from "axios";

// to security, this api key should be moved to server side and encypted but since it's demo I will skip that
const API_KEY = "9651bd8045fafa115a139f7a3a375db5";
export async function loadSeoulWeather() {
  const exclude = "daily,minutely,hourly,alerts";
  const seoulLon = 126.9779692;
  const seoulLat = 37.566535;
  let url = `https://api.openweathermap.org/data/2.5/weather?lat=${seoulLat}&lon=${seoulLon}&exclude=${exclude}&appid=${API_KEY}`;

  const response = await axios.get(url);
  const data = response.data;
  const weatherData = data.weather[0];
  console.log(data);
  if (weatherData) {
    const weatherTitle = weatherData.main;
    const iconUrl = `https://openweathermap.org/img/wn/${weatherData.icon}@2x.png`;
    document.querySelector(".state-display .weather .title").innerHTML =
      weatherTitle;
    document.querySelector(".state-display .weather .icon").src = iconUrl;
  }

  const { humidity, pressure, temp } = data.main;

  document.querySelector(".state-display .temperature .value").innerHTML = `${(
    temp - 273.15
  ).toFixed(1)}°C`;
  document.querySelector(".state-display .air-pressure .value").innerHTML = `${
    pressure / 1000
  }Hg`;
  document.querySelector(
    ".state-display .humid .value"
  ).innerHTML = `${humidity}%`;

  document.querySelector(".state-display").style.opacity = 1;

  return data;
}
