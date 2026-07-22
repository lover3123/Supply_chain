import type { Rider, TrafficState, WeatherData, DarkStore } from '../store/useStore';

export const DARK_STORE_LOCATIONS: DarkStore[] = [
  { id: 'DS001', name: 'Koramangala Hub', lat: 12.9352, lng: 77.6245, radius: 3000, activeRiders: 12 },
  { id: 'DS002', name: 'Indiranagar Hub', lat: 12.9716, lng: 77.6412, radius: 2500, activeRiders: 9 },
  { id: 'DS003', name: 'HSR Layout Hub', lat: 12.9081, lng: 77.6476, radius: 3500, activeRiders: 14 },
  { id: 'DS004', name: 'Whitefield Hub', lat: 12.9698, lng: 77.7499, radius: 4000, activeRiders: 11 },
  { id: 'DS005', name: 'BTM Layout Hub', lat: 12.9165, lng: 77.6101, radius: 3000, activeRiders: 10 },
  { id: 'DS006', name: 'Jayanagar Hub', lat: 12.9250, lng: 77.5938, radius: 2800, activeRiders: 8 },
];

export const TRAFFIC_ZONES = [
  { id: 'TZ001', name: 'Silk Board Junction', lat: 12.9176, lng: 77.6244, severity: 'high' },
  { id: 'TZ002', name: 'ORR Bellandur', lat: 12.9352, lng: 77.6168, severity: 'high' },
  { id: 'TZ003', name: 'Marathahalli Bridge', lat: 12.9591, lng: 77.6977, severity: 'medium' },
  { id: 'TZ004', name: 'Hebbal Flyover', lat: 13.0350, lng: 77.5970, severity: 'medium' },
  { id: 'TZ005', name: 'MG Road Traffic', lat: 12.9716, lng: 77.5946, severity: 'low' },
];

export const FLEET_TYPES = {
  bike: { icon: '🛵', type: 'Two-Wheeler' },
  van: { icon: '🚚', type: 'Van' },
  car: { icon: '🚗', type: 'Four-Wheeler' },
};

export const MOCK_RIDERS: Rider[] = [
  {
    id: 'R001',
    name: 'Arjun',
    status: 'available',
    currentLocation: { lat: 12.9280, lng: 77.6200, name: 'Koramangala' },
    vehicleType: 'bike',
    rating: 4.8,
    deliveriesToday: 18,
  },
  {
    id: 'R002',
    name: 'Sneha',
    status: 'busy',
    currentLocation: { lat: 12.9600, lng: 77.6400, name: 'Indiranagar' },
    vehicleType: 'van',
    rating: 4.7,
    deliveriesToday: 15,
  },
  {
    id: 'R003',
    name: 'Vikram',
    status: 'available',
    currentLocation: { lat: 12.9750, lng: 77.7050, name: 'Whitefield' },
    vehicleType: 'bike',
    rating: 4.9,
    deliveriesToday: 22,
  },
  {
    id: 'R004',
    name: 'Riya',
    status: 'busy',
    currentLocation: { lat: 12.9400, lng: 77.6100, name: 'BTM Layout' },
    vehicleType: 'car',
    rating: 4.6,
    deliveriesToday: 16,
  },
];

export const MOCK_TRAFFIC_STATES = [
  { zoneId: 'TZ001', congestionLevel: 0.92, avgSpeed: 9, incident: 'Major congestion' },
  { zoneId: 'TZ002', congestionLevel: 0.88, avgSpeed: 11, incident: 'Roadworks' },
  { zoneId: 'TZ003', congestionLevel: 0.62, avgSpeed: 18 },
  { zoneId: 'TZ004', congestionLevel: 0.55, avgSpeed: 22 },
  { zoneId: 'TZ005', congestionLevel: 0.32, avgSpeed: 34 },
];

export const MOCK_WEATHER: WeatherData = {
  temperature: 29,
  humidity: 72,
  rainfall: 2.4,
  windSpeed: 14,
  alertLevel: 'normal',
};
