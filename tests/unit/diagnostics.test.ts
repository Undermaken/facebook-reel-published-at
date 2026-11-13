import { afterEach, describe, expect, it, vi } from 'vitest';
import { MissingBadgeDiagnostics } from '../../src/diagnostics';

afterEach(() => vi.useRealTimers());

describe('MissingBadgeDiagnostics', () => {
  it('reports a persistent missing badge without repeated refreshes', () => {
    vi.useFakeTimers();
    const report = vi.fn();
    const diagnostics = new MissingBadgeDiagnostics(report);

    diagnostics.update('111', 'metadata_missing');
    vi.advanceTimersByTime(4_999);
    expect(report).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(report).toHaveBeenCalledExactlyOnceWith('metadata_missing');

    vi.advanceTimersByTime(10_000);
    expect(report).toHaveBeenCalledTimes(1);
  });

  it('reports a persistent missing badge once per reason and Reel', () => {
    const report = vi.fn();
    const diagnostics = new MissingBadgeDiagnostics(report);

    diagnostics.update('111', 'metadata_missing', 0);
    diagnostics.update('111', 'metadata_missing', 4_999);
    expect(report).not.toHaveBeenCalled();
    diagnostics.update('111', 'metadata_missing', 5_000);
    diagnostics.update('111', 'metadata_missing', 30_000);
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith('metadata_missing');

    diagnostics.update('111', 'target_missing', 30_001);
    expect(report).toHaveBeenCalledWith('target_missing');
    diagnostics.update('222', 'metadata_missing', 30_002);
    diagnostics.update('222', 'metadata_missing', 35_002);
    expect(report).toHaveBeenCalledTimes(3);
  });

  it('does not report loading that resolves, and resets after the route exits', () => {
    const report = vi.fn();
    const diagnostics = new MissingBadgeDiagnostics(report);
    diagnostics.update('111', 'metadata_missing', 0);
    diagnostics.update('111', 'shown', 2_000);
    diagnostics.update(null, 'inactive', 3_000);
    diagnostics.update('111', 'metadata_missing', 10_000);
    diagnostics.update('111', 'metadata_missing', 15_000);
    expect(report).toHaveBeenCalledOnce();
  });
});
