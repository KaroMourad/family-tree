import type { Person, TreeNode } from "../types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

type Props = {
  person: (Person | TreeNode) | null;
  byId: Record<string, (Person | TreeNode) & { childIds?: string[] }>;
  onClose: () => void;
};

function Row({ label, value }: { label: string; value: unknown }) {
  if (value == null || value === "") return null;
  return (
    <div className="mt-3 first:mt-0">
      <dt className="text-[10px] uppercase tracking-[0.2em] text-secondary">{label}</dt>
      <dd className="text-sm text-foreground m-0 mt-0.5">{String(value)}</dd>
    </div>
  );
}

export function DetailPanel({ person, byId, onClose }: Props) {
  const open = !!person;
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-[360px] sm:max-w-[360px] overflow-y-auto">
        {person && (
          <>
            <SheetHeader>
              <SheetTitle className="text-2xl uppercase tracking-[0.15em] text-primary font-semibold">
                {person.name}
              </SheetTitle>
            </SheetHeader>
            <Separator className="my-3" />
            <dl className="m-0">
              <Row label="ID" value={person.id} />
              <Row label="Nickname" value={person.nickname} />
              <Row label="Gender" value={person.gender} />
              <Row label="Surname (birth)" value={person.surnameBirth} />
              <Row label="Surname (now)" value={person.surnameNow} />
              <Row
                label="Born"
                value={[person.birthDay, person.birthMonth, person.birthYear].filter(Boolean).join(" ")}
              />
              <Row label="Birth place" value={person.birthPlace} />
              <Row label="Died" value={person.deathYear} />
              <Row label="Death place" value={person.deathPlace} />
              <Row
                label="Father"
                value={
                  (person.fatherId && byId[person.fatherId]?.name) ||
                  person.fatherName ||
                  ""
                }
              />
              <Row
                label="Mother"
                value={
                  (person.motherId && byId[person.motherId]?.name) ||
                  person.motherName ||
                  ""
                }
              />
              <Row
                label="Partner"
                value={
                  (person.partnerId && byId[person.partnerId]?.name) ||
                  person.partnerName ||
                  ""
                }
              />
              <Row
                label="Children"
                value={
                  "children" in person && Array.isArray((person as TreeNode).children)
                    ? (person as TreeNode).children.map((c) => c.name).join(", ")
                    : ""
                }
              />
              <Row label="Profession" value={person.profession} />
              <Row label="Notes" value={person.bio} />
            </dl>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
