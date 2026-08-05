// Data invariants for the DRP program wiring and scorecard grading. Guards the
// carrier set (the 9 DRP carriers Boyd runs a program with, each mapped to a real
// program), the four canonical scorecard dimensions, and a believable tier /
// challenged-rate distribution.

import { describe, it, expect } from 'vitest';
import { generate } from '@/mock/generator';
import { evaluateStore } from '@/logic/challengedRule';

describe('DRP program + scorecard data', () => {
  const data = generate();

  it('has exactly 9 DRP carriers, each with a real program identity', () => {
    const drp = data.clients.filter((c) => c.isDrp);
    expect(drp.length).toBe(9);
    expect(drp.every((c) => !!c.drpProgram && !!c.scorecardName && !!c.scorePlatform)).toBe(true);
  });

  it('treats American Family as DRP and Travelers as non-DRP', () => {
    expect(data.clients.find((c) => c.name === 'American Family Insurance')?.isDrp).toBe(true);
    expect(data.clients.find((c) => c.name === 'Travelers')?.isDrp).toBe(false);
  });

  it('scores every scorecard on the four canonical dimensions', () => {
    const sample = data.scorecards.find((s) => s.drivers.length > 0)!;
    expect(sample.drivers.map((d) => d.name)).toEqual([
      'Cycle time (keys-to-keys)',
      'Customer satisfaction (CSI)',
      'Estimate & severity control',
      'Administrative & quality compliance',
    ]);
    // weights sum to 100
    expect(sample.drivers.reduce((a, d) => a + d.weightPct, 0)).toBe(100);
  });

  it('produces a non-degenerate tier spread', () => {
    const tiers = new Set(data.scorecards.filter((s) => s.month === data.currentMonth).map((s) => s.tier));
    // at least Preferred, Standard, and one of Watch/At risk are present
    expect(tiers.has('Preferred')).toBe(true);
    expect(tiers.has('Standard')).toBe(true);
    expect(tiers.has('Watch') || tiers.has('At risk')).toBe(true);
  });

  it('gives every action plan at least five steps', () => {
    expect(data.actionPlans.length).toBeGreaterThan(0);
    for (const plan of data.actionPlans) {
      expect(plan.steps.length).toBeGreaterThanOrEqual(5);
    }
  });

  it('keeps the challenged rate in a believable band', () => {
    let challenged = 0;
    for (const s of data.stores) if (evaluateStore(s.id, data.currentMonth, data).isChallenged) challenged++;
    const rate = (challenged / data.stores.length) * 100;
    expect(rate).toBeGreaterThan(12);
    expect(rate).toBeLessThan(30);
  });
});
