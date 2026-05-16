import { useState } from 'react';
import { MapPin, Link2 } from 'lucide-react';
import Button from './ui/Button';
import { toast } from './ui/Toast';

interface MapLinkFieldProps {
  token: string;
  /** Appelé avec les coordonnées résolues à partir du lien. */
  onResolved: (latitude: number, longitude: number) => void;
}

/**
 * Champ permettant de coller un lien de localisation (Google Maps, lien
 * raccourci `maps.app.goo.gl`, OpenStreetMap…) pour en extraire automatiquement
 * la latitude et la longitude, sans avoir à les saisir individuellement.
 */
export default function MapLinkField({ token, onResolved }: MapLinkFieldProps) {
  const [link, setLink] = useState('');
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    const value = link.trim();
    if (!value) {
      toast.warning('Collez d\'abord un lien de localisation.');
      return;
    }
    setLoading(true);
    try {
      const r = await window.electron.geo.resolveMapLink(token, value);
      if (r.success && r.data) {
        onResolved(r.data.latitude, r.data.longitude);
        toast.success(
          `Coordonnées importées : ${r.data.latitude.toFixed(6)}, ${r.data.longitude.toFixed(6)}`,
        );
        setLink('');
      } else {
        toast.error(typeof r.error === 'string' ? r.error : 'Lien non résolu.');
      }
    } catch {
      toast.error('Erreur lors de la résolution du lien.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <label className="text-sm font-medium text-slate-700">Importer depuis un lien Google Maps</label>
      <div className="flex gap-2 mt-1">
        <div className="relative flex-1">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleImport();
              }
            }}
            placeholder="https://maps.app.goo.gl/…"
            className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          loading={loading}
          icon={<MapPin className="h-4 w-4" />}
          onClick={handleImport}
        >
          Importer
        </Button>
      </div>
      <p className="text-xs text-slate-500 mt-1">
        Collez un lien Google Maps (même raccourci) ou des coordonnées « latitude, longitude » :
        les champs ci-dessous seront renseignés automatiquement.
      </p>
    </div>
  );
}
