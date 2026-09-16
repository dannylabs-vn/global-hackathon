import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./Footer.css";

function FooterPanel({ kind, onClose, onDemo }) {
  const ref = useRef(null);
  const title = {
    manifesto: "Reading should turn into progress.",
    changelog: "What’s new on this page",
    install: "Try Skillmark before you install.",
  }[kind];
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    ref.current.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      className="demo-dialog footer-panel"
      aria-labelledby="footer-panel-title"
      onCancel={onClose}
    >
      <button className="demo-close" aria-label="Close panel" onClick={onClose}>
        ×
      </button>
      <p className="demo-eyebrow">SKILLMARK</p>
      <h2 id="footer-panel-title">{title}</h2>
      {kind === "manifesto" && (
        <>
          <p>The ideas behind Skillmark:</p>
          <ul>
            <li>Start with the reading you already do.</li>
            <li>
              Turn a highlight into an explanation, a skill, and a next step.
            </li>
            <li>Use practice to discover what to learn next.</li>
            <li>Keep your reading signal yours.</li>
          </ul>
          <a href="#learning-loop" onClick={onClose} className="demo-primary">
            Explore the learning loop →
          </a>
        </>
      )}
      {kind === "changelog" && (
        <>
          <p>Updates to this landing-page prototype:</p>
          <ul>
            <li>A refreshed final CTA and compact footer.</li>
            <li>
              Clickable skill rows and an interactive practice walkthrough.
            </li>
            <li>
              Pointer-responsive previews, scroll reveals, and reduced-motion
              support.
            </li>
          </ul>
        </>
      )}
      {kind === "install" && (
        <>
          <p>
            The extension’s store link hasn’t been connected yet. You can
            explore the highlight-to-practice flow in the interactive demo.
          </p>
          <button className="demo-primary" onClick={onDemo}>
            Try the interactive demo →
          </button>
        </>
      )}
    </dialog>,
    document.body,
  );
}

export function Footer({ onDemo }) {
  const [panel, setPanel] = useState(null);
  const [copyStatus, setCopyStatus] = useState("");
  async function copyHandle() {
    try {
      await navigator.clipboard.writeText("@marginstudy");
      setCopyStatus("Copied @marginstudy");
    } catch {
      setCopyStatus("Copy this handle: @marginstudy");
    }
  }
  return (
    <>
      <footer
        id="footer"
        className="closing-footer reveal"
        data-pencil-name="3. Final CTA"
      >
        <div id="get-started" className="closing-content">
          <h2>Your next skill is already in your tabs.</h2>
          <p className="closing-sub">
            Add Margin and let the reading you already do start compounding into
            a plan.
          </p>
          <button
            className="closing-install"
            onClick={() => setPanel("install")}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19.439 7.85c-.049.322.059.648.289.878a1 1 0 0 0 .878.29 2 2 0 1 1 0 3.964 1 1 0 0 0-1.168 1.169c.13.81.19 1.63.18 2.449a1 1 0 0 1-.996.996 14.4 14.4 0 0 1-2.45-.18 1 1 0 0 0-1.168 1.169 2 2 0 1 1-3.964 0 1 1 0 0 0-1.168-1.169c-.811.13-1.63.19-2.45.18a1 1 0 0 1-.996-.996 14.4 14.4 0 0 1 .18-2.45 1 1 0 0 0-1.169-1.168 2 2 0 1 1 0-3.964A1 1 0 0 0 7.85 7.85a14.4 14.4 0 0 1-.18-2.45 1 1 0 0 1 .996-.996c.82-.01 1.639.05 2.45.18a1 1 0 0 0 1.168-1.169 2 2 0 1 1 3.964 0 1 1 0 0 0 1.168 1.169c.811-.13 1.63-.19 2.45-.18a1 1 0 0 1 .996.996c.01.82-.05 1.639-.18 2.45Z" />
            </svg>
            Add Margin to Chrome — free
          </button>
          <p className="closing-note">
            Free during beta · Chrome &amp; Firefox · No account, ever
          </p>
        </div>
        <div className="footer-bottom">
          <a
            className="footer-brand"
            href="#top"
            aria-label="Skillmark, back to top"
          >
            <span className="brand-skill">Skill</span><span className="brand-mark">mark.</span>
            <small>© 2025</small>
          </a>
          <nav aria-label="Footer navigation">
            <a href="#privacy">Privacy</a>
            <button onClick={() => setPanel("manifesto")}>Manifesto</button>
            <button onClick={() => setPanel("changelog")}>Changelog</button>
            <button onClick={copyHandle} title="Copy @marginstudy">
              @Skillmark.
            </button>
          </nav>
        </div>
        <p className="footer-copy-status" role="status">
          {copyStatus}
        </p>
      </footer>
      {panel && (
        <FooterPanel
          kind={panel}
          onClose={() => setPanel(null)}
          onDemo={() => {
            setPanel(null);
            onDemo();
          }}
        />
      )}
    </>
  );
}
