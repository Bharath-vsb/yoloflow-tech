import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();
    
    if (!imageBase64) {
      throw new Error('No image provided');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Analyzing traffic image with AI vision...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this traffic image and detect, even if the image is blurry, low-light, rainy, compressed, or partially occluded:
1) Total number of vehicles visible (estimate across dense traffic; count 2-wheelers, autos, cars, buses, trucks)
2) Is there an ambulance present? Use robust cues:
   - Error-tolerant OCR for stickers: "AMBULANCE" (also partial forms like "AMB", "AMBULAN"), and "108"
   - Medical symbols: red cross/plus (two perpendicular red bars of similar thickness)
   - Roof emergency lights: saturated red and/or blue glowing clusters on top of a vehicle
   - Typical ambulance body: white/off-white or yellow with red stripes/markings
   - Prioritize red/blue roof lights + white body; allow partial evidence and aggregate signals
3) Estimate traffic congestion level as a number between 0 and 1

Important:
- Return ONLY a JSON object matching the schema below, no markdown.
- If multiple ambulances are found, set hasEmergency=true if at least one is present.
- Set emergencyConfidence between 0 and 1 reflecting certainty from all signals.

{
  "vehicleCount": <number>,
  "hasEmergency": <boolean>,
  "emergencyConfidence": <number between 0-1>,
  "emergencyFeatures": {
    "hasAmbulanceText": <boolean>,
    "has108Text": <boolean>,
    "hasRedCross": <boolean>,
    "hasEmergencyLights": <boolean>
  },
  "congestionLevel": <number between 0-1>
}`
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageBase64
                }
              }
            ]
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No response from AI');
    }

    console.log('AI response:', content);

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
    }

    const result = JSON.parse(jsonStr);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-traffic-image function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        vehicleCount: 0,
        hasEmergency: false,
        emergencyConfidence: 0,
        congestionLevel: 0
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
