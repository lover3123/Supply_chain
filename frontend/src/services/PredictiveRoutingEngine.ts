export type RiskLevel = 'low' | 'medium' | 'high';
export type DecisionMode = 'auto-execute' | 'hitl';

export interface RouteSegment {
  id: string;
  lengthKm: number;
  predictedSpeedKmh: number;
  baselineSpeedKmh?: number;
  weatherSeverityMmHr: number;
  riskIndex: number;
  corridor?: string;
}

export interface RoutingWeights {
  alpha: number;
  beta: number;
  slaToleranceMinutes: number;
}

export interface RouteCost {
  travelMinutes: number;
  weatherPenaltyMinutes: number;
  riskPenaltyMinutes: number;
  totalCostMinutes: number;
}

export interface RerouteEvaluation {
  baseline: RouteCost;
  proposed: RouteCost;
  deltaEtaMinutes: number;
  slaRecoveryMinutes: number;
  slaRecoveryPercent: number;
  extraKm: number;
  surchargeCostInr: number;
  riskLevel: RiskLevel;
  mode: DecisionMode;
  shouldEvaluate: boolean;
  reasons: string[];
}

export const DEFAULT_ROUTING_WEIGHTS: RoutingWeights = {
  alpha: 0.8,
  beta: 12,
  slaToleranceMinutes: 10,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Calculates W(e,t) in minutes: length / predicted speed + weather + localized risk penalties. */
export function calculateSegmentCost(segment: RouteSegment, weights: RoutingWeights = DEFAULT_ROUTING_WEIGHTS): RouteCost {
  const speed = Math.max(segment.predictedSpeedKmh, 3);
  const travelMinutes = (segment.lengthKm / speed) * 60;
  const weatherPenaltyMinutes = weights.alpha * clamp(segment.weatherSeverityMmHr / 10, 0, 5) * 2;
  const riskPenaltyMinutes = weights.beta * clamp(segment.riskIndex, 0, 1) / 4;
  return { travelMinutes, weatherPenaltyMinutes, riskPenaltyMinutes, totalCostMinutes: travelMinutes + weatherPenaltyMinutes + riskPenaltyMinutes };
}

export function calculateRouteCost(segments: RouteSegment[], weights: RoutingWeights = DEFAULT_ROUTING_WEIGHTS): RouteCost {
  return segments.reduce<RouteCost>((total, segment) => {
    const cost = calculateSegmentCost(segment, weights);
    return {
      travelMinutes: total.travelMinutes + cost.travelMinutes,
      weatherPenaltyMinutes: total.weatherPenaltyMinutes + cost.weatherPenaltyMinutes,
      riskPenaltyMinutes: total.riskPenaltyMinutes + cost.riskPenaltyMinutes,
      totalCostMinutes: total.totalCostMinutes + cost.totalCostMinutes,
    };
  }, { travelMinutes: 0, weatherPenaltyMinutes: 0, riskPenaltyMinutes: 0, totalCostMinutes: 0 });
}

export function evaluateReroute(baselineSegments: RouteSegment[], proposedSegments: RouteSegment[], surchargeCostInr = 0, weights: RoutingWeights = DEFAULT_ROUTING_WEIGHTS): RerouteEvaluation {
  const baseline = calculateRouteCost(baselineSegments, weights);
  const proposed = calculateRouteCost(proposedSegments, weights);
  const freeFlow = calculateRouteCost(baselineSegments.map(segment => ({
    ...segment,
    predictedSpeedKmh: segment.baselineSpeedKmh ?? segment.predictedSpeedKmh,
    weatherSeverityMmHr: 0,
    riskIndex: 0,
  })), weights);
  const deltaEtaMinutes = Math.max(0, Math.round(baseline.totalCostMinutes - freeFlow.totalCostMinutes));
  const slaRecoveryMinutes = Math.max(0, Math.round(baseline.totalCostMinutes - proposed.totalCostMinutes));
  const slaRecoveryPercent = deltaEtaMinutes === 0 ? 100 : Math.min(100, Math.round((slaRecoveryMinutes / deltaEtaMinutes) * 100));
  const baselineKm = baselineSegments.reduce((sum, segment) => sum + segment.lengthKm, 0);
  const proposedKm = proposedSegments.reduce((sum, segment) => sum + segment.lengthKm, 0);
  const maxRisk = Math.max(...baselineSegments.map(segment => segment.riskIndex), 0);
  const riskLevel: RiskLevel = maxRisk >= 0.75 ? 'high' : maxRisk >= 0.45 ? 'medium' : 'low';
  const reasons = [
    deltaEtaMinutes > weights.slaToleranceMinutes ? `Predicted SLA breach in +${deltaEtaMinutes} min` : '',
    riskLevel === 'high' ? 'High localized route risk' : '',
    surchargeCostInr > 150 ? `Surcharge exceeds ₹150 (₹${surchargeCostInr})` : '',
  ].filter(Boolean);
  return {
    baseline, proposed, deltaEtaMinutes, slaRecoveryMinutes, slaRecoveryPercent, extraKm: Number((proposedKm - baselineKm).toFixed(1)), surchargeCostInr,
    riskLevel, mode: riskLevel !== 'high' && deltaEtaMinutes < 20 && surchargeCostInr <= 150 ? 'auto-execute' : 'hitl',
    shouldEvaluate: deltaEtaMinutes > weights.slaToleranceMinutes, reasons,
  };
}

export function riskColor(riskScore: number, rainfallMmHr = 0, gridlocked = false): string {
  const score = Math.max(riskScore, rainfallMmHr / 50, gridlocked ? 1 : 0);
  return score >= 0.75 ? '#f0445a' : score >= 0.4 ? '#f59e0b' : '#35d39a';
}
