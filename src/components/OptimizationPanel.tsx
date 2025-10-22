import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Activity, Zap, Clock } from "lucide-react";

interface OptimizationPanelProps {
  isOptimizing: boolean;
  generation: number;
  fitnessScore: number;
  avgWaitTime: number;
  throughput: number;
}

export const OptimizationPanel = ({
  isOptimizing,
  generation,
  fitnessScore,
  avgWaitTime,
  throughput,
}: OptimizationPanelProps) => {
  return (
    <Card className="p-6 space-y-6 bg-card border-border">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Genetic Algorithm Optimization</h2>
        <Badge variant={isOptimizing ? "default" : "secondary"} className="flex items-center gap-2">
          <Activity className={`w-4 h-4 ${isOptimizing ? "animate-pulse" : ""}`} />
          {isOptimizing ? "Optimizing..." : "Ready"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2 p-4 bg-secondary rounded-lg">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Zap className="w-4 h-4" />
            <span className="text-sm">Generation</span>
          </div>
          <p className="text-3xl font-bold text-primary">{generation}</p>
        </div>

        <div className="space-y-2 p-4 bg-secondary rounded-lg">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Activity className="w-4 h-4" />
            <span className="text-sm">Fitness Score</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{fitnessScore.toFixed(2)}</p>
        </div>

        <div className="space-y-2 p-4 bg-secondary rounded-lg">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Avg Wait Time</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{avgWaitTime.toFixed(1)}s</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Optimization Progress</span>
          <span className="text-foreground font-semibold">{Math.min(generation * 10, 100)}%</span>
        </div>
        <Progress value={Math.min(generation * 10, 100)} className="h-2" />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Traffic Throughput</h3>
        <div className="flex items-end gap-1 h-20">
          {Array.from({ length: 12 }).map((_, i) => {
            const height = Math.random() * 60 + 20;
            return (
              <div
                key={i}
                className="flex-1 bg-primary/20 rounded-t transition-all hover:bg-primary/40"
                style={{ height: `${height}%` }}
              />
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Total Vehicles Processed</p>
          <p className="text-2xl font-bold text-foreground">{throughput}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">System Efficiency</p>
          <p className="text-2xl font-bold text-primary">{Math.min(fitnessScore * 10, 99).toFixed(0)}%</p>
        </div>
      </div>
    </Card>
  );
};
