import { Card, CardBody } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";

export default function ArchivePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Archive" subtitle="Entries will appear here once journaling is implemented." />
      <Card>
        <CardBody>
          <div className="text-sm text-neutral-700">No entries yet.</div>
        </CardBody>
      </Card>
    </div>
  );
}
