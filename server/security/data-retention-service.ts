import "server-only";

import { subDays } from "date-fns";

import { DATA_RETENTION_POLICIES, type DataRetentionPolicy, type RetentionFilter } from "@/config/privacy-retention";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

interface RetentionPolicyResult {
  key: DataRetentionPolicy["key"];
  label: string;
  table: DataRetentionPolicy["table"];
  days: number;
  cutoffIso: string;
  matchedRows: number;
  deletedRows: number;
  dryRun: boolean;
}

export interface DataRetentionCleanupResult {
  executedAt: string;
  dryRun: boolean;
  actorUserId: string | null;
  policies: RetentionPolicyResult[];
}

function applyRetentionFilters<T>(query: T, filters: readonly RetentionFilter[] | undefined) {
  if (!filters || filters.length === 0) {
    return query;
  }

  return filters.reduce((current, filter) => {
    if (filter.type === "eq") {
      return (current as { eq: (column: string, value: string | number | boolean | null) => T }).eq(filter.column, filter.value);
    }

    return (current as { in: (column: string, value: string[]) => T }).in(filter.column, filter.value);
  }, query);
}

async function countExpiredRows(admin: AdminClient, policy: DataRetentionPolicy, cutoffIso: string) {
  let query = admin.from(policy.table).select("id", { count: "exact", head: true }).lt(policy.dateColumn, cutoffIso);
  query = applyRetentionFilters(query, policy.filters);

  const { count, error } = await query;
  if (error) {
    throw new Error(`Impossibile contare i record scaduti per ${policy.table}.`);
  }

  return count ?? 0;
}

async function deleteExpiredRows(admin: AdminClient, policy: DataRetentionPolicy, cutoffIso: string) {
  let query = admin.from(policy.table).delete().lt(policy.dateColumn, cutoffIso);
  query = applyRetentionFilters(query, policy.filters);

  const { error } = await query;
  if (error) {
    throw new Error(`Impossibile eliminare i record scaduti per ${policy.table}.`);
  }
}

export async function runDataRetentionCleanup(params?: {
  dryRun?: boolean;
  actorUserId?: string | null;
}) {
  const admin = createSupabaseAdminClient();
  const executedAt = new Date().toISOString();
  const dryRun = params?.dryRun ?? false;
  const actorUserId = params?.actorUserId ?? null;

  const policyResults: RetentionPolicyResult[] = [];

  for (const policy of DATA_RETENTION_POLICIES) {
    const cutoffIso = subDays(new Date(), policy.days).toISOString();
    const matchedRows = await countExpiredRows(admin, policy, cutoffIso);

    if (!dryRun && matchedRows > 0) {
      await deleteExpiredRows(admin, policy, cutoffIso);
    }

    policyResults.push({
      key: policy.key,
      label: policy.label,
      table: policy.table,
      days: policy.days,
      cutoffIso,
      matchedRows,
      deletedRows: dryRun ? 0 : matchedRows,
      dryRun,
    });
  }

  const summary: DataRetentionCleanupResult = {
    executedAt,
    dryRun,
    actorUserId,
    policies: policyResults,
  };

  try {
    await admin.from("audit_logs").insert({
      actor_user_id: actorUserId,
      entity: "retention_jobs",
      action: dryRun ? "data_retention_dry_run" : "data_retention_cleanup",
      details: summary,
    });
  } catch {
    // Non bloccare il cleanup se fallisce l'audit log.
  }

  return summary;
}
