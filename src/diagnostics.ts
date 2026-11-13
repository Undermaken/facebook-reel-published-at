export type DiagnosticStatus =
  | 'inactive'
  | 'shown'
  | 'metadata_missing'
  | 'target_missing'
  | 'stale_player'
  | 'reel_mismatch'
  | 'placement_failed'
  | 'render_failed';

const detail: Partial<Record<DiagnosticStatus, string>> = {
  metadata_missing: 'No matching publication metadata has arrived for this Reel.',
  target_missing: 'No unique visible Reel video and creator heading were found.',
  stale_player: 'The page still shows the previous Reel player during navigation.',
  reel_mismatch: 'The visible player links to a different Reel.',
  placement_failed: 'The selected position could not fit the visible player.',
  render_failed: 'An unexpected error prevented the date box from rendering.',
};

export class MissingBadgeDiagnostics {
  private reelId: string | null = null;
  private missingSince: number | null = null;
  private reported = new Set<DiagnosticStatus>();

  constructor(
    private readonly report: (status: DiagnosticStatus) => void = (status) => {
      console.warn(
        `[Facebook Reel Date] ${status}: ${detail[status]} No response bodies are logged.`,
      );
    },
  ) {}

  update(reelId: string | null, status: DiagnosticStatus, now = Date.now()): void {
    if (!reelId || status === 'inactive') {
      this.reelId = null;
      this.missingSince = null;
      this.reported.clear();
      return;
    }
    if (reelId !== this.reelId) {
      this.reelId = reelId;
      this.missingSince = null;
      this.reported.clear();
    }
    if (status === 'shown') {
      this.missingSince = null;
      return;
    }
    this.missingSince ??= now;
    if (now - this.missingSince < 5_000 || this.reported.has(status)) return;
    this.reported.add(status);
    this.report(status);
  }
}
