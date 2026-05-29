import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { usePeople } from "../hooks/usePeople";
import { useUIStore } from "../store/ui";
import { flattenTree, nestPeople } from "../api/nest";
import type { TreeNode } from "../types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, UserPlus } from "lucide-react";

export type DetailPanelActions = {
  onEdit: (person: TreeNode) => void;
  onAddChild: (person: TreeNode) => void;
  onDelete: (person: TreeNode) => void;
};

type Props = {
  /** When provided, render an action footer (Add child, Edit, Delete). Read-only views omit this. */
  actions?: DetailPanelActions;
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

export function DetailPanel({ actions }: Props = {}) {
  const { treeId } = useParams();
  const { data: people } = usePeople(treeId);
  const selectedId = useUIStore((s) => s.selectedPersonId);
  const setSelectedId = useUIStore((s) => s.setSelectedPerson);

  const byId = useMemo(
    () => (people ? flattenTree(nestPeople(people)) : {}),
    [people],
  );
  const person = selectedId ? (byId[selectedId] as TreeNode | undefined) ?? null : null;
  const open = !!person;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) setSelectedId(null); }}>
      <SheetContent side="right" className="w-[360px] sm:max-w-[360px]">
        {person && (
          <>
            <SheetHeader>
              <SheetTitle className="text-2xl uppercase tracking-[0.15em] text-primary font-semibold">
                {person.name}
              </SheetTitle>
            </SheetHeader>
            <Separator />
            <dl className="m-0 p-4 overflow-y-auto">
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
                value={person.children?.map((c) => c.name).join(", ") ?? ""}
              />
              <Row label="Profession" value={person.profession} />
              <Row label="Notes" value={person.bio} />
            </dl>
            {actions && (
              <>
                <Separator />
                <div className="p-4 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => actions.onAddChild(person)}
                    className="uppercase tracking-widest"
                  >
                    <UserPlus /> Add child
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => actions.onEdit(person)}
                    className="uppercase tracking-widest"
                  >
                    <Pencil /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => actions.onDelete(person)}
                    className="ml-auto uppercase tracking-widest text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 /> Delete
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
