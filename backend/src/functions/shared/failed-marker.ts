import { DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './dynamo.js';

/**
 * A `draft_failed` marker records that Generate Draft TRIED a slot (a shift-needed's date / location /
 * time) and found no employee. Its key is deterministic, so a re-run overwrites it instead of piling
 * up duplicates, and anything that changes the slot can find and clear it.
 *
 * Lifecycle: written by a run that can't fill the slot; cleared when that slot is filled (by a run or
 * by hand), when its need is edited (an edit is a new request and deserves a fresh attempt) or deleted.
 */
export interface FailedMarkerSlot {
  manager_id: string;
  date: string;
  location_id: string;
  start_time: string;
  end_time: string;
}

export function failedMarkerSuffix(slot: FailedMarkerSlot): string {
  return `${slot.manager_id}#${slot.date}#${slot.location_id}#${slot.start_time}#${slot.end_time}`;
}

export function failedMarkerSortKey(slot: FailedMarkerSlot): string {
  return `SHIFT#FAILED#${failedMarkerSuffix(slot)}`;
}

/** Remove the marker for a slot. Idempotent: deleting a marker that isn't there is fine. */
export async function clearFailedMarker(orgId: string, slot: FailedMarkerSlot): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: failedMarkerSortKey(slot) },
    }),
  );
}
