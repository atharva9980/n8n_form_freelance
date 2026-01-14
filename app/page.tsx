import OnboardingForm from "@/components/OnboardingForm";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-24">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center text-slate-800">
          Client Management Portal
        </h1>
        <OnboardingForm />
      </div>
    </main>
  );
}