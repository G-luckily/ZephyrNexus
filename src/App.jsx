import React, { useState, useEffect } from 'react'
import { Ic } from './components/Icons'
import { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakColor, TweakToggle } from './components/TweaksPanel'
import { Hero, Audit, IA, Tokens } from './components/Sections1'
import { ConsoleSection, WorkflowCloseup, RuntimeCloseup, MetricCards, Responsive } from './components/Sections2'
import { ComponentLibrary, Handoff, Foot } from './components/Sections3'

const TWEAK_DEFAULTS = {
  density: "comfortable",
  accent: "copper",
  showWindStreaks: true,
};

const Nav = () => (
  <nav className="nav">
    <div className="shell nav-inner">
      <a className="nav-logo" href="#top">
        <span className="mark"><Ic name="wind" size={22} stroke={1.6} /></span>
        <span className="word">Zephyr Nexus<small>风之灵枢</small></span>
      </a>
      <div className="nav-links">
        <a href="#audit">Audit</a>
        <a href="#ia">IA</a>
        <a href="#direction">Tokens</a>
        <a href="#console">Console</a>
        <a href="#runtime">Runtime</a>
        <a href="#components">Components</a>
        <a href="#handoff">Handoff</a>
      </div>
      <div className="nav-actions">
        <button className="btn ghost"><Ic name="search" size={13} /> Search <span className="kbd">⌘K</span></button>
        <a className="btn copper" href="#console"><Ic name="play" size={12} /> 进入 Console</a>
      </div>
    </div>
  </nav>
);

const App = () => {
  const [t, setT] = useTweaks(TWEAK_DEFAULTS);

  useEffect(() => {
    const accents = {
      copper:  ["#E0A982", "#C97847", "#A35E33"],
      mint:    ["#8FE9C2", "#5DD2A3", "#3CA67E"],
      steel:   ["#A9B6BD", "#7A8B95", "#475560"],
      ember:   ["#F0A48B", "#E0795E", "#A6442A"],
    };
    const a = accents[t.accent] || accents.copper;
    document.documentElement.style.setProperty("--copper-200", a[0]);
    document.documentElement.style.setProperty("--copper-300", a[1]);
    document.documentElement.style.setProperty("--copper-400", a[2]);
  }, [t.accent]);

  useEffect(() => {
    if (t.density === "compact") {
      document.documentElement.style.setProperty("--s-24", "64px");
      document.documentElement.style.setProperty("--s-20", "56px");
      document.documentElement.style.fontSize = "14px";
    } else {
      document.documentElement.style.setProperty("--s-24", "96px");
      document.documentElement.style.setProperty("--s-20", "80px");
      document.documentElement.style.fontSize = "15px";
    }
  }, [t.density]);

  return (
    <>
      <a id="top" />
      <Nav />
      <Hero />
      <Audit />
      <IA />
      <Tokens />
      <ConsoleSection />
      <WorkflowCloseup />
      <RuntimeCloseup />
      <MetricCards />
      <Responsive />
      <ComponentLibrary />
      <Handoff />
      <Foot />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Accent">
          <TweakColor
            label="主色"
            value={t.accent}
            options={[
              ["#E0A982","#C97847","#A35E33"],
              ["#8FE9C2","#5DD2A3","#3CA67E"],
              ["#A9B6BD","#7A8B95","#475560"],
              ["#F0A48B","#E0795E","#A6442A"],
            ]}
            onChange={(v, i) => {
              const map = ["copper", "mint", "steel", "ember"];
              setT("accent", map[i]);
            }}
          />
        </TweakSection>
        <TweakSection label="Layout">
          <TweakRadio
            label="Density"
            value={t.density}
            options={["compact", "comfortable"]}
            onChange={(v) => setT("density", v)}
          />
          <TweakToggle
            label="Wind streaks in hero"
            value={t.showWindStreaks}
            onChange={(v) => {
              setT("showWindStreaks", v);
              const el = document.querySelector(".hero-wind");
              if (el) el.style.display = v ? "" : "none";
            }}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
};

export default App;
