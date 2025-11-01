import { useState, useEffect } from "react";
import { TrafficLane } from "@/components/TrafficLane";
import { OptimizationPanel } from "@/components/OptimizationPanel";
import { OptimizationResults } from "@/components/OptimizationResults";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Play, RotateCcw, Activity, ArrowRight, AlertTriangle } from "lucide-react";
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
  const [showResults, setShowResults] = useState(false);
  const [optimizationStartTime, setOptimizationStartTime] = useState<number>(0);
  const [totalVehiclesAtStart, setTotalVehiclesAtStart] = useState(0);

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
          signalState: "red", // Keep red until optimization starts
          waitingTime: 0,
          greenDuration: 0,
        };
        return updated;
      });

      toast.success(`Lane ${laneNumber} analyzed: ${analysis.vehicleCount} vehicles detected`);
      
      if (analysis.hasEmergency) {
        toast.error(`🚨 EMERGENCY VEHICLE in Lane ${laneNumber}!`, {
          description: "Ambulance/Fire Service detected - PRIORITY CLEARANCE will be given",
          duration: 5000,
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

    // Calculate total vehicles at start
    const totalVehicles = lanes.reduce((sum, lane) => sum + lane.vehicleCount, 0);
    
    if (totalVehicles === 0) {
      toast.error("No vehicles detected in any lane");
      return;
    }

    // Reset metrics and results before starting
    setShowResults(false);
    setIsOptimizing(true);
    setGeneration(0);
    setAvgWaitTime(0);
    setThroughput(0);
    setCurrentGreenLane(0);
    setOptimizationStartTime(Date.now());
    setTotalVehiclesAtStart(totalVehicles);
    
    toast.success("Starting genetic algorithm optimization...", {
      description: `Optimizing traffic flow for ${totalVehicles} vehicles`,
    });
    
    // Initialize GA and begin optimization
    ga.initialize(laneCount || 4);
    runGeneticAlgorithm();
  };

  const runGeneticAlgorithm = () => {
    const congestionLevels = lanes.map(lane => lane.congestionLevel);
    const emergencyFlags = lanes.map(lane => lane.hasEmergency);
    const vehicleCounts = lanes.map(lane => lane.vehicleCount);

    let currentGen = 0;
    const maxGenerations = 100; // More generations for better optimization
    let cycleIndex = 0;

    const runCycle = () => {
      // Check if all lanes have 0 vehicles - stop optimization and show results
      const totalVehicles = lanes.reduce((sum, lane) => sum + lane.vehicleCount, 0);
      if (totalVehicles === 0) {
        const optimizationTime = Math.round((Date.now() - optimizationStartTime) / 1000);
        
        setIsOptimizing(false);
        setShowResults(true);
        
        toast.success("All lanes cleared!", {
          description: "Traffic optimization complete - no vehicles remaining",
        });
        return;
      }

      const best = ga.evolve(congestionLevels, emergencyFlags, vehicleCounts);
      currentGen++;
      
      setGeneration(currentGen);

      // Determine lane priority order (EMERGENCY ABSOLUTE FIRST, then by congestion)
      const laneOrder = lanes
        .map((lane, idx) => {
          // Calculate time needed to clear HALF the vehicles
          const halfVehicles = Math.ceil(lane.vehicleCount / 2);
          // Emergency: 2s per vehicle, Regular: 3s per vehicle
          const timePerVehicle = lane.hasEmergency ? 2 : 3;
          const halfClearanceTime = halfVehicles * timePerVehicle;
          
          return {
            idx, 
            priority: lane.hasEmergency ? 100000 : lane.congestionLevel,
            vehicleCount: lane.vehicleCount,
            halfVehicles,
            // Green time = time to clear 50% of vehicles
            greenTime: lane.hasEmergency 
              ? Math.max(15, halfClearanceTime) // Min 15s for emergency
              : Math.max(10, halfClearanceTime), // Min 10s for regular
            isEmergency: lane.hasEmergency
          };
        })
        .filter(lane => lane.vehicleCount > 0) // Only process lanes with vehicles
        .sort((a, b) => {
          // CRITICAL: Emergency lanes ALWAYS go first, regardless of any other factor
          if (a.isEmergency && !b.isEmergency) return -1;
          if (!a.isEmergency && b.isEmergency) return 1;
          // Then sort by priority (congestion)
          return b.priority - a.priority;
        });

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
      
      // Throughput calculation based on half-clearance strategy
      const clearingRate = lanes[currentLaneIdx].hasEmergency ? 2.0 : 3.0;
      const halfVehicles = Math.ceil(lanes[currentLaneIdx].vehicleCount / 2);
      setThroughput(prev => prev + halfVehicles);

      // Countdown mechanism - automatically switch after clearing half the vehicles
      let remainingTime = currentGreenTime;
      const initialVehicleCount = lanes[currentLaneIdx].vehicleCount;
      const initialCongestion = lanes[currentLaneIdx].congestionLevel;
      const targetVehiclesToClear = Math.ceil(initialVehicleCount / 2); // Clear 50%
      
      const countdownInterval = setInterval(() => {
        remainingTime--;
        
        // Update ONLY the current green lane's duration, vehicle count, and congestion
        setLanes(prev => prev.map((lane, idx) => {
          if (idx === currentLaneIdx && lane.signalState === "green") {
            // Vehicle movement: Emergency 2s per vehicle, Regular 3s per vehicle
            const elapsedTime = currentGreenTime - remainingTime;
            const clearingRate = lane.hasEmergency ? 2.0 : 3.0;
            const vehiclesMoved = Math.floor(elapsedTime / clearingRate);
            const vehiclesRemaining = Math.max(0, initialVehicleCount - vehiclesMoved);
            
            // AUTO-SWITCH: If we've cleared 50% of vehicles, end the green phase early
            if (vehiclesMoved >= targetVehiclesToClear && remainingTime > 2) {
              remainingTime = 2; // Give 2 seconds before switching
            }
            
            // Accurate congestion calculation based on remaining vehicles
            let newCongestion = 0;
            if (initialVehicleCount > 0 && vehiclesRemaining > 0) {
              const remainingRatio = vehiclesRemaining / initialVehicleCount;
              newCongestion = Math.round(remainingRatio * initialCongestion);
            }
            
            // Show toast when lane is cleared
            if (vehiclesRemaining === 0 && initialVehicleCount > 0) {
              toast.success(`Lane ${currentLaneIdx + 1} cleared!`, {
                description: "You can upload a new image for this lane",
              });
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
    setShowResults(false);
    setOptimizationStartTime(0);
    setTotalVehiclesAtStart(0);
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
            {/* Emergency Alert Banner - Shows if ANY lane has emergency */}
            {lanes.some(lane => lane.hasEmergency && lane.vehicleCount > 0) && (
              <Card className="p-6 bg-emergency border-4 border-white shadow-2xl animate-pulse">
                <div className="flex items-center justify-center gap-4">
                  <div className="w-4 h-4 rounded-full bg-white animate-ping" />
                  <AlertTriangle className="w-8 h-8 text-white" />
                  <div className="flex flex-col">
                    <span className="text-xl font-black text-white tracking-wider">
                      🚨 EMERGENCY VEHICLE DETECTED 🚨
                    </span>
                    <span className="text-sm text-white/90">
                      Priority lane clearance in progress - All other lanes on hold
                    </span>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-white" />
                  <div className="w-4 h-4 rounded-full bg-white animate-ping" />
                </div>
              </Card>
            )}

            {/* Current Status */}
            {isOptimizing && (
              <Card className="p-4 bg-primary/10 border-primary/30">
                <div className="flex items-center justify-center gap-3 text-sm">
                  <Activity className="w-4 h-4 animate-pulse" />
                  <span className="font-medium">
                    Currently Active: Lane {currentGreenLane} (GREEN)
                    {lanes[currentGreenLane - 1]?.hasEmergency && " - EMERGENCY PRIORITY"}
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
            {!showResults ? (
              <OptimizationPanel
                isOptimizing={isOptimizing}
                generation={generation}
                avgWaitTime={avgWaitTime}
                throughput={throughput}
              />
            ) : (
              <OptimizationResults
                totalVehiclesCleared={totalVehiclesAtStart}
                finalAvgWaitTime={avgWaitTime}
                totalThroughput={throughput}
                generationsCompleted={generation}
                optimizationTime={Math.round((Date.now() - optimizationStartTime) / 1000)}
              />
            )}
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
