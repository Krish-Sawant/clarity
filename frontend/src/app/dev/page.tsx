import FixturePage from "@/components/FixturePage";
import TestBench from "@/components/TestBench";

export default function DevPage() {
  return <FixturePage render={(fixtures) => <TestBench fixtures={fixtures} />} />;
}
