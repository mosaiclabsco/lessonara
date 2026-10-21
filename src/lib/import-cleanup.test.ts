import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanupImportOriginals } from "./import-cleanup";
function database(path: string, storageError = false) {
  const remove = vi.fn().mockResolvedValue({ error: storageError ? {} : null }),
    inCalls: unknown[][] = [],
    updates: unknown[] = [];
  const query = {
    select: () => query,
    in: (...args: unknown[]) => {
      inCalls.push(args);
      return query;
    },
    not: () => query,
    order: () => query,
    limit: () => query,
    eq: () => query,
    update: (value: unknown) => {
      updates.push(value);
      return query;
    },
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(
        resolve({ data: [{ id: "batch", teacher_id: "teacher", object_path: path }], error: null }),
      ),
  };
  return {
    db: { from: () => query, storage: { from: () => ({ remove }) } } as unknown as SupabaseClient,
    remove,
    inCalls,
    updates,
  };
}
it("only cleans closed batches and their own known object paths", async () => {
  const { db, remove, inCalls, updates } = database("teacher/batch/original.csv");
  expect(await cleanupImportOriginals(db)).toEqual({ removed: 1, failed: 0 });
  expect(inCalls[0]).toEqual(["status", ["completed", "cancelled"]]);
  expect(remove).toHaveBeenCalledWith(["teacher/batch/original.csv"]);
  expect(updates).toEqual([{ object_path: null }]);
});
it("retains a failed cleanup for retry and rejects a foreign path", async () => {
  const failed = database("teacher/batch/original.xlsx", true);
  expect(await cleanupImportOriginals(failed.db)).toEqual({ removed: 0, failed: 1 });
  expect(failed.updates).toEqual([]);
  const foreign = database("other/batch/original.csv");
  expect(await cleanupImportOriginals(foreign.db)).toEqual({ removed: 0, failed: 1 });
  expect(foreign.remove).not.toHaveBeenCalled();
});
