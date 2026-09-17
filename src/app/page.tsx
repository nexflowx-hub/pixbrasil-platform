import { AmbientBackground } from "@/components/visuals/ambient-background";
import { SiteHeader } from "@/components/marketing/header";
import { HeroSection } from "@/components/marketing/hero";
import { CapabilityBar } from "@/components/marketing/capability-bar";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Audiences } from "@/components/marketing/audiences";
import { Trust } from "@/components/marketing/trust";
import { SiteFooter } from "@/components/marketing/footer";

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip bg-[#02090B]">
      <AmbientBackground />
      <SiteHeader />
      <main className="relative flex-1">
        <HeroSection />
        <CapabilityBar />
        <HowItWorks />
        <Audiences />
        <Trust />
      </main>
      <SiteFooter />
    </div>
  );
}
