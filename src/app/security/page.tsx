import { SecurityDashboard } from "@/components/security-dashboard";

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Security Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Real-time threat monitoring for Quick Grade
          </p>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <SecurityDashboard />
      </main>
    </div>
  );
}
