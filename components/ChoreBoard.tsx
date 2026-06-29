"use client";

import { CheckCircle2 } from "lucide-react";
import type { Chore, FamilyMember } from "@/types";
import { memberById } from "./dashboard-utils";

type Props = {
  chores: Chore[];
  familyMembers: FamilyMember[];
};

export default function ChoreBoard({ chores, familyMembers }: Props) {
  return (
    <article className="mini-card">
      <div className="panel-header compact">
        <h2>Chores</h2>
        <CheckCircle2 className="icon" />
      </div>
      {chores.map((chore) => {
        const owner = memberById(familyMembers, chore.ownerId);
        return (
          <div key={chore.id} className="chore-row">
            <div>
              <strong>{chore.title}</strong>
              <p>{owner.name}</p>
            </div>
            <span className={chore.done ? "done" : ""}>
              {chore.done ? "Done" : owner.initials}
            </span>
          </div>
        );
      })}
    </article>
  );
}
