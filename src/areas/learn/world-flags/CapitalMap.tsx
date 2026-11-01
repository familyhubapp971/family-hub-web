import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { MapPin } from 'lucide-react';
// Bundle Leaflet's marker images through Vite so they're served from our own
// origin ('self'). The library's default icons resolve via bundler-relative
// paths that break under Vite, and a CDN URL would need a CSP allowance: local
// assets sidestep both and keep the pin reliable offline.
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { CAPITAL_COORDINATES, type Country } from './countries';

// Mini interactive map pinned on a country's capital (OpenStreetMap tiles via
// Leaflet). Falls back to a text-only capital label when we don't have
// coordinates for the country. The map is pan/zoom-locked: it's a static
// "here's where it is" visual for kids, not a full map.

const markerIcon = L.icon({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export function CapitalMap({ country }: { country: Country }) {
  const coords = CAPITAL_COORDINATES[country.code];

  if (!coords) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center text-center">
        <MapPin className="mb-0.5 h-4 w-4 text-blue-500" aria-hidden="true" />
        <p className="text-[8px] font-bold uppercase tracking-wider text-blue-400">Capital</p>
        <p className="text-lg font-black leading-tight text-gray-900">{country.capital}</p>
      </div>
    );
  }

  return (
    <MapContainer
      center={coords}
      zoom={4}
      scrollWheelZoom={false}
      dragging={false}
      zoomControl={false}
      attributionControl={false}
      doubleClickZoom={false}
      style={{ width: '100%', height: '100%' }}
      aria-label={`Map showing ${country.capital}, the capital of ${country.name}`}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={coords} icon={markerIcon}>
        <Popup>{country.capital}</Popup>
      </Marker>
    </MapContainer>
  );
}
