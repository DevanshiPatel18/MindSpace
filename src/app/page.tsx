import Link from "next/link";
import { Card, CardBody } from "@/components/Card";
import { Button } from "@/components/Button";

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-3xl px-4 py-10 md:py-12">
        <Card>
          <CardBody>
            <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Trust-first journaling • local-first • encrypted
            </div>

            <h1 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight text-neutral-900">
              Mindspace
            </h1>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button>Start (coming next)</Button>
              <Link href="/unlock">
                <Button variant="secondary">Go to Unlock</Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}