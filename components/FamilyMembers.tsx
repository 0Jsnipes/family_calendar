"use client";

import { Users } from "lucide-react";
import type { FamilyMember } from "@/types";

type Props = {
  familyMembers: FamilyMember[];
  lastUpdatedLabel: string;
};

export default function FamilyMembers({
  familyMembers,
  lastUpdatedLabel,
}: Props) {
  return (
    <article className="mini-card">
      <div className="panel-header compact">
        <h2>Family</h2>
        <Users className="icon" />
      </div>
      <div className="member-chips">
        {familyMembers.map((member) => (
          <span key={member.id} style={{ backgroundColor: member.color }}>
            {member.initials} {member.name}
          </span>
        ))}
      </div>
      <p className="muted small">Last updated {lastUpdatedLabel}</p>
    </article>
  );
}
