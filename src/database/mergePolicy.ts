type Row = Record<string, string | number | null>;
const stateFields = ['depth_level', 'stability', 'difficulty', 'retrievability', 'next_review', 'lapse_count', 'consecutive_correct', 'fast_learn_level', 'fast_learn_fail_count', 'response_time_avg_ms'];

// Latest review wins, with a deterministic tie-break so equal-count offline
// reviews converge regardless of which device initiates the merge.
export function remoteStateWins(local: Row, remote: Row): boolean {
  const localTime = String(local.last_review ?? '');
  const remoteTime = String(remote.last_review ?? '');
  if (localTime !== remoteTime) return remoteTime > localTime;
  if (!localTime && local.review_count !== remote.review_count) return Number(remote.review_count ?? 0) > Number(local.review_count ?? 0);
  return JSON.stringify(stateFields.map(k => remote[k] ?? null)) > JSON.stringify(stateFields.map(k => local[k] ?? null));
}

export function mergedStar(local: Row, remote: Row): [number, string, string] {
  const a = String(local.starred_updated_at ?? '');
  const b = String(remote.starred_updated_at ?? '');
  if (!a && !b) return [Math.max(Number(local.starred ?? 0), Number(remote.starred ?? 0)), '', ''];
  const remoteWins = b > a || (b === a && String(remote.starred_change_id ?? '') > String(local.starred_change_id ?? ''));
  const winner = remoteWins ? remote : local;
  return [Number(winner.starred ?? 0), String(winner.starred_updated_at ?? ''), String(winner.starred_change_id ?? '')];
}
