import { useState, useEffect } from "react";
import { TrafficLane } from "@/components/TrafficLane";
import { OptimizationPanel } from "@/components/OptimizationPanel";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Play, RotateCcw, Activity } from "lucide-react";
import { analyzeTrafficImage, GeneticAlgorithm } from "@/utils/trafficAnalysis";

interface LaneData {
  image: File | null;
  vehicleCount: number;
  hasEmergency: boolean;
  congestionLevel: number;
  signalState: "green" | "yellow" | "red";
}

const Index = () => {
  const [lanes, setLanes] = useState<LaneData[]>(
    Array.from({ length: 4 }, () => ({
      image: null,
      vehicleCount: 0,
      hasEmergency: false,
      congestionLevel: 0,
      signalState: "red" as const,
    }))
  );

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [fitnessScore, setFitnessScore] = useState(0);
  const [avgWaitTime, setAvgWaitTime] = useState(0);
  const [throughput, setThroughput] = useState(0);
  const [ga] = useState(() => new GeneticAlgorithm());

  const handleImageUpload = async (laneNumber: number, file: File) => {
    setIsAnalyzing(true);
    toast.info(`Analyzing Lane ${laneNumber} with YOLO...`);

    try {
      const analysis = await analyzeTrafficImage(file);
      
      setLanes(prev => {
        const updated = [...prev];
        updated[laneNumber - 1] = {
          ...updated[laneNumber - 1],
          image: file,
          ...analysis,
        };
        return updated;
      });

      toast.success(`Lane ${laneNumber} analyzed: ${analysis.vehicleCount} vehicles detected`);
      
      if (analysis.hasEmergency) {
        toast.error(`Emergency vehicle detected in Lane ${laneNumber}!`, {
          description: "This lane will receive priority in signal timing",
        });
      }
    } catch (error) {
      toast.error("Failed to analyze image");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startOptimization = () => {
    const uploadedLanes = lanes.filter(lane => lane.image !== null);
    
    if (uploadedLanes.length === 0) {
      toast.error("Please upload at least one lane image");
      return;
    }

    setIsOptimizing(true);
    setGeneration(0);
    toast.success("Starting genetic algorithm optimization...");
    
    ga.initialize(4);
    runGeneticAlgorithm();
  };

  const runGeneticAlgorithm = () => {
    const congestionLevels = lanes.map(lane => lane.congestionLevel);
    const emergencyFlags = lanes.map(lane => lane.hasEmergency);

    let currentGen = 0;
    const maxGenerations = 10;

    const interval = setInterval(() => {
      const best = ga.evolve(congestionLevels, emergencyFlags);
      currentGen++;
      
      setGeneration(currentGen);
      setFitnessScore(best.fitness);
      setAvgWaitTime(45 - (currentGen * 2)); // Simulated improvement
      setThroughput(prev => prev + Math.floor(Math.random() * 10) + 5);

      // Update signal states based on optimization
      const newSignals = best.greenTimes.map((time, idx) => {
        if (lanes[idx].hasEmergency) return "green";
        if (time > 50) return "green";
        if (time > 30) return "yellow";
        return "red";
      });

      setLanes(prev => prev.map((lane, idx) => ({
        ...lane,
        signalState: newSignals[idx] as "green" | "yellow" | "red",
      })));

      if (currentGen >= maxGenerations) {
        clearInterval(interval);
        setIsOptimizing(false);
        toast.success("Optimization complete!", {
          description: `Best fitness: ${best.fitness.toFixed(2)}`,
        });
      }
    }, 800);
  };

  const reset = () => {
    setLanes(Array.from({ length: 4 }, () => ({
      image: null,
      vehicleCount: 0,
      hasEmergency: false,
      congestionLevel: 0,
      signalState: "red" as const,
    })));
    setGeneration(0);
    setFitnessScore(0);
    setAvgWaitTime(0);
    setThroughput(0);
    setIsOptimizing(false);
    toast.info("System reset");
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">
              AI Traffic Management System
            </h1>
            <p className="text-muted-foreground">
              YOLO-based vehicle detection with genetic algorithm optimization
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={startOptimization}
              disabled={isOptimizing || isAnalyzing}
              size="lg"
              className="gap-2"
            >
              <Play className="w-5 h-5" />
              {isOptimizing ? "Optimizing..." : "Start Analysis"}
            </Button>
            <Button onClick={reset} variant="outline" size="lg" className="gap-2">
              <RotateCcw className="w-5 h-5" />
              Reset
            </Button>
          </div>
        </div>

        {/* Traffic Lanes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {lanes.map((lane, index) => (
            <TrafficLane
              key={index}
              laneNumber={index + 1}
              onImageUpload={handleImageUpload}
              signalState={lane.signalState}
              vehicleCount={lane.vehicleCount}
              hasEmergency={lane.hasEmergency}
              congestionLevel={lane.congestionLevel}
            />
          ))}
        </div>

        {/* Optimization Panel */}
        <OptimizationPanel
          isOptimizing={isOptimizing}
          generation={generation}
          fitnessScore={fitnessScore}
          avgWaitTime={avgWaitTime}
          throughput={throughput}
        />

        {/* Footer Info */}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-4">
          <Activity className="w-4 h-4" />
          <span>Real-time AI-powered traffic optimization using YOLO and Genetic Algorithms</span>
        </div>
      </div>
    </div>
  );
};

export default Index;
