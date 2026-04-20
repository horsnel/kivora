/* === Weather Widget — Open-Meteo (no API key, no IP ban) === */
(function() {
  'use strict';

  var cities = [
    { name: 'Lagos', lat: 6.52, lon: 3.38, flag: '\uD83C\uDDF3\uD83C\uDDEC' },
    { name: 'London', lat: 51.51, lon: -0.13, flag: '\uD83C\uDDEC\uD83C\uDDE7' },
    { name: 'New York', lat: 40.71, lon: -74.01, flag: '\uD83C\uDDFA\uD83C\uDDF8' },
    { name: 'Tokyo', lat: 35.68, lon: 139.69, flag: '\uD83C\uDDEF\uD83C\uDDF5' },
    { name: 'Dubai', lat: 25.20, lon: 55.27, flag: '\uD83C\uDDE6\uD83C\uDDEA' },
    { name: 'Beijing', lat: 39.90, lon: 116.40, flag: '\uD83C\uDDE8\uD83C\uDDF3' }
  ];

  var weatherCodes = {
    0: 'Clear Sky', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
    45: 'Foggy', 48: 'Rime Fog', 51: 'Light Drizzle', 53: 'Drizzle',
    55: 'Heavy Drizzle', 56: 'Freezing Drizzle', 57: 'Freezing Drizzle',
    61: 'Light Rain', 63: 'Moderate Rain', 65: 'Heavy Rain',
    66: 'Freezing Rain', 67: 'Freezing Rain',
    71: 'Light Snow', 73: 'Moderate Snow', 75: 'Heavy Snow', 77: 'Snow Grains',
    80: 'Light Showers', 81: 'Moderate Showers', 82: 'Violent Showers',
    85: 'Light Snow Showers', 86: 'Heavy Snow Showers',
    95: 'Thunderstorm', 96: 'Thunderstorm + Hail', 99: 'Severe Thunderstorm'
  };

  var weatherIcons = {
    0: '\u2600\uFE0F', 1: '\uD83C\uDF24\uFE0F', 2: '\u26C5', 3: '\u2601\uFE0F',
    45: '\uD83C\uDF2B\uFE0F', 48: '\uD83C\uDF2B\uFE0F', 51: '\uD83C\uDF26\uFE0F',
    53: '\uD83C\uDF26\uFE0F', 55: '\uD83C\uDF27\uFE0F', 56: '\uD83C\uDF28\uFE0F',
    57: '\uD83C\uDF28\uFE0F', 61: '\uD83C\uDF27\uFE0F', 63: '\uD83C\uDF27\uFE0F',
    65: '\uD83C\uDF27\uFE0F', 66: '\uD83C\uDF28\uFE0F', 67: '\uD83C\uDF28\uFE0F',
    71: '\uD83C\uDF28\uFE0F', 73: '\uD83C\uDF28\uFE0F', 75: '\u2744\uFE0F', 77: '\uD83C\uDF28\uFE0F',
    80: '\uD83C\uDF26\uFE0F', 81: '\uD83C\uDF27\uFE0F', 82: '\uD83C\uDF27\uFE0F',
    85: '\uD83C\uDF28\uFE0F', 86: '\u2744\uFE0F',
    95: '\u26C8\uFE0F', 96: '\u26C8\uFE0F', 99: '\u26C8\uFE0F'
  };

  var loaded = 0;
  var total = cities.length;

  function fetchCityWeather(city) {
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + city.lat +
      '&longitude=' + city.lon +
      '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m' +
      '&timezone=auto';

    fetch(url)
      .then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function(data) {
        loaded++;
        updateCityElement(city, data);
        if (loaded >= total) showContent();
      })
      .catch(function() {
        loaded++;
        setCityError(city.name);
        if (loaded >= total) showContent();
      });
  }

  function updateCityElement(city, data) {
    var el = document.querySelector('.weather-city[data-city="' + city.name + '"]');
    if (!el || !data.current) return;

    var temp = Math.round(data.current.temperature_2m);
    var code = data.current.weather_code || 0;
    var humidity = data.current.relative_humidity_2m;
    var wind = Math.round(data.current.wind_speed_10m);

    var tempEl = el.querySelector('.weather-temp');
    var descEl = el.querySelector('.weather-desc');
    var iconEl = el.querySelector('.weather-icon');
    var detailEl = el.querySelector('.weather-detail');

    if (tempEl) tempEl.textContent = temp + '\u00B0C';
    if (descEl) descEl.textContent = weatherCodes[code] || 'Clear';
    if (iconEl) iconEl.textContent = weatherIcons[code] || '\u2600\uFE0F';
    if (detailEl) detailEl.textContent = '\uD83D\uDCA7' + (humidity || '--') + '%  \uD83C\uDF2C\uFE0F' + wind + 'km/h';
  }

  function setCityError(name) {
    var el = document.querySelector('.weather-city[data-city="' + name + '"]');
    if (!el) return;
    var tempEl = el.querySelector('.weather-temp');
    if (tempEl) tempEl.textContent = '--';
  }

  function showContent() {
    var container = document.getElementById('weatherContent');
    var loading = document.querySelector('#weatherWidget .weather-loading');
    if (container) container.style.display = 'block';
    if (loading) loading.style.display = 'none';

    var updated = document.getElementById('weatherUpdated');
    if (updated) {
      var now = new Date();
      updated.textContent = 'Updated ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }

  function fetchAll() {
    loaded = 0;
    var container = document.getElementById('weatherContent');
    var loading = document.querySelector('#weatherWidget .weather-loading');
    if (container) container.style.display = 'none';
    if (loading) {
      loading.style.display = 'block';
      loading.textContent = 'Loading weather data...';
    }
    cities.forEach(function(city) { fetchCityWeather(city); });
  }

  /* Init */
  if (document.getElementById('weatherWidget')) {
    fetchAll();
    setInterval(fetchAll, 600000); /* refresh every 10 min */
  }
})();
