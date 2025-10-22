import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, AlertTriangle, Car } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TrafficLaneProps {
  laneNumber: number;
  onImageUpload: (laneNumber: number, file: File) => void;
  signalState: "green" | "yellow" | "red";
  vehicleCount: number;
  hasEmergency: boolean;
  congestionLevel: number;
}

export const TrafficLane = ({
  laneNumber,
  onImageUpload,
  signalState,
  vehicleCount,
  hasEmergency,
  congestionLevel,
}: TrafficLaneProps) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageUpload(laneNumber, file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      onImageUpload(laneNumber, file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const getSignalColor = () => {
    switch (signalState) {
      case "green":
        return "bg-signal-green";
      case "yellow":
        return "bg-signal-yellow";
      case "red":
        return "bg-signal-red";
    }
  };

  const getCongestionLabel = () => {
    if (congestionLevel < 30) return "Low";
    if (congestionLevel < 70) return "Medium";
    return "High";
  };

  return (
    <Card className="p-4 space-y-4 bg-card border-border hover:border-primary/50 transition-all">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Lane {laneNumber}</h3>
        <div className="flex items-center gap-2">
          <div className={`w-4 h-4 rounded-full ${getSignalColor()} animate-pulse`} />
          <Badge variant={signalState === "green" ? "default" : signalState === "yellow" ? "secondary" : "destructive"}>
            {signalState.toUpperCase()}
          </Badge>
        </div>
      </div>

      <div
        className={`relative border-2 border-dashed rounded-lg overflow-hidden transition-all ${
          isDragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {preview ? (
          <div className="relative aspect-video">
            <img src={preview} alt={`Lane ${laneNumber}`} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
            {hasEmergency && (
              <div className="absolute top-2 right-2 bg-emergency px-3 py-1 rounded-full flex items-center gap-2 animate-pulse">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-semibold">EMERGENCY</span>
              </div>
            )}
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center aspect-video cursor-pointer hover:bg-muted/50 transition-colors">
            <Upload className="w-8 h-8 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">Upload traffic image</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </label>
        )}
      </div>

      {preview && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2 p-2 bg-secondary rounded">
            <Car className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">Vehicles:</span>
            <span className="font-semibold text-foreground">{vehicleCount}</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-secondary rounded">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-muted-foreground">Congestion:</span>
            <span className="font-semibold text-foreground">{getCongestionLabel()}</span>
          </div>
        </div>
      )}
    </Card>
  );
};
