import { Link } from "react-router-dom";

/**
 * Back link component for navigation.
 */
export function BackLink({ to, label = "Back" }) {
  return (
    <Link to={to} className="back-link">
      <span aria-hidden="true">←</span>
      {label}
    </Link>
  );
}

/**
 * Reusable page header with glassmorphism sticky bar.
 *
 * Props:
 *  - eyebrow: small label above title
 *  - title: main heading
 *  - subtitle: description below title
 *  - children: actions slot (right side)
 *  - backTo: link target for back button
 *  - backLabel: text for back link
 */
export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  children,
  backTo,
  backLabel,
}) {
  return (
    <>
      <header className="page-header">
        <div className="page-header__inner">
          <div className="page-header__content">
            {backTo && (
              <BackLink to={backTo} label={backLabel || "Back"} />
            )}
            {eyebrow && (
              <span className="page-header__eyebrow">{eyebrow}</span>
            )}
            <h1 className="page-header__title">{title}</h1>
            {subtitle && (
              <p className="page-header__subtitle">{subtitle}</p>
            )}
          </div>
          {children && (
            <div className="page-header__actions">{children}</div>
          )}
        </div>
      </header>
      <div className="page-header__accent-line" />
    </>
  );
}
