"use client";

import { useState } from "react";
import type { StaffMemberUI } from "@/lib/staff-utils";
import {
  Avatar,
  Badge,
  Button,
  CardSection,
  Chip,
  Drawer,
  DrawerCloseButton,
  FormField,
  Icon,
  ProgressBar,
  SegmentedControl,
} from "@/components/ui";
import { cn } from "@/lib/cn";

export type { StaffMemberUI as StaffMember };

type PanelTab = "overview" | "schedule" | "certs";

type StaffDetailPanelProps = {
  staff: StaffMemberUI;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
};

export default function StaffDetailPanel({
  staff,
  open,
  onClose,
  onEdit,
  onDelete,
  isDeleting,
}: StaffDetailPanelProps) {
  const [tab, setTab] = useState<PanelTab>("overview");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const header = (
    <div className="relative shrink-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary-container via-primary-container to-secondary/30" />
      <div className="relative px-5 pt-5 pb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar initials={staff.initials} size="xl" variant="gradient" />
            <div>
              <h2 className="font-headline-md text-headline-md font-bold text-inverse-on-surface">{staff.name}</h2>
              <p className="font-data-mono text-data-mono text-on-primary-container text-[11px] mt-0.5">{staff.email}</p>
            </div>
          </div>
          <DrawerCloseButton onClose={onClose} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="live">{staff.role}</Badge>
          {staff.otRisk && (
            <Badge variant="error" mono className="font-bold">OT RISK</Badge>
          )}
          {staff.secondary && (
            <Badge variant="secondary" mono>Cross-certified</Badge>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            { label: "Assigned", value: staff.hours, warn: false },
            { label: "Goal", value: staff.goal, warn: false },
            { label: "Equity", value: staff.equity, warn: staff.otRisk },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-white/8 ring-1 ring-white/10 px-2.5 py-2 text-center">
              <p className="font-data-mono text-[10px] text-on-primary-container uppercase">{item.label}</p>
              <p className={cn("font-headline-md text-headline-md font-bold mt-0.5", item.warn ? "text-error" : "text-inverse-on-surface")}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const tabs = (
    <div className="shrink-0 px-4 py-3 border-b border-outline-variant bg-surface-container-lowest">
      <SegmentedControl
        options={[
          { id: "overview", label: "Overview" },
          { id: "schedule", label: "Schedule" },
          { id: "certs", label: "Certs" },
        ]}
        value={tab}
        onChange={(id) => setTab(id as PanelTab)}
      />
    </div>
  );

  const footer = (
    <div className="flex flex-col gap-2">
      {confirmDelete ? (
        <div className="flex gap-2">
          <Button variant="outline" fullWidth onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button variant="danger" fullWidth onClick={onDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting…" : "Confirm Delete"}
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button variant="outline" fullWidth onClick={onClose}>Close</Button>
          <Button variant="primary" fullWidth icon="edit" onClick={onEdit}>Edit</Button>
          <Button variant="danger" fullWidth icon="delete" onClick={() => setConfirmDelete(true)}>Delete</Button>
        </div>
      )}
    </div>
  );

  return (
    <Drawer open={open} onClose={onClose} header={<>{header}{tabs}</>} footer={footer}>
      <div className="p-4 space-y-4">
        {tab === "overview" && (
          <>
            <CardSection title="Contact" icon={<Icon name="contact_mail" size={16} className="text-secondary" />}>
              <FormField label="Email" value={staff.email} />
            </CardSection>
            <CardSection title="Locations" icon={<Icon name="location_on" size={16} className="text-secondary" />}>
              <div className="flex flex-wrap gap-2">
                <Chip variant="primary" dot>
                  {staff.primary} <span className="text-[9px] opacity-70">PRIMARY</span>
                </Chip>
                {staff.secondary && <Chip variant="secondary">{staff.secondary}</Chip>}
              </div>
            </CardSection>
            <CardSection title="Hours & Cap" icon={<Icon name="timelapse" size={16} className="text-secondary" />}>
              <ProgressBar
                value={staff.progress}
                variant={staff.otRisk ? "error" : "default"}
                label="Weekly progress"
                showLabel={false}
                footer={
                  <div className="flex justify-between font-data-mono text-[11px] text-on-surface-variant">
                    <span>{staff.cap}</span>
                    <span className={staff.otRisk ? "text-error font-bold" : "text-secondary font-bold"}>
                      {staff.delta} · {staff.headroom}
                    </span>
                  </div>
                }
              />
            </CardSection>
          </>
        )}
        {tab === "schedule" && (
          <CardSection title="Recurring Availability">
            <div className="rounded-lg bg-surface-container-lowest p-3 ring-1 ring-outline-variant/60">
              <p className="font-data-mono text-data-mono text-primary font-medium">{staff.availability}</p>
              <p className="font-badge-mono text-badge-mono text-outline mt-1">{staff.hoursRange}</p>
            </div>
          </CardSection>
        )}
        {tab === "certs" && (
          <CardSection title="Skills & Certifications">
            <div className="flex flex-wrap gap-2">
              {staff.skills.map((skill, i) => (
                <Chip key={skill} variant={i === 0 ? "primary" : "default"} className="font-badge-mono text-badge-mono">
                  {skill}
                </Chip>
              ))}
            </div>
          </CardSection>
        )}
      </div>
    </Drawer>
  );
}
