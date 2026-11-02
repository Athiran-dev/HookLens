"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Shell from "@/components/Shell";
import { PageHeader } from "@/components/app";
import RequestsExplorer from "@/components/RequestsExplorer";

function Inner() {
  const params = useSearchParams();
  return (
    <>
      <PageHeader crumbs={["Dashboard", "Requests"]} title="Requests" subtitle="Every webhook captured across your endpoints. Select one to inspect the exact payload and replay it." />
      <RequestsExplorer initialQuery={params.get("q") ?? ""} initialReq={params.get("req") ?? ""} />
    </>
  );
}

export default function Page() {
  return (
    <Shell>
      <Suspense>
        <Inner />
      </Suspense>
    </Shell>
  );
}
