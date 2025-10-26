import { useState, useEffect } from "react";
import { TrafficLane } from "@/components/TrafficLane";
import { OptimizationPanel } from "@/components/OptimizationPanel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Play, RotateCcw, Activity, ArrowRight } from "lucide-react";
import { analyzeTrafficImage, GeneticAlgorithm } from "@/utils/trafficAnalysis";

interface LaneData {
  image: File | null;
  vehicleCount: number;
  hasEmergency: boolean;
  congestionLevel: number;
  signalState: "green" | "yellow" | "red";
  waitingTime: number;
  greenDuration: number;
}

const Index = () => {
  const [laneCount, setLaneCount] = useState<number | null>(null);
  const [lanes, setLanes] = useState<LaneData[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [avgWaitTime, setAvgWaitTime] = useState(0);
  const [throughput, setThroughput] = useState(0);
  const [currentGreenLane, setCurrentGreenLane] = useState(0);
  const [ga] = useState(() => new GeneticAlgorithm());

  const initializeLanes = (count: number) => {
    setLaneCount(count);
    setLanes(
      Array.from({ length: count }, () => ({
        image: null,
        vehicleCount: 0,
        hasEmergency: false,
        congestionLevel: 0,
        signalState: "red" as const,
        waitingTime: 0,
        greenDuration: 0,
      }))
    );
  };

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
          waitingTime: 0,
          greenDuration: 0,
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
    const maxGenerations = 100; // More generations for better optimization
    let cycleIndex = 0;

    const runCycle = () => {
      // Check if all lanes have 0 vehicles - stop optimization
      const totalVehicles = lanes.reduce((sum, lane) => sum + lane.vehicleCount, 0);
      if (totalVehicles === 0) {
        setIsOptimizing(false);
        toast.success("All lanes cleared!", {
          description: "Traffic optimization complete - no vehicles remaining",
        });
        return;
      }

      const best = ga.evolve(congestionLevels, emergencyFlags);
      currentGen++;
      
      setGeneration(currentGen);

      // Determine lane priority order (emergency first, then by congestion)
      const laneOrder = lanes
        .map((lane, idx) => ({ 
          idx, 
          priority: lane.hasEmergency ? 1000 : lane.congestionLevel, 
          vehicleCount: lane.vehicleCount,
          // Optimized green time: 1.5 seconds per vehicle
          greenTime: Math.max(5, Math.ceil(lane.vehicleCount * 1.5)) // Minimum 5s for signal change
        }))
        .sort((a, b) => b.priority - a.priority);

      const currentLaneIdx = laneOrder[cycleIndex % laneOrder.length].idx;
      const nextLaneIdx = laneOrder[(cycleIndex + 1) % laneOrder.length].idx;
      const currentGreenTime = laneOrder[cycleIndex % laneOrder.length].greenTime;

      // Calculate waiting times based on sum of green durations before each lane
      const newWaitTimes = lanes.map((_, idx) => {
        if (idx === currentLaneIdx) return 0;
        
        const lanePosition = laneOrder.findIndex(item => item.idx === idx);
        const currentPosition = cycleIndex % laneOrder.length;
        
        let waitTime = 0;
        let pos = currentPosition;
        
        // Sum up green times of all lanes that will go before this one
        while (pos !== lanePosition) {
          waitTime += laneOrder[pos % laneOrder.length].greenTime;
          pos = (pos + 1) % laneOrder.length;
        }
        
        return waitTime;
      });

      // Set initial green durations and waiting times
      setLanes(prev => prev.map((lane, idx) => ({
        ...lane,
        waitingTime: newWaitTimes[idx],
        greenDuration: laneOrder.find(item => item.idx === idx)?.greenTime || 0,
      })));

      setCurrentGreenLane(currentLaneIdx + 1);

      const totalWait = newWaitTimes.reduce((sum, time) => sum + time, 0);
      setAvgWaitTime(Math.round(totalWait / lanes.length));
      
      // More realistic throughput calculation based on actual vehicles moved
      const vehiclesMoved = Math.floor(currentGreenTime / 1.5); // 1 vehicle per 1.5 seconds
      setThroughput(prev => prev + Math.min(vehiclesMoved, lanes[currentLaneIdx].vehicleCount));

      // Countdown mechanism for green light lane only
      let remainingTime = currentGreenTime;
      const initialVehicleCount = lanes[currentLaneIdx].vehicleCount;
      const initialCongestion = lanes[currentLaneIdx].congestionLevel;
      
      const countdownInterval = setInterval(() => {
        remainingTime--;
        
        // Update ONLY the current green lane's duration, vehicle count, and congestion
        setLanes(prev => prev.map((lane, idx) => {
          if (idx === currentLaneIdx && lane.signalState === "green") {
            // Vehicle movement: 1 vehicle every 1.5 seconds
            const elapsedTime = currentGreenTime - remainingTime;
            const vehiclesMoved = Math.floor(elapsedTime / 1.5);
            const vehiclesRemaining = Math.max(0, initialVehicleCount - vehiclesMoved);
            
            // Accurate congestion calculation based on remaining vehicles
            let newCongestion = 0;
            if (initialVehicleCount > 0 && vehiclesRemaining > 0) {
              const remainingRatio = vehiclesRemaining / initialVehicleCount;
              newCongestion = Math.round(remainingRatio * initialCongestion);
            }
            
            return { 
              ...lane, 
              greenDuration: remainingTime,
              vehicleCount: vehiclesRemaining,
              congestionLevel: newCongestion
            };
          } else if (lane.waitingTime > 0) {
            // Other lanes only reduce waiting time, no vehicle movement
            return { ...lane, waitingTime: lane.waitingTime - 1 };
          }
          return lane;
        }));

        setAvgWaitTime(prev => Math.max(0, prev - 1));
        
        // When countdown reaches 0, change signal lights
        if (remainingTime <= 0) {
          clearInterval(countdownInterval);
          
          // Update signal states: one green, one yellow (next priority), rest red
          const newSignals = lanes.map((_, idx) => {
            if (idx === laneOrder[(cycleIndex + 1) % laneOrder.length].idx) return "green";
            if (idx === laneOrder[(cycleIndex + 2) % laneOrder.length].idx) return "yellow";
            return "red";
          });

          setLanes(prev => prev.map((lane, idx) => ({
            ...lane,
            signalState: newSignals[idx] as "green" | "yellow" | "red",
          })));
        }
      }, 1000);

      // Update initial signal states for current cycle
      const initialSignals = lanes.map((_, idx) => {
        if (idx === currentLaneIdx) return "green";
        if (idx === nextLaneIdx) return "yellow";
        return "red";
      });

      setLanes(prev => prev.map((lane, idx) => ({
        ...lane,
        signalState: initialSignals[idx] as "green" | "yellow" | "red",
      })));

      cycleIndex++;

      if (currentGen >= maxGenerations) {
        setTimeout(() => {
          setIsOptimizing(false);
          toast.success("Optimization complete!", {
            description: `Average wait time optimized`,
          });
        }, currentGreenTime * 1000);
      } else {
        // Next cycle runs after current lane's green duration completes
        setTimeout(runCycle, currentGreenTime * 1000);
      }
    };

    runCycle();
  };

  const reset = () => {
    setLaneCount(null);
    setLanes([]);
    setGeneration(0);
    setAvgWaitTime(0);
    setThroughput(0);
    setCurrentGreenLane(0);
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
          {laneCount !== null && (
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
          )}
        </div>

        {/* Lane Selection */}
        {laneCount === null ? (
          <Card className="p-8">
            <div className="text-center space-y-6">
              <div>
                <h2 className="text-2xl font-semibold mb-2">Select Number of Traffic Lanes</h2>
                <p className="text-muted-foreground">Choose between 2 to 4 lanes for traffic monitoring</p>
              </div>
              <div className="flex justify-center gap-4">
                {[2, 3, 4].map((count) => (
                  <Button
                    key={count}
                    onClick={() => initializeLanes(count)}
                    size="lg"
                    variant="outline"
                    className="h-24 w-24 text-2xl font-bold hover:scale-105 transition-transform"
                  >
                    {count}
                  </Button>
                ))}
              </div>
            </div>
          </Card>
        ) : (
          <>
            {/* Current Status */}
            {isOptimizing && (
              <Card className="p-4 bg-primary/10 border-primary/30">
                <div className="flex items-center justify-center gap-3 text-sm">
                  <Activity className="w-4 h-4 animate-pulse" />
                  <span className="font-medium">
                    Currently Active: Lane {currentGreenLane} (GREEN)
                  </span>
                </div>
              </Card>
            )}

            {/* Traffic Lanes Grid */}
            <div className={`grid gap-6 ${laneCount === 2 ? 'grid-cols-1 md:grid-cols-2' : laneCount === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
              {lanes.map((lane, index) => (
                <TrafficLane
                  key={index}
                  laneNumber={index + 1}
                  onImageUpload={handleImageUpload}
                  signalState={lane.signalState}
                  vehicleCount={lane.vehicleCount}
                  hasEmergency={lane.hasEmergency}
                  congestionLevel={lane.congestionLevel}
                  waitingTime={lane.waitingTime}
                  greenDuration={lane.greenDuration}
                />
              ))}
            </div>

            {/* Optimization Panel */}
            <OptimizationPanel
              isOptimizing={isOptimizing}
              generation={generation}
              avgWaitTime={avgWaitTime}
              throughput={throughput}
            />
          </>
        )}

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
