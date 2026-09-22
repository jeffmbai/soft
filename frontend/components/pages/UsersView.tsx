"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import StaffDetailPanel from "@/components/pages/StaffDetailPanel";
import StaffFormModal from "@/components/pages/StaffFormModal";
import {
  Avatar,
  Badge,
  Chip,
  DataTable,
  FilterBar,
  Icon,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui";
import Loading from "@/components/Loading";
import {
  createStaff,
  deleteStaff,
  exportStaffCsv,
  fetchLocations,
  fetchStaff,
  updateStaff,
  type StaffListParams,
} from "@/lib/api";
import { CERT_OPTIONS, SKILL_OPTIONS, toStaffMemberUI, type StaffMemberUI } from "@/lib/staff-utils";
import { cn } from "@/lib/cn";

function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((d: { msg?: string }) => d.msg).join(", ");
  }
  return "Something went wrong";
}

export default function UsersView() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [skill, setSkill] = useState("");
  const [locationId, setLocationId] = useState("");
  const [certification, setCertification] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editTarget, setEditTarget] = useState<StaffMemberUI | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const listParams: StaffListParams = useMemo(
    () => ({
      q: debouncedSearch || undefined,
      skill: skill || undefined,
      location_id: locationId || undefined,
      certification: (certification as "single" | "multi") || undefined,
    }),
    [debouncedSearch, skill, locationId, certification],
  );

  const { data: locations = [] } = useQuery({
    queryKey: ["locations"],
    queryFn: fetchLocations,
  });

  const { data: staffRows = [], isLoading, isError, error } = useQuery({
    queryKey: ["staff", listParams],
    queryFn: () => fetchStaff(listParams),
  });

  const roster = useMemo(() => staffRows.map(toStaffMemberUI), [staffRows]);
  const selected = roster.find((s) => s.id === selectedId) ?? null;

  const stats = useMemo(() => {
    const cross = roster.filter((r) => r.secondary).length;
    const equity =
      roster.length > 0
        ? roster.reduce((sum, r) => sum + r.progress, 0) / roster.length
        : 0;
    const ot = roster.filter((r) => r.otRisk).length;
    return [
      { label: "Active Workforce", value: String(roster.length), sub: "Staff" },
      { label: "Cross-Certified", value: String(cross), sub: roster.length ? `${((cross / roster.length) * 100).toFixed(0)}% Float` : "—" },
      { label: "Avg Hours Equity", value: `${equity.toFixed(1)}%`, sub: "Target 90%+" },
      { label: "Overtime Risks", value: `${ot} Staff`, sub: ot ? "ATTN REQ" : "Clear", alert: ot > 0 },
    ];
  }, [roster]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["staff"] });

  const createMutation = useMutation({
    mutationFn: createStaff,
    onSuccess: () => {
      void invalidate();
      setFormOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateStaff>[1] }) =>
      updateStaff(id, payload),
    onSuccess: () => {
      void invalidate();
      setFormOpen(false);
      setEditTarget(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteStaff,
    onSuccess: () => {
      void invalidate();
      setSelectedId(null);
    },
  });

  async function handleExport() {
    const blob = await exportStaffCsv(listParams);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "staff-roster.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearFilters() {
    setSearch("");
    setSkill("");
    setLocationId("");
    setCertification("");
  }

  function openCreate() {
    setFormMode("create");
    setEditTarget(null);
    setFormOpen(true);
  }

  function openEdit(member: StaffMemberUI) {
    setFormMode("edit");
    setEditTarget(member);
    setFormOpen(true);
  }

  const locationOptions = [
    { value: "", label: "All Locations" },
    ...locations.map((l) => ({ value: l.id, label: l.name })),
  ];

  return (
    <div className="flex flex-col gap-0 -m-margin">
      <div className="px-margin pt-space-md pb-space-sm border-b border-outline-variant bg-surface-container-lowest space-y-space-md">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {stats.map((s) => (
            <StatCard key={s.label} {...s} className="!p-2.5" />
          ))}
        </div>
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search name or email…"
          onClear={clearFilters}
          filters={[
            {
              id: "skill",
              label: "Skill",
              value: skill,
              onChange: setSkill,
              options: SKILL_OPTIONS,
            },
            {
              id: "location",
              label: "Location",
              value: locationId,
              onChange: setLocationId,
              options: locationOptions,
            },
            {
              id: "cert",
              label: "Certification",
              value: certification,
              onChange: setCertification,
              options: CERT_OPTIONS,
            },
          ]}
        />
      </div>

      <div className="p-margin">
        {isLoading ? (
          <Loading variant="inline" message="Loading roster…" />
        ) : isError ? (
          <div className="p-4 rounded-xl border border-error bg-error-container text-on-error-container">
            {apiErrorMessage(error)}
          </div>
        ) : (
          <DataTable
            title="Roster Directory"
            count={`${roster.length} shown`}
            onExport={() => void handleExport()}
            toolbar={
              <button
                type="button"
                title="Add staff"
                onClick={openCreate}
                className="p-1.5 hover:bg-surface-container-high rounded-lg transition-colors"
              >
                <Icon name="person_add" size={16} />
              </button>
            }
          >
            <Table>
              <TableHead>
                <TableHeaderCell className="w-8 px-space-md">{""}</TableHeaderCell>
                <TableHeaderCell>Employee</TableHeaderCell>
                <TableHeaderCell>Locations</TableHeaderCell>
                <TableHeaderCell className="hidden lg:table-cell">Skills</TableHeaderCell>
                <TableHeaderCell>Hours</TableHeaderCell>
                <TableHeaderCell className="hidden md:table-cell">Availability</TableHeaderCell>
              </TableHead>
              <TableBody>
                {roster.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-on-surface-variant">
                      No staff match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  roster.map((row) => {
                    const isSelected = selectedId === row.id;
                    return (
                      <TableRow
                        key={row.id}
                        selected={isSelected}
                        onClick={() => setSelectedId(isSelected ? null : row.id)}
                      >
                        <TableCell className="pl-space-md pr-0">
                          <span
                            className={cn(
                              "flex w-5 h-5 items-center justify-center rounded-full transition-all",
                              isSelected
                                ? "bg-secondary text-on-secondary"
                                : "text-outline opacity-0 group-hover:opacity-100",
                            )}
                          >
                            <Icon name={isSelected ? "check" : "chevron_right"} size={14} />
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar
                              initials={row.initials}
                              size="md"
                              variant={isSelected ? "secondary" : "default"}
                              className={!isSelected ? "group-hover:bg-secondary/15 group-hover:text-secondary" : undefined}
                            />
                            <div>
                              <span className="font-title-sm text-title-sm font-bold text-primary block">{row.name}</span>
                              <span className="font-data-mono text-data-mono text-outline text-[11px]">
                                {row.email} · {row.role}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Chip variant="location" dot>{row.primary}</Chip>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex flex-wrap gap-1 max-w-[180px]">
                            {row.skills.slice(0, 2).map((s) => (
                              <Badge key={s} variant="default" mono className="text-[10px] rounded-md">{s}</Badge>
                            ))}
                            {row.skills.length > 2 && (
                              <Badge variant="outline" mono className="text-[10px] rounded-md">+{row.skills.length - 2}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-data-mono text-data-mono font-bold text-primary">{row.hours}</span>
                            <span className="font-data-mono text-data-mono text-outline">/ {row.goal}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="font-data-mono text-data-mono text-[11px] text-on-surface-variant">
                            {row.availability}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </DataTable>
        )}
      </div>

      {selected && (
        <StaffDetailPanel
          staff={selected}
          open={!!selected}
          onClose={() => setSelectedId(null)}
          onEdit={() => openEdit(selected)}
          onDelete={() => deleteMutation.mutate(selected.id)}
          isDeleting={deleteMutation.isPending}
        />
      )}

      <StaffFormModal
        open={formOpen}
        mode={formMode}
        locations={locations}
        initial={
          editTarget
            ? {
                name: editTarget.name,
                email: editTarget.email,
                desiredHours: editTarget.desiredHours,
                availabilityTimezone: editTarget.availabilityTimezone,
                skillKeys: editTarget.skillKeys,
                locationIds: editTarget.locationIds,
              }
            : undefined
        }
        onClose={() => {
          setFormOpen(false);
          setEditTarget(null);
        }}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        onSubmit={async (payload) => {
          try {
            if (formMode === "create") {
              await createMutation.mutateAsync(payload);
            } else if (editTarget) {
              await updateMutation.mutateAsync({ id: editTarget.id, payload });
            }
          } catch (err) {
            throw new Error(apiErrorMessage(err));
          }
        }}
      />
    </div>
  );
}
