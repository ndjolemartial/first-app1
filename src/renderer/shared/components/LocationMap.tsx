import { MapPin, Globe, ExternalLink } from 'lucide-react';
import Card from './ui/Card';

interface LocationMapProps {
  latitude?: number | null;
  longitude?: number | null;
  /** Texte descriptif affiché sous la carte (adresse, référence…). */
  label?: string;
  /** Titre de la carte. */
  title?: string;
}

const linkClass =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50';

/**
 * Affiche une carte de localisation interactive (OpenStreetMap) et des liens
 * vers Google Maps et Google Earth lorsque des coordonnées GPS sont disponibles.
 */
export default function LocationMap({ latitude, longitude, label, title = 'Localisation' }: LocationMapProps) {
  const hasCoords =
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  return (
    <Card>
      <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
        <MapPin className="h-4 w-4 text-slate-500" /> {title}
      </h3>
      {hasCoords ? (
        <LocationMapContent latitude={latitude as number} longitude={longitude as number} label={label} />
      ) : (
        <p className="text-sm text-slate-400">
          Coordonnées GPS non renseignées. Renseignez la latitude et la longitude dans le formulaire
          pour afficher la carte.
        </p>
      )}
    </Card>
  );
}

function LocationMapContent({ latitude, longitude, label }: { latitude: number; longitude: number; label?: string }) {
  const delta = 0.004;
  const bbox = `${longitude - delta},${latitude - delta},${longitude + delta},${latitude + delta}`;
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`;
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  const googleEarthUrl = `https://earth.google.com/web/@${latitude},${longitude},150a,1000d,35y,0h,0t,0r`;
  const osmUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <iframe
          title="Carte de localisation"
          src={embedUrl}
          className="w-full"
          style={{ height: 280, border: 0 }}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </div>

      <p className="text-xs text-slate-500">
        {label && <span className="text-slate-600">{label} — </span>}
        Coordonnées :{' '}
        <span className="font-medium text-slate-700">
          {latitude.toFixed(6)}, {longitude.toFixed(6)}
        </span>
      </p>

      <div className="flex flex-wrap gap-2">
        <a className={linkClass} href={googleMapsUrl} target="_blank" rel="noreferrer">
          <MapPin className="h-3.5 w-3.5 text-blue-600" /> Google Maps
          <ExternalLink className="h-3 w-3 text-slate-400" />
        </a>
        <a className={linkClass} href={googleEarthUrl} target="_blank" rel="noreferrer">
          <Globe className="h-3.5 w-3.5 text-emerald-600" /> Google Earth
          <ExternalLink className="h-3 w-3 text-slate-400" />
        </a>
        <a className={linkClass} href={osmUrl} target="_blank" rel="noreferrer">
          <MapPin className="h-3.5 w-3.5 text-amber-600" /> OpenStreetMap
          <ExternalLink className="h-3 w-3 text-slate-400" />
        </a>
      </div>
    </div>
  );
}
