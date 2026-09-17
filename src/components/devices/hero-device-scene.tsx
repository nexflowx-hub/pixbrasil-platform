import { DashboardMockup } from "@/components/devices/dashboard-mockup";
import { PhoneMockup } from "@/components/devices/phone-mockup";
import { BrazilNetwork } from "@/components/visuals/brazil-network";

/**
 * Desktop-composition of the hero: smartphone in front-left overlapping the
 * laptop dashboard, Brazil network map + orbital copy on the right.
 * The scene is a fixed 1030x470 canvas scaled fluidly via .hero-scene-*.
 */
export function HeroDeviceScene() {
  return (
    <div className="hero-scene-viewport">
      <div className="hero-scene-canvas">
        <div className="relative h-[470px] w-[1030px] select-none">
          {/* Light source behind the laptop */}
          <div
            aria-hidden="true"
            className="anim-fade absolute left-[130px] top-[10px] h-[460px] w-[820px] rounded-full blur-[90px]"
            style={{
              background:
                "radial-gradient(closest-side, rgba(24,239,169,0.22) 0%, rgba(5,24,26,0) 70%)",
            }}
          />

          {/* Brazil network map (behind laptop, to the right) */}
          <div className="anim-fade absolute -right-[72px] -top-[14px] z-[1] w-[450px]">
            <BrazilNetwork className="h-auto w-full" />
          </div>

          {/* Right-side orbital copy */}
          <p
            className="anim-fade absolute right-[2px] top-[182px] z-[2] text-right text-[10px] font-semibold uppercase leading-[1.7] tracking-[0.34em] text-mist"
            style={{ animationDelay: "0.9s" }}
          >
            Do Brasil
            <br />
            para o mundo
          </p>
          <p
            className="anim-fade absolute bottom-[24px] right-[2px] z-[2] text-right text-[11px] font-bold uppercase leading-[1.75] tracking-[0.18em] text-white/85"
            style={{ animationDelay: "1.05s" }}
          >
            Ativos digitais.
            <br />
            Mais liberdade
            <br />
            <span className="text-gradient-hero">para o seu amanhã.</span>
          </p>

          {/* Laptop */}
          <div className="anim-laptop absolute left-[196px] top-[2px] z-[3] origin-top-left scale-[0.88]">
            <div className="float-slower">
              <DashboardMockup />
            </div>
          </div>

          {/* Smartphone */}
          <div className="anim-phone absolute left-[26px] top-[26px] z-[5]">
            <div className="float-slow">
              <PhoneMockup />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
