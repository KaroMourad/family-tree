import type { Person, TreeNode } from "../types";

type Props = {
  person: (Person | TreeNode) | null;
  byId: Record<string, (Person | TreeNode) & { childIds?: string[] }>;
  onClose: () => void;
};

function Row({ label, value }: { label: string; value: unknown }) {
  if (value == null || value === "") return null;
  return (
    <>
      <dt>{label}</dt>
      <dd>{String(value)}</dd>
    </>
  );
}

export function DetailPanel({ person, byId, onClose }: Props) {
  const open = !!person;
  return (
    <aside className={`detail-panel${open ? " open" : ""}`}>
      <button className="close" onClick={onClose}>×</button>
      {person && (
        <>
          <h2>{person.name}</h2>
          <dl>
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
    </aside>
  );
}
