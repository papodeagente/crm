/**
 * LocationModal — Send location via Z-API /send-location
 * Extracted from WhatsAppChat.tsx lines 1121-1154
 */

import { useState } from "react";
import { MapPin } from "lucide-react";
import { toast } from "sonner";

interface LocationModalProps {
  onSend: (lat: number, lng: number, name: string, address: string) => void;
  onClose: () => void;
}

export default function LocationModal({ onSend, onClose }: LocationModalProps) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-2xl border border-border w-[400px] max-w-[90vw] p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-wa-tint" /> Enviar Localização
        </h3>
        <div className="space-y-3">
          <input type="text" placeholder="Nome do local" value={name} onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-wa-tint" />
          <input type="text" placeholder="Endereço" value={address} onChange={e => setAddress(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-wa-tint" />
          <div className="flex gap-2">
            <input type="text" placeholder="Latitude" value={lat} onChange={e => setLat(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-wa-tint" />
            <input type="text" placeholder="Longitude" value={lng} onChange={e => setLng(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-wa-tint" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg hover:bg-muted transition-colors">Cancelar</button>
          <button onClick={() => { if (lat && lng && name) { onSend(parseFloat(lat), parseFloat(lng), name, address); onClose(); } else toast.error("Preencha latitude, longitude e nome"); }}
            className="px-4 py-2 text-sm bg-wa-tint text-white rounded-lg hover:opacity-90 transition-colors">Enviar</button>
        </div>
      </div>
    </div>
  );
}
