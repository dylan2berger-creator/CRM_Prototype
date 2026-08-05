// Domain types for Rebound (shop performance recovery).
// Terms follow the spec's domain vocabulary exactly - do not substitute synonyms.

// A Shop Performance Manager (SPM) owns a book of shops; a Client Performance
// Manager (CPM) owns a DRP carrier within a division. Both are managers.
export type Role = 'spm' | 'cpm' | 'rvp' | 'gm' | 'exec';

export type Division = 'North Division' | 'South Division' | 'West Division';

export interface Region {
  id: string;
  name: string;
  rvpName: string;
  division: Division;
}

export interface Store {
  id: string; // "S-0142"
  name: string; // "Boyd Collision - Naperville"
  brand: 'Boyd' | 'JHCC';
  regionId: string;
  cbsaId: string;
  gmName: string;
  spmId: string; // Shop Performance Manager who owns this shop ('' when unassigned)
  assignedOn: string; // when the current SPM took this store (ISO date)
  previousSpmId: string; // prior owner, '' when this is the first owner
  openedOn: string; // ISO date
  acquiredOn: string | null;
}

export interface Cbsa {
  id: string;
  name: string;
  state: string;
}

export interface Client {
  id: string;
  name: string;
  isDrp: boolean;
}

// One row per store per client per month. This is the fact table.
export interface MetricPeriod {
  storeId: string;
  clientId: string;
  month: string; // "2026-06"
  revenueActual: number;
  revenuePlan: number; // from the business case
  roCount: number; // repair orders
  averageRo: number;
  cycleTimeDays: number;
  captureRatePct: number;
  // diagnostic metrics - the "why is this shop missing" set
  estimateAccuracyPct: number; // estimate vs final invoice
  internalRulesAdherencePct: number; // adherence to Boyd's own rules
  externalRulesAdherencePct: number; // adherence to the carrier's DRP rules
  centralReviewPassPct: number; // central review results
  qualityRecAcceptedPct: number; // quality recommendation results
  supplementsPerRo: number; // average count of supplements per RO
  supplementRatePct: number; // % of ROs requiring a supplement
  rentalDays: number; // average length of rental
  totalCostOfRepair: number; // average per RO
}

export interface BusinessCase {
  storeId: string;
  approvedOn: string;
  annualRevenuePlan: number;
  annualRoPlan: number; // 0 means "Not loaded" (JHCC baseline gap)
  source: 'Investment committee memo' | 'Model workbook';
  loadedFrom: string; // e.g. "IC-2024-0087.pdf" - shown as provenance
}

export type DrpTier = 'Preferred' | 'Standard' | 'Watch' | 'At risk';

export interface ScorecardDriver {
  name: string;
  weightPct: number;
  storeValue: number;
  carrierTarget: number;
}

export interface DrpScorecard {
  storeId: string;
  clientId: string;
  month: string;
  score: number; // 0-100
  rankInCbsa: number;
  competitorsInCbsa: number;
  tier: DrpTier;
  // carriers weight their scorecards differently; this drives what a plan should target
  drivers: ScorecardDriver[];
}

export interface CarrierVolume {
  clientId: string;
  storeId: string;
  month: string;
  assignmentActual: number; // DRP assignments received
  assignmentForecast: number; // forecast DRP volume - the baseline for this carrier
  isAnomaly: boolean; // flagged by the anomaly check
  anomalyNote: string | null;
}

// Pre-aggregated forecast vs actual at each level the VP needs to pivot on.
// The prototype computes these from MetricPeriod and CarrierVolume at load.
export interface PerformanceRollup {
  level: 'store' | 'carrier' | 'region' | 'carrier-in-region' | 'division';
  keys: { storeId?: string; clientId?: string; regionId?: string; division?: Division };
  month: string;
  revenueActual: number;
  revenueForecast: number;
  assignmentActual: number;
  assignmentForecast: number;
  drpScoreAvg: number | null;
  challengedStoreCount: number;
}

export interface CbsaMarket {
  cbsaId: string;
  clientId: string;
  month: string;
  pifCount: number;
  boydSharePct: number;
}

export type FlagMetric =
  | 'revenueVsPlan'
  | 'roVsPlan'
  | 'drpVolumeVsForecast'
  | 'drpTier'
  | 'captureRate';

export interface FlagReason {
  metric: FlagMetric;
  label: string; // "T3 revenue 12.4% below plan"
  actual: number;
  threshold: number;
}

export interface FlagEvaluation {
  storeId: string;
  month: string;
  isChallenged: boolean;
  ruleVersion: string; // "v2.1"
  reasons: FlagReason[]; // why it fired, empty if not challenged
  firstFlaggedMonth: string | null;
}

export type ActionPlanStatus = 'Draft' | 'Active' | 'Monitoring' | 'Closed';

export interface ActionPlan {
  id: string;
  storeId: string;
  createdOn: string;
  createdBy: string;
  status: ActionPlanStatus;
  summary: string;
  steps: ActionStep[];
  risks: Risk[];
  salesAsks: SalesAsk[];
}

export type TaskType =
  | 'Central review rule change'
  | 'Training'
  | 'Metric monitoring'
  | 'Carrier outreach'
  | 'Staffing'
  | 'Estimating process'
  | 'Parts or supply'
  | 'Other';

export const TASK_TYPES: TaskType[] = [
  'Central review rule change',
  'Training',
  'Metric monitoring',
  'Carrier outreach',
  'Staffing',
  'Estimating process',
  'Parts or supply',
  'Other',
];

// The metric a task is meant to move. Drives the benchmarking view.
export type TargetMetric =
  | 'revenueActual'
  | 'roCount'
  | 'drpScore'
  | 'assignmentActual'
  | 'estimateAccuracyPct'
  | 'internalRulesAdherencePct'
  | 'externalRulesAdherencePct'
  | 'centralReviewPassPct'
  | 'qualityRecAcceptedPct'
  | 'supplementsPerRo'
  | 'rentalDays'
  | 'totalCostOfRepair'
  | 'captureRatePct';

export type StepStatus = 'Not started' | 'In progress' | 'Blocked' | 'Done';

export type TaggedRole = Role | 'National Account Manager';

export interface TaggedPerson {
  name: string;
  role: TaggedRole;
  reason: string;
}

export interface ActionStep {
  id: string;
  title: string;
  type: TaskType;
  targetMetrics: TargetMetric[]; // what this task is meant to move; drives chart markers
  clientId: string | null; // set when the task is carrier-specific
  owner: string;
  ownerRole: Role;
  dueOn: string;
  startedOn: string | null; // when work actually began - the benchmark date
  status: StepStatus;
  completedOn: string | null;
  note: string;
  taggedPeople: TaggedPerson[];
}

export interface Risk {
  id: string;
  description: string;
  severity: 'Low' | 'Medium' | 'High';
  owner: string;
  mitigation: string;
}

export type SalesAskStatus = 'Open' | 'Accepted' | 'Contacted' | 'Closed';

export interface SalesAsk {
  id: string;
  clientId: string;
  request: string;
  raisedOn: string;
  raisedBy: string;
  status: SalesAskStatus;
  outcome: string | null;
}

export type AlertKind =
  | 'New flag'
  | 'Slippage'
  | 'Overdue step'
  | 'DRP tier drop'
  | 'Carrier volume anomaly'
  | 'Scorecard anomaly';

export interface Alert {
  id: string;
  storeId: string;
  clientId?: string | null; // set for carrier-level alerts
  raisedOn: string;
  kind: AlertKind;
  message: string;
  acknowledged: boolean;
}

export interface DataFreshness {
  dataset: string; // "DOMO Exec Dashboard - Revenue"
  lastRefreshed: string; // ISO datetime
  certified: boolean;
}

// The full generated dataset. Read-only reference data plus the seeded,
// then-mutable action plans / alerts. Passed to the challenged rule and
// held by the DataContext.
export interface DataSet {
  months: string[]; // chronological "YYYY-MM", oldest -> newest
  currentMonth: string;
  regions: Region[];
  cbsas: Cbsa[];
  clients: Client[];
  stores: Store[];
  // Shop Performance Managers own books of shops (the shop's owner).
  spms: { id: string; name: string }[];
  // A CPM (Client Performance Manager) owns one DRP carrier within one division.
  cpms: { id: string; name: string; role: Role; carrierId?: string; division?: Division }[];
  metrics: MetricPeriod[];
  businessCases: BusinessCase[];
  scorecards: DrpScorecard[];
  carrierVolumes: CarrierVolume[];
  cbsaMarkets: CbsaMarket[];
  actionPlans: ActionPlan[];
  alerts: Alert[];
  freshness: DataFreshness[];
}
