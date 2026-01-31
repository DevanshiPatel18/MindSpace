import { Card, CardBody } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";

export default function InsightsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Insights" subtitle="On-device insights will appear here (later module)." />
      <Card>
        <CardBody>
          <div className="text-sm text-neutral-700">Insights are not available yet.</div>
        </CardBody>
      </Card>
    </div>
  );
}