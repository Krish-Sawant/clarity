import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import { loadFixtures, type Fixtures } from "@/lib/fixtures";

type Render = (fixtures: Fixtures) => ReactNode;

async function Loaded({ render }: { render: Render }) {
  // Read fixtures on every request so edits to the JSON show up on refresh.
  await connection();
  const result = await loadFixtures().then(
    (fixtures) => ({ fixtures, error: null }),
    (error: unknown) => ({ fixtures: null, error }),
  );
  if (!result.fixtures) {
    return (
      <pre className="m-8 whitespace-pre-wrap rounded border border-red-400 bg-red-50 p-4 text-sm text-red-800">
        Failed to load backend fixtures: {String(result.error)}
      </pre>
    );
  }
  return render(result.fixtures);
}

// Server wrapper for pages built on the backend's fixture JSON (quiz, lessons, test bench).
export default function FixturePage({ render }: { render: Render }) {
  return (
    <Suspense fallback={<p className="p-8">Loading…</p>}>
      <Loaded render={render} />
    </Suspense>
  );
}
