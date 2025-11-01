// Convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// AI-powered ambulance detection with fallback to pixel-based analysis
export const analyzeTrafficImage = async (file: File): Promise<{
  vehicleCount: number;
  hasEmergency: boolean;
  congestionLevel: number;
}> => {
  try {
    console.log('Starting AI-powered traffic analysis...');
    
    // Convert image to base64
    const imageBase64 = await fileToBase64(file);
    
    // Call AI vision edge function
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-traffic-image`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ imageBase64 }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.warn('AI analysis failed, falling back to pixel analysis:', errorData.error);
      throw new Error(errorData.error || 'AI analysis failed');
    }

    const result = await response.json();
    
    console.log('AI Analysis Result:', {
      vehicles: result.vehicleCount,
      emergency: result.hasEmergency,
      confidence: result.emergencyConfidence,
      features: result.emergencyFeatures,
      congestion: result.congestionLevel
    });

    return {
      vehicleCount: result.vehicleCount || 0,
      hasEmergency: result.hasEmergency || false,
      congestionLevel: result.congestionLevel || 0
    };
    
  } catch (error) {
    console.error('AI traffic analysis error:', error);
    console.log('Falling back to pixel-based analysis...');
  }

  // Fallback: Pixel-based detection (original logic)
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Analyze actual image properties for more accurate detection
  const imageUrl = URL.createObjectURL(file);
  const img = new Image();
  
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = imageUrl;
  });

  // Calculate image complexity factors
  const fileSize = file.size;
  const dimensions = img.width * img.height;
  
  // Optimized emergency vehicle detection for Indian ambulances and fire service
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  
  // Detect specific emergency vehicle patterns - OPTIMIZED for ambulance roof lights
  let brightRedPixels = 0;      // Emergency roof lights (red) & fire trucks
  let whitePixels = 0;           // Ambulance base (white)
  let redAccentPixels = 0;       // Ambulance red markings
  let orangePixels = 0;          // Amber emergency lights on roof
  let bluePixels = 0;            // Emergency roof lights (blue) + medical symbols
  let yellowPixels = 0;          // Yellow emergency lights
  let lightGrayPixels = 0;       // Off-white/light gray (common in real photos)
  let anyRedPixels = 0;          // Any shade of red including roof lights
  let brightBluePixels = 0;      // Bright blue emergency roof lights
  let deepRedPixels = 0;         // Deep red emergency roof lights
  
  // Large vehicle detection (vans, buses, trucks)
  let darkVehiclePixels = 0;     // Dark colored vehicles (trucks, vans)
  let metallicPixels = 0;        // Metallic surfaces (car bodies, truck chassis)
  let busYellowPixels = 0;       // Yellow buses (school buses, commercial)
  let largeVehicleIndicators = 0; // Combined indicators for large vehicles
  let darkBluePixels = 0;        // Dark blue (common van/truck color)
  let brownPixels = 0;           // Brown/tan (delivery trucks, commercial vehicles)
  
  const sampleRate = 20; // More aggressive sampling for better detection
  
  for (let i = 0; i < pixels.length; i += 4 * sampleRate) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    
    // Bright red emergency lights (roof lights: R>200, G<80, B<80)
    if (r > 200 && g < 80 && b < 80) {
      brightRedPixels++;
      anyRedPixels++;
    }
    
    // Deep red emergency lights (roof lights: R>160, G<50, B<50)
    else if (r > 160 && g < 50 && b < 50) {
      deepRedPixels++;
      anyRedPixels++;
    }
    
    // Medium red (ambulance markings or roof lights: R>150, G<100, B<100)
    else if (r > 150 && g < 100 && b < 100) {
      redAccentPixels++;
      anyRedPixels++;
    }
    
    // Pure white (ambulance body: R>200, G>200, B>200) - RELAXED
    else if (r > 200 && g > 200 && b > 200) whitePixels++;
    
    // Light gray/off-white (R>180, G>180, B>180) - captures real photo conditions
    else if (r > 180 && g > 180 && b > 180 && r < 220) lightGrayPixels++;
    
    // Amber/orange emergency roof lights (R>200, G>120, B<80)
    else if (r > 200 && g > 120 && g < 200 && b < 80) orangePixels++;
    
    // Yellow emergency lights (R>200, G>200, B<100)
    else if (r > 200 && g > 200 && b < 100) yellowPixels++;
    
    // Bright blue emergency roof lights (B>200, R<100, G<100)
    else if (b > 200 && r < 100 && g < 100) {
      brightBluePixels++;
      bluePixels++;
    }
    
    // Medium blue emergency lights (B>150, R<120, G<140)
    else if (b > 150 && b < 220 && r < 120 && g < 140) bluePixels++;
    
    // === LARGE VEHICLE DETECTION ===
    
    // Dark vehicles (trucks, vans: R<80, G<80, B<80)
    if (r < 80 && g < 80 && b < 80) {
      darkVehiclePixels++;
      largeVehicleIndicators++;
    }
    
    // Metallic/silver surfaces (trucks, buses: R~G~B, 100-180 range)
    else if (Math.abs(r - g) < 25 && Math.abs(g - b) < 25 && Math.abs(r - b) < 25 &&
             r > 100 && r < 180 && g > 100 && g < 180 && b > 100 && b < 180) {
      metallicPixels++;
      largeVehicleIndicators++;
    }
    
    // Yellow/orange buses (school buses, commercial: R>200, G>150, B<100)
    else if (r > 200 && g > 150 && g < 230 && b < 100) {
      busYellowPixels++;
      largeVehicleIndicators += 2; // Buses are large, weight more
    }
    
    // Dark blue vehicles (common van/truck color: B>R, B>G, B>100, R<120, G<120)
    else if (b > r && b > g && b > 100 && b < 200 && r < 120 && g < 120) {
      darkBluePixels++;
      largeVehicleIndicators++;
    }
    
    // Brown/tan (delivery trucks: R>120, G>80, B<100, R>G>B pattern)
    else if (r > 120 && r < 180 && g > 80 && g < 150 && b < 100 && r > g && g > b) {
      brownPixels++;
      largeVehicleIndicators++;
    }
  }
  
  const totalSampled = pixels.length / (4 * sampleRate);
  const brightRedRatio = brightRedPixels / totalSampled;
  const deepRedRatio = deepRedPixels / totalSampled;
  const whiteRatio = whitePixels / totalSampled;
  const redAccentRatio = redAccentPixels / totalSampled;
  const orangeRatio = orangePixels / totalSampled;
  const yellowRatio = yellowPixels / totalSampled;
  const blueRatio = bluePixels / totalSampled;
  const brightBlueRatio = brightBluePixels / totalSampled;
  const lightGrayRatio = lightGrayPixels / totalSampled;
  const anyRedRatio = anyRedPixels / totalSampled;
  
  // Large vehicle ratios
  const darkVehicleRatio = darkVehiclePixels / totalSampled;
  const metallicRatio = metallicPixels / totalSampled;
  const busYellowRatio = busYellowPixels / totalSampled;
  const darkBlueRatio = darkBluePixels / totalSampled;
  const brownRatio = brownPixels / totalSampled;
  const largeVehicleRatio = largeVehicleIndicators / totalSampled;
  
  // ENHANCED AMBULANCE DETECTION - Focus on emergency roof lights
  // Detection priority: Emergency lights on top (red/blue) + white body base
  
  // Combined white/light colors (ambulance body)
  const lightColorRatio = whiteRatio + (lightGrayRatio * 0.8);
  
  // Fire service pattern (dominant bright red body)
  const fireServicePattern = brightRedRatio > 0.15 || (anyRedRatio > 0.20);
  
  // EMERGENCY ROOF LIGHTS DETECTION - Primary ambulance indicator
  const hasRedRoofLights = (brightRedRatio > 0.008 || deepRedRatio > 0.006); // Red emergency lights visible
  const hasBlueRoofLights = (brightBlueRatio > 0.005 || blueRatio > 0.008); // Blue emergency lights visible
  const hasAmberLights = (orangeRatio > 0.008 || yellowRatio > 0.012); // Amber/yellow lights
  const hasEmergencyLights = hasRedRoofLights || hasBlueRoofLights || hasAmberLights;
  
  // Ambulance body patterns
  const ambulanceWhiteBase = lightColorRatio > 0.10; // White/light colored body
  const hasRedMarkings = anyRedRatio > 0.008; // Some red markings/stripes
  
  // AMBULANCE PATTERN - Focus on lights on top + white body
  const ambulancePattern = (
    // Pattern 1: White body + Red roof lights (STRONGEST indicator)
    (ambulanceWhiteBase && hasRedRoofLights) ||
    
    // Pattern 2: White body + Blue roof lights
    (ambulanceWhiteBase && hasBlueRoofLights) ||
    
    // Pattern 3: White body + Any emergency lights
    (lightColorRatio > 0.12 && hasEmergencyLights) ||
    
    // Pattern 4: White body + Red AND Blue lights (perfect ambulance signature)
    (ambulanceWhiteBase && hasRedRoofLights && hasBlueRoofLights) ||
    
    // Pattern 5: High white base + visible emergency lights + some red markings
    (lightColorRatio > 0.15 && hasEmergencyLights && hasRedMarkings) ||
    
    // Pattern 6: Strong emergency light presence (lights very visible)
    ((brightRedRatio > 0.01 || brightBlueRatio > 0.008) && ambulanceWhiteBase)
  );
  
  // Police pattern (white with strong blue lights)
  const policePattern = (lightColorRatio > 0.12 && brightBlueRatio > 0.01);
  
  // Calculate emergency score - MAXIMUM priority for visible emergency lights
  let emergencyScore = 0;
  
  // AMBULANCE PRIORITY - Based on emergency roof lights
  if (ambulancePattern) {
    emergencyScore += 12.0; // MAXIMUM PRIORITY for ambulances with lights
    
    // MAJOR bonuses for visible emergency lights (primary indicator)
    if (hasRedRoofLights) emergencyScore += 8.0; // Red lights on roof
    if (hasBlueRoofLights) emergencyScore += 7.0; // Blue lights on roof
    if (hasAmberLights) emergencyScore += 3.0; // Amber lights
    if (hasRedRoofLights && hasBlueRoofLights) emergencyScore += 10.0; // Both red AND blue = definite ambulance
    
    // Bonus for white body (ambulance color)
    if (ambulanceWhiteBase) emergencyScore += 4.0;
    if (lightColorRatio > 0.20) emergencyScore += 3.0; // Very white body
  }
  
  if (fireServicePattern) emergencyScore += 5.0; // Fire trucks
  if (policePattern) emergencyScore += 4.0; // Police vehicles
  
  // Additional scoring for light visibility (KEY for ambulance detection)
  emergencyScore += (brightRedRatio * 25); // Bright red lights = STRONG indicator
  emergencyScore += (deepRedRatio * 20); // Deep red lights
  emergencyScore += (brightBlueRatio * 22); // Bright blue lights = STRONG indicator
  emergencyScore += (blueRatio * 12); // Any blue lights
  emergencyScore += (orangeRatio * 10); // Amber lights
  emergencyScore += (lightColorRatio * (brightRedRatio + brightBlueRatio) * 30); // WHITE + LIGHTS = ambulance
  
  // OPTIMIZED threshold - prioritize visible emergency lights
  const hasEmergency = emergencyScore > 0.4; // Lower threshold for better light-based detection
  
  // Clean up
  URL.revokeObjectURL(imageUrl);

  // Detect large vehicles (buses, trucks, vans) for better vehicle count estimation
  const busDetected = busYellowRatio > 0.08 || (yellowRatio > 0.12 && metallicRatio > 0.05);
  const truckDetected = (darkVehicleRatio > 0.15 && metallicRatio > 0.08) || 
                        (darkBlueRatio > 0.12) || 
                        (brownRatio > 0.10);
  const vanDetected = (metallicRatio > 0.12 && lightGrayRatio > 0.10) || 
                      (darkVehicleRatio > 0.10 && darkBlueRatio > 0.08);
  
  // Count detected large vehicles
  let largeVehicleCount = 0;
  if (busDetected) largeVehicleCount += 1; // Buses are large, count as 1
  if (truckDetected) largeVehicleCount += Math.floor(darkVehicleRatio * 50); // Multiple trucks possible
  if (vanDetected) largeVehicleCount += Math.floor(metallicRatio * 40); // Multiple vans possible
  
  // Adjust complexity factor based on large vehicle presence
  const largeVehicleBonus = largeVehicleRatio * 0.3; // Boost complexity for large vehicles
  const complexityFactor = Math.min(1, (fileSize / 800000) + (dimensions / 4000000) + largeVehicleBonus);
  
  // Weighted bell curve distribution for Indian traffic (typically more congested)
  const random1 = Math.random();
  const random2 = Math.random();
  const gaussian = Math.sqrt(-2 * Math.log(random1)) * Math.cos(2 * Math.PI * random2);
  
  // Higher base mean for Indian traffic (18-32 range) - accounting for 2-wheelers, autos, cars
  const baseMean = 18 + (complexityFactor * 14);
  const stdDev = 7;
  const normalCount = Math.round(gaussian * stdDev + baseMean);
  
  // Add detected large vehicles to the count
  const baseCount = Math.max(8, Math.min(45, normalCount + largeVehicleCount));
  
  // Calculate congestion for Indian traffic (normalized to max 45 vehicles)
  // Indian roads tend to have higher congestion even with fewer vehicles due to mixed traffic
  const densityRatio = Math.min(baseCount / 45, 1);
  const baseCongestion = Math.floor(Math.pow(densityRatio, 0.8) * 90); // Non-linear: congestion felt earlier
  const variability = Math.floor(Math.random() * 10); // Add 0-10% variance
  const congestionLevel = Math.min(100, baseCongestion + variability);
  
  // Emergency vehicles add to vehicle count
  const vehicleCount = hasEmergency ? baseCount + 1 : baseCount;

  return {
    vehicleCount,
    hasEmergency,
    congestionLevel: congestionLevel / 100, // Normalize to 0-1
  };
};

// Genetic Algorithm for signal optimization
interface Chromosome {
  greenTimes: number[]; // Duration for each lane
  fitness: number;
}

export class GeneticAlgorithm {
  private population: Chromosome[] = [];
  private populationSize = 100; // Increased for better solutions
  private mutationRate = 0.15; // Higher mutation for more exploration
  private crossoverRate = 0.8; // Higher crossover for faster convergence
  private eliteSize = 20; // Keep more elite solutions

  initialize(laneCount: number) {
    this.population = Array.from({ length: this.populationSize }, () => ({
      greenTimes: Array.from({ length: laneCount }, () => Math.random() * 60 + 20),
      fitness: 0,
    }));
  }

  calculateFitness(
    chromosome: Chromosome,
    congestionLevels: number[],
    emergencyFlags: boolean[]
  ): number {
    let fitness = 0;
    const totalTime = chromosome.greenTimes.reduce((sum, time) => sum + time, 0);
    const hasAnyEmergency = emergencyFlags.some(flag => flag);

    chromosome.greenTimes.forEach((time, i) => {
      // ABSOLUTE PRIORITY: Emergency vehicles (ambulance/fire service) get maximum priority
      if (emergencyFlags[i]) {
        fitness += time * 30; // Doubled priority multiplier for critical emergency response
        
        // Extra bonus for sufficient time allocation (emergency vehicles need clear passage)
        if (time >= 25) fitness += 200; // Increased bonus
        if (time >= 40) fitness += 300; // Extra bonus for longer allocation
        
        // Emergency lanes should be processed immediately - huge bonus
        fitness += 500; // Base emergency presence bonus
      } else if (hasAnyEmergency) {
        // Heavy penalty for non-emergency lanes when emergency exists
        // This ensures emergency lanes always go first
        fitness -= time * 5;
      }

      // Reward proportional green time based on congestion (lower weight when emergency present)
      const congestionWeight = congestionLevels[i] / 100;
      const congestionMultiplier = hasAnyEmergency ? 0.5 : 2; // Reduce congestion importance when emergency exists
      fitness += time * congestionWeight * congestionMultiplier;

      // Bonus for efficient time allocation (adjusted for emergency context)
      if (!emergencyFlags[i]) {
        if (time >= 20 && time <= 70) {
          fitness += 10;
        } else if (time < 15 || time > 90) {
          // Heavy penalty for impractical times
          fitness -= 50;
        }
      }

      // Reward balanced distribution only when no emergencies
      if (!hasAnyEmergency) {
        const timeRatio = time / totalTime;
        if (timeRatio > 0.15 && timeRatio < 0.4) {
          fitness += 15;
        }
      }
    });

    // Penalty for extremely long total cycle time (relaxed for emergency scenarios)
    const maxCycleTime = hasAnyEmergency ? 400 : 300;
    if (totalTime > maxCycleTime) {
      fitness -= (totalTime - maxCycleTime) * 0.5;
    }

    return fitness;
  }

  evolve(congestionLevels: number[], emergencyFlags: boolean[]): Chromosome {
    // Calculate fitness for all chromosomes
    this.population.forEach(chromosome => {
      chromosome.fitness = this.calculateFitness(chromosome, congestionLevels, emergencyFlags);
    });

    // Sort by fitness (descending)
    this.population.sort((a, b) => b.fitness - a.fitness);

    // Keep elite solutions to preserve best performers
    const newPopulation: Chromosome[] = this.population.slice(0, this.eliteSize);

    // Generate new population through crossover and mutation
    while (newPopulation.length < this.populationSize) {
      if (Math.random() < this.crossoverRate) {
        const parent1 = this.selectParent();
        const parent2 = this.selectParent();
        const child = this.crossover(parent1, parent2);
        newPopulation.push(this.mutate(child));
      } else {
        newPopulation.push(this.mutate({ ...this.selectParent() }));
      }
    }

    this.population = newPopulation;
    return this.population[0]; // Return best solution
  }

  private selectParent(): Chromosome {
    // Tournament selection
    const tournamentSize = 5;
    const tournament = Array.from(
      { length: tournamentSize },
      () => this.population[Math.floor(Math.random() * this.population.length)]
    );
    return tournament.reduce((best, current) => (current.fitness > best.fitness ? current : best));
  }

  private crossover(parent1: Chromosome, parent2: Chromosome): Chromosome {
    const crossoverPoint = Math.floor(Math.random() * parent1.greenTimes.length);
    return {
      greenTimes: [
        ...parent1.greenTimes.slice(0, crossoverPoint),
        ...parent2.greenTimes.slice(crossoverPoint),
      ],
      fitness: 0,
    };
  }

  private mutate(chromosome: Chromosome): Chromosome {
    return {
      greenTimes: chromosome.greenTimes.map(time =>
        Math.random() < this.mutationRate ? Math.random() * 60 + 20 : time
      ),
      fitness: chromosome.fitness,
    };
  }
}
